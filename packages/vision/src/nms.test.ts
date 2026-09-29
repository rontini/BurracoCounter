import { describe, expect, it } from 'vitest';
import { iou, nms, type Box } from './nms';

const box = (x: number, y: number, w: number, h: number, score: number, classId = 0): Box => ({
  x,
  y,
  width: w,
  height: h,
  score,
  classId,
});

describe('iou', () => {
  it('is 1 for identical boxes and 0 for disjoint', () => {
    expect(iou(box(0, 0, 10, 10, 1), box(0, 0, 10, 10, 1))).toBe(1);
    expect(iou(box(0, 0, 10, 10, 1), box(20, 20, 10, 10, 1))).toBe(0);
  });

  it('computes partial overlap', () => {
    // intersezione 5×10 = 50, unione 150
    expect(iou(box(0, 0, 10, 10, 1), box(5, 0, 10, 10, 1))).toBeCloseTo(1 / 3);
  });
});

describe('nms', () => {
  it('keeps the best of overlapping boxes of the same class', () => {
    const kept = nms(
      [box(0, 0, 10, 10, 0.6), box(1, 1, 10, 10, 0.9), box(50, 50, 10, 10, 0.5)],
      0.5,
    );
    expect(kept.map((b) => b.score)).toEqual([0.9, 0.5]);
  });

  it('never suppresses across classes', () => {
    const kept = nms([box(0, 0, 10, 10, 0.9, 1), box(0, 0, 10, 10, 0.8, 2)], 0.5);
    expect(kept).toHaveLength(2);
  });

  it('keeps boxes below the IoU threshold', () => {
    const kept = nms([box(0, 0, 10, 10, 0.9), box(5, 0, 10, 10, 0.8)], 0.5);
    expect(kept).toHaveLength(2);
  });

  it('also suppresses boxes mostly contained in a better one (tile seams)', () => {
    // Un riquadro tagliato dal bordo del tile: piccolo, dentro quello intero.
    const kept = nms([box(0, 0, 20, 40, 0.9), box(0, 0, 20, 18, 0.7)], 0.5, 0.8);
    expect(kept).toHaveLength(1);
  });
});
