// Close views of each food stall, two angles each. node tools/stallclose.mjs <url> <outPrefix> [ids]
import { chromium } from '@playwright/test';
const [url, out, ids = 'phuchka,chowmein,roll,cha,jhalmuri,mishti'] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 800, height: 600 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => { document.querySelector('#ui').style.visibility = 'hidden'; });
const list = await p.evaluate(() => window.__game.city.stallVendors.map((v) => ({ id: v.id, x: v.front.x, z: v.front.z, yaw: v.yaw })));
for (const id of ids.split(',')) {
  const v = list.find((s) => s.id === id);
  for (const [k, [ang, dist, h]] of [[0.35, 2.6, 1.9], [-0.9, 2.2, 2.2]].entries()) {
    await p.evaluate(([v, ang, dist, h]) => {
      const g = window.__game, V = g.player.pos.constructor;
      // stall centre is ~1.3 m behind the customer spot
      const cx = v.x - Math.sin(v.yaw) * 1.3, cz = v.z - Math.cos(v.yaw) * 1.3;
      const a = v.yaw + ang;
      window.__anandapur.teleport(cx + Math.sin(a) * 9, cz + Math.cos(a) * 9, 0);
      g.cam.override = { pos: new V(cx + Math.sin(a) * dist, h, cz + Math.cos(a) * dist), look: new V(cx, 1.0, cz) };
    }, [v, ang, dist, h]);
    await p.waitForTimeout(k ? 1300 : 2600);
    await p.screenshot({ path: `${out}-${id}-${k}.png` });
  }
}
await b.close();
