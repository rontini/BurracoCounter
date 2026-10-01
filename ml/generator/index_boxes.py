"""Trova il riquadro dell'indice d'angolo su ogni carta raddrizzata.

L'indice (valore + seme, più la stellina sulle pinelle e sui jolly) sta in
alto a sinistra; per simmetria la carta ne ha uno uguale ruotato di 180° in
basso a destra. Cerco l'inchiostro (pixel scuri o saturi) nella finestra
dell'angolo e ne prendo il riquadro, con un piccolo margine.

Uso: python index_boxes.py   → assets/cards/index_boxes.json
"""

from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

CARDS = Path(__file__).resolve().parent / "assets/cards"
# Finestra dell'angolo, in frazione della carta: a destra c'è la cornice delle figure.
WIN_X, WIN_Y = 0.17, 0.36
PAD = 0.006


def index_box(rgba: np.ndarray) -> list[float]:
    h, w = rgba.shape[:2]
    rgb = rgba[..., :3]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.int16)
    x1, y1 = int(WIN_X * w), int(WIN_Y * h)
    margin = int(0.025 * w)  # salto il bordo e l'angolo arrotondato
    win_gray = gray[margin:y1, margin:x1]
    paper = np.percentile(win_gray, 90)
    ink = (win_gray < paper - 45) | (hsv[margin:y1, margin:x1, 1] > 90)
    ink = cv2.morphologyEx(ink.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    n, _, stats, _ = cv2.connectedComponentsWithStats(ink)
    keep = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] >= 25]
    xs = [stats[i, 0] for i in keep] + [stats[i, 0] + stats[i, 2] for i in keep]
    ys = [stats[i, 1] for i in keep] + [stats[i, 1] + stats[i, 3] for i in keep]
    bx0, by0 = (min(xs) + margin) / w - PAD, (min(ys) + margin) / h - PAD
    bx1, by1 = (max(xs) + margin) / w + PAD, (max(ys) + margin) / h + PAD
    return [round(v, 4) for v in (max(bx0, 0), max(by0, 0), bx1, by1)]


def group(name: str) -> str:
    """Pinelle e jolly hanno anche la stellina: l'indice è più alto."""
    return "JK" if name.startswith("JK") else "2" if name.startswith("2") else "carte"


def main() -> None:
    found = {png.stem: index_box(np.asarray(Image.open(png).convert("RGBA"))) for png in sorted(CARDS.glob("*.jpg"))}
    # L'indice ha la stessa forma su tutto il mazzo: un riquadro molto diverso dalla
    # mediana del suo gruppo ha preso ombre o la cornice delle figure, e lo sostituisco.
    medians = {
        g: np.median([b for n, b in found.items() if group(n) == g], axis=0) for g in {group(n) for n in found}
    }
    boxes = {}
    for name, box in found.items():
        med = medians[group(name)]
        size, med_size = np.array(box[2:]) - box[:2], med[2:] - med[:2]
        odd = np.any(np.abs(size / med_size - 1) > 0.15)
        boxes[name] = [round(float(v), 4) for v in (med if odd else box)]
        if odd:
            print(f"{name}: riquadro anomalo, uso la mediana del gruppo {group(name)}")
    (CARDS / "index_boxes.json").write_text(json.dumps(boxes, indent=1) + "\n")
    print(len(boxes), "carte")


if __name__ == "__main__":
    main()
