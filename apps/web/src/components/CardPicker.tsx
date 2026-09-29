import { SUITS, type Card, type Rank, type Suit } from '@burracount/rules';
import { useState } from 'react';
import { t } from '../i18n';
import { SUIT_SYMBOL } from '../lib/cardLabel';

const RANKS: Exclude<Rank, 'JOKER'>[] = [
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
];

interface Props {
  onPick: (card: Card) => void;
}

/**
 * Selettore rapido: il seme resta selezionato, così una scala si inserisce
 * toccando solo i valori; per un tris si cambia seme con un tocco.
 */
export function CardPicker({ onPick }: Props) {
  const [suit, setSuit] = useState<Suit>('H');
  return (
    <div className="picker">
      <div className="picker-suits" role="radiogroup" aria-label={t('picker.suit')}>
        {SUITS.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={suit === s}
            aria-label={t(`suit.${s}`)}
            className={`suit-btn${s === 'D' || s === 'H' ? ' red' : ''}`}
            onClick={() => setSuit(s)}
          >
            {SUIT_SYMBOL[s]}
          </button>
        ))}
      </div>
      <div className="picker-ranks">
        {RANKS.map((rank) => (
          <button
            key={rank}
            type="button"
            className="rank-btn"
            aria-label={t('card.of', { rank, suit: t(`suit.${suit}`) })}
            onClick={() => onPick({ rank, suit })}
          >
            {rank}
          </button>
        ))}
        <button
          type="button"
          className="rank-btn joker"
          onClick={() => onPick({ rank: 'JOKER', suit: null })}
        >
          {t('picker.joker')}
        </button>
      </div>
    </div>
  );
}
