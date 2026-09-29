import type { Card, CardValues, Rank, Suit } from './types';

export const SUITS: readonly Suit[] = ['C', 'D', 'H', 'S'];

export const RANKS: readonly Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'JOKER',
];

const NOTATION = /^(10|[2-9AJQK])([CDHS])$/;

/** Legge una carta in notazione breve: `10H`, `AS`, `2C`, `JK` (jolly). */
export function parseCard(text: string): Card {
  const s = text.trim().toUpperCase();
  if (s === 'JK' || s === 'JOKER' || s === 'JOLLY') return { rank: 'JOKER', suit: null };
  const m = NOTATION.exec(s);
  if (!m) throw new Error(`Carta non valida: "${text}"`);
  return { rank: m[1] as Rank, suit: m[2] as Suit };
}

/** Legge una lista di carte separate da spazi. */
export function cards(text: string): Card[] {
  return text.split(/\s+/).filter(Boolean).map(parseCard);
}

export function formatCard(card: Card): string {
  return card.rank === 'JOKER' ? 'JK' : `${card.rank}${card.suit}`;
}

export function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

/** Jolly e pinelle possono fare da matta. */
export function isWildCandidate(card: Card): boolean {
  return card.rank === 'JOKER' || card.rank === '2';
}

export function cardValue(card: Card, values: CardValues): number {
  switch (card.rank) {
    case 'JOKER':
      return values.joker;
    case '2':
      return values.pinella;
    case 'A':
      return values.ace;
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
      return values.low;
    default:
      return values.high;
  }
}

export function sumCards(list: readonly Card[], values: CardValues): number {
  return list.reduce((sum, c) => sum + cardValue(c, values), 0);
}
