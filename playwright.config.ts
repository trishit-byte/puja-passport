import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * E2E tests run against the production build (vite preview). On this project's headless Linux GPU
 * host, Chromium needs extra libraries and EGL flags to use the real GPU; those are applied only
 * when `.chromelibs/only` exists, so the suite also runs unchanged on an ordinary desktop.
 */
const libs = resolve('.chromelibs/only');
const gpuHost = existsSync(libs);
const PORT = 4179;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    launchOptions: gpuHost
      ? {
          args: ['--use-angle=gl-egl', '--use-gl=angle', '--ozone-platform=headless', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--autoplay-policy=no-user-gesture-required'],
          ignoreDefaultArgs: ['--enable-unsafe-swiftshader'],
          env: { ...process.env, LD_LIBRARY_PATH: libs, __EGL_VENDOR_LIBRARY_FILENAMES: '/usr/share/glvnd/egl_vendor.d/10_nvidia.json' },
        }
      : { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
