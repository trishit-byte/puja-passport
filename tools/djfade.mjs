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
await p.waitForTimeout(2000);
// mute ambience so only the DJ music is measured
await p.evaluate(() => window.__game.audio.applySettings({ ambient: 0 }));
const box = (await A('djBoxes')).find((b) => b.pandal === 'shobuj-swapno') ?? (await A('djBoxes'))[1];
for (const d of [2, 5, 8, 11, 14, 15, 17, 25]) {
  await A('teleport', box.x + d, box.z, 0); await p.waitForTimeout(1800);
  let s = 0; for (let i = 0; i < 12; i++) { s += await A('audioLevel'); await p.waitForTimeout(100); }
  const active = (await A('djBoxes')).find((b) => b.x === box.x).active;
  console.log(`${String(d).padStart(2)} m from DJ box: ${(s / 12).toFixed(1)} dBFS  (song ${active ? 'playing' : 'paused'})`);
}
await b.close();
