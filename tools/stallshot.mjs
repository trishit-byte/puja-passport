import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://10.128.146.164:5173/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
const list = await p.evaluate(() => window.__game.city.stallVendors.map((v) => ({ id: v.id, x: v.front.x, z: v.front.z, yaw: v.yaw })));
console.log(list.map((v) => v.id).join(','));
for (const id of (process.argv[2] || 'phuchka,chowmein,roll').split(',')) {
  const v = list.find((s) => s.id === id);
  await p.evaluate((v) => { const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw); window.__anandapur.teleport(v.x + fx * 2.2, v.z + fz * 2.2, v.yaw + Math.PI); const c = window.__game.cam; c.yaw = v.yaw + 0.55; c.targetDistance = 4.2; c.pitch = 0.25; document.querySelector('.hud').style.display = 'none'; window.__game.minimap.el.style.display = 'none'; }, v);
  await p.waitForTimeout(1600);
  await p.screenshot({ path: `docs/screenshots/dev/stall-${id}.png` });
}
console.log(errs.join('\n') || 'no errors');
await b.close();
