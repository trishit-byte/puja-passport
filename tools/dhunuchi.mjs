// Dhunuchi dancers: a close dancer through its 13 s cycle, and wide views at two pandals.
import { chromium } from '@playwright/test';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 560, height: 520 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true, settings: { quality: 'high' } })));
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => { document.querySelector('#ui').style.visibility = 'hidden'; window.__anandapur.setElapsed(2700 * 0.3); });
const info = await p.evaluate(() => window.__game.city.npcs.filter((n) => n.ch.pose === 'dhunuchi').length);
console.log('dhunuchi dancers:', info);
const aim = (sel, dist, h, ly, side) => p.evaluate(([sel, dist, h, ly, side]) => {
  const g = window.__game, V = g.player.pos.constructor;
  const L = g.city.npcs.filter((n) => n.ch.pose === 'dhunuchi');
  const n = L[sel % L.length];
  const pos = n.pos, yaw = n.ch.group.rotation.y + side;
  window.__anandapur.teleport(pos.x + Math.sin(yaw) * 7, pos.z + Math.cos(yaw) * 7, 0);
  g.cam.override = { pos: new V(pos.x + Math.sin(yaw) * dist, h, pos.z + Math.cos(yaw) * dist), look: new V(pos.x, ly, pos.z) };
}, [sel, dist, h, ly, side]);
await aim(0, 3.4, 1.8, 1.2, 0.9);
await p.waitForTimeout(2500);
for (let k = 0; k < 8; k++) { await p.screenshot({ path: `${out}-c${k}.png` }); await p.waitForTimeout(1600); }
await aim(3, 7.5, 3.0, 1.2, 0.3); await p.waitForTimeout(2000); await p.screenshot({ path: `${out}-w0.png` });
await aim(8, 7.5, 3.0, 1.2, -0.4); await p.waitForTimeout(2000); await p.screenshot({ path: `${out}-w1.png` });
console.log('errors', errs);
await b.close();
