// Sums typed-array memory reachable from the game object, grouped by owner path.
import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 800, height: 450 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ settings: { quality: 'high' }, tutorialDone: true })));
const p = await ctx.newPage();
await p.goto((process.argv[2] ?? 'http://10.128.146.164:5173/') + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 180000 });
await p.waitForTimeout(3000);
console.log(await p.evaluate(() => {
  const seenObj = new WeakSet(), seenBuf = new Set(), by = {};
  const stack = [[window.__game, 'game', 0]];
  let visited = 0;
  while (stack.length && visited < 3e6) {
    const [o, path, d] = stack.pop();
    if (!o || typeof o !== 'object' || seenObj.has(o)) continue;
    seenObj.add(o); visited++;
    if (ArrayBuffer.isView(o)) { if (!seenBuf.has(o.buffer)) { seenBuf.add(o.buffer); by[path] = (by[path] ?? 0) + o.buffer.byteLength; } continue; }
    if (o instanceof ArrayBuffer) { if (!seenBuf.has(o)) { seenBuf.add(o); by[path] = (by[path] ?? 0) + o.byteLength; } continue; }
    if (o instanceof Node || o instanceof Window) continue;
    let keys; try { keys = o instanceof Map ? [...o.values()] : o instanceof Set ? [...o] : Object.values(o); } catch { continue; }
    const np = d < 2 ? path + '.' + (o.constructor?.name ?? '') : path;
    if (o instanceof Map || o instanceof Set) { for (const v of keys) stack.push([v, np, d + 1]); continue; }
    for (const k of Object.keys(o)) { try { stack.push([o[k], d < 2 ? path + '.' + k : path, d + 1]); } catch {} }
  }
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => (v / 1048576).toFixed(1).padStart(7) + ' MB  ' + k);
  return 'visited ' + visited + '  total ' + (Object.values(by).reduce((s, v) => s + v, 0) / 1048576).toFixed(1) + ' MB\n' + rows.join('\n');
}));
await b.close();
