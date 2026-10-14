import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1200, height: 630 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage(); p.on('console', (m) => { if (/NaN|rror/.test(m.text())) console.log('C:', m.text().slice(0, 300)); }); p.on('pageerror', (e) => console.log('E:', e.message));
await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
const id = process.argv[2] || 'bonedi-bari', out = process.argv[3] || 'idol-close', dist = Number(process.argv[4] || 7), h = Number(process.argv[5] || 3.2);
await p.evaluate(([id, dist, h]) => {
  const g = window.__game; const b = g.builds.get(id); const L = b.view.look, d = b.darshan;
  let dx = L.x - d.x, dz = L.z - d.z, n = Math.hypot(dx, dz);
  if (n < 0.5) { const def = window.__anandapur.pandals.find((q) => q.id === id); const v = window.__game.builds.get(id); void v; dx = d.x - def.x; dz = d.z - def.z; n = Math.hypot(dx, dz) || 1; }
  const THREE = g.scene.constructor; void THREE;
  window.__anandapur.teleport(d.x, d.z, 0);
  const pos = L.clone(); pos.x -= dx / n * dist; pos.z -= dz / n * dist; pos.y = h;
  const look = L.clone(); look.y = h - 0.2;
  g.cam.override = { pos, look };
  document.querySelector('#ui').style.display = 'none';
}, [id, dist, h]);
await p.waitForTimeout(3500);
await p.screenshot({ path: out, type: 'jpeg', quality: 86 });
await b.close();
