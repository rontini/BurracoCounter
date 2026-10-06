import { scoreHand, type Match } from '@burracount/rules';
import { useId, useState } from 'react';
import { ModelStatusLine } from '../components/ModelStatusLine';
import { PhotoInput } from '../components/PhotoInput';
import { ScoreBreakdown } from '../components/ScoreBreakdown';
import { SimpleReview } from '../components/SimpleReview';
import { t } from '../i18n';
import { emptyDrafts, toHandResult, type MeldDraft, type TeamDraft } from '../lib/handDraft';
import { href, navigate } from '../lib/router';
import { saveHand } from '../lib/saveHand';
import type { ModelStatus } from '../lib/useModelStatus';

type TeamData = { melds: MeldDraft[] };

/**
 * Modalità semplice: una foto dei giochi calati per squadra, i punti delle
 * carte in mano scritti a mano (facoltativi), un tocco per chi ha chiuso,
 * pozzetto preso salvo indicazione contraria.
 */
export function SimpleHandForm({
  match,
  model,
  onSwitchToFull,
}: {
  match: Match;
  model: ModelStatus;
  onSwitchToFull: (drafts: TeamDraft[]) => void;
}) {
  const handNumber = match.hands.length + 1;
  const [data, setData] = useState<(TeamData | null)[]>(() => match.teams.map(() => null));
  const [reviewing, setReviewing] = useState<{ team: number; photo: Blob } | null>(null);
  const [closedBy, setClosedBy] = useState<string | null>(null);
  const [noPozzetto, setNoPozzetto] = useState<Set<string>>(new Set());
  const [handPoints, setHandPoints] = useState<Record<string, string>>({});
  const pointsId = useId();

  const drafts: TeamDraft[] = emptyDrafts(match).map((d, i) => {
    const team = data[i];
    return {
      ...d,
      melds: team?.melds ?? [],
      hands: d.hands.map(() => []),
      handPoints: Math.max(0, Number(handPoints[d.teamId]) || 0),
      closed: closedBy === d.teamId,
      pozzettoTaken: !noPozzetto.has(d.teamId),
    };
  });
  const complete = data.every((d) => d !== null) && closedBy !== null;
  const result = complete ? toHandResult(drafts, match.ruleSet.allowSetOfTwos) : null;

  async function save() {
    if (!result) return;
    await saveHand(match, result);
    navigate({ name: 'match', id: match.id });
  }

  if (reviewing) {
    return (
      <div className="screen">
        <header className="bar">
          <h1>{match.teams[reviewing.team]!.name}</h1>
        </header>
        <SimpleReview
          photo={reviewing.photo}
          rules={match.ruleSet}
          onCancel={() => setReviewing(null)}
          onConfirm={(d) => {
            setData((all) => all.map((x, i) => (i === reviewing.team ? d : x)));
            setReviewing(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="bar">
        <a className="btn ghost" href={href({ name: 'match', id: match.id })}>
          ← {t('back')}
        </a>
        <h1>{t('hand.title', { n: handNumber })}</h1>
      </header>
      <ModelStatusLine status={model} />

      {match.teams.map((team, i) => {
        const d = data[i];
        return (
          <section key={team.id} className="simple-team" aria-label={team.name}>
            <h2>{team.name}</h2>
            {d ? (
              <p data-testid={`simple-summary-${team.id}`}>
                {t('simple.teamSummary', { melds: d.melds.length })}
              </p>
            ) : (
              <p className="muted">{t('simple.photoHint')}</p>
            )}
            <PhotoInput
              label={t('simple.photo', { name: team.name })}
              onPhoto={(photo) => setReviewing({ team: i, photo })}
            />
            <div className="field inline">
              <label htmlFor={`${pointsId}-${team.id}`}>{t('simple.handPoints')}</label>
              <input
                id={`${pointsId}-${team.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                value={handPoints[team.id] ?? ''}
                onChange={(e) => setHandPoints((h) => ({ ...h, [team.id]: e.target.value }))}
              />
            </div>
            <p className="hint">{t('simple.handPointsHelp')}</p>
          </section>
        );
      })}

      <fieldset>
        <legend>{t('simple.whoClosed')}</legend>
        <div className="segmented wrap">
          {[
            ...match.teams.map((tm) => ({ id: tm.id, name: tm.name })),
            { id: 'none', name: t('simple.nobody') },
          ].map((opt) => (
            <label key={opt.id} className={closedBy === opt.id ? 'selected' : ''}>
              <input
                type="radio"
                name="closed-by"
                checked={closedBy === opt.id}
                onChange={() => setClosedBy(opt.id)}
              />
              {opt.name}
            </label>
          ))}
        </div>
      </fieldset>

      <details>
        <summary>{t('simple.pozzettoQuestion')}</summary>
        {match.teams.map((team) => (
          <label key={team.id} className="toggle">
            <input
              type="checkbox"
              checked={noPozzetto.has(team.id)}
              onChange={(e) =>
                setNoPozzetto((s) => {
                  const next = new Set(s);
                  if (e.target.checked) next.add(team.id);
                  else next.delete(team.id);
                  return next;
                })
              }
            />
            <span>{t('simple.noPozzetto', { name: team.name })}</span>
          </label>
        ))}
      </details>

      {result &&
        scoreHand(result, match.ruleSet).map((s) => (
          <div key={s.teamId} className="summary-team">
            <h2>{match.teams.find((x) => x.id === s.teamId)?.name}</h2>
            <ScoreBreakdown score={s} />
          </div>
        ))}

      <button type="button" className="btn primary big" disabled={!result} onClick={save}>
        {t('hand.saveHand')}
      </button>
      <button type="button" className="btn ghost" onClick={() => onSwitchToFull(drafts)}>
        {t('simple.switchToFull')}
      </button>
    </div>
  );
}
