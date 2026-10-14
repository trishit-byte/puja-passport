import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto('http://10.128.146.164:5174/?debug=1');
await p.waitForSelector('.title-screen', { timeout: 90000 }); await p.waitForTimeout(1000);
await p.tap('.title-buttons .btn');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 30000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'docs/screenshots/dev/tut-1.png' });
for (let k = 0; k < 3; k++) { await p.tap('.tutorial [data-a=next]').catch(() => {}); await p.waitForTimeout(400); }
await p.screenshot({ path: 'docs/screenshots/dev/tut-4.png' });
await b.close();
