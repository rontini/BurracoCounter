import { describe, expect, it } from 'vitest';
import { cards } from './cards';
import { createMatch, defaultTeams, scoreMatch } from './match';
import { validateMeld } from './meld';
import { DEFAULT_RULESET, TARGET_2005_RULESET } from './ruleset';
import { parseVictoryPointTable, victoryPointsFor } from './victory-points';
import type { HandResult, Match, Meld, RuleSet, TeamHandResult, VictoryPointTable } from './types';

function meld(s: string): Meld {
  const v = validateMeld(cards(s));
  if (!v.valid) throw new Error('meld non valido');
  return v.interpretations[0]!;
}

/** Una smazzata con i punti netti di A e B, multipli di 30 (tris di K calati o in mano). */
function hand(a: number, b: number): HandResult {
  const team = (teamId: string, n: number): TeamHandResult => {
    if (n % 30 !== 0) throw new Error(`punteggio non multiplo di 30: ${n}`);
    const kings = Array.from({ length: Math.abs(n) / 30 }, () => 'KH KS KD');
    return {
      teamId,
      melds: n > 0 ? kings.map(meld) : [],
      hands: [n < 0 ? cards(kings.join(' ')) : [], []],
      closed: false,
      pozzettoTaken: true,
    };
  };
  return { teams: [team('A', a), team('B', b)] };
}

function withHands(match: Match, hands: HandResult[]): Match {
  return {
    ...match,
    hands: hands.map((result, i) => ({ id: `h${i}`, playedAt: '2026-01-01T00:00:00Z', result })),
  };
}

const VP: VictoryPointTable = {
  name: 'test',
  rows: [
    { maxDiff: 50, winner: 10, loser: 10 },
    { maxDiff: 300, winner: 14, loser: 6 },
    { maxDiff: null, winner: 20, loser: 0 },
  ],
};

function newMatch(ruleSet: RuleSet): Match {
  return createMatch({
    id: 'm1',
    name: 'Test',
    mode: '2v2',
    teams: [
      { id: 'A', name: 'Noi', players: ['Anna', 'Bruno'] },
      { id: 'B', name: 'Loro', players: ['Carla', 'Dario'] },
    ],
    ruleSet,
    now: '2026-01-01T00:00:00Z',
  });
}

describe('defaultTeams', () => {
  it('builds teams for each mode', () => {
    expect(defaultTeams('2v2').map((t) => t.players.length)).toEqual([2, 2]);
    expect(defaultTeams('1v1').map((t) => t.players.length)).toEqual([1, 1]);
    expect(defaultTeams('1v1v1').map((t) => t.players.length)).toEqual([1, 1, 1]);
  });
});

describe('createMatch', () => {
  it('starts empty', () => {
    const m = newMatch(DEFAULT_RULESET);
    expect(m.hands).toEqual([]);
    expect(m.finishedAt).toBeNull();
    expect(m.createdAt).toBe('2026-01-01T00:00:00Z');
  });
});

describe('scoreMatch – target', () => {
  it('accumulates totals and history', () => {
    const m = withHands(newMatch(TARGET_2005_RULESET), [hand(300, 60), hand(-30, 450)]);
    const s = scoreMatch(m);
    expect(s.hands.map((h) => h.map((t) => t.total))).toEqual([
      [300, 60],
      [-30, 450],
    ]);
    expect(s.totals).toEqual({ A: 270, B: 510 });
    expect(s.finished).toBe(false);
    expect(s.winnerIds).toEqual([]);
  });

  it('ends when a team reaches the target', () => {
    const big = hand(1200, 0);
    const m = withHands(newMatch(TARGET_2005_RULESET), [big, hand(810, 300)]);
    const s = scoreMatch(m);
    expect(s.totals.A).toBe(2010);
    expect(s.finished).toBe(true);
    expect(s.winnerIds).toEqual(['A']);
  });

  it('with both over the target, the higher total wins', () => {
    const m = withHands(newMatch(TARGET_2005_RULESET), [hand(1200, 1200), hand(900, 810)]);
    expect(scoreMatch(m).winnerIds).toEqual(['A']);
  });

  it('a tie over the target keeps playing', () => {
    const m = withHands(newMatch(TARGET_2005_RULESET), [hand(1200, 1200), hand(900, 900)]);
    const s = scoreMatch(m);
    expect(s.finished).toBe(false);
  });

  it('manual finish picks the leader', () => {
    const m = { ...withHands(newMatch(TARGET_2005_RULESET), [hand(90, 30)]), finishedAt: 'x' };
    const s = scoreMatch(m);
    expect(s.finished).toBe(true);
    expect(s.winnerIds).toEqual(['A']);
  });
});

