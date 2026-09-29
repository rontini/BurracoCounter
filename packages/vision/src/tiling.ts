export interface Tile {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TilingOptions {
  tileSize: number;
  /** Sovrapposizione minima tra riquadri adiacenti, in frazione del lato (0.2–0.25). */
  overlap: number;
}

const DEFAULTS: TilingOptions = { tileSize: 640, overlap: 0.2 };

/** Posizioni di partenza lungo un asse, distribuite in modo uniforme. */
function starts(length: number, tile: number, overlap: number): number[] {
  if (length <= tile) return [0];
  const stride = tile * (1 - overlap);
  const count = Math.ceil((length - tile) / stride) + 1;
  const step = (length - tile) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(i * step));
}

/**
 * Riquadri che coprono l'immagine con una sovrapposizione almeno pari a
 * `overlap`. Un lato più corto del riquadro dà riquadri più piccoli: il
 * worker li completa con un bordo (letterbox in basso a destra).
 */
export function computeTiles(
  width: number,
  height: number,
  options: Partial<TilingOptions> = {},
): Tile[] {
  const { tileSize, overlap } = { ...DEFAULTS, ...options };
  const tiles: Tile[] = [];
  for (const y of starts(height, tileSize, overlap)) {
    for (const x of starts(width, tileSize, overlap)) {
      tiles.push({ x, y, width: Math.min(tileSize, width), height: Math.min(tileSize, height) });
    }
  }
  return tiles;
}

/** Dimensioni con il lato lungo al massimo `maxSide`, senza ingrandire. */
export function fitWithin(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale), scale };
}
