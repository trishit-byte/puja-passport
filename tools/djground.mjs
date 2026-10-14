// For each DJ box: ground height under the box and under each dancer (should all be flat, at the floor).
import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.goto((process.argv[2] ?? 'http://10.128.146.164:5174/') + '?debug=1');
await p.waitForFunction(() => window.__game, null, { timeout: 180000 });
console.log(await p.evaluate(async () => {
  const { groundHeight } = await import('/src/data/layout.ts');
  const g = window.__game;
  return g.djs.boxes.map((bx, i) => {
    const hs = bx.dancers.map((d) => groundHeight(d.ch.group.position.x, d.ch.group.position.z));
    const ys = bx.dancers.map((d) => +d.ch.group.position.y.toFixed(2));
    return `#${i} (${bx.x.toFixed(0)},${bx.z.toFixed(0)}) box ground ${groundHeight(bx.x, bx.z).toFixed(2)} dancer ground ${Math.min(...hs).toFixed(2)}..${Math.max(...hs).toFixed(2)} dancer y ${Math.min(...ys)}..${Math.max(...ys)}`;
  }).join('\n');
}));
await b.close();
