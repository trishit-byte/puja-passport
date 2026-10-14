import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ headless: true, args: [...process.env.CHROME_GPU_ARGS.split(' '), '--autoplay-policy=no-user-gesture-required'], ignoreDefaultArgs: ['--enable-unsafe-swiftshader', '--mute-audio'] });
const ctx = await b.newContext();
await ctx.addInitScript(() => localStorage.setItem('anandapur.save', JSON.stringify({ tutorialDone: true })));
const p = await ctx.newPage();
await p.goto('http://10.128.146.164:5174/?debug=1');
await p.waitForSelector('.title-screen', { timeout: 90000 });
await p.click('.title-screen [data-a=start]');
await p.waitForFunction(() => window.__game.phase === 'play');
const A = (fn, ...a) => p.evaluate(([fn, a]) => window.__anandapur[fn](...a), [fn, a]);
const lvl = async () => { let s = 0; for (let i = 0; i < 20; i++) { s += await A('audioLevel'); await p.waitForTimeout(100); } return (s / 20).toFixed(1); };
console.log('audio state', (await A('getState')).audio);
for (const [name, x, z] of [['inside Dhaker Taal', 34, -38], ['Bonedi Bari courtyard', -112, -58], ['quiet street far from pandals', -150, 30]]) {
  await A('teleport', x, z, 0); await p.waitForTimeout(1500);
  console.log(name, 'RMS dBFS', await lvl());
}
await A('teleport', -108, -58, -1.57); await p.waitForTimeout(1000);
const r = await A('recordAudio', 9000);
writeFileSync('docs/audio-sample-bonedi-bari.webm', Buffer.from(r.b64, 'base64'));
await A('teleport', 34, -30, Math.PI); await p.waitForTimeout(1000);
const r2 = await A('recordAudio', 9000);
writeFileSync('docs/audio-sample-dhaker-taal.webm', Buffer.from(r2.b64, 'base64'));
console.log('recorded', r.type);
await b.close();
