# PROGRESS

Aggiornato a fine sessione; va riletto all'inizio della successiva.

## Fatto

- **M0 – Setup** (2026-09-29)
  - Specifica salvata come `CLAUDE.md`.
  - Monorepo pnpm: `apps/web`, `packages/rules`, `packages/vision`, `ml/`.
  - TypeScript 6 strict, ESLint (typescript-eslint, react-hooks), Prettier, EditorConfig.
  - Vitest (projects + copertura v8), Testing Library, Playwright con smoke test che verifica anche la cross-origin isolation.
  - CI GitHub Actions: format, lint, typecheck, unit con copertura, build, E2E.
  - In locale `pnpm check`, `pnpm test:coverage` e `pnpm e2e` sono verdi.

## In corso

- Verificare che la CI sia verde su GitHub (criterio di accettazione di M0).

## Bloccato

- **M1** aspetta la sezione 13 di `CLAUDE.md` [UMANO]: regolamento (semipulito, chiusura, pozzetto, Victory Point), modalità di gioco più usate, nome dell'app. La marca del mazzo serve da M3.

## Prossimi passi

1. CI verde su GitHub → M0 chiusa.
2. Con la sezione 13 compilata: M1, partendo dai test del motore in `packages/rules`.
