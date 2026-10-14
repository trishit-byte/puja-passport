/**
 * Hand-painted-style shop signboards rendered into a single canvas atlas (one texture, one material),
 * so every sign in the city merges into the same batch. Bengali text uses the self-hosted Baloo Da 2.
 */
import * as THREE from 'three';
import { releaseImageAfterUpload } from '../../utils/geometry';
import { bend } from '../../rendering/materials';

/**
 * The shops of Anandapur. Each board has the Bengali name first (largest), English below, and on
 * some storefronts a Devanagari line too. Categories decide the board's colours, what's on the
 * shelves and who keeps the shop.
 */
const COLS = 4, ROWS = 16; // 512×128 cells (4:1 boards) in a 2048² atlas
const CELLS = COLS * ROWS;
const CW = 512, CH = 128;

export type ShopKind = 'sweets' | 'tea' | 'telebhaja' | 'rolls' | 'fuchka' | 'hotel' | 'biryani' | 'books' | 'clothing' | 'general' | 'gift' | 'puja' | 'medical' | 'photo' | 'jewellers' | 'tailor' | 'cycle';
export interface ShopSign {
  bn: string;
  en: string;
  hi?: string;
  kind: ShopKind;
}
const BOARD: Record<ShopKind, { bg: string; fg: string; rule: string }> = {
  sweets: { bg: '#9e1b1b', fg: '#ffe7a3', rule: '#e0b84a' },
  tea: { bg: '#2f6b4e', fg: '#fff3d6', rule: '#f2c14e' },
  telebhaja: { bg: '#e8742a', fg: '#2b1406', rule: '#2b1406' },
  rolls: { bg: '#5e2f86', fg: '#ffe8b0', rule: '#ffc93c' },
  fuchka: { bg: '#f6a21e', fg: '#3b1d0a', rule: '#3b1d0a' },
  hotel: { bg: '#f4eedf', fg: '#9e1b1b', rule: '#2f6b4e' },
  biryani: { bg: '#1f4f3a', fg: '#ffd36b', rule: '#ffd36b' },
  books: { bg: '#1a4f9c', fg: '#ffffff', rule: '#ffd36b' },
  clothing: { bg: '#6b1f4a', fg: '#ffd9a8', rule: '#e0b84a' },
  general: { bg: '#f2c14e', fg: '#3b1d0a', rule: '#b3121f' },
  gift: { bg: '#c8406e', fg: '#ffffff', rule: '#ffe08a' },
  puja: { bg: '#b3121f', fg: '#ffd36b', rule: '#ffd36b' },
  medical: { bg: '#f8f8f2', fg: '#0f6b3a', rule: '#0f6b3a' },
  photo: { bg: '#103b45', fg: '#7fe8ff', rule: '#7fe8ff' },
  jewellers: { bg: '#3b2a12', fg: '#ffcf5a', rule: '#ffcf5a' },
  tailor: { bg: '#2f5d62', fg: '#ffe8b0', rule: '#ffe8b0' },
  cycle: { bg: '#e3c68c', fg: '#3b1d0a', rule: '#7a2e12' },
};
const NAMED: ShopSign[] = [
  { bn: 'মা অন্নপূর্ণা মিষ্টান্ন ভাণ্ডার', en: 'MAA ANNAPURNA MISTANNA BHANDAR', hi: 'मां अन्नपूर्णा मिष्टान्न भंडार', kind: 'sweets' },
  { bn: 'গোপাল মিষ্টান্ন ভাণ্ডার', en: 'GOPAL MISTANNA BHANDAR', kind: 'sweets' },
  { bn: 'আদর্শ মিষ্টান্ন ভাণ্ডার', en: 'ADARSHA MISTANNA BHANDAR', kind: 'sweets' },
  { bn: 'নিউ বেঙ্গল সুইটস', en: 'NEW BENGAL SWEETS', hi: 'न्यू बेंगल स्वीट्स', kind: 'sweets' },
  { bn: 'শ্যামলদার তেলেভাজা', en: 'SHYAMALDAR TELEBHAJA', kind: 'telebhaja' },
  { bn: 'আদর্শ হিন্দু হোটেল', en: 'ADARSHA HINDU HOTEL', kind: 'hotel' },
  { bn: 'মা তারা হোটেল', en: 'MAA TARA HOTEL', hi: 'मां तारा होटल', kind: 'hotel' },
  { bn: 'নিউ আনন্দপুর বিরিয়ানি হাউস', en: 'NEW ANANDAPUR BIRYANI HOUSE', hi: 'न्यू आनंदपुर बिरयानी हाउस', kind: 'biryani' },
  { bn: 'সরস্বতী বই ঘর', en: 'SARASWATI BOI GHAR', kind: 'books' },
  { bn: 'আনন্দপুর বুক স্টল', en: 'ANANDAPUR BOOK STALL', kind: 'books' },
  { bn: 'জ্ঞানদীপ বুক হাউস', en: 'GYANADEEP BOOK HOUSE', hi: 'ज्ञानदीप बुक हाउस', kind: 'books' },
  { bn: 'আদি লক্ষ্মী বস্ত্রালয়', en: 'ADI LAKSHMI BASTRALAYA', hi: 'आदि लक्ष्मी वस्त्रालय', kind: 'clothing' },
  { bn: 'মা দুর্গা শাড়ি ঘর', en: 'MAA DURGA SAREE GHAR', kind: 'clothing' },
  { bn: 'আনন্দপুর বস্ত্র বিতান', en: 'ANANDAPUR BASTRA BITAN', kind: 'clothing' },
  { bn: 'বোস অ্যান্ড সন্স', en: 'BOSE & SONS', kind: 'general' },
  { bn: 'ঘোষ ব্রাদার্স', en: 'GHOSH BROTHERS', kind: 'general' },
  { bn: 'মিত্র ভাণ্ডার', en: 'MITRA BHANDAR', kind: 'general' },
  { bn: 'প্রিয়জন গিফট হাউস', en: 'PRIYOJON GIFT HOUSE', hi: 'प्रियजन गिफ्ट हाउस', kind: 'gift' },
  { bn: 'মা কালী দশকর্মা ভাণ্ডার', en: 'MAA KALI DASHAKARMA BHANDAR', kind: 'puja' },
  { bn: 'সঞ্জীবনী মেডিক্যাল হল', en: 'SANJEEVANI MEDICAL HALL', hi: 'संजीवनी मेडिकल हॉल', kind: 'medical' },
  { bn: 'ছবিঘর ফটো স্টুডিও', en: 'CHHABIGHAR PHOTO STUDIO', kind: 'photo' },
  { bn: 'লক্ষ্মী জুয়েলার্স', en: 'LAKSHMI JEWELLERS', hi: 'लक्ष्मी ज्वैलर्स', kind: 'jewellers' },
  { bn: 'সেন টেলার্স', en: 'SEN TAILORS', kind: 'tailor' },
  { bn: 'বিশ্বকর্মা সাইকেল স্টোর্স', en: 'BISWAKARMA CYCLE STORES', kind: 'cycle' },
  { bn: 'কালীচরণ মিষ্টির দোকান', en: 'KALICHARAN MISHTIR DOKAN', kind: 'sweets' },
  { bn: 'হারুর তেলেভাজা', en: "HARU'S TELEBHAJA", kind: 'telebhaja' },
  { bn: 'মা লক্ষ্মী তেলেভাজা', en: 'MAA LAKSHMI TELEBHAJA', kind: 'telebhaja' },
  { bn: 'ভোলাদার চায়ের দোকান', en: "BHOLADA'S CHA DOKAN", kind: 'tea' },
  { bn: 'দত্ত সাইকেল সারাই', en: 'DUTTA CYCLE REPAIRING', kind: 'cycle' },
  { bn: 'অন্নপূর্ণা ভাতের হোটেল', en: 'ANNAPURNA BHATER HOTEL', kind: 'hotel' },
  { bn: 'শাহী বিরিয়ানি ঘর', en: 'SHAHI BIRYANI GHAR', kind: 'biryani' },
  { bn: 'সাহা মিষ্টান্ন ভাণ্ডার', en: 'SAHA MISTANNA BHANDAR', kind: 'sweets' },
];
// more shops in the same naming tradition: a family or a deity's name, then the trade
const PREFIX: [string, string, string][] = [
  ['মা তারা', 'MAA TARA', 'मां तारा'], ['মা কালী', 'MAA KALI', 'मां काली'], ['শ্রী কৃষ্ণ', 'SRI KRISHNA', 'श्री कृष्ण'], ['জয় গুরু', 'JOY GURU', 'जय गुरु'],
  ['লোকনাথ', 'LOKENATH', 'लोकनाथ'], ['সাহা', 'SAHA', 'साहा'], ['দাস', 'DAS', 'दास'], ['পাল', 'PAL', 'पाल'], ['দত্ত', 'DUTTA', 'दत्त'],
  ['কুণ্ডু', 'KUNDU', 'कुंडू'], ['বিশ্বাস', 'BISWAS', 'बिस्वास'], ['অন্নপূর্ণা', 'ANNAPURNA', 'अन्नपूर्णा'], ['শ্রী দুর্গা', 'SRI DURGA', 'श्री दुर्गा'], ['গণেশ', 'GANESH', 'गणेश'], ['মৈত্র', 'MOITRA', 'मैत्र'],
];
const TRADE: [ShopKind, string, string, string][] = [
  ['sweets', 'মিষ্টান্ন ভাণ্ডার', 'MISTANNA BHANDAR', 'मिष्टान्न भंडार'],
  ['clothing', 'বস্ত্রালয়', 'BASTRALAYA', 'वस्त्रालय'],
  ['general', 'স্টোর্স', 'STORES', 'स्टोर्स'],
  ['books', 'বুক স্টল', 'BOOK STALL', 'बुक स्टॉल'],
  ['medical', 'মেডিক্যাল হল', 'MEDICAL HALL', 'मेडिकल हॉल'],
  ['puja', 'দশকর্মা ভাণ্ডার', 'DASHAKARMA BHANDAR', 'दशकर्मा भंडार'],
  ['tea', 'টি স্টল', 'TEA STALL', 'टी स्टॉल'],
  ['hotel', 'হোটেল', 'HOTEL', 'होटल'],
  ['jewellers', 'জুয়েলার্স', 'JEWELLERS', 'ज्वैलर्स'],
  ['clothing', 'শাড়ি ঘর', 'SAREE GHAR', 'साड़ी घर'],
  ['tailor', 'টেলার্স', 'TAILORS', 'टेलर्स'],
];
export const SHOPS: ShopSign[] = (() => {
  const out = [...NAMED];
  const seen = new Set(out.map((s) => s.en));
  for (let i = 0; out.length < CELLS; i++) {
    const [kind, tb, te, th] = TRADE[i % TRADE.length];
    const [pb, pe, ph] = PREFIX[(i * 5 + Math.floor(i / TRADE.length)) % PREFIX.length];
    const en = `${pe} ${te}`;
    if (seen.has(en)) continue;
    seen.add(en);
    out.push({ bn: `${pb} ${tb}`, en, kind, hi: i % 5 === 2 ? `${ph} ${th}` : undefined });
  }
  return out;
})();

