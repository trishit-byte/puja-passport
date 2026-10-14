import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage();
for (const f of process.argv.slice(2)) {
  const b64 = readFileSync(f).toString('base64');
  const r = await p.evaluate(async (b64) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < u.length; i++) u[i] = bin.charCodeAt(i);
    const buf = await new OfflineAudioContext(1, 48000, 48000).decodeAudioData(u.buffer);
    const x = buf.getChannelData(0), sr = buf.sampleRate, win = sr;
    const rows = [];
    for (let i = 0; i + win <= x.length; i += win) {
      let e = 0, pk = 0, on = 0, prev = 0;
      for (let j = 0; j < win; j++) { const v = x[i + j]; e += v * v; pk = Math.max(pk, Math.abs(v)); }
      // onsets per second (crude): 10ms frames with energy jumps
      const hop = Math.floor(sr / 100);
      for (let k = 0; k < 100; k++) { let fe = 0; for (let j = 0; j < hop; j++) fe += x[i + k * hop + j] ** 2; fe = Math.sqrt(fe / hop); if (fe > prev * 1.8 && fe > 0.02) on++; prev = fe; }
      rows.push([Math.round(10 * Math.log10(e / win)), on]);
    }
    return { dur: buf.duration.toFixed(1), sr, ch: buf.numberOfChannels, rows };
  }, b64);
  console.log(f, 'dur', r.dur, 'sr', r.sr, 'ch', r.ch);
  console.log('  dB/s :', r.rows.map((x) => x[0]).join(' '));
  console.log('  ons/s:', r.rows.map((x) => x[1]).join(' '));
}
await b.close();
