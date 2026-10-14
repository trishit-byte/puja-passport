import { test, expect } from '@playwright/test';
import { startGame, api, state, goToTarget, pressE, settle, watchErrors } from './helpers';

const ALL = ['bonedi-bari', 'alor-utsav', 'gram-bangla', 'shobuj-swapno', 'dhaker-taal', 'neel-shagor', 'smritir-shohor', 'nodir-alo', 'nakshatralok', 'debaloy'];

test('boots to the title, starts, shows HUD, no console errors or broken assets', async ({ page }) => {
  const errors = watchErrors(page);
  await startGame(page);
  await expect(page.locator('.hud')).toBeVisible();
  await expect(page.locator('.hud .count')).toHaveText(/0\/10/);
  const s = await state(page);
  expect(s.phase).toBe('play');
  expect(s.audio).toBe('running'); // started from the Start click gesture
  // Bengali webfont actually loaded
  expect(await page.evaluate(() => document.fonts.check('800 40px "Baloo Da 2"', 'আনন্দপুর'))).toBe(true);
  await page.screenshot({ path: 'test-results/boot.png' });
  expect(errors).toEqual([]);
});

test('movement in all directions, jog is faster, camera orbit and zoom respond', async ({ page }) => {
  await startGame(page);
  await api(page, 'teleport', 0, -6, 0); // open plaza (Mela Maidan)
  const p0 = (await state(page)).player;
  const moved: Record<string, number> = {};
  for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp']) {
    const a = (await state(page)).player;
    await page.keyboard.down(k);
    await page.waitForTimeout(700);
    await page.keyboard.up(k);
    await page.waitForTimeout(250);
    const b = (await state(page)).player;
    moved[k] = Math.hypot(b.x - a.x, b.z - a.z);
  }
  for (const k of Object.keys(moved)) expect(moved[k], k).toBeGreaterThan(1.0);
  // jog
  await api(page, 'teleport', 0, -6, 0);
  let a = (await state(page)).player;
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyW');
  let b = (await state(page)).player;
  const walk = Math.hypot(b.x - a.x, b.z - a.z);
  await api(page, 'teleport', 0, -6, 0);
  a = (await state(page)).player;
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  b = (await state(page)).player;
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(walk * 1.3);
  // orbit: drag rotates the camera yaw
  const yaw0 = await page.evaluate(() => (window as any).__game.cam.yaw);
  await page.mouse.move(640, 360);
  await page.mouse.down();
  for (let i = 0; i < 10; i++) await page.mouse.move(640 + i * 20, 360);
  await page.mouse.up();
  const yaw1 = await page.evaluate(() => (window as any).__game.cam.yaw);
  expect(Math.abs(yaw1 - yaw0)).toBeGreaterThan(0.3);
  const d0 = await page.evaluate(() => (window as any).__game.cam.targetDistance);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as any).__game.cam.targetDistance)).toBeGreaterThan(d0);
  void p0;
});

test('buildings block movement (collision)', async ({ page }) => {
  await startGame(page);
  // find a building next to the start and walk straight into it
  const fp = await page.evaluate(() => {
    const w = (window as any).__game.world;
    const f = w.footprints.find((f: any) => Math.hypot(f.x + 72, f.z + 40) < 40);
    return { x: f.x, z: f.z, hw: f.hw, hd: f.hd, yaw: f.yaw };
  });
  // stand in front of the façade, facing it
  const fx = Math.sin(fp.yaw), fz = Math.cos(fp.yaw);
  await api(page, 'teleport', fp.x + fx * (fp.hd + 2.5), fp.z + fz * (fp.hd + 2.5), fp.yaw + Math.PI);
  await page.waitForTimeout(300);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyW');
  const p = (await state(page)).player;
  // project into building-local space: must remain outside the footprint
  const dx = p.x - fp.x, dz = p.z - fp.z;
  const lz = dx * Math.sin(fp.yaw) + dz * Math.cos(fp.yaw);
  expect(lz).toBeGreaterThan(fp.hd + 0.2);
});

