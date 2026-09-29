import { describe, expect, it } from 'vitest';
import { decodeYolo } from './yolo';

/** Costruisce un output [1, 4 + C, N] in layout Ultralytics (feature-major). */
function output(
  anchors: { cx: number; cy: number; w: number; h: number; scores: number[] }[],
  classes: number,
) {
  const n = anchors.length;
  const data = new Float32Array((4 + classes) * n);
  anchors.forEach((a, i) => {
    data[0 * n + i] = a.cx;
    data[1 * n + i] = a.cy;
    data[2 * n + i] = a.w;
    data[3 * n + i] = a.h;
    a.scores.forEach((s, c) => (data[(4 + c) * n + i] = s));
  });
  return { data, dims: [1, 4 + classes, n] as const };
}

describe('decodeYolo', () => {
  it('keeps anchors above the threshold with their best class', () => {
    const out = output(
      [
        { cx: 100, cy: 50, w: 20, h: 40, scores: [0.1, 0.9, 0.2] },
        { cx: 10, cy: 10, w: 5, h: 5, scores: [0.1, 0.1, 0.2] },
      ],
      3,
    );
    const boxes = decodeYolo(out.data, out.dims, { scoreThreshold: 0.25 });
    expect(boxes).toEqual([
      { x: 90, y: 30, width: 20, height: 40, score: expect.closeTo(0.9), classId: 1 },
    ]);
  });

  it('maps tile coordinates back to the image', () => {
    const out = output([{ cx: 320, cy: 320, w: 64, h: 64, scores: [0.8] }], 1);
    const [b] = decodeYolo(out.data, out.dims, {
      scoreThreshold: 0.25,
      // Il riquadro è a (1000, 500) nell'immagine ridotta, che è metà dell'originale.
      offsetX: 1000,
      offsetY: 500,
      scale: 2,
    });
    expect(b).toMatchObject({ x: (1000 + 288) * 2, y: (500 + 288) * 2, width: 128, height: 128 });
  });

  it('rejects unexpected shapes', () => {
    expect(() => decodeYolo(new Float32Array(10), [1, 10], { scoreThreshold: 0.5 })).toThrow(
      /forma/,
    );
  });
});
