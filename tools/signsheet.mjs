// Saves the shop-sign atlas and every food-stall board as PNGs, for proofreading. Needs the dev server.
// Usage: node tools/signsheet.mjs <devUrl> <outDir>
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const [url = 'http://10.128.146.164:5174/', out = 'docs/screenshots/dev/signs'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ headless: true, args: process.env.CHROME_GPU_ARGS.split(' '), ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.goto(url);
await p.waitForSelector('.title-screen', { timeout: 120000 });
const imgs = await p.evaluate(async () => {
  await document.fonts.ready;
  const m = await import('/src/world/props/signs.ts');
  const at = m.signMaterial().map.image;
  m.drawSignAtlas();
  const out = { atlas: at.toDataURL('image/png'), names: m.SHOPS.map((s) => `${s.kind}\t${s.bn}\t${s.hi ?? ''}\t${s.en}`) };
  for (const k of Object.keys(m.FOOD_SIGNS)) {
    const mat = m.foodSignMaterial(k);
    const im = mat.map.image ?? mat.map.source?.data;
    out[k] = im?.toDataURL ? im.toDataURL('image/png') : null;
  }
  return out;
});
for (const [k, v] of Object.entries(imgs)) if (typeof v === 'string' && v.startsWith('data:')) writeFileSync(`${out}/${k}.png`, Buffer.from(v.split(',')[1], 'base64'));
writeFileSync(`${out}/names.tsv`, imgs.names.join('\n'));
console.log(Object.keys(imgs).filter((k) => imgs[k]).join(' '));
await b.close();
