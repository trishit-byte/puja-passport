// Measures real walking distances through the collision map (A* on a 1 m grid) from the start to
// every pandal (gate → bell → gate) and finds the best order to visit all eight.
import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 800, height: 500 } })).newPage();
await p.goto(process.argv[2] || 'http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
const res = await p.evaluate(() => {
  const g = window.__game, W = g.world;
  const R = 175, N = 2 * R + 1;
  const free = new Uint8Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = i - R, z = j - R;
    free[i * N + j] = Math.hypot(x, z) < 168 && W.isClear(x, z, 0.38) ? 1 : 0;
  }
  const idx = (x, z) => (Math.round(x) + R) * N + (Math.round(z) + R);
  const nearestFree = (x, z) => { for (let r = 0; r < 6; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (free[idx(x + dx, z + dz)]) return [Math.round(x + dx), Math.round(z + dz)]; return [Math.round(x), Math.round(z)]; };
  function astar(a, bb) {
    const [sx, sz] = nearestFree(a.x, a.z), [tx, tz] = nearestFree(bb.x, bb.z);
    const start = idx(sx, sz), goal = idx(tx, tz);
    const gS = new Float32Array(N * N).fill(Infinity); gS[start] = 0;
    const open = [[Math.hypot(sx - tx, sz - tz), start]]; const closed = new Uint8Array(N * N);
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (open.length) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, cur] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (cur === goal) return gS[cur];
      if (closed[cur]) continue; closed[cur] = 1;
      const ci = Math.floor(cur / N), cj = cur % N;
      for (const [di, dj, c] of D) {
        const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const n = ni * N + nj; if (!free[n] || closed[n]) continue;
        if (di && dj && (!free[ci * N + nj] || !free[ni * N + cj])) continue;
        const ng = gS[cur] + c; if (ng < gS[n]) { gS[n] = ng; open.push([ng + Math.hypot(ni - (tx + R), nj - (tz + R)), n]); }
      }
    }
    return NaN;
  }
  const ids = [...g.builds.keys()];
  const S = { x: -72, z: -30 };
  const gates = ids.map((id) => g.builds.get(id).gate);
  const bells = ids.map((id) => window.__anandapur.targets ? null : null);
  const pts = [S, ...gates];
  const dist = pts.map((a) => pts.map((c) => (a === c ? 0 : astar(a, c))));
  // inside each pandal: gate → bell → gate (bell targets from the pandal controller)
  const inner = ids.map((id) => { const bb = g.builds.get(id); const t = bb.targets.find((q) => q.id.includes('bell')) ?? bb.targets[0]; return 2 * astar(bb.gate, t.pos); });
  return { ids, dist, inner };
});
// best order (8! permutations)
const n = res.ids.length; let best = Infinity, bestOrd = null;
const perm = (arr, l) => { if (l === arr.length) { let d = res.dist[0][arr[0] + 1]; for (let k = 1; k < arr.length; k++) d += res.dist[arr[k - 1] + 1][arr[k] + 1]; if (d < best) { best = d; bestOrd = [...arr]; } return; } for (let i = l; i < arr.length; i++) { [arr[l], arr[i]] = [arr[i], arr[l]]; perm(arr, l + 1); [arr[l], arr[i]] = [arr[i], arr[l]]; } };
perm([...Array(n).keys()], 0);
const innerSum = res.inner.reduce((a, c) => a + c, 0);
const total = best + innerSum, act = 8 * 25;
console.log('best order:', bestOrd.map((i) => res.ids[i]).join(' → '));
console.log('between pandals (m):', Math.round(best), ' inside (gate→bell→gate, m):', Math.round(innerSum), ' total m:', Math.round(total));
for (const [name, v] of [['walk 3.6 m/s', 3.6], ['jog 6.4 m/s', 6.4]]) {
  const sec = total / v + act;
  console.log(`${name}: ${(sec / 60).toFixed(1)} real min incl. ~25 s per pandal activity  (budget 45 min)`);
}
console.log('per leg (m):', bestOrd.map((i, k) => Math.round(k ? res.dist[bestOrd[k - 1] + 1][i + 1] : res.dist[0][i + 1])).join(', '));
await b.close();
