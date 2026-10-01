import {
  formatCard,
  validateMeld,
  type Detection,
  type MeldValidation,
  type RuleSet,
} from '@burracount/rules';

/**
 * Prima versione (euristica) di deduplica e raggruppamento, CLAUDE.md §6.4–6.5.
 * Le soglie sono in multipli della dimensione dell'indice d'angolo, così non
 * dipendono dalla risoluzione della foto. Da tarare sulle foto reali (M4).
 */

const center = (d: Detection) => ({
  x: d.bbox.x + d.bbox.width / 2,
  y: d.bbox.y + d.bbox.height / 2,
});

const size = (d: Detection) => Math.max(d.bbox.width, d.bbox.height);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * Due indici uguali agli angoli opposti di una carta intera: lungo il lato
 * lungo distano 2,5–7 volte l'indice, lungo il lato corto 0,8–5 volte.
 * Due carte identiche del doppio mazzo affiancate in un tris sono invece vicine.
 */
function oppositeCorners(a: Detection, b: Detection): boolean {
  if (formatCard(a.card) !== formatCard(b.card)) return false;
  const s = (size(a) + size(b)) / 2;
  const ca = center(a);
  const cb = center(b);
  const dx = Math.abs(ca.x - cb.x) / s;
  const dy = Math.abs(ca.y - cb.y) / s;
  const long = (v: number) => v >= 2.5 && v <= 7;
  const short = (v: number) => v >= 0.8 && v <= 5;
  return (long(dy) && short(dx)) || (long(dx) && short(dy));
}

export interface DedupeResult {
  cards: Detection[];
  /** Coppie fuse [tenuto, scartato]: la UI le segnala come incerte. */
  merges: [Detection, Detection][];
}

export function dedupeCorners(detections: Detection[]): DedupeResult {
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const cards: Detection[] = [];
  const merges: [Detection, Detection][] = [];
  const used = new Set<Detection>();
  for (const d of sorted) {
    const twin = cards.find((k) => !used.has(k) && oppositeCorners(k, d));
    if (twin) {
      used.add(twin);
      merges.push([twin, d]);
    } else {
      cards.push(d);
    }
  }
  return { cards, merges };
}

/** Raggruppamento a collegamento singolo: indici vicini meno di `eps` stanno nello stesso gruppo. */
function clusters(cards: Detection[], eps: number): Detection[][] {
  const parent = cards.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = center(cards[i]!);
      const b = center(cards[j]!);
      if (Math.hypot(a.x - b.x, a.y - b.y) <= eps) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, Detection[]>();
  cards.forEach((c, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), c]);
  });
  return [...groups.values()];
}

export interface ProposedMeld {
  cards: Detection[];
  validation: Extract<MeldValidation, { valid: true }>;
}

export interface TableProposal {
  melds: ProposedMeld[];
  /** Carte che non formano un gioco valido: per la modalità semplice sono in mano. */
  hand: Detection[];
  merges: [Detection, Detection][];
}

const readingOrder = (a: Detection, b: Detection) => {
  const ca = center(a);
  const cb = center(b);
  return ca.x - cb.x || ca.y - cb.y;
};

/**
 * Da una foto di squadra (giochi calati + carte in mano di fianco) propone
 * i giochi: gruppi vicini che formano una scala o un tris valido. Il resto
 * va tra le carte in mano.
 */
export function groupTable(
  detections: Detection[],
  options: Pick<RuleSet, 'allowSetOfTwos'>,
): TableProposal {
  const { cards, merges } = dedupeCorners(detections);
  if (cards.length === 0) return { melds: [], hand: [], merges };
  const eps = 2 * median(cards.map(size));

  const melds: ProposedMeld[] = [];
  const hand: Detection[] = [];
  const groups = clusters(cards, eps)
    .map((g) => g.sort(readingOrder))
    .sort((a, b) => {
      const ca = center(a[0]!);
      const cb = center(b[0]!);
      return ca.y - cb.y || ca.x - cb.x;
    });
  for (const group of groups) {
    const validation = validateMeld(
      group.map((d) => d.card),
      options,
    );
    if (validation.valid) melds.push({ cards: group, validation });
    else hand.push(...group);
  }
  return { melds, hand, merges };
}
