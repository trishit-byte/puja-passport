import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const sizes = [['1920x1080', false], ['1366x768', false], ['1280x720', false], ['1024x768', true], ['768x1024', true], ['1180x820', true], ['844x390', true], ['375x667', true], ['412x915', true]];
for (const [sz, touch] of sizes) {
  const [w, h] = sz.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://10.128.146.164:5174/?debug=1');
  await p.waitForSelector('.title-screen', { timeout: 90000 }); await p.waitForTimeout(800);
  const titleFits = await p.evaluate(() => { const c = document.querySelector('.title-card').getBoundingClientRect(); return c.top >= -1 && c.bottom <= innerHeight + 1 && c.left >= -1 && c.right <= innerWidth + 1; });
  await p.screenshot({ path: `docs/screenshots/dev/mx-${sz}-title.png` });
  await p.click('.title-screen .title-buttons .btn');
  await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 30000 });
  await p.evaluate(() => document.querySelector('.tutorial [data-a=skip]')?.click());
  await p.waitForTimeout(800);
  const ov = await p.evaluate(() => {
    const sel = ['.clock', '.hud-right', '.minimap', '.compass', '.touch-btns', '.joy-base'];
    const r = sel.map((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return b.width && getComputedStyle(e).display !== 'none' && !e.closest('.hidden') ? { s, b } : null; }).filter(Boolean);
    const out = [], off = [];
    for (const { s, b } of r) if (b.left < -1 || b.top < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1) off.push(s);
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) { const a = r[i].b, c = r[j].b; if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) out.push(r[i].s + '×' + r[j].s); }
    return { out, off };
  });
  await p.screenshot({ path: `docs/screenshots/dev/mx-${sz}-play.png` });
  // passport + map modals fit?
  await p.keyboard.press('KeyP'); await p.waitForTimeout(400);
  const ppFits = await p.evaluate(() => { const c = document.querySelector('.passport'); if (!c) return 'none'; const b = c.getBoundingClientRect(); return b.bottom <= innerHeight + 1 || getComputedStyle(c).overflowY !== 'visible' || getComputedStyle(c.parentElement).overflowY !== 'visible'; });
  console.log(sz.padEnd(10), 'title fits:', titleFits, '| HUD overlaps:', ov.out.join(', ') || 'none', '| offscreen:', ov.off.join(', ') || 'none', '| passport ok:', ppFits, errs.join(' ') || '');
  await ctx.close();
}
await b.close();
