// Where does the crowd cost go on a throttled phone? normal vs crowd logic off vs crowd hidden.
import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto('http://10.128.146.164:5173/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.evaluate(() => { window.__anandapur.teleport(0, -6, 0); window.__anandapur.setElapsed(2700 * 0.3); });
const measure = async (label) => {
  await p.waitForTimeout(3000);
  const ms = await p.evaluate(() => new Promise((r) => { const a = []; let last = performance.now(); const f = () => { const n = performance.now(); a.push(n - last); last = n; a.length < 120 ? requestAnimationFrame(f) : r(a.sort((x, y) => x - y)[60]); }; requestAnimationFrame(f); }));
  const ri = await p.evaluate(() => window.__anandapur.renderInfo());
  console.log(label.padEnd(26), 'frame p50', ms.toFixed(1), 'ms  calls', ri.calls);
};
await measure('normal');
await p.evaluate(() => { const c = window.__game.city; c.__upd = c.update; c.update = () => {}; });
await measure('crowd logic off');
await p.evaluate(() => { const c = window.__game.city; c.update = c.__upd; c.group.visible = false; });
await measure('crowd hidden');
await p.evaluate(() => { window.__game.city.group.visible = true; for (const v of window.__game.fest.vehicles) v.g.visible = false; window.__game.fest.__u = window.__game.fest.update; });
await measure('(vehicles reshown each frame)');
await p.evaluate(() => { window.__game.renderer.renderer.shadowMap.enabled = false; });
await measure('shadows off');
await b.close();
