import type { RuleSet, VictoryPointTable } from './types';

/**
 * Tabella VP predefinita. Le fasce fino a 13–7 sono quelle standard dei
 * tornei; il 20–0 sopra i 2000 punti è indicato dal gruppo. Le fasce da
 * 14–6 a 19–1 sono stimate a intervalli regolari di 275 punti e vanno
 * verificate (vedi docs/decisions.md, D10). Si modifica dalle impostazioni.
 */
export const DEFAULT_VP_TABLE: VictoryPointTable = {
  name: 'Standard (fasce 14–19 da verificare)',
  rows: [
    { maxDiff: 50, winner: 10, loser: 10 },
    { maxDiff: 150, winner: 11, loser: 9 },
    { maxDiff: 250, winner: 12, loser: 8 },
    { maxDiff: 350, winner: 13, loser: 7 },
    { maxDiff: 625, winner: 14, loser: 6 },
    { maxDiff: 900, winner: 15, loser: 5 },
    { maxDiff: 1175, winner: 16, loser: 4 },
    { maxDiff: 1450, winner: 17, loser: 3 },
    { maxDiff: 1725, winner: 18, loser: 2 },
    { maxDiff: 2000, winner: 19, loser: 1 },
    { maxDiff: null, winner: 20, loser: 0 },
  ],
};

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
 * convertito in Victory Point.
 */
export const DEFAULT_RULESET: RuleSet = {
  ...BASE,
  endCondition: { type: 'victoryPoints', handsPerRound: 4, rounds: 1, table: DEFAULT_VP_TABLE },
};

/** Partita classica a obiettivo 2005 punti. */
export const TARGET_2005_RULESET: RuleSet = {
  ...BASE,
  endCondition: { type: 'target', target: 2005 },
};
