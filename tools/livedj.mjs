// Visits every DJ spot on a (live) build in a phone-sized browser and reports what each plays.
// Usage: node tools/livedj.mjs <url>
import { chromium, devices } from '@playwright/test';
const url = process.argv[2] ?? 'https://puja-passport.pages.dev/';
const b = await chromium.launch({ headless: true, args: [...process.env.CHROME_GPU_ARGS.split(' '), '--autoplay-policy=no-user-gesture-required'], ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent });
const p = await ctx.newPage();
const errs = [];
p.on('console', (m) => m.type() !== 'log' && errs.push(m.text()));
p.on('requestfailed', (r) => errs.push('FAILED ' + r.url()));
await p.goto(url + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.mouse.click(200, 400);
const boxes = await p.evaluate(() => window.__anandapur.djBoxes());
for (let i = 0; i < boxes.length; i++) {
  await p.evaluate((d) => window.__anandapur.teleport(d.x + 4, d.z + 1, 0), boxes[i]);
  await p.waitForTimeout(4000);
  const r = await p.evaluate((i) => { const ch = window.__game.audio.djs[i]; return { title: ch?.title, src: ch?.el?.src?.split('/').pop(), t: ch?.el ? +ch.el.currentTime.toFixed(1) : null, paused: ch?.el?.paused, ready: ch?.el?.readyState, err: ch?.el?.error?.code ?? null }; }, i);
  console.log(i, boxes[i].pandal ?? '', JSON.stringify(r));
}
console.log('songs list:', await p.evaluate(() => window.__game.audio.songs.map((s) => s.file).join(' ')));
console.log('errors:', errs.slice(0, 6));
await b.close();
