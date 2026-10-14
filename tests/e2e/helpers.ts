import { expect, type Page } from '@playwright/test';

export type Api = Record<string, (...a: any[]) => any>;

/** Console errors/page errors collected per test (fail the test if any appear). */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  page.on('requestfailed', (r) => {
    // streamed songs are routinely cancelled when a DJ box switches track or the player walks away
    if (r.failure()?.errorText === 'net::ERR_ABORTED' && /\/audio\/songs\//.test(r.url())) return;
    errors.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText ?? ''));
  });
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`);
  });
  return errors;
}

/** Fresh game (optional seeded save), start pressed for real, tutorial skipped. */
export async function startGame(page: Page, save?: object) {
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem('e2e-init')) {
      sessionStorage.setItem('e2e-init', '1');
      localStorage.clear();
      if (s) localStorage.setItem('anandapur.save', JSON.stringify(s));
    }
  }, save ?? null);
  await page.goto('./?debug=1');
  await expect(page.locator('.title-screen')).toBeVisible({ timeout: 90_000 });
  await page.locator('.title-screen .title-buttons .btn').first().click();
  await page.waitForFunction(() => (window as any).__game?.phase === 'play', null, { timeout: 30_000 });
  const skip = page.locator('.tutorial [data-a=skip]');
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

export const api = (page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([fn, args]) => (window as any).__anandapur[fn as string](...(args as unknown[])), [fn, args] as const);

export const state = (page: Page) => api(page, 'getState') as Promise<{
  stamps: string[];
  discovered: string[];
  secrets: string[];
  finaleSeen: boolean;
  phase: string;
  modals: string[];
  player: { x: number; z: number; yaw: number };
  prompt: string | null;
  audio: string;
  stage: number;
}>;

/** Teleport onto an interaction station (flat coords) and wait a few frames. */
export async function goToTarget(page: Page, pandal: string, target: string) {
  const all = (await api(page, 'targets')) as { id: string; targets: { id: string; x: number; z: number }[] }[];
  const t = all.find((p) => p.id === pandal)!.targets.find((x) => x.id === target)!;
  const pd = (await page.evaluate(() => (window as any).__anandapur.pandals) as { id: string; x: number; z: number }[]).find((p) => p.id === pandal)!;
  await api(page, 'teleport', t.x, t.z, Math.atan2(pd.x - t.x, pd.z - t.z));
  await page.waitForTimeout(250);
}

export async function pressE(page: Page) {
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(250);
}

/** Close any celebration/toasts/dialogues that might be up. */
export async function settle(page: Page) {
  await page.waitForTimeout(3200); // stamp celebration
  for (let i = 0; i < 6; i++) {
    const s = await state(page);
    if (!s.modals.length) break;
    if (s.modals.includes('dialogue') || s.modals.includes('info') || s.modals.includes('scene')) await page.keyboard.press('Space');
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}
