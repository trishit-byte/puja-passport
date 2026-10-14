import { describe, it, expect } from 'vitest';
import { createMachine, judgeRhythm, RhythmMachine, MatchMachine, SetMachine } from '../../src/interactions/machines';
import { PANDALS, PANDAL_BY_ID } from '../../src/data/pandals';

describe('SingleMachine', () => {
  it('completes once and then ignores further actions', () => {
    const m = createMachine(PANDAL_BY_ID['bonedi-bari'].interaction);
    expect(m.isComplete()).toBe(false);
    expect(m.promptFor('bell')).toMatch(/bell/i);
    expect(m.act('bell').type).toBe('complete');
    expect(m.isComplete()).toBe(true);
    expect(m.act('bell').type).toBe('noop');
  });
  it('ignores unrelated targets', () => {
    const m = createMachine(PANDAL_BY_ID['neel-shagor'].interaction);
    expect(m.act('bell').type).toBe('noop');
    expect(m.isComplete()).toBe(false);
  });
});

describe('SetMachine', () => {
  it('needs all three sculptures, in any order, without double counting', () => {
    const m = createMachine(PANDAL_BY_ID['alor-utsav'].interaction) as SetMachine;
    expect(m.act('sculpt-3').type).toBe('progress');
    expect(m.act('sculpt-3').type).toBe('noop'); // repeat does not count
    expect(m.act('sculpt-1').type).toBe('progress');
    expect(m.isComplete()).toBe(false);
    expect(m.act('sculpt-2').type).toBe('complete');
  });
  it('ordered sets only accept the next step (take lamp before placing it)', () => {
    const m = createMachine(PANDAL_BY_ID['nodir-alo'].interaction) as SetMachine;
    expect(m.activeTargets()).toEqual(['lamp-take']);
    expect(m.promptFor('lamp-place')).toBeNull();
    expect(m.act('lamp-place').type).toBe('noop');
    expect(m.act('lamp-take').type).toBe('progress');
    expect(m.activeTargets()).toEqual(['lamp-place']);
    expect(m.act('lamp-place').type).toBe('complete');
  });
  it('carries folk-art info text for Gram Bangla', () => {
    const m = createMachine(PANDAL_BY_ID['gram-bangla'].interaction) as SetMachine;
    const r = m.act('panel-pat');
    expect(r.type).toBe('progress');
    expect((r as { message?: string }).message).toMatch(/Patachitra/);
  });
});

describe('Rhythm', () => {
  it('judges intervals, not absolute timing', () => {
    expect(judgeRhythm([0, 0.5, 1.0], [10.0, 10.5, 11.0], 0.28)).toBe(true);
    expect(judgeRhythm([0, 0.5, 1.0], [3.0, 3.62, 4.05], 0.28)).toBe(true); // generous
    expect(judgeRhythm([0, 0.5, 1.0], [3.0, 4.6, 4.7], 0.28)).toBe(false);
    expect(judgeRhythm([0, 0.5, 1.0], [3.0, 3.5], 0.28)).toBe(false);
  });
  it('only listens for taps after the cue, allows retries and always allows skip', () => {
    const m = createMachine(PANDAL_BY_ID['dhaker-taal'].interaction) as RhythmMachine;
    expect(m.act('dhak', 1).type).toBe('noop'); // not your turn yet
    m.startListening();
    m.beginRepeat();
    m.act('dhak', 0);
    m.act('dhak', 2);
    expect(m.act('dhak', 2.1).type).toBe('reject');
    expect(m.isComplete()).toBe(false);
    m.beginRepeat();
    m.act('dhak', 5);
    m.act('dhak', 5.5);
    expect(m.act('dhak', 6).type).toBe('complete');
    const m2 = createMachine(PANDAL_BY_ID['dhaker-taal'].interaction) as RhythmMachine;
    expect(m2.skip().type).toBe('complete');
    expect(m2.isComplete()).toBe(true);
    expect(m2.skip().type).toBe('noop');
  });
});

describe('Match (postcards)', () => {
  it('requires picking a card first and matching the right landmark', () => {
    const m = createMachine(PANDAL_BY_ID['smritir-shohor'].interaction) as MatchMachine;
    expect(m.act('lm-tram').type).toBe('reject');
    m.select('card-clock');
    expect(m.act('lm-tram').type).toBe('reject'); // wrong scene
    expect(m.selected).toBe('card-clock'); // keeps the card after a mismatch
    expect(m.act('lm-clock').type).toBe('progress');
    expect(m.select('card-clock')).toBe(false); // already placed
    m.select('card-cha');
    m.act('lm-cha');
    m.select('card-tram');
    expect(m.act('lm-tram').type).toBe('complete');
    expect(m.activeTargets()).toEqual([]);
  });
});

describe('pandal data', () => {
  it('has eight unique pandals, stamps and Bengali names', () => {
    expect(PANDALS).toHaveLength(10);
    expect(new Set(PANDALS.map((p) => p.stamp.id)).size).toBe(10);
    for (const p of PANDALS) expect(p.bn).toMatch(/[ঀ-৿]/);
  });
  it('plots do not overlap each other', () => {
    for (const a of PANDALS)
      for (const b of PANDALS) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(a.radius + b.radius);
  });
});
