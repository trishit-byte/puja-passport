import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })); } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://10.128.146.164:5173/?debug=1');
await p.waitForSelector('.title-screen', { timeout: 90000 }); await p.waitForTimeout(1500);
await p.screenshot({ path: 'docs/screenshots/dev/a-title.png' });
await p.click('.title-screen .title-buttons .btn');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 30000 });
const st = () => p.evaluate(() => ({ prompt: window.__anandapur.getState().prompt, action: window.__game.actions.current?.id ?? null, pose: window.__game.player.char.pose }));
const shot = async (n) => { await p.waitForTimeout(1300); await p.screenshot({ path: `docs/screenshots/dev/a-${n}.png` }); };
// eat phuchka
const v = await p.evaluate(() => { const s = window.__game.city.stallVendors.find((v) => v.id === 'phuchka'); return { x: s.front.x, z: s.front.z, yaw: s.yaw }; });
await p.evaluate((v) => { window.__anandapur.teleport(v.x, v.z, v.yaw + Math.PI); const c = window.__game.cam; c.yaw = v.yaw + 0.9; c.targetDistance = 3; c.pitch = 0.15; }, v);
await p.waitForTimeout(400); console.log('at phuchka', JSON.stringify(await st()));
await p.keyboard.press('KeyE'); await shot('eat'); console.log('eating', JSON.stringify(await st()));
await p.keyboard.down('KeyS'); await p.waitForTimeout(700); await p.keyboard.up('KeyS'); console.log('after walking', JSON.stringify(await st()));
// dance at DJ box
const d = await p.evaluate(() => window.__anandapur.djBoxes()[0]);
await p.evaluate((d) => { window.__anandapur.teleport(d.x + 3.4, d.z + 0.5, -1.57); const c = window.__game.cam; c.targetDistance = 5; c.pitch = 0.2; }, d);
await p.waitForTimeout(500); console.log('at DJ', JSON.stringify(await st()));
await p.keyboard.press('KeyE'); await shot('dance'); console.log('dancing', JSON.stringify(await st()));
await p.keyboard.press('KeyE'); await p.waitForTimeout(300); console.log('E again', JSON.stringify(await st()));
// bench
const bn = await p.evaluate(() => window.__game.world.benches[0]);
await p.evaluate((bn) => { window.__anandapur.teleport(bn.x + Math.sin(bn.yaw) * 1.2, bn.z + Math.cos(bn.yaw) * 1.2, bn.yaw + Math.PI); const c = window.__game.cam; c.yaw = bn.yaw + 0.6; c.targetDistance = 4; }, bn);
await p.waitForTimeout(400); console.log('at bench', JSON.stringify(await st()));
await p.keyboard.press('KeyE'); await shot('sit'); console.log('sitting', JSON.stringify(await st()));
await p.keyboard.down('KeyW'); await p.waitForTimeout(500); await p.keyboard.up('KeyW'); console.log('stood up', JSON.stringify(await st()));
// pranam
await p.evaluate(() => window.__anandapur.teleportTo('bonedi-bari', false));
await p.evaluate(() => { const b = window.__game.builds.get('alor-utsav'); window.__anandapur.teleport(b.darshan.x, b.darshan.z, 0); });
await p.waitForTimeout(600); console.log('at darshan', JSON.stringify(await st()));
await p.keyboard.press('KeyE'); await shot('pranam'); console.log('pranam', JSON.stringify(await st()));
console.log(errs.join('\n') || 'no errors');
await b.close();
