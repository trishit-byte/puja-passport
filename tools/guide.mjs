// Screens of the wayfinding guide at several distances from a pandal entrance.
import { chromium } from '@playwright/test';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 900, height: 560 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
// [pandal, metres out from the entrance, sideways offset]
const shots = [['nodir-alo', 20, 6], ['nodir-alo', 9, -5], ['nodir-alo', 36, 0], ['bonedi-bari', 18, 8]];
for (const [k, [id, dist, side]] of shots.entries()) {
  await p.evaluate(([id, dist, side]) => {
    const g = window.__game, pd = window.__anandapur.pandals.find((q) => q.id === id);
    const fx = Math.sin(pd.facing), fz = Math.cos(pd.facing);
    const ex = pd.x + fx * (pd.radius + 1.5), ez = pd.z + fz * (pd.radius + 1.5);
    const px = ex + fx * dist - fz * side, pz = ez + fz * dist + fx * side;
    const yaw = Math.atan2(ex - px, ez - pz) + 0.5; // not facing it squarely
    window.__anandapur.teleport(px, pz, yaw);
    g.cam.snapBehind(yaw);
  }, [id, dist, side]);
  await p.waitForTimeout(1800);
  console.log(id, dist, JSON.stringify(await p.evaluate(() => ({ arrows: window.__game.guide.visible, gate: window.__game.gateMark.visible }))));
  await p.screenshot({ path: `${out}-${k}.png` });
}
// after visiting (entering) Bonedi Bari, its guide must be gone
await p.evaluate(() => { const pd = window.__anandapur.pandals.find((q) => q.id === 'bonedi-bari'); window.__anandapur.teleport(pd.x, pd.z, 0); });
await p.waitForTimeout(1500);
await p.evaluate(() => { const pd = window.__anandapur.pandals.find((q) => q.id === 'bonedi-bari'); const fx = Math.sin(pd.facing), fz = Math.cos(pd.facing); const ex = pd.x + fx * (pd.radius + 1.5), ez = pd.z + fz * (pd.radius + 1.5); window.__anandapur.teleport(ex + fx * 18, ez + fz * 18, 0); });
await p.waitForTimeout(1200);
console.log('bonedi-bari after visiting', JSON.stringify(await p.evaluate(() => ({ discovered: window.__anandapur.getState().discovered, arrows: window.__game.guide.visible, gate: window.__game.gateMark.visible }))));
await b.close();
