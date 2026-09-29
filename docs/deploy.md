# Pubblicazione su Cloudflare Pages

L'app è statica: Cloudflare costruisce il sito dal repository GitHub a ogni push e lo pubblica su un indirizzo HTTPS `*.pages.dev`. Il piano gratuito basta.

## Prima configurazione [UMANO], circa 10 minuti

1. Crea un account gratuito su <https://dash.cloudflare.com/sign-up>.
2. Apri **Workers & Pages** → **Create** → scheda **Pages** → **Connect to Git**.
3. Autorizza Cloudflare su GitHub e scegli il repository **rontini/BurracoCounter**. Puoi limitare l'accesso a questo solo repository.
4. Impostazioni di build:

   | Campo                  | Valore                                                    |
   | ---------------------- | --------------------------------------------------------- |
   | Project name           | `burracount` (diventa `burracount.pages.dev`)             |
   | Production branch      | `claude/new-session-b89i50` per ora; `main` dopo il merge |
   | Framework preset       | None                                                      |
   | Build command          | `pnpm --filter @burracount/web build`                     |
   | Build output directory | `apps/web/dist`                                           |
   | Root directory         | _(vuoto)_                                                 |
   | Environment variable   | `NODE_VERSION` = `22`                                     |

5. **Save and Deploy**. Dopo 1–2 minuti l'app è su `https://burracount.pages.dev`. Da quel momento ogni push sul branch la aggiorna, e l'app mostra l'avviso "Aggiorna".

Il file `apps/web/public/_headers` imposta gli header COOP/COEP, che servono al riconoscimento multi-thread, e la cache dei file.

## Limitare l'accesso agli amici (facoltativo)

L'indirizzo `*.pages.dev` non è indicizzato, ma chiunque abbia il link può aprirlo. Per limitarlo a persone precise si usa **Cloudflare Access**, gratuito fino a 50 utenti:

1. Nel progetto Pages vai in **Settings** → **General** → **Access policy** → **Enable**.
2. Aggiungi gli indirizzi email ammessi. Al primo accesso ognuno riceve un codice via email.

Non serve per il test iniziale.

## Controlli dopo la pubblicazione [UMANO]

Su un **iPhone** con Safari e su un **Android** con Chrome:

1. Apri il link. Su iPhone segui le istruzioni in home: Condividi → «Aggiungi alla schermata Home». Su Android tocca «Installa app».
2. Apri l'app installata, crea una partita e inserisci una smazzata a mano.
3. Apri **Nuova smazzata** e aspetta «Riconoscimento pronto». Fotografa un gioco e annota il tempo mostrato nella revisione («N carte riconosciute in X s»): il criterio è sotto i 5 s.
4. Metti il telefono in modalità aereo, chiudi e riapri l'app: la partita e il riconoscimento devono funzionare.
5. Riporta in `PROGRESS.md`, o in chat, modello del telefono, tempo misurato ed eventuali problemi.
