import { chromium, devices } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const sizes = (process.argv[2] || '390x844').split(',');
for (const sz of sizes) {
  const [w, h] = sz.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://10.128.146.164:5174/?debug=1');
  await p.waitForSelector('.title-screen', { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `docs/screenshots/dev/m-${sz}-title.png` });
  await p.tap('.title-screen .title-buttons .btn');
  await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 30000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `docs/screenshots/dev/m-${sz}-tut.png` });
  await p.evaluate(() => document.querySelector('.tutorial [data-a=skip]')?.click());
  // joystick drag via CDP touch: press in lower-left, move up
  const cdp = await ctx.newCDPSession(p);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const jx = 90, jy = h - 140;
  const s0 = await p.evaluate(() => ({ ...window.__anandapur.getState().player }));
  await touch('touchStart', [{ x: jx, y: jy, id: 1 }]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: jx, y: jy - i * 8, id: 1 }]); await p.waitForTimeout(30); }
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `docs/screenshots/dev/m-${sz}-walk.png` });
  await touch('touchEnd', []);
  const s1 = await p.evaluate(() => ({ ...window.__anandapur.getState().player }));
  // camera swipe on the right half
  const y0 = await p.evaluate(() => window.__game.cam.yaw);
  await touch('touchStart', [{ x: w * 0.7, y: h * 0.45, id: 2 }]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: w * 0.7 - i * 12, y: h * 0.45, id: 2 }]); await p.waitForTimeout(20); }
  await touch('touchEnd', []);
  const y1 = await p.evaluate(() => window.__game.cam.yaw);
  // overlap check of HUD elements
  const boxes = await p.evaluate(() => {
    const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { s, x: r.x, y: r.y, w: r.width, h: r.height } : null; };
    return ['.clock', '.hud-right', '.minimap', '.compass', '.touch-btns', '.joy-base'].map(q).filter(Boolean);
  });
  const ov = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], c = boxes[j]; if (a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h) ov.push(a.s + '×' + c.s); }
  console.log(sz, 'moved', Math.hypot(s1.x - s0.x, s1.z - s0.z).toFixed(1), 'm; cam yaw Δ', (y1 - y0).toFixed(2), '; overlaps:', ov.join(', ') || 'none', errs.join(' ') || '');
  await ctx.close();
}
await b.close();
