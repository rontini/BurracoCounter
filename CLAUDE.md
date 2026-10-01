# BurraCount – Specifica di progetto

Sep 29, 2026 · @Matteo

BurraCount (nome di lavoro iniziale: BurracoScan) è una web app che calcola i punti del burraco da una foto delle carte, costruita da un agente AI in autonomia seguendo questa specifica. Salvala come `CLAUDE.md` nella root del repository. Le attività marcate **\[UMANO\]** richiedono una persona; la sezione 13 va compilata prima di iniziare.

## 0. Ruolo e regole di lavoro

Sei l'agente di sviluppo del progetto e lavori per milestone, nell'ordine della sezione 10.

- Non passare alla milestone successiva finché i criteri di accettazione della corrente non sono soddisfatti.
- Fai un commit per ogni task, con messaggi chiari. A fine sessione aggiorna `PROGRESS.md` (fatto / in corso / bloccato) e rileggilo all'inizio della sessione successiva.
- Registra ogni scelta tecnica non banale in `docs/decisions.md`: contesto, decisione, alternative scartate.
- Non inventare regole del burraco. Se una regola è ambigua, rendila configurabile e chiedi.
- Quando un task richiede azioni fisiche o account (\[UMANO\]), fermati, spiega esattamente cosa serve e prepara tutto il resto.
- Per il motore delle regole scrivi i test prima del codice. Non fare merge con test falliti.
- Non iniziare la milestone M6 (store) senza conferma esplicita.

## 1. Obiettivo

L'app parte dalle foto dei giochi calati e delle carte in mano a fine smazzata. Riconosce le carte, le raggruppa in giochi, calcola il punteggio secondo il burraco italiano e tiene la partita. Deve funzionare su iPhone e Android, offline e senza account.

**Prodotto principale:** una PWA completa e autosufficiente, installabile dal browser senza Play Store né App Store. La pubblicazione sugli store è opzionale e successiva (M6).

**Principio guida:** l'app deve restare utile anche quando il riconoscimento sbaglia. Per questo servono una revisione con correzione rapida e l'inserimento manuale sempre disponibile.

## 2. Decisioni architetturali

Un solo codice web, eseguito interamente sul dispositivo. Non cambiare queste scelte senza una motivazione scritta in `docs/decisions.md`.

- **Stack:** TypeScript, React e Vite.
- **Distribuzione principale:** PWA (vite-plugin-pwa), installabile da Safari e Chrome.
- **Distribuzione opzionale:** Capacitor per pacchetti nativi iOS e Android dallo stesso codice, solo in M6. Fino ad allora niente dipendenze da Capacitor, ma nessuna API esclusiva del browser senza fallback.
- **Riconoscimento sul dispositivo:** YOLO (Ultralytics) esportato in ONNX ed eseguito con ONNX Runtime Web in un Web Worker. Usa WebGPU se disponibile, altrimenti WASM. Nessun server.
- **Dati locali:** IndexedDB tramite Dexie. Nessun backend, nessun account.
- **Riconoscitore astratto:** tutto il riconoscimento passa dall'interfaccia `CardRecognizer`. Così si può sostituire il modello o aggiungere un'alternativa, per esempio un LLM multimodale tramite proxy, senza toccare il resto.
- **Monorepo** con pnpm workspaces.
- **Hosting:** Cloudflare Pages o Netlify, perché servono header personalizzati COOP/COEP (sezione 6). GitHub Pages non va bene.

## 3. Struttura del repository

La logica sta in pacchetti indipendenti dall'interfaccia, così regole e visione si testano da sole.

```
burracount/
├─ CLAUDE.md            # questa specifica
├─ PROGRESS.md
├─ docs/decisions.md
├─ apps/web/            # React PWA (in M6: ios/, android/ via Capacitor)
├─ packages/rules/      # motore punteggi, TS puro, zero dipendenze
├─ packages/vision/     # tiling, NMS, deduplica, raggruppamento in giochi
├─ ml/
│  ├─ generator/        # generatore dataset sintetico
│  ├─ notebooks/        # training su Colab/Kaggle
│  └─ eval/             # golden set e metriche end-to-end
└─ .github/workflows/   # CI
```

