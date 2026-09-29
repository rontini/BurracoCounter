import Dexie, { type Table } from 'dexie';
import type { Match } from '@burracount/rules';

export interface StoredMatch extends Match {
  updatedAt: string;
}

class BurraCountDB extends Dexie {
  matches!: Table<StoredMatch, string>;

  constructor() {
    super('burracount');
    this.version(1).stores({ matches: 'id, createdAt, updatedAt' });
  }
}

export const db = new BurraCountDB();

export async function saveMatch(match: Match): Promise<void> {
  await db.matches.put({ ...match, updatedAt: new Date().toISOString() });
}

export async function deleteMatch(id: string): Promise<void> {
  await db.matches.delete(id);
}

/** Chiede al browser di non cancellare i dati (CLAUDE.md §9). */
export async function requestPersistentStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Non supportato: le partite restano comunque esportabili in JSON.
  }
}

const EXPORT_FORMAT = 'burracount-matches';

export interface MatchesExport {
  format: typeof EXPORT_FORMAT;
  version: 1;
  exportedAt: string;
  matches: Match[];
}

export function exportMatches(matches: StoredMatch[]): MatchesExport {
  return {
    format: EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    matches: matches.map(({ updatedAt: _updatedAt, ...m }) => m),
  };
}

export function parseMatchesExport(json: unknown): Match[] {
  const data = json as Partial<MatchesExport> | null;
  if (!data || data.format !== EXPORT_FORMAT || !Array.isArray(data.matches)) {
    throw new Error('non è un export di BurraCount');
  }
  for (const m of data.matches) {
    if (typeof m?.id !== 'string' || !Array.isArray(m.teams) || !Array.isArray(m.hands)) {
      throw new Error('partita malformata');
    }
  }
  return data.matches;
}

export async function importMatches(matches: Match[]): Promise<number> {
  await db.matches.bulkPut(matches.map((m) => ({ ...m, updatedAt: new Date().toISOString() })));
  return matches.length;
}
