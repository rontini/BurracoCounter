# Modello base (M2)

| Voce | Valore |
| --- | --- |
| File | `apps/web/public/models/cards-baseline.onnx` (10,6 MB, FP32, opset 17) |
| Architettura | YOLO11n, 2,6 M parametri, ingresso 1×3×640×640, uscita 1×56×8400 (4 box + 52 classi, senza NMS) |
| Origine | [shrimantasatpati/yolov11_playing_cards_detection](https://huggingface.co/shrimantasatpati/yolov11_playing_cards_detection), `weights/best.pt` |
| Licenza dichiarata | MIT (pesi). Addestrato con Ultralytics: vedi la nota sulla licenza in `docs/decisions.md` (D12) |
| Dataset | Roboflow "Playing-Cards" v4 (Augmented Startups), immagini sintetiche di carte su sfondi vari |
| Regione annotata | **indice d'angolo** (valore + seme), come chiede CLAUDE.md §7 |
| Classi | 52 carte, **nessun jolly** (`packages/vision/src/labels.ts`) |
| Metriche dichiarate (val sintetica) | mAP50 0,995, mAP50-95 0,823 dopo 30 epoche |

## Comportamento su foto reali

Sulle foto reali di un mazzo francese (dataset `drFarid/French-Playing-Cards`, MIT):

- **Carte numerate** con indici standard: riconosciute, con confidenza 0,74–0,87 (`5♦`, `10♣`).
- **Mazzo con indici diversi** (asso "1", figure "V/D/R"): confidenza bassa o errori, per esempio il Re "R" letto come Q o come 2.
- **Doppioni:** ogni angolo visibile produce un rilevamento, fino a 4 per carta. La deduplica è in M4.

Il divario sintetico/reale e il jolly mancante si risolvono con il modello proprio di M3.

## Riprodurre

```sh
cd ml/baseline
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python export_baseline.py
```

Lo script rigenera il modello, le foto di prova in `apps/web/e2e/fixtures/` e `reference.json`: i rilevamenti ottenuti in Python con onnxruntime, che i test E2E confrontano con quelli del browser (§7.6).

Le foto di prova vengono da [drFarid/French-Playing-Cards](https://huggingface.co/datasets/drFarid/French-Playing-Cards) (licenza MIT).
