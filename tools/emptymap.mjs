// ASCII map of open land: '.' road, '#' built (collider/footprint within 4 m), ' ' open ground, P pandal.
import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.goto((process.argv[2] ?? 'http://10.128.146.164:5174/') + '?debug=1');
await p.waitForFunction(() => window.__game, null, { timeout: 180000 });
console.log(await p.evaluate(() => {
  const g = window.__game, w = g.world, pds = window.__anandapur.pandals;
  const rows = [];
  const S = 5;
  for (let z = -175; z <= 100; z += S) {
    let row = '';
    for (let x = -185; x <= 185; x += S) {
      if (Math.hypot(x, z) > 190) { row += '~'; continue; }
      if (pds.some((d) => Math.hypot(d.x - x, d.z - z) < d.radius)) { row += 'P'; continue; }
      if (w.field.clearance(x, z) < 0) { row += '.'; continue; }
      const built = !w.isClear(x, z, 2.5) || w.footprints.some((f) => Math.abs(f.x - x) < f.hw + 2 && Math.abs(f.z - z) < f.hd + 2);
      row += built ? '#' : ' ';
    }
    rows.push(String(z).padStart(5) + ' ' + row);
  }
  return '      x from -185 step 5\n' + rows.join('\n');
}));
await b.close();
