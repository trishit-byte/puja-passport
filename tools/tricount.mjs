// What the GPU draws each frame on a phone: triangles by mesh (top 20), and how much is off-screen.
// Usage: node tools/tricount.mjs [url] [x,z]
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
await p.waitForTimeout(2500);
const r = await p.evaluate(() => {
  const g = window.__game, R = g.renderer.renderer, cam = g.renderer.camera;
  const T = cam.constructor.prototype.constructor; void T;
  const fr = new (Object.getPrototypeOf(g.frustum).constructor)();
  const M = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse);
  fr.setFromProjectionMatrix(M);
  const rows = [];
  g.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isPoints && !o.isLine) return;
    const geo = o.geometry; if (!geo) return;
    const n = geo.index ? geo.index.count : geo.attributes.position.count;
    let tris = n / 3; if (o.isInstancedMesh) tris *= o.count;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const s = geo.boundingSphere.clone().applyMatrix4(o.matrixWorld);
    const inView = o.frustumCulled === false || fr.intersectsSphere(s);
    const camDist = s.center.distanceTo(cam.position);
    let path = []; let q = o; while (q && q !== g.scene && path.length < 3) { path.unshift(q.name || q.type); q = q.parent; }
    rows.push({ mat: [].concat(o.material)[0]?.userData?.batch ?? [].concat(o.material)[0]?.type, fc: o.userData?.flatCenter ? Math.round(Math.hypot(o.userData.flatCenter.x - g.cam.flatPos.x, o.userData.flatCenter.z - g.cam.flatPos.z)) : -1, path: path.join('/'), tris: Math.round(tris), inView, r: Math.round(s.radius), d: Math.round(camDist), cast: o.castShadow, inst: !!o.isInstancedMesh, culled: o.frustumCulled });
  });
  const drawn = rows.filter((r) => r.inView);
  const sum = (a) => a.reduce((s, r) => s + r.tris, 0);
  const agg = new Map();
  for (const r of drawn) { const k = r.path.replace(/\d+/g, '#'); const a = agg.get(k) ?? { n: 0, tris: 0, maxR: 0, minD: 1e9 }; a.n++; a.tris += r.tris; a.maxR = Math.max(a.maxR, r.r); a.minD = Math.min(a.minD, r.d); agg.set(k, a); }
  return { info: { calls: R.info.render.calls, tris: R.info.render.triangles }, visibleMeshes: rows.length, inView: drawn.length, trisInView: sum(drawn), trisAll: sum(rows), castInView: sum(drawn.filter((r) => r.cast)), big: drawn.filter((r) => r.path.endsWith('Group/Mesh')).sort((a, b) => b.tris - a.tris).slice(0, 14), top: [...agg].sort((a, b) => b[1].tris - a[1].tris).slice(0, 22) };
});
console.log(JSON.stringify(r.info), 'meshes', r.visibleMeshes, 'inView', r.inView, 'trisInView', r.trisInView, 'trisAll', r.trisAll, 'shadow-casting tris in view', r.castInView);
for (const [k, a] of r.top) console.log(String(a.tris).padStart(8), String(a.n).padStart(4), 'r<=' + a.maxR, 'd>=' + a.minD, k);
for (const r2 of r.big) console.log('  big', JSON.stringify(r2));
await b.close();
