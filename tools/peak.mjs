// Samples renderer + GPU process RSS every 150 ms while the game loads and settles.
import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
const pids = () => new Set(execSync("ps -u $(id -u) -o pid=,comm= | grep -iE 'chrom|headless' | awk '{print $1}' || true").toString().split(/\s+/).filter(Boolean));
const before = pids();
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ settings: { quality: 'high' }, tutorialDone: true })));
const p = await ctx.newPage();
const mine = [...pids()].filter((x) => !before.has(x));
let peak = { renderer: 0, gpu: 0 }, last = {};
const sample = () => { const now = { renderer: 0, gpu: 0 }; for (const pid of [...pids()].filter((x) => !before.has(x))) { try { const s = execSync(`ps -o rss=,args= -p ${pid}`).toString(); const kb = parseInt(s); if (s.includes('--type=renderer')) now.renderer = Math.max(now.renderer, kb >> 10); if (s.includes('--type=gpu')) now.gpu = kb >> 10; } catch {} } peak.renderer = Math.max(peak.renderer, now.renderer); peak.gpu = Math.max(peak.gpu, now.gpu); last = now; };
const iv = setInterval(sample, 150);
const t0 = Date.now();
await p.goto((process.argv[2] ?? 'http://10.128.146.164:5173/') + '?debug=1&autostart=1');
await p.waitForFunction(() => window.__game?.phase === 'play', null, { timeout: 180000 });
const tPlay = Date.now() - t0;
const trail = [];
for (let i = 0; i < +(process.env.LONG ?? 1); i++) { await p.waitForTimeout(8000); sample(); trail.push(last.renderer); }
clearInterval(iv); sample();
console.log(JSON.stringify({ playAfterMs: tPlay, peak, settled: last, rendererEvery8s: trail }));
await b.close();
