import { describe, it, expect } from 'vitest';
import { SaveStore, sanitize, defaultSave, SAVE_KEY, SAVE_VERSION, type KV } from '../../src/save/SaveStore';
import { Progress, type ProgressEvent } from '../../src/gameplay/Progress';
import { PANDAL_IDS } from '../../src/data/pandals';

class MemKV implements KV {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

function shuffle<T>(a: T[], seed: number): T[] {
  const r = [...a];
  let s = seed;
  for (let i = r.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

describe('Progress', () => {
  it('stamping is idempotent', () => {
    const p = new Progress(defaultSave());
    expect(p.stamp('bonedi-bari')).toBe(true);
    expect(p.stamp('bonedi-bari')).toBe(false);
    expect(p.stampCount).toBe(1);
    expect(p.data.discovered).toContain('bonedi-bari');
  });

  it('all eight stamps can be collected in any order (10 random orders)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const p = new Progress(defaultSave());
      const events: ProgressEvent[] = [];
      p.on((e) => events.push(e));
      for (const id of shuffle(PANDAL_IDS, seed)) p.stamp(id);
      expect(p.allStamps).toBe(true);
      expect(events.filter((e) => e.type === 'all-stamps')).toHaveLength(1);
      expect(events.filter((e) => e.type === 'stamp').map((e) => (e as { count: number }).count)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });

  it('finale requires all stamps AND reaching the viewpoint', () => {
    const p = new Progress(defaultSave());
    expect(p.canTriggerFinale(true)).toBe(false);
    for (const id of PANDAL_IDS) p.stamp(id);
    expect(p.canTriggerFinale(false)).toBe(false);
    expect(p.canTriggerFinale(true)).toBe(true);
    expect(p.completeFinale()).toBe(true);
    expect(p.completeFinale()).toBe(false);
  });

  it('rejects unknown ids and records secrets once', () => {
    const p = new Progress(defaultSave());
    expect(p.stamp('not-a-pandal' as never)).toBe(false);
    expect(p.findSecret('cat')).toBe(true);
    expect(p.findSecret('cat')).toBe(false);
  });
});

describe('SaveStore', () => {
  it('round-trips progress', () => {
    const kv = new MemKV();
    const store = new SaveStore(kv);
    const d = store.load().data;
    d.stamps.push('gram-bangla');
    d.player = { x: 10, z: -5, yaw: 1 };
    store.save(d);
    const again = new SaveStore(kv).load();
    expect(again.fresh).toBe(false);
    expect(again.data.stamps).toEqual(['gram-bangla']);
    expect(again.data.player).toEqual({ x: 10, z: -5, yaw: 1 });
    expect(again.data.version).toBe(SAVE_VERSION);
  });

  it('recovers from corrupt JSON', () => {
    const kv = new MemKV();
    kv.setItem(SAVE_KEY, '{not json');
    const r = new SaveStore(kv).load();
    expect(r.recovered).toBe(true);
    expect(r.data.stamps).toEqual([]);
  });

  it('survives storage that throws (private mode)', () => {
    const kv: KV = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('denied');
      },
      removeItem() {},
    };
    const s = new SaveStore(kv);
    expect(s.load().data.stamps).toEqual([]);
    expect(s.save(defaultSave())).toBe(false);
  });

  it('migrates v1 saves and sanitises bad values', () => {
    const d = sanitize({
      version: 1,
      completed: ['bonedi-bari', 'bonedi-bari', 'bogus', 'nodir-alo'],
      player: { x: 'nope', z: 3 },
      audio: { master: 7, music: -1, muted: 'yes' },
      settings: { quality: 'ultra' },
      finaleSeen: true,
    });
    expect(d.stamps).toEqual(['bonedi-bari', 'nodir-alo']);
    expect(d.discovered).toEqual(expect.arrayContaining(['bonedi-bari', 'nodir-alo']));
    expect(d.player).toBeNull();
    expect(d.audio.master).toBe(1);
    expect(d.audio.music).toBe(0);
    expect(d.audio.muted).toBe(false);
    expect(d.settings.quality).toBe('high');
    expect(d.finaleSeen).toBe(false); // cannot have seen the finale with only 2 stamps
  });

  it('reset clears the save', () => {
    const kv = new MemKV();
    const s = new SaveStore(kv);
    s.save(defaultSave());
    s.reset();
    expect(kv.getItem(SAVE_KEY)).toBeNull();
  });
});
