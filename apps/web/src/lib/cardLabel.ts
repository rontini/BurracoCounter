import type { Card, Rank, Suit } from '@burracount/rules';
import { t } from '../i18n';

export const SUIT_SYMBOL: Record<Suit, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };

export function isRed(card: Card): boolean {
  return card.suit === 'D' || card.suit === 'H';
}

export function rankLabel(rank: Rank): string {
  return rank === 'JOKER' ? t('card.joker') : rank;
}

/** Testo breve visibile: "10♥", "JK". */
export function cardShort(card: Card): string {
  return card.suit ? `${card.rank}${SUIT_SYMBOL[card.suit]}` : 'JK';
}

/** Etichetta per screen reader: "10 di cuori". */
export function cardName(card: Card): string {
  if (!card.suit) return t('card.joker');
  return t('card.of', { rank: card.rank, suit: t(`suit.${card.suit}`) });
}
