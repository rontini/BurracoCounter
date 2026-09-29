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
