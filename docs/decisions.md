# Registro delle decisioni

Ogni scelta tecnica non banale: contesto, decisione, alternative scartate.

## D1. TypeScript 6 invece di 7 (M0)

- **Contesto:** TypeScript 7 (compilatore nativo) è l'ultima versione, ma `typescript-eslint` 8.x supporta solo `>=4.8.4 <6.1.0`.
- **Decisione:** fissato `typescript ~6.0`.
- **Alternative scartate:** TS 7 senza lint tipizzato (si perde l'integrazione ESLint); TS 7 per il typecheck e TS 6 per ESLint (due compilatori da tenere allineati).
- **Da rivedere:** quando `typescript-eslint` supporterà TS 7.

## D2. Vitest in modalità projects dalla root (M0)

- **Contesto:** servono test per pacchetti con ambienti diversi (node per `rules`/`vision`, jsdom per la UI) e un'unica copertura.
- **Decisione:** `vitest.config.ts` alla root con `test.projects`; ogni pacchetto ha il suo `vitest.config.ts` (`defineProject`). La copertura è v8.
- **Alternative scartate:** un comando `vitest` per pacchetto via `pnpm -r test` (report di copertura sparsi).
- **Nota:** la soglia di copertura ≥95% su `packages/rules` si attiva in M1, insieme al motore.

## D3. Header COOP/COEP già in dev e preview (M0)

- **Contesto:** ONNX Runtime Web con WASM multi-thread richiede `crossOriginIsolated` (§6).
- **Decisione:** Vite invia `Cross-Origin-Opener-Policy: same-origin` e `Cross-Origin-Embedder-Policy: require-corp` in dev e preview; lo smoke test E2E verifica `window.crossOriginIsolated`. In produzione gli stessi header arriveranno dal file `_headers` di Cloudflare Pages (M5).
- **Alternative scartate:** aggiungerli solo in M2 (il rischio di rompere risorse esterne emerge tardi).

## D4. Playwright fissato alla 1.56 e solo Chromium mobile in E2E (M0)

- **Contesto:** l'ambiente di sviluppo ha Chromium preinstallato per Playwright 1.56; la CI lo installa da sé.
- **Decisione:** `@playwright/test` 1.56.1, progetto `Pixel 7`. WebKit (iPhone) si aggiunge quando serve verificare Safari (M2/M5).
- **Alternative scartate:** tutti i browser da subito (CI più lenta senza benefici su un'app vuota).

## D5. vite-plugin-pwa rimandato (M0)

- **Contesto:** manifest, service worker e cache del modello sono in §9 e M5.
- **Decisione:** nessun plugin PWA in M0; si introduce quando l'app ha contenuto da mettere in cache (al più tardi in M5, eventualmente prima per l'offline in M1).

## D6. Interpretazioni del regolamento (M1, confermate il 2026-09-29 dove indicato)

Il motore non inventa regole: dove la specifica non è esplicita ho scelto un comportamento, reso configurabile quando possibile, e l'ho elencato in `PROGRESS.md` come domanda aperta.

- **Semipulito** (confermato): almeno 7 carte naturali consecutive, con la matta a un'estremità della scala o aggiunta a un tris. Una matta dentro la scala rende il burraco sporco. Il semipulito si disattiva con `burracoSemipulito: null`.
- **Pinella** (confermato): vale sempre 20, anche quando è nella sua posizione naturale. Lì conta come carta normale solo per la classificazione del burraco.
- **Scala:** va dall'asso basso all'asso alto, 14 carte al massimo; non gira (K-A-2 non è valida). Una matta che allunga la scala va in cima, oppure in fondo se in cima c'è già l'asso: per il punteggio le due estremità sono equivalenti.
- **Tris di pinelle** (confermato): non ammesso (`allowSetOfTwos: false`).
- **Obiettivo 2005:** vince chi è in testa dopo la smazzata in cui supera l'obiettivo. In caso di parità in testa si continua.
- **Victory Point:** le smazzate si raggruppano in turni di `handsPerRound` (4). Ogni turno completo si converte in VP con la tabella, sulla differenza assoluta di punti. Con la differenza a 0 ciascuna squadra prende la media della riga. Di default una partita è **un turno di 4 smazzate** (`rounds: 1`, confermato); il numero di turni resta configurabile. I VP valgono solo per 2 squadre.
- **1v1v1 "con divisione dei punti":** non so che cosa significhi. Per ora ogni giocatore è una squadra e ha il suo punteggio.
- **Burraco reale/super:** disattivati, non implementati.

## D7. Routing via hash e nessuna libreria di routing (M1)

- **Contesto:** quattro schermate, app statica su Cloudflare Pages, deve funzionare offline.
- **Decisione:** un router minimo su `location.hash` (`#/partita/<id>/smazzata`). Non richiede regole di rewrite sull'hosting e il tasto indietro funziona.
- **Alternative scartate:** react-router (dipendenza in più per quattro rotte).

## D8. Default dell'inserimento smazzata (M1)

- "Pozzetto preso" parte attivo, perché è il caso più comune. "Ha chiuso" attiva automaticamente anche "pozzetto preso", ma si può comunque cambiare.
- Il selettore di carte tiene il seme selezionato: per una scala basta toccare i valori.

## D9. Tabella VP inserita dall'utente, non precaricata (M1)

- **Contesto:** il gruppo usa la tabella VP "standard". Le fonti raggiungibili riportano solo le prime fasce (0–50 → 10–10, 55–150 → 11–9, 155–250 → 12–8, 255–350 → 13–7) e non concordano sull'ultima (20–0 oltre 1500 o oltre 2000). Nel codice di gara FIBUR la tabella dipende anche dal numero di mani. Il documento ufficiale non è raggiungibile dall'ambiente di sviluppo.
- **Decisione:** nessuna tabella precaricata, per non inventarla. Le impostazioni hanno un editor della tabella (e l'import/export in JSON) salvato in IndexedDB; ogni nuova partita a VP la usa come default. Una partita già iniziata senza tabella mostra un avviso con il pulsante per applicare quella salvata.
- **Alternative scartate:** precaricare una tabella incompleta o non verificata.

## D10. Tabella VP predefinita con fasce in parte stimate (M1)

- **Contesto:** il gruppo ha chiesto comunque un default, con 20–0 sopra i 2000 punti di differenza (vedi D9 per le fonti).
- **Decisione:** `DEFAULT_VP_TABLE` in `packages/rules`, usata da `DEFAULT_RULESET`.
  - **Fasce standard (dalle fonti):** 0–50 → 10–10, fino a 150 → 11–9, fino a 250 → 12–8, fino a 350 → 13–7.
  - **Fascia indicata dal gruppo:** oltre 2000 → 20–0.
  - **Fasce stimate, da verificare:** da 14–6 a 19–1, a intervalli regolari di 275 punti (625, 900, 1175, 1450, 1725, 2000).
  - **In app:** il nome della tabella dice che va verificata. Una tabella salvata nelle impostazioni la sostituisce, e con "Ripristina la predefinita" si torna a questa.
- **Alternative scartate:** le fasce 14–19 trovate in una fonte (355–500, 505–650, …, 1255–1500, con 20–0 oltre 1500), perché incomplete (mancano 16–18) e incompatibili con il 20–0 oltre 2000.

## D11. Modello base di M2: YOLO11n "Playing-Cards" da Hugging Face

- **Contesto:** §7.1 chiede di partire da un modello pubblico, verificando licenza e regione annotata.
- **Decisione:** `shrimantasatpati/yolov11_playing_cards_detection`.
  - Pesi MIT, YOLO11n, addestrato sul dataset Roboflow "Playing-Cards" citato nella specifica.
  - Annota l'indice d'angolo e ha 52 classi, senza jolly.
  - Esportato in ONNX opset 17, FP32, 10,6 MB (sotto i 15 MB). Nessuna quantizzazione per ora: FP16/INT8 si valuta in M3 insieme alla precisione.
  - Dettagli in `ml/baseline/MODEL.md`.
- **Alternative scartate:**
  - `mustafakemal0146/playing-cards-yolov8`: YOLOv8n, stesso dataset. `qcxiong/playing-cards-yolov8` ne è una copia identica.
  - `koolguy06/playing-cards`: YOLOv8l da 88 MB, troppo grande per il telefono.
- **Parità Python/browser:** `reference.json` contiene i rilevamenti ottenuti con onnxruntime in Python. L'E2E verifica che il browser trovi le stesse carte con punteggi entro 0,05.

## D12. Licenza Ultralytics (AGPL-3.0): da decidere [UMANO]

- **Contesto:** la specifica sceglie YOLO di Ultralytics (§2). La libreria è AGPL-3.0, e Ultralytics considera AGPL anche i modelli addestrati con la sua libreria, salvo licenza Enterprise. Questo vale anche per il modello proprio di M3. I pesi di D11 dichiarano MIT, ma sono addestrati con Ultralytics.
- **Implicazione:** se l'app viene distribuita pubblicamente, il modo più semplice di rispettare l'AGPL è rendere pubblico il codice sorgente dell'app con licenza AGPL. Per un uso privato del gruppo il problema è minore.
- **Alternative possibili, se il codice deve restare chiuso:** un detector con licenza permissiva, per esempio RT-DETR di altre implementazioni o YOLOX (Apache-2.0), addestrato in M3 con lo stesso dataset sintetico. `CardRecognizer` rende il cambio indolore.

## D13. onnxruntime-web: bundle WebGPU + WASM (M2)

- **Decisione:**
  - Il worker importa `onnxruntime-web/webgpu`: prova WebGPU e ripiega su WASM, multi-thread con cross-origin isolation, al massimo 4 thread.
  - I file `.wasm`/`.mjs` sono referenziati con `?url`, così Vite li emette con hash.
  - `optimizeDeps.exclude` e `worker.format: 'es'` sono impostati in `vite.config.ts`.
- **Costo:** il WASM con supporto WebGPU (JSEP) è 28 MB, 6,8 MB compressi. Il build emette anche la variante `asyncify`, inutile. Da escludere dalla cache del service worker in M5, o da eliminare con un bundle diverso.
- **Alternative scartate:** `onnxruntime-web` solo WASM (circa 11 MB): più leggero ma senza WebGPU, che sui telefoni recenti è la via più veloce.

## D14. Tempi e preparazione del modello (M2)

- **Misure:** foto 2400×1800 in 20 riquadri, in Chromium headless su 4 core, WASM×4:
  - prima esecuzione a freddo: 5,7 s, di cui circa 1,8 s per creare la sessione;
  - a caldo: 2,7–3,4 s, circa 125 ms per riquadro.
- **Decisione:** la schermata della smazzata prepara il modello appena si apre, con `warmUp()` e un riquadro vuoto, e ne mostra lo stato. La prima foto non paga l'avvio.
- **Test:** il test dei tempi gira in un progetto Playwright separato (`perf`), dopo gli altri, per non misurare la contesa di CPU.
- **Rischio:**
  - Una foto 4:3 da 12 MP viene ridotta a 3000×2250, cioè 30 riquadri: su WASM in un telefono di fascia media potrebbe superare i 5 s.
  - Leve possibili, da valutare con le misure sui telefoni reali [UMANO]: WebGPU, lato lungo più basso per le foto di un solo gioco, modello FP16.

## D15. ONNX Runtime solo WASM, senza WebGPU (M5 anticipata)

- **Contesto:** Cloudflare Pages accetta file fino a 25 MiB. Il WASM di ONNX Runtime con WebGPU (JSEP) pesa 27 MiB; quello solo WASM 13,6 MiB (3,7 MB compressi).
- **Decisione:** il worker usa `onnxruntime-web/wasm`, multi-thread con cross-origin isolation. Le misure di M2 erano già su WASM, perché in CI non c'è GPU. Rispetto a D13 si scende anche di 13 MB nel primo download.
- **Alternative scartate per ora:**
  - JSEP servito da una CDN: dipendenza esterna, e COEP e cache offline più complicati.
  - Variante JSPI (16 MiB): WebGPU solo sui Chrome recenti, non su Safari.
  - Netlify, senza il limite dei 25 MiB: la specifica preferisce Cloudflare.
- **Da rivedere:** se sui telefoni reali WASM supera i 5 s (D14).

## D16. PWA e pubblicazione anticipate prima di M3 (M5)

- **Contesto:** il gruppo vuole provare l'app sui telefoni mentre raccoglie le foto per M3. La specifica mette la pubblicazione in M5, dopo M3–M4.
- **Decisione:** su richiesta esplicita anticipo la parte di M5 che non dipende dal modello:
  - manifest e icone (`apps/web/scripts/make_icons.py`);
  - service worker che, al primo avvio, mette in cache app, WASM e modello (circa 25 MB);
  - avviso "Aggiorna";
  - installazione su iOS e Android;
  - `_headers` per Cloudflare Pages;
  - E2E offline;
  - guida in `docs/deploy.md`.
- **Scaricamento del modello:** al primo avvio il worker lo scarica con `cache: 'no-store'` e un secondo tentativo, per evitare un errore di scrittura concorrente con la cache del service worker.
- **Ancora aperto:** il criterio di M5 (app installata e funzionante offline su telefoni reali) resta [UMANO], come M3 e M4.

## D17. Uso privato e licenza AGPL

- **Decisione del gruppo (2026-09-29):** per ora l'app è solo per uso personale e degli amici, non pubblica. Si resta su Ultralytics (D12).
- **Se l'app diventasse pubblica:** due strade, nessuna delle due complicata.
  - Pubblicare il codice con licenza AGPL: nessun lavoro tecnico.
  - Sostituire il modello con un detector a licenza permissiva: `CardRecognizer`, dataset sintetico e script di valutazione restano gli stessi; cambia solo l'addestramento.

## D18. Cloudflare Workers con asset statici invece di Pages

- **Contesto:** la procedura attuale di Cloudflare crea i progetti collegati a Git come Worker con asset statici. La specifica (§2, §9) nomina Cloudflare Pages.
- **Decisione:**
  - Configurazione in `wrangler.jsonc` (`assets.directory = apps/web/dist`), deploy con `npx wrangler deploy` dopo la build.
  - Il file `_headers` (COOP/COEP) e il limite di 25 MiB per file valgono come su Pages.
  - Indirizzo: <https://burracocounter.rontinim.workers.dev>.
- **Build su Cloudflare:** pnpm si esegue tramite `npx -y pnpm@10.33.0`, perché l'immagine di build ha pnpm solo per alcune versioni di Node. Non si imposta `NODE_VERSION = 22`: installerebbe la 22.23.3, che ne è priva.
- **Alternative scartate:** creare un progetto Pages classico. È possibile, ma non è più la procedura proposta dal pannello, e il risultato per l'app è identico.

## D19. Modalità di inserimento semplice (richiesta del gruppo, 2026-10-01)

- **Contesto:** al tavolo il gruppo vuole un flusso minimo: una foto e il punteggio.
- **Decisione:**
  - `Match.entryMode`: `full` (default, come prima) o `simple`. Si sceglie in "Nuova partita"; il default si imposta nelle Impostazioni. Le partite già salvate restano `full`.
  - In modalità semplice si scatta **una foto per squadra**, con le carte in mano appoggiate di fianco ai giochi.
  - Si risponde a **«Chi ha chiuso?»** (una squadra o nessuno).
  - Il **pozzetto è considerato preso**, con una casella per l'eccezione.
  - Le carte in mano della squadra sono attribuite al primo giocatore: per il punteggio conta solo la somma.
  - Il motore delle regole non cambia.
- **Limite dichiarato:** chiusura e pozzetto non si vedono dalla foto, quindi non si possono eliminare senza falsare il punteggio. Il gruppo ha accettato «un tocco per la chiusura, pozzetto preso di default».
- **Uscita:** «Passa all'inserimento completo» porta i dati raccolti nel modulo completo. Una smazzata già salvata si modifica sempre con il modulo completo.

## D20. Deduplica e raggruppamento v0 anticipati da M4

- **Contesto:** la modalità semplice deve proporre giochi e carte in mano da una sola foto (§6.4–6.5).
- **Decisione:** euristica in `packages/vision/src/table.ts`, con soglie in multipli della dimensione dell'indice:
  - **Deduplica:** due indici uguali sono la stessa carta se stanno ad angoli opposti, cioè a 2,5–7 volte l'indice lungo un asse e a 0,8–5 lungo l'altro. Le fusioni sono segnalate in revisione con ⧉.
  - **Raggruppamento:** collegamento singolo con distanza massima pari a 2 volte l'indice mediano; ogni gruppo passa da `validateMeld`.
  - **Carte in mano:** i gruppi che non formano un gioco valido vanno in mano. Il gruppo ha confermato che le carte in mano stanno di fianco e non formano scale o tris.
- **Da fare in M4:** tarare le soglie sulle foto reali e gestire le carte ruotate e i ventagli fitti. Valutare YOLO11-obb se la geometria non basta, e misurare la percentuale di foto con punteggio esatto.

## D21. Pipeline di M3: dalle foto del mazzo al modello

- **Ritaglio** (`ml/generator/extract_cards.py`):
  - trova la carta con soglia di colore, poi GrabCut con seme fisso, poi taglia le strisce di tavolo sui bordi;
  - raddrizza la carta a 600×900;
  - 4 foto con legno chiaro o in ombra hanno tagli manuali verificati a vista (`manual_trims.json`);
  - le carte sono salvate in JPEG (7,6 MB in tutto); gli angoli arrotondati li ricrea `rounded_mask()`.
- **Indici** (`index_boxes.py`):
  - il riquadro dell'indice si trova automaticamente; quelli anomali (ombre, cornice delle figure) prendono la mediana del gruppo (carte, pinelle, jolly);
  - **le carte Modiano hanno l'indice in tutti e quattro gli angoli**: il generatore li etichetta tutti.
- **Generatore** (`synth.py`):
  - scene 640×640, la scala dei riquadri usati nell'app;
  - giochi a ventaglio, rotazioni, doppio mazzo, matte, carte sparse;
  - sfondi procedurali e il tavolo reale delle foto;
  - aumenti dei dati con albumentations;
  - un indice coperto per più del 35% non viene etichettato.
- **Classi:** le 52 nell'ordine del modello base, più `JOKER` (53).
- **Validazione reale** (`ml/eval/real_val.py`): le 54 foto del mazzo, con le etichette dei quattro angoli. Non è il golden set (§7.4): misura il divario tra sintetico e reale.
- **Addestramento** (`ml/notebooks/train_colab.ipynb`, [UMANO]):
  - si esegue su Colab con GPU T4;
  - si carica lo ZIP del repository, che è privato e quindi non clonabile senza token;
  - checkpoint su Google Drive, con ripresa;
  - `fliplr=0`, perché una carta non si vede mai specchiata.
- **Scelta del modello:** YOLO11n in FP32 (circa 10 MB). YOLO11s (circa 36 MB) supera il limite di 15 MB e andrebbe quantizzato: lo si adotta solo se è nettamente migliore.
- **App:** il worker legge modello e classi da `models/cards.json`. Per cambiare modello basta caricare i due file prodotti dal notebook.
- **Da riprendere in M4:** con 4 indici per carta la deduplica di D20 va estesa agli angoli adiacenti (stessa riga o colonna), non solo a quelli opposti in diagonale.
- **Alternative scartate:**
  - addestrare in questo ambiente: solo CPU, ore per una singola epoca su 15.000 immagini;
  - caricare il dataset già generato su Colab: 1–2 GB di upload contro i pochi MB delle carte ritagliate.
