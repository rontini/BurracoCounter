import { describe, expect, it } from 'vitest';
import { cards, formatCard, parseCard } from './cards';
import { completeMeld } from './infer';
import type { Card } from './types';

/** "5H ? 7H" → [5H, null, 7H] */
const slots = (s: string): (Card | null)[] =>
  s.split(' ').map((t) => (t === '?' ? null : parseCard(t)));
const show = (cs: Card[]) => cs.map(formatCard).join(' ');
const options = (fix: ReturnType<typeof completeMeld>, i = 0) =>
  fix!.deduced[i]!.options.map(formatCard);

const ORDERED = { ordered: true, allowSetOfTwos: false };

describe('completeMeld', () => {
  it('fills the gap of a run with the missing card first, then the wilds', () => {
    const fix = completeMeld(slots('5H ? 7H'), ORDERED);
    expect(show(fix!.cards)).toBe('5H 6H 7H');
    expect(fix!.deduced).toHaveLength(1);
    expect(fix!.deduced[0]!.index).toBe(1);
    expect(options(fix)).toEqual(['6H', 'JK', '2H']);
  });

  it('extends a run only in the direction of the photo order', () => {
    const fix = completeMeld(slots('5H 6H 7H ?'), ORDERED);
    expect(options(fix)).toEqual(['8H', 'JK', '2H']);
    const down = completeMeld(slots('? 5H 6H 7H'), ORDERED);
    expect(options(down)).toEqual(['4H', 'JK', '2H']);
  });

  it('accepts runs laid in descending order', () => {
    const fix = completeMeld(slots('9S ? 7S'), ORDERED);
    expect(show(fix!.cards)).toBe('9S 8S 7S');
  });

  it('completes a set with any card of that rank or a wild', () => {
    const fix = completeMeld(slots('KH KS ?'), ORDERED);
    expect(options(fix)).toEqual(['KC', 'KD', 'KH', 'KS', 'JK', '2C']);
  });

  it('without order, a run can grow at either end', () => {
    const fix = completeMeld(slots('5H 7H ?'), { ordered: false, allowSetOfTwos: false });
    expect(options(fix)).toEqual(['6H', 'JK', '2H']);
    const end = completeMeld(slots('5H 6H ?'), { ordered: false, allowSetOfTwos: false });
    expect(options(end)).toEqual(['4H', '7H', 'JK', '2H']);
  });

  it('deduces two unknown cards', () => {
    const fix = completeMeld(slots('5H ? ? 8H'), ORDERED);
    expect(show(fix!.cards)).toBe('5H 6H 7H 8H');
    expect(options(fix, 0)).toEqual(['6H', 'JK', '2H']);
    expect(options(fix, 1)).toEqual(['7H', 'JK', '2H']);
  });

  it('returns null when nothing fits', () => {
    expect(completeMeld(slots('5H ? 9C'), ORDERED)).toBeNull();
    expect(completeMeld(slots('? ? ? 5H'), ORDERED)).toBeNull();
  });

  it('returns the meld unchanged when there is nothing to deduce', () => {
    const fix = completeMeld(slots('3C 4C 5C'), ORDERED);
    expect(show(fix!.cards)).toBe('3C 4C 5C');
    expect(fix!.deduced).toEqual([]);
    expect(completeMeld(slots('3C 9D 5C'), ORDERED)).toBeNull();
  });

  it('keeps known cards as they are', () => {
    const fix = completeMeld(cards('QD KD').concat([null as unknown as Card]), ORDERED);
    expect(options(fix)).toEqual(['AD', 'JK', '2D']);
  });
});
