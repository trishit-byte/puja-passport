import { describe, it, expect } from 'vitest';
import { SHOPS, FOOD_SIGNS, pickShop } from '../../src/world/props/signs';

describe('shop names', () => {
  it('fills the atlas with distinct names, every board in Bengali and English', () => {
    expect(SHOPS.length).toBe(64);
    expect(new Set(SHOPS.map((s) => s.en)).size).toBe(SHOPS.length);
    for (const s of [...SHOPS, ...Object.values(FOOD_SIGNS)]) {
      expect(s.bn).toMatch(/[ঀ-৿]/);
      expect(s.en).toMatch(/^[A-Z0-9 '&]+$/);
      if (s.hi) expect(s.hi).toMatch(/[ऀ-ॿ]/);
    }
  });
  it('keeps the requested names and uses Devanagari only on some boards', () => {
    for (const en of ['MAA ANNAPURNA MISTANNA BHANDAR', 'ADARSHA HINDU HOTEL', 'SARASWATI BOI GHAR', 'ADI LAKSHMI BASTRALAYA', 'BOSE & SONS', 'PRIYOJON GIFT HOUSE'])
      expect(SHOPS.some((s) => s.en === en)).toBe(true);
    const tri = SHOPS.filter((s) => s.hi).length;
    expect(tri).toBeGreaterThan(5);
    expect(tri).toBeLessThan(SHOPS.length / 2);
  });
  it('gives each neighbourhood fitting trades without repeating a name there', () => {
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const ghat = Array.from({ length: 8 }, () => SHOPS[pickShop('ghat', rnd)]);
    expect(ghat.every((s) => ['tea', 'telebhaja', 'hotel', 'puja', 'cycle', 'general', 'sweets'].includes(s.kind))).toBe(true);
    expect(new Set(ghat.map((s) => s.en)).size).toBe(ghat.length);
  });
});
