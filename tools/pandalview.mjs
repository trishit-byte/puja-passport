// Views of one pandal: approach to the gate, inside toward the protima, the protima close up, from above.
import { chromium } from '@playwright/test';
const [url, out, id] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 800, height: 560 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true, settings: { quality: 'high' } })));
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => { document.querySelector('#ui').style.visibility = 'hidden'; window.__anandapur.setElapsed(2700 * 0.3); });
const views = (process.env.VIEWS ? JSON.parse(process.env.VIEWS) : [['gate', 0, 30, 4, 14], ['inside', 0, 10, 2.6, -8], ['protima', 0, -4.5, 2.2, -11], ['above', 0, 26, 30, -2]]);
for (const v of views) v.splice(0, 0); // [name, local x, local z, height, look-at local z]
let k = 0;
for (const [name, lx, lz, h, tz] of views) {
  await p.evaluate(([id, lx, lz, h, tz]) => {
    const g = window.__game, V = g.player.pos.constructor;
    const pd = window.__anandapur.pandals.find((q) => q.id === id);
    const w = (x, y, z) => new V(pd.x + Math.cos(pd.facing) * x + Math.sin(pd.facing) * z, y, pd.z - Math.sin(pd.facing) * x + Math.cos(pd.facing) * z);
    const at = w(lx, h, lz);
    window.__anandapur.teleport(at.x, at.z, 0);
    const lk = Array.isArray(tz) ? w(tz[0], tz[1], tz[2]) : w(0, name === 'protima' ? 2.8 : 3, tz);
    g.cam.override = { pos: at, look: lk };
  }, [id, lx, lz, h, tz, name]);
  await p.waitForTimeout(k++ ? 1500 : 3000);
  await p.screenshot({ path: `${out}-${name}.png` });
}
console.log(id, 'errors', errs);
await b.close();
