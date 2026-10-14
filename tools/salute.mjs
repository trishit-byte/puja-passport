// Tries arm angles for the salute on the player model and screenshots each from the front.
import { chromium } from '@playwright/test';
const [url, out] = process.argv.slice(2);
const variants = JSON.parse(process.argv[4]);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 400, height: 460 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => { document.querySelector('#ui').style.visibility = 'hidden'; window.__anandapur.teleport(-30, 14, 0); window.__game.player.frozen = true; const ch = window.__game.player.char; ch.update = () => {}; });
let k = 0;
for (const v of variants) {
  await p.evaluate((v) => {
    const g = window.__game, ch = g.player.char, V = g.player.pos.constructor;
    ch.armR.rotation.set(v[0], 0, v[1]); ch.foreR.rotation.set(v[2], v[4] ?? 0, v[3]);
    const pos = g.player.pos.clone(), yaw = g.player.yaw + 0.3;
    g.cam.override = { pos: new V(pos.x + Math.sin(yaw) * 2.2, pos.y + 1.5, pos.z + Math.cos(yaw) * 2.2), look: new V(pos.x, pos.y + 1.3, pos.z) };
  }, v);
  await p.waitForTimeout(k++ ? 500 : 2500);
  await p.screenshot({ path: `${out}-${k}.png` });
}
await b.close();
