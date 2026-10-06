import { classifyBurraco, formatCard, type RuleSet } from '@burracount/rules';
import { groupTable, type RecognitionResult } from '@burracount/vision';
import type { Card } from '@burracount/rules';
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
} from '../lib/simpleReview';
import { getRecognizer } from '../vision/workerRecognizer';
import { CardPicker } from './CardPicker';
import { LOW_CONFIDENCE } from './PhotoReview';
import { PhotoOverlay, type OverlayBox } from './PhotoOverlay';

interface Props {
  photo: Blob;
  rules: RuleSet;
  onConfirm: (data: { melds: MeldDraft[] }) => void;
  onCancel: () => void;
}

type Selection = { meld: number; index: number } | { adding: number | 'new' } | null;

const isLow = (it: ReviewItem) => it.confidence !== null && it.confidence < LOW_CONFIDENCE;
const optionLabel = (c: Card) => (c.rank === 'JOKER' ? t('picker.joker') : cardShort(c));

/**
 * Revisione della modalità semplice: la foto dei giochi calati diventa una
 * lista di giochi. Le carte lette male tra due carte di una scala (o in un
 * tris) vengono dedotte e mostrate con le alternative.
 */
export function SimpleReview({ photo, rules, onConfirm, onCancel }: Props) {
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewState>({ melds: [] });
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
  const selectedItem = selected ? review.melds[selected.meld]?.items[selected.index] : undefined;
  const deducedCount = review.melds.flatMap((m) => m.items).filter((i) => i.options).length;

  function pick(card: Card) {
    if (!sel) return;
    if ('adding' in sel) {
      setReview((r) => addCard(r, sel.adding, card));
      // Dopo la prima carta, le successive vanno nel gioco appena creato.
      if (sel.adding === 'new') setSel({ adding: review.melds.length });
    } else {
      setReview((r) => replaceCard(r, sel.meld, sel.index, card));
      setSel(null);
    }
  }

  const boxes: OverlayBox[] = review.melds.flatMap((m, w) =>
    m.items.flatMap((it, i) =>
      it.bbox
        ? [
            {
              bbox: it.bbox,
              label: `${w + 1}·${cardShort(it.card)}`,
              tone:
                selected?.meld === w && selected.index === i
                  ? 'selected'
                  : it.options || isLow(it)
                    ? 'low'
                    : 'ok',
            } as OverlayBox,
          ]
        : [],
    ),
  );

  const addButton = (where: number | 'new', label: string) => {
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
          {deducedCount > 0 && (
            <p className="hint">{t('simple.deducedHint', { n: deducedCount })}</p>
          )}
          {review.melds.length === 0 && <p>{t('photo.none')}</p>}

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
                <div className="chips">
                  {m.items.map((it, i) => {
                    const isSel = selected?.meld === w && selected.index === i;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`detection${isRed(it.card) ? ' red' : ''}${isLow(it) ? ' low' : ''}${it.options ? ' deduced' : ''}${isSel ? ' selected' : ''}`}
                        data-testid="simple-card"
                        data-card={cardShort(it.card)}
                        data-deduced={it.options ? 'true' : undefined}
                        aria-pressed={isSel}
                        aria-label={`${cardName(it.card)}${it.options ? `, ${t('simple.deducedShort')}` : ''}`}
                        onClick={() => setSel(isSel ? null : { meld: w, index: i })}
                      >
                        <span className="card-face">{cardShort(it.card)}</span>
                        <span className="conf">
                          {it.options
                            ? t('simple.deducedShort')
                            : `${it.merged ? '⧉ ' : ''}${it.confidence !== null ? `${Math.round(it.confidence * 100)}%` : '✓'}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
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

          {addButton('new', t('simple.newMeld'))}

          {selected && selectedItem && (
            <div className="correction">
              {selectedItem.options ? (
                <>
                  <p>{t('simple.deducedChoose')}</p>
                  <div className="row" role="group" aria-label={t('simple.deducedChoose')}>
                    {selectedItem.options.map((o) => (
                      <button
                        key={formatCard(o)}
                        type="button"
                        className={`btn ${formatCard(o) === formatCard(selectedItem.card) ? 'primary' : 'secondary'} small`}
                        onClick={() => {
                          setReview((r) => replaceCard(r, selected.meld, selected.index, o));
                          setSel(null);
                        }}
                      >
                        {optionLabel(o)}
                      </button>
                    ))}
                  </div>
                  <p className="muted small">{t('simple.otherCard')}</p>
                </>
              ) : (
                <p>{t('photo.correct', { card: cardName(selectedItem.card) })}</p>
              )}
              <CardPicker onPick={pick} />
              <div className="row">
                {review.melds.map((_, w) =>
                  w === selected.meld ? null : (
                    <button
                      key={w}
                      type="button"
                      className="btn secondary small"
                      onClick={() => {
                        setReview((r) => moveCard(r, selected.meld, selected.index, w));
                        setSel(null);
                      }}
                    >
                      → {t('hand.meld', { n: w + 1 })}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => {
                    setReview((r) => moveCard(r, selected.meld, selected.index, 'new'));
                    setSel(null);
                  }}
                >
                  → {t('simple.newMeld')}
                </button>
                <button
                  type="button"
                  className="btn danger small"
                  onClick={() => {
                    setReview((r) => removeCard(r, selected.meld, selected.index));
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
