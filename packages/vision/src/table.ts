import {
  completeMeld,
  formatCard,
  type Card,
  type Detection,
  type MeldCompletion,
  type RuleSet,
} from '@burracount/rules';

/**
 * Deduplica e raggruppamento in giochi (CLAUDE.md §6.4–6.5), tarati sulle
 * carte Modiano: l'indice è in tutti e quattro gli angoli. Le distanze sono
 * in multipli dell'altezza dell'indice, così non dipendono dalla risoluzione.
 */

/**
 * Distanza dal centro dell'indice in alto a sinistra a quello in alto a destra
 * (across) e in basso a sinistra (down), misurata sul mazzo Modiano. Pinelle e
 * jolly hanno l'indice con la stellina, di altezza diversa.
 */
const GEOMETRY = {
  normal: { across: 2.42, down: 3.34 },
  pinella: { across: 1.78, down: 2.14 },
  joker: { across: 5.92, down: 9.69 },
};
/** Tolleranza in frazione della distanza verticale (prospettiva, rotazioni). */
const TOLERANCE = 0.3;
/** Due indici più vicini di così sono carte diverse (ventaglio). */
const MIN_SAME_CARD = 1.5;
/**
 * Raggruppamento: due carte sono nello stesso gioco se stanno nella stessa
 * colonna (scostamento laterale piccolo, una sotto l'altra) o nella stessa
 * fila (una accanto all'altra). I giochi veri sono colonne o file di carte
 * sovrapposte; giochi affiancati distano almeno una larghezza di carta.
 */
const SAME_LINE = 1.4;
const NEXT_IN_LINE = 2.6;
/** Sotto questa confidenza una carta è la prima candidata alla deduzione. */
const DOUBTFUL = 0.6;

type Point = { x: number; y: number };

const center = (d: Detection): Point => ({
  x: d.bbox.x + d.bbox.width / 2,
  y: d.bbox.y + d.bbox.height / 2,
});

const size = (d: Detection) => Math.max(d.bbox.width, d.bbox.height);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * Quanto la distanza tra due indici uguali somiglia a quella tra due angoli
 * della stessa carta (orizzontale, verticale o in diagonale, anche ruotata
 * di 90°). Infinito se non somiglia.
 */
function cornerFit(a: Detection, b: Detection): number {
  if (formatCard(a.card) !== formatCard(b.card)) return Infinity;
  const s = (size(a) + size(b)) / 2;
  const ca = center(a);
  const cb = center(b);
  const dx = Math.abs(ca.x - cb.x) / s;
  const dy = Math.abs(ca.y - cb.y) / s;
  if (Math.hypot(dx, dy) < MIN_SAME_CARD) return Infinity;
  const g =
    a.card.rank === 'JOKER'
      ? GEOMETRY.joker
      : a.card.rank === '2'
        ? GEOMETRY.pinella
        : GEOMETRY.normal;
  const expected: [number, number][] = [
    [g.across, 0],
    [0, g.down],
    [g.across, g.down],
  ];
  const fits = [...expected, ...expected.map(([x, y]) => [y, x] as [number, number])].map(
    ([ex, ey]) => Math.hypot(dx - ex, dy - ey),
  );
  const best = Math.min(...fits);
  return best <= TOLERANCE * g.down ? best / g.down : Infinity;
}

export interface DedupeResult {
  /** Una rilevazione per carta (la più sicura tra i suoi angoli). */
  cards: Detection[];
  /** Coppie fuse [tenuto, scartato]: la UI le segnala. */
  merges: [Detection, Detection][];
  /** Centro degli angoli di ogni carta, nello stesso ordine di `cards`. */
  centers: Point[];
}

/**
 * Riunisce gli angoli della stessa carta. Si fondono prima le coppie che
 * somigliano di più alla geometria della carta; una fusione è rifiutata se
 * metterebbe insieme due indici troppo vicini (carte uguali affiancate).
 */
