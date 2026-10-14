import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: [...process.env.CHROME_GPU_ARGS.split(' '), '--autoplay-policy=no-user-gesture-required'], ignoreDefaultArgs: ['--enable-unsafe-swiftshader', '--mute-audio'] });
const ctx = await b.newContext();
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto('http://10.128.146.164:5173/?debug=1');
await p.waitForSelector('.title-screen', { timeout: 90000 });
await p.click('.title-screen [data-a=start]');
await p.waitForFunction(() => window.__game.phase === 'play');
const A = (fn, ...a) => p.evaluate(([fn, a]) => window.__anandapur[fn](...a), [fn, a]);
const lvl = async () => { let s = 0; for (let i = 0; i < 15; i++) { s += await A('audioLevel'); await p.waitForTimeout(100); } return (s / 15).toFixed(1); };
for (const [x, z] of [[-150, 30], [-140, -100], [150, 20]]) {
  await A('teleport', x, z, 0); await p.waitForTimeout(2500);
  const all = await lvl();
  await p.evaluate(() => window.__game.audio.applySettings({ music: 0 })); await p.waitForTimeout(800); const noMusic = await lvl();
  await p.evaluate(() => window.__game.audio.applySettings({ music: 0.6, ambient: 0 })); await p.waitForTimeout(800); const noAmb = await lvl();
  await p.evaluate(() => window.__game.audio.applySettings({ ambient: 0.8 }));
  const djd = await p.evaluate(([x, z]) => Math.min(...window.__game.audio.djs.map((d) => Math.hypot(d.x - x, d.z - z))).toFixed(0), [x, z]);
  console.log(`(${x},${z}) all ${all} | music muted ${noMusic} | ambience muted ${noAmb} | nearest DJ ${djd} m`);
}
await b.close();
