import { burracoBonus, classifyBurraco } from './burraco';
import { sumCards } from './cards';
import type { HandResult, MeldScore, RuleSet, TeamHandResult, TeamScore } from './types';

export function scoreTeam(result: TeamHandResult, rules: RuleSet): TeamScore {
  const melds: MeldScore[] = result.melds.map((meld) => {
    const burraco = classifyBurraco(meld, rules);
    return {
      meld,
      cardPoints: sumCards(meld.cards, rules.cardValues),
      burraco,
      burracoBonus: burracoBonus(burraco, rules),
    };
  });

  const meldCardPoints = melds.reduce((s, m) => s + m.cardPoints, 0);
  const bonus = melds.reduce((s, m) => s + m.burracoBonus, 0);
  // Carte in mano inserite una per una, più i punti contati a mano (modalità semplice).
  const handPenalty =
    result.hands.reduce((s, h) => s + sumCards(h, rules.cardValues), 0) +
    Math.max(0, result.handPoints ?? 0);
  const closingBonus = result.closed ? rules.closing : 0;
  const pozzettoPenalty = result.pozzettoTaken ? 0 : rules.pozzettoNotTaken;
  const base = meldCardPoints - handPenalty;

  return {
    teamId: result.teamId,
    meldCardPoints,
    burracoBonus: bonus,
    closingBonus,
    pozzettoPenalty,
    handPenalty,
    base,
    total: base + bonus + closingBonus - pozzettoPenalty,
    melds,
  };
}

/** Dettaglio completo della smazzata per ogni squadra, mai solo un numero. */
export function scoreHand(result: HandResult, rules: RuleSet): TeamScore[] {
  return result.teams.map((t) => scoreTeam(t, rules));
}
