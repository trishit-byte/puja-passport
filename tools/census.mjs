// Which props contribute the most static vertices. Needs the dev server (unminified stacks).
import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.goto('http://10.128.146.164:5174/?debug=1&census=1');
await p.waitForFunction(() => window.__game, null, { timeout: 180000 });
const rows = await p.evaluate(async () => { return [...window.__census.entries()].sort((a, b) => b[1].verts - a[1].verts); });
const tot = rows.reduce((s, r) => s + r[1].verts, 0);
console.log('total verts', tot);
for (const [k, v] of rows.slice(0, 40)) console.log(String(v.verts).padStart(8), String(v.n).padStart(6), k.slice(0, 160));
await b.close();
