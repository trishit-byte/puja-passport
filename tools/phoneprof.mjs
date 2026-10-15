// CPU profile of the game on an emulated phone (4× slower CPU), self time by function, plus draw stats.
// Usage: node tools/phoneprof.mjs [url] [x,z]
import { chromium } from '@playwright/test';
const url = process.argv[2] ?? 'http://10.128.146.164:5174/';
const [x, z] = (process.argv[3] ?? '0,-6').split(',').map(Number);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true, settings: { quality: 'medium' } })));
const p = await ctx.newPage();
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(([x, z]) => window.__anandapur.teleport(x, z, 0), [x, z]);
await p.waitForTimeout(3000);
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await cdp.send('Profiler.start');
await p.waitForTimeout(5000);
const { profile } = await cdp.send('Profiler.stop');
const info = await p.evaluate(() => { const i = window.__game.renderer.renderer.info; return { calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures, npcs: window.__game.city.npcs.length, fps: window.__game.fps?.toFixed(1) }; });
const self = new Map();
const dt = profile.timeDeltas;
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const tally = new Map();
profile.samples.forEach((id, i) => tally.set(id, (tally.get(id) ?? 0) + (dt[i] ?? 0)));
let total = 0;
for (const [id, us] of tally) {
  const n = byId.get(id);
  const f = n.callFrame;
  const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop().split('?')[0]}:${f.lineNumber}`;
  self.set(key, (self.get(key) ?? 0) + us);
  total += us;
}
const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 28);
console.log('draw', JSON.stringify(info));
for (const [k, us] of top) console.log(((100 * us) / total).toFixed(1).padStart(5) + '%', k);
// who calls the hot three.js internals?
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
for (const want of (process.env.CALLERS ?? '').split(',').filter(Boolean)) {
  const paths = new Map();
  for (const [id, us] of tally) {
    let n = byId.get(id);
    if (n.callFrame.functionName !== want) continue;
    const chain = [];
    let q = parent.get(id);
    for (let k = 0; k < 5 && q; k++) { const f = byId.get(q).callFrame; chain.push(`${f.functionName || 'anon'}:${f.lineNumber}`); q = parent.get(q); }
    const key = chain.join(' < ');
    paths.set(key, (paths.get(key) ?? 0) + us);
  }
  console.log('callers of', want);
  for (const [k, us] of [...paths].sort((a, b) => b[1] - a[1]).slice(0, 5)) console.log('  ', ((100 * us) / total).toFixed(1) + '%', k);
}
await b.close();
