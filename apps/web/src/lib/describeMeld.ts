import type { Meld } from '@burracount/rules';
import { t } from '../i18n';
import { cardShort } from './cardLabel';

/** "Scala: 2♥ 3♥ 4♥ (pinella naturale)" — per scegliere tra interpretazioni. */
export function describeMeld(meld: Meld): string {
  const kind = meld.kind === 'run' ? t('hand.run') : t('hand.set');
  const cards = meld.cards.map(cardShort).join(' ');
  const note = meld.wild
    ? t('hand.wildAs', { rank: meld.wild.represents })
    : meld.cards.some((c) => c.rank === '2')
      ? t('hand.natural')
      : '';
  return `${kind}: ${cards}${note ? ` (${note})` : ''}`;
}
