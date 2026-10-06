import { formatCard, isWildCandidate, RANKS, SUITS } from './cards';
import { validateMeld } from './meld';
import type { Card, Meld, RuleSet } from './types';

/** Tutte le carte possibili: 52 più il jolly. */
const POOL: Card[] = [
  ...SUITS.flatMap((suit) =>
    RANKS.filter((r) => r !== 'JOKER').map((rank) => ({ rank, suit }) as Card),
  ),
  { rank: 'JOKER', suit: null },
];

const MAX_UNKNOWN = 2;

export interface MeldCompletion {
  /** Il gioco completato, nell'ordine delle carte date (ordine della foto). */
  cards: Card[];
  /** Per ogni carta dedotta: posizione in `cards` e alternative, la prima è quella scelta. */
  deduced: { index: number; options: Card[] }[];
}

export interface CompleteOptions extends Pick<RuleSet, 'allowSetOfTwos'> {
  /**
   * Le carte sono nell'ordine in cui stanno sul tavolo: una scala deve
   * essere crescente o decrescente in quell'ordine (la matta che allunga
   * può stare a uno dei due capi).
   */
  ordered: boolean;
}

const key = (cards: Card[]) => cards.map(formatCard).join(' ');

/** La sequenza rispetta l'ordine di una delle interpretazioni (o il suo inverso)? */
function matchesOrder(seq: Card[], melds: Meld[]): boolean {
  const target = key(seq);
  return melds.some((m) => {
    if (m.kind === 'set') return true;
    const variants = [m.cards];
    const w = m.wild?.index;
    // La matta che allunga la scala può stare all'altro capo.
    if (w === m.cards.length - 1) variants.push([m.cards[w]!, ...m.cards.slice(0, w)]);
    if (w === 0) variants.push([...m.cards.slice(1), m.cards[0]!]);
    return variants.some((v) => key(v) === target || key([...v].reverse()) === target);
  });
}

function isValid(seq: Card[], opts: CompleteOptions): boolean {
  const v = validateMeld(seq, opts);
  if (!v.valid) return false;
  return !opts.ordered || matchesOrder(seq, v.interpretations);
}

const rankIndex = (c: Card) => RANKS.indexOf(c.rank);

/** Naturali per valore e seme, poi il jolly, poi una sola pinella (dello stesso seme del gioco se possibile). */
function rankOptions(found: Card[], context: Card[]): Card[] {
  const naturals = found
    .filter((c) => !isWildCandidate(c))
    .sort((a, b) => rankIndex(a) - rankIndex(b) || SUITS.indexOf(a.suit!) - SUITS.indexOf(b.suit!));
  const joker = found.filter((c) => c.rank === 'JOKER');
  const twos = found.filter((c) => c.rank === '2');
  const suits = new Set(context.filter((c) => !isWildCandidate(c)).map((c) => c.suit));
  const sameSuitTwo = suits.size === 1 ? twos.find((c) => suits.has(c.suit)) : undefined;
  const two =
    sameSuitTwo ?? twos.sort((a, b) => SUITS.indexOf(a.suit!) - SUITS.indexOf(b.suit!))[0];
  return [...naturals, ...joker, ...(two ? [two] : [])];
}

/**
 * Deduce le carte sconosciute (null) di un gioco: per ognuna, quali carte
 * renderebbero valido il gioco. Tra 5♥ ? 7♥ ci può stare il 6♥ o una matta.
 * La scelta proposta usa meno matte possibile; le alternative restano per
 * l'utente. Null se nessuna combinazione funziona o le incognite sono più di due.
 */
export function completeMeld(slots: (Card | null)[], opts: CompleteOptions): MeldCompletion | null {
  const unknown = slots.flatMap((c, i) => (c === null ? [i] : []));
  if (unknown.length > MAX_UNKNOWN) return null;
  const known = slots.filter((c): c is Card => c !== null);
  if (unknown.length === 0) {
    return isValid(known, opts) ? { cards: known, deduced: [] } : null;
  }

  const combos: Card[][] = [];
  const fill = (chosen: Card[]) => {
    if (chosen.length === unknown.length) {
      const seq = [...slots] as Card[];
      unknown.forEach((pos, k) => (seq[pos] = chosen[k]!));
      if (isValid(seq, opts)) combos.push(chosen);
      return;
    }
    for (const c of POOL) fill([...chosen, c]);
  };
  fill([]);
  if (combos.length === 0) return null;

  const options = unknown.map((_, k) => {
    const found = new Map(combos.map((combo) => [formatCard(combo[k]!), combo[k]!]));
    return rankOptions([...found.values()], known);
  });
  // Proposta: meno matte possibile, poi le alternative migliori.
  const score = (combo: Card[]) => [
    combo.filter(isWildCandidate).length,
    ...combo.map((c, k) => options[k]!.findIndex((o) => formatCard(o) === formatCard(c))),
  ];
  const best = [...combos].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    for (let i = 0; i < sa.length; i++) {
      const d = (sa[i] === -1 ? 99 : sa[i]!) - (sb[i] === -1 ? 99 : sb[i]!);
      if (d !== 0) return d;
    }
    return 0;
  })[0]!;

  const cards = [...slots] as Card[];
  unknown.forEach((pos, k) => (cards[pos] = best[k]!));
  return {
    cards,
    deduced: unknown.map((pos, k) => ({
      index: pos,
      // La carta scelta va per prima.
      options: [best[k]!, ...options[k]!.filter((o) => formatCard(o) !== formatCard(best[k]!))],
    })),
  };
}
