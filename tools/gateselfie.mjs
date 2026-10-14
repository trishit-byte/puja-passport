import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })); } });
const p = await ctx.newPage();
await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
for (const id of ['bonedi-bari', 'dhaker-taal', 'neel-shagor']) {
  const s = await p.evaluate((id) => window.__game.interactions.items.find((i) => i.id === 'photo-gate-' + id).pos, id);
  await p.evaluate((s) => window.__anandapur.teleport(s.x, s.z, 0), s);
  await p.waitForTimeout(500);
  console.log(id, await p.evaluate(() => window.__anandapur.getState().prompt));
  await p.keyboard.press('KeyE'); await p.waitForTimeout(3600);
}
await p.keyboard.press('KeyP'); await p.waitForTimeout(700);
await p.screenshot({ path: 'docs/screenshots/dev/memories.png' });
await b.close();
