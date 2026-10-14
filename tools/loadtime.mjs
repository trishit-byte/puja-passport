import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
for (let i = 0; i < 3; i++) {
  const ctx = await b.newContext(); const p = await ctx.newPage();
  const t0 = Date.now(); await p.goto('http://10.128.146.164:5173/'); await p.waitForSelector('.title-screen');
  const bytes = await p.evaluate(() => performance.getEntriesByType('resource').reduce((s, e) => s + (e.transferSize || 0), 0));
  console.log('time-to-title ms', Date.now() - t0, 'transferred KB', Math.round(bytes / 1024)); await ctx.close();
}
await b.close();
