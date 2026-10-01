import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Gli header COOP/COEP abilitano la cross-origin isolation richiesta da
// ONNX Runtime Web con WASM multi-thread (CLAUDE.md §6). In produzione
// arrivano dal file `public/_headers` di Cloudflare Pages.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // L'utente sceglie quando aggiornare (avviso "Aggiorna", CLAUDE.md §9).
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'BurraCount',
        short_name: 'BurraCount',
        description: 'Il segnapunti del burraco, anche dalla foto delle carte.',
        lang: 'it',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f4ee',
        theme_color: '#0f6b3f',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App, WASM di ONNX Runtime e modello in cache al primo avvio: poi tutto offline.
        globPatterns: ['**/*.{js,mjs,css,html,png,svg,wasm,onnx,json}'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // Il worker del riconoscimento è un modulo ES (importa onnxruntime-web).
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
});