## 4. Modello dati

Cinque tipi coprono tutto il dominio; vivono in `packages/rules` e sono condivisi dal resto.

| Tipo | Contenuto |
| --- | --- |
| `Card` | rank (A, 2–10, J, Q, K, JOKER) e suit (C, D, H, S; null per il jolly) |
| `Detection` | card, bbox, confidence, foto di origine |
| `Meld` | carte ordinate, tipo (scala o tris), matta con posizione e ruolo |
| `HandResult` | per squadra: melds, carte in mano per giocatore, `closed`, `pozzettoTaken` |
| `Match` | giocatori e squadre, `RuleSet`, smazzate, totali |

## 5. Motore delle regole (`packages/rules`)

Il motore è TypeScript puro e ogni valore sta in un `RuleSet` configurabile. I default sono questi:

| Voce | Default |
| --- | --- |
| Carte dal 3 al 7 | 5 punti |
| Carte dall'8 al K | 10 punti |
| Asso | 15 punti |
| Pinella (2) | 20 punti |
| Jolly | 30 punti |
| Burraco pulito (≥7 carte) | 200 punti |
| Burraco semipulito | 150 punti (disattivabile) |
| Burraco sporco | 100 punti |
| Burraco reale / super | disattivati |
| Chiusura | +100 punti |
| Pozzetto non preso | −100 punti |
| Carte in mano | sottratte con il loro valore |
| Fine partita | obiettivo 2005, oppure numero di smazzate con tabelle Victory Point importabili in JSON |
| Modalità | 2v2, 1v1, 1v1v1 con divisione dei punti |

Funzioni:

- `validateMeld(cards)`: riconosce la scala (stesso seme, consecutive, asso basso A‑2‑3 o alto Q‑K‑A, al massimo una matta) o il tris. In caso di errore restituisce messaggi descrittivi.
- `classifyBurraco(meld)`: pulito, semipulito o sporco. Una pinella nella sua posizione naturale conta come carta normale; la posizione della matta determina il semipulito.
- `scoreHand(handResult, ruleSet)`: restituisce il dettaglio completo (base, bonus, penalità, totale), mai solo un numero.
- **Ambiguità:** se un 2 può essere sia naturale sia matta, il motore restituisce tutte le interpretazioni possibili e la UI chiede all'utente.

**Criterio di accettazione:** test per ogni tipo di burraco, posizione della pinella, asso alto e basso, jolly, chiusura con e senza pozzetto. Copertura del pacchetto ≥95%.

## 6. Pipeline di visione (`packages/vision` + worker)

Una foto deve diventare una lista di giochi proposti in meno di 5 secondi su un telefono di fascia media, con la UI mai bloccata.

1. **Input:** `<input type="file" accept="image/*" capture="environment">`, più affidabile della fotocamera live nelle PWA su iOS. Consenti sempre anche la galleria. In M6, con Capacitor, usa il plugin Camera.
2. **Preprocessing:** correggi l'orientamento EXIF, porta il lato lungo a massimo 3000 px e lavora con OffscreenCanvas nel worker.
3. **Tiling:** riquadri 640×640 sovrapposti del 20–25%, inferenza su ogni riquadro, rimappatura delle coordinate, NMS globale per classe.
4. **Deduplica (doppio mazzo):** distingui due angoli della stessa carta da due carte identiche distinte. Usa un'euristica geometrica sulla distanza attesa tra gli angoli, stimata dalla dimensione del box dell'indice, e sull'appartenenza allo stesso gioco. Se non basta, valuta un modello con box orientati (YOLO11‑obb). Segnala alla UI ogni fusione incerta.
5. **Raggruppamento in giochi:** clustering spaziale lungo la direzione del ventaglio (DBSCAN o analisi per righe), poi ordinamento e validazione con `validateMeld`. Evidenzia i gruppi non validi.
6. **Output:** giochi proposti con la confidenza di ogni carta.

**Nota:** WASM multi-thread richiede cross-origin isolation, cioè gli header COOP/COEP sull'hosting.

