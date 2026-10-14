// Street-level views around the city for an aesthetic review (UI hidden).
import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
await p.evaluate(() => { document.querySelector('#ui').style.visibility = 'hidden'; });
const spots = JSON.parse(process.argv[2] || '[[-100,-20,0.5],[60,-20,2],[100,0,3],[-60,90,4],[0,60,1],[20,105,0],[-140,20,1.2],[80,60,5]]');
let i = 0;
for (const [x, z, yaw] of spots) {
  await p.evaluate(([x, z, yaw]) => { window.__anandapur.teleport(x, z, yaw); const c = window.__game.cam; c.yaw = yaw + Math.PI; c.pitch = 0.18; c.targetDistance = 7; }, [x, z, yaw]);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `docs/screenshots/dev/st-${i++}.png` });
}
await b.close();