test('approaching a pandal discovers it but does not stamp it', async ({ page }) => {
  await startGame(page);
  await api(page, 'teleportTo', 'bonedi-bari', false);
  await page.waitForTimeout(800);
  const s = await state(page);
  expect(s.discovered).toContain('bonedi-bari');
  expect(s.stamps).toEqual([]);
  await expect(page.locator('.banner')).toContainText('Rajbarir Pujo');
});

test('every pandal interaction works with the keyboard; stamps persist and never duplicate', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = watchErrors(page);
  await startGame(page);

  // 1 Bonedi Bari: ring the bell
  await goToTarget(page, 'bonedi-bari', 'bell');
  expect((await state(page)).prompt).toMatch(/bell/i);
  await pressE(page);
  await settle(page);
  // 2 Alo'r Utsav: three sculptures in a non-default order
  for (const t of ['sculpt-3', 'sculpt-1', 'sculpt-2']) {
    await goToTarget(page, 'alor-utsav', t);
    await pressE(page);
  }
  await settle(page);
  // every pandal except Bonedi Bari stamps at its entrance bell, after the activity
  const ringBell = async (id: string) => {
    await goToTarget(page, id, 'stamp-bell');
    expect((await state(page)).prompt).toMatch(/receive your stamp/);
    await pressE(page);
  };
  expect((await state(page)).stamps).not.toContain('alor-utsav'); // the activity alone doesn't stamp: the bell does
  await ringBell('alor-utsav');
  await settle(page);
  // 3 Gram Bangla: look at three folk-art panels (info cards closed with Space)
  for (const t of ['panel-dokra', 'panel-pat', 'panel-terracotta']) {
    await goToTarget(page, 'gram-bangla', t);
    await pressE(page);
    await expect(page.locator('.info-card')).toBeVisible();
    await page.keyboard.press('Space');
  }
  await settle(page);
  await ringBell('gram-bangla');
  await settle(page);
  // 4 Shobuj Swapno
  for (const t of ['glow-2', 'glow-3', 'glow-1']) {
    await goToTarget(page, 'shobuj-swapno', t);
    await pressE(page);
  }
  await settle(page);
  await ringBell('shobuj-swapno');
  await settle(page);
  // 5 Dhaker Taal: listen, then tap three times in rhythm with E
  await goToTarget(page, 'dhaker-taal', 'dhak');
  await pressE(page);
  await expect(page.locator('.rhythm')).toBeVisible();
  await expect(page.locator('.rhythm.listening')).toBeVisible({ timeout: 6000 });
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('KeyE');
    if (i < 2) await page.waitForTimeout(480);
  }
  await page.waitForTimeout(300);
  await settle(page);
  await ringBell('dhaker-taal');
  expect((await state(page)).stamps).toContain('dhaker-taal');
  await settle(page);
  // 6 Neel Swapno: the bell stamps straight away (no prerequisite); the pearl is still there to enjoy
  await ringBell('neel-shagor');
  expect((await state(page)).stamps).toContain('neel-shagor');
  await settle(page);
  await goToTarget(page, 'neel-shagor', 'pearl');
  expect((await state(page)).prompt).toMatch(/pearl/i);
  await pressE(page);
  await settle(page);
  // 7 Smritir Shohor: pick postcards via keyboard and match the scenes (one deliberate mismatch)
  const pick = async (n: number) => {
    await goToTarget(page, 'smritir-shohor', 'postcards');
    await pressE(page);
    await expect(page.locator('.picker')).toBeVisible();
    await page.keyboard.press(`Digit${n}`);
    await page.waitForTimeout(200);
  };
  await pick(1); // tram card
  await goToTarget(page, 'smritir-shohor', 'lm-clock');
  await pressE(page); // mismatch → gentle reject, nothing placed
  expect((await state(page)).stamps).not.toContain('smritir-shohor');
  await goToTarget(page, 'smritir-shohor', 'lm-tram');
  await pressE(page);
  await pick(2);
  await goToTarget(page, 'smritir-shohor', 'lm-clock');
  await pressE(page);
  await pick(3);
  await goToTarget(page, 'smritir-shohor', 'lm-cha');
  await pressE(page);
  await settle(page);
  await ringBell('smritir-shohor');
  await settle(page);
  // 8 Nodi'r Alo: take a lamp, then place it on the river
  await goToTarget(page, 'nodir-alo', 'lamp-place');
  expect((await state(page)).prompt).toBeNull(); // must take the lamp first
  await goToTarget(page, 'nodir-alo', 'lamp-take');
  await pressE(page);
  await goToTarget(page, 'nodir-alo', 'lamp-place');
  await pressE(page);
  await settle(page);
  await ringBell('nodir-alo');
  await settle(page);
  // 9 Nakshatralok: light the three constellations, in any order
  for (const t of ['star-kalpurush', 'star-dhruva', 'star-saptarshi']) {
    await goToTarget(page, 'nakshatralok', t);
    await pressE(page);
  }
  await settle(page);
  await ringBell('nakshatralok');
  await settle(page);
  // 10 Debaloy: the ritual is in order — the anjali isn't offered before the conch and the lamps
  await goToTarget(page, 'debaloy', 'pushpanjali');
  expect((await state(page)).prompt ?? '').not.toMatch(/flowers|anjali/i);
  for (const t of ['shankha', 'deepastambha', 'pushpanjali']) {
    await goToTarget(page, 'debaloy', t);
    await pressE(page);
  }
  await settle(page);
  await ringBell('debaloy');
  await page.waitForTimeout(500);

  let s = await state(page);
  expect([...s.stamps].sort()).toEqual([...ALL].sort());
  await expect(page.locator('.hud .count')).toHaveText(/10\/10/);

  // revisit: no duplicates
  await settle(page);
  await goToTarget(page, 'bonedi-bari', 'bell');
  await pressE(page);
  await page.waitForTimeout(400);
  s = await state(page);
  expect(s.stamps).toHaveLength(10);

  // reload: progress persists from localStorage
  await page.reload();
  await expect(page.locator('.title-screen')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.title-screen .title-buttons .btn').first()).toContainText('Keep Exploring');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('anandapur.save')!));
  expect(saved.stamps).toHaveLength(10);
  expect(new Set(saved.stamps).size).toBe(10);
  expect(errors).toEqual([]);
});

