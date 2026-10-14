// Memory probe. Usage: node tools/mem.mjs <url> [quality=high] [w=1600] [h=900] [dpr=1]
// Reports JS heap, CPU-side geometry/texture bytes in the scene, GPU-resident estimates and
// the RSS of every Chromium process this run started.
import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
const [url, quality = 'high', w = '1600', h = '900', dpr = '1'] = process.argv.slice(2);
const pids = () => new Set(execSync("ps -u $(id -u) -o pid=,comm= | grep -iE 'chrom|headless' | awk '{print $1}' || true").toString().split(/\s+/).filter(Boolean));
const before = pids();
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
await ctx.addInitScript((q) => localStorage.setItem('anandapur.save', JSON.stringify({ settings: { quality: q }, tutorialDone: true })), quality);
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Performance.enable');
const t0 = Date.now();
await p.goto(url + (url.includes('?') ? '&' : '?') + 'debug=1&autostart=1');
await p.waitForFunction(() => window.__anandapur, null, { timeout: 180000 });
const loadMs = Date.now() - t0;
// wander a bit so lazy things (audio, DJ songs, crowds) load
for (const [x, z, yaw] of [[0, -6, 0], [-72, -30, 2.5], [-108, -58, -1.57], [60, 100, 0]]) {
  await p.evaluate(([x, z, y]) => window.__anandapur.teleport(x, z, y), [x, z, yaw]);
  await p.waitForTimeout(2500);
}
await cdp.send('HeapProfiler.collectGarbage');
await p.waitForTimeout(+(process.env.SETTLE ?? 0));
await cdp.send('HeapProfiler.collectGarbage');
const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
const scene = await p.evaluate(() => {
  const g = window.__game, THREE_seen = new Set(), texSeen = new Set();
  let geoBytes = 0, idxBytes = 0, meshes = 0, skinned = 0, inst = 0, mats = new Set(), byName = {};
  const geoOf = {};
  const attrSeen = new Set(); const attrBytes = (geo) => { let s = 0; for (const k in geo.attributes) { const a = geo.attributes[k]; const arr = a.array ?? a.data?.array; if (!arr || attrSeen.has(arr)) continue; attrSeen.add(arr); s += arr.byteLength; } for (const k in geo.morphAttributes) for (const a of geo.morphAttributes[k]) s += a.array.byteLength; return s; };
  let texBytes = 0; const texList = [];
  const addTex = (t) => { if (!t || texSeen.has(t)) return; texSeen.add(t); const im = t.image; let bytes = 0; if (im?.data) bytes = im.data.byteLength; else if (im?.width) bytes = im.width * im.height * 4 * (t.generateMipmaps === false ? 1 : 1.33); texBytes += bytes; texList.push([t.name || t.uuid.slice(0, 6), im?.width, im?.height, Math.round(bytes / 1024)]); };
  g.scene.traverse((o) => {
    if (o.isMesh || o.isPoints || o.isLine) {
      meshes++; if (o.isSkinnedMesh) skinned++; if (o.isInstancedMesh) inst++;
      const geo = o.geometry;
      if (!THREE_seen.has(geo)) { THREE_seen.add(geo); const ab = attrBytes(geo); const ib = geo.index && !attrSeen.has(geo.index.array) ? (attrSeen.add(geo.index.array), geo.index.array.byteLength) : 0; geoBytes += ab; idxBytes += ib; let n = o; let path = []; while (n && path.length < 3) { if (n.name) path.push(n.name); n = n.parent; } const key = path.reverse().join('/') || o.type; byName[key] = (byName[key] ?? 0) + ab + ib; }
      if (o.isInstancedMesh) geoBytes += o.instanceMatrix.array.byteLength;
      for (const mt of [].concat(o.material)) { mats.add(mt); for (const k in mt) if (mt[k]?.isTexture) addTex(mt[k]); if (mt.uniforms) for (const k in mt.uniforms) if (mt.uniforms[k].value?.isTexture) addTex(mt.uniforms[k].value); }
    }
  });
  const top = Object.entries(byName).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => [k, +(v / 1048576).toFixed(1)]);
  const ri = g.renderer.renderer.info;
  return { meshes, skinned, inst, materials: mats.size, uniqueGeos: THREE_seen.size, geoMB: +(geoBytes / 1048576).toFixed(1), indexMB: +(idxBytes / 1048576).toFixed(1), texMB: +(texBytes / 1048576).toFixed(1), texCount: texSeen.size, rendererGeos: ri.memory.geometries, rendererTex: ri.memory.textures, programs: ri.programs?.length, topGeo: top, bigTex: texList.sort((a, b) => b[3] - a[3]).slice(0, 8) };
});
const audio = await p.evaluate(() => { const a = window.__game.audio; let bytes = 0, n = 0; const seen = new Set(); const walk = (o, d) => { if (!o || d > 3 || typeof o !== 'object' || seen.has(o)) return; seen.add(o); if (o instanceof AudioBuffer) { bytes += o.length * o.numberOfChannels * 4; n++; return; } for (const k of Object.keys(o)) { try { walk(o[k], d + 1); } catch {} } }; walk(a, 0); return { buffers: n, MB: +(bytes / 1048576).toFixed(1) }; });
const after = [...pids()].filter((x) => !before.has(x));
let rss = [];
for (const pid of after) { try { const s = execSync(`ps -o rss=,args= -p ${pid}`).toString().trim(); const kb = parseInt(s); const type = (s.match(/--type=([\w-]+)/) || [, 'browser'])[1]; rss.push([type, Math.round(kb / 1024)]); } catch {} }
const total = rss.reduce((s, r) => s + r[1], 0);
console.log(JSON.stringify({ quality, viewport: [w, h, dpr], loadMs, jsHeapUsedMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), jsHeapTotalMB: +(m.JSHeapTotalSize / 1048576).toFixed(1), nodes: m.Nodes, scene, audio, rssMB: rss.sort((a, b) => b[1] - a[1]), rssTotalMB: total }, null, 1));
await b.close();
