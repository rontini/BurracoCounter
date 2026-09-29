import { describe, expect, it } from 'vitest';
import { recognizeTiles } from './pipeline';
import type { Tile } from './tiling';

describe('recognizeTiles', () => {
  it('runs every tile, remaps, merges duplicates across seams and builds detections', async () => {
    const seen: Tile[] = [];
    const detections = await recognizeTiles({
      width: 1000,
      height: 640,
      scale: 1,
      photoId: 'p1',
      labels: ['AS', 'KH'],
      tileSize: 640,
      overlap: 0.25,
      scoreThreshold: 0.3,
      iouThreshold: 0.5,
      infer: async (tile) => {
        seen.push(tile);
        // Lo stesso asso di picche visto da entrambi i riquadri, a x=500 nell'immagine.
        const cx = 500 - tile.x;
        const n = 1;
        const data = new Float32Array(6 * n);
        data[0] = cx;
        data[1] = 100;
        data[2] = 20;
        data[3] = 40;
        data[4] = tile.x === 0 ? 0.9 : 0.8;
        data[5] = 0.1;
        return { data, dims: [1, 6, n] };
      },
    });
    expect(seen.length).toBeGreaterThan(1);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toEqual({
      card: { rank: 'A', suit: 'S' },
      bbox: { x: 490, y: 80, width: 20, height: 40 },
      confidence: expect.closeTo(0.9),
      photoId: 'p1',
    });
  });
});