test('rhythm can be skipped (accessibility) and cancelled without getting stuck', async ({ page }) => {
  await startGame(page);
  await goToTarget(page, 'dhaker-taal', 'dhak');
  await pressE(page);
  await expect(page.locator('.rhythm')).toBeVisible();
  await page.keyboard.press('Escape'); // cancel during the cue
  await expect(page.locator('.rhythm')).toHaveCount(0);
  const before = (await state(page)).player;
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyS');
  const after = (await state(page)).player;
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.5); // not frozen
  await goToTarget(page, 'dhaker-taal', 'dhak');
  await pressE(page);
  await page.keyboard.press('KeyK'); // skip
  await page.waitForTimeout(300);
  await expect(page.locator('.rhythm')).toHaveCount(0);
  await settle(page);
  // the bell refuses before the activity is done elsewhere, but here the skipped rhythm counts
  await goToTarget(page, 'dhaker-taal', 'stamp-bell');
  await pressE(page);
  expect((await state(page)).stamps).toContain('dhaker-taal');
  await expect(page.locator('.rhythm')).toHaveCount(0);
});

test('all ten stamps in a random order unlock the riverside finale; play continues afterwards', async ({ page }) => {
  await startGame(page);
  const order = [...ALL].sort(() => Math.random() - 0.5);
  for (const id of order) await api(page, 'completePandal', id);
  await settle(page);
  const s = await state(page);
  expect(s.stamps).toHaveLength(10);
  expect(s.finaleSeen).toBe(false);
  // success is registered as soon as the eighth stamp lands
  expect((await api(page, 'night')).status).toBe('success');
  // the finale only starts when the player chooses to "Finish the Night" at Sunrise Ghat
  await api(page, 'teleport', 0, -6, 0);
  await page.waitForTimeout(500);
  expect((await state(page)).phase).toBe('play');
  await api(page, 'teleport', 60, 106, 0);
  await page.waitForTimeout(400);
  expect((await state(page)).prompt).toMatch(/Finish the Night/);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => (window as any).__game.phase === 'finale', null, { timeout: 10_000 });
  await expect(page.locator('.finale')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.finale')).toContainText('Shubho Sharodiya.');
  await expect(page.locator('.finale')).toContainText('Your Pujo night will always be here.');
  await page.waitForTimeout(4200); // let the closing button fade in
  await page.screenshot({ path: 'test-results/finale.png' });
  await page.locator('.finale [data-a=close]').click();
  await page.waitForFunction(() => (window as any).__game.phase === 'play');
  const a = (await state(page)).player;
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyW');
  const b = (await state(page)).player;
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0.8);
  expect((await state(page)).finaleSeen).toBe(true);
});

