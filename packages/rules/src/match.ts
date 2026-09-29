import { scoreHand } from './score';
import { victoryPointsFor } from './victory-points';
import type { GameMode, Match, RuleSet, Team, TeamScore } from './types';

export function defaultTeams(mode: GameMode): Team[] {
  switch (mode) {
    case '2v2':
      return [
        { id: 'A', name: 'Noi', players: ['Giocatore 1', 'Giocatore 3'] },
        { id: 'B', name: 'Loro', players: ['Giocatore 2', 'Giocatore 4'] },
      ];
    case '1v1':
      return [
        { id: 'A', name: 'Giocatore 1', players: ['Giocatore 1'] },
        { id: 'B', name: 'Giocatore 2', players: ['Giocatore 2'] },
      ];
    case '1v1v1':
      return ['A', 'B', 'C'].map((id, i) => ({
        id,
        name: `Giocatore ${i + 1}`,
        players: [`Giocatore ${i + 1}`],
      }));
  }
}

export function createMatch(args: {
  id: string;
  name: string;
  mode: GameMode;
  teams: Team[];
  ruleSet: RuleSet;
  now: string;
}): Match {
  return {
    id: args.id,
    name: args.name,
    createdAt: args.now,
    mode: args.mode,
    teams: args.teams,
    ruleSet: args.ruleSet,
    hands: [],
    finishedAt: null,
  };
}

export type Totals = Record<string, number>;

export interface RoundScore {
  /** Indici delle smazzate (0-based) che compongono il turno. */
  handIndexes: number[];
  complete: boolean;
  totals: Totals;
  victoryPoints: Totals | null;
}

export interface MatchScore {
  /** Dettaglio per smazzata e per squadra. */
  hands: TeamScore[][];
  totals: Totals;
  /** Solo per le partite a Victory Point; vuoto altrimenti. */
  rounds: RoundScore[];
  /** VP cumulati; null se la partita non è a VP o manca la tabella. */
  victoryPoints: Totals | null;
  finished: boolean;
  /** Vincitori (più di uno in caso di parità a partita chiusa). */
  winnerIds: string[];
}

function sumTotals(teamIds: string[], hands: TeamScore[][]): Totals {
  const totals: Totals = Object.fromEntries(teamIds.map((id) => [id, 0]));
  for (const hand of hands)
    for (const t of hand) totals[t.teamId] = (totals[t.teamId] ?? 0) + t.total;
  return totals;
}

function leaders(totals: Totals): string[] {
  const max = Math.max(...Object.values(totals));
  return Object.keys(totals).filter((id) => totals[id] === max);
}

export function scoreMatch(match: Match): MatchScore {
  const teamIds = match.teams.map((t) => t.id);
  const hands = match.hands.map((h) => scoreHand(h.result, match.ruleSet));
  const totals = sumTotals(teamIds, hands);
  const end = match.ruleSet.endCondition;
  const closedByUser = match.finishedAt !== null;

  if (end.type === 'target') {
    const top = leaders(totals);
    const reached = top.length === 1 && totals[top[0]!]! >= end.target;
    const finished = reached || closedByUser;
    return {
      hands,
      totals,
      rounds: [],
      victoryPoints: null,
      finished,
      winnerIds: finished && hands.length > 0 ? top : [],
    };
  }

  const rounds: RoundScore[] = [];
  for (let start = 0; start < hands.length; start += end.handsPerRound) {
    const chunk = hands.slice(start, start + end.handsPerRound);
    const complete = chunk.length === end.handsPerRound;
    const roundTotals = sumTotals(teamIds, chunk);
    rounds.push({
      handIndexes: chunk.map((_, i) => start + i),
      complete,
      totals: roundTotals,
      victoryPoints: complete && end.table ? roundVictoryPoints(end.table, roundTotals) : null,
    });
  }

  let victoryPoints: Totals | null = null;
  if (end.table && teamIds.length === 2) {
    victoryPoints = Object.fromEntries(teamIds.map((id) => [id, 0]));
    for (const r of rounds) {
      if (!r.victoryPoints) continue;
      for (const id of teamIds) victoryPoints[id]! += r.victoryPoints[id]!;
    }
  }

  const completeRounds = rounds.filter((r) => r.complete).length;
  const finished = closedByUser || (end.rounds !== null && completeRounds >= end.rounds);
  return {
    hands,
    totals,
    rounds,
    victoryPoints,
    finished,
    winnerIds: finished && hands.length > 0 ? leaders(victoryPoints ?? totals) : [],
  };
}

/** VP di un turno a due squadre; in parità ciascuna prende la media della prima riga. */
function roundVictoryPoints(
  table: Parameters<typeof victoryPointsFor>[0],
  totals: Totals,
): Totals | null {
  const ids = Object.keys(totals);
  if (ids.length !== 2) return null;
  const [a, b] = ids as [string, string];
  const diff = Math.abs(totals[a]! - totals[b]!);
  const vp = victoryPointsFor(table, diff);
  if (diff === 0) {
    const half = (vp.winner + vp.loser) / 2;
    return { [a]: half, [b]: half };
  }
  const aWins = totals[a]! > totals[b]!;
  return { [a]: aWins ? vp.winner : vp.loser, [b]: aWins ? vp.loser : vp.winner };
}
