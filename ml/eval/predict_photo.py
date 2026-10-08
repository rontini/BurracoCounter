"""Riconoscimento di una foto intera come nell'app: lato lungo ≤3000 px,
riquadri 640 sovrapposti del 22%, NMS per classe. Disegna i rilevamenti.

Uso: python predict_photo.py <foto...> --out <cartella> [--conf 0.25]
Scrive <nome>.jpg (rilevamenti disegnati) e <nome>.json (rilevamenti).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / "apps/web/public/models"
TILE, OVERLAP, MAX_SIDE, PAD = 640, 0.22, 3000, 114


def starts(length: int) -> list[int]:
    if length <= TILE:
        return [0]
    stride = TILE * (1 - OVERLAP)
    count = int(np.ceil((length - TILE) / stride)) + 1
    step = (length - TILE) / (count - 1)
    return [round(i * step) for i in range(count)]


def iou(a, b) -> float:
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter)


def detect(session, labels, img: Image.Image, conf: float) -> list[dict]:
    scale = min(1.0, MAX_SIDE / max(img.size))
    img = img.resize((round(img.width * scale), round(img.height * scale)), Image.BILINEAR)
    boxes = []
    for y in starts(img.height):
        for x in starts(img.width):
            tile = Image.new("RGB", (TILE, TILE), (PAD, PAD, PAD))
            tile.paste(img.crop((x, y, min(x + TILE, img.width), min(y + TILE, img.height))), (0, 0))
            t = np.asarray(tile, np.float32).transpose(2, 0, 1)[None] / 255
            out = session.run(None, {session.get_inputs()[0].name: t})[0][0]
            cls = out[4:].argmax(0)
            sc = out[4:].max(0)
            for i in np.nonzero(sc >= conf)[0]:
                cx, cy, w, h = out[:4, i]
                boxes.append({"label": labels[cls[i]], "score": float(sc[i]),
                              "box": [float((x + cx - w / 2) / scale), float((y + cy - h / 2) / scale),
                                      float((x + cx + w / 2) / scale), float((y + cy + h / 2) / scale)]})
    boxes.sort(key=lambda b: -b["score"])
    kept: list[dict] = []
    for b in boxes:
        # Come packages/vision/src/nms.ts: anche i box contenuti per l'80% in uno migliore
        # della stessa classe (indici tagliati dal bordo di un riquadro).
        if all(k["label"] != b["label"] or (iou(k["box"], b["box"]) <= 0.5 and contained(b["box"], k["box"]) <= 0.8) for k in kept):
            kept.append(b)
    return kept


def contained(a, b) -> float:
    """Frazione dell'area del più piccolo dei due box che sta nell'intersezione."""
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    area = min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]))
    return inter / area if area > 0 else 0.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("photos", nargs="+")
    parser.add_argument("--out", required=True)
    parser.add_argument("--conf", type=float, default=0.25)
    args = parser.parse_args()
    manifest = json.loads((MODELS / "cards.json").read_text())
    session = ort.InferenceSession(str(MODELS / manifest["model"]), providers=["CPUExecutionProvider"])
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    for p in args.photos:
        img = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
        dets = detect(session, manifest["labels"], img, args.conf)
        (out / f"{Path(p).stem}.json").write_text(json.dumps(dets))
        draw_scale = 2000 / max(img.size)
        vis = img.resize((round(img.width * draw_scale), round(img.height * draw_scale)))
        d = ImageDraw.Draw(vis)
        for b in dets:
            x0, y0, x1, y1 = (v * draw_scale for v in b["box"])
            color = (0, 220, 0) if b["score"] >= 0.5 else (255, 150, 0)
            d.rectangle([x0, y0, x1, y1], outline=color, width=3)
            d.text((x0, y0 - 22), b["label"], fill=color, font=font, stroke_width=2, stroke_fill=(0, 0, 0))
        vis.save(out / f"{Path(p).stem}.jpg", quality=85)
        print(Path(p).name, len(dets), "rilevamenti,", sum(b["score"] >= 0.5 for b in dets), "sicuri")


if __name__ == "__main__":
    main()
