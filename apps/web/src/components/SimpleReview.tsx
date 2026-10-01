import { classifyBurraco, type Card, type RuleSet } from '@burracount/rules';
import { groupTable, type RecognitionResult } from '@burracount/vision';
import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { cardName, cardShort, isRed } from '../lib/cardLabel';
import { describeMeld } from '../lib/describeMeld';
import type { MeldDraft } from '../lib/handDraft';
import { newId } from '../lib/id';
import {
  addCard,
  fromProposal,
  moveCard,
  removeCard,
  replaceCard,
  setChoice,
  statuses,
  toTeamData,
  type ReviewItem,
  type ReviewState,
  type Where,
} from '../lib/simpleReview';
import { getRecognizer } from '../vision/workerRecognizer';
import { CardPicker } from './CardPicker';
import { LOW_CONFIDENCE } from './PhotoReview';
import { PhotoOverlay, type OverlayBox } from './PhotoOverlay';

interface Props {
  photo: Blob;
  rules: RuleSet;
  onConfirm: (data: { melds: MeldDraft[]; hand: Card[] }) => void;
  onCancel: () => void;
}

type Selection = { where: Where; index: number } | { adding: Where | 'new' } | null;

const isLow = (it: ReviewItem) => it.confidence !== null && it.confidence < LOW_CONFIDENCE;

/**
 * Revisione della modalità semplice: la foto di squadra diventa giochi
 * proposti più carte in mano; ogni carta si corregge, sposta o toglie.
 */
