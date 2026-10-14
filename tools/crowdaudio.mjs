// Crowd sound: crowd level and output loudness in a quiet spot vs a busy one (needs audio running).
import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: [...process.env.CHROME_GPU_ARGS.split(' '), '--autoplay-policy=no-user-gesture-required'], ignoreDefaultArgs: ['--enable-unsafe-swiftshader', '--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 640, height: 400 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://10.128.146.164:5173/?debug=1');
await p.waitForSelector('.title-screen', { timeout: 90000 });
await p.click('.title-screen .title-buttons .btn');
await p.waitForFunction(() => window.__game.phase === 'play');
await p.mouse.click(320, 200);
await p.evaluate(() => window.__anandapur.setElapsed(2700 * 0.35));
const sample = async (label, x, z) => {
  await p.evaluate(([x, z]) => window.__anandapur.teleport(x, z, 0), [x, z]);
  await p.waitForTimeout(4000);
  const r = await p.evaluate(async () => {
    const a = window.__game.audio, c = a.ctx;
    if (!a.__an) { a.__an = c.createAnalyser(); a.__an.fftSize = 2048; a.crowdBus.connect(a.__an); }
    const buf = new Float32Array(2048), rms = [];
    for (let i = 0; i < 30; i++) { a.__an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; rms.push(Math.sqrt(s / buf.length)); await new Promise((res) => setTimeout(res, 100)); }
    const mean = rms.reduce((s, v) => s + v, 0) / rms.length;
    return { crowd: +a.crowdLevel.toFixed(2), crowdRmsDb: +(20 * Math.log10(mean + 1e-9)).toFixed(1), peakDb: +(20 * Math.log10(Math.max(...rms) + 1e-9)).toFixed(1), ctx: c.state };
  });
  console.log(label.padEnd(16), JSON.stringify(r));
};
const st = await p.evaluate(() => { const v = window.__game.city.stallVendors.find((s) => s.id === 'phuchka'); return [v.front.x, v.front.z]; });
await sample('busy fuchka', st[0], st[1]);
await sample('quiet edge', 150, 60);
console.log('errors', errs);
await b.close();
