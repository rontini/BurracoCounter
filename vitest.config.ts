import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/web'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/web/src/**'],
      exclude: ['**/*.test.{ts,tsx}', '**/main.tsx'],
      reporter: ['text', 'html', 'json-summary'],
      // CLAUDE.md §5: copertura del motore delle regole ≥95%.
      thresholds: {
        'packages/rules/src/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
      },
    },
  },
});
