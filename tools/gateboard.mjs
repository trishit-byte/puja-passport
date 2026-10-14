import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1000, height: 600 } })).newPage();
await p.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
await p.goto('http://10.128.146.164:5173/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
for (const id of process.argv.slice(2)) {
  await p.evaluate((id) => {
    const g = window.__game, b = g.builds.get(id);
    const ox = b.gate.x - b.darshan.x, oz = b.gate.z - b.darshan.z, n = Math.hypot(ox, oz);
    window.__anandapur.teleport(b.gate.x + ox / n * 12, b.gate.z + oz / n * 12, 0);
    const pos = g.player.pos.clone(); pos.y = 4.5; const look = b.gate.clone(); look.x += ox / n * 0.5; look.z += oz / n * 0.5; look.y = 6.5;
    g.cam.override = { pos, look }; document.querySelector('#ui').style.visibility = 'hidden';
  }, id);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `docs/screenshots/dev/gb-${id}.png` });
}
await b.close();
