import { defineConfig } from 'vite';

export default defineConfig({
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:4777',
      '/ws': { target: 'ws://127.0.0.1:4777', ws: true },
    },
  },
});
