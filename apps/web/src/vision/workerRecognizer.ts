import type { CardRecognizer, RecognitionResult } from '@burracount/vision';
import type { WorkerRequest, WorkerResponse } from './protocol';

/** CardRecognizer che esegue il modello in un Web Worker: la UI non si blocca mai. */
export class WorkerRecognizer implements CardRecognizer {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (r: RecognitionResult | null) => void; reject: (e: Error) => void }
  >();
  private warm: Promise<void> | null = null;

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./recognizer.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.type === 'result') p.resolve(msg.result);
        else if (msg.type === 'ready') p.resolve(null);
        else p.reject(new Error(msg.message));
      };
      this.worker.onerror = (e) => {
        for (const p of this.pending.values()) p.reject(new Error(e.message));
        this.pending.clear();
      };
    }
    return this.worker;
  }

  private send(request: WorkerRequest): Promise<RecognitionResult | null> {
    return new Promise((resolve, reject) => {
      this.pending.set(request.id, { resolve, reject });
      this.getWorker().postMessage(request);
    });
  }

  async recognize(image: Blob, photoId: string): Promise<RecognitionResult> {
    const result = await this.send({ type: 'recognize', id: this.nextId++, image, photoId });
    return result!;
  }

  warmUp(): Promise<void> {
    this.warm ??= this.send({ type: 'warmup', id: this.nextId++ }).then(
      () => undefined,
      (err: unknown) => {
        this.warm = null;
        throw err;
      },
    );
    return this.warm;
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.warm = null;
    for (const p of this.pending.values()) p.reject(new Error('Riconoscitore chiuso'));
    this.pending.clear();
  }
}

let shared: CardRecognizer | null = null;

/** Riconoscitore condiviso dall'app; sostituibile nei test. */
export function getRecognizer(): CardRecognizer {
  shared ??= new WorkerRecognizer();
  return shared;
}

export function setRecognizer(r: CardRecognizer | null): void {
  shared = r;
}
