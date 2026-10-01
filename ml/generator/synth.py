"""Generatore del dataset sintetico (CLAUDE.md §7.3).

Compone tavoli da burraco 640×640 (la dimensione dei riquadri che il modello
vede nell'app) con le carte ritagliate da extract_cards.py: giochi a
ventaglio con forte sovrapposizione, più file, rotazioni, doppio mazzo,
carte sparse, sfondi di tavoli e tappeti, ombre, riflessi, sfocatura e
prospettiva. Le etichette YOLO si calcolano dall'occlusione reale: ognuno dei
quattro indici d'angolo coperto per più del 35% non viene etichettato.

Uso: python synth.py --out out/synth --train 20000 --val 1000 [--workers 8]
"""

from __future__ import annotations

import argparse
import json
import math
import random
from multiprocessing import Pool
from pathlib import Path

import albumentations as A
import cv2
import numpy as np

from classes import CLASSES, class_id
from extract_cards import CARD_H, CARD_W, rounded_mask

HERE = Path(__file__).resolve().parent
CARDS_DIR = HERE / "assets/cards"
PHOTOS_DIR = HERE.parent / "photos/deck"
SIZE = 640
MIN_VISIBLE = 0.65

RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
SUITS = ["C", "D", "H", "S"]


# ---------------------------------------------------------------- risorse

