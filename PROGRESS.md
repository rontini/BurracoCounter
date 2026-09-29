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

## In corso

- Nessuna attività aperta su M1: resta solo la tabella VP da inserire nell'app.

## Bloccato / domande aperte [UMANO]

1. **Tabella VP standard**: da inserire in Impostazioni (vedi D9). Non è bloccante: senza tabella il tabellone mostra la differenza punti.
2. **Marca del mazzo**: da verificare prima di M3.

## Prossimi passi

1. **M2**: worker ONNX, tiling, overlay e schermata di revisione con un modello pubblico (prima: verifica di licenze e regione annotata del modello base, §7.1).
