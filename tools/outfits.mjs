import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
const looks = (process.argv[2] || 'sari').split(',');
for (const lk of looks) {
  await p.evaluate((lk) => {
    const g = window.__game;
    const L = { sari: { style: 'sari', color: 0xf4eedf, accent: 0xb3121f, hair: 'bun' }, kurta: { style: 'kurta', color: 0xf2c14e, accent: 0xb3121f, hair: 'short' }, shirt: { style: 'shirt', color: 0x3a6ea5, accent: 0xf4eedf, hair: 'short' }, frock: { style: 'frock', color: 0xd94f7a, accent: 0xffffff, hair: 'braid' }, salwar: { style: 'salwar', color: 0x2f6b8a, accent: 0xf6a21e, hair: 'braid' }, tee: { style: 'tee', color: 0x1a1a20, accent: 0xf6a21e, hair: 'short', pants: 0x2a3a5a } }[lk];
    g.player.char.setLook(L);
    window.__anandapur.teleport(0, -6, 0);
    window.__anandapur.setStage(0);
  }, lk);
  for (const [i, yaw] of [0, Math.PI, Math.PI / 2, -0.6].entries()) {
    await p.evaluate(([yaw, d]) => { const c = window.__game.cam; c.yaw = yaw; c.targetDistance = d; c.pitch = 0.05; }, [yaw, Number(process.env.DIST || 2.4)]);
    if (i === 3) { await p.keyboard.down('KeyW'); await p.waitForTimeout(700); }
    await p.waitForTimeout(900);
    await p.screenshot({ path: `docs/screenshots/dev/o-${lk}-${i}.png`, clip: process.env.DIST ? { x: 450, y: 120, width: 300, height: 600 } : { x: 400, y: 150, width: 400, height: 600 } });
    if (i === 3) await p.keyboard.up('KeyW');
  }
}
console.log(errs.join('\n') || 'no errors');
await b.close();
