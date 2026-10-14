import { chromium } from '@playwright/test';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 900, height: 560 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => { document.querySelector('#ui').style.visibility = 'hidden'; });
const t = await p.evaluate(() => window.__anandapur.targets().find((x) => x.id === 'smritir-shohor').targets.find((q) => q.id === 'lm-tram'));
for (const [k, [dx, dz, h]] of [[3, 4, 2.2], [-4, 3, 1.6], [0, 9, 6]].entries()) {
  await p.evaluate(([t, dx, dz, h]) => { const g = window.__game, V = g.player.pos.constructor; window.__anandapur.teleport(t.x + dx, t.z + dz, 0); g.cam.override = { pos: new V(t.x + dx, h, t.z + dz), look: new V(t.x, 0.9, t.z - 1.6) }; }, [t, dx, dz, h]);
  await p.waitForTimeout(k ? 1500 : 3000);
  await p.screenshot({ path: `${out}-${k}.png` });
}
await b.close();