## 7. Machine learning (`ml/`)

Il modello rileva l'**indice d'angolo** (valore e seme), non la carta intera, su 53 classi: 52 carte più JOKER.

1. **Baseline:** parti da un modello pubblico già addestrato sulle carte da gioco, per esempio il dataset "playing cards" di Augmented Startups su Roboflow e il detector YOLO11s derivato su Hugging Face. Verifica le licenze e quale regione è annotata.
2. **\[UMANO\] Foto del mazzo:** ogni carta singola, di fronte, su sfondo neutro e con luce uniforme. Prepara uno script con le istruzioni e la checklist dei nomi file.
3. **Generatore sintetico:**
   - ritaglia automaticamente gli angoli dalle foto delle carte;
   - componi layout realistici da burraco: ventagli con forte sovrapposizione, 30–60 carte, più righe, rotazioni e due copie della stessa carta;
   - usa sfondi di tavoli e tappeti, con variazioni di luce, ombre, sfocatura e prospettiva (albumentations);
   - genera le etichette YOLO automaticamente, per un totale di 20–50 mila immagini.
4. **\[UMANO\] Foto reali:** 100–200 foto di tavoli a fine smazzata, pre-annotate dal modello e corrette in Label Studio o CVAT. Tieni da parte almeno 50 foto mai usate nel training: sono il **golden set**.
5. **Training:** notebook pronto per Colab/Kaggle che confronta YOLO11n e YOLO11s con imgsz 640 sui riquadri. **\[UMANO\]** lanciarlo.
6. **Export ONNX:** opset compatibile con ONNX Runtime Web, eventuale quantizzazione FP16/INT8, dimensione massima 15 MB. Verifica che l'output in Python e nel browser coincida.
7. **Valutazione end-to-end sul golden set:** accuratezza per carta, percentuale di foto con punteggio esatto, errore medio sul punteggio. La soglia per il rilascio è ≥97% di carte corrette, con ogni errore correggibile dalla UI.

## 8. UX

Il flusso ruota attorno alla schermata di revisione: la foto propone, l'utente conferma o corregge con un tap.

1. **Nuova partita:** giocatori o squadre, regole (preset più personalizzazione), obiettivo.
2. **Fine smazzata, per ogni squadra:** foto dei giochi (una o più), foto delle carte in mano di ciascun giocatore, interruttori "ha chiuso" e "pozzetto preso".
3. **Revisione:**
   - la foto mostra i riquadri sovrapposti e i giochi appaiono come file di carte;
   - un tap su una carta la corregge con un selettore rapido di valore e seme;
   - le carte si trascinano tra i giochi e si possono aggiungere o rimuovere;
   - le carte a bassa confidenza sono evidenziate e le ambiguità vengono chieste all'utente.
4. **Riepilogo:** dettaglio dei punti (base, burrachi, chiusura, mano) e conferma.
5. **Tabellone:** totali, storico mano per mano, vincitore.

L'inserimento manuale completo, senza foto, è sempre disponibile.

Requisiti: design mobile-first, pulsanti grandi, tema chiaro e scuro, interfaccia in italiano con i18n predisposto, accessibilità di base, funzionamento completamente offline dopo il primo avvio.

## 9. Web app: installazione e distribuzione senza store

L'app si distribuisce con un link: niente store, niente revisioni, aggiornamenti immediati.

- **Hosting:** Cloudflare Pages (piano gratuito) con header COOP/COEP in un file `_headers`, dominio HTTPS.
- **Manifest:** nome, icone 192 e 512 px più icona maskable, `display: standalone`, colori del tema, `apple-touch-icon` per iOS.
- **Service worker:** mette in cache app e modello ONNX al primo avvio, così tutto funziona offline. Quando c'è una nuova versione, mostra un avviso "Aggiorna".
- **Installazione su iPhone:** Safari → Condividi → "Aggiungi alla schermata Home". L'app mostra queste istruzioni quando rileva Safari su iOS non ancora installato.
- **Installazione su Android:** Chrome propone "Installa app"; l'app offre un pulsante che usa l'evento `beforeinstallprompt`.
- **Dati:** restano sul dispositivo. Prevedi esportazione e importazione delle partite in JSON, perché il browser può cancellare lo spazio di archiviazione; richiedi `navigator.storage.persist()`.

