import { describe, it, expect } from 'vitest';
import { SimClock, formatClock, formatRemaining, stageForHours, crowdForHours, REAL_DURATION, RATE, SIM_START, SIM_END } from '../../src/gameplay/SimClock';
import { sanitize } from '../../src/save/SaveStore';

describe('SimClock', () => {
  it('maps 45 real minutes onto 6:00 PM → 4:00 AM', () => {
    expect(REAL_DURATION).toBe(2700);
    expect(RATE).toBeCloseTo(40 / 3, 10); // 13⅓ simulated seconds per real second
    const c = new SimClock();
    expect(formatClock(c.simSeconds)).toBe('6:00 PM');
    c.elapsed = 60; // one real minute = 13 min 20 s
    expect(c.simSeconds - SIM_START).toBeCloseTo(800, 6);
    expect(formatClock(c.simSeconds)).toBe('6:13 PM');
    c.elapsed = REAL_DURATION;
    expect(c.simSeconds).toBe(SIM_END);
    expect(formatClock(c.simSeconds)).toBe('4:00 AM');
    expect(c.expired).toBe(true);
  });

  it('crosses midnight correctly', () => {
    const c = new SimClock();
    c.elapsed = (6 * 3600) / RATE; // six simulated hours after 6 PM
    expect(formatClock(c.simSeconds)).toBe('12:00 AM');
    c.elapsed += 59 / RATE;
    expect(formatClock(c.simSeconds)).toBe('12:00 AM');
    c.elapsed += 61 / RATE;
    expect(formatClock(c.simSeconds)).toBe('12:02 AM');
    expect(formatClock(13 * 3600)).toBe('1:00 PM');
    expect(formatClock(12 * 3600)).toBe('12:00 PM');
  });

  it('ticks only while no pause reason is active, and caps large gaps', () => {
    const c = new SimClock();
    c.tick(1);
    expect(c.elapsed).toBe(1);
    c.pause('menu');
    c.pause('hidden');
    c.tick(5);
    expect(c.elapsed).toBe(1);
    c.resume('hidden'); // menu still open — must stay paused
    c.tick(5);
    expect(c.elapsed).toBe(1);
    c.resume('menu');
    c.tick(0.5);
    expect(c.elapsed).toBe(1.5);
    c.tick(30); // throttled tab returning: capped to 1 s
    expect(c.elapsed).toBe(2.5);
    c.tick(-3);
    c.tick(NaN);
    expect(c.elapsed).toBe(2.5);
  });

  it('never exceeds the session length and reports remaining time', () => {
    const c = new SimClock(REAL_DURATION - 0.5);
    expect(formatRemaining(c.remaining)).toBe('0:01');
    c.tick(1);
    expect(c.remaining).toBe(0);
    expect(c.expired).toBe(true);
    expect(formatRemaining(28 * 60 + 42)).toBe('28:42');
    expect(new SimClock(99999).elapsed).toBe(REAL_DURATION);
    expect(new SimClock(-5).elapsed).toBe(0);
  });

  it('atmosphere and crowd curves are monotonic where expected and bounded', () => {
    expect(stageForHours(0)).toBe(0);
    expect(stageForHours(3)).toBe(1);
    expect(stageForHours(6)).toBe(2);
    expect(stageForHours(10)).toBe(3);
    let prev = -1;
    for (let h = 0; h <= 10; h += 0.25) {
      const s = stageForHours(h);
      expect(s).toBeGreaterThanOrEqual(prev);
      expect(s).toBeLessThanOrEqual(3);
      prev = s;
      const cr = crowdForHours(h);
      expect(cr).toBeGreaterThanOrEqual(0.5);
      expect(cr).toBeLessThanOrEqual(1);
    }
  });

  it('save data keeps elapsed time and session status, sanitised', () => {
    const d = sanitize({ session: { elapsed: 1234.5, status: 'active' } });
    expect(d.session.elapsed).toBe(1234.5);
    expect(d.session.status).toBe('active');
    const bad = sanitize({ session: { elapsed: 'lots', status: 'winning' } });
    expect(bad.session.elapsed).toBe(0);
    expect(bad.session.status).toBe('none');
    expect(sanitize({ session: { elapsed: 1e9, status: 'active' } }).session.elapsed).toBe(REAL_DURATION);
  });
});
