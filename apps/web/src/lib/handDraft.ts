import {
  validateMeld,
  type Card,
  type HandResult,
  type Match,
  type Meld,
  type MeldError,
  type TeamHandResult,
} from '@burracount/rules';

export interface MeldDraft {
  cards: Card[];
  /** Interpretazione scelta dall'utente quando ce n'è più di una. */
  choice: number | null;
}

export interface TeamDraft {
  teamId: string;
  melds: MeldDraft[];
  /** Una lista per giocatore. */
  hands: Card[][];
  /** Punti delle carte in mano contati a mano (modalità semplice), facoltativi. */
  handPoints?: number;
  closed: boolean;
  pozzettoTaken: boolean;
}

export type MeldStatus =
  | { state: 'empty' }
  | { state: 'invalid'; errors: MeldError[] }
  | { state: 'ambiguous'; interpretations: Meld[] }
  | { state: 'ok'; meld: Meld; interpretations: Meld[] };

export function meldStatus(draft: MeldDraft, allowSetOfTwos: boolean): MeldStatus {
  if (draft.cards.length === 0) return { state: 'empty' };
  const v = validateMeld(draft.cards, { allowSetOfTwos });
  if (!v.valid) return { state: 'invalid', errors: v.errors };
  if (v.interpretations.length === 1) {
    return { state: 'ok', meld: v.interpretations[0]!, interpretations: v.interpretations };
  }
  const chosen = draft.choice === null ? undefined : v.interpretations[draft.choice];
  return chosen
    ? { state: 'ok', meld: chosen, interpretations: v.interpretations }
    : { state: 'ambiguous', interpretations: v.interpretations };
}

export function emptyDrafts(match: Match): TeamDraft[] {
  return match.teams.map((t) => ({
    teamId: t.id,
    melds: [],
    hands: t.players.map(() => []),
    closed: false,
    // Il caso più comune: entrambe le squadre prendono il pozzetto.
    pozzettoTaken: true,
  }));
}

/** Ricostruisce la bozza da una smazzata già salvata (per modificarla). */
export function draftsFromResult(match: Match, result: HandResult): TeamDraft[] {
  return emptyDrafts(match).map((empty) => {
    const saved = result.teams.find((t) => t.teamId === empty.teamId);
    if (!saved) return empty;
    return {
      teamId: saved.teamId,
      melds: saved.melds.map((m) => {
        const status = meldStatus({ cards: m.cards, choice: null }, match.ruleSet.allowSetOfTwos);
        const choice =
          status.state === 'ambiguous'
            ? status.interpretations.findIndex(
                (i) => i.kind === m.kind && i.wild?.index === m.wild?.index,
              )
            : null;
        return { cards: m.cards, choice: choice === -1 ? null : choice };
      }),
      hands: empty.hands.map((_, i) => saved.hands[i] ?? []),
      closed: saved.closed,
      pozzettoTaken: saved.pozzettoTaken,
    };
  });
}

export type DraftProblem =
  | { kind: 'meld'; teamId: string; meldIndex: number; status: MeldStatus }
  | { kind: 'multipleClosed' };

/** Elenca ciò che impedisce di calcolare la smazzata. */
export function draftProblems(drafts: TeamDraft[], allowSetOfTwos: boolean): DraftProblem[] {
  const problems: DraftProblem[] = [];
  for (const d of drafts) {
    d.melds.forEach((m, meldIndex) => {
      const status = meldStatus(m, allowSetOfTwos);
      if (status.state === 'invalid' || status.state === 'ambiguous') {
        problems.push({ kind: 'meld', teamId: d.teamId, meldIndex, status });
      }
    });
  }
  if (drafts.filter((d) => d.closed).length > 1) problems.push({ kind: 'multipleClosed' });
  return problems;
}

/** Converte le bozze in un HandResult; null se ci sono problemi aperti. */
export function toHandResult(drafts: TeamDraft[], allowSetOfTwos: boolean): HandResult | null {
  if (draftProblems(drafts, allowSetOfTwos).length > 0) return null;
  const teams: TeamHandResult[] = drafts.map((d) => ({
    teamId: d.teamId,
    melds: d.melds
      .map((m) => meldStatus(m, allowSetOfTwos))
      .flatMap((s) => (s.state === 'ok' ? [s.meld] : [])),
    hands: d.hands,
    ...(d.handPoints ? { handPoints: d.handPoints } : {}),
    closed: d.closed,
    pozzettoTaken: d.pozzettoTaken,
  }));
  return { teams };
}
