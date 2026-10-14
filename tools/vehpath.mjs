// Finds where vehicle routes pass through solid things (pandals, buildings, stalls).
import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.goto((process.argv[2] ?? 'http://10.128.146.164:5174/') + '?debug=1');
await p.waitForFunction(() => window.__game, null, { timeout: 180000 });
console.log(await p.evaluate(() => {
  const g = window.__game, out = [];
  const pandals = window.__anandapur.pandals;
  g.fest.vehicles.forEach((v, vi) => {
    const kind = v.tram ? 'tram' : v.g.name || 'veh';
    let hits = [];
    for (let i = 0; i < v.path.length - 1; i++) {
      const a = v.path[i], c = v.path[i + 1], L = a.distanceTo(c);
      for (let s = 0; s < L; s += 0.5) {
        const x = a.x + (c.x - a.x) * s / L, z = a.z + (c.z - a.z) * s / L;
        const r = g.world.colliders.resolve(x, z, 0.9);
        if (Math.hypot(r.x - x, r.z - z) > 0.05) hits.push([Math.round(x), Math.round(z)]);
      }
    }
    // collapse consecutive hits into spans
    const spans = []; for (const h of hits) { const l = spans[spans.length - 1]; if (l && Math.hypot(l.end[0] - h[0], l.end[1] - h[1]) <= 2) l.end = h; else spans.push({ start: h, end: h }); }
    const near = (pt) => { let best = null, bd = 1e9; for (const pd of pandals) { const d = Math.hypot(pd.x - pt[0], pd.z - pt[1]); if (d < bd) { bd = d; best = pd.id; } } return best + '@' + Math.round(bd); };
    if (spans.length) out.push(`#${vi} ${kind} r=${v.radius}: ` + spans.map((s) => `[${s.start}]→[${s.end}] (${near(s.start)})`).join('  '));
  });
  return out.join('\n') || 'no hits';
}));
await b.close();
