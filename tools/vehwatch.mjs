// Runs the traffic and records any moment a vehicle is inside a pandal's grounds or overlapping something solid.
import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 640, height: 400 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto((process.argv[2] ?? 'http://10.128.146.164:5173/') + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => window.__anandapur.teleport(140, 60, 0)); // stand out of the way
const res = await p.evaluate((secs) => new Promise((done) => {
  const g = window.__game, pds = window.__anandapur.pandals, R = { 'bonedi-bari': 21, 'alor-utsav': 21, 'gram-bangla': 21, 'shobuj-swapno': 22, 'dhaker-taal': 20, 'neel-shagor': 21, 'smritir-shohor': 21, 'nodir-alo': 20 };
  const bad = {}; let samples = 0; const moved = new Map();
  const t0 = performance.now();
  const tick = () => {
    for (const [i, v] of g.fest.vehicles.entries()) {
      const q = v.g.position; samples++;
      if (!moved.has(i)) moved.set(i, q.clone()); 
      for (const pd of pds) if (Math.hypot(pd.x - q.x, pd.z - q.z) < R[pd.id]) bad[`#${i} in ${pd.id}`] = 1;
      const r = g.world.colliders.resolve(q.x, q.z, 0.6);
      if (Math.hypot(r.x - q.x, r.z - q.z) > 0.05) bad[`#${i} touching at (${q.x.toFixed(0)},${q.z.toFixed(0)})`] = 1;
    }
    if (performance.now() - t0 < secs * 1000) setTimeout(tick, 100);
    else done({ samples, bad: Object.keys(bad), dist: [...moved.entries()].map(([i, a]) => Math.round(a.distanceTo(g.fest.vehicles[i].g.position))) });
  };
  tick();
}), 40);
console.log(JSON.stringify(res));
await b.close();
