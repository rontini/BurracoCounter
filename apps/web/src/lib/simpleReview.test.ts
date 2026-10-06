import { formatCard, parseCard, type Detection } from '@burracount/rules';
import { groupTable } from '@burracount/vision';
import { describe, expect, it } from 'vitest';
import {
  addCard,
  fromProposal,
  moveCard,
  removeCard,
  replaceCard,
  setChoice,
  statuses,
  toTeamData,
  type ReviewState,
} from './simpleReview';

const item = (s: string) => ({
  card: parseCard(s),
  confidence: 0.9,
  bbox: null,
  merged: false,
  options: null,
});
const state = (melds: string[]): ReviewState => ({
  melds: melds.map((m) => ({ items: m.split(' ').map(item), choice: null })),
});
const show = (s: ReviewState) =>
  s.melds.map((m) => m.items.map((i) => formatCard(i.card)).join(' '));

const det = (label: string, cx: number, cy: number, confidence = 0.9): Detection => ({
  card: parseCard(label),
  bbox: { x: cx - 7, y: cy - 20, width: 14, height: 40 },
  confidence,
  photoId: 'p',
});

describe('simple review', () => {
  it('builds melds from the proposal, with deduced cards and merged corners', () => {
    const fan = [
      ['5H', 0.9],
      ['9C', 0.3],
      ['7H', 0.9],
    ] as const;
    const dets = fan.flatMap(([l, c], i) => [
      det(l, 100 + i * 30, 100, c),
      det(l, 100 + i * 30, 234, c),
    ]);
    const s = fromProposal(groupTable(dets, { allowSetOfTwos: false }));
    expect(show(s)).toEqual(['5H 6H 7H']);
    const deduced = s.melds[0]!.items[1]!;
    expect(deduced.options!.map(formatCard)).toEqual(['6H', 'JK', '2H']);
    expect(deduced.confidence).toBeNull();
    expect(s.melds[0]!.items[0]!.merged).toBe(true);
  });

  it('switching between deduced alternatives keeps them; the picker clears them', () => {
    let s: ReviewState = {
      melds: [
        {
          choice: null,
          items: [item('5H'), { ...item('6H'), options: ['6H', 'JK'].map(parseCard) }, item('7H')],
        },
      ],
    };
    s = replaceCard(s, 0, 1, parseCard('JK'));
    expect(s.melds[0]!.items[1]!.options).not.toBeNull();
    s = replaceCard(s, 0, 1, parseCard('6H'));
    s = replaceCard(s, 0, 1, parseCard('9C'));
    expect(s.melds[0]!.items[1]!.options).toBeNull();
  });

  it('removes, adds and moves cards, dropping emptied melds', () => {
    let s = state(['3H 4H 6H', 'KS']);
    s = replaceCard(s, 0, 2, parseCard('5H'));
    s = addCard(s, 1, parseCard('KD'));
    s = addCard(s, 'new', parseCard('9C'));
    expect(show(s)).toEqual(['3H 4H 5H', 'KS KD', '9C']);
    s = moveCard(s, 2, 0, 1);
    expect(show(s)).toEqual(['3H 4H 5H', 'KS KD 9C']);
    s = moveCard(s, 1, 2, 'new');
    s = removeCard(s, 2, 0);
    expect(show(s)).toEqual(['3H 4H 5H', 'KS KD']);
    expect(moveCard(s, 0, 0, 0)).toBe(s);
    expect(moveCard(s, 0, 9, 1)).toBe(s);
  });

  it('converts to team data only when every meld is resolved', () => {
    let s = state(['2H 3H 4H', 'KS KD KC']);
    expect(statuses(s, false).map((x) => x.state)).toEqual(['ambiguous', 'ok']);
    expect(toTeamData(s, false)).toBeNull();
    s = setChoice(s, 0, 0);
    expect(toTeamData(s, false)!.melds).toHaveLength(2);
    expect(toTeamData(state(['3H 4H']), false)).toBeNull();
    expect(toTeamData({ melds: [] }, false)).toEqual({ melds: [] });
  });
});
