import { defineConfig } from 'vitest/config';
import { devRelay } from './server/dev_relay';

export default defineConfig({
  // Relative asset paths so the same build works on GitHub Pages, itch.io,
  // web portals and inside the Capacitor app.
  base: './',
  plugins: [devRelay()],
  build: { target: 'es2022', chunkSizeWarningLimit: 800 },
  test: { include: ['server/**/*.test.ts', 'src/**/*.test.ts'], environment: 'node', css: { include: [/style\.css/] } },
});
