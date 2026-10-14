import { describe, it, expect } from 'vitest';
import { CollisionWorld } from '../../src/world/collision';
import { stageForStamps, moodAt, lerpColor, STAGES } from '../../src/gameplay/atmosphere';
import { groundHeight, START, FINALE_POINT, GHAT_TOP_Z, RIVER_Z, ISLAND_R, RIVER_PANDAL } from '../../src/data/layout';
import { toPlanet, PLANET_R } from '../../src/utils/planet';
import { Rng } from '../../src/utils/rng';
import { InteractionSystem } from '../../src/interactions/InteractionSystem';
import * as THREE from 'three';

describe('collision', () => {
  it('pushes a circle out of an axis-aligned box and slides along it', () => {
    const c = new CollisionWorld();
    c.addBox(0, 0, 4, 4, 0, 6);
    const r = c.resolve(2.1, 0.5, 0.4);
    expect(r.hit).toBe(true);
    expect(r.x).toBeCloseTo(2.4, 5);
    expect(r.z).toBeCloseTo(0.5, 5); // tangential component preserved (sliding)
  });
  it('handles rotated boxes', () => {
    const c = new CollisionWorld();
    c.addBox(0, 0, 10, 1, Math.PI / 4, 6); // thin wall along a diagonal
    const r = c.resolve(0.2, 0.2, 0.4);
    // pushed out along the wall normal (±(1,1)/√2 for this rotation)
    expect(Math.abs(r.x - r.z)).toBeLessThan(1e-6);
    expect(Math.hypot(r.x, r.z)).toBeGreaterThan(0.85);
  });
  it('raycast hits only tall solid boxes', () => {
    const c = new CollisionWorld();
    c.addBox(5, 0, 2, 2, 0, 6);
    c.addCircle(2, 0, 0.3, 6); // lamp post: ignored by camera rays
    c.addBox(3, 3, 1, 1, 0, 1); // low railing
    expect(c.raycast(0, 0, 1, 0, 10, 4)).toBeCloseTo(4, 5);
    expect(c.raycast(0, 0, 0, 1, 10, 4)).toBe(10);
  });
  it('keeps the player on the island', () => {
    const c = new CollisionWorld();
    c.radius = 100;
    const r = c.resolve(200, 0, 0.4);
    expect(Math.hypot(r.x, r.z)).toBeLessThanOrEqual(100.0001);
  });
});

describe('atmosphere', () => {
  it('advances monotonically with stamps and stays before sunrise until the finale', () => {
    let prev = -1;
    for (let s = 0; s <= 8; s++) {
      const st = stageForStamps(s);
      expect(st).toBeGreaterThanOrEqual(prev);
      expect(st).toBeLessThanOrEqual(3);
      prev = st;
    }
    expect(stageForStamps(0)).toBe(0);
    expect(STAGES[4].name).toBe('Sunrise');
  });
  it('interpolates colours and clamps', () => {
    expect(lerpColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(moodAt(-5).skyTop).toBe(STAGES[0].mood.skyTop);
    expect(moodAt(99).skyTop).toBe(STAGES[4].mood.skyTop);
  });
});

describe('layout', () => {
  it('ground is flat in town and steps down the ghat to the river', () => {
    expect(groundHeight(START.x, START.z)).toBe(0);
    expect(groundHeight(0, GHAT_TOP_Z - 1)).toBe(0);
    expect(groundHeight(30, RIVER_Z)).toBeLessThan(-1.5);
    // Nodir Opare's footbridge and deck are level with the sixth ghat step, above the water
    expect(groundHeight(RIVER_PANDAL.x, RIVER_Z + 2)).toBe(RIVER_PANDAL.deckY);
    expect(groundHeight(RIVER_PANDAL.x + 8, 140)).toBe(RIVER_PANDAL.deckY);
    expect(RIVER_PANDAL.deckY).toBeGreaterThan(-2.4);
    expect(groundHeight(FINALE_POINT.x, FINALE_POINT.z)).toBeLessThan(0);
  });
  it('start and finale points lie on the island', () => {
    expect(Math.hypot(START.x, START.z)).toBeLessThan(ISLAND_R);
    expect(Math.hypot(FINALE_POINT.x, FINALE_POINT.z)).toBeLessThan(ISLAND_R);
  });
});

describe('planet mapping', () => {
  it('is the identity at the centre and preserves distance from the centre', () => {
    const o = toPlanet(0, 2, 0);
    expect(o.y).toBeCloseTo(2, 6);
    const p = toPlanet(50, 0, 0);
    // arc length from the pole equals the flat distance
    const angle = Math.atan2(p.x, p.y + PLANET_R);
    expect(angle * PLANET_R).toBeCloseTo(50, 4);
    expect(Math.hypot(p.x, p.y + PLANET_R)).toBeCloseTo(PLANET_R, 4);
  });
});

describe('misc', () => {
  it('rng is deterministic per seed', () => {
    const a = new Rng(42), b = new Rng(42);
    for (let i = 0; i < 10; i++) expect(a.next()).toBe(b.next());
  });
  it('interaction system picks the nearest available target in front', () => {
    const sys = new InteractionSystem();
    let acted = '';
    sys.add({ id: 'a', pos: new THREE.Vector3(0, 0, 1.5), radius: 2, prompt: () => 'A', act: () => (acted = 'a') });
    sys.add({ id: 'b', pos: new THREE.Vector3(0, 0, -1.2), radius: 2, prompt: () => 'B', act: () => (acted = 'b') });
    sys.add({ id: 'c', pos: new THREE.Vector3(0.5, 0, 0.5), radius: 2, prompt: () => null, act: () => (acted = 'c') });
    const best = sys.update(new THREE.Vector3(0, 0, 0), 0); // facing +z
    expect(best?.id).toBe('a');
    sys.trigger();
    expect(acted).toBe('a');
    expect(sys.update(new THREE.Vector3(10, 0, 10), 0)).toBeNull();
  });
});
