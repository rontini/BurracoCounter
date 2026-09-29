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

- **Pubblicazione anticipata (parte di M5)** (2026-09-29, D16):
  - PWA installabile con icone e manifest; service worker con app, WASM e modello in cache: offline dopo il primo avvio.
  - Avviso "Aggiorna"; istruzioni di installazione per iPhone e pulsante per Android; `_headers` per Cloudflare Pages.
  - ONNX Runtime solo WASM, per stare nel limite di 25 MiB per file (D15).
  - E2E offline verde; guida in `docs/deploy.md`.
- **Licenza**: uso privato per ora, si resta su Ultralytics (D17).

- **Pubblicata** (2026-09-29) su <https://burracocounter.rontinim.workers.dev>: Cloudflare Workers con asset statici, build a ogni push su `claude/new-session-b89i50` (D18).

## In corso

- Test sui telefoni reali [UMANO], con la checklist in `docs/deploy.md`.

## Bloccato / domande aperte [UMANO]

1. **Esito del test sui telefoni** (iPhone e Android):
   - l'installazione funziona;
   - l'app funziona offline;
   - `crossOriginIsolated` è attivo (se il riconoscimento dice "wasm×1" invece di "wasm×4", gli header non arrivano);
   - tempo del riconoscimento su una foto.
2. **Foto** (in arrivo): marca del mazzo, foto delle singole carte jolly compresi, 5–10 foto di fine smazzata.
3. **Fasce VP 14–6 … 19–1**: stimate, da correggere in Impostazioni appena note.

## Prossimi passi

1. Raccogliere i risultati del test sui telefoni (D14, D15).
2. Con le foto: **M3**. Istruzioni per le foto del mazzo, generatore sintetico, notebook di training, golden set.
3. Poi **M4**: deduplica degli angoli e raggruppamento in giochi.
