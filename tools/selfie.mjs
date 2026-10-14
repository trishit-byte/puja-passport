import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })); } });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
const spots = await p.evaluate(() => window.__game.interactions.items.filter((i) => i.id.startsWith('photo')).map((i) => ({ x: i.pos.x, z: i.pos.z })));
console.log('photo spots', spots.length);
for (const s of spots.slice(0, 2)) {
  await p.evaluate((s) => window.__anandapur.teleport(s.x, s.z, 0), s);
  await p.waitForTimeout(500);
  console.log('prompt', await p.evaluate(() => window.__anandapur.getState().prompt));
  await p.keyboard.press('KeyE');
  await p.waitForTimeout(3500);
}
console.log('memories', await p.evaluate(() => JSON.parse(localStorage.getItem('anandapur.memories') || '[]').map((m) => m.place + ' ' + m.at + ' ' + m.img.length)));
await p.keyboard.press('KeyP'); await p.waitForTimeout(700);
await p.screenshot({ path: 'docs/screenshots/dev/memories.png' });
console.log(errs.join('|') || 'no errors');
await b.close();
