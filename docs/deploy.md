# Pubblicazione su Cloudflare

L'app è statica: Cloudflare la costruisce dal repository GitHub a ogni push e la pubblica su un indirizzo HTTPS `*.workers.dev`. Il piano gratuito basta.

## Prima configurazione [UMANO], circa 10 minuti

Cloudflare ora crea i progetti come **Worker con asset statici**. La configurazione è nel file `wrangler.jsonc` alla radice del repository.

1. Crea un account gratuito su <https://dash.cloudflare.com/sign-up>.
2. Apri **Workers & Pages** → **Create** → importa il repository **rontini/BurracoCounter**.
3. Compila **Set up your application**:

   | Campo                               | Valore                                                            |
   | ----------------------------------- | ----------------------------------------------------------------- |
   | Project name                        | `burracocounter` (deve coincidere con `name` in `wrangler.jsonc`) |
   | Build command                       | `pnpm --filter @burracount/web build`                             |
   | Deploy command                      | `npx wrangler deploy`                                             |
   | Preview command                     | `npx wrangler versions upload`                                    |
   | Enable Preview builds               | attivo                                                            |
   | Protect with Cloudflare Access      | spento (vedi sotto)                                               |
   | Advanced settings → Path            | `/` (vuoto)                                                       |
   | Advanced settings → Build variables | `NODE_VERSION` = `22`                                             |

   Il comando di build usa pnpm tramite `npx`. L'immagine di Cloudflare ha pnpm preinstallato solo per alcune versioni di Node: con `NODE_VERSION = 22` installava la 22.23.3, che non lo ha, e la build falliva con «No preset version installed for command pnpm».

4. **Deploy**. La prima build parte dal branch `main`, che ancora non contiene l'app, e può fallire. Dopo averlo creato:
   - apri il progetto → **Settings** → **Build** → **Branch control**;
   - imposta **Production branch** = `claude/new-session-b89i50`;
   - salva e rilancia la build da **Deployments**.

   In alternativa si fa il merge del branch in `main`.

5. L'app è su `https://burracocounter.<tuo-sottodominio>.workers.dev`: il link è in alto nella pagina del progetto. Ogni push sul branch la aggiorna, e l'app mostra l'avviso "Aggiorna".

Il file `apps/web/public/_headers` imposta gli header COOP/COEP, che servono al riconoscimento multi-thread, e la cache dei file. Gli asset statici dei Worker lo applicano come Pages. Anche qui il limite è 25 MiB per file (D15).

## Limitare l'accesso agli amici (facoltativo)

L'indirizzo `*.workers.dev` non è indicizzato, ma chiunque abbia il link può aprirlo. Per limitarlo a persone precise si usa **Cloudflare Access**, gratuito fino a 50 utenti:

1. Attiva **Protect with Cloudflare Access** nella creazione, oppure dopo, dalle impostazioni del progetto.
2. Aggiungi gli indirizzi email ammessi. Al primo accesso ognuno riceve un codice via email.

Non serve per il test iniziale.

## Controlli dopo la pubblicazione [UMANO]

Su un **iPhone** con Safari e su un **Android** con Chrome:

1. Apri il link. Su iPhone segui le istruzioni in home: Condividi → «Aggiungi alla schermata Home». Su Android tocca «Installa app».
2. Apri l'app installata, crea una partita e inserisci una smazzata a mano.
3. Apri **Nuova smazzata** e aspetta «Riconoscimento pronto». Fotografa un gioco e annota il tempo mostrato nella revisione («N carte riconosciute in X s»): il criterio è sotto i 5 s.
4. Metti il telefono in modalità aereo, chiudi e riapri l'app: la partita e il riconoscimento devono funzionare.
5. Riporta in `PROGRESS.md`, o in chat, modello del telefono, tempo misurato ed eventuali problemi.
