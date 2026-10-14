// Open spots of radius R that sit beside a road (road clearance between lo and hi metres).
import { chromium } from '@playwright/test';
const [R, lo, hi] = process.argv.slice(2).map(Number);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.goto((process.env.URL ?? 'http://10.128.146.164:5174/') + '?debug=1');
await p.waitForFunction(() => window.__game, null, { timeout: 180000 });
console.log(await p.evaluate(([R, lo, hi]) => {
  const w = window.__game.world, pds = window.__anandapur.pandals;
  const open = (x, z) => Math.hypot(x, z) < 180 && z < 92 && w.field.clearance(x, z) > 0.3 && w.isClear(x, z, 0.8) && !w.footprints.some((f) => Math.abs(f.x - x) < f.hw + 0.8 && Math.abs(f.z - z) < f.hd + 0.8) && !pds.some((d) => Math.hypot(d.x - x, d.z - z) < d.radius + 3);
  const found = [];
  for (let z = -180; z <= 92; z += 2) for (let x = -185; x <= 185; x += 2) {
    const c = w.field.clearance(x, z);
    if (c < lo || c > hi) continue;
    let ok = true;
    for (let a = 0; a < 16 && ok; a++) for (const rr of [0, R * 0.5, R]) if (!open(x + Math.cos((a / 16) * 6.283) * rr, z + Math.sin((a / 16) * 6.283) * rr)) { ok = false; break; }
    if (ok) found.push([x, z, +c.toFixed(1)]);
  }
  const cl = [];
  for (const f of found) if (!cl.some((q) => Math.hypot(q[0] - f[0], q[1] - f[1]) < 25)) cl.push(f);
  return `R=${R}: ${cl.length} areas: ` + cl.map((c) => `(${c[0]},${c[1]}) ${c[2]}m`).join('  ');
}, [R, lo, hi]));
await b.close();
