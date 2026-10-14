// Usage: node tools/perf.mjs <url> <gpu|swiftshader> <quality>
import { chromium } from '@playwright/test';
const [url, mode, quality] = process.argv.slice(2);
const args = mode === 'gpu' ? process.env.CHROME_GPU_ARGS.split(' ') : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const b = await chromium.launch({ headless: true, args, ignoreDefaultArgs: mode === 'gpu' ? ['--enable-unsafe-swiftshader'] : [] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript((q) => localStorage.setItem('anandapur.save', JSON.stringify({ settings: { quality: q }, tutorialDone: true })), quality);
const p = await ctx.newPage();
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__anandapur, null, { timeout: 120000 });
const renderer = await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info'); return g.getParameter(e.UNMASKED_RENDERER_WEBGL); });
await p.waitForTimeout(6000);
const res = [];
for (const [x, z, yaw] of [[-72, -30, 2.5], [0, -6, 0], [-108, -58, -1.57], [60, 100, 0]]) {
  await p.evaluate(([x, z, y]) => window.__anandapur.teleport(x, z, y), [x, z, yaw]);
  await p.keyboard.down('KeyW');
  const fps = await p.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 4000 ? requestAnimationFrame(f) : r(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
  await p.keyboard.up('KeyW');
  const st = await p.evaluate(() => window.__anandapur.frameStats());
  const ri = await p.evaluate(() => window.__anandapur.renderInfo());
  res.push({ at: [x, z], fps: +fps.toFixed(1), cpuP50: st.p50, cpuP95: st.p95, dprScale: st.dprScale, calls: ri.calls, tris: ri.triangles });
}
console.log(JSON.stringify({ mode, quality, renderer, res }, null, 1));
await b.close();
