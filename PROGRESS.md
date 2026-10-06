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

- **Si apre dal telefono** (2026-09-29): confermato dal gruppo. Aggiunti messaggio di caricamento e schermata di errore al posto della pagina bianca.
- **M3, preparazione**: istruzioni e checklist per le foto del mazzo in `ml/photos/ISTRUZIONI.md`, controllo completezza con `ml/photos/check_deck.py`.

- **Modalità semplice** (2026-10-01, D19): una foto per squadra, «Chi ha chiuso?», pozzetto preso di default; scelta per partita, default in Impostazioni. Deduplica e raggruppamento v0 anticipati da M4 (D20). E2E verde.
- **Mazzo**: Modiano (CLAUDE.md §13).
- **Foto del mazzo Modiano** (2026-10-01):
  - 52 carte + 2 jolly in `ml/photos/deck/`, rinominate e verificate a vista; corrispondenza con i file originali in `ORIGINE.md`.
  - Caratteristiche del mazzo: indici A/J/Q/K standard; le pinelle hanno una stellina accanto all'indice; due jolly con disegni diversi (stelle nere o rosse negli angoli, nessuna scritta); alcune foto sono orizzontali.
  - **Modello base sulle carte Modiano: 11/52 corrette** (37 non rilevate, 4 sbagliate), anche con una carta per foto. M3 serve.

- **M3, preparazione completata** (2026-10-01, D21):
  - ritaglio delle 54 carte e riquadri dei quattro indici;
  - generatore sintetico verificato a vista;
  - validazione reale con le foto del mazzo;
  - prova di addestramento su CPU superata;
  - notebook Colab;
  - app pronta a caricare il nuovo modello da `models/cards.json`.

- **M3, primo modello Modiano** (2026-10-01, D22): 54/54 foto del mazzo riconosciute (il modello base ne riconosceva 11/52), attivo nell'app. Limiti: carte molto grandi o girate di 90°.

- **Modalità semplice rivista** (2026-10-06, D23):
  - solo giochi nella foto, punti in mano facoltativi;
  - deduzione delle carte incerte o non viste;
  - deduplica dei 4 angoli Modiano;
  - divisione dei giochi troppo vicini.

## In corso

- Test sui telefoni reali [UMANO], con la checklist in `docs/deploy.md`.

## Bloccato / domande aperte [UMANO]

1. **Esito del test sui telefoni** (iPhone e Android):
   - l'installazione funziona;
   - l'app funziona offline;
   - "wasm×N" con N > 1 nella revisione della foto;
   - tempo del riconoscimento;
   - riconoscimento delle carte Modiano al tavolo, dopo la revisione D23.
2. **Foto dei tavoli** (100–200, di cui almeno 50 per il golden set): si raccolgono giocando, una foto per squadra come in modalità semplice.
3. **Fasce VP 14–6 … 19–1**: stimate, da correggere in Impostazioni appena note.
4. **Accesso di rete dell'ambiente cloud a `burracocounter.rontinim.workers.dev`**: facoltativo. Serve solo se Claude deve provare il sito pubblicato direttamente.

## Prossimi passi

1. **M4**: tarare deduplica, raggruppamento e deduzione sulle foto vere dei tavoli (servono foto: salvarle mentre si gioca).
2. **M3, secondo addestramento**:
   - carte fino a circa 600 px di larghezza;
   - più rotazioni a 90°;
   - fine-tuning sulle foto dei tavoli.
3. **Golden set** con le foto dei tavoli: misurare la percentuale di carte corrette (≥97%) e di foto con punteggio esatto.
