// Walks from the promenade across the footbridge onto Nodir Opare's deck, then tries to step off it.
import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 640, height: 400 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto((process.argv[2] ?? 'http://10.128.146.164:5173/') + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 120000 });
const pos = () => p.evaluate(() => { const q = window.__game.player.pos; return { x: +q.x.toFixed(2), y: +q.y.toFixed(2), z: +q.z.toFixed(2) }; });
// face south (+z) and walk down the ghat and across the bridge
await p.evaluate(() => { window.__anandapur.teleport(0, 95, 0); window.__game.cam.snapBehind(0); });
await p.waitForTimeout(500);
const trail = [];
await p.keyboard.down('KeyW');
for (let i = 0; i < 16; i++) { await p.waitForTimeout(500); trail.push(await pos()); }
await p.keyboard.up('KeyW');
console.log('walk south:', trail.map((q) => `z${q.z} y${q.y}`).join('  '));
// on the bridge: try to walk off sideways into the river
await p.evaluate(() => { window.__anandapur.teleport(0, 116, Math.PI / 2); window.__game.cam.snapBehind(Math.PI / 2); });
await p.waitForTimeout(400);
await p.keyboard.down('KeyW'); await p.waitForTimeout(2000); await p.keyboard.up('KeyW');
console.log('push off bridge (east):', JSON.stringify(await pos()));
// on the platform: try to walk off the far (south) edge
await p.evaluate(() => { window.__anandapur.teleport(15, 155.5, 0); window.__game.cam.snapBehind(0); });
await p.waitForTimeout(400);
await p.keyboard.down('KeyW'); await p.waitForTimeout(2500); await p.keyboard.up('KeyW');
console.log('push off deck (south):', JSON.stringify(await pos()));
// from a lower ghat step beside the bridge, try to get into the water
await p.evaluate(() => { window.__anandapur.teleport(4, 112, 0); window.__game.cam.snapBehind(0); });
await p.waitForTimeout(400);
await p.keyboard.down('KeyW'); await p.waitForTimeout(2500); await p.keyboard.up('KeyW');
console.log('from step beside bridge, walk into river:', JSON.stringify(await pos()));
await b.close();
