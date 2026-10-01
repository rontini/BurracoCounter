"""STORICO (M2) – il modello base non è più usato dall'app: dal 2026-10-01 c'è cards-modiano.onnx (M3).
Le foto di prova e i riferimenti attuali li genera ml/eval/make_fixtures.py.

Modello base per M2: scarica, esporta in ONNX e prepara i riferimenti.

Uso (da ml/baseline, con un venv):
    pip install -r requirements.txt
    python export_baseline.py

Produce:
    apps/web/public/models/cards-baseline.onnx     modello per il browser
    apps/web/e2e/fixtures/*.jpg                     foto di prova (dataset MIT)
    apps/web/e2e/fixtures/reference.json            rilevamenti di riferimento (Python)
"""

from __future__ import annotations

import hashlib
import json
import shutil
import urllib.request
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[2]
WORK = Path(__file__).resolve().parent / "work"
MODEL_OUT = ROOT / "apps/web/public/models/cards-baseline.onnx"
FIXTURES = ROOT / "apps/web/e2e/fixtures"

HF = "https://huggingface.co"
WEIGHTS_URL = (
    f"{HF}/shrimantasatpati/yolov11_playing_cards_detection/resolve/main/"
    "detect/yolo11n_playing_cards/weights/best.pt"
)
PHOTOS = {
    # Foto reali di carte francesi (dataset drFarid/French-Playing-Cards, MIT).
    "5-quadri.jpg": "carreau 5",
    "10-fiori.jpg": "Trefle 10",
}
# Collage 2×2 di foto intere per provare tiling e tempi su un'immagine grande.
BIG = ("tavolo-grande.jpg", ["carreau 5", "Trefle 10", "Coeur 7", "Pique Roi"], (1200, 900))
TILE = 640
PAD = 114  # stesso grigio del letterbox Ultralytics
SCORE = 0.25
IOU = 0.5


def download(url: str, dest: Path) -> Path:
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(url, dest)
    return dest


def first_photo(folder: str) -> str:
    api = f"{HF}/api/datasets/drFarid/French-Playing-Cards/tree/main/data/{folder.replace(' ', '%20')}"
    with urllib.request.urlopen(api) as r:
        paths = [x["path"] for x in json.load(r)]
    # Le foto "2024…" sono scatti da telefono in formato 4:3.
    return next(p for p in sorted(paths) if p.split("/")[-1].startswith("2024"))


def export_model() -> str:
    weights = download(WEIGHTS_URL, WORK / "best.pt")
    model = YOLO(str(weights))
    assert len(model.names) == 52, model.names
    onnx_path = Path(model.export(format="onnx", imgsz=TILE, opset=17, simplify=True, dynamic=False))
    MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(onnx_path, MODEL_OUT)
    return hashlib.sha256(MODEL_OUT.read_bytes()).hexdigest()


def make_fixtures() -> list[Path]:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    out = []
    for name, folder in PHOTOS.items():
        path = first_photo(folder)
        raw = download(f"{HF}/datasets/drFarid/French-Playing-Cards/resolve/main/{path.replace(' ', '%20')}", WORK / name)
        im = ImageOps.exif_transpose(Image.open(raw)).convert("RGB")
        # Entro un riquadro: così browser e Python vedono gli stessi pixel senza ridimensionare.
        im.thumbnail((TILE, TILE), Image.LANCZOS)
        dest = FIXTURES / name
        im.save(dest, quality=92)
        out.append(dest)
    name, folders, (w, h) = BIG
    big = Image.new("RGB", (2 * w, 2 * h))
    for i, folder in enumerate(folders):
        path = first_photo(folder)
        raw = download(f"{HF}/datasets/drFarid/French-Playing-Cards/resolve/main/{path.replace(' ', '%20')}", WORK / f"big-{i}.jpg")
        im = ImageOps.exif_transpose(Image.open(raw)).convert("RGB")
        im = ImageOps.fit(im, (w, h))
        big.paste(im, ((i % 2) * w, (i // 2) * h))
    big.save(FIXTURES / name, quality=88)
    return out


def iou(a, b) -> float:
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[0] + a[2], b[0] + b[2]), min(a[1] + a[3], b[1] + b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    return inter / (a[2] * a[3] + b[2] * b[3] - inter)


def detect(session: ort.InferenceSession, labels: list[str], path: Path) -> list[dict]:
    """Stessa preparazione del worker: riquadro 640 con bordo grigio in basso a destra."""
    im = Image.open(path).convert("RGB")
    canvas = Image.new("RGB", (TILE, TILE), (PAD, PAD, PAD))
    canvas.paste(im, (0, 0))
    x = np.asarray(canvas, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0
    out = session.run(None, {session.get_inputs()[0].name: x})[0][0]  # (56, 8400)
    boxes = []
    for i in range(out.shape[1]):
        scores = out[4:, i]
        c = int(scores.argmax())
        if scores[c] < SCORE:
            continue
        cx, cy, w, h = out[:4, i]
        boxes.append({"label": labels[c], "score": float(scores[c]), "box": [float(cx - w / 2), float(cy - h / 2), float(w), float(h)]})
    boxes.sort(key=lambda b: -b["score"])
    kept: list[dict] = []
    for b in boxes:
        if all(k["label"] != b["label"] or iou(k["box"], b["box"]) <= IOU for k in kept):
            kept.append(b)
    return kept


def main() -> None:
    sha = export_model()
    fixtures = make_fixtures()
    labels = [YOLO(str(WORK / "best.pt")).names[i] for i in range(52)]
    session = ort.InferenceSession(str(MODEL_OUT), providers=["CPUExecutionProvider"])
    reference = {p.name: detect(session, labels, p) for p in fixtures}
    (FIXTURES / "reference.json").write_text(json.dumps(reference, indent=2) + "\n")
    print("modello:", MODEL_OUT, f"{MODEL_OUT.stat().st_size / 1e6:.1f} MB", "sha256", sha)
    for name, dets in reference.items():
        print(name, [(d["label"], round(d["score"], 2)) for d in dets])


if __name__ == "__main__":
    main()
