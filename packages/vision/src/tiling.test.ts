import { describe, expect, it } from 'vitest';
import { computeTiles, fitWithin } from './tiling';

describe('computeTiles', () => {
  it('covers a small image with a single tile', () => {
    expect(computeTiles(500, 400)).toEqual([{ x: 0, y: 0, width: 500, height: 400 }]);
  });

  it('covers the image with overlapping 640 tiles', () => {
    const tiles = computeTiles(1600, 1200, { tileSize: 640, overlap: 0.2 });
    // Ogni pixel è coperto.
    for (const [px, py] of [
      [0, 0],
      [1599, 1199],
      [800, 600],
      [1599, 0],
    ] as const) {
      expect(tiles.some((t) => px >= t.x && px < t.x + t.width && py >= t.y && py < t.y + t.height)).toBe(true);
    }
    // Tutti i riquadri sono 640×640 e dentro l'immagine.
    for (const t of tiles) {
      expect(t.width).toBe(640);
      expect(t.height).toBe(640);
      expect(t.x + t.width).toBeLessThanOrEqual(1600);
      expect(t.y + t.height).toBeLessThanOrEqual(1200);
    }
  });

  it('keeps the overlap between 20% and the requested value or more', () => {
    const tiles = computeTiles(3000, 640, { tileSize: 640, overlap: 0.2 });
    const xs = [...new Set(tiles.map((t) => t.x))].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      const overlap = 640 - (xs[i]! - xs[i - 1]!);
      expect(overlap).toBeGreaterThanOrEqual(0.2 * 640);
    }
    expect(xs[xs.length - 1]! + 640).toBe(3000);
  });

  it('handles one side smaller than the tile', () => {
    const tiles = computeTiles(2000, 300, { tileSize: 640, overlap: 0.25 });
    expect(tiles.every((t) => t.height === 300 && t.y === 0)).toBe(true);
  });
});

describe('fitWithin', () => {
  it('scales the long side down to the maximum', () => {
    expect(fitWithin(4000, 3000, 3000)).toEqual({ width: 3000, height: 2250, scale: 0.75 });
  });

  it('never upscales', () => {
    expect(fitWithin(800, 600, 3000)).toEqual({ width: 800, height: 600, scale: 1 });
  });
});
