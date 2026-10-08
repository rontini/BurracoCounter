import {
  DEFAULT_RULESET,
  formatCard,
  parseCard,
  scoreTeam,
  sumCards,
  validateMeld,
  type Card,
  type Detection,
  type Meld,
} from '@burracount/rules';
import { describe, expect, it } from 'vitest';
import detectionsJson from '../../../ml/eval/tables_detections.json';
import truthJson from '../../../ml/eval/tables_truth.json';
import { cardFromLabel } from './labels';
import { groupTable } from './table';

/**
 * Misura deduplica e raggruppamento sulle 13 foto vere di tavoli
 * (ml/photos/tables), contro i giochi veri letti a mano
 * (ml/eval/tables_truth.json). I rilevamenti del modello sono salvati in
 * ml/eval/tables_detections.json: si rigenerano con ml/eval/predict_photo.py
 * quando cambia il modello.
 */

interface Truth {
  size: [number, number];
  melds: string[];
  hidden?: { meld: number; options: string[] }[];
  ignore?: [number, number, number, number][];
}

const MIN = { cards: 377, melds: 76, photos: 3 };
const MAX_EXTRA = 16;

type RawDetection = { label: string; score: number; box: [number, number, number, number] };

const truths = Object.entries(truthJson).filter(([k]) => k.startsWith('IMG')) as [string, Truth][];
const detections = detectionsJson as unknown as Record<string, RawDetection[]>;

function toDetections(photo: string, truth: Truth): Detection[] {
  const [w, h] = truth.size;
  return detections[photo]!.filter(({ box }) => {
    const cx = (box[0] + box[2]) / 2 / w;
    const cy = (box[1] + box[3]) / 2 / h;
    return !(truth.ignore ?? []).some(
      ([x0, y0, x1, y1]) => cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1,
    );
  }).map(({ label, score, box }) => ({
    card: cardFromLabel(label),
    bbox: { x: box[0], y: box[1], width: box[2] - box[0], height: box[3] - box[1] },
    confidence: score,
    photoId: photo,
  }));
}

const key = (cards: Card[]) => cards.map(formatCard).sort().join(' ');

/** Carte in comune tra due multinsiemi. */
function common(a: Card[], b: Card[]): number {
  const left = new Map<string, number>();
  for (const c of a) left.set(formatCard(c), (left.get(formatCard(c)) ?? 0) + 1);
  let n = 0;
  for (const c of b) {
    const k = formatCard(c);
    if ((left.get(k) ?? 0) > 0) {
      left.set(k, left.get(k)! - 1);
      n++;
    }
  }
  return n;
}

/** Punti dei giochi: un gioco non valido vale solo le sue carte (la UI lo farebbe correggere). */
function meldPoints(melds: Card[][]): number {
  const valid: Meld[] = [];
  let loose = 0;
  for (const cards of melds) {
    const v = validateMeld(cards, DEFAULT_RULESET);
    if (v.valid) valid.push(v.interpretations[0]!);
    else loose += sumCards(cards, DEFAULT_RULESET.cardValues);
  }
  const team = scoreTeam(
    { teamId: 't', melds: valid, hands: [], closed: false, pozzettoTaken: true },
    DEFAULT_RULESET,
  );
  return team.total + loose;
}

interface Row {
  photo: string;
  cards: number;
  found: number;
  extra: number;
  melds: number;
  exactMelds: number;
  /** Punti veri: più di un valore se le carte coperte possono essere diverse. */
  truthPoints: number[];
  points: number;
}

function evaluate(photo: string, truth: Truth): Row {
  const visible = truth.melds.map((m) => m.split(' ').map(parseCard));
  // Tutte le combinazioni possibili delle carte coperte.
  const completions = (truth.hidden ?? []).reduce(
    (acc, h) =>
      acc.flatMap((melds) =>
        h.options.map((o) => melds.map((m, i) => (i === h.meld ? [...m, parseCard(o)] : m))),
      ),
    [visible],
  );
  const proposal = groupTable(toDetections(photo, truth), DEFAULT_RULESET);
  const proposed = proposal.melds.map((m) => m.items.map((it) => it.card));
  const seen = proposal.melds.flatMap((m) =>
    m.items.filter((it) => it.detection).map((it) => it.card),
  );

  const truthCards = visible.flat();
  const found = common(truthCards, seen);
  const keys = new Set(proposed.map(key));
  // Una carta coperta conta giusta qualunque delle sue identità possibili sia stata dedotta.
  const variants = (i: number): string[] =>
    (truth.hidden ?? [])
      .filter((h) => h.meld === i)
      .reduce(
        (acc, h) => acc.flatMap((cards) => h.options.map((o) => [...cards, parseCard(o)])),
        [visible[i]!],
      )
      .map(key);
  return {
    photo,
    cards: truthCards.length,
    found,
    extra: seen.length - found,
    melds: visible.length,
    exactMelds: visible.filter((m, i) => keys.has(key(m)) || variants(i).some((k) => keys.has(k)))
      .length,
    truthPoints: [...new Set(completions.map(meldPoints))],
    points: meldPoints(proposed),
  };
}

describe('foto vere di tavoli', () => {
  const rows = truths.map(([photo, truth]) => evaluate(photo, truth));

  const sum = (f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0);
  const exact = rows.filter((r) => r.truthPoints.includes(r.points)).length;

  it('riepilogo', () => {
    const lines = rows.map(
      (r) =>
        `${r.photo}  carte ${r.found}/${r.cards} (+${r.extra})  giochi ${r.exactMelds}/${r.melds}  punti ${r.points} su ${r.truthPoints.join(' o ')}`,
    );
    lines.push(
      `TOTALE  carte ${sum((r) => r.found)}/${sum((r) => r.cards)} (+${sum((r) => r.extra)})  giochi ${sum((r) => r.exactMelds)}/${sum((r) => r.melds)}  foto con punti esatti ${exact}/${rows.length}`,
    );
    console.log(lines.join('\n'));
    expect(rows).toHaveLength(13);
  });

  // Soglie al livello raggiunto: una modifica che peggiora il raggruppamento ferma la CI.
  it('non peggiora', () => {
    expect(sum((r) => r.found)).toBeGreaterThanOrEqual(MIN.cards);
    expect(sum((r) => r.extra)).toBeLessThanOrEqual(MAX_EXTRA);
    expect(sum((r) => r.exactMelds)).toBeGreaterThanOrEqual(MIN.melds);
    expect(exact).toBeGreaterThanOrEqual(MIN.photos);
  });
});
