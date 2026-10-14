// Fixed views for before/after visual comparison. Usage: node tools/compare.mjs <url> <outPrefix>
import { chromium } from '@playwright/test';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 900, height: 600 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true, settings: { quality: 'high' } })));
const p = await ctx.newPage();
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => { document.querySelector('#ui').style.visibility = 'hidden'; });
const shot = async (name, fn, arg) => {
  await p.evaluate(fn, arg);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}-${name}.png` });
};
// crowd close-ups: the first stationary NPC of each style, from the front and from behind
for (const [style, back] of [['sari', 0], ['sari', 1], ['salwar', 0], ['kurta', 0], ['frock', 0], ['shirt', 1], ['tee', 0], ['dhaki', 0]]) {
  await shot(`npc-${style}${back ? '-back' : ''}`, ([style, back]) => {
    const g = window.__game, T = g.scene.children[0].constructor; // any Object3D ctor is fine
    const n = g.city.npcs.find((n) => n.ch.look.style === style && n.mode !== 'walk' && n.ch.look.scale === undefined) ?? g.city.npcs.find((n) => n.ch.look.style === style);
    const pos = n.ch.group.position, yaw = n.ch.group.rotation.y + (back ? Math.PI : 0);
    window.__anandapur.teleport(pos.x + 25, pos.z + 25, 0);
    const cp = pos.clone(); cp.x += Math.sin(yaw) * 2.2; cp.z += Math.cos(yaw) * 2.2; cp.y = 1.5;
    const look = pos.clone(); look.y = 1.05;
    g.cam.override = { pos: cp, look };
  }, [style, back]);
}
await shot('protima', () => { const g = window.__game; const b = g.builds.get('bonedi-bari'); window.__anandapur.teleport(b.darshan.x, b.darshan.z, 0); g.cam.override = null; const L = b.view.look; window.__anandapur.teleport(b.darshan.x, b.darshan.z, Math.atan2(L.x - b.darshan.x, L.z - b.darshan.z)); });
await shot('street1', () => { const g = window.__game; g.cam.override = null; window.__anandapur.teleport(-100, -20, 0.5); g.cam.yaw = 0.5 + Math.PI; g.cam.pitch = 0.18; g.cam.targetDistance = 7; });
await shot('street2', () => { const g = window.__game; window.__anandapur.teleport(60, -20, 2); g.cam.yaw = 2 + Math.PI; g.cam.pitch = 0.18; g.cam.targetDistance = 7; });
await shot('street3', () => { const g = window.__game; window.__anandapur.teleport(-60, 90, 4); g.cam.yaw = 4 + Math.PI; g.cam.pitch = 0.18; g.cam.targetDistance = 7; });
await shot('vehicle', () => {
  const g = window.__game, v = g.fest.vehicles[0]; for (const q of g.fest.vehicles) { q.speed = 0; q.cur = 0; }
  const pos = v.g.position, yaw = v.g.rotation.y; window.__anandapur.teleport(pos.x + 30, pos.z + 30, 0);
  const cp = pos.clone(); cp.x += Math.sin(yaw + 0.9) * 4.5; cp.z += Math.cos(yaw + 0.9) * 4.5; cp.y = 2.2; const look = pos.clone(); look.y = 1;
  g.cam.override = { pos: cp, look };
});
await b.close();
