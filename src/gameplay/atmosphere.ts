/**
 * Pure mapping from story progress to a lighting "mood". Stamps advance the night:
 * dusk → early night → deep festive night → pre-dawn; the sunrise only happens in the finale.
 */
export interface Mood {
  skyTop: number;
  skyHorizon: number;
  skyBottom: number;
  cloud: number;
  fog: number;
  fogDensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  moon: number;
  moonIntensity: number;
  stars: number;
  sun: number; // sunrise glow 0..1
  sunColor: number;
  exposure: number;
  windowGlow: number;
  bulbIntensity: number;
}

export const STAGES: { name: string; mood: Mood }[] = [
  {
    // vivid festival dusk: magenta-tangerine horizon, violet zenith
    name: 'Dusk',
    mood: { skyTop: 0x3a2a8a, skyHorizon: 0xff8a5c, skyBottom: 0x5a2a5a, cloud: 0xd86a9a, fog: 0x9a5a8a, fogDensity: 0.0036, hemiSky: 0xa898ff, hemiGround: 0x8a4a3a, hemiIntensity: 1.05, moon: 0xffc08a, moonIntensity: 1.9, stars: 0.3, sun: 0.4, sunColor: 0xff7a3a, exposure: 1.08, windowGlow: 1, bulbIntensity: 1 },
  },
  {
    name: 'Early night',
    mood: { skyTop: 0x1a1a6a, skyHorizon: 0xb8509a, skyBottom: 0x3a2050, cloud: 0x6a3a9a, fog: 0x5a3a7a, fogDensity: 0.0042, hemiSky: 0x8a80ff, hemiGround: 0x7a4040, hemiIntensity: 1.05, moon: 0xc0c8ff, moonIntensity: 1.7, stars: 0.8, sun: 0.0, sunColor: 0xff8a4a, exposure: 1.28, windowGlow: 1, bulbIntensity: 1.1 },
  },
  {
    // deep festive night: rich indigo, city glow warming the horizon
    name: 'Deep festive night',
    mood: { skyTop: 0x0e1050, skyHorizon: 0x7a3a8a, skyBottom: 0x2a1a48, cloud: 0x3a2a7a, fog: 0x3a2a62, fogDensity: 0.0045, hemiSky: 0x7a78ff, hemiGround: 0x6a3838, hemiIntensity: 1.0, moon: 0xb0c0ff, moonIntensity: 1.6, stars: 1, sun: 0.0, sunColor: 0xff8a4a, exposure: 1.35, windowGlow: 1, bulbIntensity: 1.2 },
  },
  {
    name: 'Pre-dawn',
    mood: { skyTop: 0x22307a, skyHorizon: 0x9a7ac0, skyBottom: 0x3a3a6a, cloud: 0x6a6ab0, fog: 0x5a5a8a, fogDensity: 0.0045, hemiSky: 0x9aa8ff, hemiGround: 0x5a4a58, hemiIntensity: 1.05, moon: 0xd0d8ff, moonIntensity: 1.5, stars: 0.5, sun: 0.15, sunColor: 0xff9a6a, exposure: 1.25, windowGlow: 0.9, bulbIntensity: 1.05 },
  },
  {
    name: 'Sunrise',
    mood: { skyTop: 0x4a8ae0, skyHorizon: 0xffb07a, skyBottom: 0xa86a80, cloud: 0xffa0a8, fog: 0xf0a888, fogDensity: 0.003, hemiSky: 0xc0d4ff, hemiGround: 0xa07050, hemiIntensity: 1.35, moon: 0xffc89a, moonIntensity: 2.8, stars: 0, sun: 1, sunColor: 0xffa060, exposure: 1.1, windowGlow: 0.4, bulbIntensity: 0.6 },
  },
];

/** Continuous stage value 0..3 from stamp count (0..8). */
export function stageForStamps(stamps: number): number {
  if (stamps <= 0) return 0;
  if (stamps >= 8) return 3;
  // 1–2 stamps → early night, 3–6 deep night, 7 → pre-dawn approach
  return Math.min(3, stamps <= 2 ? stamps * 0.5 : stamps <= 6 ? 1 + (stamps - 2) * 0.25 : 2 + (stamps - 6) * 0.5);
}

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

export function moodAt(stage: number): Mood {
  const s = Math.max(0, Math.min(STAGES.length - 1, stage));
  const i = Math.min(STAGES.length - 2, Math.floor(s));
  const t = s - i;
  const a = STAGES[i].mood, b = STAGES[i + 1].mood;
  const out = {} as Mood;
  for (const k of Object.keys(a) as (keyof Mood)[]) {
    const isColor = !['fogDensity', 'hemiIntensity', 'moonIntensity', 'stars', 'sun', 'exposure', 'windowGlow', 'bulbIntensity'].includes(k);
    (out as any)[k] = isColor ? lerpColor(a[k], b[k], t) : a[k] + (b[k] - a[k]) * t;
  }
  return out;
}
