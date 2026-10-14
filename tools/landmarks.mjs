// Views of each landmark (statues, mandir): a front view and a close-up of the figure.
import { chromium } from '@playwright/test';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 600, height: 600 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true, settings: { quality: 'high' } })));
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => { document.querySelector('#ui').style.visibility = 'hidden'; });
const marks = [['netaji-bazaar', -7, 16], ['netaji-notun', 117, -6], ['vivekananda', -79, -32], ['tagore', 61, -108], ['shiva-mandir', 60, -158]];
let k = 0;
for (const [id, x, z] of marks) {
  const big = id === 'shiva-mandir';
  for (const [name, dist, h, ly] of big ? [['wide', 22, 9, 2]] : [['wide', 9, 3.2, 2.2], ['close', 3.6, 4.4, 3.8]]) {
    await p.evaluate(([x, z, dist, h, ly]) => {
      const g = window.__game, V = g.player.pos.constructor;
      const n = g.world.field.nearest(x, z), yaw = Math.atan2(n.x - x, n.z - z) + 0.35;
      window.__anandapur.teleport(x + Math.sin(yaw) * (dist + 4), z + Math.cos(yaw) * (dist + 4), 0);
      g.cam.override = { pos: new V(x + Math.sin(yaw) * dist, h, z + Math.cos(yaw) * dist), look: new V(x, ly, z) };
    }, [x, z, dist, h, ly]);
    await p.waitForTimeout(k++ ? 1400 : 3000);
    await p.screenshot({ path: `${out}-${id}-${name}.png` });
  }
}
console.log('errors', errs);
await b.close();
