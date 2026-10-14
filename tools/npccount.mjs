import { chromium } from '@playwright/test';
const q = process.argv[2] ?? 'medium';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.addInitScript((q) => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true, settings: { quality: q } })), q);
await p.goto('http://10.128.146.164:5173/?debug=1');
await p.waitForFunction(() => window.__game, null, { timeout: 180000 });
console.log(q, await p.evaluate(() => { const by = {}; for (const n of window.__game.city.npcs) { const k = n.role === 'shopkeeper' || n.role === 'walker' || (n.role ?? '').startsWith('vendor') ? n.role.replace(/-.*/, '') : n.mode; by[k] = (by[k] ?? 0) + 1; } return JSON.stringify({ total: window.__game.city.npcs.length, by, shops: window.__game.world.shopkeepers.length }); }));
await b.close();