describe('scoreMatch – victory points', () => {
  const rules = (rounds: number | null, table: VictoryPointTable | null): RuleSet => ({
    ...DEFAULT_RULESET,
    endCondition: { type: 'victoryPoints', handsPerRound: 4, rounds, table },
  });

  it('defaults to one round of 4 hands converted to VP', () => {
    expect(DEFAULT_RULESET.endCondition).toMatchObject({
      type: 'victoryPoints',
      handsPerRound: 4,
      rounds: 1,
    });
  });

  it('converts each complete round of 4 hands into VP', () => {
    const hands = [
      hand(300, 60),
      hand(120, 90),
      hand(60, 150),
      hand(30, 30), // round 1: A 510, B 330 → diff 180 → 14–6
      hand(90, 60), // round 2 in progress
    ];
    const s = scoreMatch(withHands(newMatch(rules(null, VP)), hands));
    expect(s.rounds).toHaveLength(2);
    expect(s.rounds[0]).toMatchObject({
      complete: true,
      totals: { A: 510, B: 330 },
      victoryPoints: { A: 14, B: 6 },
    });
    expect(s.rounds[1]).toMatchObject({ complete: false, totals: { A: 90, B: 60 } });
    expect(s.rounds[1]!.victoryPoints).toBeNull();
    expect(s.victoryPoints).toEqual({ A: 14, B: 6 });
    expect(s.finished).toBe(false);
  });

  it('ends after the configured number of rounds', () => {
    const r = [hand(330, 0), hand(0, 0), hand(0, 0), hand(0, 0)]; // diff 330 → ultima riga
    const s = scoreMatch(withHands(newMatch(rules(1, VP)), r));
    expect(s.finished).toBe(true);
    expect(s.victoryPoints).toEqual({ A: 20, B: 0 });
    expect(s.winnerIds).toEqual(['A']);
  });

  it('without a table the VP are unknown and raw totals decide', () => {
    const r = [hand(300, 0), hand(0, 0), hand(0, 0), hand(0, 0)];
    const s = scoreMatch(withHands(newMatch(rules(1, null)), r));
    expect(s.victoryPoints).toBeNull();
    expect(s.rounds[0]!.victoryPoints).toBeNull();
    expect(s.winnerIds).toEqual(['A']);
  });
});

describe('victory point tables', () => {
  it('looks up the row for a difference', () => {
    expect(victoryPointsFor(VP, 0)).toEqual({ winner: 10, loser: 10 });
    expect(victoryPointsFor(VP, 50)).toEqual({ winner: 10, loser: 10 });
    expect(victoryPointsFor(VP, 51)).toEqual({ winner: 14, loser: 6 });
    expect(victoryPointsFor(VP, 5000)).toEqual({ winner: 20, loser: 0 });
  });

  it('a tie gives both teams the average of the first row', () => {
    const s = scoreMatch(
      withHands(
        newMatch({
          ...DEFAULT_RULESET,
          endCondition: {
            type: 'victoryPoints',
            handsPerRound: 1,
            rounds: 1,
            table: { name: 't', rows: [{ maxDiff: null, winner: 12, loser: 8 }] },
          },
        }),
        [hand(60, 60)],
      ),
    );
    expect(s.victoryPoints).toEqual({ A: 10, B: 10 });
    expect(s.winnerIds).toEqual(['A', 'B']);
  });

  it('parses a valid JSON table', () => {
    const r = parseVictoryPointTable(JSON.parse(JSON.stringify(VP)));
    expect(r).toEqual({ ok: true, table: VP });
  });

  it('rejects malformed tables with messages', () => {
    const bad = (x: unknown) => {
      const r = parseVictoryPointTable(x);
      if (r.ok) throw new Error('atteso errore');
      return r.errors;
    };
    expect(bad(null)[0]).toMatch(/oggetto/);
    expect(bad({ name: 'x', rows: [] })[0]).toMatch(/almeno una riga/);
    expect(bad({ name: 3, rows: [{ maxDiff: null, winner: 1, loser: 0 }] })[0]).toMatch(/nome/);
    expect(
      bad({
        name: 'x',
        rows: [
          { maxDiff: 100, winner: 1, loser: 0 },
          { maxDiff: 50, winner: 1, loser: 0 },
          { maxDiff: null, winner: 1, loser: 0 },
        ],
      }).join(' '),
    ).toMatch(/crescente/);
    expect(bad({ name: 'x', rows: [{ maxDiff: 10, winner: 1, loser: 0 }] }).join(' ')).toMatch(
      /ultima/,
    );
    expect(bad({ name: 'x', rows: [{ maxDiff: null, winner: 'a', loser: 0 }] }).join(' ')).toMatch(
      /numer/,
    );
    expect(bad({ name: 'x', rows: [{ maxDiff: null, winner: 0, loser: 5 }] }).join(' ')).toMatch(
      /vincitore/,
    );
    expect(
      bad({
        name: 'x',
        rows: [
          { maxDiff: null, winner: 1, loser: 0 },
          { maxDiff: null, winner: 1, loser: 0 },
        ],
      }).join(' '),
    ).toMatch(/ultima/);
    expect(bad({ name: 'x', rows: ['a'] }).join(' ')).toMatch(/riga/);
  });
});
