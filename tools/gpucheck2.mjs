import { chromium } from '@playwright/test';
const variants = [
  ['--use-angle=vulkan','--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan','--ignore-gpu-blocklist','--disable-vulkan-surface','--disable-gpu-sandbox'],
  ['--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist','--disable-gpu-sandbox'],
  ['--use-gl=egl','--ignore-gpu-blocklist','--disable-gpu-sandbox'],
];
for (const args of variants) {
  const b = await chromium.launch({ headless: true, args, ignoreDefaultArgs:['--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  const r = await p.evaluate(() => { const c=document.createElement('canvas'); const g=c.getContext('webgl2'); if(!g) return 'no webgl2'; const e=g.getExtension('WEBGL_debug_renderer_info'); return e? g.getParameter(e.UNMASKED_RENDERER_WEBGL):'?'; });
  console.log(args.join(' '), '=>', r);
  if (process.env.DUMP) { await p.goto('chrome://gpu'); await p.waitForTimeout(1500); const t = await p.evaluate(()=>document.body.innerText||''); console.log(t.slice(0,3000)); }
  await b.close();
}
