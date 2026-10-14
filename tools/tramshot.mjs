import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
await p.waitForTimeout(1500);
await p.evaluate(() => {
  const v = window.__game.fest.vehicles[0];
  v.speed = 0; v.cur = 0; // hold the tram still for the photo
  const pos = v.g.position, yaw = v.g.rotation.y;
  // stand on the road 13 m ahead of the tram, looking back at it from a little to the side
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  window.__anandapur.teleport(pos.x + fx * 13, pos.z + fz * 13, yaw + Math.PI);
  const c = window.__game.cam; c.yaw = yaw + Math.PI - 0.7; c.targetDistance = 5; c.pitch = 0.12;
});
await p.waitForTimeout(1500);
await p.screenshot({ path: 'docs/screenshots/dev/v-tram.png' });
await b.close();
