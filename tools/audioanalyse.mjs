import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ headless: true });
const p = await b.newPage();
for (const f of process.argv.slice(2)) {
  const b64 = readFileSync(f).toString('base64');
  const r = await p.evaluate(async (b64) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < u.length; i++) u[i] = bin.charCodeAt(i);
    const ctx = new OfflineAudioContext(1, 48000, 48000);
    const buf = await ctx.decodeAudioData(u.buffer);
    const x = buf.getChannelData(0), sr = buf.sampleRate;
    let s = 0; for (const v of x) s += v * v;
    const hop = Math.floor(sr * 0.01), env = [];
    for (let i = 0; i + hop < x.length; i += hop) { let e = 0; for (let j = 0; j < hop; j++) e += x[i + j] ** 2; env.push(Math.sqrt(e / hop)); }
    const on = env.slice(1).map((v, i) => Math.max(0, v - env[i]));
    const m = on.reduce((a, b) => a + b, 0) / on.length; const o = on.map((v) => v - m);
    let best = 0, lag = 0; for (let L = 8; L < 60; L++) { let c = 0; for (let i = 0; i + L < o.length; i++) c += o[i] * o[i + L]; if (c > best) { best = c; lag = L; } }
    // band energies: render the clip through band-pass filters offline
    const res = {};
    for (const [lo, hi] of [[60, 150], [150, 400], [400, 1500], [1500, 6000]]) {
      const oc = new OfflineAudioContext(1, buf.length, sr);
      const src = oc.createBufferSource(); src.buffer = buf;
      const hp = oc.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = lo;
      const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = hi;
      src.connect(hp).connect(lp).connect(oc.destination); src.start();
      const out = (await oc.startRendering()).getChannelData(0);
      let e = 0; for (const v of out) e += v * v;
      res[`${lo}-${hi}Hz dB`] = +(10 * Math.log10(e / out.length)).toFixed(1);
    }
    return { dur: +buf.duration.toFixed(1), rmsDb: +(10 * Math.log10(s / x.length)).toFixed(1), onsetPeriodMs: lag * 10, bands: res };
  }, b64);
  console.log(f, JSON.stringify(r));
}
await b.close();
