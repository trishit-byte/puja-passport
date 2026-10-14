import { chromium } from '@playwright/test';
const variants = [
  ['--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--enable-gpu'],
  ['--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist'],
  ['--ignore-gpu-blocklist','--enable-unsafe-swiftshader'],
];
for (const args of variants) {
  const b = await chromium.launch({ headless: true, channel: 'chromium', args });
  const p = await b.newPage();
  const r = await p.evaluate(() => { const c=document.createElement('canvas'); const g=c.getContext('webgl2'); if(!g) return 'no webgl2'; const e=g.getExtension('WEBGL_debug_renderer_info'); return e? g.getParameter(e.UNMASKED_RENDERER_WEBGL):'?'; });
  console.log(args.join(' '), '=>', r);
  await b.close();
}
