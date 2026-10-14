import { chromium } from '@playwright/test';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 640, height: 520 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => { document.querySelector('#ui').style.visibility = 'hidden'; window.__anandapur.setElapsed(2700 * 0.16); });
for (const [k, side] of [[0, 1.6], [1, -1.0], [2, 0.6]].entries ? [[0, 1.6], [1, -1.0], [2, 0.6]] : []) {
  await p.evaluate(([side]) => {
    const g = window.__game, V = g.player.pos.constructor, pr = g.city.priests[0];
    const pos = pr.ch.group.getWorldPosition(new V()), yaw = pr.ch.group.rotation.y + side;
    window.__anandapur.teleport(pos.x + Math.sin(yaw) * 5, pos.z + Math.cos(yaw) * 5, 0);
    g.cam.override = { pos: new V(pos.x + Math.sin(yaw) * 2.2, 1.9, pos.z + Math.cos(yaw) * 2.2), look: new V(pos.x, 1.4, pos.z) };
  }, [side]);
  await p.waitForTimeout(k ? 1200 : 3000);
  await p.screenshot({ path: `${out}-${k}.png` });
}
await b.close();