/** Which trades each neighbourhood favours (shops are spread by these, least-used names first). */
const DISTRICT_TRADES: Record<string, ShopKind[]> = {
  mela: ['sweets', 'clothing', 'general', 'sweets', 'clothing', 'gift', 'jewellers', 'tailor', 'telebhaja', 'hotel', 'puja', 'general', 'medical', 'biryani'],
  bonedi: ['sweets', 'puja', 'books', 'jewellers', 'general', 'tea', 'clothing', 'hotel'],
  alok: ['books', 'photo', 'tea', 'medical', 'general', 'books', 'sweets', 'biryani', 'cycle'],
  notun: ['medical', 'gift', 'biryani', 'clothing', 'general', 'cycle', 'photo'],
  ghat: ['tea', 'telebhaja', 'hotel', 'puja', 'cycle', 'general', 'hotel', 'sweets'],
};
const used = new Map<number, number>();
const usedIn = new Map<string, Set<number>>();
/** Pick a shop for a storefront in a district: a fitting trade, the least-used name, never twice in one neighbourhood if avoidable. */
export function pickShop(district: string, rnd: () => number): number {
  const trades = DISTRICT_TRADES[district] ?? DISTRICT_TRADES.mela;
  const kind = trades[Math.floor(rnd() * trades.length)];
  const here = usedIn.get(district) ?? new Set<number>();
  let best = -1, bestScore = Infinity;
  SHOPS.forEach((s, i) => {
    if (s.kind !== kind) return;
    const score = (used.get(i) ?? 0) * 10 + (here.has(i) ? 100 : 0) + rnd();
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  if (best < 0) best = Math.floor(rnd() * SHOPS.length);
  used.set(best, (used.get(best) ?? 0) + 1);
  here.add(best);
  usedIn.set(district, here);
  return best;
}

let mat: THREE.MeshToonMaterial | null = null;
let canvas: HTMLCanvasElement | null = null;

const FONT = (n: number) => `800 ${n}px "Baloo Da 2", "Baloo 2", "Noto Sans Bengali", "Noto Sans Devanagari", sans-serif`;
export function drawSignAtlas() {
  if (!canvas) return;
  const g = canvas.getContext('2d')!;
  SHOPS.forEach((s, i) => {
    const b = BOARD[s.kind];
    const x = (i % COLS) * CW, y = Math.floor(i / COLS) * CH;
    g.fillStyle = b.bg;
    g.fillRect(x, y, CW, CH);
    // a painted double rule, as on hand-lettered Kolkata boards
    g.strokeStyle = b.rule;
    g.lineWidth = 3;
    g.strokeRect(x + 5, y + 5, CW - 10, CH - 10);
    g.lineWidth = 1.2;
    g.strokeRect(x + 10, y + 10, CW - 20, CH - 20);
    g.fillStyle = b.fg;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    const lines = s.hi ? [s.bn, s.hi, s.en] : [s.bn, s.en];
    // Bengali leads (largest); the other lines share one smaller size; all fitted to the board
    const fit = (t: string, start: number) => {
      let n = start;
      g.font = FONT(n);
      while (g.measureText(t).width > CW - 34 && n > 12) g.font = FONT(--n);
      return n;
    };
    if (lines.length === 2) {
      const big = fit(s.bn, 56);
      const small = Math.min(fit(s.en, 34), Math.round(big * 0.64));
      g.font = FONT(big);
      g.fillText(s.bn, x + CW / 2, y + 66);
      g.font = FONT(small);
      g.fillText(s.en, x + CW / 2, y + 106);
    } else {
      // three scripts: Bengali, then Devanagari, then English, each on its own clear band
      const big = fit(s.bn, 42);
      const small = Math.min(fit(s.hi!, 25), fit(s.en, 24), Math.round(big * 0.6));
      g.font = FONT(big);
      g.fillText(s.bn, x + CW / 2, y + 50);
      g.font = FONT(small);
      g.fillText(s.hi!, x + CW / 2, y + 82);
      g.fillText(s.en, x + CW / 2, y + 110);
    }
  });
  if (mat?.map) mat.map.needsUpdate = true;
}

export function signMaterial(): THREE.MeshToonMaterial {
  if (mat) return mat;
  canvas = document.createElement('canvas');
  canvas.width = CW * COLS;
  canvas.height = CH * ROWS;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  drawSignAtlas();
  mat = bend(new THREE.MeshToonMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 })) as THREE.MeshToonMaterial;
  return mat;
}