test('map, passport, pause menu, volume and reset adventure', async ({ page }) => {
  await startGame(page);
  await api(page, 'completePandal', 'gram-bangla');
  await settle(page);
  await page.keyboard.press('KeyM');
  await expect(page.locator('.map-wrap canvas')).toBeVisible();
  await page.screenshot({ path: 'test-results/map.png' });
  await page.keyboard.press('KeyM');
  await expect(page.locator('.map-wrap')).toHaveCount(0);
  await page.keyboard.press('KeyP');
  await expect(page.locator('.passport .slot.done')).toHaveCount(1);
  await expect(page.locator('.passport')).toContainText('Matir Taan');
  await page.keyboard.press('Escape');
  await expect(page.locator('.passport')).toHaveCount(0);
  // pause blocks movement
  await page.keyboard.press('Escape');
  await expect(page.locator('.pause-card')).toBeVisible();
  const a = (await state(page)).player;
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyW');
  const b = (await state(page)).player;
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.05);
  // volume slider persists
  await page.locator('input[data-k=music]').fill('0.2');
  await page.locator('input[data-k=music]').dispatchEvent('input');
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('anandapur.save')!))).audio.music).toBeCloseTo(0.2);
  await page.locator('input[data-k=muted]').check();
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('anandapur.save')!))).audio.muted).toBe(true);
  // reset with confirmation
  await page.locator('[data-a=reset]').click();
  await expect(page.locator('.confirm-card')).toBeVisible();
  await page.locator('.confirm-card [data-a=yes]').click();
  await expect(page.locator('.title-screen')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.title-screen .title-buttons .btn').first()).toContainText('Start the Night');
});

test('NPC dialogue and a food stall experience', async ({ page }) => {
  await startGame(page);
  // talk to the volunteer at Bonedi Bari's gate
  const npc = await page.evaluate(() => {
    const g = (window as any).__game;
    const n = g.city.npcs.find((n: any) => n.lines[0].name === 'Volunteer');
    return { x: n.pos.x, z: n.pos.z };
  });
  await api(page, 'teleport', npc.x + 1.2, npc.z, -Math.PI / 2);
  await page.waitForTimeout(400);
  expect((await state(page)).prompt).toMatch(/Talk to/);
  await pressE(page);
  await expect(page.locator('.dialogue')).toBeVisible();
  await expect(page.locator('.dialogue')).toContainText('Volunteer');
  await page.keyboard.press('Space');
  await expect(page.locator('.dialogue')).toHaveCount(0);
  // fuchka: E at the stall → the player eats (pose + prop), with the vendor's line and taste as captions
  const stall = await page.evaluate(() => (window as any).__game.interactions.items.find((i: any) => i.id === 'stall-phuchka').pos);
  await api(page, 'teleport', stall.x, stall.z, 0);
  await page.waitForTimeout(300);
  expect((await state(page)).prompt).toMatch(/Eat Fuchka/);
  await pressE(page);
  expect(await page.evaluate(() => (window as any).__game.actions.current?.id)).toBe('eat-phuchka');
  expect(await page.evaluate(() => (window as any).__game.player.char.pose)).toBe('eat');
  await expect(page.locator('.toasts')).toContainText(/Fuchka|fuchka/, { timeout: 4000 });
  // walking away ends the action
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyS');
  expect(await page.evaluate(() => (window as any).__game.actions.current)).toBeNull();
});

