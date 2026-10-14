// Screenshots the loading screen (mid-load) and the title screen at desktop and phone sizes.
// Usage: node tools/titleshot.mjs <url> <outDir>
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const [url = 'http://10.128.146.164:5173/', out = 'docs/screenshots/dev/title'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
for (const [name, opt] of [['desktop', { viewport: { width: 1440, height: 860 } }], ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent }], ['phone-land', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent }]]) {
  const ctx = await b.newContext(opt);
  await ctx.addInitScript(() => { const rm = Element.prototype.remove; Element.prototype.remove = function () { if (window.__hold && this.classList?.contains('loading')) return; return rm.call(this); }; window.__hold = true; });
  const p = await ctx.newPage();
  await p.goto(url);
  await p.waitForSelector('.ld-diya', { timeout: 60000 });
  // hold the loading screen on screen (it fades the moment the city is built)
  const hold = await p.addStyleTag({ content: '.loading, .loading.fade { opacity: 1 !important; z-index: 50 !important; }' });
  await p.waitForSelector('.title-screen', { timeout: 120000 });
  await p.waitForTimeout(1500);
  // freeze the progress so the shot shows a half-lit row of diyas
  await p.evaluate(() => document.querySelectorAll('.ld-diya').forEach((d, i) => d.classList.toggle('lit', i < 6)));
  await p.screenshot({ path: `${out}/${name}-loading.png` });
  await hold.evaluate((n) => n.remove());
  await p.evaluate(() => { window.__hold = false; document.querySelector('.loading')?.remove(); });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/${name}-title.png` });
  await ctx.close();
}
await b.close();