/** The board's proportions (width : height) — size planes to this so the lettering isn't stretched. */
export const SIGN_ASPECT = CW / CH;

/** A plane whose UVs select one atlas cell. */
export function signGeometry(index: number, w: number, h: number): THREE.BufferGeometry {
  index = ((index % SHOPS.length) + SHOPS.length) % SHOPS.length;
  const g = new THREE.PlaneGeometry(w, h);
  const cx = index % COLS, cy = Math.floor(index / COLS);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    uv.setXY(i, (cx + u) / COLS, 1 - (cy + 1 - v) / ROWS);
  }
  return g;
}

/** Food-stall boards: Bengali, Devanagari, English — same family (Baloo), same size. */
export const FOOD_SIGNS: Record<'fuchka' | 'chowmein' | 'roll' | 'cha' | 'jhalmuri' | 'mishti', { bn: string; hi?: string; en: string; bg: string; fg: string }> = {
  fuchka: { bn: 'পাঁচুর ফুচকা', hi: 'पांचू का फुचका', en: "PANCHU'S PHUCHKA", bg: '#f6a21e', fg: '#3b1d0a' },
  chowmein: { bn: 'রাজুর চাউমিন', en: "RAJU'S CHOWMEIN", bg: '#c8102e', fg: '#ffe8b0' },
  roll: { bn: 'বাবলু রোল সেন্টার', hi: 'बबलू रोल सेंटर', en: 'BABLU ROLL CENTRE', bg: '#5e2f86', fg: '#ffe8b0' },
  cha: { bn: 'নিতাইদার চা', en: "NITAIDA'S TEA STALL", bg: '#2f6b4e', fg: '#fff3d6' },
  jhalmuri: { bn: 'হরিদার ঝালমুড়ি', en: "HARIDA'S JHALMURI", bg: '#ffc93c', fg: '#5a1d0a' },
  mishti: { bn: 'নবীন ময়রার মিষ্টি', hi: 'नवीन मयरा की मिठाई', en: "NABIN MOYRA'S MISHTI", bg: '#b3121f', fg: '#ffe8b0' },
};
export type FoodSign = keyof typeof FOOD_SIGNS;
const foodMats = new Map<FoodSign, THREE.Material>();
const foodGeos = new Map<number, THREE.BufferGeometry>();