test('WebGL context loss shows a notice and recovers', async ({ page }) => {
  await startGame(page);
  await api(page, 'loseContext');
  await expect(page.locator('.ctx-lost')).toBeVisible();
  await page.waitForTimeout(500);
  // static geometry lives only on the GPU, so recovery reloads the page and resumes from the save
  await api(page, 'restoreContext');
  await page.waitForFunction(() => (window as any).__game?.phase === 'play', null, { timeout: 90_000 });
  await expect(page.locator('.ctx-lost')).toHaveCount(0, { timeout: 10_000 });
  const t0 = await page.evaluate(() => (window as any).__game.time);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__game.time)).toBeGreaterThan(t0);
});

test('frame-time stability while walking through the city', async ({ page }) => {
  await startGame(page);
  await api(page, 'teleport', -72, -30, 2.5);
  await page.keyboard.down('KeyW');
  const fps = await page.evaluate(
    () =>
      new Promise<number[]>((res) => {
        const deltas: number[] = [];
        let last = performance.now();
        const t0 = last;
        const f = () => {
          const now = performance.now();
          deltas.push(now - last);
          last = now;
          if (now - t0 < 5000) requestAnimationFrame(f);
          else res(deltas);
        };
        requestAnimationFrame(f);
      }),
  );
  await page.keyboard.up('KeyW');
  const sorted = [...fps].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)], p99 = sorted[Math.floor(sorted.length * 0.99)];
  console.log(`frame ms p50=${p50.toFixed(2)} p99=${p99.toFixed(2)} n=${fps.length} render=${JSON.stringify(await api(page, 'renderInfo'))}`);
  // This is a smoke threshold for "no severe hitches", not a hardware-independent claim.
  expect(p99).toBeLessThan(100);
});

