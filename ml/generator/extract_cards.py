"""Ritaglia e raddrizza le carte dalle foto del mazzo (ml/photos/deck).

Ogni foto ha una carta bianca su sfondo scuro: trovo il contorno più grande,
lo approssimo a un quadrilatero e lo porto in una carta "canonica" verticale
di CARD_W×CARD_H pixel (gli angoli arrotondati li applica rounded_mask()).

Uso: python extract_cards.py [cartella foto] [cartella uscita]
Produce <uscita>/<NOME>.jpg e <uscita>/quads.json (angoli nella foto originale,
per usare le foto stesse come validazione reale).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
CARD_W, CARD_H = 600, 900  # proporzioni misurate sul mazzo Modiano Burraco (≈ 2:3)
CORNER_RADIUS = 0.05  # raggio degli angoli arrotondati, in frazione della larghezza


def order_points(pts: np.ndarray) -> np.ndarray:
    """Ordina i 4 punti: alto-sinistra, alto-destra, basso-destra, basso-sinistra."""
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    return np.array([pts[np.argmin(s)], pts[np.argmin(d)], pts[np.argmax(s)], pts[np.argmax(d)]], dtype=np.float32)


def find_card(rgb: np.ndarray) -> np.ndarray:
    """Quadrilatero della carta, nelle coordinate dell'immagine."""
    scale = 1200 / max(rgb.shape[:2])
    small = cv2.resize(rgb, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    # La carta è bianca (poco satura e chiara), il tavolo di legno è colorato.
    hsv = cv2.cvtColor(cv2.GaussianBlur(small, (5, 5), 0), cv2.COLOR_RGB2HSV)
    mask = ((hsv[..., 1] < 45) & (hsv[..., 2] > 110)).astype(np.uint8) * 255
    # Riempio pips e figure, poi un'apertura larga stacca i riflessi del legno dalla carta.
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    filled = np.zeros_like(mask)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(filled, contours, -1, 255, -1)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))
    mask = cv2.morphologyEx(filled, cv2.MORPH_OPEN, kernel)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    card = max(contours, key=cv2.contourArea)
    # Angoli arrotondati: il rettangolo di area minima è più stabile di approxPolyDP.
    box = cv2.boxPoints(cv2.minAreaRect(card))
    return order_points(box / scale)


