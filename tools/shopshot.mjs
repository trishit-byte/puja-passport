import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
const n = await p.evaluate(() => window.__game.world.shopkeepers.length);
console.log('shopkeepers', n, 'npcs', await p.evaluate(() => window.__game.city.npcs.length));
for (const i of [3, 11, 20]) {
  await p.evaluate((i) => { const k = window.__game.world.shopkeepers[i]; const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw); window.__anandapur.teleport(k.pos.x + fx * 5.5, k.pos.z + fz * 5.5, k.yaw + Math.PI); const c = window.__game.cam; c.targetDistance = 4; c.pitch = 0.05; c.yaw = k.yaw + 0.5; }, i);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `docs/screenshots/dev/shop-${i}.png` });
}
console.log(errs.join('\n') || 'no errors', JSON.stringify(await p.evaluate(() => window.__anandapur.renderInfo())));
await b.close();
