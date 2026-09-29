import {
  parseVictoryPointTable,
  type ParsedTable,
  type VictoryPointTable,
} from '@burracount/rules';

/** Riga modificabile: i campi restano stringhe finché l'utente scrive. */
export interface VpRowDraft {
  maxDiff: string;
  winner: string;
  loser: string;
}

export interface VpTableDraft {
  name: string;
  rows: VpRowDraft[];
}

export function draftFromTable(table: VictoryPointTable | null): VpTableDraft {
  if (!table) {
    return {
      name: 'Tabella VP',
      rows: [
        { maxDiff: '50', winner: '10', loser: '10' },
        { maxDiff: '', winner: '20', loser: '0' },
      ],
    };
  }
  return {
    name: table.name,
    rows: table.rows.map((r) => ({
      maxDiff: r.maxDiff === null ? '' : String(r.maxDiff),
      winner: String(r.winner),
      loser: String(r.loser),
    })),
  };
}

const num = (s: string): number | string =>
  s.trim() === '' || Number.isNaN(Number(s)) ? s : Number(s);

/** L'ultima riga copre sempre ogni differenza ("oltre"). */
export function tableFromDraft(draft: VpTableDraft): ParsedTable {
  return parseVictoryPointTable({
    name: draft.name.trim() || 'Tabella VP',
    rows: draft.rows.map((r, i) => ({
      maxDiff: i === draft.rows.length - 1 ? null : num(r.maxDiff),
      winner: num(r.winner),
      loser: num(r.loser),
    })),
  });
}

/** Inserisce una riga prima dell'ultima ("oltre"). */
export function addRow(draft: VpTableDraft): VpTableDraft {
  const rows = [...draft.rows];
  const prev = rows.length >= 2 ? rows[rows.length - 2]! : null;
  const last = rows[rows.length - 1]!;
  const guess =
    prev && prev.maxDiff !== '' && !Number.isNaN(Number(prev.maxDiff))
      ? String(Number(prev.maxDiff) + 100)
      : '';
  rows.splice(rows.length - 1, 0, { maxDiff: guess, winner: last.winner, loser: last.loser });
  return { ...draft, rows };
}

export function removeRow(draft: VpTableDraft, index: number): VpTableDraft {
  if (draft.rows.length <= 1) return draft;
  return { ...draft, rows: draft.rows.filter((_, i) => i !== index) };
}
