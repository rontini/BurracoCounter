"""Foto di prova dei test E2E con il mazzo Modiano e rilevamenti di riferimento.

Usa il modello indicato da apps/web/public/models/cards.json, con la stessa
preparazione del worker (riquadro 640, bordo grigio in basso a destra, NMS per
classe): il test E2E confronta il browser con questi riferimenti (§7.6).

Uso: python make_fixtures.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
DECK = ROOT / "ml/photos/deck"
MODELS = ROOT / "apps/web/public/models"
FIXTURES = ROOT / "apps/web/e2e/fixtures"
TILE, PAD, SCORE, IOU = 640, 114, 0.25, 0.5


def photo(name: str) -> Image.Image:
    return ImageOps.exif_transpose(Image.open(DECK / f"{name}.jpg")).convert("RGB")


def iou(a, b) -> float:
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[0] + a[2], b[0] + b[2]), min(a[1] + a[3], b[1] + b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    return inter / (a[2] * a[3] + b[2] * b[3] - inter)


def detect(session: ort.InferenceSession, labels: list[str], path: Path) -> list[dict]:
    im = Image.open(path).convert("RGB")
    canvas = Image.new("RGB", (TILE, TILE), (PAD, PAD, PAD))
    canvas.paste(im, (0, 0))
    x = np.asarray(canvas, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0
    out = session.run(None, {session.get_inputs()[0].name: x})[0][0]
    boxes = []
    for i in range(out.shape[1]):
        c = int(out[4:, i].argmax())
        s = float(out[4 + c, i])
        if s >= SCORE:
            cx, cy, w, h = (float(v) for v in out[:4, i])
            boxes.append({"label": labels[c], "score": s, "box": [cx - w / 2, cy - h / 2, w, h]})
    boxes.sort(key=lambda b: -b["score"])
    kept: list[dict] = []
    for b in boxes:
        if all(k["label"] != b["label"] or iou(k["box"], b["box"]) <= IOU for k in kept):
            kept.append(b)
    return kept


def main() -> None:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    singles = {"5-quadri.jpg": "5D", "10-fiori.jpg": "10C"}
    for file, card in singles.items():
        im = photo(card)
        im.thumbnail((TILE, TILE), Image.LANCZOS)  # entro un riquadro: stessi pixel in browser e Python
        im.save(FIXTURES / file, quality=92)
    # Foto grande per tiling e tempi: collage 2×2 di carte vere.
    w, h = 1200, 900
    big = Image.new("RGB", (2 * w, 2 * h))
    for i, card in enumerate(["5D", "10C", "7H", "KS"]):
        # pad, non fit: le foto sono verticali e ritagliarle taglierebbe gli indici agli angoli.
        big.paste(ImageOps.pad(photo(card), (w, h), color=(60, 40, 25)), ((i % 2) * w, (i // 2) * h))
    big.save(FIXTURES / "tavolo-grande.jpg", quality=88)

    manifest = json.loads((MODELS / "cards.json").read_text())
    session = ort.InferenceSession(str(MODELS / manifest["model"]), providers=["CPUExecutionProvider"])
    reference = {f: detect(session, manifest["labels"], FIXTURES / f) for f in singles}
    (FIXTURES / "reference.json").write_text(json.dumps(reference, indent=2) + "\n")
    for f, dets in reference.items():
        print(f, [(d["label"], round(d["score"], 2)) for d in dets])


if __name__ == "__main__":
    main()
