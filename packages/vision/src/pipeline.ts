import type { Detection } from '@burracount/rules';
import { cardFromLabel } from './labels';
import { nms } from './nms';
import { computeTiles, type Tile } from './tiling';
import { decodeYolo } from './yolo';

export interface ModelOutput {
  data: Float32Array;
  dims: readonly number[];
}

export interface RecognizeTilesArgs {
  /** Dimensioni dell'immagine elaborata (già ridotta). */
  width: number;
  height: number;
  /** Fattore per tornare all'immagine originale. */
  scale: number;
  photoId: string;
  labels: readonly string[];
  tileSize: number;
  overlap: number;
  scoreThreshold: number;
  iouThreshold: number;
  /** Esegue il modello su un riquadro (completato a tileSize×tileSize). */
  infer: (tile: Tile) => Promise<ModelOutput>;
}

/** Tiling, inferenza, rimappatura e NMS globale per classe. */
export async function recognizeTiles(args: RecognizeTilesArgs): Promise<Detection[]> {
  const tiles = computeTiles(args.width, args.height, {
    tileSize: args.tileSize,
    overlap: args.overlap,
  });
  const boxes = [];
  for (const tile of tiles) {
    const out = await args.infer(tile);
    boxes.push(
      ...decodeYolo(out.data, out.dims, {
        scoreThreshold: args.scoreThreshold,
        offsetX: tile.x,
        offsetY: tile.y,
        scale: args.scale,
      }),
    );
  }
  return nms(boxes, args.iouThreshold, 0.8).map((b) => ({
    card: cardFromLabel(args.labels[b.classId]!),
    bbox: { x: b.x, y: b.y, width: b.width, height: b.height },
    confidence: b.score,
    photoId: args.photoId,
  }));
}
