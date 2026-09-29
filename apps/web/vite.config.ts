import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Gli header COOP/COEP abilitano la cross-origin isolation richiesta da
// ONNX Runtime Web con WASM multi-thread (CLAUDE.md §6). In produzione
// arrivano dal file `_headers` di Cloudflare Pages (M5).
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [react()],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
});
