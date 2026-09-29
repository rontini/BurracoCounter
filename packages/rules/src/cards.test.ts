import { describe, expect, it } from 'vitest';
import { DEFAULT_RULESET } from './ruleset';
import { cardValue, cards, formatCard, isWildCandidate, parseCard, sameCard } from './cards';

const values = DEFAULT_RULESET.cardValues;

describe('parseCard / formatCard', () => {
  it('parses ranks and suits', () => {
    expect(parseCard('10H')).toEqual({ rank: '10', suit: 'H' });
    expect(parseCard('AS')).toEqual({ rank: 'A', suit: 'S' });
    expect(parseCard('2c')).toEqual({ rank: '2', suit: 'C' });
    expect(parseCard('JK')).toEqual({ rank: 'JOKER', suit: null });
    expect(parseCard('jolly')).toEqual({ rank: 'JOKER', suit: null });
  });

  it('rejects invalid notation', () => {
    expect(() => parseCard('1H')).toThrow(/Carta non valida/);
    expect(() => parseCard('10X')).toThrow(/Carta non valida/);
    expect(() => parseCard('')).toThrow(/Carta non valida/);
  });

  it('round-trips', () => {
    for (const s of ['AS', '2C', '10D', 'KH', 'JK']) {
      expect(formatCard(parseCard(s))).toBe(s);
    }
  });

  it('parses a space-separated list', () => {
    expect(cards('3H  4H 5H')).toHaveLength(3);
    expect(cards('')).toEqual([]);
  });
});

describe('cardValue', () => {
  it('uses the default values', () => {
    expect(cardValue(parseCard('3H'), values)).toBe(5);
    expect(cardValue(parseCard('7S'), values)).toBe(5);
    expect(cardValue(parseCard('8S'), values)).toBe(10);
    expect(cardValue(parseCard('10D'), values)).toBe(10);
    expect(cardValue(parseCard('KC'), values)).toBe(10);
    expect(cardValue(parseCard('AH'), values)).toBe(15);
    expect(cardValue(parseCard('2H'), values)).toBe(20);
    expect(cardValue(parseCard('JK'), values)).toBe(30);
  });

  it('follows a custom rule set', () => {
    expect(cardValue(parseCard('JK'), { ...values, joker: 50 })).toBe(50);
  });
});

describe('helpers', () => {
  it('identifies wild candidates', () => {
    expect(isWildCandidate(parseCard('JK'))).toBe(true);
    expect(isWildCandidate(parseCard('2D'))).toBe(true);
    expect(isWildCandidate(parseCard('3D'))).toBe(false);
  });

  it('compares cards', () => {
    expect(sameCard(parseCard('5H'), parseCard('5H'))).toBe(true);
    expect(sameCard(parseCard('5H'), parseCard('5D'))).toBe(false);
  });
});
