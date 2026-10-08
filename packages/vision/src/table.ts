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
/** Geometrie possibili: l'indice della pinella a volte è letto senza la stellina. */
function geometriesOf(d: Detection) {
  if (d.card.rank === 'JOKER') return [GEOMETRY.joker];
  return d.card.rank === '2' ? [GEOMETRY.pinella, GEOMETRY.normal] : [GEOMETRY.normal];
}

/** Tolleranza in frazione della distanza verticale (prospettiva, rotazioni). */
const TOLERANCE = 0.3;
/** Tolleranza per le altre coppie di angoli di una carta già riconosciuta. */
const LOOSE_TOLERANCE = 0.5;
/** Due indici più vicini di così sono carte diverse (ventaglio). */
const MIN_SAME_CARD = 1.5;
/**
 * Raggruppamento (vedi follows), in altezze d'indice: la carta successiva di un
 * ventaglio ha un angolo entro NEXT_IN_LINE lungo la direzione del ventaglio e
 * il centro spostato di lato al massimo di SAME_FAN; una carta con un solo
 * angolo visto deve stare sulla linea degli angoli (SAME_LINE).
 */
const NEXT_IN_LINE = 2.6;
const SAME_FAN = 1.2;
const SAME_LINE = 0.35;
/** Un indice è «in mezzo» a due angoli se sta oltre questa frazione da entrambi. */
const BETWEEN = 0.2;
/** Due ventagli sono paralleli se l'angolo tra le direzioni è sotto i 37°. */
const PARALLEL = 0.8;
/** Un indice ha i lati in rapporto circa 1:3; sotto 1:5 è un falso rilevamento. */
const MIN_ASPECT = 0.2;
/** Due indici con i centri più vicini di così (in altezze d'indice) sono lo stesso indice. */
const SAME_SPOT = 0.5;
/** Un box contenuto per più di così in uno più sicuro è un pezzo dello stesso indice. */
const CONTAINED = 0.6;
/** Un box più piccolo di così (la stellina del jolly è circa 0,4) è un falso rilevamento. */
const MIN_SIZE = 0.25;
/** Una carta isolata vicina a un gioco (una matta messa di traverso) gli si unisce. */
const ATTACH = 4;
/** Sotto questa confidenza una carta isolata si scarta. */
const LONE_MIN = 0.5;
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
function cornerFit(a: Detection, b: Detection, tolerance = TOLERANCE): number {
  if (cornerLabel(a.card) !== cornerLabel(b.card)) return Infinity;
  const s = (size(a) + size(b)) / 2;
  const ca = center(a);
  const cb = center(b);
  const dx = Math.abs(ca.x - cb.x) / s;
  const dy = Math.abs(ca.y - cb.y) / s;
  if (Math.hypot(dx, dy) < MIN_SAME_CARD) return Infinity;
  let best = Infinity;
  for (const g of geometriesOf(a)) {
    const expected: [number, number][] = [
      [g.across, 0],
      [0, g.down],
      [g.across, g.down],
    ];
    for (const [ex, ey] of [...expected, ...expected.map(([x, y]) => [y, x] as [number, number])]) {
      const fit = Math.hypot(dx - ex, dy - ey) / g.down;
      if (fit <= tolerance && fit < best) best = fit;
    }
  }
  return best;
}

/**
 * Tra due angoli della stessa carta non si vede l'indice di un'altra carta:
 * il bordo tra loro è scoperto, oppure (diagonale) la carta è intera e sopra
 * le altre. Distingue due carte uguali dello stesso gioco (doppio mazzo).
 */
function blocked(detections: Detection[], blockers: Set<number>, i: number, j: number): boolean {
  const a = center(detections[i]!);
  const b = center(detections[j]!);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const d = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  const s = (size(detections[i]!) + size(detections[j]!)) / 2;
  return [...blockers].some((n) => {
    const k = detections[n]!;
    if (n === i || n === j || cornerLabel(k.card) === cornerLabel(detections[i]!.card))
      return false;
    const p = along(a, center(k), d);
    return p.along > BETWEEN * len && p.along < (1 - BETWEEN) * len && p.across < SAME_LINE * 2 * s;
  });
}

/** Etichetta per riconoscere gli angoli della stessa carta. */
const cornerLabel = (c: Card) => formatCard(c);

/** Il 6 e il 9 dello stesso seme: negli angoli capovolti il modello li confonde. */
const sixNine = (a: Card, b: Card) => a.suit === b.suit && [a.rank, b.rank].sort().join() === '6,9';

