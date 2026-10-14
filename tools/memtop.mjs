// Lists the largest non-skinned geometries in the scene with their ancestry.
import { chromium } from '@playwright/test';
const [url] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 800, height: 450 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ settings: { quality: 'high' }, tutorialDone: true })));
const p = await ctx.newPage();
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__anandapur, null, { timeout: 180000 });
await p.waitForTimeout(3000);
console.log(JSON.stringify(await p.evaluate(() => {
  const seen = new Set(), rows = [];
  window.__game.scene.traverse((o) => {
    if (!(o.isMesh || o.isPoints || o.isLine) || o.isSkinnedMesh || seen.has(o.geometry)) return;
    seen.add(o.geometry);
    let s = 0; const at = [];
    for (const k in o.geometry.attributes) { const a = o.geometry.attributes[k]; const bl = (a.array ?? a.data.array).byteLength; s += bl; at.push(k + ':' + a.array?.constructor.name.replace('Array', '') + 'x' + a.itemSize); }
    s += o.geometry.index?.array.byteLength ?? 0;
    const path = []; let n = o; while (n) { path.push(n.name || n.type); n = n.parent; }
    rows.push({ MB: +(s / 1048576).toFixed(2), verts: o.geometry.attributes.position.count, idx: !!o.geometry.index, at: at.join(','), path: path.slice(0, 5).join('<'), inst: o.isInstancedMesh ? o.count : 0 });
  });
  rows.sort((a, b) => b.MB - a.MB);
  const tot = rows.reduce((s, r) => s + r.MB, 0);
  // group by path tail
  const g = {}; for (const r of rows) { const k = r.path.split('<').slice(1, 4).join('<'); g[k] = (g[k] ?? 0) + r.MB; }
  return { tot, n: rows.length, top: rows.slice(0, 25), groups: Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 15) };
}), null, 0).replace(/},{/g, '},\n{'));
await b.close();
