import { describe, expect, it } from 'vitest';
import { cards, formatCard } from './cards';
import { validateMeld, type MeldValidation } from './meld';
import type { Meld } from './types';

function ok(v: MeldValidation): Meld[] {
  if (!v.valid) throw new Error(`atteso valido: ${v.errors.map((e) => e.message).join('; ')}`);
  return v.interpretations;
}

function codes(v: MeldValidation): string[] {
  if (v.valid) throw new Error('atteso non valido');
  return v.errors.map((e) => e.code);
}

const show = (m: Meld) => m.cards.map(formatCard).join(' ');

describe('validateMeld – scale', () => {
  it('accepts a clean run in any order and sorts it', () => {
    const [m, ...rest] = ok(validateMeld(cards('5H 3H 4H')));
    expect(rest).toHaveLength(0);
    expect(m!.kind).toBe('run');
    expect(show(m!)).toBe('3H 4H 5H');
    expect(m!.wild).toBeNull();
  });

  it('accepts ace low (A-2-3) with a natural pinella', () => {
    const ms = ok(validateMeld(cards('AS 2S 3S')));
    const natural = ms.find((m) => m.wild === null);
    expect(natural && show(natural)).toBe('AS 2S 3S');
  });

  it('accepts ace high (Q-K-A)', () => {
    const [m] = ok(validateMeld(cards('KD AD QD')));
    expect(show(m!)).toBe('QD KD AD');
  });

  it('accepts a full run from ace to ace', () => {
    const [m] = ok(validateMeld(cards('AC 2C 3C 4C 5C 6C 7C 8C 9C 10C JC QC KC AC')));
    expect(m!.cards).toHaveLength(14);
    expect(m!.wild).toBeNull();
  });

  it('rejects wrap-around (K-A-2)', () => {
    expect(validateMeld(cards('KH AH 3H')).valid).toBe(false);
  });

  it('places a joker in the gap', () => {
    const [m, ...rest] = ok(validateMeld(cards('5H JK 7H')));
    expect(rest).toHaveLength(0);
    expect(show(m!)).toBe('5H JK 7H');
    expect(m!.wild).toEqual({ index: 1, represents: '6' });
  });

  it('places an off-suit pinella in the gap', () => {
    const [m] = ok(validateMeld(cards('9S 2D JS')));
    expect(show(m!)).toBe('9S 2D JS');
    expect(m!.wild).toEqual({ index: 1, represents: '10' });
  });

  it('puts an extending wild on top, or at the bottom if the top is the ace', () => {
    const [top] = ok(validateMeld(cards('5H 6H JK')));
    expect(show(top!)).toBe('5H 6H JK');
    expect(top!.wild).toEqual({ index: 2, represents: '7' });

    const [bottom] = ok(validateMeld(cards('KH AH JK')));
    expect(show(bottom!)).toBe('JK KH AH');
    expect(bottom!.wild).toEqual({ index: 0, represents: 'Q' });
  });

  it('returns both interpretations when a 2 can be natural or wild', () => {
    const ms = ok(validateMeld(cards('3H 2H 4H')));
    expect(ms).toHaveLength(2);
    expect(ms.map(show).sort()).toEqual(['2H 3H 4H', '3H 4H 2H']);
    const wild = ms.find((m) => m.wild !== null)!;
    expect(wild.wild).toEqual({ index: 2, represents: '5' });
  });

  it('with two same-suit pinelle, one is natural and the other wild', () => {
    const ms = ok(validateMeld(cards('AH 2H 2H 4H')));
    expect(ms).toHaveLength(1);
    expect(show(ms[0]!)).toBe('AH 2H 2H 4H');
    expect(ms[0]!.wild).toEqual({ index: 2, represents: '3' });
  });

  it('accepts a joker together with a natural pinella', () => {
    const ms = ok(validateMeld(cards('AD 2D JK 4D')));
    expect(ms).toHaveLength(1);
    expect(ms[0]!.wild).toEqual({ index: 2, represents: '3' });
  });

  it('rejects two wilds', () => {
    expect(codes(validateMeld(cards('5H JK JK')))).toContain('TOO_MANY_WILDS');
    expect(codes(validateMeld(cards('5H 6H 2C 2D')))).toContain('TOO_MANY_WILDS');
  });

  it('rejects mixed suits', () => {
    expect(codes(validateMeld(cards('5H 6D 7H')))).toContain('NOT_SET_OR_RUN');
  });

  it('rejects a gap larger than one wild', () => {
    expect(codes(validateMeld(cards('5H 8H JK')))).toContain('GAP');
    expect(codes(validateMeld(cards('5H 6H 8H')))).toContain('GAP');
  });

  it('rejects duplicated ranks in a run', () => {
    expect(codes(validateMeld(cards('5H 5H 6H 7H')))).toContain('DUPLICATE_RANK');
  });

  it('rejects a run with no room for the wild', () => {
    const full = 'AC 2C 3C 4C 5C 6C 7C 8C 9C 10C JC QC KC AC';
    expect(validateMeld(cards(`${full} JK`)).valid).toBe(false);
  });
});

describe('validateMeld – tris', () => {
  it('accepts a clean set of any suits, including duplicates', () => {
    const [m, ...rest] = ok(validateMeld(cards('7H 7S 7H')));
    expect(rest).toHaveLength(0);
    expect(m!.kind).toBe('set');
    expect(m!.wild).toBeNull();
  });

  it('accepts a set with a joker or a pinella, wild last', () => {
    const [j] = ok(validateMeld(cards('JK KH KS')));
    expect(show(j!)).toBe('KH KS JK');
    expect(j!.wild).toEqual({ index: 2, represents: 'K' });

    const [p] = ok(validateMeld(cards('AH 2C AS')));
    expect(p!.wild).toEqual({ index: 2, represents: 'A' });
  });

  it('rejects a set of twos unless enabled', () => {
    expect(codes(validateMeld(cards('2H 2S 2D')))).toContain('SET_OF_TWOS');
    const ms = ok(validateMeld(cards('2H 2S 2D'), { allowSetOfTwos: true }));
    expect(ms.some((m) => m.kind === 'set' && m.wild === null)).toBe(true);
  });

  it('rejects a set with two wilds', () => {
    expect(codes(validateMeld(cards('9H JK 2S')))).toContain('TOO_MANY_WILDS');
  });

  it('a 3-card meld with two naturals of equal rank and a same-suit 2 is a set', () => {
    const ms = ok(validateMeld(cards('4H 4S 2H')));
    expect(ms).toHaveLength(1);
    expect(ms[0]!.kind).toBe('set');
  });
});

describe('validateMeld – general', () => {
  it('requires at least three cards', () => {
    expect(codes(validateMeld(cards('5H 6H')))).toEqual(['TOO_FEW_CARDS']);
  });

  it('rejects only wild cards', () => {
    expect(codes(validateMeld(cards('JK 2H 2S')))).toContain('TOO_MANY_WILDS');
  });

  it('gives descriptive messages', () => {
    const v = validateMeld(cards('5H 6D 9C'));
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.errors[0]!.message).toMatch(/stesso valore|stesso seme/);
  });
});
