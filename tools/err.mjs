import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage();
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type(), m.text().slice(0, 300)); });
p.on('pageerror', (e) => console.log('PAGEERR', e.stack?.slice(0, 800)));
await p.goto((process.argv[2] ?? 'http://10.128.146.164:5173/') + '?debug=1&autostart=1');
await p.waitForTimeout(15000);
console.log(await p.evaluate(() => !!document.querySelector('.title-screen')));
await b.close();
