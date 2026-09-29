import { formatCard, isWildCandidate } from './cards';
import type { Card, Meld, Rank, RuleSet, WildAssignment } from './types';

export type MeldErrorCode =
  'TOO_FEW_CARDS' | 'TOO_MANY_WILDS' | 'NOT_SET_OR_RUN' | 'SET_OF_TWOS' | 'DUPLICATE_RANK' | 'GAP';

export interface MeldError {
  code: MeldErrorCode;
  message: string;
}

export type MeldValidation =
  { valid: true; interpretations: Meld[] } | { valid: false; errors: MeldError[] };

type NaturalRank = Exclude<Rank, 'JOKER'>;

/** Posizione nella scala: A=1 (o 14), 2..10, J=11, Q=12, K=13. */
const POSITION: Record<Exclude<NaturalRank, 'A'>, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
};

function rankAt(position: number): NaturalRank {
  if (position === 1 || position === 14) return 'A';
  return (Object.keys(POSITION) as (keyof typeof POSITION)[]).find(
    (r) => POSITION[r] === position,
  )!;
}

/**
 * Riconosce una scala o un tris, con al massimo una matta, a partire dalle
 * carte in qualunque ordine. Se un 2 può essere sia naturale sia matta
 * restituisce tutte le interpretazioni: la scelta spetta all'utente.
 */
export function validateMeld(
  input: readonly Card[],
  options: Pick<RuleSet, 'allowSetOfTwos'> = { allowSetOfTwos: false },
): MeldValidation {
  if (input.length < 3) {
    return fail('TOO_FEW_CARDS', 'Servono almeno 3 carte per un gioco.');
  }

  const found = new Map<string, Meld>();
  const add = (m: Meld | null) => {
    if (m) found.set(key(m), m);
  };

  // Nessuna matta, oppure ogni jolly/pinella provato a turno come matta.
  const choices: (number | null)[] = [null];
  input.forEach((c, i) => {
    if (isWildCandidate(c)) choices.push(i);
  });

  for (const wildIndex of choices) {
    const wild = wildIndex === null ? null : input[wildIndex]!;
    const naturals = input.filter((_, i) => i !== wildIndex);
    if (naturals.some((c) => c.rank === 'JOKER')) continue;
    add(asSet(naturals, wild, options.allowSetOfTwos));
    add(asRun(naturals, wild));
  }

  if (found.size > 0) return { valid: true, interpretations: [...found.values()] };
  return { valid: false, errors: explain(input, options.allowSetOfTwos) };
}

function key(m: Meld): string {
  return `${m.kind}|${m.cards.map(formatCard).join(',')}|${m.wild?.index ?? '-'}`;
}

function asSet(naturals: Card[], wild: Card | null, allowTwos: boolean): Meld | null {
  const rank = naturals[0]!.rank as NaturalRank;
  if (!naturals.every((c) => c.rank === rank)) return null;
  if (rank === '2' && !allowTwos) return null;
  if (!wild) return { kind: 'set', cards: [...naturals], wild: null };
  return {
    kind: 'set',
    cards: [...naturals, wild],
    wild: { index: naturals.length, represents: rank },
  };
}

function asRun(naturals: Card[], wild: Card | null): Meld | null {
  const suit = naturals[0]!.suit;
  if (!naturals.every((c) => c.suit === suit)) return null;

  const aces = naturals.filter((c) => c.rank === 'A').length;
  if (aces > 2) return null;
  const others = naturals
    .filter((c) => c.rank !== 'A')
    .map((c) => ({ card: c, pos: POSITION[c.rank as keyof typeof POSITION] }));

  // Ogni asso può stare in basso (1) o in alto (14).
  const aceOptions: number[][] = aces === 0 ? [[]] : aces === 1 ? [[1], [14]] : [[1, 14]];
  for (const acePositions of aceOptions) {
    const placed = [
      ...others,
      ...acePositions.map((pos) => ({ card: naturals.find((c) => c.rank === 'A')!, pos })),
    ].sort((a, b) => a.pos - b.pos);

    const run = fill(placed, wild);
    if (run) return run;
  }
  return null;
}

function fill(placed: { card: Card; pos: number }[], wild: Card | null): Meld | null {
  const gaps: number[] = [];
  for (let i = 1; i < placed.length; i++) {
    const diff = placed[i]!.pos - placed[i - 1]!.pos;
    if (diff === 0) return null;
    for (let p = placed[i - 1]!.pos + 1; p < placed[i]!.pos; p++) gaps.push(p);
  }
  if (gaps.length > (wild ? 1 : 0)) return null;

  const cardsInOrder = placed.map((p) => p.card);
  if (!wild) return { kind: 'run', cards: cardsInOrder, wild: null };

  let wildPos: number;
  if (gaps.length === 1) wildPos = gaps[0]!;
  else if (placed[placed.length - 1]!.pos < 14) wildPos = placed[placed.length - 1]!.pos + 1;
  else if (placed[0]!.pos > 1) wildPos = placed[0]!.pos - 1;
  else return null;

  const index = placed.filter((p) => p.pos < wildPos).length;
  cardsInOrder.splice(index, 0, wild);
  const assignment: WildAssignment = { index, represents: rankAt(wildPos) };
  return { kind: 'run', cards: cardsInOrder, wild: assignment };
}

/** Messaggi descrittivi quando nessuna interpretazione è valida. */
function explain(input: readonly Card[], allowTwos: boolean): MeldError[] {
  const jokers = input.filter((c) => c.rank === 'JOKER').length;
  const naturals = input.filter((c) => !isWildCandidate(c));
  const twos = input.filter((c) => c.rank === '2');

  if (naturals.length === 0 && jokers === 0 && !allowTwos) {
    return [err('SET_OF_TWOS', 'Il tris di pinelle non è ammesso da queste regole.')];
  }
  if (naturals.length === 0) {
    return [err('TOO_MANY_WILDS', 'Un gioco non può essere fatto solo di matte.')];
  }

  const sameRank = naturals.every((c) => c.rank === naturals[0]!.rank);
  const suit = naturals[0]!.suit;
  const sameSuit = naturals.every((c) => c.suit === suit);

  // Le pinelle che non possono essere naturali sono per forza matte.
  const forcedWilds =
    jokers + (sameSuit && !sameRank ? twos.filter((c) => c.suit !== suit).length : twos.length);
  if (forcedWilds > 1 && (sameRank || sameSuit)) {
    return [
      err('TOO_MANY_WILDS', 'Un gioco può contenere al massimo una matta (jolly o pinella).'),
    ];
  }
  if (!sameRank && !sameSuit) {
    return [
      err(
        'NOT_SET_OR_RUN',
        'Le carte non hanno né lo stesso valore (tris) né lo stesso seme (scala).',
      ),
    ];
  }
  // Qui le carte naturali hanno lo stesso seme ma non formano una scala
  // (un tris con al più una matta sarebbe già stato accettato).
  const ranks = input.filter((c) => c.suit === suit).map((c) => c.rank);
  const dup = ranks.find((r, i) => r !== 'A' && r !== '2' && ranks.indexOf(r) !== i);
  if (dup) {
    return [err('DUPLICATE_RANK', `Nella scala il ${dup} compare due volte.`)];
  }
  return [err('GAP', 'La scala ha buchi che non si possono coprire con una sola matta.')];
}

function err(code: MeldErrorCode, message: string): MeldError {
  return { code, message };
}

function fail(code: MeldErrorCode, message: string): MeldValidation {
  return { valid: false, errors: [err(code, message)] };
}
