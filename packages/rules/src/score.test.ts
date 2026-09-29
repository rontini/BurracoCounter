import { describe, expect, it } from 'vitest';
import { cards } from './cards';
import { validateMeld } from './meld';
import { DEFAULT_RULESET } from './ruleset';
import { scoreHand, scoreTeam } from './score';
import type { Meld, TeamHandResult } from './types';

function meld(s: string, pick: (m: Meld) => boolean = () => true): Meld {
  const v = validateMeld(cards(s));
  if (!v.valid) throw new Error(v.errors.map((e) => e.message).join('; '));
  return v.interpretations.find(pick)!;
}

function team(p: Partial<TeamHandResult>): TeamHandResult {
  return { teamId: 'A', melds: [], hands: [[], []], closed: false, pozzettoTaken: true, ...p };
}

const R = DEFAULT_RULESET;

describe('scoreTeam', () => {
  it('sums the melded cards', () => {
    // 3,4,5 = 15; K,K,K = 30
    const s = scoreTeam(team({ melds: [meld('3H 4H 5H'), meld('KH KS KD')] }), R);
    expect(s.meldCardPoints).toBe(45);
    expect(s.base).toBe(45);
    expect(s.total).toBe(45);
    expect(s.melds.map((m) => m.cardPoints)).toEqual([15, 30]);
  });

  it('counts wilds at their own value', () => {
    // 5 + 30 + 5 = 40
    expect(scoreTeam(team({ melds: [meld('5H JK 7H')] }), R).meldCardPoints).toBe(40);
    // 5 + 20 + 5 = 30
    expect(scoreTeam(team({ melds: [meld('5H 2C 7H')] }), R).meldCardPoints).toBe(30);
  });

  it('adds the burraco bonus by kind', () => {
    const pulito = scoreTeam(team({ melds: [meld('3H 4H 5H 6H 7H 8H 9H')] }), R);
    expect(pulito.burracoBonus).toBe(200);
    expect(pulito.melds[0]!.burraco).toBe('pulito');

    const semi = scoreTeam(team({ melds: [meld('3H 4H 5H 6H 7H 8H 9H JK')] }), R);
    expect(semi.burracoBonus).toBe(150);

    const sporco = scoreTeam(team({ melds: [meld('3H 4H JK 6H 7H 8H 9H')] }), R);
    expect(sporco.burracoBonus).toBe(100);
  });

  it('adds the closing bonus', () => {
    const s = scoreTeam(team({ melds: [meld('3H 4H 5H')], closed: true }), R);
    expect(s.closingBonus).toBe(100);
    expect(s.total).toBe(115);
  });

  it('subtracts the pozzetto penalty', () => {
    const s = scoreTeam(team({ melds: [meld('3H 4H 5H')], pozzettoTaken: false }), R);
    expect(s.pozzettoPenalty).toBe(100);
    expect(s.total).toBe(15 - 100);
  });

  it('closing with the pozzetto taken, no penalty', () => {
    const s = scoreTeam(team({ melds: [meld('3H 4H 5H')], closed: true, pozzettoTaken: true }), R);
    expect(s.pozzettoPenalty).toBe(0);
    expect(s.total).toBe(115);
  });

  it('subtracts the cards left in every player hand', () => {
    const s = scoreTeam(
      team({ melds: [meld('KH KS KD')], hands: [cards('AS JK'), cards('3C 2D')] }),
      R,
    );
    expect(s.handPenalty).toBe(15 + 30 + 5 + 20);
    expect(s.base).toBe(30 - 70);
    expect(s.total).toBe(-40);
  });

  it('full example: burraco pulito, sporco, closed', () => {
    const s = scoreTeam(
      team({
        melds: [
          meld('AS 2S 3S 4S 5S 6S 7S', (m) => m.wild === null), // 15+20+25 = 60, pulito
          meld('8D 8D 8H 8C 8S JK 8H'), // 60 + 30 = 90, sporco
          meld('QH QS QC'), // 30
        ],
        closed: true,
        hands: [[], cards('4C')],
      }),
      R,
    );
    expect(s.meldCardPoints).toBe(180);
    expect(s.burracoBonus).toBe(300);
    expect(s.closingBonus).toBe(100);
    expect(s.handPenalty).toBe(5);
    expect(s.total).toBe(180 + 300 + 100 - 5);
  });

  it('uses the rule set values', () => {
    const r = { ...R, closing: 150, pozzettoNotTaken: 50, burracoPulito: 300 };
    const s = scoreTeam(
      team({ melds: [meld('3H 4H 5H 6H 7H 8H 9H')], closed: true, pozzettoTaken: false }),
      r,
    );
    expect(s.total).toBe(45 + 300 + 150 - 50);
  });
});

describe('scoreHand', () => {
  it('scores every team', () => {
    const scores = scoreHand(
      {
        teams: [
          team({ teamId: 'A', melds: [meld('3H 4H 5H')], closed: true }),
          team({ teamId: 'B', pozzettoTaken: false, hands: [cards('KS'), cards('KD')] }),
        ],
      },
      R,
    );
    expect(scores.map((s) => [s.teamId, s.total])).toEqual([
      ['A', 115],
      ['B', -120],
    ]);
  });
});
