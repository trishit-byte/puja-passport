import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.goto((process.env.URL ?? 'http://10.128.146.164:5174/') + '?debug=1');
await p.waitForFunction(() => window.__game, null, { timeout: 180000 });
const pts = JSON.parse(process.argv[2]);
console.log(await p.evaluate((pts) => {
  const cw = window.__game.world.colliders; const all = new Set(); for (const v of cw.grid.values()) v.forEach((c) => all.add(c));
  return pts.map(([x, z]) => `(${x},${z}): ` + [...all].filter((c) => Math.hypot(c.x - x, c.z - z) < 4).map((c) => c.kind === 'box' ? `box@(${c.x.toFixed(1)},${c.z.toFixed(1)}) ${(c.hw * 2).toFixed(1)}x${(c.hd * 2).toFixed(1)} yaw${c.yaw.toFixed(2)}` : `circle@(${c.x.toFixed(1)},${c.z.toFixed(1)}) r${c.r}`).join(' | ')).join('\n');
}, pts));
await b.close();
