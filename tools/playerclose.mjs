import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto('http://10.128.146.164:5173/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
await p.evaluate(() => window.__anandapur.setStage(2));
const dj = (await p.evaluate(() => window.__anandapur.djBoxes()))[0];
const spots = [[-72, -30, 2.5, 'n-start'], [-112, -60, -1.57, 'n-bonedi'], [34, -30, Math.PI, 'n-dhak'], [dj.x + 3, dj.z, -1.57, 'n-dj'], [2, -86, Math.PI, 'n-arches'], [40, 80, 0, 'n-nodir']];
for (const [x, z, yaw, n] of spots) {
  await p.evaluate(([x, z, yaw]) => { const a = window.__anandapur; a.teleport(x, z, yaw); const c = window.__game.cam; c.targetDistance = 3.2; c.pitch = 0.1; }, [x, z, yaw]);
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `docs/screenshots/dev/pc-${n}.png`, clip: { x: 500, y: 250, width: 600, height: 600 } });
}
await b.close();
