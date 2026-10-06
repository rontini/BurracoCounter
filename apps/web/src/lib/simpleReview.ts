import { formatCard, type BoundingBox, type Card } from '@burracount/rules';
import type { TableProposal } from '@burracount/vision';
import { meldStatus, type MeldDraft, type MeldStatus } from './handDraft';

export interface ReviewItem {
  card: Card;
  /** null per le carte corrette, aggiunte o dedotte. */
  confidence: number | null;
  bbox: BoundingBox | null;
  /** Ottenuta fondendo più angoli della stessa carta. */
  merged: boolean;
  /** Carta dedotta: alternative possibili (la prima è quella proposta). */
  options: Card[] | null;
}

export interface ReviewState {
  melds: { items: ReviewItem[]; choice: number | null }[];
}

export function fromProposal(p: TableProposal): ReviewState {
  const merged = new Set(p.merges.map(([kept]) => kept));
  return {
    melds: p.melds.map((m) => ({
      choice: null,
      items: m.items.map((it) => ({
        card: it.card,
        confidence: it.options ? null : (it.detection?.confidence ?? null),
        bbox: it.detection?.bbox ?? null,
        merged: it.detection ? merged.has(it.detection) : false,
        options: it.options,
      })),
    })),
  };
}

function edit(
  state: ReviewState,
  meld: number,
  fn: (items: ReviewItem[]) => ReviewItem[],
): ReviewState {
  return {
    melds: state.melds
      .map((m, i) => (i === meld ? { items: fn(m.items), choice: null } : m))
      // Un gioco rimasto vuoto sparisce.
      .filter((m) => m.items.length > 0),
  };
}

/** Sostituisce una carta. Se è una delle alternative dedotte, le alternative restano disponibili. */
export function replaceCard(s: ReviewState, meld: number, index: number, card: Card): ReviewState {
  return edit(s, meld, (items) =>
    items.map((it, i) => {
      if (i !== index) return it;
      const keepOptions = it.options?.some((o) => formatCard(o) === formatCard(card));
      return {
        ...it,
        card,
        confidence: null,
        merged: false,
        options: keepOptions ? it.options : null,
      };
    }),
  );
}

export function removeCard(s: ReviewState, meld: number, index: number): ReviewState {
  return edit(s, meld, (items) => items.filter((_, i) => i !== index));
}

export function addCard(s: ReviewState, meld: number | 'new', card: Card): ReviewState {
  const item: ReviewItem = { card, confidence: null, bbox: null, merged: false, options: null };
  if (meld === 'new') return { melds: [...s.melds, { items: [item], choice: null }] };
  return edit(s, meld, (items) => [...items, item]);
}

/** Sposta una carta in un altro gioco o in un gioco nuovo. */
export function moveCard(
  s: ReviewState,
  from: number,
  index: number,
  to: number | 'new',
): ReviewState {
  const item = s.melds[from]?.items[index];
  if (!item || from === to) return s;
  // Prima aggiungo (gli indici dei giochi non cambiano), poi tolgo.
  const added =
    to === 'new'
      ? { melds: [...s.melds, { items: [item], choice: null }] }
      : edit(s, to, (items) => [...items, item]);
  return removeCard(added, from, index);
}

export function setChoice(s: ReviewState, meld: number, choice: number): ReviewState {
  return { melds: s.melds.map((m, i) => (i === meld ? { ...m, choice } : m)) };
}

export function statuses(s: ReviewState, allowTwos: boolean): MeldStatus[] {
  return s.melds.map((m) =>
    meldStatus({ cards: m.items.map((i) => i.card), choice: m.choice }, allowTwos),
  );
}

/** Giochi da passare alla smazzata; null se qualche gioco va ancora sistemato. */
export function toTeamData(s: ReviewState, allowTwos: boolean): { melds: MeldDraft[] } | null {
  if (statuses(s, allowTwos).some((st) => st.state !== 'ok')) return null;
  return { melds: s.melds.map((m) => ({ cards: m.items.map((i) => i.card), choice: m.choice })) };
}
