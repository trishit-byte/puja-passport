import { chromium } from '@playwright/test';
const shots = process.argv[2];
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const p = b.contexts()[0].pages()[0];
const snap = async n => { await p.screenshot({ path: `${shots}/${n}.png` }); console.log('shot', n); };
for (let i=0;i<10;i++){ await p.mouse.click(1140, 780); await p.waitForTimeout(1600); }
await snap('40-after-dialogue');
await p.waitForTimeout(3000); await snap('41-free');
for (const k of ['KeyW','KeyD','KeyS','KeyA']) { await p.keyboard.down(k); await p.waitForTimeout(2000); await p.keyboard.up(k); await p.waitForTimeout(200); await snap('42-move-'+k); }
await p.keyboard.down('KeyW'); await p.waitForTimeout(400); await snap('43a-walk-start'); await p.waitForTimeout(3000); await p.keyboard.up('KeyW'); await snap('43b-walk-3s');
await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW'); await p.waitForTimeout(2500); await snap('44-shift'); await p.keyboard.up('KeyW'); await p.keyboard.up('ShiftLeft');
await p.mouse.move(800,450); await p.mouse.down(); for (let i=0;i<25;i++){ await p.mouse.move(800+i*16,450-i*6); await p.waitForTimeout(30);} await p.mouse.up(); await p.waitForTimeout(800); await snap('45-orbit-drag');
await p.mouse.move(400,450); await p.waitForTimeout(800); await snap('46-mousemove-nodrag');
await p.mouse.wheel(0, -800); await p.waitForTimeout(800); await snap('47-wheel-in');
await p.keyboard.press('Space'); await p.waitForTimeout(300); await snap('48-space');
await p.keyboard.press('Escape'); await p.waitForTimeout(1200); await snap('49-esc');
await p.keyboard.press('Escape'); await p.waitForTimeout(800);
for (let i=0;i<4;i++){ await p.keyboard.down('KeyW'); await p.keyboard.down(i%2?'KeyA':'KeyD'); await p.waitForTimeout(2500); await p.keyboard.up('KeyW'); await p.keyboard.up(i%2?'KeyA':'KeyD'); }
await snap('50-explore');
await b.close().catch(()=>{});
