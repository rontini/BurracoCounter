import { formatCard, parseCard, type Detection } from '@burracount/rules';
import { describe, expect, it } from 'vitest';
import { dedupeCorners, groupTable, type ProposedMeld } from './table';

/** Indice d'angolo Modiano: largo 14 e alto 40 px, centrato in (cx, cy). */
function det(label: string, cx: number, cy: number, confidence = 0.9): Detection {
  return {
    card: parseCard(label),
    bbox: { x: cx - 7, y: cy - 20, width: 14, height: 40 },
    confidence,
    photoId: 'p',
  };
}

/** Distanze tra gli indici di una carta Modiano, in pixel (indice alto 40). */
const ACROSS = 97; // alto-sinistra → alto-destra
const DOWN = 134; // alto-sinistra → basso-sinistra

/** Ventaglio orizzontale: per ogni carta si vedono l'indice in alto e quello in basso a sinistra. */
function fan(labels: (string | [string, number])[], x0: number, y: number, step = 30): Detection[] {
  return labels.flatMap((l, i) => {
    const [label, conf] = typeof l === 'string' ? [l, 0.9] : l;
    return [det(label, x0 + i * step, y, conf), det(label, x0 + i * step, y + DOWN, conf)];
  });
}

/**
 * Colonna come sul tavolo: ogni carta copre la parte bassa della precedente e
 * se ne vedono gli indici in alto a sinistra e a destra; l'ultima è intera.
 */
function column(labels: string[], x: number, y0: number, step = 50): Detection[] {
  return labels.flatMap((label, i) => {
    const y = y0 + i * step;
    const top = [det(label, x, y), det(label, x + ACROSS, y)];
    const last = i === labels.length - 1;
    return last ? [...top, det(label, x, y + DOWN), det(label, x + ACROSS, y + DOWN)] : top;
  });
}

const show = (m: ProposedMeld) =>
  m.items.map((it) => `${formatCard(it.card)}${it.options ? '?' : ''}`).join(' ');

describe('dedupeCorners', () => {
  it('merges the four corners of the same card', () => {
    const { cards, merges } = dedupeCorners([
      det('7H', 100, 100, 0.9),
      det('7H', 100 + ACROSS, 100, 0.8),
      det('7H', 100, 100 + DOWN, 0.7),
      det('7H', 100 + ACROSS, 100 + DOWN, 0.95),
    ]);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.confidence).toBe(0.95);
    expect(merges).toHaveLength(3);
  });

  it('merges the corners of jokers and pinelle, whose index is smaller', () => {
    // Jolly: solo la stellina (indice alto 40 → angoli a 5,9 e 9,7 volte); pinella: 1,8 e 2,1.
    const joker = dedupeCorners([
      det('JK', 100, 100),
      det('JK', 100 + 237, 100),
      det('JK', 100, 100 + 388),
      det('JK', 100 + 237, 100 + 388),
    ]);
    expect(joker.cards).toHaveLength(1);
    const two = dedupeCorners([
      det('2S', 100, 100),
      det('2S', 100 + 71, 100),
      det('2S', 100, 100 + 86),
    ]);
    expect(two.cards).toHaveLength(1);
  });

  it('keeps two identical cards side by side in a fan (double deck)', () => {
    const { cards } = dedupeCorners(fan(['7H', '7H'], 100, 100));
    expect(cards).toHaveLength(2);
  });

  it('keeps identical cards far apart', () => {
    expect(dedupeCorners([det('KS', 100, 100), det('KS', 900, 700)]).cards).toHaveLength(2);
  });

  it('works for cards lying sideways', () => {
    const { cards } = dedupeCorners([det('9C', 100, 100), det('9C', 100 + DOWN, 100)]);
    expect(cards).toHaveLength(1);
  });

  it('never merges different cards', () => {
    expect(dedupeCorners([det('9C', 100, 100), det('9D', 100, 100 + DOWN)]).cards).toHaveLength(2);
  });
});

