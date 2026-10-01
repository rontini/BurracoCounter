import type { BoundingBox, Card } from '@burracount/rules';
import type { RecognitionResult } from '@burracount/vision';
import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { cardName, cardShort, isRed } from '../lib/cardLabel';
import { newId } from '../lib/id';
import { getRecognizer } from '../vision/workerRecognizer';
import { CardPicker } from './CardPicker';
import { PhotoOverlay } from './PhotoOverlay';

/** Sotto questa confidenza la carta va controllata. */
export const LOW_CONFIDENCE = 0.5;

interface Item {
  card: Card;
  /** null per le carte aggiunte o corrette a mano. */
  confidence: number | null;
  bbox: BoundingBox | null;
}

type State =
  | { phase: 'running' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; result: RecognitionResult };

interface Props {
  photo: Blob;
  /** Testo del pulsante di conferma, es. "Aggiungi come gioco". */
  confirmLabel: string;
  onConfirm: (cards: Card[]) => void;
  onCancel: () => void;
}

export function PhotoReview({ photo, confirmLabel, onConfirm, onCancel }: Props) {
  const [state, setState] = useState<State>({ phase: 'running' });
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<number | 'new' | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRecognizer()
      .recognize(photo, newId())
      .then((result) => {
        if (cancelled) return;
        // Ordine di lettura: dall'alto in basso, da sinistra a destra.
        const sorted = [...result.detections].sort(
          (a, b) => a.bbox.y + a.bbox.x / 10 - (b.bbox.y + b.bbox.x / 10),
        );
        setItems(sorted.map((d) => ({ card: d.card, confidence: d.confidence, bbox: d.bbox })));
        setState({ phase: 'done', result });
      })
      .catch((err: Error) => !cancelled && setState({ phase: 'error', message: err.message }));
    return () => {
      cancelled = true;
    };
  }, [photo]);

  function pick(card: Card) {
    if (selected === 'new') {
      setItems((all) => [...all, { card, confidence: null, bbox: null }]);
    } else if (selected !== null) {
      setItems((all) =>
        all.map((it, i) => (i === selected ? { ...it, card, confidence: null } : it)),
      );
      setSelected(null);
    }
  }

  const result = state.phase === 'done' ? state.result : null;

  return (
    <section className="review" aria-label={t('photo.review')}>
      <h2>{t('photo.review')}</h2>
      <PhotoOverlay
        photo={photo}
        size={result}
        boxes={items.flatMap((it, i) =>
          it.bbox
            ? [
                {
                  bbox: it.bbox,
                  label: cardShort(it.card),
                  tone:
                    i === selected
                      ? 'selected'
                      : it.confidence === null
                        ? 'fixed'
                        : lowConfidence(it)
                          ? 'low'
                          : 'ok',
                } as const,
              ]
            : [],
        )}
      />

      {state.phase === 'running' && (
        <p role="status" className="muted">
          {t('photo.running')}
        </p>
      )}
      {state.phase === 'error' && (
        <p role="alert" className="error">
          {t('photo.error', { error: state.message })}
        </p>
      )}

      {result && (
        <>
          <p
            className="muted small"
            data-testid="recognition-time"
            data-total-ms={Math.round(result.timings.totalMs)}
            data-inference-ms={Math.round(result.timings.inferenceMs)}
            data-tiles={result.timings.tiles}
          >
            {t('photo.timing', {
              n: items.filter((i) => i.bbox).length,
              s: (result.timings.totalMs / 1000).toFixed(1),
              backend: result.timings.backend,
            })}
          </p>
          {items.length === 0 && <p>{t('photo.none')}</p>}
          <ul className="detections">
            {items.map((it, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={`detection${isRed(it.card) ? ' red' : ''}${lowConfidence(it) ? ' low' : ''}${i === selected ? ' selected' : ''}`}
                  data-testid="detection"
                  data-card={cardShort(it.card)}
                  data-confidence={it.confidence ?? ''}
                  aria-label={`${cardName(it.card)}${it.confidence !== null ? `, ${t('photo.confidence', { n: Math.round(it.confidence * 100) })}` : ''}`}
                  aria-pressed={i === selected}
                  onClick={() => setSelected(i === selected ? null : i)}
                >
                  <span className="card-face">{cardShort(it.card)}</span>
                  <span className="conf">
                    {it.confidence !== null ? `${Math.round(it.confidence * 100)}%` : '✓'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {lowCount(items) > 0 && (
            <p className="hint">{t('photo.lowHint', { n: lowCount(items) })}</p>
          )}

          {typeof selected === 'number' && items[selected] && (
            <div className="correction">
              <p>{t('photo.correct', { card: cardName(items[selected].card) })}</p>
              <CardPicker onPick={pick} />
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  setItems((all) => all.filter((_, i) => i !== selected));
                  setSelected(null);
                }}
              >
                {t('photo.remove')}
              </button>
            </div>
          )}

          <button
            type="button"
            className="btn secondary"
            aria-expanded={selected === 'new'}
            onClick={() => setSelected(selected === 'new' ? null : 'new')}
          >
            {selected === 'new' ? t('hand.done') : `+ ${t('photo.addMissing')}`}
          </button>
          {selected === 'new' && <CardPicker onPick={pick} />}
        </>
      )}

      <div className="row">
        <button type="button" className="btn secondary" onClick={onCancel}>
          {t('cancel')}
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!result || items.length === 0}
          onClick={() => onConfirm(items.map((i) => i.card))}
        >
          {confirmLabel}
        </button>
      </div>
    </section>
  );
}

function lowConfidence(it: Item): boolean {
  return it.confidence !== null && it.confidence < LOW_CONFIDENCE;
}

function lowCount(items: Item[]): number {
  return items.filter(lowConfidence).length;
}
