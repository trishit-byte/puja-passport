/**
 * Deterministic festival clock for the timed challenge.
 *
 *   6:00 PM → 4:00 AM (10 simulated hours) over exactly 45 real minutes of active play.
 *   1 real second = 13⅓ simulated seconds.
 *
 * The clock never reads the wall clock: it only accumulates *elapsed active real time* that the
 * game feeds it from a monotonic source (performance.now deltas). Saves store that elapsed amount,
 * so reloading resumes with exactly the time that was left — no time is granted or lost, and
 * Date/timezone/midnight changes on the device can't affect it.
 *
 * Pausing is reason-based ('menu', 'hidden', 'loading', …): time only advances while no reason is
 * active, so nested menus or visibility changes can't accidentally resume it.
 */
export const SIM_START = 18 * 3600; // 6:00 PM, seconds after midnight of the festival day
export const SIM_END = 28 * 3600; // 4:00 AM next day
export const REAL_DURATION = 45 * 60; // seconds of active play
export const RATE = (SIM_END - SIM_START) / REAL_DURATION; // 13.333…

export type PauseReason = 'menu' | 'hidden' | 'loading' | 'title' | 'ended';

export class SimClock {
  elapsed = 0; // active real seconds consumed
  private reasons = new Set<PauseReason>();

  constructor(elapsed = 0) {
    this.elapsed = Math.min(REAL_DURATION, Math.max(0, elapsed));
  }

  get paused() {
    return this.reasons.size > 0;
  }
  pause(r: PauseReason) {
    this.reasons.add(r);
  }
  resume(r: PauseReason) {
    this.reasons.delete(r);
  }
  isPausedBy(r: PauseReason) {
    return this.reasons.has(r);
  }

  /** Advance by a real-time delta (seconds). Large gaps (e.g. a throttled tab) are capped. */
  tick(dtReal: number): void {
    if (this.paused || !(dtReal > 0)) return;
    this.elapsed = Math.min(REAL_DURATION, this.elapsed + Math.min(dtReal, 1));
  }

  get expired() {
    return this.elapsed >= REAL_DURATION;
  }
  get remaining() {
    return Math.max(0, REAL_DURATION - this.elapsed);
  }
  /** Simulated seconds since midnight of the festival day (64800 … 100800). */
  get simSeconds() {
    return SIM_START + this.elapsed * RATE;
  }
  /** Simulated hours since 6 PM, 0 … 10. */
  get hoursIn() {
    return (this.simSeconds - SIM_START) / 3600;
  }
}

/** "8:35 PM" style 12-hour time for simulated seconds (wraps past midnight). */
export function formatClock(simSeconds: number): string {
  const total = Math.floor(simSeconds / 60) % (24 * 60);
  const h24 = Math.floor(total / 60), m = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** "28:42" countdown for real seconds remaining. */
export function formatRemaining(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Atmosphere stage (0 dusk … 3 pre-dawn) from simulated hours since 6 PM:
 * 6 PM dusk → 9 PM early night → 11 PM deep festive night (through 2 AM) → 3:30 AM pre-dawn.
 */
export function stageForHours(h: number): number {
  const keys: [number, number][] = [
    [0, 0],
    [1.5, 0.45],
    [3, 1],
    [5, 2],
    [8, 2],
    [9.5, 3],
    [10, 3],
  ];
  if (h <= 0) return 0;
  for (let i = 1; i < keys.length; i++) {
    const [h0, s0] = keys[i - 1], [h1, s1] = keys[i];
    if (h <= h1) return s0 + ((h - h0) / (h1 - h0)) * (s1 - s0);
  }
  return 3;
}

/** Crowd density multiplier 0.5 … 1 by hour: builds through the evening, thins after 2 AM. */
export function crowdForHours(h: number): number {
  if (h < 1.5) return 0.65 + (h / 1.5) * 0.3;
  if (h < 7) return 1;
  return Math.max(0.55, 1 - ((h - 7) / 3) * 0.45);
}