/** Material for one food board (3:2 aspect canvas). */
export function foodSignMaterial(kind: FoodSign): THREE.Material {
  let m = foodMats.get(kind);
  if (m) return m;
  const s = FOOD_SIGNS[kind];
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 336;
  const g = c.getContext('2d')!;
  g.fillStyle = s.bg;
  g.fillRect(0, 0, 512, 336);
  g.strokeStyle = s.fg;
  g.lineWidth = 6;
  g.strokeRect(9, 9, 494, 318);
  g.fillStyle = s.fg;
  g.textAlign = 'center';
  // Bengali leads, large; English (and Devanagari where the stall has it) smaller beneath
  const font = (n: number) => `800 ${n}px "Baloo Da 2", "Baloo 2", "Noto Sans Bengali", "Noto Sans Devanagari", sans-serif`;
  const fit = (t: string, start: number) => {
    let n = start;
    g.font = font(n);
    while (g.measureText(t).width > 456 && n > 18) g.font = font(--n);
    return n;
  };
  const big = fit(s.bn, 84);
  if (s.hi) {
    const small = Math.min(fit(s.hi, 56), fit(s.en, 56), Math.round(big * 0.7));
    g.font = font(big);
    g.fillText(s.bn, 256, 122);
    g.font = font(small);
    g.fillText(s.hi, 256, 214);
    g.fillText(s.en, 256, 294);
  } else {
    const small = Math.min(fit(s.en, 60), Math.round(big * 0.72));
    g.font = font(big);
    g.fillText(s.bn, 256, 150);
    g.font = font(small);
    g.fillText(s.en, 256, 262);
  }
  const tex = new THREE.CanvasTexture(c);
  releaseImageAfterUpload(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  m = bend(new THREE.MeshToonMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 }));
  foodMats.set(kind, m);
  return m;
}
/** A board w wide (height = w × 0.66). */
export function foodSignGeometry(w: number): THREE.BufferGeometry {
  let g = foodGeos.get(w);
  if (!g) foodGeos.set(w, (g = new THREE.PlaneGeometry(w, w * 0.656)));
  return g;
}