export interface DedupeResult {
  /** Una rilevazione per carta (la più sicura tra i suoi angoli). */
  cards: Detection[];
  /** Coppie fuse [tenuto, scartato]: la UI le segnala. */
  merges: [Detection, Detection][];
  /** Centro degli angoli di ogni carta, nello stesso ordine di `cards`. */
  centers: Point[];
  /** Indici (in `detections`) degli angoli di ogni carta, nello stesso ordine di `cards`. */
  members: number[][];
}

/**
 * Riunisce gli angoli della stessa carta. Si fondono prima le coppie che
 * somigliano di più alla geometria della carta; una fusione è rifiutata se
 * metterebbe insieme due indici troppo vicini (carte uguali affiancate).
 */
export function dedupeCorners(detections: Detection[]): DedupeResult {
  // Fanno da ostacolo solo gli indici di carte confermate da almeno due angoli:
  // una scritta letta per sbaglio come indice non deve separare due angoli veri.
  const first = mergeCorners(detections, new Set());
  const blockers = new Set(first.filter((g) => g.length >= 2).flat());
  const groups = joinSixNine(detections, blockers, mergeCorners(detections, blockers));

  const cards: Detection[] = [];
  const centers: Point[] = [];
  const merges: [Detection, Detection][] = [];
  for (const group of groups) {
    // Se gli angoli non concordano vince la lettura con la confidenza totale più alta.
    const votes = new Map<string, number>();
    for (const k of group) {
      const label = formatCard(detections[k]!.card);
      votes.set(label, (votes.get(label) ?? 0) + detections[k]!.confidence);
    }
    const winner = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    const dets = group
      .map((k) => detections[k]!)
      .sort(
        (a, b) =>
          Number(formatCard(b.card) === winner) - Number(formatCard(a.card) === winner) ||
          b.confidence - a.confidence,
      );
    const kept = dets[0]!;
    cards.push(kept);
    for (const other of dets.slice(1)) merges.push([kept, other]);
    const cs = dets.map(center);
    centers.push({
      x: cs.reduce((s, c) => s + c.x, 0) / cs.length,
      y: cs.reduce((s, c) => s + c.y, 0) / cs.length,
    });
  }
  return { cards, merges, centers, members: groups };
}

/**
 * Unisce un gruppo di angoli letti 6 e uno letti 9 dello stesso seme se
 * insieme formano una sola carta (al massimo quattro angoli, tutti con la
 * geometria giusta): di solito sono gli angoli in alto e quelli capovolti in
 * basso della stessa carta. Un 6 e un 9 veri della stessa scala restano due carte.
 */
function joinSixNine(detections: Detection[], blockers: Set<number>, groups: number[][]) {
  const result = groups.map((g) => [...g]);
  const fits = (a: number, b: number) => {
    const da = detections[a]!;
    const db = detections[b]!;
    const relabelled = { ...db, card: da.card };
    return (
      (sixNine(da.card, db.card) || cornerLabel(da.card) === cornerLabel(db.card)) &&
      cornerFit(da, relabelled, LOOSE_TOLERANCE) < Infinity &&
      !blocked(detections, blockers, a, b)
    );
  };
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i]!;
      const b = result[j]!;
      if (a.length + b.length > 4) continue;
      if (!sixNine(detections[a[0]!]!.card, detections[b[0]!]!.card)) continue;
      if (!a.every((x) => b.every((y) => fits(x, y)))) continue;
      a.push(...b);
      result.splice(j, 1);
      j = i;
    }
  }
  return result;
}

/** Gruppi di angoli (indici in `detections`), uno per carta. */
function mergeCorners(detections: Detection[], blockers: Set<number>): number[][] {
  const n = detections.length;
  const parent = detections.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const members = new Map<number, number[]>(detections.map((_, i) => [i, [i]]));

  const pairs: { i: number; j: number; fit: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const fit = cornerFit(detections[i]!, detections[j]!);
      if (fit < Infinity && !blocked(detections, blockers, i, j)) pairs.push({ i, j, fit });
    }
  }
  pairs.sort((a, b) => a.fit - b.fit);
  for (const { i, j } of pairs) {
    const ri = find(i);
    const rj = find(j);
    if (ri === rj) continue;
    const merged = [...members.get(ri)!, ...members.get(rj)!];
    if (merged.length > 4) continue;
    // Ogni coppia di angoli della carta deve avere la geometria di due angoli
    // (lato o diagonale): così due carte uguali vicine non diventano una sola.
    const ok = merged.every((a, x) =>
      merged
        .slice(x + 1)
        .every((b) => cornerFit(detections[a]!, detections[b]!, LOOSE_TOLERANCE) < Infinity),
    );
    if (!ok) continue;
    parent[ri] = rj;
    members.set(rj, merged);
    members.delete(ri);
  }
  return [...members.values()];
}

