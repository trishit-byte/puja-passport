// Busy-town views: a fuchka ring, a roll queue, a shop counter, and a street with traffic.
import { chromium } from '@playwright/test';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 800, height: 520 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true, settings: { quality: 'high' } })));
const p = await ctx.newPage();
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => { document.querySelector('#ui').style.visibility = 'hidden'; window.__anandapur.setElapsed(2700 * 0.35); });
const view = async (name, fn, wait = 1500) => { await p.evaluate(fn); await p.waitForTimeout(wait); await p.screenshot({ path: `${out}-${name}.png` }); };
for (const id of ['phuchka', 'roll']) await view(id, `(() => { const g = window.__game, V = g.player.pos.constructor; const v = g.city.stallVendors.find((s) => s.id === '${id}'); const a = v.yaw + 0.9; window.__anandapur.teleport(v.front.x + Math.sin(a) * 12, v.front.z + Math.cos(a) * 12, 0); g.cam.override = { pos: new V(v.front.x + Math.sin(a) * 6.5, 3.2, v.front.z + Math.cos(a) * 6.5), look: new V(v.front.x, 1, v.front.z) }; })()`, 3000);
await view('shop', `(() => { const g = window.__game, V = g.player.pos.constructor; const n = g.city.npcs.find((q) => q.mode === 'queue' && Math.hypot(q.pos.x, q.pos.z) < 90 && g.city.npcs.some((s) => s.role === 'shopkeeper' && Math.hypot(s.pos.x - q.pos.x, s.pos.z - q.pos.z) < 4)); const a = n.yaw + 2.2; window.__anandapur.teleport(n.pos.x + Math.sin(a) * 12, n.pos.z + Math.cos(a) * 12, 0); g.cam.override = { pos: new V(n.pos.x + Math.sin(a) * 6, 2.6, n.pos.z + Math.cos(a) * 6), look: new V(n.pos.x, 1.2, n.pos.z) }; })()`);
await view('street', `(() => { const g = window.__game, V = g.player.pos.constructor; g.cam.override = null; window.__anandapur.teleport(40, -10, -1.57); g.cam.snapBehind(-1.57); g.cam.targetDistance = 7; g.cam.pitch = 0.25; })()`, 2500);
await view('street2', `(() => { const g = window.__game; window.__anandapur.teleport(2, -60, 0); g.cam.snapBehind(0); })()`, 2500);
await b.close();
