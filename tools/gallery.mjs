import { chromium } from '@playwright/test';
const out = 'docs/screenshots';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => { if (!sessionStorage.getItem('i')) { sessionStorage.setItem('i', '1'); localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: false })); } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const A = (fn, ...a) => p.evaluate(([fn, a]) => window.__anandapur[fn](...a), [fn, a]);
const shot = async (n, w = 1600) => { await p.waitForTimeout(w); await p.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
await p.goto('http://10.128.146.164:5173/?debug=1');
await p.waitForSelector('.title-screen', { timeout: 90000 });
await shot('01-title', 3000);
await p.click('.title-screen [data-a=start]');
await shot('02-intro-swoop', 1200);
await p.waitForFunction(() => window.__game.phase === 'play');
await shot('03-tutorial', 800);
await p.click('.tutorial [data-a=skip]');
// streets
await A('teleport', -70, -80, 0); await p.evaluate(() => { window.__game.cam.yaw = Math.PI + 0.3; window.__game.cam.pitch = 0.15; });
await shot('04-bonedi-para-street', 2000);
await A('teleport', 2, -86, Math.PI); await p.evaluate(() => { window.__game.cam.pitch = 0.05; });
await shot('05-alok-pally-light-arches', 2000);
await A('teleport', 8, 12, Math.PI / 2);
await shot('06-mela-bazaar', 2000);
// pandal interiors (view from the visitor area toward the protima)
for (const id of ['bonedi-bari', 'alor-utsav', 'gram-bangla', 'shobuj-swapno', 'dhaker-taal', 'neel-shagor', 'smritir-shohor', 'nodir-alo']) {
  await p.evaluate((id) => { const g = window.__game; const b = g.builds.get(id); const d = b.darshan; const v = b.view.look; const yaw = Math.atan2(v.x - d.x, v.z - d.z); window.__anandapur.teleport(d.x, d.z, yaw); g.cam.pitch = 0.02; g.cam.targetDistance = 6.5; }, id);
  await shot('10-pandal-' + id, 2200);
  await p.keyboard.press('Escape').catch(() => {}); await p.keyboard.press('Escape').catch(() => {});
}
await p.evaluate(() => { window.__game.cam.targetDistance = 5.5; });
// interactions
await p.evaluate(() => { const g = window.__game; const t = g.builds.get('dhaker-taal').targets[0].pos; window.__anandapur.teleport(t.x, t.z, Math.PI); });
await p.keyboard.press('KeyE');
await shot('20-dhaker-taal-rhythm', 1600);
await p.keyboard.press('KeyK'); await p.waitForTimeout(3500);
await p.evaluate(() => { const g = window.__game; const t = g.builds.get('smritir-shohor').targets[0].pos; window.__anandapur.teleport(t.x, t.z, Math.PI); });
await p.keyboard.press('KeyE');
await shot('21-smritir-shohor-postcards', 1000);
await p.keyboard.press('Escape');
await p.evaluate(() => { const s = window.__game.interactions.items.find((i) => i.id === 'stall-phuchka').pos; window.__anandapur.teleport(s.x, s.z, Math.PI / 2); });
await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
await shot('22-phuchka-vendor', 600);
await p.keyboard.press('Space');
await shot('23-phuchka-scene', 1200);
await p.waitForTimeout(4000);
await A('completePandal', 'bonedi-bari');
await shot('24-stamp-celebration', 900);
await p.waitForTimeout(3500); await p.keyboard.press('Space').catch(() => {});
for (const id of ['gram-bangla', 'neel-shagor']) { await A('completePandal', id); await p.waitForTimeout(3600); }
await p.keyboard.press('KeyP');
await shot('25-pujo-passport', 1000);
await p.keyboard.press('KeyP');
await p.keyboard.press('KeyM');
await shot('26-city-map', 900);
await p.keyboard.press('KeyM');
// night progression at the same spot
for (const [stage, name] of [[0, 'dusk'], [1, 'early-night'], [2, 'deep-night'], [3, 'pre-dawn']]) {
  await A('setStage', stage);
  await A('teleport', -2, -6, Math.PI * 0.85);
  await p.evaluate(() => { window.__game.cam.pitch = 0.18; });
  await shot('30-atmosphere-' + stage + '-' + name, 1500);
}
// finale
for (const id of window_ids()) { await A('completePandal', id); }
function window_ids() { return ['alor-utsav', 'shobuj-swapno', 'dhaker-taal', 'smritir-shohor', 'nodir-alo']; }
await p.waitForTimeout(3600);
for (let i = 0; i < 4; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(250); }
await A('teleport', 60, 106, 0);
await shot('40-finale-sunrise', 6000);
await shot('41-finale-card', 5000);
console.log(errs.join('\n') || 'no errors');
await b.close();
