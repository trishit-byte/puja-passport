import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || /NaN/.test(m.text())) errs.push(m.text().slice(0, 200)); });
await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
const info = await p.evaluate(() => ({ npcs: window.__game.city.npcs.length, walkers: window.__game.city.npcs.filter((n) => n.role === 'walker').length, onRoad: window.__game.city.npcs.filter((n) => n.onRoad).length, vehicles: window.__game.fest.vehicles.length }));
console.log(JSON.stringify(info));
for (const [k, name] of [[13, 'rickshaw'], [17, 'bike']]) {
  await p.evaluate((k) => { const v = window.__game.fest.vehicles[k]; v.speed = 0; v.cur = 0; const pos = v.g.position, yaw = v.g.rotation.y; window.__anandapur.teleport(pos.x + Math.sin(yaw) * 7, pos.z + Math.cos(yaw) * 7, yaw + Math.PI); const c = window.__game.cam; c.yaw = yaw - 0.9; c.targetDistance = 4; c.pitch = 0.15; document.querySelector('#ui').style.visibility = 'hidden'; }, k);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `docs/screenshots/dev/v-${name}.png` });
}
// time-of-day density
for (const h of [0, 4, 9.5]) {
  await p.evaluate((h) => window.__anandapur.setElapsed(h / 10 * 45 * 60), h);
  await p.waitForTimeout(400);
  console.log('h', h, 'density', await p.evaluate(() => window.__game.city.density.toFixed(2)), 'visible walkers', await p.evaluate(() => window.__game.city.npcs.filter((n) => n.role === 'walker' && (n.rank ?? 0) <= window.__game.city.density).length));
}
console.log(errs.join('\n') || 'no errors');
await b.close();
