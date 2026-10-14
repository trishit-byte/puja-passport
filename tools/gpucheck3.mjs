import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: true, args: ['--use-angle=gl-egl','--use-gl=angle','--ozone-platform=headless','--ignore-gpu-blocklist','--disable-gpu-sandbox','--enable-gpu-rasterization'], ignoreDefaultArgs:['--enable-unsafe-swiftshader'] });
const p = await b.newPage();
console.log(await p.evaluate(() => { const c=document.createElement('canvas'); const g=c.getContext('webgl2'); if(!g) return 'no webgl2'; const e=g.getExtension('WEBGL_debug_renderer_info'); return e? g.getParameter(e.UNMASKED_RENDERER_WEBGL):'?'; }));
await b.close();
