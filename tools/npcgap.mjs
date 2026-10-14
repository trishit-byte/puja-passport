// Counts people standing inside each other (stationary pairs) and walkers passing through people.
import { chromium } from '@playwright/test';
const url = process.argv[2] ?? 'http://10.128.146.164:5173/';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 640, height: 400 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true, settings: { quality: 'high' } })));
const p = await ctx.newPage();
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => window.__anandapur.setElapsed(2700 * 0.16)); // aarti: devotees and priests out too
await p.waitForTimeout(1500);
const still = await p.evaluate(() => {
  const c = window.__game.city;
  const pts = [...c.npcs.filter((n) => n.mode !== 'walk').map((n) => ({ x: n.pos.x, z: n.pos.z, who: n.mode })), ...c.priests.map((q) => ({ x: q.pos.x, z: q.pos.z, who: 'priest' })), ...c.devotees.map((q) => ({ x: q.pos.x, z: q.pos.z, who: 'devotee' }))];
  const bad = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z); if (d < 0.6) bad.push(`${pts[i].who}+${pts[j].who} ${d.toFixed(2)}m @(${pts[i].x.toFixed(0)},${pts[i].z.toFixed(0)})`); }
  return { people: pts.length, overlapping: bad.length, sample: bad.slice(0, 8) };
});
console.log('standing:', JSON.stringify(still));
// walkers over 12 s around the busiest streets
let hits = 0, samples = 0;
for (const [x, z] of [[0, -6], [14, 8], [-60, -14]]) {
  await p.evaluate(([x, z]) => window.__anandapur.teleport(x, z, 0), [x, z]);
  for (let k = 0; k < 20; k++) {
    await p.waitForTimeout(200);
    const r = await p.evaluate(() => {
      const c = window.__game.city, cam = window.__game.player.pos;
      const all = c.npcs.filter((n) => n.visible || Math.hypot(n.pos.x - cam.x, n.pos.z - cam.z) < 40);
      let h = 0, s = 0;
      for (const w of all) {
        if (w.mode !== 'walk' || Math.hypot(w.pos.x - cam.x, w.pos.z - cam.z) > 40) continue;
        s++;
        for (const o of all) if (o !== w && Math.hypot(w.pos.x - o.pos.x, w.pos.z - o.pos.z) < 0.45) { h++; break; }
      }
      return [h, s];
    });
    hits += r[0]; samples += r[1];
  }
}
console.log(`walkers: ${samples} walker-samples, ${hits} inside someone (${(100 * hits / Math.max(1, samples)).toFixed(1)}%)`);
await b.close();
