// Close-ups of the player's body for anatomy review. Usage: node tools/body.mjs <url> <outPrefix> [style,...]
import { chromium } from '@playwright/test';
const [url, out, styles = 'kurta,sari,shirt,tee'] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 700, height: 700 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => { document.querySelector('#ui').style.visibility = 'hidden'; window.__anandapur.teleport(-30, 14, 0); window.__game.player.frozen = true; });
const looks = { kurta: { style: 'kurta', color: 0xf2c14e, accent: 0xb3121f, hair: 'short', skin: 0xc98a62 }, sari: { style: 'sari', color: 0xf4eedf, accent: 0xb3121f, hair: 'bun', skin: 0xc98a62 }, shirt: { style: 'shirt', color: 0x5ec2d8, accent: 0xf4eedf, hair: 'short', skin: 0xc98a62 }, tee: { style: 'tee', color: 0x1a1a20, accent: 0xf6a21e, hair: 'short', skin: 0xc98a62, pants: 0x2a3a5a }, salwar: { style: 'salwar', color: 0xd94f7a, accent: 0xf2c14e, hair: 'braid', skin: 0xc98a62 }, frock: { style: 'frock', color: 0xd94f7a, accent: 0xffffff, hair: 'bun', skin: 0xc98a62 } };
// view: [name, yawOffset, height, dist, lookY, walkPhase or -1]
const views = [['front', 0, 1.0, 2.6, 0.9], ['side', Math.PI / 2, 1.0, 2.6, 0.9], ['hand', Math.PI / 2.6, 1.0, 0.75, 0.82], ['handf', 0.25, 0.9, 0.7, 0.8], ['legs', 0.6, 0.5, 1.3, 0.45], ['walk', Math.PI / 2, 1.0, 2.6, 0.9, 1], ['walkknee', Math.PI / 2, 0.45, 1.1, 0.45, 1], ['walkfront', 0.5, 1.0, 2.2, 0.8, 1], ['handz', -1.2, -1, 0.42, 0], ['handzf', -0.3, -1, 0.42, 0], ['handzb', -2.4, -1, 0.42, 0]];
for (const st of styles.split(',')) {
  for (const [name, yo, hy, d, ly, walk] of views) {
    await p.evaluate(([look, yo, hy, d, ly, walk]) => {
      const g = window.__game, ch = g.player.char; const THREE_V = g.player.pos.constructor;
      if (JSON.stringify(ch.look) !== JSON.stringify(look)) ch.setLook(look);
      let pos = g.player.pos.clone(); const yaw = g.player.yaw + yo;
      if (hy < 0) { // hand close-up: aim at the right hand itself
        g.scene.updateMatrixWorld(true);
        const hp = ch.foreR.localToWorld(new THREE_V(0, -0.25, 0));
        const cp = hp.clone(); cp.x += Math.sin(yaw) * d; cp.z += Math.cos(yaw) * d; cp.y += 0.05;
        g.cam.override = { pos: cp, look: hp };
        window.__walk = walk;
        return;
      }
      const cp = pos.clone(); cp.x += Math.sin(yaw) * d; cp.z += Math.cos(yaw) * d; cp.y += hy;
      const lk = pos.clone(); lk.y += ly;
      g.cam.override = { pos: cp, look: lk };
      window.__walk = walk;
    }, [looks[st], yo, hy, d, ly, walk ?? 0]);
    // drive the animation: idle, or frozen mid-stride walking (the game loop still calls update)
    await p.evaluate(() => {
      const ch = window.__game.player.char;
      if (!ch.__orig) ch.__orig = ch.update.bind(ch);
      ch.update = (dt) => { if (window.__walk) { ch.phase = 1.1; ch.speedS = 3.6; ch.__orig(0, 3.6, 0); ch.phase = 1.1; } else ch.__orig(dt, 0, 0); };
    });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}-${st}-${name}.png` });
  }
}
await b.close();
