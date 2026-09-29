export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  classId: number;
}

function intersection(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

export function iou(a: Box, b: Box): number {
  const inter = intersection(a, b);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * Non-maximum suppression per classe. Con `containment` scarta anche i box
 * contenuti per quella frazione in uno migliore della stessa classe: succede
 * quando un indice viene tagliato dal bordo di un riquadro.
 */
export function nms(boxes: Box[], iouThreshold: number, containment = 1.01): Box[] {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const kept: Box[] = [];
  for (const candidate of sorted) {
    const suppressed = kept.some((k) => {
      if (k.classId !== candidate.classId) return false;
      if (iou(k, candidate) > iouThreshold) return true;
      const area = Math.min(candidate.width * candidate.height, k.width * k.height);
      return area > 0 && intersection(k, candidate) / area > containment;
    });
    if (!suppressed) kept.push(candidate);
  }
  return kept;
}
