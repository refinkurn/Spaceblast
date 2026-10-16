import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the same build works on GitHub Pages, itch.io,
  // web portals and inside the Capacitor app.
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 800 },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
