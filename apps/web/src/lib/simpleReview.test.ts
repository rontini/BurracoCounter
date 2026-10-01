import { cards, parseCard, type Detection } from '@burracount/rules';
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

const item = (s: string) => ({ card: parseCard(s), confidence: 0.9, bbox: null, merged: false });
const state = (melds: string[], hand: string): ReviewState => ({
  melds: melds.map((m) => ({ items: m.split(' ').map(item), choice: null })),
  hand: hand ? hand.split(' ').map(item) : [],
});
const show = (s: ReviewState) => ({
  melds: s.melds.map((m) => m.items.map((i) => `${i.card.rank}${i.card.suit}`).join(' ')),
  hand: s.hand.map((i) => `${i.card.rank}${i.card.suit}`).join(' '),
});

describe('simple review', () => {
  it('builds the state from a grouping proposal, flagging merged corners', () => {
    const det = (label: string, cx: number, cy: number): Detection => ({
      card: parseCard(label),
      bbox: { x: cx - 10, y: cy - 20, width: 20, height: 40 },
      confidence: 0.9,
      photoId: 'p',
    });
    const proposal = groupTable(
      [
        det('3H', 100, 100),
        det('4H', 130, 100),
        det('5H', 160, 100),
        det('5H', 240, 300),
        det('KS', 600, 600),
      ],
      { allowSetOfTwos: false },
    );
    const s = fromProposal(proposal);
    expect(show(s)).toEqual({ melds: ['3H 4H 5H'], hand: 'KS' });
    expect(s.melds[0]!.items.filter((i) => i.merged)).toHaveLength(1);
  });

  it('corrects, removes and adds cards', () => {
    let s = state(['3H 4H 6H'], 'KS');
    s = replaceCard(s, 0, 2, parseCard('5H'));
    expect(s.melds[0]!.items[2]!.confidence).toBeNull();
    s = removeCard(s, 'hand', 0);
    s = addCard(s, 'hand', parseCard('QD'));
    s = addCard(s, 'new', parseCard('9C'));
    expect(show(s)).toEqual({ melds: ['3H 4H 5H', '9C'], hand: 'QD' });
  });

  it('moves cards between melds and hand, dropping emptied melds', () => {
    let s = state(['3H 4H 5H', 'KS'], 'QD');
    s = moveCard(s, 1, 0, 'hand');
    expect(show(s)).toEqual({ melds: ['3H 4H 5H'], hand: 'QD KS' });
    s = moveCard(s, 'hand', 0, 'new');
    expect(show(s)).toEqual({ melds: ['3H 4H 5H', 'QD'], hand: 'KS' });
    s = moveCard(s, 0, 2, 1);
    expect(show(s)).toEqual({ melds: ['3H 4H', 'QD 5H'], hand: 'KS' });
    expect(moveCard(s, 'hand', 0, 'hand')).toBe(s);
    expect(moveCard(s, 'hand', 9, 0)).toBe(s);
  });

  it('converts to team data only when every meld is resolved', () => {
    let s = state(['2H 3H 4H', 'KS KD KC'], '9C');
    expect(statuses(s, false).map((x) => x.state)).toEqual(['ambiguous', 'ok']);
    expect(toTeamData(s, false)).toBeNull();
    s = setChoice(s, 0, 0);
    const data = toTeamData(s, false)!;
    expect(data.melds).toHaveLength(2);
    expect(data.hand).toEqual(cards('9C'));
    expect(toTeamData(state(['3H 4H'], ''), false)).toBeNull();
  });
});
