import { defineConfig } from 'vite';
import { rmSync, mkdirSync, writeFileSync } from 'node:fs';

// `npm run build:public` (PUBLIC_BUILD=1) produces a build that is safe to put on the open web:
// the commercial songs in public/assets/audio/musics are NOT shipped — the DJ boxes fall back to
// the game's own generated festival tracks.
const PUBLIC_BUILD = process.env.PUBLIC_BUILD === '1';

export default defineConfig({
  base: './',
  plugins: [
    {
      // the raw source songs are converted into assets/audio/songs/ by scripts/prepare-music.mjs;
      // don't ship the originals a second time
      name: 'drop-raw-music',
      closeBundle() {
        rmSync('dist/assets/audio/musics', { recursive: true, force: true });
        if (PUBLIC_BUILD) {
          rmSync('dist/assets/audio/songs', { recursive: true, force: true });
          mkdirSync('dist/assets/audio/songs', { recursive: true });
          writeFileSync('dist/assets/audio/songs/available.json', JSON.stringify({ songs: [] }) + '\n');
        }
      },
    },
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // keep three.js in its own long-cacheable chunk
        manualChunks: (id: string) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
  },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
} as any);
