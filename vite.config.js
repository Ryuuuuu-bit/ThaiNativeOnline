import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  define: { __BUILD__: JSON.stringify(Date.now().toString(36)) },   // cache stamp for big assets (src/core/version.js)
  // `npm run dev` with `npm run server` beside it: the realtime link goes to the server
  server: { proxy: { '/ws': { target: 'ws://127.0.0.1:8787', ws: true } } },
  build: {
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html') },
    },
  },
});
