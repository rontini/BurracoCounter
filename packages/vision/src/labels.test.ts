import { describe, expect, it } from 'vitest';
import { cardFromLabel, BASELINE_LABELS } from './labels';

describe('labels', () => {
  it('maps the baseline model classes to cards', () => {
    expect(BASELINE_LABELS).toHaveLength(52);
    expect(cardFromLabel('10C')).toEqual({ rank: '10', suit: 'C' });
    expect(cardFromLabel('AS')).toEqual({ rank: 'A', suit: 'S' });
    expect(cardFromLabel('JOKER')).toEqual({ rank: 'JOKER', suit: null });
  });

  it('covers every card exactly once', () => {
    const keys = new Set(BASELINE_LABELS.map((l) => JSON.stringify(cardFromLabel(l))));
    expect(keys.size).toBe(52);
  });

  it('rejects unknown labels', () => {
    expect(() => cardFromLabel('XX')).toThrow();
  });
});
