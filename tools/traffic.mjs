import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
// follow the tram, then a taxi
for (const [k, name] of [[0, 'tram'], [1, 'taxi'], [3, 'auto']]) {
  await p.evaluate((k) => { const v = window.__game.fest.vehicles[k]; const pos = v.g.position; window.__anandapur.teleport(pos.x + 6, pos.z + 6, 0); const c = window.__game.cam; c.targetDistance = 9; c.pitch = 0.35; }, k);
  await p.waitForTimeout(1200);
  await p.evaluate((k) => { const v = window.__game.fest.vehicles[k]; const pos = v.g.position; window.__anandapur.teleport(pos.x - Math.sin(v.g.rotation.y) * -9 + 4, pos.z + Math.cos(v.g.rotation.y) * 9, v.g.rotation.y + Math.PI); window.__game.cam.yaw = v.g.rotation.y + 2.3; }, k);
  await p.waitForTimeout(900);
  await p.screenshot({ path: `docs/screenshots/dev/v-${name}.png` });
}
const info = await p.evaluate(() => window.__game.fest.vehicles.map((v) => ({ wheels: v.wheels.length, spin: +v.wheels[0].rotation.x.toFixed(1), speed: +v.cur.toFixed(1) })));
console.log(JSON.stringify(info));
console.log(errs.join('\n') || 'no errors');
await b.close();
