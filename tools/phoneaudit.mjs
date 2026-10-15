// Phone audit on the production build: real touch taps through the recent features.
// Usage: node tools/phoneaudit.mjs <url> <outDir> [WxH@dpr,...]
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const [url = 'http://10.128.146.164:5173/', out = 'docs/screenshots/dev/phone', sizes = '390x844@3,412x915@2.6,844x390@3'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
let failures = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
};
for (const spec of sizes.split(',')) {
  const [wh, dpr] = spec.split('@');
  const [w, h] = wh.split('x').map(Number);
  console.log(`\n== ${wh} @${dpr}x`);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: +dpr, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.clear(); } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/favicon|songs|NotAllowedError|play\(\)/.test(m.text()) && errs.push(m.text()));
  const shot = (n) => p.screenshot({ path: `${out}/${wh}-${n}.png` });
  const t0 = Date.now();
  await p.goto(url + '?debug=1');
  await p.waitForSelector('.title-screen', { timeout: 120000 });
  check('title page fits the screen', await p.evaluate(() => { const c = document.querySelector('.title-card').getBoundingClientRect(); return c.top >= -1 && c.left >= -1 && c.right <= innerWidth + 1 && (c.bottom <= innerHeight + 1 || getComputedStyle(document.querySelector('.title-screen')).overflowY !== 'hidden'); }));
  await shot('1-title');
  await p.tap('.title-screen .title-buttons .btn');
  await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 60000 });
  console.log(`  load to play: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await p.evaluate(() => document.querySelector('.tutorial [data-a=skip]')?.click());
  const q = await p.evaluate(() => ({ quality: window.__game.data.settings.quality, touchUI: !!document.querySelector('.touch-ui'), dpr: window.__game.renderer.renderer.getPixelRatio() }));
  check('touch controls shown, phone defaults to Medium', q.touchUI && q.quality === 'medium', JSON.stringify(q));
  // HUD: nothing overlapping or off-screen
  const hud = await p.evaluate(() => {
    const sel = ['.clock', '.hud-btns', '.minimap', '.compass', '.joy-zone', '.t-act'];
    const r = sel.map((s) => [s, document.querySelector(s)?.getBoundingClientRect()]).filter(([, x]) => x && x.width > 0);
    const off = r.filter(([, x]) => x.left < -1 || x.top < -1 || x.right > innerWidth + 1 || x.bottom > innerHeight + 1).map(([s]) => s);
    const over = [];
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
      const a = r[i][1], c = r[j][1];
      if (r[i][0] === '.joy-zone' || r[j][0] === '.joy-zone') continue; // the joystick zone is an invisible half-screen catch area
      if (a.left < c.right - 2 && c.left < a.right - 2 && a.top < c.bottom - 2 && c.top < a.bottom - 2) over.push(r[i][0] + '×' + r[j][0]);
    }
    return { off, over };
  });
  check('HUD elements on-screen and not overlapping', !hud.off.length && !hud.over.length, JSON.stringify(hud));
  const cb = await p.evaluate(() => { const r = document.querySelector('.compass').getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) }; });
  check('compass is a slim strip at the top', cb.top < 40 && cb.h <= 26 && cb.w <= 300, JSON.stringify(cb));
  check('no RUN button', !(await p.$('.t-run')));
  // hold the joystick forward: walk first, run after 2 s
  const jz = await p.evaluate(() => { const r = document.querySelector('.joy-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.7 }; });
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', jz.x, jz.y);
  await touch('touchMove', jz.x, jz.y - 60);
  await p.waitForTimeout(800);
  const early = await p.evaluate(() => window.__game.input.runToggle);
  await p.waitForTimeout(1700);
  const late = await p.evaluate(() => window.__game.input.runToggle);
  await touch('touchEnd', 0, 0);
  await p.waitForTimeout(200);
  const after = await p.evaluate(() => window.__game.input.runToggle);
  check('holding forward walks, then runs after 2 s, and stops on release', !early && late && !after, JSON.stringify({ early, late, after }));
  await shot('2-hud');
  // ground guide near an unvisited pandal
  await p.evaluate(() => { const pd = window.__anandapur.pandals.find((x) => x.id === 'bonedi-bari'); const fx = Math.sin(pd.facing), fz = Math.cos(pd.facing); const ex = pd.x + fx * (pd.radius + 1.5), ez = pd.z + fz * (pd.radius + 1.5); const px = ex + fx * 14, pz = ez + fz * 14; const yaw = Math.atan2(ex - px, ez - pz); window.__anandapur.teleport(px, pz, yaw); window.__game.cam.snapBehind(yaw); });
  await p.waitForTimeout(1500);
  check('ground guide shows near an unvisited pandal', await p.evaluate(() => window.__game.guide.visible && window.__game.gateMark.visible));
  await shot('3-guide');
  // kneeling pranam with the action button
  await p.evaluate(() => { const t = window.__game.builds.get('bonedi-bari'); const d = t.darshan, L = t.view.look; window.__anandapur.teleport(d.x, d.z, Math.atan2(L.x - d.x, L.z - d.z)); window.__game.cam.snapBehind(Math.atan2(L.x - d.x, L.z - d.z) + 1.2); });
  await p.waitForTimeout(1200);
  const label = await p.evaluate(() => document.querySelector('.t-act-label')?.textContent ?? '');
  check('action button offers the pranam at the protima', /pranam/i.test(label), label);
  await p.tap('.t-act');
  await p.waitForTimeout(2600);
  check('tapping it performs the kneeling pranam', await p.evaluate(() => window.__game.player.char.pose === 'pranam'));
  await shot('4-pranam');
  await p.waitForTimeout(3500);
  // eat at the fuchka stall
  await p.evaluate(() => { const s = window.__game.city.stallVendors.find((v) => v.id === 'phuchka'); window.__anandapur.teleport(s.front.x, s.front.z, s.yaw + Math.PI); window.__game.cam.snapBehind(s.yaw + Math.PI + 0.6); });
  await p.waitForTimeout(1200);
  await p.tap('.t-act');
  await p.waitForTimeout(1500);
  check('tap to eat fuchka', await p.evaluate(() => window.__game.actions.current?.id ?? ''), '');
  await shot('5-fuchka');
  // dance at a DJ spot
  await p.evaluate(() => { const d = window.__anandapur.djBoxes()[0]; window.__anandapur.teleport(d.x + 3.4, d.z + 0.5, -1.57); });
  await p.waitForTimeout(1200);
  await p.tap('.t-act');
  await p.waitForTimeout(1500);
  check('tap to dance at a DJ spot', await p.evaluate(() => window.__game.player.char.pose === 'dance' || window.__game.actions.current?.id === 'dance'));
  await shot('6-dance');
  // passport opens and closes by tap
  await p.tap('[data-act=passport]').catch(() => p.tap('.hud-btns button'));
  await p.waitForTimeout(800);
  const pp = await p.evaluate(() => { const c = document.querySelector('.passport-wrap .passport, .passport-wrap'); const r = c?.getBoundingClientRect(); return { open: !!c, fits: !!r && r.left >= -1 && r.right <= innerWidth + 1 }; });
  check('passport opens and fits the width', pp.open && pp.fits, JSON.stringify(pp));
  await shot('7-passport');
  await p.evaluate(() => document.querySelector('.passport-wrap [data-a=close], .passport-wrap .close, .modal-close')?.click());
  await p.keyboard.press('Escape').catch(() => {});
  await p.waitForTimeout(500);
  // end the night and retry by tap
  await p.evaluate(() => { window.__game.ui.closeAll?.([]); window.__anandapur.setElapsed(2699.5); });
  await p.waitForSelector('.nightover [data-a=retry]', { timeout: 20000 });
  await shot('8-nightover');
  const card = await p.evaluate(() => { const r = document.querySelector('.nightover-card').getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; });
  check('night-over card fits', card);
  await p.tap('.nightover [data-a=retry]');
  await p.waitForSelector('.title-screen [data-a=new]', { timeout: 120000 });
  await p.tap('.title-screen [data-a=new]');
  await p.evaluate(() => document.querySelector('.tutorial [data-a=skip]')?.click());
  await p.waitForFunction(() => window.__game?.phase === 'play' && window.__anandapur?.night().elapsed > 0.5, null, { timeout: 120000 });
  const n = await p.evaluate(() => ({ ...window.__anandapur.night(), stamps: window.__anandapur.getState().stamps.length }));
  check('"Try the Night Again" starts a fresh night', n.elapsed < 30 && n.status === 'active' && n.stamps === 0, JSON.stringify(n));
  check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}
await b.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall phone checks passed');
process.exit(failures ? 1 : 0);
