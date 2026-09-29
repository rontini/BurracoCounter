import type { Card } from '@burracount/rules';
import { cardName, cardShort, isRed } from '../lib/cardLabel';
import { t } from '../i18n';

interface Props {
  card: Card;
  wild?: boolean;
  onRemove?: () => void;
}

export function CardChip({ card, wild = false, onRemove }: Props) {
  const className = `card-chip${isRed(card) ? ' red' : ''}${wild ? ' wild' : ''}`;
  if (!onRemove) {
    return (
      <span className={className} aria-label={cardName(card)}>
        {cardShort(card)}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={className}
      aria-label={t('picker.remove', { card: cardName(card) })}
      onClick={onRemove}
    >
      {cardShort(card)}
    </button>
  );
}
