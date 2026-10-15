// Visits every DJ spot on a (live) build in a phone-sized browser and reports what each plays.
// Usage: node tools/livedj.mjs <url>
import { chromium, devices } from '@playwright/test';
const url = process.argv[2] ?? 'https://puja-passport.pages.dev/';
const b = await chromium.launch({ headless: true, args: [...process.env.CHROME_GPU_ARGS.split(' '), '--autoplay-policy=document-user-activation-required'], ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent });
const p = await ctx.newPage();
const errs = [];
p.on('console', (m) => m.type() !== 'log' && errs.push(m.text()));
p.on('requestfailed', (r) => errs.push('FAILED ' + r.url()));
// a real tap on the title button, the way a player starts (sound is only allowed after a tap)
await p.goto(url + '?debug=1');
await p.waitForSelector('.title-screen .title-buttons .btn', { timeout: 120000 });
await p.tap('.title-screen .title-buttons .btn');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
await p.evaluate(() => document.querySelector('.tutorial [data-a=skip]')?.click());
console.log('audio context:', await p.evaluate(() => window.__game.audio.ctx?.state));
const boxes = await p.evaluate(() => window.__anandapur.djBoxes());
for (let i = 0; i < boxes.length; i++) {
  await p.evaluate((d) => window.__anandapur.teleport(d.x + 4, d.z + 1, 0), boxes[i]);
  await p.waitForTimeout(4000);
  const r = await p.evaluate(async (i) => { const ch = window.__game.audio.djs[i]; const t0 = ch?.el?.currentTime ?? 0; await new Promise((r) => setTimeout(r, 1000)); return { title: ch?.title, src: ch?.el?.src?.split('/').pop(), t: ch?.el ? +ch.el.currentTime.toFixed(1) : null, advancing: ch?.el ? ch.el.currentTime > t0 + 0.5 : false, paused: ch?.el?.paused, ready: ch?.el?.readyState, err: ch?.el?.error?.code ?? null }; }, i);
  console.log(i, boxes[i].pandal ?? '', JSON.stringify(r));
}
console.log('songs list:', await p.evaluate(() => window.__game.audio.songs.map((s) => s.file).join(' ')));
console.log('errors:', errs.slice(0, 6));
await b.close();
