// Close-ups of shopfronts and food stalls: sign legibility, layout, matching goods and shopkeeper.
// Usage: node tools/shopsigns.mjs <url> <outDir> [count] [WxH]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const [url = 'http://10.128.146.164:5173/', out = 'docs/screenshots/dev/shops', count = '12', size = '900x560'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true, settings: { quality: 'high' } })));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => { document.querySelector('#ui').style.visibility = 'hidden'; window.__anandapur.setElapsed(2700 * 0.3); });
const list = await p.evaluate(() => window.__game.world.shopkeepers.map((k) => ({ x: k.pos.x, z: k.pos.z, yaw: k.yaw, kind: k.kind, shop: k.shop })));
const byKind = {};
for (const k of list) (byKind[k.kind] ??= []).push(k);
console.log('shops:', list.length, Object.entries(byKind).map(([k, v]) => `${k} ${v.length}`).join(', '));
const pick = [];
for (let i = 0; pick.length < +count && i < 40; i++) for (const v of Object.values(byKind)) if (v[i] && pick.length < +count) pick.push(v[i]);
let i = 0;
for (const k of pick) {
  await p.evaluate((k) => {
    const g = window.__game, V = g.player.pos.constructor, fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
    window.__anandapur.teleport(k.x + fx * 9, k.z + fz * 9, k.yaw + Math.PI);
    let dd = 1.2;
    while (dd < 6.5 && g.world.isClear(k.x + fx * (dd + 0.4), k.z + fz * (dd + 0.4), 0.3)) dd += 0.25;
    g.cam.override = { pos: new V(k.x + fx * dd, 2.0, k.z + fz * dd), look: new V(k.x, dd < 3 ? 2.9 : 2.4, k.z) };
  }, k);
  await p.waitForTimeout(i === 0 ? 2500 : 900);
  await p.screenshot({ path: `${out}/${String(i++).padStart(2, '0')}-${k.kind}-${k.shop}.png` });
}
// the food stalls
const stalls = await p.evaluate(() => window.__game.city.stallVendors.map((v) => ({ id: v.id, x: v.pos.x, z: v.pos.z, fx: v.front.x, fz: v.front.z })));
const seen = new Set();
for (const s of stalls) {
  if (seen.has(s.id)) continue;
  seen.add(s.id);
  await p.evaluate((s) => {
    const g = window.__game, d = Math.hypot(s.fx - s.x, s.fz - s.z) || 1, fx = (s.fx - s.x) / d, fz = (s.fz - s.z) / d;
    g.cam.override = null;
    const yaw = Math.atan2(-fx, -fz);
    window.__anandapur.teleport(s.fx + fx * 1.2, s.fz + fz * 1.2, yaw);
    g.cam.snapBehind(yaw);
  }, s);
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/stall-${s.id}.png` });
}
console.log('errors:', errs.length ? errs.slice(0, 3) : 'none');
await b.close();