def grabcut(rgb: np.ndarray, quad: np.ndarray, passes: int = 2) -> np.ndarray:
    """Affina il quadrilatero con GrabCut: impara dalla foto i colori di carta e tavolo.

    Serve dove il legno è chiaro o la carta in ombra e una soglia fissa non
    basta. Ogni passata riparte dal quadrilatero della precedente.
    """
    cv2.setRNGSeed(0)  # GrabCut inizializza i modelli di colore a caso: risultati riproducibili
    scale = 700 / max(rgb.shape[:2])
    small = cv2.cvtColor(cv2.resize(rgb, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2BGR)
    for _ in range(passes):
        q = quad * scale
        c = q.mean(axis=0)
        mask = np.full(small.shape[:2], cv2.GC_BGD, np.uint8)
        for factor, label in [(1.08, cv2.GC_PR_BGD), (0.97, cv2.GC_PR_FGD), (0.75, cv2.GC_FGD)]:
            cv2.fillConvexPoly(mask, (c + (q - c) * factor).astype(np.int32), label)
        bgd, fgd = np.zeros((1, 65)), np.zeros((1, 65))
        cv2.grabCut(small, mask, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
        fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
        fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
        contours, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        card = max(contours, key=cv2.contourArea)
        quad = order_points(cv2.boxPoints(cv2.minAreaRect(card)) / scale)
    return quad


def trim_borders(rgb: np.ndarray, quad: np.ndarray) -> np.ndarray:
    """Toglie le strisce di tavolo rimaste lungo i lati della carta raddrizzata.

    Dal bordo verso l'interno, una riga (o colonna) è "tavolo" se nella parte
    centrale del lato la maggioranza dei pixel è più gialla e più scura del
    fondo della carta (spazio Lab). Il tavolo molto scuro conta anche se non è giallo (un'ombra non arriva a −70). Al massimo il 20% per lato.
    """
    if np.linalg.norm(quad[1] - quad[0]) > np.linalg.norm(quad[3] - quad[0]):
        quad = np.roll(quad, -1, axis=0)
    dst = np.array([[0, 0], [CARD_W - 1, 0], [CARD_W - 1, CARD_H - 1], [0, CARD_H - 1]], dtype=np.float32)
    m = cv2.getPerspectiveTransform(quad.astype(np.float32), dst)
    lab = cv2.cvtColor(cv2.warpPerspective(rgb, m, (CARD_W, CARD_H)), cv2.COLOR_RGB2LAB).astype(np.int16)
    L, b = lab[..., 0], lab[..., 2]
    center = (slice(CARD_H // 4, 3 * CARD_H // 4), slice(CARD_W // 4, 3 * CARD_W // 4))
    bright = L[center] >= np.percentile(L[center], 70)
    ref_l, ref_b = np.median(L[center][bright]), np.median(b[center][bright])
    # Il legno è più giallo e più scuro; un'ombra sulla carta è solo un po' più scura.
    table = ((b > ref_b + 5) & (L < ref_l - 15)) | (L < ref_l - 70)

    def band(profile: np.ndarray) -> int:
        n = 0
        while n < len(profile) * 0.2 and profile[n] > 0.5:
            n += 1
        return n

    mid_h = slice(int(0.15 * CARD_H), int(0.85 * CARD_H))
    mid_w = slice(int(0.15 * CARD_W), int(0.85 * CARD_W))
    left = band(table[mid_h].mean(axis=0))
    right = CARD_W - 1 - band(table[mid_h].mean(axis=0)[::-1])
    top = band(table[:, mid_w].mean(axis=1))
    bottom = CARD_H - 1 - band(table[:, mid_w].mean(axis=1)[::-1])
    inner = np.array([[left, top], [right, top], [right, bottom], [left, bottom]], dtype=np.float32)
    return cv2.perspectiveTransform(inner[None], np.linalg.inv(m))[0]


def apply_trim(quad: np.ndarray, trim: dict[str, float]) -> np.ndarray:
    """Taglio manuale per lato, in frazione della carta raddrizzata (vedi manual_trims.json)."""
    if np.linalg.norm(quad[1] - quad[0]) > np.linalg.norm(quad[3] - quad[0]):
        quad = np.roll(quad, -1, axis=0)
    dst = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=np.float32)
    m = cv2.getPerspectiveTransform(quad.astype(np.float32), dst)
    l, t = trim.get("left", 0.0), trim.get("top", 0.0)
    r, b = 1 - trim.get("right", 0.0), 1 - trim.get("bottom", 0.0)
    inner = np.array([[l, t], [r, t], [r, b], [l, b]], dtype=np.float32)
    return cv2.perspectiveTransform(inner[None], np.linalg.inv(m))[0]


def rounded_mask(width: int = CARD_W, height: int = CARD_H) -> np.ndarray:
    """Maschera della carta con gli angoli arrotondati (255 dentro, 0 fuori)."""
    alpha = np.zeros((height, width), np.uint8)
    r = int(CORNER_RADIUS * width)
    cv2.rectangle(alpha, (r, 0), (width - 1 - r, height - 1), 255, -1)
    cv2.rectangle(alpha, (0, r), (width - 1, height - 1 - r), 255, -1)
    for cx, cy in [(r, r), (width - 1 - r, r), (r, height - 1 - r), (width - 1 - r, height - 1 - r)]:
        cv2.circle(alpha, (cx, cy), r, 255, -1, lineType=cv2.LINE_AA)
    return alpha


def warp(rgb: np.ndarray, quad: np.ndarray) -> np.ndarray:
    """Carta raddrizzata in verticale, CARD_W×CARD_H, RGB."""
    if np.linalg.norm(quad[1] - quad[0]) > np.linalg.norm(quad[3] - quad[0]):
        quad = np.roll(quad, -1, axis=0)  # carta fotografata in orizzontale: ruoto di 90°
    dst = np.array([[0, 0], [CARD_W - 1, 0], [CARD_W - 1, CARD_H - 1], [0, CARD_H - 1]], dtype=np.float32)
    m = cv2.getPerspectiveTransform(quad.astype(np.float32), dst)
    return cv2.warpPerspective(rgb, m, (CARD_W, CARD_H), flags=cv2.INTER_CUBIC)


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "ml/photos/deck"
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent / "assets/cards"
    dst.mkdir(parents=True, exist_ok=True)
    quads = {}
    trims_file = Path(__file__).resolve().parent / "manual_trims.json"
    trims = json.loads(trims_file.read_text()) if trims_file.exists() else {}
    for photo in sorted(src.glob("*.jpg")):
        name = photo.stem.upper()
        if name in {"RETRO", "SCATOLA"}:
            continue
        rgb = np.asarray(ImageOps.exif_transpose(Image.open(photo)).convert("RGB"))
        quad = trim_borders(rgb, grabcut(rgb, find_card(rgb)))
        if name in trims:
            quad = apply_trim(quad, trims[name])
        card = warp(rgb, quad)
        # JPEG per stare leggeri nel repository; gli angoli arrotondati li ricrea rounded_mask().
        Image.fromarray(card).save(dst / f"{name}.jpg", quality=92)
        quads[name] = {"quad": quad.round(1).tolist(), "size": [rgb.shape[1], rgb.shape[0]]}
        print(name, "ok")
    (dst / "quads.json").write_text(json.dumps(quads, indent=1) + "\n")


if __name__ == "__main__":
    main()
