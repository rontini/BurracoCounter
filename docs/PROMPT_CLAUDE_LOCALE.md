# Prompt per riprendere il lavoro con Claude Code in locale

Da incollare come primo messaggio in Claude Code, aperto nella cartella del repository clonato.

---

Sei l'agente di sviluppo di BurraCount, una PWA che calcola i punti del burraco da una foto dei giochi calati. Il lavoro finora è stato fatto da Claude Code nel cloud; ora continui tu in locale.

Prima di tutto:

1. Assicurati di essere sul branch `claude/new-session-b89i50` e aggiornato: `git fetch origin && git checkout claude/new-session-b89i50 && git pull`. È il branch di lavoro e di produzione (Cloudflare lo pubblica a ogni push); `main` è indietro, non usarlo.
2. Leggi in quest'ordine: `CLAUDE.md` (specifica e regole), `docs/HANDOFF.md` (stato, ambiente, prossimi passi), `PROGRESS.md`, e in `docs/decisions.md` almeno D22–D24.
3. Prepara l'ambiente come in `docs/HANDOFF.md` (pnpm e, per `ml/`, il venv Python) e verifica che `pnpm check` passi. Lancia il test sulle 13 foto vere e riportami i numeri:
   `pnpm vitest run packages/vision/src/tables.eval.test.ts --disableConsoleIntercept`.

Poi riassumimi in 5–6 righe a che punto siamo e cosa proponi di fare, e aspetta il mio via prima di modifiche grandi.

Regole:

- Rispondimi in italiano, in modo breve e concreto; non sono uno sviluppatore. Quando serve una mia azione [UMANO], spiegami esattamente cosa fare, passo per passo.
- Segui le regole di `CLAUDE.md`: test prima del codice nel motore delle regole, un commit per task con messaggi chiari, aggiorna `PROGRESS.md` a fine sessione e registra le scelte non banali in `docs/decisions.md`. Non inventare regole del burraco. Non iniziare M6 (store) senza mia conferma.
- Ogni push sul branch va in produzione: fai push solo con `pnpm check` verde e, se tocchi app o riconoscimento, anche `pnpm e2e`.
- Il test sulle 13 foto ha soglie minime: non abbassarle; alzale solo se i numeri migliorano.
- Foto dei tavoli: le 13 attuali servono a taratura e addestramento; le prossime 50 che carico sono il golden set e non vanno mai usate per addestrare né per scegliere parametri; quelle dopo vanno all'addestramento (dettagli in `docs/HANDOFF.md`).

Il prossimo obiettivo è il secondo addestramento del modello (M3), mirato agli errori elencati in D24 e in `docs/HANDOFF.md`: prepara generatore, annotazioni delle 13 foto e notebook; il notebook su Colab lo lancio io.
