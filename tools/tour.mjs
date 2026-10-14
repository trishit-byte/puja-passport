// Screenshot every pandal from its gate and its central view.
import { chromium } from '@playwright/test';
const out = process.argv[2] || 'docs/screenshots/dev';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
const logs = [];
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForFunction(() => window.__anandapur && window.__game.phase === 'play', null, { timeout: 90000 });
const ids = await p.evaluate(() => window.__anandapur.ids);
for (const id of (process.argv[3] ? process.argv[3].split(',') : ids)) {
  await p.evaluate((id) => { window.__anandapur.teleportTo(id, false); window.__game.cam.pitch = 0.12; }, id);
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${out}/p-${id}.png` });
}
console.log(logs.join('\n') || 'no errors');
await b.close();