test('festival clock: starts at 6 PM, pauses with the menu and hidden tab, ends the night at 4 AM', async ({ page }) => {
  await startGame(page);
  let n = await api(page, 'night');
  expect(n.status).toBe('active');
  expect(n.clock).toMatch(/^6:0\d PM$/);
  await expect(page.locator('.clock-time')).toHaveText(/PM$/);
  // time runs during play
  const e0 = n.elapsed;
  await page.waitForTimeout(1500);
  n = await api(page, 'night');
  expect(n.elapsed - e0).toBeGreaterThan(1.0);
  expect(n.elapsed - e0).toBeLessThan(2.5);
  // the pause menu stops it
  await page.keyboard.press('Escape');
  await expect(page.locator('.pause-card')).toBeVisible();
  const p0 = (await api(page, 'night')).elapsed;
  await page.waitForTimeout(1500);
  expect((await api(page, 'night')).elapsed).toBeCloseTo(p0, 3);
  await page.locator('[data-a=resume]').click();
  // a hidden tab pauses it and requires an explicit resume
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const h0 = (await api(page, 'night')).elapsed;
  await page.waitForTimeout(1200);
  expect((await api(page, 'night')).elapsed).toBeCloseTo(h0, 3);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.pause-card')).toBeVisible();
  await page.waitForTimeout(800);
  expect((await api(page, 'night')).elapsed).toBeCloseTo(h0, 3);
  await page.locator('[data-a=resume]').click();
  // midnight
  await api(page, 'setElapsed', 2700 * 0.6);
  await page.waitForTimeout(200);
  expect((await api(page, 'night')).clock).toMatch(/^12:0\d AM$/);
  // save/resume keeps the remaining time (no free time on reload)
  await api(page, 'setElapsed', 2000);
  await page.waitForTimeout(5600); // autosave interval
  await page.reload();
  await expect(page.locator('.title-screen')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.title-screen .title-buttons .btn').first()).toContainText('Continue the Night');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('anandapur.save')!).session);
  expect(saved.status).toBe('active');
  expect(saved.elapsed).toBeGreaterThan(2000);
  expect(saved.elapsed).toBeLessThan(2010);
  await page.locator('.title-screen .title-buttons .btn').first().click();
  await page.waitForFunction(() => (window as any).__game?.phase === 'play', null, { timeout: 30_000 });
  // run out the clock with stamps missing → honest failure screen
  await api(page, 'completePandal', 'gram-bangla');
  await settle(page);
  await api(page, 'setElapsed', 2699.5);
  await expect(page.locator('.nightover')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.nightover')).toContainText('The Pujo night has come to an end');
  await expect(page.locator('.nightover')).toContainText('1/10');
  expect((await api(page, 'night')).status).toBe('failed');
  expect((await state(page)).stamps).toEqual(['gram-bangla']); // nothing awarded for free
  await page.locator('.nightover [data-a=sight]').click();
  expect((await api(page, 'night')).status).toBe('sightseeing');
  await expect(page.locator('.clock-left')).toHaveText(/untimed/);
});

test('"Try the Night Again" after 4 AM starts a fresh night (6 PM, no stamps, clock running)', async ({ page }) => {
  await startGame(page);
  await api(page, 'completePandal', 'bonedi-bari');
  await settle(page);
  await api(page, 'setElapsed', 2699.5);
  await expect(page.locator('.nightover')).toBeVisible({ timeout: 10_000 });
  await page.locator('.nightover [data-a=retry]').click();
  // the page reloads straight into the new night
  await page.waitForFunction(() => (window as any).__game?.phase === 'play' && (window as any).__anandapur?.night().elapsed > 0.5, null, { timeout: 90_000 });
  await page.waitForTimeout(1500);
  const night = await api(page, 'night');
  expect(night.status).toBe('active');
  expect(night.elapsed).toBeLessThan(30);
  expect(night.paused).toBe(false);
  expect((await state(page)).stamps).toEqual([]);
  await expect(page.locator('.nightover')).toHaveCount(0);
});

test('completing all ten before 4 AM is a success that the 4 AM deadline turns into the sunrise finale', async ({ page }) => {
  await startGame(page);
  for (const id of ALL) await api(page, 'completePandal', id);
  await settle(page);
  expect((await api(page, 'night')).status).toBe('success');
  await api(page, 'setElapsed', 2699.8);
  await page.waitForFunction(() => (window as any).__game.phase === 'finale', null, { timeout: 10_000 });
  await expect(page.locator('.finale')).toBeVisible({ timeout: 20_000 });
  expect((await api(page, 'night')).status).toBe('success');
});

for (const [w, h] of [[375, 667], [390, 844], [412, 915]] as const) {
  test(`mobile portrait ${w}×${h}: touch joystick walks, swipe turns the camera, HUD does not overlap`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await startGame(page);
    await expect(page.locator('.touch-ui')).toBeVisible();
    await expect(page.locator('.minimap')).toBeVisible();
    const cdp = await ctx.newCDPSession(page);
    const touch = (type: string, pts: object[]) => cdp.send('Input.dispatchTouchEvent', { type: type as 'touchStart', touchPoints: pts as never });
    const a = (await state(page)).player;
    await touch('touchStart', [{ x: 90, y: h - 140, id: 1 }]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: 90, y: h - 140 - i * 8, id: 1 }]);
    await page.waitForTimeout(1200);
    await touch('touchEnd', []);
    const b = (await state(page)).player;
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(2);
    const y0 = await page.evaluate(() => (window as any).__game.cam.yaw);
    await touch('touchStart', [{ x: w * 0.7, y: h * 0.45, id: 2 }]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [{ x: w * 0.7 - i * 12, y: h * 0.45, id: 2 }]);
    await touch('touchEnd', []);
    expect(Math.abs((await page.evaluate(() => (window as any).__game.cam.yaw)) - y0)).toBeGreaterThan(0.3);
    const overlaps = await page.evaluate(() => {
      const r = ['.clock', '.hud-right', '.minimap', '.compass', '.touch-btns', '.joy-base'].map((s) => document.querySelector(s)!.getBoundingClientRect());
      const out: number[][] = [];
      for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i].x < r[j].right && r[j].x < r[i].right && r[i].y < r[j].bottom && r[j].y < r[i].bottom) out.push([i, j]);
      return out;
    });
    expect(overlaps).toEqual([]);
    // the action button triggers interactions (ring Bonedi Bari's bell → stamp)
    await goToTarget(page, 'bonedi-bari', 'bell');
    await page.locator('.t-act').dispatchEvent('pointerdown');
    await page.waitForTimeout(400);
    expect((await state(page)).stamps).toContain('bonedi-bari');
    await page.screenshot({ path: `test-results/portrait-${w}x${h}.png` });
    await ctx.close();
  });
}

