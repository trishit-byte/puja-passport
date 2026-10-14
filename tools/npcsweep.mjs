// Close-ups of every kind of NPC and activity, for spotting anything that looks wrong.
// Usage: node tools/npcsweep.mjs <url> <outDir>
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const [url = 'http://10.128.146.164:5173/', out = 'docs/screenshots/dev/sweep'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 640, height: 480 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true, settings: { quality: 'high' } })));
const p = await ctx.newPage();
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => { document.querySelector('#ui').style.visibility = 'hidden'; window.__anandapur.setElapsed(2700 * 0.3); }); // ~9 PM: full crowds
await p.waitForTimeout(1500);
// aim the camera at a character from the front-ish, ~3 m away
const look = async (name, fn, arg, dist = 3.2, h = 1.6, wait = 1100) => {
  const ok = await p.evaluate(([fn, arg, dist, h]) => {
    const g = window.__game, V = g.player.pos.constructor;
    const ch = new Function('g', 'arg', fn)(g, arg);
    if (!ch) return false;
    const pos = ch.group.getWorldPosition(new V()), yaw = ch.group.rotation.y + 0.5;
    window.__anandapur.teleport(pos.x + Math.sin(yaw) * 9, pos.z + Math.cos(yaw) * 9, 0);
    g.cam.override = { pos: new V(pos.x + Math.sin(yaw) * dist, h, pos.z + Math.cos(yaw) * dist), look: new V(pos.x, 1.0, pos.z) };
    return true;
  }, [fn, arg, dist, h]);
  if (!ok) return console.log('  (none)', name);
  await p.waitForTimeout(wait);
  await p.screenshot({ path: `${out}/${name}.png` });
};
const npc = (pred) => `const L = g.city.npcs.filter((n) => ${pred}); return L[arg % Math.max(1, L.length)]?.ch;`;
let i = 0;
for (const [mode, n] of [['walk', 3], ['idle', 3], ['queue', 2], ['pray', 2], ['photo', 2], ['eat', 2], ['sit', 2], ['drum', 2], ['dance', 2], ['vendor', 3]]) {
  for (let k = 0; k < n; k++) await look(`${String(i++).padStart(2, '0')}-${mode}-${k}`, npc(`n.mode === '${mode}'`), k * 7, 3.2, 1.6, i < 2 ? 2500 : 1100);
}
await look(`${i++}-shopkeeper`, npc(`n.role === 'shopkeeper'`), 3);
await look(`${i++}-balloons`, `const L = g.city.npcs.filter((n) => n.ch.group.children.some((c) => c.type === 'Group' && c.children.length > 10)); return L[0]?.ch;`, 0, 4.5, 2.2);
// DJ dancers (two boxes)
for (const bx of [0, 5]) await look(`${i++}-dj-${bx}`, `const b = g.djs.boxes[arg]; return b.dancers[0].ch;`, bx, 6.5, 3.2);
// aarti: devotees and the purohit
await p.evaluate(() => window.__anandapur.setElapsed(2700 * (1.6 / 10))); // ~7:36 PM
await p.waitForTimeout(1500);
await look(`${i++}-aarti-priest`, `return g.city.priests?.[0]?.ch;`, 0, 3.2, 1.8, 2000);
await look(`${i++}-aarti-devotees`, `return g.city.devotees?.[2]?.ch;`, 0, 4.0, 2.0);
// the player's own dhunuchi at Dhaker Taal
await p.evaluate(() => { const g = window.__game; g.cam.override = null; const t = window.__anandapur.targets(); void t; g.actions.start({ id: 'dhunuchi', pose: 'dhunuchi', prop: 'dhunuchi' }); });
await p.waitForTimeout(400);
await look(`${i++}-player-dhunuchi`, `return g.player.char;`, 0, 2.6, 1.9, 900);
await b.close();
console.log('done');
