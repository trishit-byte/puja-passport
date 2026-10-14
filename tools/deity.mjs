import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 900, height: 900 } })).newPage();
await p.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
const id = process.argv[2] || 'bonedi-bari';
for (const [name, off] of (process.argv[3] ? JSON.parse(process.argv[3]) : [['left', -2.6], ['right', 2.6]])) {
  await p.evaluate(([id, off]) => {
    const g = window.__game, b = g.builds.get(id), L = b.view.look, d = b.darshan;
    const dx = L.x - d.x, dz = L.z - d.z, n = Math.hypot(dx, dz), fx = dx / n, fz = dz / n, sx = fz, sz = -fx;
    window.__anandapur.teleport(d.x, d.z, 0);
    const look = L.clone(); look.x += -sx * off; look.z += -sz * off; look.y = 3.4;
    const pos = look.clone(); pos.x -= fx * 4.2; pos.z -= fz * 4.2; pos.y = 3.6;
    g.cam.override = { pos, look }; document.querySelector('#ui').style.visibility = 'hidden';
  }, [id, off]);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `docs/screenshots/dev/deity-${name}.png` });
}
await b.close();
