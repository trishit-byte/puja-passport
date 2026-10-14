import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
const r = await p.evaluate(async () => {
  const g = window.__game, b = g.builds.get('shobuj-swapno');
  const out = { look: b.view.look, darshan: b.darshan };
  window.__anandapur.teleport(b.darshan.x, b.darshan.z, 0);
  await new Promise((r) => setTimeout(r, 1500));
  out.cam = g.renderer.camera.position.toArray();
  out.player = g.player.pos.toArray();
  out.info = window.__anandapur.renderInfo();
  return out;
});
console.log(JSON.stringify(r));
await p.screenshot({ path: 'docs/screenshots/dev/probe.png' });
await b.close();
