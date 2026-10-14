import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
for (const [w, h, t] of [[1440, 900, false], [390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: t, hasTouch: t, deviceScaleFactor: t ? 2 : 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })); } });
  const p = await ctx.newPage();
  await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
  await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
  for (const id of ['bonedi-bari', 'alor-utsav', 'neel-shagor']) { await p.evaluate((id) => window.__anandapur.completePandal(id), id); await p.waitForTimeout(3500); }
  await p.evaluate(() => { const g = window.__game; g.data.discovered.push('gram-bangla'); });
  await p.keyboard.press('KeyP');
  await p.waitForTimeout(800);
  await p.screenshot({ path: `docs/screenshots/dev/pp-${w}.png` });
  await ctx.close();
}
await b.close();
