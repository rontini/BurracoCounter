import type { RuleSet } from './types';

const BASE: Omit<RuleSet, 'endCondition'> = {
  cardValues: { low: 5, high: 10, ace: 15, pinella: 20, joker: 30 },
  burracoMinCards: 7,
  burracoPulito: 200,
  burracoSemipulito: 150,
  burracoSporco: 100,
  closing: 100,
  pozzettoNotTaken: 100,
  allowSetOfTwos: false,
};

/**
 * Regolamento del gruppo (CLAUDE.md §13): una partita è un turno di 4 smazzate
 * convertito in Victory Point. La tabella VP si inserisce nelle impostazioni.
 */
export const DEFAULT_RULESET: RuleSet = {
  ...BASE,
  endCondition: { type: 'victoryPoints', handsPerRound: 4, rounds: 1, table: null },
};

/** Partita classica a obiettivo 2005 punti. */
export const TARGET_2005_RULESET: RuleSet = {
  ...BASE,
  endCondition: { type: 'target', target: 2005 },
};
