import 'fake-indexeddb/auto';
import { createMatch, DEFAULT_RULESET, defaultTeams } from '@burracount/rules';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, deleteMatch, exportMatches, importMatches, parseMatchesExport, saveMatch } from './db';

const match = createMatch({
  id: 'm1',
  name: 'Sabato',
  mode: '2v2',
  teams: defaultTeams('2v2'),
  ruleSet: DEFAULT_RULESET,
  now: '2026-01-01T00:00:00Z',
});

describe('db', () => {
  beforeEach(async () => {
    await db.matches.clear();
  });

  it('saves, reads and deletes a match', async () => {
    await saveMatch(match);
    expect((await db.matches.get('m1'))?.name).toBe('Sabato');
    await deleteMatch('m1');
    expect(await db.matches.get('m1')).toBeUndefined();
  });

  it('round-trips an export through JSON', async () => {
    await saveMatch(match);
    const json = JSON.parse(JSON.stringify(exportMatches(await db.matches.toArray())));
    await db.matches.clear();
    expect(await importMatches(parseMatchesExport(json))).toBe(1);
    expect((await db.matches.get('m1'))?.teams).toEqual(match.teams);
  });

  it('rejects foreign files', () => {
    expect(() => parseMatchesExport({ foo: 1 })).toThrow(/export/);
    expect(() => parseMatchesExport(null)).toThrow(/export/);
    expect(() =>
      parseMatchesExport({ format: 'burracount-matches', version: 1, matches: [{}] }),
    ).toThrow(/malformata/);
  });
});
