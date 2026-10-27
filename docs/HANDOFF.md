# Passaggio di consegne

Punto di partenza per chi riprende il lavoro, persona o agente (Claude Code nel cloud o in locale). Aggiornato al 2026-10-27.

## Da leggere, in quest'ordine

1. [`CLAUDE.md`](../CLAUDE.md): specifica e regole di lavoro (milestone, test prima del codice, un commit per task, niente M6 senza conferma).
2. [`PROGRESS.md`](../PROGRESS.md): fatto, in corso, bloccato, prossimi passi.
3. [`docs/decisions.md`](decisions.md): le scelte tecniche D1–D24. Le più recenti, D22–D24, spiegano modello Modiano, modalità semplice e raggruppamento.
4. Questo file: come si lavora in pratica e cosa fare adesso.

## Dove sta il codice

- **Branch di lavoro: `claude/new-session-b89i50`.** Tutto il progetto è qui. `main` contiene solo le foto caricate da GitHub e resta indietro.
- Cloudflare pubblica questo branch a ogni push su <https://burracocounter.rontinim.workers.dev>. **Ogni push va in produzione**, quindi si fa solo con la CI verde in locale (`pnpm check` ed E2E).
- La CI di GitHub Actions gira sui push a `claude/**` e `main`.

## Stato in breve

| Milestone             | Stato                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| M0 setup              | ✓                                                                                                          |
| M1 segnapunti manuale | ✓ (usabile per giocare)                                                                                    |
| M2 visione            | ✓ in Chromium; manca la verifica sui telefoni [UMANO]                                                      |
| M3 modello proprio    | primo modello Modiano attivo (`apps/web/public/models/cards-modiano.onnx`); serve il secondo addestramento |
| M4 giochi e deduplica | raggruppamento riscritto e misurato sulle 13 foto vere (D24)                                               |
| M5 produzione         | PWA pubblicata e offline; manca il test su iPhone e Android reali [UMANO]                                  |
| M6 store              | non iniziare senza conferma esplicita                                                                      |

Numeri sulle 13 foto vere (`pnpm vitest run packages/vision/src/tables.eval.test.ts --disableConsoleIntercept`):

- carte vere trovate 377/385 (98%), 16 in più;
- giochi esatti 76/90 (84%);
- foto con punteggio esatto 3/13.

Gli errori rimasti sono quasi tutti di lettura del modello (vedi D24): 6 e 9 capovolti, seme sbagliato su un angolo, assi sbiaditi, falsi jolly sulla scritta MODIANO e sulle stelline delle pinelle.

## Come vuole lavorare il gruppo

- Lingua: italiano, risposte brevi e concrete. Chi usa l'app non è uno sviluppatore: le istruzioni [UMANO] vanno scritte passo per passo.
- Modalità di gioco: 2v2. Uso con la **modalità semplice**: una foto per squadra con **solo i giochi calati**; i punti delle carte in mano si contano a mano (campo facoltativo); un tap per «chi ha chiuso»; pozzetto preso di default.
- Mazzo: Modiano, doppio mazzo, indice in tutti e quattro gli angoli.
- Uso privato, non pubblico (licenza Ultralytics AGPL accettata per ora, D17).

## Regola delle foto dei tavoli

| Foto                                  | Uso                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Le 13 attuali (`IMG_4705`–`IMG_4717`) | Taratura del codice (già fatta) e fine-tuning del modello. I loro numeri sono ottimisti. |
| Le **prossime 50** caricate           | **Golden set**: solo test finale, mai nell'addestramento né nella taratura delle soglie. |
| Quelle dopo le 50                     | Addestramento.                                                                           |

Quando arrivano le nuove foto: tenere l'elenco delle 50 del golden set in `ml/eval/golden.txt` (un nome file per riga), scrivere i giochi veri come in `ml/eval/tables_truth.json`, e non usarle mai per scegliere parametri.

## Ambiente locale

Node ≥ 22 e pnpm 10 (`corepack enable`), poi:

```sh
pnpm install
pnpm check        # format, lint, typecheck, unit test (incluso il test sulle 13 foto)
pnpm e2e          # Playwright: serve Chromium (npx playwright install chromium)
pnpm --filter @burracount/web dev
```

Python (solo per `ml/`), in un ambiente virtuale:

```sh
python -m venv ml/.venv && source ml/.venv/bin/activate
pip install -r ml/generator/requirements.txt
```

Script principali:

- `ml/eval/predict_photo.py <foto...> --out <cartella>`: riconoscimento come nell'app (riquadri 640, NMS), disegna i box e scrive il JSON dei rilevamenti.
- `ml/eval/real_val.py`, `ml/eval/make_fixtures.py`: validazione sulle foto del mazzo e foto di prova per gli E2E.
- `ml/generator/synth.py`: dataset sintetico; `ml/notebooks/train_colab.ipynb`: addestramento su Colab, lanciato dall'utente [UMANO].

Quando cambia il modello, rigenerare `ml/eval/tables_detections.json` con `predict_photo.py` sulle foto di `ml/photos/tables/` (poi unire i JSON come nel file attuale) e rilanciare il test sulle 13 foto.

## Prossimi passi, in ordine

1. **Secondo addestramento (M3)**, mirato agli errori di D24:
   - generatore: colonne e file fitte come sul tavolo (si vede solo la striscia con gli indici), luce calda, riflessi, carte fino a circa 600 px, rotazioni a 90° e 180°;
   - esempi negativi: scritta MODIANO e stelline delle pinelle non sono indici;
   - fine-tuning sulle 13 foto dei tavoli: pre-annotarle con il modello attuale (un box per indice d'angolo, formato YOLO), correggere a mano, aggiungerle al training;
   - preparare il notebook, poi l'utente lo lancia su Colab [UMANO]; esportare in ONNX ≤ 15 MB e verificare la parità Python/browser (E2E `recognition.spec.ts`).
2. **Rimisurare** sulle 13 foto e aggiornare le soglie in `packages/vision/src/tables.eval.test.ts` solo se migliorano.
3. **Golden set** con le prossime 50 foto: misurare carte corrette (soglia ≥97%) e foto con punteggio esatto; documentare in PROGRESS (criterio di M4).
4. **Test sui telefoni** [UMANO] con la checklist in `docs/deploy.md`.

## Domande ancora aperte [UMANO]

- Esito del test su iPhone e Android (installazione, offline, «wasm×N», tempi, riconoscimento al tavolo).
- Fasce VP 14–6 … 19–1: stimate, da confermare.
- Nuove foto dei tavoli: caricarle in `ml/photos/tables/` sul branch di lavoro.
