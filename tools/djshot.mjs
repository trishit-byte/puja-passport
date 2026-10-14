import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: [...process.env.CHROME_GPU_ARGS.split(' '), '--autoplay-policy=no-user-gesture-required'], ignoreDefaultArgs: ['--enable-unsafe-swiftshader', '--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://10.128.146.164:5174/?debug=1');
await p.waitForSelector('.title-screen', { timeout: 90000 });
await p.click('.title-screen [data-a=start]');
await p.waitForFunction(() => window.__game.phase === 'play');
const boxes = await p.evaluate(() => window.__anandapur.djBoxes());
console.log(JSON.stringify(boxes));
for (const [i, bx] of boxes.slice(0, 3).entries()) {
  await p.evaluate(([x, z]) => { const a = window.__anandapur; a.teleport(x + 7, z + 7, Math.atan2(-7, -7)); window.__game.cam.pitch = 0.18; window.__game.cam.targetDistance = 6; a.setStage(2); }, [bx.x, bx.z]);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `docs/screenshots/dev/dj-${i}.png` });
}
const bx = boxes[0];
await p.evaluate(([x, z]) => window.__anandapur.teleport(x + 2.5, z, -Math.PI / 2), [bx.x, bx.z]);
await p.waitForTimeout(800);
console.log('prompt', (await p.evaluate(() => window.__anandapur.getState())).prompt);
await p.keyboard.press('KeyE'); await p.waitForTimeout(500);
console.log('after E', JSON.stringify((await p.evaluate(() => window.__anandapur.djBoxes()))[0]));
console.log(errs.join('\n') || 'no errors');
await b.close();
