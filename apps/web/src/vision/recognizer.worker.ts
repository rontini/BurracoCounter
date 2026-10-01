/// <reference lib="webworker" />
// Solo WASM: il binario con WebGPU (27 MiB) supera il limite di 25 MiB per file
// di Cloudflare Pages (docs/decisions.md, D15).
import * as ort from 'onnxruntime-web/wasm';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import wasmModuleUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import { fitWithin, recognizeTiles, type Tile } from '@burracount/vision';
import type { WorkerRequest, WorkerResponse } from './protocol';

// CLAUDE.md §6: lato lungo al massimo 3000 px, riquadri 640 sovrapposti del 20–25%.
const MAX_SIDE = 3000;
const TILE = 640;
const OVERLAP = 0.22;
const SCORE = 0.25;
const IOU = 0.5;
const MODELS = `${import.meta.env.BASE_URL}models/`;

/** Descrizione del modello in uso: si cambia modello sostituendo i file in public/models. */
interface ModelManifest {
  model: string;
  name: string;
  labels: string[];
}

ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: wasmModuleUrl };
// Multi-thread solo con cross-origin isolation (header COOP/COEP).
ort.env.wasm.numThreads = self.crossOriginIsolated
  ? Math.min(4, self.navigator.hardwareConcurrency || 1)
  : 1;

let sessionPromise: Promise<{
  session: ort.InferenceSession;
  backend: string;
  labels: string[];
}> | null = null;

/**
 * Al primo avvio il service worker mette in cache lo stesso file in parallelo:
 * niente cache HTTP (evita errori di scrittura concorrente) e un secondo tentativo.
 * Dopo l'installazione il file arriva dalla cache del service worker.
 */
async function fetchFile(url: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${url} non disponibile (HTTP ${res.status})`);
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function createSession() {
  const manifest = (await (await fetchFile(`${MODELS}cards.json`)).json()) as ModelManifest;
  const model = await (await fetchFile(`${MODELS}${manifest.model}`)).arrayBuffer();
  const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
  const outputs = session.outputNames.length;
  if (outputs !== 1) throw new Error(`Il modello ha ${outputs} uscite, ne serve una`);
  return { session, backend: `wasm×${ort.env.wasm.numThreads}`, labels: manifest.labels };
}

function getSession() {
  sessionPromise ??= createSession().catch((err: unknown) => {
    sessionPromise = null;
    throw err;
  });
  return sessionPromise;
}

/** Crea la sessione ed esegue un riquadro vuoto: compila i kernel prima della prima foto. */
async function warmUp() {
  const { session } = await getSession();
  const input = new Float32Array(3 * TILE * TILE).fill(114 / 255);
  await session.run({
    [session.inputNames[0]!]: new ort.Tensor('float32', input, [1, 3, TILE, TILE]),
  });
}

async function recognize(image: Blob, photoId: string) {
  const started = performance.now();
  const { session, backend, labels } = await getSession();
  // imageOrientation applica la rotazione EXIF delle foto del telefono.
  const bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' });
  const fit = fitWithin(bitmap.width, bitmap.height, MAX_SIDE);
  const source = new OffscreenCanvas(fit.width, fit.height);
  source.getContext('2d')!.drawImage(bitmap, 0, 0, fit.width, fit.height);
  bitmap.close();

  const tileCanvas = new OffscreenCanvas(TILE, TILE);
  const ctx = tileCanvas.getContext('2d', { willReadFrequently: true })!;
  const input = new Float32Array(3 * TILE * TILE);
  let inferenceMs = 0;
  let tiles = 0;

  const infer = async (tile: Tile) => {
    ctx.fillStyle = 'rgb(114, 114, 114)';
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.drawImage(source, tile.x, tile.y, tile.width, tile.height, 0, 0, tile.width, tile.height);
    const { data } = ctx.getImageData(0, 0, TILE, TILE);
    const plane = TILE * TILE;
    for (let p = 0, i = 0; p < plane; p++, i += 4) {
      input[p] = data[i]! / 255;
      input[plane + p] = data[i + 1]! / 255;
      input[2 * plane + p] = data[i + 2]! / 255;
    }
    const t0 = performance.now();
    const feeds = {
      [session.inputNames[0]!]: new ort.Tensor('float32', input, [1, 3, TILE, TILE]),
    };
    const output = (await session.run(feeds))[session.outputNames[0]!]!;
    inferenceMs += performance.now() - t0;
    tiles++;
    return { data: (await output.getData()) as Float32Array, dims: output.dims };
  };

  const detections = await recognizeTiles({
    width: fit.width,
    height: fit.height,
    scale: 1 / fit.scale,
    photoId,
    labels,
    tileSize: TILE,
    overlap: OVERLAP,
    scoreThreshold: SCORE,
    iouThreshold: IOU,
    infer,
  });

  return {
    detections,
    width: Math.round(fit.width / fit.scale),
    height: Math.round(fit.height / fit.scale),
    timings: { totalMs: performance.now() - started, inferenceMs, tiles, backend },
  };
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  let response: WorkerResponse;
  try {
    if (msg.type === 'warmup') {
      await warmUp();
      response = { type: 'ready', id: msg.id };
    } else {
      response = { type: 'result', id: msg.id, result: await recognize(msg.image, msg.photoId) };
    }
  } catch (err) {
    response = { type: 'error', id: msg.id, message: (err as Error).message ?? String(err) };
  }
  self.postMessage(response);
};
