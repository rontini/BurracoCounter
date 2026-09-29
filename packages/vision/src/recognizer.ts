import type { Detection } from '@burracount/rules';

export interface RecognitionResult {
  detections: Detection[];
  /** Dimensioni dell'immagine originale (orientamento EXIF già applicato). */
  width: number;
  height: number;
  timings: { totalMs: number; inferenceMs: number; tiles: number; backend: string };
}

/**
 * Tutto il riconoscimento passa da qui (CLAUDE.md §2): si può sostituire il
 * modello, o usare un altro riconoscitore, senza toccare la UI.
 */
export interface CardRecognizer {
  recognize(image: Blob, photoId: string): Promise<RecognitionResult>;
  /** Carica il modello in anticipo, così la prima foto non paga l'avvio. */
  warmUp(): Promise<void>;
  dispose(): void;
}
