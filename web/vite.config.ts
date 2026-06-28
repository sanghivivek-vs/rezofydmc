import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The SPA talks to the DMC REST API. In dev, proxy /v1 to the API so there is no
// CORS friction (override the target with VITE_API_PROXY).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
