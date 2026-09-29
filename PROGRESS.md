# PROGRESS

Aggiornato a fine sessione; va riletto all'inizio della successiva.

## Fatto

- **M0 – Setup** (2026-09-29): monorepo pnpm, TypeScript 6 strict, ESLint, Prettier, Vitest, Playwright, CI GitHub Actions. ✓ CI verde (run #1 su `claude/new-session-b89i50`).
- **Sezione 13 compilata**: semipulito 150, chiusura 100, pozzetto −100, carte in mano sottratte, VP ogni 4 smazzate, 2v2, nome **BurraCount**.
- **M1 – Segnapunti manuale** (2026-09-29) ✓:
  - `packages/rules`: `validateMeld`, `classifyBurraco`, `scoreHand`/`scoreTeam`, `scoreMatch` (obiettivo o VP a turni), tabella VP importabile da JSON. Test scritti prima del codice; copertura ~98% con soglia 95% in CI.
  - `apps/web`: nuova partita, inserimento manuale della smazzata con selettore rapido e scelta delle ambiguità, riepilogo, tabellone con storico modificabile, persistenza Dexie, export/import JSON, richiesta di `navigator.storage.persist()`, tema chiaro/scuro, i18n predisposto.
  - E2E: l'intera smazzata 2v2 viene calcolata e resta salvata dopo il ricaricamento.

- **Risposte sul regolamento** (2026-09-29): semipulito come in D6, pinella sempre 20, niente tris di pinelle, una partita = 4 smazzate a VP.
- **Impostazioni**: editor della tabella VP (con import/export JSON), usata come default nelle nuove partite; avviso nelle partite senza tabella.
- **Tabella VP predefinita** (D10): fasce standard fino a 13–7, 20–0 oltre 2000, fasce 14–19 stimate.

- **M2 – Visione con modello base** (2026-09-29), da confermare sui telefoni:
  - `packages/vision`: tiling (640, sovrapposizione ≥22%), decodifica YOLO, NMS per classe, etichette, interfaccia `CardRecognizer`; test prima del codice.
  - Modello YOLO11n pubblico esportato in ONNX (10,6 MB), script riproducibile in `ml/baseline/`.
  - Worker ONNX Runtime Web (WebGPU, altrimenti WASM), orientamento EXIF, 3000 px, preparazione anticipata del modello.
  - UI: foto (fotocamera o galleria) dei giochi e delle carte in mano, revisione con overlay, confidenze, correzione rapida, aggiunta e rimozione.
  - E2E: parità con Python sulle foto di prova; foto 2400×1800 riconosciuta in ~3 s in Chromium headless (<5 s).

## In corso

- Nessuna. Il criterio di M2 ("dalla foto alle carte in meno di 5 secondi") è verificato in CI; resta la conferma su un telefono di fascia media.

## Bloccato / domande aperte [UMANO]

1. **Licenza AGPL di Ultralytics** (D12): l'app sarà pubblica? Se sì, va bene rendere pubblico il codice (AGPL)? Altrimenti in M3 si usa un detector con licenza permissiva.
2. **Tempi su un telefono reale**: aprire l'app (dopo il deploy di M5, o con `pnpm --filter @burracount/web dev --host` in rete locale) e riportare il tempo mostrato nella revisione.
3. **Foto di prova reali**: 5–10 foto di fine smazzata con il vostro mazzo.
4. **Marca del mazzo** e foto delle singole carte, jolly compresi: servono per M3 (dataset sintetico e fine-tuning).
5. **Fasce VP 14–6 … 19–1**: stimate, da correggere in Impostazioni appena note.

## Prossimi passi

1. **M3**: istruzioni e checklist per le foto del mazzo; generatore sintetico (`ml/generator`); notebook di training YOLO11n/YOLO11s; valutazione sul golden set. Serve prima il mazzo reale.
2. In parallelo, senza foto: **M4** (deduplica degli angoli e raggruppamento in giochi) si può iniziare sui dati sintetici, ma la specifica chiede di chiudere prima M3.
