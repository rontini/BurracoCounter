import { describe, expect, it } from 'vitest';
import { addRow, draftFromTable, removeRow, tableFromDraft } from './vpDraft';

describe('vpDraft', () => {
  it('starts with a two-row template', () => {
    const d = draftFromTable(null);
    expect(d.rows).toHaveLength(2);
    expect(tableFromDraft(d)).toMatchObject({ ok: true });
  });

  it('round-trips a table', () => {
    const table = {
      name: 'Casa',
      rows: [
        { maxDiff: 50, winner: 10, loser: 10 },
        { maxDiff: 150, winner: 11, loser: 9 },
        { maxDiff: null, winner: 20, loser: 0 },
      ],
    };
    expect(tableFromDraft(draftFromTable(table))).toEqual({ ok: true, table });
  });

  it('adds rows before the last one and removes them', () => {
    let d = draftFromTable(null);
    d = addRow(d);
    expect(d.rows).toHaveLength(3);
    expect(d.rows[1]!.maxDiff).toBe('150');
    expect(d.rows[2]!.maxDiff).toBe('');
    d = removeRow(d, 1);
    expect(d.rows).toHaveLength(2);
    expect(removeRow({ name: 'x', rows: [d.rows[0]!] }, 0).rows).toHaveLength(1);
  });

  it('reports invalid input', () => {
    const d = draftFromTable(null);
    d.rows[0]!.winner = 'abc';
    const r = tableFromDraft(d);
    expect(r.ok).toBe(false);
  });

  it('forces the last row to cover every difference', () => {
    const d = draftFromTable(null);
    d.rows[1]!.maxDiff = '999';
    expect(tableFromDraft(d)).toMatchObject({ ok: true });
  });

  it('defaults an empty name', () => {
    const d = { ...draftFromTable(null), name: '  ' };
    const r = tableFromDraft(d);
    expect(r.ok && r.table.name).toBe('Tabella VP');
  });
});
