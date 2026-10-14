// Close-ups of NPC props: dhunuchi dancers, eaters, photo-takers, the aarti priest.
import { chromium } from '@playwright/test';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 640, height: 480 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true, settings: { quality: 'high' } })));
const p = await ctx.newPage();
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => { document.querySelector('#ui').style.visibility = 'hidden'; window.__anandapur.setElapsed(2700 * 0.16); }); // ~7:36 PM: aarti
const shots = [
  ['dhunuchi', `return g.city.npcs.find((n) => n.ch.pose === 'dhunuchi' && n.role !== 'walker')?.ch;`, 3.0, 2.2],
  ['eater', `return g.city.npcs.find((n) => n.mode === 'eat')?.ch;`, 2.0, 1.6],
  ['photo', `return g.city.npcs.find((n) => n.mode === 'photo')?.ch;`, 2.0, 1.7],
  ['priest', `return g.city.priests.find((q) => q.ch.group.visible)?.ch ?? g.city.priests[0].ch;`, 2.4, 1.8],
];
let k = 0;
for (const [name, fn, dist, h] of shots) {
  await p.evaluate(([fn, dist, h]) => {
    const g = window.__game, V = g.player.pos.constructor;
    const ch = new Function('g', fn)(g);
    const pos = ch.group.getWorldPosition(new V()), yaw = ch.group.rotation.y + 0.6;
    window.__anandapur.teleport(pos.x + Math.sin(yaw) * 6, pos.z + Math.cos(yaw) * 6, 0);
    g.cam.override = { pos: new V(pos.x + Math.sin(yaw) * dist, h, pos.z + Math.cos(yaw) * dist), look: new V(pos.x, 1.3, pos.z) };
  }, [fn, dist, h]);
  await p.waitForTimeout(k++ ? 1500 : 3000);
  await p.screenshot({ path: `${out}-${name}.png` });
}
await b.close();