/** Altezza tipica di un indice nella foto: l'unità di tutte le distanze. */
function unitOf(detections: Detection[]): number {
  const normal = detections.filter((d) => d.card.rank !== 'JOKER' && d.card.rank !== '2');
  return median((normal.length > 0 ? normal : detections).map(size));
}

/** Frazione dell'area di a che sta dentro b. */
function inside(a: Detection, b: Detection): number {
  const w =
    Math.min(a.bbox.x + a.bbox.width, b.bbox.x + b.bbox.width) - Math.max(a.bbox.x, b.bbox.x);
  const h =
    Math.min(a.bbox.y + a.bbox.height, b.bbox.y + b.bbox.height) - Math.max(a.bbox.y, b.bbox.y);
  return w > 0 && h > 0 ? (w * h) / (a.bbox.width * a.bbox.height) : 0;
}

/**
 * Toglie i rilevamenti che non sono un indice: box troppo sottili, e i doppioni
 * nello stesso punto o contenuti in un altro (per esempio la sola stellina di
 * una pinella, letta come pinella o come jolly), di qualunque classe. Tiene sempre il più sicuro.
 */
function suppress(detections: Detection[]): Detection[] {
  const unit = unitOf(detections);
  const shaped = detections.filter(
    (d) =>
      Math.min(d.bbox.width, d.bbox.height) / Math.max(d.bbox.width, d.bbox.height) >= MIN_ASPECT &&
      size(d) >= MIN_SIZE * unit,
  );
  const sorted = [...shaped].sort((a, b) => b.confidence - a.confidence);
  const kept: Detection[] = [];
  for (const d of sorted) {
    const c = center(d);
    const clash = kept.some((k) => {
      const ck = center(k);
      const s = Math.min(size(d), size(k));
      return Math.hypot(c.x - ck.x, c.y - ck.y) < SAME_SPOT * s || inside(d, k) >= CONTAINED;
    });
    if (!clash) kept.push(d);
  }
  return kept;
}

interface CardShape {
  /** Centri degli angoli visti. */
  corners: Point[];
  center: Point;
  /**
   * Direzione del ventaglio (versore), se la carta è coperta: si vedono due
   * angoli dello stesso bordo e la carta successiva copre il resto, quindi il
   * gioco prosegue perpendicolare a quel bordo. null per una carta intera
   * (l'ultima del gioco) o con un solo angolo visto.
   */
  direction: Point | null;
}

function shapeOf(members: number[], detections: Detection[]): CardShape {
  const dets = members.map((i) => detections[i]!);
  const corners = dets.map(center);
  // Il centro è a metà tra i due angoli più lontani (la diagonale, se la carta è intera).
  let [p, q] = [corners[0]!, corners[0]!];
  for (const a of corners)
    for (const b of corners)
      if (Math.hypot(a.x - b.x, a.y - b.y) > Math.hypot(p.x - q.x, p.y - q.y)) [p, q] = [a, b];
  const c = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  // Due angoli sono sullo stesso bordo se la distanza somiglia a un lato più che alla diagonale.
  const gs = geometriesOf(dets[0]!);
  const sameEdge = (i: number, j: number) => {
    const len = Math.hypot(corners[j]!.x - corners[i]!.x, corners[j]!.y - corners[i]!.y);
    const off = (v: number) => Math.abs(len / ((size(dets[i]!) + size(dets[j]!)) / 2) - v);
    const side = Math.min(...gs.flatMap((g) => [off(g.across), off(g.down)]));
    return side < Math.min(...gs.map((g) => off(Math.hypot(g.across, g.down))));
  };
  let direction: Point | null = null;
  if (corners.length === 2 && sameEdge(0, 1)) {
    const vx = corners[1]!.x - corners[0]!.x;
    const vy = corners[1]!.y - corners[0]!.y;
    const len = Math.hypot(vx, vy);
    direction = { x: -vy / len, y: vx / len };
  }
  return { corners, center: c, direction };
}