export function SimpleReview({ photo, rules, onConfirm, onCancel }: Props) {
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewState>({ melds: [], hand: [] });
  const [sel, setSel] = useState<Selection>(null);
  const allowTwos = rules.allowSetOfTwos;

  useEffect(() => {
    let cancelled = false;
    getRecognizer()
      .recognize(photo, newId())
      .then((r) => {
        if (cancelled) return;
        setReview(fromProposal(groupTable(r.detections, { allowSetOfTwos: allowTwos })));
        setResult(r);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [photo, allowTwos]);

  const status = statuses(review, allowTwos);
  const data = toTeamData(review, allowTwos);
  const selected = sel && 'index' in sel ? sel : null;
  const selectedItem = selected
    ? selected.where === 'hand'
      ? review.hand[selected.index]
      : review.melds[selected.where]?.items[selected.index]
    : undefined;

  function pick(card: Card) {
    if (!sel) return;
    if ('adding' in sel) {
      setReview((r) => addCard(r, sel.adding, card));
      // Dopo la prima carta, le successive vanno nel gioco appena creato.
      if (sel.adding === 'new') setSel({ adding: review.melds.length });
    } else {
      setReview((r) => replaceCard(r, sel.where, sel.index, card));
      setSel(null);
    }
  }

  const boxes: OverlayBox[] = [];
  const pushBoxes = (items: ReviewItem[], where: Where) =>
    items.forEach((it, i) => {
      if (!it.bbox) return;
      const isSel = selected?.where === where && selected.index === i;
      boxes.push({
        bbox: it.bbox,
        label: `${where === 'hand' ? '✋' : where + 1}·${cardShort(it.card)}`,
        tone: isSel ? 'selected' : isLow(it) ? 'low' : where === 'hand' ? 'hand' : 'ok',
      });
    });
  review.melds.forEach((m, w) => pushBoxes(m.items, w));
  pushBoxes(review.hand, 'hand');

  const chips = (items: ReviewItem[], where: Where) => (
    <div className="chips">
      {items.map((it, i) => {
        const isSel = selected?.where === where && selected.index === i;
        return (
          <button
            key={i}
            type="button"
            className={`detection${isRed(it.card) ? ' red' : ''}${isLow(it) ? ' low' : ''}${isSel ? ' selected' : ''}`}
            data-testid="simple-card"
            data-card={cardShort(it.card)}
            aria-pressed={isSel}
            aria-label={cardName(it.card)}
            onClick={() => setSel(isSel ? null : { where, index: i })}
          >
            <span className="card-face">{cardShort(it.card)}</span>
            <span className="conf">
              {it.merged ? '⧉ ' : ''}
              {it.confidence !== null ? `${Math.round(it.confidence * 100)}%` : '✓'}
            </span>
          </button>
        );
      })}
      {items.length === 0 && <span className="muted">{t('hand.noCards')}</span>}
    </div>
  );

  const addButton = (where: Where | 'new', label: string) => {
    const active = sel !== null && 'adding' in sel && sel.adding === where;
    return (
      <>
        <button
          type="button"
          className="btn ghost small"
          aria-expanded={active}
          onClick={() => setSel(active ? null : { adding: where })}
        >
          {active ? t('hand.done') : `+ ${label}`}
        </button>
        {active && <CardPicker onPick={pick} />}
      </>
    );
  };

  return (
    <section className="review" aria-label={t('photo.review')}>
      <h2>{t('photo.review')}</h2>
      <PhotoOverlay photo={photo} size={result} boxes={boxes} />
      {!result && !error && (
        <p role="status" className="muted">
          {t('photo.running')}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {t('photo.error', { error })}
        </p>
      )}

      {result && (
        <>
          <p className="muted small" data-testid="recognition-time">
            {t('photo.timing', {
              n: result.detections.length,
              s: (result.timings.totalMs / 1000).toFixed(1),
              backend: result.timings.backend,
            })}
          </p>
          <p className="hint">{t('simple.reviewHint')}</p>

          {review.melds.map((m, w) => {
            const st = status[w]!;
            const burraco = st.state === 'ok' ? classifyBurraco(st.meld, rules) : null;
            return (
              <div
                key={w}
                className={`meld${st.state === 'ok' ? '' : ' problem'}`}
                data-testid="simple-meld"
              >
                <div className="meld-head">
                  <strong>
                    {t('hand.meld', { n: w + 1 })}
                    {st.state === 'ok' &&
                      ` · ${st.meld.kind === 'run' ? t('hand.run') : t('hand.set')}`}
                    {burraco && ` · ${t('simple.burraco', { kind: t(`burraco.${burraco}`) })}`}
                  </strong>
                </div>
                {chips(m.items, w)}
                {st.state === 'invalid' && (
                  <p className="error">{st.errors.map((e) => e.message).join(' ')}</p>
                )}
                {(st.state === 'ambiguous' ||
                  (st.state === 'ok' && st.interpretations.length > 1)) && (
                  <fieldset className="ambiguity">
                    <legend>{t('hand.ambiguous')}</legend>
                    {st.interpretations.map((interp, k) => (
                      <label key={k} className="toggle">
                        <input
                          type="radio"
                          name={`simple-meld-${w}`}
                          checked={m.choice === k}
                          onChange={() => setReview((r) => setChoice(r, w, k))}
                        />
                        <span>{describeMeld(interp)}</span>
                      </label>
                    ))}
                  </fieldset>
                )}
                {addButton(w, t('simple.addCard'))}
              </div>
            );
          })}

          <div className="player-hand" data-testid="simple-hand">
            <h2>{t('simple.inHand')}</h2>
            {chips(review.hand, 'hand')}
            {addButton('hand', t('simple.addCard'))}
          </div>
          {addButton('new', t('simple.newMeld'))}

          {selected && selectedItem && (
            <div className="correction">
              <p>{t('photo.correct', { card: cardName(selectedItem.card) })}</p>
              <CardPicker onPick={pick} />
              <div className="row">
                {review.melds.map((_, w) =>
                  w === selected.where ? null : (
                    <button
                      key={w}
                      type="button"
                      className="btn secondary small"
                      onClick={() => {
                        setReview((r) => moveCard(r, selected.where, selected.index, w));
                        setSel(null);
                      }}
                    >
                      → {t('hand.meld', { n: w + 1 })}
                    </button>
                  ),
                )}
                {selected.where !== 'hand' && (
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => {
                      setReview((r) => moveCard(r, selected.where, selected.index, 'hand'));
                      setSel(null);
                    }}
                  >
                    → {t('simple.inHand')}
                  </button>
                )}
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => {
                    setReview((r) => moveCard(r, selected.where, selected.index, 'new'));
                    setSel(null);
                  }}
                >
                  → {t('simple.newMeld')}
                </button>
                <button
                  type="button"
                  className="btn danger small"
                  onClick={() => {
                    setReview((r) => removeCard(r, selected.where, selected.index));
                    setSel(null);
                  }}
                >
                  {t('photo.remove')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {result && !data && <p className="error">{t('hand.problems')}</p>}
      <div className="row">
        <button type="button" className="btn secondary" onClick={onCancel}>
          {t('cancel')}
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!data}
          onClick={() => data && onConfirm(data)}
        >
          {t('simple.confirmTeam')}
        </button>
      </div>
    </section>
  );
}
