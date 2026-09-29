import { defineProject } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineProject({
  plugins: [react()],
  resolve: {
    alias: {
      'virtual:pwa-register/react': new URL('./src/test-pwa-stub.ts', import.meta.url).pathname,
    },
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
