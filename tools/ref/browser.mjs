// Launch a GPU headless Chromium with a loopback CDP port so REA can attach passively.
import { chromium } from '@playwright/test';
const out = process.argv[2];
const b = await chromium.launch({ headless: true, args: [...process.env.CHROME_GPU_ARGS.split(' '), '--remote-debugging-port=9222','--remote-debugging-address=127.0.0.1'], ignoreDefaultArgs:['--enable-unsafe-swiftshader','--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, recordHar: { path: `${out}/messenger.har`, content: 'omit' } });
const p = await ctx.newPage();
p.on('console', m => console.log('[console]', m.type(), m.text().slice(0,200)));
await p.goto('https://messenger.abeto.co/', { waitUntil: 'load', timeout: 120000 });
console.log('loaded');
process.on('SIGTERM', async () => { await ctx.close(); await b.close(); process.exit(0); });
await new Promise(r => setTimeout(r, 60*60*1000));
