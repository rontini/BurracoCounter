# BurraCount

Web app (PWA) che calcola i punti del burraco da una foto delle carte. Funziona offline, sul dispositivo, senza account.

La specifica completa è in [`CLAUDE.md`](CLAUDE.md), lo stato del lavoro in [`PROGRESS.md`](PROGRESS.md) e le scelte tecniche in [`docs/decisions.md`](docs/decisions.md).

## Sviluppo

Requisiti: Node ≥ 22 e pnpm 10 (`corepack enable`).

```sh
pnpm install
pnpm --filter @burracount/web dev   # app in sviluppo
pnpm check                            # format, lint, typecheck, unit test
pnpm test:coverage                    # unit test con copertura
pnpm e2e                              # test Playwright (build + preview)
```

## Struttura

| Percorso          | Contenuto                                              |
| ----------------- | ------------------------------------------------------ |
| `apps/web`        | PWA React + Vite                                       |
| `packages/rules`  | motore dei punteggi, TypeScript puro                   |
| `packages/vision` | tiling, NMS, deduplica, raggruppamento in giochi       |
| `ml/`             | generatore sintetico, notebook di training, golden set |
