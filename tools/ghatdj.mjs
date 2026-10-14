// The riverside DJ podium: views from the promenade, from the river side and from above.
import { chromium } from '@playwright/test';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 800, height: 520 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => { document.querySelector('#ui').style.visibility = 'hidden'; window.__anandapur.setElapsed(2700 * 0.3); });
const bx = await p.evaluate(() => { const b = window.__game.djs.boxes.reduce((a, c) => (c.z > a.z ? c : a)); return { x: b.x, z: b.z }; });
for (const [k, [dx, dz, h, ly]] of [[-2, -13, 3.5, 0.5], [9, 9, 2.0, 0], [-10, 6, 1.5, -0.5], [0.5, 0.5, 26, 0]].entries()) {
  await p.evaluate(([bx, dx, dz, h, ly]) => { const g = window.__game, V = g.player.pos.constructor; window.__anandapur.teleport(bx.x + dx * 1.5, bx.z - 14, 0); g.cam.override = { pos: new V(bx.x + dx, h, bx.z + dz), look: new V(bx.x, ly, bx.z) }; }, [bx, dx, dz, h, ly]);
  await p.waitForTimeout(k ? 1500 : 3000);
  await p.screenshot({ path: `${out}-${k}.png` });
}
// walk onto the podium from the promenade and check the player's height
const walk = await p.evaluate(([bx]) => { const g = window.__game; g.cam.override = null; window.__anandapur.teleport(bx.x, bx.z - 9, 0); return null; }, [bx]);
void walk;
await p.keyboard.down('KeyW'); await p.waitForTimeout(2200); await p.keyboard.up('KeyW');
console.log('player on podium:', JSON.stringify(await p.evaluate(([bx]) => { const q = window.__game.player.pos; return { x: +q.x.toFixed(1), z: +q.z.toFixed(1), y: +q.y.toFixed(2), dFromCentre: +Math.hypot(q.x - bx.x, q.z - bx.z).toFixed(1) }; }, [bx])));
await b.close();
