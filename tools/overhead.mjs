// Overhead shots at given points: node tools/overhead.mjs <url> <out> "x,z,h;x,z,h"
import { chromium } from '@playwright/test';
const [url, out, spots] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 700, height: 700 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => { document.querySelector('#ui').style.visibility = 'hidden'; });
let i = 0;
for (const s of spots.split(';')) {
  const [x, z, h] = s.split(',').map(Number);
  await p.evaluate(([x, z, h]) => { const g = window.__game; window.__anandapur.teleport(x + 0.5, z + 12, 0); const V = g.player.pos.constructor; g.cam.override = { pos: new V(x, h, z + h * 0.35), look: new V(x, 0, z) }; }, [x, z, h]);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}-${i++}.png` });
}
await b.close();
