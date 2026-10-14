// Player pose preview. node tools/pose.mjs <url> <outPrefix> <pose> [times in s, comma-sep]
import { chromium } from '@playwright/test';
const [url, out, pose, times = '0.5,1.5,2.5,3.5'] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 500, height: 500 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => { document.querySelector('#ui').style.visibility = 'hidden'; window.__anandapur.teleport(-30, 14, 0); window.__game.player.frozen = true; });
let i = 0;
for (const t of times.split(',').map(Number)) {
  for (const [name, yo] of [['side', Math.PI / 2], ['front', 0.35]]) {
    await p.evaluate(([pose, t, yo]) => {
      const g = window.__game, ch = g.player.char;
      // replay the pose from its start up to time t, then hold
      if (!ch.__orig) ch.__orig = ch.update.bind(ch);
      ch.pose = 'none'; for (let k = 0; k < 60; k++) ch.__orig(1 / 60, 0, 0);
      ch.pose = pose; for (let k = 0; k < Math.round(t * 60); k++) ch.__orig(1 / 60, 0, 0);
      ch.update = () => {};
      const pos = g.player.pos.clone(), yaw = g.player.yaw + yo;
      const cp = pos.clone(); cp.x += Math.sin(yaw) * 2.6; cp.z += Math.cos(yaw) * 2.6; cp.y += 1.0;
      const lk = pos.clone(); lk.y += 0.6;
      g.cam.override = { pos: cp, look: lk };
    }, [pose, t, yo]);
    await p.waitForTimeout(i === 0 ? 2500 : 700);
    await p.screenshot({ path: `${out}-${i++}.png` });
    await p.evaluate(() => { const ch = window.__game.player.char; ch.update = ch.__orig; });
  }
}
await b.close();