for (const [w, h, touch] of [[1280, 720, false], [1024, 768, true], [844, 390, true]] as const) {
  test(`layout ${w}×${h}${touch ? ' touch' : ''}: title fits, HUD elements never overlap`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch });
    const page = await ctx.newPage();
    await page.goto('/?debug=1');
    await page.waitForSelector('.title-screen');
    const fits = await page.evaluate(() => {
      const s = document.querySelector('.title-screen')!;
      const c = document.querySelector('.title-buttons')!.getBoundingClientRect();
      return s.scrollHeight > s.clientHeight || (c.bottom <= innerHeight && c.top >= 0);
    });
    expect(fits).toBe(true);
    await page.locator('.title-screen .title-buttons .btn').first().click();
    await page.waitForFunction(() => (window as any).__game?.phase === 'play');
    await page.evaluate(() => (document.querySelector('.tutorial [data-a=skip]') as HTMLElement | null)?.click());
    const overlaps = await page.evaluate(() => {
      const r = ['.clock', '.hud-right', '.minimap', '.compass', '.touch-btns', '.joy-base']
        .map((s) => document.querySelector(s))
        .filter((e): e is Element => !!e && !e.closest('.hidden') && e.getBoundingClientRect().width > 0)
        .map((e) => e.getBoundingClientRect());
      let n = 0;
      for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i].left < r[j].right && r[j].left < r[i].right && r[i].top < r[j].bottom && r[j].top < r[i].bottom) n++;
      return n;
    });
    expect(overlaps).toBe(0);
    await ctx.close();
  });
}

test('a selfie at a photo spot is kept on the Memories page of the passport', async ({ page }) => {
  await startGame(page);
  const spot = await page.evaluate(() => (window as any).__game.interactions.items.find((i: any) => i.id.startsWith('photo')).pos);
  await api(page, 'teleport', spot.x, spot.z, 0);
  await page.waitForTimeout(300);
  expect((await state(page)).prompt).toMatch(/selfie/i);
  await pressE(page);
  await page.waitForTimeout(2200);
  const n = await page.evaluate(() => JSON.parse(localStorage.getItem('anandapur.memories') || '[]').length);
  expect(n).toBe(1);
  await page.keyboard.press('KeyP');
  await expect(page.locator('.pp-mem-strip img')).toHaveCount(1);
});
