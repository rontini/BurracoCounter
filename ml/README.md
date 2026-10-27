# ml/

Riconoscimento dell'indice d'angolo delle carte Modiano (53 classi: 52 carte + JOKER). Vedi CLAUDE.md §7 e `docs/decisions.md` D21–D24.

- `generator/`: ritaglio delle carte dalle foto del mazzo (`extract_cards.py`, `index_boxes.py`) e dataset sintetico (`synth.py`). Dipendenze in `generator/requirements.txt`.
- `notebooks/train_colab.ipynb`: addestramento su Colab, con ripresa automatica; lo lancia l'utente.
- `eval/`:
  - `predict_photo.py`: riconoscimento di foto intere come nell'app;
  - `real_val.py`, `make_fixtures.py`: validazione sulle foto del mazzo e foto di prova per gli E2E;
  - `tables_truth.json`: giochi veri delle foto dei tavoli, letti a mano;
  - `tables_detections.json`: rilevamenti del modello attuale su quelle foto, usati dal test `packages/vision/src/tables.eval.test.ts`.
- `photos/deck/`: le 54 carte del mazzo; `photos/tables/`: foto vere dei tavoli (regola d'uso in `docs/HANDOFF.md`).
- `baseline/`: export del modello pubblico di partenza (M2).
