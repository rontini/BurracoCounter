"""Set di validazione reale dalle foto del mazzo (ml/photos/deck).

Ogni foto ha una carta: con il quadrilatero trovato da extract_cards.py e i
riquadri degli indici calcolo le etichette dei quattro angoli nella foto
originale, poi riduco la foto a 1280 px sul lato lungo.
Non sostituisce il golden set (tavoli veri, §7.4): misura quanto il modello
addestrato sul sintetico riconosce le carte fotografate.

Uso: python real_val.py --out ../generator/out/real_val
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "generator"))
from classes import CLASSES, class_id  # noqa: E402
from extract_cards import CARD_H, CARD_W  # noqa: E402

CARDS = HERE.parent / "generator/assets/cards"
PHOTOS = HERE.parent / "photos/deck"
LONG_SIDE = 1280


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(HERE.parent / "generator/out/real_val"))
    out = Path(parser.parse_args().out)
    (out / "images").mkdir(parents=True, exist_ok=True)
    (out / "labels").mkdir(parents=True, exist_ok=True)
    quads = json.loads((CARDS / "quads.json").read_text())
    boxes = json.loads((CARDS / "index_boxes.json").read_text())
    for name, info in quads.items():
        img = ImageOps.exif_transpose(Image.open(PHOTOS / f"{name}.jpg")).convert("RGB")
        quad = np.array(info["quad"], np.float32)
        if np.linalg.norm(quad[1] - quad[0]) > np.linalg.norm(quad[3] - quad[0]):
            quad = np.roll(quad, -1, axis=0)  # stessa rotazione usata nel ritaglio
        canon = np.array([[0, 0], [CARD_W - 1, 0], [CARD_W - 1, CARD_H - 1], [0, CARD_H - 1]], np.float32)
        to_photo = cv2.getPerspectiveTransform(canon, quad)
        scale = LONG_SIDE / max(img.size)
        x0, y0, x1, y1 = boxes[name]
        lines = []
        for bx0, by0, bx1, by1 in [(x0, y0, x1, y1), (1 - x1, y0, 1 - x0, y1), (x0, 1 - y1, x1, 1 - y0), (1 - x1, 1 - y1, 1 - x0, 1 - y0)]:
            pts = np.array([[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]], np.float32) * [CARD_W, CARD_H]
            p = cv2.perspectiveTransform(pts[None].astype(np.float32), to_photo)[0] * scale
            w, h = img.size[0] * scale, img.size[1] * scale
            lx0, ly0 = p.min(axis=0)
            lx1, ly1 = p.max(axis=0)
            lines.append(f"{class_id(name)} {(lx0 + lx1) / 2 / w:.6f} {(ly0 + ly1) / 2 / h:.6f} {(lx1 - lx0) / w:.6f} {(ly1 - ly0) / h:.6f}")
        img.resize((round(img.size[0] * scale), round(img.size[1] * scale)), Image.LANCZOS).save(out / "images" / f"{name}.jpg", quality=92)
        (out / "labels" / f"{name}.txt").write_text("\n".join(lines) + "\n")
    (out / "data.yaml").write_text(
        f"path: {out.resolve()}\ntrain: images\nval: images\nnames:\n" + "".join(f"  {i}: {n}\n" for i, n in enumerate(CLASSES))
    )
    print(f"{len(quads)} foto → {out}")


if __name__ == "__main__":
    main()