## 10. Milestone e criteri di accettazione

Le milestone da M0 a M5 portano a una web app completa; M6 è opzionale e parte solo su richiesta esplicita.

1. **M0 – Setup:** monorepo, lint e format, Vitest, Playwright, CI su GitHub Actions, `PROGRESS.md`.
   - ✓ La CI è verde su un'app vuota.
2. **M1 – Segnapunti manuale:** motore delle regole completo, UI della partita con inserimento manuale, persistenza.
   - ✓ L'app è già usabile per giocare e tutti i test passano.
3. **M2 – Visione con modello base:** worker ONNX, tiling, overlay e schermata di revisione, anche senza riconoscimento del jolly.
   - ✓ Dalla foto alle carte mostrate in meno di 5 secondi.
4. **M3 – Modello proprio:** dataset sintetico, fine-tuning con il jolly, valutazione sul golden set.
   - ✓ Soglie della sezione 7 raggiunte.
5. **M4 – Giochi e deduplica:** raggruppamento, deduplica, ambiguità di pinella e jolly.
   - ✓ Percentuale di foto con punteggio esatto misurata e documentata.
6. **M5 – Web app di produzione:** tutto quanto nella sezione 9, deploy su Cloudflare Pages.
   - ✓ Installata e funzionante offline su un iPhone e un Android reali. **\[UMANO: test\]**
7. **M6 – Store (OPZIONALE):** Capacitor iOS e Android, icone, splash screen, privacy policy, schede store.
   - **\[UMANO\]** Account Apple (99 €/anno) e Google (25 $), test chiuso sul Play Store con 12 tester per 14 giorni consecutivi, build iOS su Mac o con un servizio cloud come Codemagic.

## 11. Qualità e test

Ogni regressione nel punteggio deve fermare la CI prima di arrivare agli utenti.

- **Unit:** regole in modo esaustivo; tiling, NMS e deduplica con casi sintetici.
- **Golden test in CI:** le foto del golden set con punteggio atteso girano con onnxruntime-node e bloccano le regressioni.
- **E2E con Playwright:** flusso di partita completo con foto di esempio, incluso il funzionamento offline.
- **\[UMANO\]** Prima di ogni rilascio, verifica delle prestazioni su un iPhone e un Android reali.

## 12. Rischi noti e mitigazioni

Il rischio principale è la precisione del riconoscimento, non la piattaforma.

| Rischio | Mitigazione |
| --- | --- |
| Carte piccole o sovrapposte | Tiling e dataset sintetico con ventagli; se la foto è troppo densa, la UI consiglia di fotografare un gioco alla volta |
| Doppioni del doppio mazzo | Euristica geometrica più conferma dell'utente |
| Divario tra dati sintetici e reali | Golden set di foto reali e fine-tuning su foto vere |
| WebGPU assente | Passaggio automatico a WASM |
| Dati cancellati dal browser | Archiviazione persistente richiesta ed esportazione JSON delle partite |
| Rifiuto dall'App Store (solo M6) | Funzioni native ben visibili: fotocamera, riconoscimento sul dispositivo, offline. La web app resta comunque disponibile |

## 13. Da definire prima di iniziare \[UMANO\]

Quattro scelte vanno fissate qui prima di M1; l'agente le usa come default del `RuleSet` e del modello.

- [x] Regolamento esatto: semipulito **sì, 150 punti**; chiusura **+100**; pozzetto non preso **−100**; carte rimaste in mano **sottratte** con il loro valore; **Victory Point sì, ogni 4 smazzate** (la tabella VP va ancora fornita, vedi `PROGRESS.md`).
- [x] Marca del mazzo: **Modiano** (foto delle singole carte disponibili, 2026-10-01).
- [x] Modalità di gioco più usata: **2v2**.
- [x] Nome dell'app: **BurraCount**.