export function dedupeCorners(detections: Detection[]): DedupeResult {
  const n = detections.length;
  const parent = detections.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const members = new Map<number, number[]>(detections.map((_, i) => [i, [i]]));

  const pairs: { i: number; j: number; fit: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const fit = cornerFit(detections[i]!, detections[j]!);
      if (fit < Infinity) pairs.push({ i, j, fit });
    }
  }
  pairs.sort((a, b) => a.fit - b.fit);
  for (const { i, j } of pairs) {
    const ri = find(i);
    const rj = find(j);
    if (ri === rj) continue;
    const merged = [...members.get(ri)!, ...members.get(rj)!];
    if (merged.length > 4) continue;
    // Tutti gli angoli della stessa carta sono ben distanziati tra loro.
    const ok = merged.every((a, x) =>
      merged.slice(x + 1).every((b) => {
        const s = (size(detections[a]!) + size(detections[b]!)) / 2;
        const ca = center(detections[a]!);
        const cb = center(detections[b]!);
        return Math.hypot(ca.x - cb.x, ca.y - cb.y) / s >= MIN_SAME_CARD;
      }),
    );
    if (!ok) continue;
    parent[ri] = rj;
    members.set(rj, merged);
    members.delete(ri);
  }

  const cards: Detection[] = [];
  const centers: Point[] = [];
  const merges: [Detection, Detection][] = [];
  for (const group of members.values()) {
    const dets = group.map((k) => detections[k]!).sort((a, b) => b.confidence - a.confidence);
    const kept = dets[0]!;
    cards.push(kept);
    for (const other of dets.slice(1)) merges.push([kept, other]);
    const cs = dets.map(center);
    centers.push({
      x: cs.reduce((s, c) => s + c.x, 0) / cs.length,
      y: cs.reduce((s, c) => s + c.y, 0) / cs.length,
    });
  }
  return { cards, merges, centers };
}

/** Collegamento singolo lungo colonne e file (vedi SAME_LINE e NEXT_IN_LINE). */
function clusters(points: Point[], unit: number): number[][] {
  const parent = points.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = Math.abs(points[i]!.x - points[j]!.x) / unit;
      const dy = Math.abs(points[i]!.y - points[j]!.y) / unit;
      const column = dx <= SAME_LINE && dy <= NEXT_IN_LINE;
      const row = dy <= SAME_LINE && dx <= NEXT_IN_LINE;
      if (column || row) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, number[]>();
  points.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
  return [...groups.values()];
}

/** Ordina le carte lungo la direzione principale del ventaglio. */
function alongFan(indices: number[], points: Point[]): number[] {
  if (indices.length < 2) return indices;
  const ps = indices.map((i) => points[i]!);
  const mx = ps.reduce((s, p) => s + p.x, 0) / ps.length;
  const my = ps.reduce((s, p) => s + p.y, 0) / ps.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of ps) {
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const proj = (i: number) => {
    const p = points[i]!;
    return (p.x - mx) * ux + (p.y - my) * uy;
  };
  const sorted = [...indices].sort((a, b) => proj(a) - proj(b));
  // Lettura naturale: da sinistra a destra, o dall'alto in basso.
  const first = points[sorted[0]!]!;
  const last = points[sorted[sorted.length - 1]!]!;
  const reversed = Math.abs(ux) >= Math.abs(uy) ? first.x > last.x : first.y > last.y;
  return reversed ? sorted.reverse() : sorted;
}

export interface MeldItem {
  /** Il rilevamento da cui viene la carta; null per una carta dedotta che il modello non ha visto. */
  detection: Detection | null;
  card: Card;
  /** Carta dedotta: alternative possibili, la prima è quella scelta. null se letta dal modello. */
  options: Card[] | null;
}

export interface ProposedMeld {
  items: MeldItem[];
  /** Il gioco (con le deduzioni) è una scala o un tris valido. */
  valid: boolean;
}

export interface TableProposal {
  melds: ProposedMeld[];
  merges: [Detection, Detection][];
}

type Options = Pick<RuleSet, 'allowSetOfTwos'>;

function fromCompletion(dets: (Detection | null)[], completion: MeldCompletion): ProposedMeld {
  const deduced = new Map(completion.deduced.map((d) => [d.index, d.options]));
  return {
    valid: true,
    items: completion.cards.map((card, i) => ({
      detection: dets[i] ?? null,
      card,
      options: deduced.get(i) ?? null,
    })),
  };
}

