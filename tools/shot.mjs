// Usage: node tools/shot.mjs <url> <out.png> [waitMs] [jsBeforeShot]
import { chromium } from '@playwright/test';
const [url, out, wait = '4000', js = ''] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await p.goto(url, { waitUntil: 'load' });
await p.waitForTimeout(Number(wait));
if (js) { await p.evaluate(js); await p.waitForTimeout(1500); }
await p.screenshot({ path: out });
const info = await p.evaluate(() => { const g = window.__game; if (!g) return null; const i = g.renderer.renderer.info; return { fps: g.fps?.toFixed(1), calls: i.render.calls, tris: i.render.triangles, stats: g.world?.stats }; });
console.log(JSON.stringify(info));
console.log(logs.slice(0, 15).join('\n'));
await b.close();
