import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForTimeout(8000);
for (const [x,z] of [[-72,-30],[0,-6],[60,100],[118,38]]) {
  await p.evaluate(([x,z]) => window.__anandapur.teleport(x,z,0), [x,z]);
  await p.waitForTimeout(1500);
  console.log(x,z, JSON.stringify(await p.evaluate(() => window.__anandapur.renderInfo())));
}
await b.close();
