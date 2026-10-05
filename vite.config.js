import { defineConfig } from 'vite';

// Relative base so the built game also runs from a sub-path (e.g. a published artifact).
export default defineConfig({ base: './' });
