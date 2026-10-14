import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: [...process.env.CHROME_GPU_ARGS.split(' '), '--autoplay-policy=no-user-gesture-required'], ignoreDefaultArgs: ['--enable-unsafe-swiftshader', '--mute-audio'] });
const ctx = await b.newContext();
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://10.128.146.164:5173/?debug=1');
await p.waitForSelector('.title-screen', { timeout: 90000 });
await p.click('.title-screen [data-a=start]');
await p.waitForFunction(() => window.__game.phase === 'play');
const A = (fn, ...a) => p.evaluate(([fn, a]) => window.__anandapur[fn](...a), [fn, a]);
await p.waitForTimeout(1500);
const boxes = await A('djBoxes');
const pand = await p.evaluate(() => window.__anandapur.pandals);
const R = await p.evaluate(() => Object.fromEntries(window.__game.builds ? [] : []));
console.log('boxes', boxes.length);
for (const bx of boxes) {
  const dmin = Math.min(...pand.map((q) => Math.hypot(q.x - bx.x, q.z - bx.z)));
  const dbox = Math.min(...boxes.filter((o) => o !== bx).map((o) => Math.hypot(o.x - bx.x, o.z - bx.z)));
  console.log(`  ${bx.pandal.padEnd(15)} (${Math.round(bx.x)},${Math.round(bx.z)})  nearest pandal centre ${dmin.toFixed(0)} m, nearest other box ${dbox.toFixed(0)} m`);
}
// ducking: stand on a dance floor; mute music → what remains (ambience) should be ~silent
const bx = boxes[0];
await A('teleport', bx.x + 3, bx.z, 0); await p.waitForTimeout(2500);
const lvl = async () => { let s = 0; for (let i = 0; i < 12; i++) { s += await A('audioLevel'); await p.waitForTimeout(100); } return (s / 12).toFixed(1); };
const withMusic = await lvl();
await p.evaluate(() => window.__game.audio.applySettings({ music: 0 })); await p.waitForTimeout(1200);
const ambOnly = await lvl();
console.log(`on dance floor: everything ${withMusic} dBFS | with DJ music muted (= what leaks through) ${ambOnly} dBFS | presence ${await p.evaluate(() => window.__game.audio.djPresence.toFixed(2))}`);
await p.evaluate(() => window.__game.audio.applySettings({ music: 0.85 }));
await A('teleport', 34, -38, 0); await p.waitForTimeout(2500);
console.log(`inside Dhaker Taal: ${await lvl()} dBFS, presence ${await p.evaluate(() => window.__game.audio.djPresence.toFixed(2))}`);
console.log(errs.join('\n') || 'no errors');
await b.close();