describe('groupTable', () => {
  const opts = { allowSetOfTwos: false };

  it('every group is a meld, ordered along the fan', () => {
    const result = groupTable(
      [...fan(['3H', '4H', '5H', '6H'], 100, 100), ...fan(['KS', 'KD', 'KC'], 600, 100)],
      opts,
    );
    expect(result.melds.map(show)).toEqual(['3H 4H 5H 6H', 'KS KD KC']);
    expect(result.melds.every((m) => m.valid)).toBe(true);
  });

  it('accepts runs laid in descending order', () => {
    const result = groupTable(fan(['9S', '8S', '7S'], 100, 100), opts);
    expect(result.melds[0]!.valid).toBe(true);
  });

  it('accepts a correctly read run in table order', () => {
    const result = groupTable(fan(['3H', '4H', '5H', '6H'], 100, 100), opts);
    expect(result.melds.map(show)).toEqual(['3H 4H 5H 6H']);
    expect(result.melds[0]!.valid).toBe(true);
  });

  it('deduces a misread card between two cards of a run', () => {
    const result = groupTable(fan(['5H', ['9C', 0.3], '7H'], 100, 100), opts);
    const [meld] = result.melds;
    expect(show(meld!)).toBe('5H 6H? 7H');
    expect(meld!.valid).toBe(true);
    expect(meld!.items[1]!.options!.map(formatCard)).toEqual(['6H', 'JK', '2H']);
    // La carta letta resta collegata al rilevamento, per l'overlay.
    expect(meld!.items[1]!.detection?.card).toEqual(parseCard('9C'));
  });

  it('deduces a card the model did not see at all', () => {
    const result = groupTable([...fan(['5H'], 100, 100), ...fan(['7H', '8H'], 160, 100)], opts);
    expect(show(result.melds[0]!)).toBe('5H 6H? 7H 8H');
    expect(result.melds[0]!.items[1]!.detection).toBeNull();
  });

  it('drops a spurious extra reading instead of deducing a card for it', () => {
    const result = groupTable(
      [...fan([['QS', 0.35]], 70, 100), ...fan(['5H', '6H', '7H'], 100, 100)],
      opts,
    );
    expect(result.melds.map(show)).toEqual(['5H 6H 7H']);
  });

  it('splits two melds laid too close together', () => {
    const result = groupTable(fan(['3H', '4H', '5H', 'KS', 'KD', 'KC'], 100, 100), opts);
    expect(result.melds.map(show)).toEqual(['3H 4H 5H', 'KS KD KC']);
    expect(result.melds.every((m) => m.valid)).toBe(true);
  });

  it('keeps a meld it cannot fix, marked as invalid', () => {
    const result = groupTable(fan(['5H', 'QS', '9C', '2D', 'KH'], 100, 100), opts);
    expect(result.melds).toHaveLength(1);
    expect(result.melds[0]!.valid).toBe(false);
    expect(result.melds[0]!.items.every((it) => it.options === null)).toBe(true);
  });

  it('reports the corners merged into one card', () => {
    const result = groupTable(fan(['3H', '4H', '5H'], 100, 100), opts);
    expect(result.merges).toHaveLength(3);
  });

  it('keeps side by side columns apart, even when they nearly touch', () => {
    const result = groupTable(
      [
        ...column(['3D', '4D', '5D'], 100, 100),
        ...column(['JS', 'QS', 'KS'], 100 + ACROSS + 30, 100),
      ],
      opts,
    );
    expect(result.melds.map(show)).toEqual(['3D 4D 5D', 'JS QS KS']);
  });

  it('keeps a column together when the cards are not perfectly aligned', () => {
    const dets = column(['7S', '7C', '7S'], 100, 100).map((d, i) => ({
      ...d,
      bbox: { ...d.bbox, x: d.bbox.x + (i % 4 < 2 ? 0 : 1) * 25 },
    }));
    expect(groupTable(dets, opts).melds.map(show)).toEqual(['7S 7C 7S']);
  });

  it('does not merge two equal cards of the same meld into one (double deck)', () => {
    // Tris di 3 con due 3♣: tra l'indice in basso del primo e quelli in alto del
    // secondo si vedono gli indici dei 3♥, quindi non sono la stessa carta.
    const result = groupTable(column(['3C', '3H', '3H', '3C'], 100, 100, 45), opts);
    expect(result.melds.map(show)).toEqual(['3C 3H 3H 3C']);
  });

  it('ignores the star of a pinella read on its own and tiny false readings', () => {
    const star = { ...det('JK', 100, 105), bbox: { x: 94, y: 105, width: 12, height: 12 } };
    const speck = { ...det('9S', 400, 400, 0.9), bbox: { x: 398, y: 398, width: 4, height: 6 } };
    const result = groupTable([...column(['2C', '5C', '6C'], 100, 100), star, speck], opts);
    expect(result.melds.map(show)).toEqual(['2C 5C 6C']);
  });

  it('joins the corners of a 6 whose upside-down corners were read as 9', () => {
    const dets = [
      det('6D', 100, 100),
      det('6D', 100 + ACROSS, 100),
      det('9D', 100, 100 + DOWN, 0.8),
      det('9D', 100 + ACROSS, 100 + DOWN, 0.8),
    ];
    const { cards } = dedupeCorners(dets);
    expect(cards.map((c) => formatCard(c.card))).toEqual(['6D']);
  });

  it('drops a lone card read with low confidence', () => {
    const result = groupTable(
      [...column(['5H', '6H', '7H'], 100, 100), det('QD', 900, 900, 0.3)],
      opts,
    );
    expect(result.melds.map(show)).toEqual(['5H 6H 7H']);
  });

  it('returns nothing for an empty photo', () => {
    expect(groupTable([], opts)).toEqual({ melds: [], merges: [] });
  });
});
