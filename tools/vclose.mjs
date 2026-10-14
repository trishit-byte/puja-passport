import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1000, height: 700 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
for (const k of process.argv.slice(2).map(Number)) {
  await p.evaluate(([k, rr]) => {
    const g = window.__game, v = g.fest.vehicles[k]; for (const q of g.fest.vehicles) { q.speed = 0; q.cur = 0; }
    const pos = v.g.position, yaw = v.g.rotation.y;
    window.__anandapur.teleport(pos.x + 30, pos.z + 30, 0);
    const cp = pos.clone(); const R = rr; cp.x += Math.sin(yaw + 0.9) * R; cp.z += Math.cos(yaw + 0.9) * R; cp.y = R > 6 ? 3.2 : 2.2;
    const look = pos.clone(); look.y = 1;
    g.cam.override = { pos: cp, look }; document.querySelector('#ui').style.visibility = 'hidden';
  }, [k, Number(process.env.R || 4.5)]);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `docs/screenshots/dev/vc-${k}.png` });
}
await b.close();
