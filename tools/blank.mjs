// Baseline: Chromium processes for an empty page with a WebGL2 canvas (what any 3D page starts from).
import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
const pids = () => new Set(execSync("ps -u $(id -u) -o pid=,comm= | grep -iE 'chrom|headless' | awk '{print $1}' || true").toString().split(/\s+/).filter(Boolean));
const before = pids();
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.setContent('<canvas width=1600 height=900></canvas><script>const g=document.querySelector("canvas").getContext("webgl2");function f(){g.clearColor(0.2,0.1,0.3,1);g.clear(g.COLOR_BUFFER_BIT);requestAnimationFrame(f)}f()</script>');
await p.waitForTimeout(4000);
const rss = [...pids()].filter((x) => !before.has(x)).map((pid) => { try { const s = execSync(`ps -o rss=,args= -p ${pid}`).toString().trim(); return [(s.match(/--type=([\w-]+)/) || [, 'browser'])[1], Math.round(parseInt(s) / 1024)]; } catch { return null; } }).filter(Boolean);
console.log(JSON.stringify(rss.sort((a, b) => b[1] - a[1])), 'total', rss.reduce((s, r) => s + r[1], 0));
await b.close();
