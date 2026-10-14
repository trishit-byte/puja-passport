import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
const id = process.argv[2] || 'bonedi-bari';
const out = process.argv[3] || 'idol';
await p.evaluate((id) => {
  const g = window.__game; const b = g.builds.get(id);
  // stand at the railing, look at the protima, camera low and close
  const L = b.view.look, d = b.darshan;
  const dir = { x: L.x - d.x, z: L.z - d.z }; const len = Math.hypot(dir.x, dir.z);
  const sx = L.x - dir.x / len * 7.5, sz = L.z - dir.z / len * 7.5;
  window.__anandapur.teleport(sx, sz, Math.atan2(dir.x, dir.z));
  g.cam.targetDistance = 3.2; g.cam.pitch = -0.12;
  g.minimap.el.style.display = 'none'; document.querySelector('.hud').style.display = 'none';
}, id);
await p.waitForTimeout(2500);
await p.screenshot({ path: `docs/screenshots/dev/${out}.png` });
console.log(errs.join('\n') || 'ok');
await b.close();
