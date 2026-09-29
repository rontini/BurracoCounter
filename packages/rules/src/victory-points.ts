import type { VictoryPointRow, VictoryPointTable } from './types';

/** VP per il vincitore e il perdente, data la differenza assoluta di punti. */
export function victoryPointsFor(
  table: VictoryPointTable,
  diff: number,
): { winner: number; loser: number } {
  const row = table.rows.find((r) => r.maxDiff === null || diff <= r.maxDiff)!;
  return { winner: row.winner, loser: row.loser };
}

export type ParsedTable = { ok: true; table: VictoryPointTable } | { ok: false; errors: string[] };

/**
 * Valida una tabella VP importata da JSON:
 * `{ "name": "...", "rows": [{ "maxDiff": 50, "winner": 10, "loser": 10 }, …, { "maxDiff": null, … }] }`.
 */
export function parseVictoryPointTable(json: unknown): ParsedTable {
  if (typeof json !== 'object' || json === null) {
    return { ok: false, errors: ['La tabella deve essere un oggetto JSON.'] };
  }
  const { name, rows } = json as { name?: unknown; rows?: unknown };
  const errors: string[] = [];
  if (typeof name !== 'string') errors.push('Manca il nome della tabella.');
  if (!Array.isArray(rows) || rows.length === 0) {
    errors.push('La tabella deve avere almeno una riga in "rows".');
    return { ok: false, errors };
  }

  const parsed: VictoryPointRow[] = [];
  rows.forEach((raw: unknown, i) => {
    const n = i + 1;
    if (typeof raw !== 'object' || raw === null) {
      errors.push(`La riga ${n} non è un oggetto.`);
      return;
    }
    const { maxDiff, winner, loser } = raw as Record<string, unknown>;
    const isLast = i === rows.length - 1;
    if (isLast && maxDiff !== null) {
      errors.push(`L'ultima riga deve avere "maxDiff": null (copre ogni differenza).`);
    }
    if (!isLast && maxDiff === null) {
      errors.push(`Solo l'ultima riga può avere "maxDiff": null (riga ${n}).`);
    }
    if (maxDiff !== null && typeof maxDiff !== 'number') {
      errors.push(`Riga ${n}: "maxDiff" deve essere un numero o null.`);
    }
    if (typeof winner !== 'number' || typeof loser !== 'number') {
      errors.push(`Riga ${n}: "winner" e "loser" devono essere numeri.`);
      return;
    }
    if (winner < loser)
      errors.push(`Riga ${n}: i VP del vincitore sono minori di quelli del perdente.`);
    const prev = parsed[parsed.length - 1];
    if (
      typeof maxDiff === 'number' &&
      prev?.maxDiff !== null &&
      prev !== undefined &&
      maxDiff <= prev.maxDiff
    ) {
      errors.push(`Riga ${n}: "maxDiff" deve essere in ordine crescente.`);
    }
    parsed.push({ maxDiff: typeof maxDiff === 'number' ? maxDiff : null, winner, loser });
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, table: { name: name as string, rows: parsed } };
}
