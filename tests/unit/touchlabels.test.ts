import { describe, it, expect } from 'vitest';
import { shorten } from '../../src/ui/TouchControls';

// every prompt the action button can show (see the interaction prompts across the game)
const PROMPTS = [
  'Take a selfie at Rajbarir Pujo', 'Take a selfie — Nodir Opare', 'Talk to Artisan', 'Talk to Dokandar', 'Drink cha',
  'Eat Fuchka', 'Eat Kathi roll', 'Eat Chowmein', 'Eat Jhalmuri', 'Eat Mishti', 'Offer pranam to Ma Durga', 'Join the dhunuchi naach',
  'Join the aarti', 'Sit on the bench', 'Dance', 'Change Music', 'Ring the visitors’ bell', 'Look closer: Kumortuli', 'Look at the patachitra scroll',
  'Light the Dhruvatara — the pole star', 'Light the deepastambha, the lamp tower', 'Light the lotus sculpture', 'Wake the firefly lantern',
  'Place a postcard by the miniature tram', 'Take a clay lamp from the volunteer', 'Float your lamp on the river from the landing',
  'Tap along with the dhaki', 'Touch the glowing pearl', 'Offer flowers at the bedi (pushpanjali)', 'Blow the shankha at the temple gate',
  'Finish the Night — watch the sunrise',
];

describe('touch action button labels', () => {
  it('are short enough for the round button (≤ 14 characters, ≤ 2 words, no word over 10)', () => {
    for (const p of PROMPTS) {
      const s = shorten(p);
      expect(s.length, `${p} → ${s}`).toBeLessThanOrEqual(14);
      expect(s.split(' ').length, `${p} → ${s}`).toBeLessThanOrEqual(2);
      for (const w of s.split(' ')) expect(w.length, `${p} → ${s}`).toBeLessThanOrEqual(10);
    }
    expect(shorten('Take a selfie at Rajbarir Pujo')).toBe('Take Selfie');
    expect(shorten('Eat Kathi roll')).toBe('Eat Roll');
  });
});
