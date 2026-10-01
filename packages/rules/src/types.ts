export type Suit = 'C' | 'D' | 'H' | 'S';

export type Rank =
  'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'JOKER';

export interface Card {
  rank: Rank;
  /** null solo per il jolly. */
  suit: Suit | null;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  card: Card;
  bbox: BoundingBox;
  confidence: number;
  photoId: string;
}

export type MeldKind = 'run' | 'set';

/** La matta (jolly o pinella usata come jolly) e la carta che sostituisce. */
export interface WildAssignment {
  /** Indice della matta in `Meld.cards`. */
  index: number;
  /** Rango che la matta rappresenta. In un tris è il rango del tris. */
  represents: Exclude<Rank, 'JOKER'>;
}

export interface Meld {
  kind: MeldKind;
  /** Carte in ordine: in una scala dal basso verso l'alto, matta inclusa nella sua posizione. */
  cards: Card[];
  wild: WildAssignment | null;
}

export interface TeamHandResult {
  teamId: string;
  melds: Meld[];
  /** Carte rimaste in mano, una lista per giocatore. */
  hands: Card[][];
  closed: boolean;
  pozzettoTaken: boolean;
}

export interface HandResult {
  teams: TeamHandResult[];
}

export type BurracoKind = 'pulito' | 'semipulito' | 'sporco';

export interface CardValues {
  low: number; // 3–7
  high: number; // 8–K
  ace: number;
  pinella: number;
  joker: number;
}

export interface VictoryPointRow {
  /** Differenza massima (inclusa) coperta dalla riga; null per l'ultima riga. */
  maxDiff: number | null;
  winner: number;
  loser: number;
}

export interface VictoryPointTable {
  name: string;
  rows: VictoryPointRow[];
}

export type EndCondition =
  | { type: 'target'; target: number }
  | {
      type: 'victoryPoints';
      handsPerRound: number;
      /** Numero di turni da giocare; null = finché i giocatori non chiudono la partita. */
      rounds: number | null;
      table: VictoryPointTable | null;
    };

export interface RuleSet {
  cardValues: CardValues;
  burracoMinCards: number;
  burracoPulito: number;
  /** null = semipulito disattivato (conta come sporco). */
  burracoSemipulito: number | null;
  burracoSporco: number;
  closing: number;
  /** Penalità (valore positivo, viene sottratto) per chi non ha preso il pozzetto. */
  pozzettoNotTaken: number;
  /** Consente il tris di 2 (pinelle tutte naturali). */
  allowSetOfTwos: boolean;
  endCondition: EndCondition;
}

export type GameMode = '2v2' | '1v1' | '1v1v1';

/**
 * full: inserimento completo (foto o carte a mano, chiusura e pozzetto per squadra).
 * simple: una foto per squadra, un tocco per chi ha chiuso, pozzetto preso di default.
 */
export type EntryMode = 'full' | 'simple';

export interface Team {
  id: string;
  name: string;
  players: string[];
}

export interface MeldScore {
  meld: Meld;
  cardPoints: number;
  burraco: BurracoKind | null;
  burracoBonus: number;
}

export interface TeamScore {
  teamId: string;
  meldCardPoints: number;
  burracoBonus: number;
  closingBonus: number;
  pozzettoPenalty: number;
  handPenalty: number;
  /** base = punti delle carte calate − carte in mano. */
  base: number;
  total: number;
  melds: MeldScore[];
}

export interface PlayedHand {
  id: string;
  playedAt: string;
  result: HandResult;
}

export interface Match {
  id: string;
  name: string;
  createdAt: string;
  mode: GameMode;
  /** Assente nelle partite salvate prima della modalità semplice: vale 'full'. */
  entryMode?: EntryMode;
  teams: Team[];
  ruleSet: RuleSet;
  hands: PlayedHand[];
  /** Impostato quando la partita è chiusa manualmente. */
  finishedAt: string | null;
}