/**
 * Prova a rendere valido un gioco letto male: prima scartando un indice
 * incerto in più, poi sostituendo una carta incerta, poi aggiungendo una carta
 * non vista, poi sostituendo qualunque carta, poi due.
 */
function repair(dets: Detection[], opts: Options): ProposedMeld {
  const ordered = { ...opts, ordered: true };
  const cards = dets.map((d) => d.card);
  const exact = completeMeld(cards, ordered);
  if (exact) return fromCompletion(dets, exact);

  const byDoubt = dets.map((_, i) => i).sort((a, b) => dets[a]!.confidence - dets[b]!.confidence);
  const replace = (positions: number[]) => {
    const slots = cards.map((c, i) => (positions.includes(i) ? null : c));
    const c = completeMeld(slots, ordered);
    return c && fromCompletion(dets, c);
  };
  const insert = (at: number) => {
    const slots: (Card | null)[] = [...cards.slice(0, at), null, ...cards.slice(at)];
    const c = completeMeld(slots, ordered);
    return c && fromCompletion([...dets.slice(0, at), null, ...dets.slice(at)], c);
  };

  // Un indice in più (falso rilevamento) si scarta, invece di trasformarlo in un'altra carta.
  const drop = (at: number) => {
    const rest = dets.filter((_, i) => i !== at);
    const c =
      rest.length >= 3
        ? completeMeld(
            rest.map((d) => d.card),
            ordered,
          )
        : null;
    return c && fromCompletion(rest, c);
  };

  const doubtful = byDoubt.filter((i) => dets[i]!.confidence < DOUBTFUL);
  const attempts: (() => ProposedMeld | null)[] = [
    ...doubtful.map((i) => () => drop(i)),
    ...doubtful.map((i) => () => replace([i])),
    ...Array.from({ length: dets.length + 1 }, (_, at) => () => insert(at)),
    ...byDoubt.map((i) => () => replace([i])),
  ];
  const worst = byDoubt.slice(0, 4);
  for (let a = 0; a < worst.length; a++) {
    for (let b = a + 1; b < worst.length; b++) attempts.push(() => replace([worst[a]!, worst[b]!]));
  }
  for (const attempt of attempts) {
    const fixed = attempt();
    if (fixed) return fixed;
  }
  return { valid: false, items: dets.map((d) => ({ detection: d, card: d.card, options: null })) };
}

/** Un gruppo che non torna potrebbe essere due giochi troppo vicini. */
function splitInTwo(dets: Detection[], opts: Options): ProposedMeld[] | null {
  const ordered = { ...opts, ordered: true };
  for (let cut = 3; cut <= dets.length - 3; cut++) {
    const left = completeMeld(
      dets.slice(0, cut).map((d) => d.card),
      ordered,
    );
    const right = completeMeld(
      dets.slice(cut).map((d) => d.card),
      ordered,
    );
    if (left && right)
      return [fromCompletion(dets.slice(0, cut), left), fromCompletion(dets.slice(cut), right)];
  }
  return null;
}

/**
 * Dalla foto dei giochi di una squadra propone i giochi: ogni gruppo di carte
 * vicine è un gioco. Se non torna, prova a dividerlo in due o a dedurre la
 * carta letta male o non vista (CLAUDE.md §6.5).
 */
export function groupTable(detections: Detection[], options: Options): TableProposal {
  const { cards, merges, centers } = dedupeCorners(detections);
  if (cards.length === 0) return { melds: [], merges };
  const unit = median(cards.map(size));
  const eps = NEXT_IN_LINE * unit;

  const groups = clusters(centers, unit)
    .map((g) => alongFan(g, centers))
    .sort((a, b) => {
      const ca = centers[a[0]!]!;
      const cb = centers[b[0]!]!;
      return Math.abs(ca.y - cb.y) > eps ? ca.y - cb.y : ca.x - cb.x;
    });

  const melds: ProposedMeld[] = [];
  for (const group of groups) {
    const dets = group.map((i) => cards[i]!);
    const whole = repair(dets, options);
    const noDeduction = whole.valid && whole.items.every((it) => it.options === null);
    const split = noDeduction || dets.length < 6 ? null : splitInTwo(dets, options);
    melds.push(...(split ?? [whole]));
  }
  return { melds, merges };
}
