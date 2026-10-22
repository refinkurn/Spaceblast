import { defineConfig } from 'vitest/config';
import { devRelay } from './server/dev_relay';
import { offlineCache } from './server/offline_cache';

export default defineConfig(({ isSsrBuild }) => ({
  // Relative asset paths so the same build works on GitHub Pages, itch.io,
  // web portals and inside the Capacitor app.
  base: './',
  plugins: [devRelay(), offlineCache()],
  // `npm run build:server` (an SSR build of server/fly.ts) needs no icons or manifest.
  build: { target: 'es2022', chunkSizeWarningLimit: 800, copyPublicDir: !isSsrBuild },
  test: { include: ['server/**/*.test.ts', 'src/**/*.test.ts'], environment: 'node', css: { include: [/style\.css/, /story_map\.css/] } },
}));
