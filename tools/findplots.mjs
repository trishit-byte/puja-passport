// Finds open circular plots (no road, building, collider or pandal inside) of a given radius.
import { chromium } from '@playwright/test';
const R = Number(process.argv[2] ?? 19);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.goto('http://10.128.146.164:5174/?debug=1');
await p.waitForFunction(() => window.__game, null, { timeout: 180000 });
console.log(await p.evaluate((R) => {
  const g = window.__game, w = g.world, pds = window.__anandapur.pandals;
  const open = (x, z) => Math.hypot(x, z) < 182 && z < 90 && w.field.clearance(x, z) > 0.5 && w.isClear(x, z, 1.5) && !w.footprints.some((f) => Math.abs(f.x - x) < f.hw + 1.5 && Math.abs(f.z - z) < f.hd + 1.5) && !pds.some((d) => Math.hypot(d.x - x, d.z - z) < d.radius + 4);
  const found = [];
  for (let z = -180; z <= 90; z += 3) for (let x = -185; x <= 185; x += 3) {
    let ok = true;
    for (let a = 0; a < 24 && ok; a++) for (const rr of [0, R * 0.5, R]) if (!open(x + Math.cos((a / 24) * 6.283) * rr, z + Math.sin((a / 24) * 6.283) * rr)) { ok = false; break; }
    if (ok) found.push([x, z, +w.field.clearance(x, z).toFixed(1)]);
  }
  // cluster
  const cl = [];
  for (const f of found) { const c = cl.find((q) => Math.hypot(q[0] - f[0], q[1] - f[1]) < 15); if (!c) cl.push(f); }
  return `R=${R}: ${found.length} spots; clusters: ` + cl.map((c) => `(${c[0]},${c[1]}) road ${c[2]}m`).join('  ');
}, R));
await b.close();
