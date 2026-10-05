import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), city: resolve(import.meta.dirname, 'city.html'), characters: resolve(import.meta.dirname, 'characters.html') },
    },
  },
});
