import type { TeamScore } from '@burracount/rules';
import { t } from '../i18n';

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export function ScoreBreakdown({ score }: { score: TeamScore }) {
  const burrachi = score.melds.filter((m) => m.burraco);
  return (
    <dl className="breakdown">
      <dt>{t('score.meldCards')}</dt>
      <dd>{signed(score.meldCardPoints)}</dd>
      <dt>
        {t('score.burrachi')}
        {burrachi.length > 0 && (
          <small> ({burrachi.map((m) => t(`burraco.${m.burraco!}`)).join(', ')})</small>
        )}
      </dt>
      <dd>{signed(score.burracoBonus)}</dd>
      {score.closingBonus > 0 && (
        <>
          <dt>{t('score.closing')}</dt>
          <dd>{signed(score.closingBonus)}</dd>
        </>
      )}
      {score.pozzettoPenalty > 0 && (
        <>
          <dt>{t('score.pozzetto')}</dt>
          <dd>{signed(-score.pozzettoPenalty)}</dd>
        </>
      )}
      {score.handPenalty > 0 && (
        <>
          <dt>{t('score.hand')}</dt>
          <dd>{signed(-score.handPenalty)}</dd>
        </>
      )}
      <dt className="total">{t('score.total')}</dt>
      <dd className="total">{signed(score.total)}</dd>
    </dl>
  );
}
