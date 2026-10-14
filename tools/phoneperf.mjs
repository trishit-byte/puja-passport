import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
if (!process.env.FRESH) await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto((process.env.URL ?? 'http://10.128.146.164:5173/') + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.argv[2] || 4) });
console.log('quality', await p.evaluate(() => window.__game.data.settings.quality), 'npcs', await p.evaluate(() => window.__game.city.npcs.length));
for (const [x, z] of [[-72, -30], [0, -6], [60, 100]]) {
  await p.evaluate(([x, z]) => window.__anandapur.teleport(x, z, 0), [x, z]);
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => new Promise((res) => { const ts = []; let last = performance.now(); const f = () => { const n = performance.now(); ts.push(n - last); last = n; if (ts.length < 120) requestAnimationFrame(f); else res(ts); }; requestAnimationFrame(f); }));
  r.sort((a, b) => a - b);
  console.log([x, z], 'frame ms p50', r[60].toFixed(1), 'p90', r[108].toFixed(1), 'dpr', await p.evaluate(() => window.__game.renderer.renderer.getPixelRatio().toFixed(2)));
}
await b.close();
