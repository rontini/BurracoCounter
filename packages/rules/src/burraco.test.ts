import { describe, expect, it } from 'vitest';
import { classifyBurraco } from './burraco';
import { cards } from './cards';
import { validateMeld } from './meld';
import { DEFAULT_RULESET } from './ruleset';
import type { Meld } from './types';

function meld(s: string, pick: (m: Meld) => boolean = () => true): Meld {
  const v = validateMeld(cards(s));
  if (!v.valid) throw new Error(v.errors.map((e) => e.message).join('; '));
  const m = v.interpretations.find(pick);
  if (!m) throw new Error('interpretazione non trovata');
  return m;
}

const R = DEFAULT_RULESET;

describe('classifyBurraco', () => {
  it('is null below seven cards', () => {
    expect(classifyBurraco(meld('3H 4H 5H 6H 7H 8H'), R)).toBeNull();
  });

  it('pulito: seven natural cards', () => {
    expect(classifyBurraco(meld('3H 4H 5H 6H 7H 8H 9H'), R)).toBe('pulito');
    expect(classifyBurraco(meld('9C 9C 9D 9H 9S 9S 9D'), R)).toBe('pulito');
  });

  it('pulito: a pinella in its natural position counts as a normal card', () => {
    expect(classifyBurraco(meld('AS 2S 3S 4S 5S 6S 7S', (m) => m.wild === null), R)).toBe(
      'pulito',
    );
  });

  it('the same cards with the pinella read as wild are not pulito', () => {
    const wild = meld('2S 3S 4S 5S 6S 7S 8S', (m) => m.wild !== null);
    expect(classifyBurraco(wild, R)).toBe('sporco');
  });

  it('sporco: seven cards with a wild', () => {
    expect(classifyBurraco(meld('3H 4H JK 6H 7H 8H 9H'), R)).toBe('sporco');
    expect(classifyBurraco(meld('3H 4H 5H 6H 7H 8H JK'), R)).toBe('sporco');
  });

  it('sporco: wild inside the run even with seven naturals', () => {
    expect(classifyBurraco(meld('3H 4H 5H 6H 7H 8H 2C 10H'), R)).toBe('sporco');
  });

  it('semipulito: seven consecutive naturals with the wild at the end', () => {
    const top = meld('3H 4H 5H 6H 7H 8H 9H JK');
    expect(top.wild?.index).toBe(7);
    expect(classifyBurraco(top, R)).toBe('semipulito');

    const bottom = meld('8D 9D 10D JD QD KD AD 2C');
    expect(bottom.wild?.index).toBe(0);
    expect(classifyBurraco(bottom, R)).toBe('semipulito');
  });

  it('semipulito: a set with seven naturals and a wild', () => {
    expect(classifyBurraco(meld('QH QH QS QS QD QD QC JK'), R)).toBe('semipulito');
  });

  it('semipulito counts as sporco when disabled', () => {
    const r = { ...R, burracoSemipulito: null };
    expect(classifyBurraco(meld('3H 4H 5H 6H 7H 8H 9H JK'), r)).toBe('sporco');
  });

  it('respects a custom minimum length', () => {
    const r = { ...R, burracoMinCards: 8 };
    expect(classifyBurraco(meld('3H 4H 5H 6H 7H 8H 9H'), r)).toBeNull();
  });
});