class Assets:
    def __init__(self) -> None:
        self.cards = {p.stem: cv2.cvtColor(cv2.imread(str(p)), cv2.COLOR_BGR2RGB) for p in sorted(CARDS_DIR.glob("*.jpg"))}
        self.mask = rounded_mask()
        boxes = json.loads((CARDS_DIR / "index_boxes.json").read_text())
        self.boxes = {name: np.array(b, dtype=np.float32) for name, b in boxes.items()}
        self.table_patches = self._table_patches()

    def _table_patches(self) -> list[np.ndarray]:
        """Strisce di tavolo vero ai lati della carta nelle foto del mazzo."""
        quads = json.loads((CARDS_DIR / "quads.json").read_text())
        patches = []
        for name, info in list(quads.items())[::3]:
            img = cv2.imread(str(PHOTOS_DIR / f"{name}.jpg"))
            if img is None:
                continue
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            w, h = info["size"]
            if img.shape[1] != w:  # orientamento EXIF non applicato da OpenCV
                img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
            quad = np.array(info["quad"])
            x0, x1 = quad[:, 0].min(), quad[:, 0].max()
            for a, b in [(0, x0), (x1, w)]:
                if b - a > 0.08 * w:
                    strip = img[:, int(a) + 5 : int(b) - 5]
                    patches.append(cv2.resize(strip, (max(8, strip.shape[1] // 4), max(8, strip.shape[0] // 4))))
        return patches


# ---------------------------------------------------------------- sfondi

def background(rng: random.Random, assets: Assets) -> np.ndarray:
    kind = rng.choices(["photo", "wood", "felt", "cloth", "checks"], [3, 3, 2, 2, 1])[0]
    if kind == "photo" and assets.table_patches:
        patch = rng.choice(assets.table_patches)
        bg = cv2.resize(patch, (SIZE, SIZE), interpolation=cv2.INTER_CUBIC)
        if rng.random() < 0.5:
            bg = cv2.rotate(bg, cv2.ROTATE_90_CLOCKWISE)
        return bg
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    noise = cv2.GaussianBlur(np.random.default_rng(rng.randrange(2**31)).normal(0, 1, (SIZE, SIZE)).astype(np.float32), (0, 0), 3)
    if kind == "wood":
        base = np.array([rng.uniform(60, 170), rng.uniform(35, 110), rng.uniform(15, 70)], np.float32)
        angle = rng.uniform(0, math.pi)
        t = x * math.cos(angle) + y * math.sin(angle)
        grain = np.sin(t / rng.uniform(4, 14) + noise * 3) * 0.5 + 0.5
        img = base * (0.75 + 0.35 * grain[..., None])
    elif kind == "felt":
        base = np.array(rng.choice([(20, 90, 50), (25, 55, 110), (110, 30, 35), (40, 40, 40)]), np.float32)
        img = base * (0.85 + 0.15 * noise[..., None])
    elif kind == "cloth":
        base = np.array([rng.uniform(120, 230) for _ in range(3)], np.float32)
        img = base * (0.9 + 0.08 * noise[..., None])
    else:
        c1 = np.array([rng.uniform(150, 240) for _ in range(3)], np.float32)
        c2 = np.array([rng.uniform(40, 200) for _ in range(3)], np.float32)
        step = rng.uniform(20, 60)
        checks = ((x // step + y // step) % 2)[..., None]
        img = c1 * checks + c2 * (1 - checks)
        img = img * (0.92 + 0.06 * noise[..., None])
    return np.clip(img, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------- disposizione

def card_name(rank: str, suit: str) -> str:
    return f"{rank}{suit}"


def meld_cards(rng: random.Random) -> list[str]:
    """Scale, tris o carte a caso, con pinelle e jolly come matte."""
    kind = rng.choices(["run", "set", "random"], [5, 3, 1])[0]
    if kind == "run":
        n = rng.randint(3, 11)
        suit = rng.choice(SUITS)
        start = rng.randint(0, 13 - min(n, 13))
        cards = [card_name(RANKS[(start + i) % 13], suit) for i in range(n)]
    elif kind == "set":
        rank = rng.choice(RANKS[2:] + ["A"])
        cards = [card_name(rank, rng.choice(SUITS)) for _ in range(rng.randint(3, 8))]
    else:
        cards = [card_name(rng.choice(RANKS), rng.choice(SUITS)) for _ in range(rng.randint(2, 6))]
    if rng.random() < 0.35:
        wild = rng.choice(["JK1", "JK2", card_name("2", rng.choice(SUITS))])
        cards.insert(rng.randrange(len(cards) + 1), wild)
    return cards


def affine(cx: float, cy: float, angle_deg: float, scale: float) -> np.ndarray:
    """Da coordinate della carta canonica (pixel) a coordinate della scena."""
    a = math.radians(angle_deg)
    c, s = math.cos(a) * scale, math.sin(a) * scale
    return np.array(
        [[c, -s, cx - c * CARD_W / 2 + s * CARD_H / 2], [s, c, cy - s * CARD_W / 2 - c * CARD_H / 2]],
        dtype=np.float32,
    )


def layout(rng: random.Random) -> list[tuple[str, np.ndarray]]:
    """Carte in ordine di disegno (le ultime sopra), ognuna con la sua trasformazione."""
    width = math.exp(rng.uniform(math.log(70), math.log(320)))
    scale = width / CARD_W
    height = CARD_H * scale
    placed: list[tuple[str, np.ndarray]] = []
    for _ in range(rng.randint(1, 4)):
        cards = meld_cards(rng)
        vertical = rng.random() < 0.4
        step = height * rng.uniform(0.14, 0.3) if vertical else width * rng.uniform(0.18, 0.4)
        angle = rng.uniform(-20, 20) + rng.choices([0, 180, 90], [7, 2, 1])[0]
        rad = math.radians(angle)
        direction = (-math.sin(rad), math.cos(rad)) if vertical else (math.cos(rad), math.sin(rad))
        x0, y0 = rng.uniform(-0.2, 1.0) * SIZE, rng.uniform(-0.2, 1.0) * SIZE
        for i, name in enumerate(cards):
            jitter = width * 0.02
            cx = x0 + direction[0] * step * i + rng.uniform(-jitter, jitter)
            cy = y0 + direction[1] * step * i + rng.uniform(-jitter, jitter)
            placed.append((name, affine(cx, cy, angle + rng.uniform(-3, 3), scale * rng.uniform(0.97, 1.03))))
    for _ in range(rng.choices([0, 1, 2, 3, 4], [3, 2, 2, 1, 1])[0]):  # carte in mano, sparse
        name = rng.choice(["JK1", "JK2"]) if rng.random() < 0.04 else card_name(rng.choice(RANKS), rng.choice(SUITS))
        placed.append((name, affine(rng.uniform(0, SIZE), rng.uniform(0, SIZE), rng.uniform(0, 360), scale)))
    return placed


# ---------------------------------------------------------------- composizione ed etichette

def compose(rng: random.Random, assets: Assets) -> tuple[np.ndarray, list[tuple[int, list[float]]]]:
    scene = background(rng, assets).astype(np.float32)
    placed = layout(rng) if rng.random() > 0.03 else []  # qualche tavolo vuoto come negativo
    masks = []
    for name, m in placed:
        card = assets.cards[name].astype(np.float32)
        card = card * rng.uniform(0.78, 1.12) + np.array([rng.uniform(-8, 8) for _ in range(3)], np.float32)
        warped = cv2.warpAffine(np.clip(card, 0, 255), m, (SIZE, SIZE), flags=cv2.INTER_LINEAR)
        alpha = cv2.warpAffine(assets.mask, m, (SIZE, SIZE), flags=cv2.INTER_LINEAR).astype(np.float32) / 255
        # Ombra della carta sul tavolo e sulle carte sotto.
        shift = np.float32([[1, 0, rng.uniform(1, 5)], [0, 1, rng.uniform(1, 6)]])
        shadow = cv2.GaussianBlur(cv2.warpAffine(alpha, shift, (SIZE, SIZE)), (0, 0), 3) * rng.uniform(0.2, 0.45)
        scene *= 1 - shadow[..., None]
        scene = scene * (1 - alpha[..., None]) + warped * alpha[..., None]
        masks.append(alpha > 0.5)

    # Copertura dall'alto: above[i] = unione delle carte disegnate dopo la i-esima.
    above = [np.zeros((SIZE, SIZE), bool) for _ in placed]
    cover = np.zeros((SIZE, SIZE), bool)
    for i in range(len(placed) - 1, -1, -1):
        above[i] = cover.copy()
        cover |= masks[i]

    labels = []
    for i, (name, m) in enumerate(placed):
        x0, y0, x1, y1 = assets.boxes[name]
        # Le carte Modiano hanno l'indice in tutti e quattro gli angoli.
        corners4 = [(x0, y0, x1, y1), (1 - x1, y0, 1 - x0, y1), (x0, 1 - y1, x1, 1 - y0), (1 - x1, 1 - y1, 1 - x0, 1 - y0)]
        for box in corners4:
            corners = np.array(
                [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]], np.float32
            ) * [CARD_W, CARD_H]
            quad = (corners @ m[:, :2].T + m[:, 2]).astype(np.float32)
            full_area = abs(cv2.contourArea(quad))
            if full_area < 30:
                continue
            poly = np.zeros((SIZE, SIZE), np.uint8)
            cv2.fillConvexPoly(poly, np.round(quad).astype(np.int32), 1)
            visible = poly.astype(bool) & ~above[i]
            if visible.sum() < MIN_VISIBLE * full_area:
                continue
            ys, xs = np.nonzero(visible)
            labels.append((class_id(name), [xs.min(), ys.min(), xs.max() + 1, ys.max() + 1]))

    if rng.random() < 0.3:  # riflesso di una lampada sulla plastica delle carte
        y, x = np.mgrid[0:SIZE, 0:SIZE]
        cx, cy, r = rng.uniform(0, SIZE), rng.uniform(0, SIZE), rng.uniform(60, 250)
        glare = np.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * r * r)) * rng.uniform(25, 70)
        scene += glare[..., None]
    return np.clip(scene, 0, 255).astype(np.uint8), labels


AUGMENT = A.Compose(
    [
        A.Perspective(scale=(0.02, 0.07), p=0.4),
        A.RandomBrightnessContrast(0.25, 0.25, p=0.7),
        A.HueSaturationValue(8, 20, 15, p=0.5),
        A.RandomGamma(p=0.3),
        A.RandomShadow(shadow_roi=(0, 0, 1, 1), p=0.3),
        A.OneOf([A.GaussianBlur(blur_limit=(3, 5)), A.MotionBlur(blur_limit=(3, 7))], p=0.35),
        A.GaussNoise(std_range=(0.01, 0.05), p=0.3),
        A.Downscale(scale_range=(0.5, 0.9), p=0.2),
        A.ImageCompression(quality_range=(45, 95), p=0.5),
    ],
    bbox_params=A.BboxParams(format="pascal_voc", label_fields=["classes"], min_visibility=0.6),
)

_assets: Assets | None = None


def _init() -> None:
    global _assets
    _assets = Assets()
    cv2.setNumThreads(1)


def make(args: tuple[str, int, int]) -> int:
    out, split, index = args
    rng = random.Random(index * 7919 + (0 if split == "train" else 10**9))
    np.random.seed(rng.randrange(2**31))
    image, labels = compose(rng, _assets)
    if labels or rng.random() < 0.5:
        result = AUGMENT(image=image, bboxes=[b for _, b in labels], classes=[c for c, _ in labels])
        image, labels = result["image"], [(int(c), b) for c, b in zip(result["classes"], result["bboxes"])]
    name = f"{split}_{index:06d}"
    cv2.imwrite(f"{out}/{split}/images/{name}.jpg", cv2.cvtColor(image, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 92])
    with open(f"{out}/{split}/labels/{name}.txt", "w") as f:
        for c, (x0, y0, x1, y1) in labels:
            f.write(f"{c} {(x0 + x1) / 2 / SIZE:.6f} {(y0 + y1) / 2 / SIZE:.6f} {(x1 - x0) / SIZE:.6f} {(y1 - y0) / SIZE:.6f}\n")
    return len(labels)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(HERE / "out/synth"))
    parser.add_argument("--train", type=int, default=20000)
    parser.add_argument("--val", type=int, default=1000)
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    out = Path(args.out)
    jobs = []
    for split, n in [("train", args.train), ("val", args.val)]:
        (out / split / "images").mkdir(parents=True, exist_ok=True)
        (out / split / "labels").mkdir(parents=True, exist_ok=True)
        jobs += [(str(out), split, i) for i in range(n)]
    with Pool(args.workers, initializer=_init) as pool:
        total = sum(pool.imap_unordered(make, jobs, chunksize=16))
    (out / "data.yaml").write_text(
        f"path: {out.resolve()}\ntrain: train/images\nval: val/images\nnames:\n"
        + "".join(f"  {i}: {n}\n" for i, n in enumerate(CLASSES))
    )
    print(f"{len(jobs)} immagini, {total} indici etichettati → {out}")


if __name__ == "__main__":
    main()
