# PROGRESS

Aggiornato a fine sessione; va riletto all'inizio della successiva.

## Fatto

- **M0 – Setup** (2026-09-29): monorepo pnpm, TypeScript 6 strict, ESLint, Prettier, Vitest, Playwright, CI GitHub Actions. ✓ CI verde (run #1 su `claude/new-session-b89i50`).
- **Sezione 13 compilata**: semipulito 150, chiusura 100, pozzetto −100, carte in mano sottratte, VP ogni 4 smazzate, 2v2, nome **BurraCount**.
- **M1 – Segnapunti manuale** (2026-09-29), in attesa di conferma sulle domande qui sotto:
  - `packages/rules`: `validateMeld`, `classifyBurraco`, `scoreHand`/`scoreTeam`, `scoreMatch` (obiettivo o VP a turni), tabella VP importabile da JSON. Test scritti prima del codice; copertura ~98% con soglia 95% in CI.
  - `apps/web`: nuova partita, inserimento manuale della smazzata con selettore rapido e scelta delle ambiguità, riepilogo, tabellone con storico modificabile, persistenza Dexie, export/import JSON, richiesta di `navigator.storage.persist()`, tema chiaro/scuro, i18n predisposto.
  - E2E: l'intera smazzata 2v2 viene calcolata e resta salvata dopo il ricaricamento.

## In corso

- Verifica della CI sugli ultimi commit di M1.

## Bloccato / domande aperte [UMANO]

1. **Tabella dei Victory Point**: servono le fasce (differenza → VP vincitore/perdente). Finché manca, il tabellone mostra la differenza punti di ogni turno. Formato JSON in `packages/rules/src/victory-points.ts`.
2. **Quanti turni da 4 smazzate** si giocano in una serata? Oppure la partita resta aperta finché non la chiudete?
3. **Semipulito**: va bene la definizione di D6 (7+ naturali con la matta in fondo)?
4. **Pinella in posizione naturale**: vale 20 punti come le altre?
5. **Tris di pinelle**: ammesso?
6. **Marca del mazzo**: da verificare prima di M3.

## Prossimi passi

1. Risposte alle domande → eventuali ritocchi al `RuleSet` di default.
2. M1 chiusa → **M2**: worker ONNX, tiling, overlay e schermata di revisione con un modello pubblico.