/** Componenti lungo e di traverso rispetto a una direzione. */
function along(from: Point, to: Point, d: Point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return { along: dx * d.x + dy * d.y, across: Math.abs(-dx * d.y + dy * d.x) };
}

/**
 * La carta t segue o precede la carta coperta s nel suo ventaglio: un angolo di
 * t sta a breve distanza lungo la direzione del ventaglio di s, e il centro di
 * t (o, se t ha un solo angolo visto, quell'angolo sulla linea di un angolo di
 * s) è allineato con s. Giochi vicini sono spostati di lato di almeno una carta.
 */
function follows(s: CardShape, t: CardShape, unit: number): boolean {
  const d = s.direction!;
  if (t.direction && Math.abs(t.direction.x * d.x + t.direction.y * d.y) < PARALLEL) return false;
  const near = t.corners.some((p) => Math.abs(along(s.center, p, d).along) <= NEXT_IN_LINE * unit);
  if (!near) return false;
  if (t.corners.length === 1) {
    return s.corners.some((p) => along(p, t.corners[0]!, d).across <= SAME_LINE * unit);
  }
  return along(s.center, t.center, d).across <= SAME_FAN * unit;
}

/** Raggruppa le carte collegando ogni carta coperta a quelle del suo ventaglio. */
function clusters(shapes: CardShape[], unit: number): number[][] {
  const parent = shapes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  shapes.forEach((s, i) => {
    shapes.forEach((t, j) => {
      if (i === j) return;
      if (s.direction && follows(s, t, unit)) parent[find(i)] = find(j);
    });
  });
  const groups = new Map<number, number[]>();
  shapes.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
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
 * Dalla foto dei giochi di una squadra propone i giochi: le carte con gli
 * indici sulla stessa linea formano un gioco; una carta rimasta sola vicino a
 * un gioco (di solito una matta messa di traverso) gli si unisce se il gioco
 * resta valido. Se un gioco non torna, prova a dividerlo in due o a dedurre la
 * carta letta male o non vista (CLAUDE.md §6.5).
 */
export function groupTable(detections: Detection[], options: Options): TableProposal {
  const clean = suppress(detections);
  const { cards, merges, centers, members } = dedupeCorners(clean);
  if (cards.length === 0) return { melds: [], merges };
  const unit = unitOf(clean);
  const eps = NEXT_IN_LINE * unit;

  const shapes = members.map((m) => shapeOf(m, clean));
  const groups = attachLoose(clusters(shapes, unit), cards, centers, unit, options)
    .map((g) => alongFan(g, centers))
    .sort((a, b) => {
      const ca = centers[a[0]!]!;
      const cb = centers[b[0]!]!;
      return Math.abs(ca.y - cb.y) > eps ? ca.y - cb.y : ca.x - cb.x;
    });

  const melds: ProposedMeld[] = [];
  for (const group of groups) {
    const dets = group.map((i) => cards[i]!);
    // Una carta da sola, letta con poca sicurezza, è quasi sempre un falso rilevamento.
    if (dets.length === 1 && dets[0]!.confidence < LONE_MIN) continue;
    const whole = repair(dets, options);
    const noDeduction = whole.valid && whole.items.every((it) => it.options === null);
    const split = noDeduction || dets.length < 6 ? null : splitInTwo(dets, options);
    melds.push(...(split ?? [whole]));
  }
  return { melds, merges };
}

/** Unisce ogni carta rimasta sola al gioco più vicino che con lei resta (o diventa) valido. */
function attachLoose(
  groups: number[][],
  cards: Detection[],
  centers: Point[],
  unit: number,
  options: Options,
): number[][] {
  const result = groups.map((g) => [...g]);
  const valid = (g: number[]) =>
    completeMeld(
      alongFan(g, centers).map((i) => cards[i]!.card),
      { ...options, ordered: false },
    ) !== null;
  for (const loose of groups.filter((g) => g.length === 1)) {
    const card = loose[0]!;
    const c = centers[card]!;
    const distance = (g: number[]) =>
      Math.min(...g.map((i) => Math.hypot(centers[i]!.x - c.x, centers[i]!.y - c.y))) / unit;
    const target = result
      .filter((g) => g.length > 1 && distance(g) <= ATTACH && valid([...g, card]))
      .sort((a, b) => distance(a) - distance(b))[0];
    if (!target) continue;
    target.push(card);
    result.splice(
      result.findIndex((g) => g.length === 1 && g[0] === card),
      1,
    );
  }
  return result;
}
