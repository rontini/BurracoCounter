import { cards, createMatch, DEFAULT_RULESET, defaultTeams } from '@burracount/rules';
import { describe, expect, it } from 'vitest';
import {
  draftProblems,
  draftsFromResult,
  emptyDrafts,
  meldStatus,
  toHandResult,
  type TeamDraft,
} from './handDraft';

const match = createMatch({
  id: 'm',
  name: 'x',
  mode: '2v2',
  teams: defaultTeams('2v2'),
  ruleSet: DEFAULT_RULESET,
  now: 'now',
});

describe('meldStatus', () => {
  it('reports empty, invalid, ambiguous and ok', () => {
    expect(meldStatus({ cards: [], choice: null }, false).state).toBe('empty');
    expect(meldStatus({ cards: cards('5H 6D 9C'), choice: null }, false).state).toBe('invalid');
    expect(meldStatus({ cards: cards('2H 3H 4H'), choice: null }, false).state).toBe('ambiguous');
    expect(meldStatus({ cards: cards('2H 3H 4H'), choice: 0 }, false).state).toBe('ok');
    expect(meldStatus({ cards: cards('5H 6H 7H'), choice: null }, false).state).toBe('ok');
  });
});

describe('drafts', () => {
  it('start empty with one hand per player', () => {
    const d = emptyDrafts(match);
    expect(d).toHaveLength(2);
    expect(d[0]!.hands).toHaveLength(2);
  });

  it('convert to a hand result once every meld is resolved', () => {
    const drafts: TeamDraft[] = emptyDrafts(match);
    drafts[0]!.melds.push({ cards: cards('2H 3H 4H'), choice: null });
    drafts[0]!.closed = true;
    drafts[1]!.hands[0] = cards('KS');
    expect(toHandResult(drafts, false)).toBeNull();
    expect(draftProblems(drafts, false)).toHaveLength(1);

    drafts[0]!.melds[0]!.choice = 0;
    const result = toHandResult(drafts, false)!;
    expect(result.teams[0]!.melds).toHaveLength(1);
    expect(result.teams[1]!.hands[0]).toEqual(cards('KS'));
  });

  it('ignore empty melds', () => {
    const drafts = emptyDrafts(match);
    drafts[0]!.melds.push({ cards: [], choice: null });
    expect(toHandResult(drafts, false)!.teams[0]!.melds).toEqual([]);
  });

  it('flag two teams closing', () => {
    const drafts = emptyDrafts(match);
    drafts[0]!.closed = true;
    drafts[1]!.closed = true;
    expect(draftProblems(drafts, false)).toEqual([{ kind: 'multipleClosed' }]);
  });

  it('round-trip through a saved result, keeping the chosen interpretation', () => {
    const drafts = emptyDrafts(match);
    drafts[0]!.melds.push({ cards: cards('2H 3H 4H'), choice: 1 });
    drafts[0]!.melds.push({ cards: cards('KH KS KD'), choice: null });
    drafts[0]!.pozzettoTaken = true;
    const result = toHandResult(drafts, false)!;
    const back = draftsFromResult(match, result);
    expect(toHandResult(back, false)).toEqual(result);
    expect(back[0]!.pozzettoTaken).toBe(true);
  });

  it('fill missing teams with empty drafts', () => {
    const back = draftsFromResult(match, { teams: [] });
    expect(back).toEqual(emptyDrafts(match));
  });
});
