import { parseCard, type Detection } from '@burracount/rules';
import { describe, expect, it } from 'vitest';
import { dedupeCorners, groupTable } from './table';

/** Indice d'angolo largo 20 e alto 40 px, centrato in (cx, cy). */
function det(label: string, cx: number, cy: number, confidence = 0.9): Detection {
  return {
    card: parseCard(label),
    bbox: { x: cx - 10, y: cy - 20, width: 20, height: 40 },
    confidence,
    photoId: 'p',
  };
}

/** Ventaglio orizzontale: un indice ogni 30 px. */
function fan(labels: string[], x0: number, y: number): Detection[] {
  return labels.map((l, i) => det(l, x0 + i * 30, y));
}

const labels = (ds: Detection[]) => ds.map((d) => `${d.card.rank}${d.card.suit ?? ''}`).sort();

describe('dedupeCorners', () => {
  it('merges the two opposite corners of the same fully visible card', () => {
    // Angolo in alto a sinistra e in basso a destra (ruotato) della stessa carta.
    const { cards, merges } = dedupeCorners([det('7H', 100, 100, 0.9), det('7H', 190, 300, 0.7)]);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.confidence).toBe(0.9);
    expect(merges).toHaveLength(1);
  });

  it('keeps two identical cards side by side (double deck)', () => {
    const { cards, merges } = dedupeCorners([det('7H', 100, 100), det('7H', 130, 100)]);
    expect(cards).toHaveLength(2);
    expect(merges).toHaveLength(0);
  });

  it('keeps identical cards far apart', () => {
    const { cards } = dedupeCorners([det('KS', 100, 100), det('KS', 900, 700)]);
    expect(cards).toHaveLength(2);
  });

  it('works for cards lying sideways', () => {
    const { cards } = dedupeCorners([det('9C', 100, 100), det('9C', 300, 180)]);
    expect(cards).toHaveLength(1);
  });

  it('never merges different cards', () => {
    const { cards } = dedupeCorners([det('9C', 100, 100), det('9D', 190, 300)]);
    expect(cards).toHaveLength(2);
  });
});

describe('groupTable', () => {
  it('splits melds by distance and validates them', () => {
    const table = [
      ...fan(['3H', '4H', '5H', '6H'], 100, 100),
      ...fan(['KS', 'KD', 'KC'], 500, 100),
    ];
    const result = groupTable(table, { allowSetOfTwos: false });
    expect(result.melds).toHaveLength(2);
    expect(result.melds.map((m) => labels(m.cards))).toEqual([
      ['3H', '4H', '5H', '6H'],
      ['KC', 'KD', 'KS'],
    ]);
    expect(result.melds.every((m) => m.validation.valid)).toBe(true);
    expect(result.hand).toEqual([]);
  });

  it('puts groups that are not a valid meld among the cards in hand', () => {
    const table = [...fan(['3H', '4H', '5H'], 100, 100), ...fan(['9C', 'QD'], 100, 500)];
    const result = groupTable(table, { allowSetOfTwos: false });
    expect(result.melds).toHaveLength(1);
    expect(labels(result.hand)).toEqual(['9C', 'QD']);
  });

  it('handles melds fanned vertically', () => {
    const table = ['8D', '9D', '10D', 'JD'].map((l, i) => det(l, 100, 100 + i * 45));
    const result = groupTable(table, { allowSetOfTwos: false });
    expect(result.melds).toHaveLength(1);
    expect(result.melds[0]!.cards).toHaveLength(4);
  });

  it('dedupes before grouping and reports the merges', () => {
    // L'ultima carta del ventaglio è intera: si vede anche l'angolo opposto.
    const table = [...fan(['3H', '4H', '5H'], 100, 100), det('5H', 240, 300)];
    const result = groupTable(table, { allowSetOfTwos: false });
    expect(result.melds).toHaveLength(1);
    expect(result.melds[0]!.cards).toHaveLength(3);
    expect(result.merges).toHaveLength(1);
  });

  it('keeps ambiguous melds with every interpretation', () => {
    const result = groupTable(fan(['2H', '3H', '4H'], 100, 100), { allowSetOfTwos: false });
    expect(result.melds).toHaveLength(1);
    const v = result.melds[0]!.validation;
    expect(v.valid && v.interpretations.length).toBe(2);
  });

  it('returns nothing for an empty photo', () => {
    expect(groupTable([], { allowSetOfTwos: false })).toEqual({ melds: [], hand: [], merges: [] });
  });
});
