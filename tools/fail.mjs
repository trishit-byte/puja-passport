import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
for (const [w, h, touch] of [[1600, 900, false], [390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })); } });
  const p = await ctx.newPage();
  await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
  await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
  await p.evaluate(() => { window.__anandapur.completePandal('bonedi-bari'); window.__anandapur.completePandal('dhaker-taal'); });
  await p.waitForTimeout(4000);
  await p.evaluate(() => window.__anandapur.setElapsed(2700 - 1));
  await p.waitForTimeout(6000);
  await p.screenshot({ path: `docs/screenshots/dev/fail-${w}.png` });
  await ctx.close();
}
await b.close();
