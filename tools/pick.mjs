// Raycast from the camera through a screen point and report which object is hit.
import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await p.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
await p.goto('http://10.128.146.164:5174/?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 90000 });
const [x, z, yaw, sx, sy] = JSON.parse(process.argv[2]);
await p.evaluate(([x, z, yaw]) => { window.__anandapur.teleport(x, z, yaw); const c = window.__game.cam; c.yaw = yaw + Math.PI; c.pitch = 0.18; c.targetDistance = 7; }, [x, z, yaw]);
await p.waitForTimeout(1500);
await p.screenshot({ path: 'docs/screenshots/dev/pick.png' });
// the scene is drawn on a bent planet: report scene objects whose world bbox projects to that pixel
const hits = await p.evaluate(([sx, sy]) => {
  const g = window.__game, cam = g.renderer.camera, out = [];
  const THREE_V = cam.position.constructor;
  g.scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    o.geometry.computeBoundingSphere?.();
    const bs = o.geometry.boundingSphere; if (!bs) return;
    const c = new THREE_V().copy(bs.center).applyMatrix4(o.matrixWorld);
    const v = c.clone().project(cam);
    const px = (v.x + 1) / 2 * innerWidth, py = (1 - v.y) / 2 * innerHeight;
    const r = bs.radius * o.matrixWorld.getMaxScaleOnAxis();
    if (v.z < 1 && Math.hypot(px - sx, py - sy) < 60) out.push({ name: o.name || o.parent?.name || '', type: o.geometry.type, mat: o.material.type, col: o.material.color?.getHexString(), r: +r.toFixed(2), d: +c.distanceTo(cam.position).toFixed(1), parent: o.parent?.type });
  });
  return out.sort((a, b) => a.d - b.d).slice(0, 8);
}, [sx, sy]);
console.log(JSON.stringify(hits, null, 0));
await b.close();
