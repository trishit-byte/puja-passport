// Vehicle route points that come within a pandal's grounds (radius + margin).
import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.goto((process.argv[2] ?? 'http://10.128.146.164:5174/') + '?debug=1');
await p.waitForFunction(() => window.__game, null, { timeout: 180000 });
console.log(await p.evaluate(async () => {
  const g = window.__game;
  const { PANDALS } = await import('/src/data/pandals.ts');
  const out = [];
  for (const pd of PANDALS) out.push(`${pd.id} at (${pd.x},${pd.z}) r=${pd.radius}`);
  g.fest.vehicles.forEach((v, vi) => {
    for (const pd of PANDALS) {
      let min = 1e9, at = null;
      for (const q of v.path) { const d = Math.hypot(q.x - pd.x, q.z - pd.z); if (d < min) { min = d; at = q; } }
      if (min < pd.radius + 2) out.push(`  veh#${vi}${v.tram ? ' tram' : ''} enters ${pd.id}: ${min.toFixed(1)} m from centre (r ${pd.radius}) at (${at.x.toFixed(0)},${at.z.toFixed(0)})`);
    }
  });
  return out.join('\n');
}));
await b.close();
