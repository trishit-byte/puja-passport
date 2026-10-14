import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })); } });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
for (const id of await p.evaluate(() => window.__anandapur.ids)) { await p.evaluate((id) => window.__anandapur.completePandal(id), id); await p.waitForTimeout(250); }
await p.waitForTimeout(1500);
await p.screenshot({ path: 'docs/screenshots/dev/fin-0.png' });
for (let k = 0; k < 6; k++) { await p.keyboard.press('Space'); await p.waitForTimeout(250); }
await p.evaluate(() => window.__anandapur.teleport(60, 104, 0));
await p.waitForTimeout(600);
console.log('prompt', await p.evaluate(() => window.__anandapur.getState().prompt));
await p.keyboard.press('KeyE');
await p.waitForTimeout(6000);
await p.screenshot({ path: 'docs/screenshots/dev/fin-1.png' });
await p.waitForTimeout(9000);
await p.screenshot({ path: 'docs/screenshots/dev/fin-2.png' });
console.log(await p.evaluate(() => window.__game.phase), errs.join('|') || 'no errors');
await b.close();
