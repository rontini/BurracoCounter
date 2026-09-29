import type { RecognitionResult } from '@burracount/vision';

export type WorkerRequest =
  { type: 'recognize'; id: number; image: Blob; photoId: string } | { type: 'warmup'; id: number };

export type WorkerResponse =
  | { type: 'result'; id: number; result: RecognitionResult }
  | { type: 'ready'; id: number }
  | { type: 'error'; id: number; message: string };
