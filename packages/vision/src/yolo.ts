import type { Box } from './nms';

export interface DecodeOptions {
  scoreThreshold: number;
  /** Posizione del riquadro nell'immagine elaborata. */
  offsetX?: number;
  offsetY?: number;
  /** Fattore per tornare alle coordinate dell'immagine originale. */
  scale?: number;
}

/**
 * Decodifica l'uscita di un detector YOLO (Ultralytics v8/11) senza NMS:
 * forma [1, 4 + C, N], con cx, cy, w, h in pixel del riquadro e poi un
 * punteggio per classe.
 */
export function decodeYolo(
  data: Float32Array,
  dims: readonly number[],
  { scoreThreshold, offsetX = 0, offsetY = 0, scale = 1 }: DecodeOptions,
): Box[] {
  if (dims.length !== 3 || dims[0] !== 1 || dims[1]! < 5) {
    throw new Error(`Uscita del modello con forma inattesa: [${dims.join(', ')}]`);
  }
  const features = dims[1]!;
  const n = dims[2]!;
  const classes = features - 4;
  const boxes: Box[] = [];
  for (let i = 0; i < n; i++) {
    let best = 0;
    let classId = -1;
    for (let c = 0; c < classes; c++) {
      const s = data[(4 + c) * n + i]!;
      if (s > best) {
        best = s;
        classId = c;
      }
    }
    if (best < scoreThreshold) continue;
    const cx = data[i]!;
    const cy = data[n + i]!;
    const w = data[2 * n + i]!;
    const h = data[3 * n + i]!;
    boxes.push({
      x: (offsetX + cx - w / 2) * scale,
      y: (offsetY + cy - h / 2) * scale,
      width: w * scale,
      height: h * scale,
      score: best,
      classId,
    });
  }
  return boxes;
}
