import type { BoundingBox, Card } from '@burracount/rules';
import type { TableProposal } from '@burracount/vision';
import { meldStatus, type MeldDraft, type MeldStatus } from './handDraft';

export interface ReviewItem {
  card: Card;
  /** null per le carte corrette o aggiunte a mano. */
  confidence: number | null;
  bbox: BoundingBox | null;
  /** Ottenuta fondendo due angoli: da controllare. */
  merged: boolean;
}

export interface ReviewState {
  melds: { items: ReviewItem[]; choice: number | null }[];
  hand: ReviewItem[];
}

/** Dove si trova una carta: un gioco (indice) o le carte in mano. */
export type Where = number | 'hand';

export function fromProposal(p: TableProposal): ReviewState {
  const merged = new Set(p.merges.map(([kept]) => kept));
  const item = (d: TableProposal['hand'][number]): ReviewItem => ({
    card: d.card,
    confidence: d.confidence,
    bbox: d.bbox,
    merged: merged.has(d),
  });
  return {
    melds: p.melds.map((m) => ({ items: m.cards.map(item), choice: null })),
    hand: p.hand.map(item),
  };
}

function edit(
  state: ReviewState,
  where: Where,
  fn: (items: ReviewItem[]) => ReviewItem[],
): ReviewState {
  if (where === 'hand') return { ...state, hand: fn(state.hand) };
  const melds = state.melds
    .map((m, i) => (i === where ? { items: fn(m.items), choice: null } : m))
    // Un gioco rimasto vuoto sparisce.
    .filter((m) => m.items.length > 0);
  return { ...state, melds };
}

export function replaceCard(s: ReviewState, where: Where, index: number, card: Card): ReviewState {
  return edit(s, where, (items) =>
    items.map((it, i) => (i === index ? { ...it, card, confidence: null, merged: false } : it)),
  );
}

export function removeCard(s: ReviewState, where: Where, index: number): ReviewState {
  return edit(s, where, (items) => items.filter((_, i) => i !== index));
}

export function addCard(s: ReviewState, where: Where | 'new', card: Card): ReviewState {
  const item: ReviewItem = { card, confidence: null, bbox: null, merged: false };
  if (where === 'new') return { ...s, melds: [...s.melds, { items: [item], choice: null }] };
  return edit(s, where, (items) => [...items, item]);
}

/** Sposta una carta in un altro gioco, tra quelle in mano o in un gioco nuovo. */
export function moveCard(
  s: ReviewState,
  from: Where,
  index: number,
  to: Where | 'new',
): ReviewState {
  const source = from === 'hand' ? s.hand : s.melds[from]?.items;
  const item = source?.[index];
  if (!item || from === to) return s;
  // Prima aggiungo (gli indici dei giochi non cambiano), poi tolgo.
  const added =
    to === 'new'
      ? { ...s, melds: [...s.melds, { items: [item], choice: null }] }
      : edit(s, to, (items) => [...items, item]);
  return removeCard(added, from, index);
}

export function setChoice(s: ReviewState, meld: number, choice: number): ReviewState {
  return { ...s, melds: s.melds.map((m, i) => (i === meld ? { ...m, choice } : m)) };
}

export function statuses(s: ReviewState, allowTwos: boolean): MeldStatus[] {
  return s.melds.map((m) =>
    meldStatus({ cards: m.items.map((i) => i.card), choice: m.choice }, allowTwos),
  );
}

/** Giochi e carte in mano da passare alla smazzata; null se qualche gioco va sistemato. */
export function toTeamData(
  s: ReviewState,
  allowTwos: boolean,
): { melds: MeldDraft[]; hand: Card[] } | null {
  if (statuses(s, allowTwos).some((st) => st.state !== 'ok')) return null;
  return {
    melds: s.melds.map((m) => ({ cards: m.items.map((i) => i.card), choice: m.choice })),
    hand: s.hand.map((i) => i.card),
  };
}
