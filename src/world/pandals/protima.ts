/**
 * The Durga protima tableau in the traditional Bengali ekchala (one-frame) arrangement, modelled
 * on Kumartuli clay images.
 *
 * Seen from the visitors (viewer's left → right):
 *   Kola Bou · Ganesh (four arms, mouse) · Lakshmi (lotus, jhapi, owl) ·
 *   DURGA — golden-faced, three-eyed, ten arms fanned behind her like a halo, each hand bearing a
 *           weapon; her right foot rests on the lion's back, her left knee presses toward
 *           Mahishasura; the trishul in her front right hand pierces his chest; the serpent from
 *           her front left hand binds him ·
 *   the lion (Bengal's horse-faced "ghora-mukho singho") biting the asura's arm ·
 *   Mahishasura — green-skinned, muscular, sword raised and shield up, rising from the slain
 *           buffalo · Saraswati (veena, swan) · Kartik (bow and arrow, peacock)
 * …on one bedi beneath a painted chalchitra arch, with a white sholapith halo behind Durga.
 *
 * Protima conventions followed: large, long-tailed eyes (tana chokh) drawn in black up to the
 * temples, high arched brows with a row of white sandal dots above, a sharp nose with a nath,
 * small red lips, a broad serene face, long black hair to the waist, a red hibiscus (jaba)
 * garland, gold jewellery and red-and-gold saris.
 *
 * Everything is static and merged into the pandal's batches.
 */
import * as THREE from 'three';
import { toon, glow } from '../../rendering/materials';
import type { Local } from './common';

type V = [number, number, number];
const M4 = THREE.Matrix4, V3 = THREE.Vector3, Q = THREE.Quaternion, E = THREE.Euler;

const upward = (pts: [number, number][]) => (pts[0][1] > pts[pts.length - 1][1] ? [...pts].reverse() : pts);
const lathe = (pts: [number, number][], seg = 20) => new THREE.LatheGeometry(upward(pts).map(([r, y]) => new THREE.Vector2(r, y)), seg);
/** Lathe with radial folds deepening toward the bottom of the profile (cloth). */
function folded(pts: [number, number][], folds: number, amp: number, seg = 48) {
  const g = lathe(pts, seg);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const ys = pts.map((p) => p[1]);
  const top = Math.max(...ys), bot = Math.min(...ys);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (Math.hypot(x, z) < 0.002) continue;
    const k = 1 + amp * Math.pow(Math.max(0, (top - y) / (top - bot || 1)), 1.3) * Math.sin(Math.atan2(z, x) * folds);
    pos.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  return g;
}

const SPH = new THREE.SphereGeometry(1, 20, 14);
const SPHL = new THREE.SphereGeometry(1, 10, 7);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const CONE = new THREE.ConeGeometry(1, 1, 14);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const TOR = new THREE.TorusGeometry(1, 0.08, 6, 28);
const ARC = new THREE.TorusGeometry(1, 0.1, 4, 16, Math.PI); // upper half ring (lids, brows)
const PETAL = (() => {
  const g = new THREE.SphereGeometry(1, 10, 8);
  g.scale(0.35, 1, 0.08);
  return g;
})();
const taperCache = new Map<string, THREE.BufferGeometry>();
/** Unit-length tapered cylinder along +y from y=0 (radius a) to y=1 (radius b). */
function taperGeo(a: number, b: number) {
  const k = `${a.toFixed(4)}|${b.toFixed(4)}`;
  let g = taperCache.get(k);
  if (!g) {
    g = new THREE.CylinderGeometry(b, a, 1, 14, 1);
    g.translate(0, 0.5, 0);
    taperCache.set(k, g);
  }
  return g;
}

const PAL = {
  gold: 0xd9b240,
  goldDeep: 0xb88a1e,
  shola: 0xfbf7ec,
  black: 0x120d10,
  red: 0xc8102e,
  lips: 0xb01c2c,
  jaba: 0xd6142a,
  alta: 0xc0182a,
};
/**
 * Idol styles — each pandal commissions a different tradition:
 *  sabeki      classic Kumartuli: golden Durga, red-and-gold, one shared frame
 *  gilded      an all-gold metal protima
 *  terracotta  unpainted Bankura-style clay
 *  eco         jute, wood and leaf — earth and green tones, clay-pale skin
 *  patachitra  bold, saturated folk-painting colours
 *  sea         teal and blue garments, pearl instead of gold
 *  daker       daker saaj: painted faces, everything else in silver tinsel
 *  pastel      soft colours, each deity in her own frame (alada chala)
 *  akash       the night sky: indigo and midnight-blue garments, silver for gold, star-bright
 *  regal       a temple's grand image: deep reds and maroons, heavy bright gold
 */
export type IdolStyle = 'sabeki' | 'gilded' | 'terracotta' | 'eco' | 'patachitra' | 'sea' | 'daker' | 'pastel' | 'akash' | 'regal';
let STYLE: IdolStyle = 'sabeki';
// colours never restyled: the black and white of the eyes
const PROTECT = new Set([0x120d10, 0xfdfaf2, 0xffffff]);
// skin tones (Durga, Lakshmi, Saraswati, Kartik, Ganesh, Mahishasura)
const SKINS = new Set([0xf0b43a, 0xf8cdb0, 0xfbe8dc, 0xf2c890, 0xf6c2a8, 0x4f8a4a, 0x467d42]);
const GOLDS = new Set([0xd9b240, 0xb88a1e, 0xc89a3a]);
const _c = new THREE.Color(), _h = { h: 0, s: 0, l: 0 };
const ramp = (a: number, b: number, t: number) => _c.set(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t))).getHex();
function restyle(c: number): number {
  if (STYLE === 'sabeki' || PROTECT.has(c)) return c;
  _c.set(c).getHSL(_h);
  const skin = SKINS.has(c), gold = GOLDS.has(c);
  switch (STYLE) {
    case 'gilded':
      return ramp(0x5a3c0c, 0xffe596, Math.pow(_h.l, 0.75) * 1.15);
    case 'terracotta':
      return ramp(0x4a1e10, 0xe39a6c, _h.l * 1.2);
    case 'eco':
      if (skin) return c === 0x4f8a4a || c === 0x467d42 ? 0x6b7a3a : ramp(c, 0xe2c39a, 0.6);
      if (gold) return 0xd6bf7c;
      return _c.setHSL(0.07 + _h.h * 0.24, Math.min(0.45, _h.s * 0.5), 0.2 + _h.l * 0.6).getHex();
    case 'patachitra':
      if (c === 0xf0b43a) return 0xffa012;
      return _c.setHSL(_h.h, Math.min(1, _h.s * 1.35 + 0.1), Math.min(0.6, Math.max(0.3, _h.l))).getHex();
    case 'sea':
      if (gold) return 0xe6f2ff;
      if (skin) return c === 0x4f8a4a || c === 0x467d42 ? 0x2a6a7a : ramp(c, 0xb8e8ff, 0.18);
      return _c.setHSL(0.48 + ((_h.h * 7) % 1) * 0.16, Math.max(0.35, _h.s * 0.8), Math.min(0.75, _h.l)).getHex();
    case 'daker':
      if (skin) return c;
      if (gold) return 0xe8edf2;
      return ramp(c, 0xdfe5ec, 0.72);
    case 'pastel':
      if (skin) return ramp(c, 0xffffff, 0.12);
      return _c.setHSL(_h.h, _h.s * 0.55, Math.min(0.88, _h.l * 0.75 + 0.3)).getHex();
    case 'akash':
      if (skin) return c;
      if (gold) return 0xe6ecff;
      return _c.setHSL(0.6 + ((_h.h * 5) % 1) * 0.08, Math.max(0.45, _h.s * 0.85), Math.min(0.5, Math.max(0.16, _h.l * 0.62))).getHex();
    case 'regal':
      if (skin) return c;
      if (gold) return 0xffcf3a;
      // garments pulled toward deep red and maroon, keeping their light and shade
      return ramp(_c.setHSL(_h.h, Math.min(1, _h.s * 1.1), _h.l).getHex(), _h.l > 0.5 ? 0xd4af37 : 0x8a1020, 0.45);
  }
  return c;
}
const mat = (c: number) => toon(restyle(c), { paint: false });

/** Adds parts in a figure-local frame (origin at the feet, facing +z). */
class Fig {
  private M: THREE.Matrix4;
  constructor(private L: Local, x: number, y: number, z: number, s: number, ry = 0) {
    this.M = new M4().compose(new V3(x, y, z), new Q().setFromEuler(new E(0, ry, 0)), new V3(s, s, s));
  }
  part(g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0, shadow = false) {
    const t = new M4().compose(new V3(x, y, z), new Q().setFromEuler(new E(rx, ry, rz)), new V3(sx, sy, sz));
    this.L.b.add(g, m, t.premultiply(this.M).premultiply(this.L.base), { shadow });
  }
  /** Tapered limb from a (radius ra) to b (radius rb) with a ball joint at a. */
  limb(a: V, b: V, ra: number, rb: number, m: THREE.Material, joint = true) {
    const A = new V3(...a), B = new V3(...b);
    const len = A.distanceTo(B);
    if (len < 1e-4) return;
    const q = new Q().setFromUnitVectors(new V3(0, 1, 0), B.clone().sub(A).normalize());
    const t = new M4().compose(A, q, new V3(1, len, 1));
    this.L.b.add(taperGeo(ra, rb), m, t.premultiply(this.M).premultiply(this.L.base), { shadow: false });
    if (joint) this.part(SPH, m, ...a, ra, ra, ra);
  }
  /** A tube along a smooth curve (serpent, garland string, sash). */
  tube(pts: V[], r: number, m: THREE.Material, seg = 40) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p)));
    const g = new THREE.TubeGeometry(curve, seg, r, 8, false);
    this.L.b.add(g, m, this.M.clone().premultiply(this.L.base), { shadow: false });
    return curve;
  }
  /** Beads along a curve (garlands of hibiscus/marigold, pearl strings). */
  beads(pts: V[], n: number, r: number, mats: THREE.Material[]) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p)));
    for (let i = 0; i <= n; i++) {
      const p = curve.getPointAt(i / n);
      this.part(SPHL, mats[i % mats.length], p.x, p.y, p.z, r, r * 0.85, r);
    }
  }
}

// ---------------------------------------------------------------- faces & heads

interface FaceOpts {
  thirdEye?: boolean;
  nath?: boolean;
  chandan?: boolean;
  moustache?: boolean;
  fierce?: boolean;
  teep?: boolean;
}
/**
 * Protima face centred at (x, y, z), s = head height scale (1 ≈ 0.3 m tall head).
 * Broad oval, full cheeks, small chin; the big eyes are the soul of the image.
 */
function face(F: Fig, x: number, y: number, z: number, s: number, skin: number, o: FaceOpts = {}) {
  const sk = mat(skin), blk = mat(PAL.black), wht = mat(0xfdfaf2);
  F.part(SPH, sk, x, y, z, 0.125 * s, 0.15 * s, 0.12 * s);
  F.part(SPH, sk, x, y - 0.06 * s, z + 0.02 * s, 0.1 * s, 0.085 * s, 0.1 * s); // jaw & chin
  for (const sd of [-1, 1]) {
    F.part(SPH, sk, x + sd * 0.062 * s, y - 0.035 * s, z + 0.06 * s, 0.05 * s, 0.045 * s, 0.05 * s); // full cheeks
    F.part(SPH, sk, x + sd * 0.122 * s, y, z - 0.01 * s, 0.018 * s, 0.035 * s, 0.015 * s); // ears
    F.part(SPHL, mat(PAL.gold), x + sd * 0.126 * s, y - 0.05 * s, z, 0.022 * s, 0.032 * s, 0.022 * s); // jhumka
    F.part(CONE, mat(PAL.gold), x + sd * 0.126 * s, y - 0.09 * s, z, 0.028 * s, 0.04 * s, 0.028 * s, Math.PI);
    // the eye: long almond of white sweeping up toward the temple, large black iris, heavy
    // black outline above and below meeting in a long tail (the "tana" stroke)
    const ex = x + sd * 0.052 * s, ey = y + 0.018 * s, ez = z + 0.108 * s;
    F.part(SPH, wht, ex, ey, ez, 0.046 * s, o.fierce ? 0.024 * s : 0.019 * s, 0.012 * s, 0, 0, sd * -0.16);
    F.part(SPH, blk, ex - sd * 0.004 * s, ey - 0.001 * s, ez + 0.009 * s, 0.017 * s, 0.017 * s, 0.006 * s);
    F.part(SPHL, wht, ex - sd * 0.008 * s, ey + 0.006 * s, ez + 0.014 * s, 0.004 * s, 0.004 * s, 0.002 * s); // catchlight
    F.part(ARC, blk, ex, ey - 0.004 * s, ez + 0.004 * s, 0.047 * s, 0.024 * s, 0.03 * s, 0, 0, sd * -0.16); // upper lid
    F.part(ARC, blk, ex, ey + 0.002 * s, ez + 0.003 * s, 0.045 * s, 0.014 * s, 0.03 * s, 0, 0, Math.PI + sd * -0.16); // lower lid
    F.part(BOX, blk, ex + sd * 0.062 * s, ey + 0.013 * s, ez - 0.012 * s, 0.05 * s, 0.006 * s, 0.006 * s, 0, sd * -0.5, sd * 0.36); // tail to the temple
    // brows: high, thin, arched
    F.part(ARC, blk, ex + sd * 0.004 * s, ey + 0.036 * s, ez - 0.002 * s, 0.05 * s, o.fierce ? 0.012 * s : 0.022 * s, 0.03 * s, 0, 0, sd * (o.fierce ? 0.3 : -0.08));
    if (o.chandan) for (let k = 0; k < 5; k++) F.part(SPHL, wht, ex + sd * (-0.03 + k * 0.016) * s, ey + (0.072 + Math.sin((k / 4) * Math.PI) * 0.012) * s, ez - 0.006 * s, 0.0045 * s, 0.0045 * s, 0.003 * s);
  }
  // nose: long straight bridge and a defined tip
  F.part(SPH, sk, x, y - 0.002 * s, z + 0.118 * s, 0.013 * s, 0.045 * s, 0.016 * s);
  F.part(SPH, sk, x, y - 0.038 * s, z + 0.128 * s, 0.02 * s, 0.015 * s, 0.017 * s);
  // lips: small bow, upper darker
  F.part(SPH, mat(PAL.lips), x, y - 0.075 * s, z + 0.112 * s, 0.024 * s, 0.008 * s, 0.01 * s);
  F.part(SPH, mat(0xd8384a), x, y - 0.086 * s, z + 0.11 * s, 0.02 * s, 0.009 * s, 0.01 * s);
  if (o.fierce) F.part(SPH, mat(0x5a0a10), x, y - 0.082 * s, z + 0.112 * s, 0.022 * s, 0.012 * s, 0.008 * s); // snarl
  if (o.thirdEye) {
    F.part(SPH, wht, x, y + 0.072 * s, z + 0.115 * s, 0.009 * s, 0.024 * s, 0.006 * s);
    F.part(SPH, blk, x, y + 0.072 * s, z + 0.119 * s, 0.006 * s, 0.01 * s, 0.004 * s);
    F.part(SPH, mat(PAL.red), x, y + 0.072 * s, z + 0.113 * s, 0.014 * s, 0.03 * s, 0.004 * s); // red border
  }
  if (o.teep) F.part(SPH, mat(PAL.red), x, y + 0.064 * s, z + 0.118 * s, 0.011 * s, 0.011 * s, 0.004 * s);
  if (o.nath) {
    F.part(TOR, mat(PAL.gold), x + 0.03 * s, y - 0.05 * s, z + 0.122 * s, 0.032 * s, 0.032 * s, 0.032 * s, 0, 0.4, 0);
    F.part(SPHL, mat(PAL.red), x + 0.05 * s, y - 0.074 * s, z + 0.124 * s, 0.006 * s);
    F.tube([[x + 0.055 * s, y - 0.06 * s, z + 0.11 * s], [x + 0.1 * s, y - 0.04 * s, z + 0.06 * s], [x + 0.125 * s, y - 0.01 * s, z + 0.01 * s]], 0.0025 * s, mat(PAL.gold), 10); // nath chain
  }
  if (o.moustache)
    for (const sd of [-1, 1]) {
      F.part(SPH, blk, x + sd * 0.03 * s, y - 0.06 * s, z + 0.118 * s, 0.032 * s, 0.009 * s, 0.01 * s, 0, 0, sd * 0.25);
      if (o.fierce) F.part(TOR, blk, x + sd * 0.065 * s, y - 0.05 * s, z + 0.105 * s, 0.014 * s, 0.014 * s, 0.014 * s, 0, 0, 0); // curled tips
    }
}

/** Gold mukut with sholapith fan; for Durga a towering crown. */
function crown(F: Fig, x: number, y: number, z: number, s: number, tall = 1) {
  const gold = mat(PAL.gold), shola = mat(PAL.shola);
  F.part(lathe([[0.001, 0], [0.13, 0], [0.14, 0.04], [0.11, 0.1], [0.13, 0.17], [0.08, 0.27], [0.09, 0.32], [0.035, 0.44], [0.01, 0.52], [0.001, 0.54]]), gold, x, y, z - 0.01 * s, s, s * tall, s * 0.8);
  F.part(TOR, shola, x, y + 0.03 * s, z, 0.135 * s, 0.135 * s, 0.11 * s, Math.PI / 2, 0, 0); // pearl band
  F.part(SPHL, mat(PAL.red), x, y + 0.12 * s * tall, z + 0.1 * s, 0.022 * s, 0.026 * s, 0.01 * s);
  for (let i = 0; i < 9; i++) {
    const a = -1.25 + (i / 8) * 2.5;
    F.part(PETAL, i % 2 ? shola : gold, x + Math.sin(a) * 0.16 * s, y + 0.1 * s + Math.cos(a) * 0.17 * s * tall, z - 0.05 * s, 0.11 * s, 0.14 * s, 0.11 * s, 0, 0, -a);
  }
}

/** Long, thick black hair from the crown falling behind to the waist. */
function hair(F: Fig, x: number, y: number, z: number, s: number, len: number, width = 1) {
  const blk = mat(PAL.black);
  F.part(SPH, blk, x, y + 0.03 * s, z - 0.03 * s, 0.135 * s, 0.15 * s, 0.13 * s);
  F.part(SPH, blk, x, y - len * 0.5, z - 0.12 * s, 0.19 * s * width, len * 0.55, 0.06 * s);
  for (const sd of [-1, 1]) F.part(SPH, blk, x + sd * 0.12 * s * width, y - len * 0.3, z - 0.08 * s, 0.07 * s, len * 0.38, 0.06 * s); // locks over the shoulders
}

/** A hand: palm, fingers together, thumb; `grip` closes it round a shaft. */
function hand(F: Fig, p: V, r: number, skin: THREE.Material, side: number, grip = false, mudra = false) {
  F.part(SPH, skin, p[0], p[1], p[2], r * 0.85, r * 1.05, r * 0.55);
  if (mudra) {
    // abhaya: fingers raised, palm toward the viewer
    for (let k = 0; k < 4; k++) F.part(SPH, skin, p[0] + (k - 1.5) * r * 0.42, p[1] + r * 1.35, p[2] + r * 0.1, r * 0.2, r * 0.6, r * 0.2);
    F.part(SPH, mat(PAL.alta), p[0], p[1], p[2] + r * 0.5, r * 0.35, r * 0.35, r * 0.05); // alta on the palm
  } else if (grip) F.part(SPH, skin, p[0], p[1] + r * 0.3, p[2] + r * 0.35, r * 0.8, r * 0.55, r * 0.5);
  else F.part(SPH, skin, p[0], p[1] - r * 0.9, p[2] + r * 0.05, r * 0.7, r * 0.75, r * 0.45);
  F.part(SPH, skin, p[0] - side * r * 0.75, p[1] + r * 0.2, p[2] + r * 0.4, r * 0.3, r * 0.55, r * 0.3, 0, 0, side * 0.6); // thumb
}

/** Shakha-pola-gold bangles at a wrist, oriented along the forearm a→b. */
function bangles(F: Fig, a: V, b: V, r: number) {
  const A = new V3(...a), B = new V3(...b);
  const dir = B.clone().sub(A).normalize();
  const q = new Q().setFromUnitVectors(new V3(0, 0, 1), dir);
  const e = new E().setFromQuaternion(q);
  [PAL.shola, PAL.red, PAL.gold].forEach((c, i) => {
    const p = B.clone().addScaledVector(dir, -(0.03 + i * 0.022) * (r / 0.03));
    F.part(TOR, mat(c), p.x, p.y, p.z, r * 1.25, r * 1.25, r * 1.6, e.x, e.y, e.z);
  });
}

/** A foot with red alta border and a gold anklet; toe points along `dir` (radians around y). */
function foot(F: Fig, p: V, r: number, skin: number, yaw: number) {
  F.part(SPH, mat(skin), p[0], p[1], p[2], r * 0.7, r * 0.5, r * 1.6, 0, yaw, 0);
  F.part(SPH, mat(PAL.alta), p[0], p[1] - r * 0.3, p[2], r * 0.74, r * 0.25, r * 1.64, 0, yaw, 0);
  F.part(TOR, mat(PAL.gold), p[0] - Math.sin(yaw) * r, p[1] + r * 0.55, p[2] - Math.cos(yaw) * r, r * 0.75, r * 0.75, r * 0.75, Math.PI / 2, 0, 0);
}

// ---------------------------------------------------------------- weapons & attributes

function weapon(F: Fig, kind: string, h: V, s: number, side: number) {
  const gold = mat(PAL.gold), steel = mat(0xd6dde2), wood = mat(0x6b3a22);
  const [x, y, z] = h;
  switch (kind) {
    case 'sword': // khadga: broad curved blade held point-up
      F.limb([x, y - 0.06 * s, z], [x, y + 0.02 * s, z], 0.014 * s, 0.014 * s, gold);
      F.part(BOX, gold, x, y + 0.03 * s, z, 0.09 * s, 0.015 * s, 0.02 * s);
      F.part(BOX, steel, x + side * 0.01 * s, y + 0.25 * s, z, 0.045 * s, 0.42 * s, 0.008 * s, 0, 0, -side * 0.06);
      break;
    case 'chakra':
      F.part(TOR, gold, x, y + 0.1 * s, z, 0.085 * s, 0.085 * s, 0.085 * s);
      for (let k = 0; k < 8; k++) F.part(CONE, gold, x + Math.sin(k * 0.785) * 0.1 * s, y + 0.1 * s + Math.cos(k * 0.785) * 0.1 * s, z, 0.012 * s, 0.03 * s, 0.006 * s, 0, 0, -k * 0.785);
      F.part(SPHL, mat(PAL.red), x, y + 0.1 * s, z, 0.025 * s, 0.025 * s, 0.01 * s);
      break;
    case 'arrow':
      F.limb([x, y - 0.15 * s, z], [x, y + 0.35 * s, z], 0.007 * s, 0.007 * s, wood, false);
      F.part(CONE, steel, x, y + 0.38 * s, z, 0.02 * s, 0.06 * s, 0.006 * s);
      for (const sd of [-1, 1]) F.part(BOX, mat(0xb3121f), x + sd * 0.012 * s, y - 0.13 * s, z, 0.02 * s, 0.06 * s, 0.004 * s, 0, 0, sd * 0.3);
      break;
    case 'spear': // shakti
      F.limb([x, y - 0.25 * s, z], [x, y + 0.45 * s, z], 0.009 * s, 0.009 * s, gold, false);
      F.part(SPH, steel, x, y + 0.52 * s, z, 0.026 * s, 0.08 * s, 0.008 * s);
      break;
    case 'shield': // dhal, faced toward the viewer
      F.part(CYL, gold, x, y + 0.02 * s, z + 0.03 * s, 0.12 * s, 0.018 * s, 0.12 * s, Math.PI / 2, 0, 0);
      F.part(TOR, mat(PAL.red), x, y + 0.02 * s, z + 0.045 * s, 0.09 * s, 0.09 * s, 0.09 * s);
      F.part(SPHL, gold, x, y + 0.02 * s, z + 0.05 * s, 0.03 * s, 0.03 * s, 0.02 * s);
      break;
    case 'bow': // dhanush: tall curved bow with string
      F.part(new THREE.TorusGeometry(1, 0.035, 4, 20, Math.PI * 0.8), gold, x - side * 0.08 * s, y + 0.05 * s, z, 0.32 * s, 0.32 * s, 0.32 * s, 0, 0, side > 0 ? -0.1 * Math.PI - Math.PI / 2 + Math.PI : Math.PI / 2 - 0.1 * Math.PI - Math.PI);
      F.limb([x - side * 0.02 * s, y - 0.25 * s, z], [x - side * 0.02 * s, y + 0.35 * s, z], 0.003 * s, 0.003 * s, mat(0xf4eedf), false);
      break;
    case 'bell': // ghanta
      F.limb([x, y, z], [x, y + 0.08 * s, z], 0.008 * s, 0.008 * s, gold, false);
      F.part(lathe([[0.001, 0], [0.05, 0], [0.045, 0.02], [0.03, 0.08], [0.012, 0.1], [0.001, 0.1]]), gold, x, y - 0.11 * s, z, s, s, s);
      break;
    case 'axe': // parashu
      F.limb([x, y - 0.12 * s, z], [x, y + 0.3 * s, z], 0.009 * s, 0.009 * s, wood, false);
      F.part(SPH, steel, x - side * 0.05 * s, y + 0.26 * s, z, 0.06 * s, 0.055 * s, 0.008 * s);
      break;
    case 'conch':
      F.part(CONE, mat(PAL.shola), x, y + 0.06 * s, z + 0.02 * s, 0.045 * s, 0.14 * s, 0.045 * s, 0, 0, side * 0.5);
      F.part(SPH, mat(PAL.shola), x + side * 0.02 * s, y + 0.01 * s, z + 0.02 * s, 0.05 * s, 0.04 * s, 0.045 * s);
      break;
    case 'lotus':
      lotus(F, x, y + 0.04 * s, z + 0.02 * s, s * 0.7);
      break;
  }
}

function lotus(F: Fig, x: number, y: number, z: number, s: number) {
  for (let ring = 0; ring < 2; ring++)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + ring * 0.4;
      const t = ring ? 0.35 : 0.8;
      F.part(PETAL, mat(ring ? 0xf8b8cc : 0xf08cb0), x + Math.cos(a) * 0.04 * s, y + 0.04 * s + ring * 0.015 * s, z + Math.sin(a) * 0.04 * s, 0.12 * s, 0.1 * s, 0.12 * s, Math.sin(a) * t, 0, -Math.cos(a) * t);
    }
  F.part(SPHL, mat(0xffd36b), x, y + 0.05 * s, z, 0.03 * s, 0.022 * s, 0.03 * s);
}

// ---------------------------------------------------------------- the deities

/**
 * Durga, built directly in tableau units (origin = centre of the bedi top, +z toward viewers).
 * Lion to her right (−x), Mahishasura to her left (+x).
 */
function durga(F: Fig) {
  const skinC = 0xf0b43a; // golden "atasi" complexion
  const skin = mat(skinC), red = mat(PAL.red), gold = mat(PAL.gold), deep = mat(0x8a0c1c), shola = mat(PAL.shola);
  // prabhamandal: a sholapith halo behind her head and upper arms
  F.part(CYL, shola, 0, 2.75, -0.62, 0.95, 0.03, 0.95, Math.PI / 2, 0, 0);
  F.part(TOR, gold, 0, 2.75, -0.59, 0.95, 0.95, 0.6);
  F.part(TOR, mat(PAL.red), 0, 2.75, -0.59, 0.7, 0.7, 0.5);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    F.part(PETAL, i % 2 ? gold : shola, Math.cos(a) * 1.05, 2.75 + Math.sin(a) * 1.05, -0.62, 0.15, 0.2, 0.15, 0, 0, a - Math.PI / 2);
  }
  // ---- legs: right foot on the lion's back, left knee bent toward the asura
  const hipR: V = [-0.12, 1.72, -0.1], hipL: V = [0.12, 1.72, -0.1];
  // (tableau places her at scale 1.2, z −0.25: these land on the lion's back and the asura's thigh)
  const kneeR: V = [-0.44, 1.32, 0.28], footR: V = [-0.8, 0.95, 0.6];
  const kneeL: V = [0.5, 1.36, 0.45], footL: V = [0.64, 0.78, 0.84];
  F.limb(hipR, kneeR, 0.13, 0.085, red);
  F.limb(kneeR, footR, 0.085, 0.065, red); // the sari covers the legs to the ankle
  F.limb(hipL, kneeL, 0.13, 0.085, red);
  F.limb(kneeL, footL, 0.085, 0.065, red);
  for (const [k, f] of [[kneeR, footR], [kneeL, footL]] as const) F.part(TOR, gold, f[0] + (k[0] - f[0]) * 0.12, f[1] + (k[1] - f[1]) * 0.12, f[2] + (k[2] - f[2]) * 0.12, 0.07, 0.07, 0.07, Math.PI / 2 - 0.6, 0, 0); // woven border at the ankle
  foot(F, [footR[0] - 0.02, footR[1] - 0.04, footR[2] + 0.06], 0.05, skinC, -0.5);
  foot(F, [footL[0] + 0.03, footL[1] - 0.04, footL[2] + 0.06], 0.05, skinC, 0.6);
  // ---- sari: flared, folded skirt to the knees, gold-woven hem, front pleats falling between the legs
  F.part(folded([[0.001, 1.98], [0.23, 1.98], [0.28, 1.78], [0.4, 1.45], [0.5, 1.18], [0.001, 1.18]], 11, 0.09), red, 0, 0, -0.1, 1, 1, 0.78);
  F.part(folded([[0.492, 1.22], [0.508, 1.22], [0.512, 1.16], [0.5, 1.16]], 11, 0.09), gold, 0, 0, -0.1, 1, 1, 0.78);
  F.part(folded([[0.37, 1.53], [0.384, 1.53], [0.39, 1.48], [0.376, 1.48]], 11, 0.07), gold, 0, 0, -0.1, 1, 1, 0.78);
  for (let i = 0; i < 7; i++) {
    const u = (i - 3) / 3;
    F.part(BOX, i % 2 ? deep : red, u * 0.075, 1.38, 0.24 - Math.abs(u) * 0.02, 0.032, 0.95, 0.012, -0.12, 0, u * 0.12);
  }
  F.part(BOX, gold, 0, 0.92, 0.3, 0.26, 0.05, 0.02, -0.12, 0, 0);
  // ---- torso: waist, chest, red blouse with gold border, pallu across the chest
  F.part(lathe([[0.001, 1.92], [0.2, 1.92], [0.19, 2.02], [0.22, 2.18], [0.27, 2.33], [0.27, 2.42], [0.2, 2.52], [0.08, 2.58], [0.001, 2.58]]), skin, 0, 0, -0.12, 1, 1, 0.74);
  F.part(lathe([[0.001, 2.1], [0.228, 2.1], [0.276, 2.3], [0.278, 2.42], [0.21, 2.52], [0.085, 2.565], [0.001, 2.565]]), deep, 0, 0, -0.12, 1, 1, 0.76);
  F.part(TOR, gold, 0, 2.11, -0.12, 0.23, 0.23, 0.18, Math.PI / 2, 0, 0);
  F.tube([[-0.22, 1.9, 0.08], [-0.1, 2.08, 0.12], [0.05, 2.28, 0.12], [0.18, 2.45, 0.06], [0.26, 2.52, -0.08], [0.24, 2.4, -0.26]], 0.05, red);
  F.tube([[-0.22, 1.9, 0.11], [-0.1, 2.08, 0.15], [0.05, 2.28, 0.15], [0.18, 2.45, 0.09], [0.27, 2.53, -0.06]], 0.016, gold);
  // ---- jewellery: layered gold necklaces, a long red jaba garland
  for (const [r, y] of [[0.11, 2.53], [0.15, 2.47], [0.19, 2.39]] as const) F.part(TOR, gold, 0, y, -0.06, r, r, r * 0.75, Math.PI / 2 - 0.4, 0, 0);
  F.beads([[-0.22, 2.48, 0.0], [-0.2, 2.15, 0.16], [-0.1, 1.82, 0.26], [0, 1.72, 0.29], [0.1, 1.82, 0.26], [0.2, 2.15, 0.16], [0.22, 2.48, 0.0]], 34, 0.035, [mat(PAL.jaba), mat(PAL.jaba), mat(0x2f6b3a)]);
  // ---- neck & head
  F.limb([0, 2.52, -0.12], [0, 2.66, -0.1], 0.07, 0.065, skin);
  hair(F, 0, 2.86, -0.12, 1.55, 1.0, 1.25);
  face(F, 0, 2.86, -0.09, 1.55, skinC, { thirdEye: true, nath: true, chandan: true });
  crown(F, 0, 3.05, -0.12, 1.55, 1.35);
  // ---- arms
  const shR: V = [-0.27, 2.45, -0.14], shL: V = [0.27, 2.45, -0.14];
  for (const sh of [shR, shL]) F.part(SPH, skin, sh[0], sh[1], sh[2], 0.075, 0.07, 0.07);
  // front right: grips the trishul driven down into Mahishasura's chest
  const elR: V = [-0.42, 2.12, 0.02], haR: V = [-0.24, 1.98, 0.32];
  F.limb(shR, elR, 0.06, 0.05, skin);
  F.limb(elR, haR, 0.048, 0.034, skin);
  bangles(F, elR, haR, 0.034);
  hand(F, haR, 0.04, skin, -1, true);
  const butt = new V3(-0.62, 2.42, 0.1), tip = new V3(0.84, 1.34, 0.62);
  F.limb([butt.x, butt.y, butt.z], [tip.x, tip.y, tip.z], 0.016, 0.016, gold, false);
  const dir = tip.clone().sub(butt).normalize();
  const tq = new E().setFromQuaternion(new Q().setFromUnitVectors(new V3(0, 1, 0), dir));
  for (const off of [-0.07, 0, 0.07]) {
    const p = tip.clone().add(new V3(-dir.y, dir.x, 0).normalize().multiplyScalar(off));
    F.part(CONE, gold, p.x, p.y, p.z, 0.018, off ? 0.14 : 0.18, 0.018, tq.x, tq.y, tq.z);
  }
  F.part(BOX, gold, tip.x - dir.x * 0.03, tip.y - dir.y * 0.03, tip.z - dir.z * 0.03, 0.2, 0.025, 0.03, tq.x, tq.y, tq.z + Math.PI / 2);
  // front left: holds the serpent that coils down to bind the asura
  const elL: V = [0.48, 2.22, 0.04], haL: V = [0.66, 2.02, 0.32];
  F.limb(shL, elL, 0.06, 0.05, skin);
  F.limb(elL, haL, 0.048, 0.034, skin);
  bangles(F, elL, haL, 0.034);
  hand(F, haL, 0.04, skin, 1, true);
  F.tube([[0.66, 2.1, 0.32], [0.72, 1.98, 0.42], [0.85, 1.85, 0.5], [0.95, 1.72, 0.55], [1.02, 1.62, 0.5], [0.93, 1.56, 0.42], [0.86, 1.6, 0.56], [0.98, 1.55, 0.66]], 0.022, mat(0x2f7a3a), 60);
  F.part(SPH, mat(0x2f7a3a), 0.66, 2.16, 0.32, 0.035, 0.028, 0.05, 0.4, 0, 0); // hood
  // eight back arms fanned like a halo, four on each side, each hand bearing a weapon
  const backs: Record<number, string[]> = { [-1]: ['spear', 'arrow', 'chakra', 'sword'], 1: ['shield', 'bow', 'bell', 'axe'] };
  for (const sd of [-1, 1]) {
    const sh: V = [sd * 0.24, 2.44, -0.22];
    for (let k = 0; k < 4; k++) {
      const a = (-0.25 + k * 0.42) * 1; // upper-arm elevation: from just below horizontal to steeply up
      const zb = -0.24 - k * 0.04;
      const el: V = [sh[0] + sd * Math.cos(a) * 0.36, sh[1] + Math.sin(a) * 0.36, zb];
      const b = a + 0.55; // forearms bend upward
      const ha: V = [el[0] + sd * Math.cos(b) * 0.33, el[1] + Math.sin(b) * 0.33, zb + 0.02];
      F.limb(sh, el, 0.05, 0.04, skin);
      F.limb(el, ha, 0.04, 0.028, skin);
      F.part(TOR, gold, ...el, 0.045, 0.045, 0.045, Math.PI / 2, 0, sd * a); // bajuband
      bangles(F, el, ha, 0.028);
      hand(F, ha, 0.033, skin, sd, true);
      weapon(F, backs[sd][k], ha, 1.4, sd);
    }
  }
}

/** A standing goddess (Lakshmi, Saraswati) or Kartik, height ≈ 1.75·s, origin at the feet. */
function deity(
  F: Fig,
  s: number,
  o: { skin: number; sari: number; border: number; blouse: number; male?: boolean; right?: string; left?: string; mudra?: boolean; veena?: boolean },
) {
  const skin = mat(o.skin), sari = mat(o.sari), border = mat(o.border), blouse = mat(o.blouse), gold = mat(PAL.gold);
  // Kumartuli side deities are full-bodied with large round faces: widen everything by W
  const W = 1.3, HS = 1.2;
  // a round lotus pedestal with a gold rim
  F.part(lathe([[0.001, 0], [0.3, 0], [0.32, 0.03], [0.28, 0.07], [0.001, 0.07]], 24), mat(0xf08cb0), 0, -0.04 * s, 0.02 * s, s, s, s);
  F.part(TOR, gold, 0, 0.0, 0.02 * s, 0.31 * s, 0.31 * s, 0.31 * s, Math.PI / 2, 0, 0);
  // feet peeping out from under the hem, with alta
  for (const sd of [-1, 1]) foot(F, [sd * 0.07 * s, 0.03 * s, 0.13 * s], 0.045 * s, o.skin, sd * 0.15);
  if (o.male) {
    // dhoti: folds to mid-calf, shins and a gold-bordered kochi pleat in front
    F.part(folded([[0.001, 0.98], [0.15, 0.98], [0.2, 0.7], [0.23, 0.4], [0.001, 0.4]], 9, 0.07), sari, 0, 0, 0, s * W, s, s * 0.82 * W);
    for (const sd of [-1, 1]) F.limb([sd * 0.09 * s, 0.42 * s, 0], [sd * 0.08 * s, 0.06 * s, 0.05 * s], 0.065 * s, 0.045 * s, skin);
    F.part(BOX, border, 0, 0.62 * s, 0.17 * s, 0.07 * s, 0.6 * s, 0.012 * s, -0.08, 0, 0);
    F.part(TOR, gold, 0, 0.98 * s, 0, 0.152 * s * W, 0.152 * s * W, 0.125 * s * W, Math.PI / 2, 0, 0); // kamarbandh
    // bare chest with a sacred thread and an uttariya stole
    F.part(lathe([[0.001, 0.95], [0.15, 0.95], [0.155, 1.12], [0.19, 1.3], [0.16, 1.4], [0.06, 1.45], [0.001, 1.45]]), skin, 0, 0, 0, s * W, s, s * 0.78 * W);
    F.tube([[-0.13 * s, 0.98 * s, 0.1 * s], [0, 1.15 * s, 0.13 * s], [0.13 * s, 1.36 * s, 0.07 * s], [0.16 * s, 1.4 * s, -0.04 * s]], 0.004 * s, mat(PAL.shola), 16);
    F.tube([[0.2 * s, 1.36 * s, -0.08 * s], [0.12 * s, 1.38 * s, 0.11 * s], [-0.08 * s, 1.36 * s, 0.13 * s], [-0.2 * s, 1.3 * s, 0.02 * s], [-0.22 * s, 0.9 * s, 0.04 * s]], 0.022 * s, blouse);
  } else {
    // sari falling to the feet in soft folds, gold border at the hem and a pleated front panel
    F.part(folded([[0.001, 1.0], [0.15, 1.0], [0.17, 0.8], [0.2, 0.45], [0.24, 0.08], [0.001, 0.08]], 12, 0.06), sari, 0, 0, 0, s * W, s, s * 0.8 * W);
    F.part(folded([[0.236, 0.13], [0.245, 0.13], [0.248, 0.07], [0.238, 0.07]], 12, 0.06), border, 0, 0, 0, s * W, s, s * 0.8 * W);
    for (let i = 0; i < 6; i++) {
      const u = (i - 2.5) / 2.5;
      F.part(BOX, i % 2 ? border : sari, u * 0.075 * s, 0.5 * s, 0.24 * s, 0.025 * s, 0.85 * s, 0.01 * s, -0.1, 0, u * 0.08);
    }
    F.part(lathe([[0.001, 0.96], [0.15, 0.96], [0.14, 1.04], [0.001, 1.04]]), skin, 0, 0, 0, s * W, s, s * 0.78 * W); // midriff
    F.part(lathe([[0.001, 1.04], [0.14, 1.04], [0.17, 1.2], [0.17, 1.3], [0.12, 1.4], [0.05, 1.44], [0.001, 1.44]]), blouse, 0, 0, 0, s * W, s, s * 0.8 * W);
    F.tube([[-0.15 * s, 0.95 * s, 0.11 * s], [-0.03 * s, 1.1 * s, 0.14 * s], [0.08 * s, 1.27 * s, 0.13 * s], [0.16 * s, 1.4 * s, 0.03 * s], [0.17 * s, 1.36 * s, -0.12 * s], [0.16 * s, 0.9 * s, -0.16 * s]], 0.035 * s, sari);
    F.tube([[-0.15 * s, 0.95 * s, 0.135 * s], [-0.03 * s, 1.1 * s, 0.165 * s], [0.08 * s, 1.27 * s, 0.155 * s], [0.165 * s, 1.41 * s, 0.05 * s]], 0.011 * s, border);
  }
  // jewellery and garland
  for (const [r, y] of [[0.085, 1.42], [0.11, 1.37], [0.135, 1.3]] as const) F.part(TOR, gold, 0, y * s, 0.01 * s, r * s, r * s, r * 0.75 * s, Math.PI / 2 - 0.4, 0, 0);
  F.beads([[-0.15 * s, 1.38 * s, 0.03 * s], [-0.13 * s, 1.12 * s, 0.13 * s], [0, 0.95 * s, 0.17 * s], [0.13 * s, 1.12 * s, 0.13 * s], [0.15 * s, 1.38 * s, 0.03 * s]], 22, 0.022 * s, [mat(o.male ? 0xf6a21e : PAL.jaba), mat(PAL.shola)]);
  // neck, head, hair, crown
  F.limb([0, 1.42 * s, 0], [0, 1.52 * s, 0.005 * s], 0.06 * s, 0.055 * s, skin);
  hair(F, 0, 1.68 * s, 0, s * HS, o.male ? 0.35 * s : 0.8 * s, 1.15);
  face(F, 0, 1.68 * s, 0.02 * s, s * HS, o.skin, { nath: !o.male, chandan: true, teep: !o.male, moustache: o.male });
  crown(F, 0, 1.86 * s, 0, s * HS, 0.95);
  // arms
  for (const sd of [-1, 1]) {
    const sh: V = [sd * 0.21 * s, 1.36 * s, 0];
    F.part(SPH, o.male ? skin : blouse, sh[0], sh[1], sh[2], 0.065 * s, 0.062 * s, 0.065 * s);
    const item = sd < 0 ? o.right : o.left;
    let el: V, ha: V;
    if (o.veena) {
      el = [sd * 0.29 * s, 1.12 * s, 0.07 * s];
      ha = sd < 0 ? [-0.12 * s, 1.05 * s, 0.2 * s] : [0.12 * s, 1.28 * s, 0.2 * s];
    } else if (sd < 0 && o.mudra) {
      el = [-0.3 * s, 1.1 * s, 0.06 * s];
      ha = [-0.26 * s, 1.26 * s, 0.24 * s];
    } else {
      el = [sd * 0.28 * s, 1.1 * s, 0.05 * s];
      ha = [sd * 0.24 * s, 1.0 * s, 0.27 * s];
    }
    F.limb(sh, el, 0.055 * s, 0.046 * s, skin);
    F.limb(el, ha, 0.044 * s, 0.032 * s, skin);
    F.part(TOR, gold, ...el, 0.036 * s, 0.036 * s, 0.036 * s, Math.PI / 2, 0, 0);
    if (!o.male) bangles(F, el, ha, 0.025 * s);
    hand(F, ha, 0.032 * s, skin, sd, !!item || !!o.veena, sd < 0 && !!o.mudra && !item);
    if (item) weapon(F, item, ha, s, sd);
  }
  if (o.veena) {
    const wood = mat(0x8a4a22);
    F.limb([-0.3 * s, 0.98 * s, 0.24 * s], [0.32 * s, 1.42 * s, 0.22 * s], 0.022 * s, 0.018 * s, wood, false);
    F.part(SPH, wood, -0.32 * s, 0.95 * s, 0.24 * s, 0.13 * s, 0.13 * s, 0.11 * s);
    F.part(SPH, wood, 0.18 * s, 1.36 * s, 0.17 * s, 0.08 * s);
    F.part(CONE, wood, 0.36 * s, 1.47 * s, 0.22 * s, 0.03 * s, 0.1 * s, 0.03 * s, 0, 0, -0.9);
    for (let k = 0; k < 4; k++) F.limb([-0.26 * s, 1.02 * s + k * 0.008 * s, 0.26 * s], [0.3 * s, 1.43 * s + k * 0.008 * s, 0.24 * s], 0.002 * s, 0.002 * s, mat(0xe8dcc0), false);
  }
}

/** Ganesh: four arms, elephant head with a curled trunk and broad ears, pot belly, seated. */
function ganesh(F: Fig, s: number) {
  const skinC = 0xf6c2a8, skin = mat(skinC), dhoti = mat(0xf6a21e), gold = mat(PAL.gold);
  // seat (a lotus pedestal)
  F.part(CYL, mat(0xf08cb0), 0, 0.08 * s, 0, 0.36 * s, 0.16 * s, 0.32 * s);
  F.part(SPH, dhoti, 0, 0.3 * s, 0.04 * s, 0.32 * s, 0.2 * s, 0.28 * s); // folded legs
  for (const sd of [-1, 1]) foot(F, [sd * 0.18 * s, 0.25 * s, 0.25 * s], 0.05 * s, skinC, -sd * 1.2);
  F.part(SPH, skin, 0, 0.62 * s, 0.05 * s, 0.25 * s, 0.26 * s, 0.24 * s); // belly
  F.part(SPHL, mat(0xd8a090), 0, 0.6 * s, 0.28 * s, 0.025 * s, 0.025 * s, 0.01 * s); // navel
  F.part(SPH, skin, 0, 0.9 * s, 0, 0.17 * s, 0.13 * s, 0.13 * s); // chest
  F.tube([[-0.15 * s, 0.62 * s, 0.2 * s], [0, 0.82 * s, 0.17 * s], [0.12 * s, 1.0 * s, 0.07 * s]], 0.008 * s, mat(0xc0b8a0), 12); // snake sash (bhujanga)
  for (const [r, y] of [[0.1, 1.0], [0.13, 0.95]] as const) F.part(TOR, gold, 0, y * s, 0.04 * s, r * s, r * s, r * 0.8 * s, Math.PI / 2 - 0.4, 0, 0);
  F.beads([[-0.14 * s, 0.98 * s, 0.05 * s], [-0.18 * s, 0.7 * s, 0.22 * s], [0, 0.55 * s, 0.3 * s], [0.18 * s, 0.7 * s, 0.22 * s], [0.14 * s, 0.98 * s, 0.05 * s]], 22, 0.022 * s, [mat(0xf6a21e), mat(PAL.jaba)]);
  // head: dome, broad fan ears, small eyes, tusks, curling trunk
  F.part(SPH, skin, 0, 1.12 * s, 0.02 * s, 0.155 * s, 0.15 * s, 0.15 * s);
  F.part(SPH, skin, 0, 1.2 * s, -0.01 * s, 0.15 * s, 0.1 * s, 0.13 * s);
  for (const sd of [-1, 1]) {
    F.part(SPH, skin, sd * 0.19 * s, 1.1 * s, -0.04 * s, 0.13 * s, 0.15 * s, 0.025 * s, 0, sd * 0.35, 0);
    F.part(SPH, mat(0xf0a0a0), sd * 0.19 * s, 1.1 * s, -0.025 * s, 0.1 * s, 0.12 * s, 0.015 * s, 0, sd * 0.35, 0); // inner ear
    F.part(SPH, mat(0xfdfaf2), sd * 0.06 * s, 1.15 * s, 0.13 * s, 0.022 * s, 0.014 * s, 0.01 * s);
    F.part(SPHL, mat(PAL.black), sd * 0.058 * s, 1.15 * s, 0.14 * s, 0.01 * s);
    F.part(ARC, mat(PAL.black), sd * 0.06 * s, 1.15 * s, 0.135 * s, 0.024 * s, 0.014 * s, 0.02 * s);
    if (sd < 0) F.part(CONE, mat(PAL.shola), -0.06 * s, 1.0 * s, 0.15 * s, 0.017 * s, 0.09 * s, 0.017 * s, 0.7, 0, -0.3); // one tusk (the other broken, as in the legend)
    else F.part(CONE, mat(PAL.shola), 0.06 * s, 1.03 * s, 0.15 * s, 0.017 * s, 0.035 * s, 0.017 * s, 0.7, 0, 0.3);
  }
  F.part(SPH, mat(PAL.red), 0, 1.24 * s, 0.13 * s, 0.015 * s, 0.03 * s, 0.006 * s); // tilak
  F.tube([[0, 1.12 * s, 0.14 * s], [0, 0.98 * s, 0.2 * s], [0.02 * s, 0.84 * s, 0.22 * s], [0.08 * s, 0.76 * s, 0.22 * s], [0.13 * s, 0.8 * s, 0.2 * s], [0.12 * s, 0.86 * s, 0.18 * s]], 0.032 * s, skin, 30);
  crown(F, 0, 1.25 * s, 0, s * 0.9, 1.1);
  // four arms: lower right in abhaya, lower left with a bowl of laddoos, upper pair with axe and noose/lotus
  const arms: [V, V, V, string | null, boolean][] = [
    [[-0.16, 0.95, 0], [-0.3, 0.75, 0.1], [-0.27, 0.86, 0.22], null, true],
    [[0.16, 0.95, 0], [0.3, 0.72, 0.1], [0.24, 0.66, 0.26], null, false],
    [[-0.14, 1.0, -0.06], [-0.34, 1.08, -0.08], [-0.42, 1.3, -0.06], 'axe', false],
    [[0.14, 1.0, -0.06], [0.34, 1.08, -0.08], [0.42, 1.3, -0.06], 'lotus', false],
  ];
  for (const [sh, el, ha, item, mudra] of arms) {
    const S3 = (v: V) => v.map((c) => c * s) as V;
    F.limb(S3(sh), S3(el), 0.05 * s, 0.042 * s, skin);
    F.limb(S3(el), S3(ha), 0.042 * s, 0.032 * s, skin);
    F.part(TOR, gold, ...S3(el), 0.045 * s, 0.045 * s, 0.045 * s, Math.PI / 2, 0, 0);
    hand(F, S3(ha), 0.036 * s, skin, Math.sign(ha[0]), !!item, mudra);
    if (item) weapon(F, item, S3(ha), s, Math.sign(ha[0]));
  }
  F.part(BOWL_GEO, gold, 0.24 * s, 0.68 * s, 0.3 * s, 0.07 * s, 0.05 * s, 0.07 * s, Math.PI, 0, 0);
  for (let k = 0; k < 5; k++) F.part(SPHL, mat(0xf6b23a), 0.24 * s + Math.cos(k * 1.3) * 0.03 * s, 0.7 * s + (k === 4 ? 0.03 : 0) * s, 0.3 * s + Math.sin(k * 1.3) * 0.03 * s, 0.025 * s);
  // the mouse (mushika) nibbling a laddoo at his feet
  const mouse = mat(0x7a6a5e);
  F.part(SPH, mouse, 0.3 * s, 0.07 * s, 0.42 * s, 0.07 * s, 0.06 * s, 0.1 * s);
  F.part(SPH, mouse, 0.3 * s, 0.1 * s, 0.52 * s, 0.045 * s, 0.04 * s, 0.05 * s);
  for (const sd of [-1, 1]) F.part(SPH, mat(0xe8a0a0), 0.3 * s + sd * 0.03 * s, 0.14 * s, 0.5 * s, 0.022 * s, 0.022 * s, 0.006 * s);
  F.part(SPHL, mat(PAL.black), 0.3 * s, 0.1 * s, 0.57 * s, 0.01 * s);
  F.tube([[0.3 * s, 0.06 * s, 0.32 * s], [0.36 * s, 0.03 * s, 0.24 * s], [0.42 * s, 0.05 * s, 0.2 * s]], 0.006 * s, mouse, 8);
  F.part(SPHL, mat(0xf6b23a), 0.3 * s, 0.05 * s, 0.6 * s, 0.03 * s);
}
const BOWL_GEO = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);

/** Kola Bou: a banana plant draped as a bride in a red-bordered white sari, its leaves above. */
function kolaBou(F: Fig, s: number) {
  F.part(folded([[0.001, 0], [0.17, 0], [0.15, 0.4], [0.11, 0.9], [0.09, 1.0], [0.001, 1.0]], 8, 0.05), mat(0xfaf6ea), 0, 0, 0, s, s, s);
  F.part(lathe([[0.17, 0.0], [0.176, 0.0], [0.166, 0.09], [0.16, 0.09]]), mat(PAL.red), 0, 0, 0, s, s, s);
  F.tube([[-0.1 * s, 0.95 * s, 0.07 * s], [0, 0.98 * s, 0.1 * s], [0.08 * s, 0.85 * s, 0.11 * s], [0.12 * s, 0.4 * s, 0.13 * s]], 0.02 * s, mat(PAL.red)); // ghomta border
  F.part(SPH, mat(0xfaf6ea), 0, 1.0 * s, 0, 0.1 * s, 0.07 * s, 0.1 * s); // the veil over the top
  F.part(SPHL, mat(PAL.red), 0, 1.0 * s, 0.09 * s, 0.03 * s, 0.03 * s, 0.01 * s); // sindoor
  for (let i = 0; i < 7; i++) {
    const a = -1.0 + i * 0.33;
    F.part(PETAL, mat(i % 2 ? 0x3f8a46 : 0x4fa050), Math.sin(a) * 0.15 * s, 1.25 * s + Math.cos(a) * 0.15 * s, -0.02 * s, 0.28 * s, 0.45 * s, 0.28 * s, 0.15, 0, -a);
  }
}

/** Durga's lion: the Bengali horse-faced lion, pale gold with a cascading white mane, lunging. */
function lion(F: Fig) {
  const body = mat(0xf2d48a), mane = mat(0xfdf2d2), dark = mat(0xd8b060), blk = mat(PAL.black);
  // barrel body along +z (head end), deep chest, haunches
  F.part(SPH, body, 0, 0.66, -0.05, 0.27, 0.28, 0.58);
  F.part(SPH, body, 0, 0.72, 0.38, 0.29, 0.32, 0.3); // chest
  F.part(SPH, body, 0, 0.66, -0.45, 0.26, 0.29, 0.28); // haunch
  // legs: front pair braced forward, rear pair planted, each with a paw
  const legs: [V, V, V][] = [
    [[-0.17, 0.62, 0.42], [-0.19, 0.32, 0.62], [-0.19, 0.06, 0.72]],
    [[0.17, 0.62, 0.42], [0.2, 0.36, 0.56], [0.2, 0.06, 0.6]],
    [[-0.17, 0.6, -0.48], [-0.19, 0.32, -0.36], [-0.19, 0.06, -0.48]],
    [[0.17, 0.6, -0.48], [0.19, 0.32, -0.38], [0.19, 0.06, -0.5]],
  ];
  for (const [a, b, c] of legs) {
    F.limb(a, b, 0.11, 0.075, body);
    F.limb(b, c, 0.07, 0.06, body);
    F.part(SPH, body, c[0], c[1], c[2] + 0.04, 0.08, 0.06, 0.11);
    for (let k = -1; k <= 1; k++) F.part(CONE, mat(0xf4eedf), c[0] + k * 0.035, c[1] - 0.01, c[2] + 0.15, 0.01, 0.03, 0.01, Math.PI / 2, 0, 0);
  }
  // neck rising, long horse-like head with an open, roaring mouth
  F.limb([0, 0.85, 0.48], [0, 1.15, 0.68], 0.2, 0.15, body);
  F.part(SPH, body, 0, 1.2, 0.76, 0.15, 0.15, 0.17);
  F.part(SPH, body, 0, 1.12, 0.96, 0.1, 0.09, 0.16); // long muzzle
  F.part(SPH, mat(0x9a2a2a), 0, 1.04, 1.0, 0.085, 0.045, 0.12); // open mouth
  F.part(SPH, body, 0, 0.99, 0.96, 0.08, 0.035, 0.11); // lower jaw
  for (const sd of [-1, 1]) {
    F.part(CONE, mat(0xffffff), sd * 0.045, 1.04, 1.1, 0.012, 0.04, 0.012, Math.PI, 0, 0); // fangs
    F.part(SPH, mat(0xfdfaf2), sd * 0.085, 1.25, 0.86, 0.035, 0.025, 0.02, 0, sd * 0.5, 0);
    F.part(SPH, blk, sd * 0.09, 1.25, 0.875, 0.016, 0.018, 0.01, 0, sd * 0.5, 0);
    F.part(ARC, blk, sd * 0.088, 1.25, 0.87, 0.038, 0.028, 0.03, 0, sd * 0.5, 0);
    F.part(CONE, body, sd * 0.09, 1.36, 0.7, 0.04, 0.09, 0.03, -0.3, 0, -sd * 0.2); // ears
    F.part(SPHL, blk, sd * 0.035, 1.15, 1.11, 0.015, 0.012, 0.01); // nostrils
  }
  // mane: cascading white locks around head, neck and chest
  for (let ring = 0; ring < 3; ring++)
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + ring * 0.17;
      F.part(SPH, (i + ring) % 4 ? mane : dark, Math.cos(a) * (0.17 + ring * 0.06), 1.1 + Math.sin(a) * (0.2 + ring * 0.06), 0.66 - ring * 0.08, 0.075, 0.16, 0.08, 0, 0, a);
    }
  for (let i = 0; i < 8; i++) F.part(SPH, mane, Math.sin(i * 1.7) * 0.12, 0.95 - i * 0.04, 0.58 + i * 0.01, 0.07, 0.12, 0.06);
  // tail curling up with a tuft
  F.tube([[0, 0.78, -0.68], [0.08, 0.92, -0.88], [0.2, 1.1, -0.86], [0.25, 1.25, -0.7]], 0.03, body);
  F.part(SPH, mane, 0.25, 1.3, -0.66, 0.07, 0.1, 0.07);
}

/** Mahishasura: green, muscular, half-kneeling, sword raised, shield up, rising from the slain buffalo. */
function mahishasura(F: Fig) {
  const skinC = 0x4f8a4a, skin = mat(skinC), dhoti = mat(0xa83a22), buff = mat(0x2a2628), horn = mat(0xe8dcc0), gold = mat(PAL.gold), steel = mat(0xd6dde2);
  // the slain buffalo: body lying behind him, head on the ground with great swept horns
  F.part(SPH, buff, 0.05, 0.22, -0.35, 0.36, 0.22, 0.5);
  F.part(SPH, buff, 0.35, 0.2, 0.15, 0.17, 0.15, 0.22, 0, 0.6, 0.3);
  F.part(SPH, mat(0x3a3436), 0.47, 0.15, 0.3, 0.09, 0.07, 0.1, 0, 0.6, 0); // muzzle
  for (const sd of [-1, 1])
    F.part(new THREE.TorusGeometry(1, 0.2, 6, 14, Math.PI * 0.75), horn, 0.35 + sd * 0.12, 0.33, 0.1, 0.15, 0.13, 0.15, 0, 0.6, sd > 0 ? 0.2 : Math.PI - 0.2);
  F.part(SPH, mat(0x8a1010), 0.08, 0.36, 0.0, 0.16, 0.06, 0.14); // the severed neck from which he rises
  // legs: right knee down on the buffalo, left foot forward
  F.limb([-0.1, 0.62, 0.0], [-0.18, 0.32, 0.25], 0.13, 0.095, skin);
  F.limb([-0.18, 0.32, 0.25], [-0.2, 0.08, 0.0], 0.09, 0.06, skin);
  F.limb([0.12, 0.62, 0.0], [0.28, 0.5, 0.3], 0.13, 0.095, skin);
  F.limb([0.28, 0.5, 0.3], [0.3, 0.06, 0.38], 0.09, 0.06, skin);
  F.part(SPH, skin, 0.29, 0.3, 0.36, 0.075, 0.12, 0.07); // calf
  F.part(SPH, skin, 0.3, 0.04, 0.45, 0.06, 0.04, 0.1);
  F.part(folded([[0.001, 0.72], [0.18, 0.72], [0.22, 0.55], [0.001, 0.55]], 8, 0.08), dhoti, 0, 0, 0, 1, 1, 0.85);
  F.part(TOR, gold, 0, 0.71, 0, 0.18, 0.18, 0.15, Math.PI / 2, 0, 0);
  // torso: leaning back, broad shoulders, pecs and abdominals
  F.part(lathe([[0.001, 0.68], [0.16, 0.68], [0.17, 0.82], [0.24, 1.0], [0.27, 1.08], [0.17, 1.15], [0.001, 1.17]]), skin, 0, 0, -0.04, 1, 1, 0.7, -0.15, 0, 0);
  for (const sd of [-1, 1]) {
    F.part(SPH, skin, sd * 0.09, 1.0, 0.1, 0.1, 0.07, 0.06, -0.15); // pecs
    F.part(SPH, skin, sd * 0.27, 1.06, -0.05, 0.1, 0.09, 0.09); // deltoids
    for (let k = 0; k < 3; k++) F.part(SPH, mat(0x467d42), sd * 0.04, 0.8 + k * 0.06, 0.13 - k * 0.01, 0.035, 0.025, 0.02);
  }
  F.part(TOR, gold, 0, 1.08, 0.0, 0.11, 0.11, 0.09, Math.PI / 2 - 0.5, 0, 0);
  F.limb([0, 1.12, -0.04], [0, 1.22, -0.03], 0.07, 0.065, skin);
  // head: fierce, moustached, curly hair, small horns
  face(F, 0, 1.35, -0.02, 1.15, skinC, { moustache: true, fierce: true });
  F.part(SPH, mat(PAL.black), 0, 1.44, -0.06, 0.15, 0.12, 0.14);
  for (let k = 0; k < 9; k++) F.part(SPHL, mat(PAL.black), Math.cos(k * 0.7) * 0.15, 1.3 + Math.sin(k * 0.7) * 0.12, -0.1, 0.05);
  for (const sd of [-1, 1]) F.part(CONE, horn, sd * 0.09, 1.55, -0.03, 0.025, 0.09, 0.025, 0, 0, -sd * 0.5);
  // right arm (his right, −x) raises the sword high; left arm (+x) thrusts the shield toward the lion
  F.limb([-0.27, 1.06, -0.05], [-0.42, 1.28, 0.0], 0.075, 0.06, skin);
  F.limb([-0.42, 1.28, 0.0], [-0.36, 1.55, 0.06], 0.06, 0.045, skin);
  hand(F, [-0.36, 1.57, 0.06], 0.045, skin, -1, true);
  F.part(BOX, gold, -0.36, 1.62, 0.06, 0.12, 0.02, 0.025);
  F.part(BOX, steel, -0.33, 1.95, 0.06, 0.06, 0.62, 0.01, 0, 0, -0.1);
  F.limb([0.27, 1.06, -0.05], [0.42, 0.95, 0.15], 0.075, 0.06, skin);
  F.limb([0.42, 0.95, 0.15], [0.5, 1.05, 0.38], 0.06, 0.045, skin);
  F.part(CYL, mat(0x6b3a22), 0.52, 1.07, 0.44, 0.17, 0.03, 0.17, Math.PI / 2 - 0.3, 0.5, 0);
  F.part(TOR, gold, 0.52, 1.07, 0.46, 0.13, 0.13, 0.13, -0.3, 0.5, 0);
  for (let k = 0; k < 4; k++) F.part(CONE, gold, 0.52 + Math.cos(k * 1.57) * 0.08, 1.07 + Math.sin(k * 1.57) * 0.08, 0.47, 0.015, 0.03, 0.015, Math.PI / 2, 0, 0);
  // the trishul's wound
  F.part(SPH, mat(0xa0101a), 0.02, 0.98, 0.14, 0.05, 0.05, 0.02);
}

function peacock(F: Fig, x: number, z: number, s: number) {
  const blue = mat(0x1a5fb4);
  F.part(SPH, blue, x, 0.3 * s, z, 0.1 * s, 0.12 * s, 0.16 * s);
  F.limb([x, 0.38 * s, z + 0.1 * s], [x, 0.55 * s, z + 0.16 * s], 0.035 * s, 0.025 * s, blue);
  F.part(SPH, blue, x, 0.58 * s, z + 0.17 * s, 0.04 * s);
  F.part(CONE, mat(0xd9b240), x, 0.57 * s, z + 0.22 * s, 0.01 * s, 0.04 * s, 0.01 * s, Math.PI / 2, 0, 0);
  for (let k = -1; k <= 1; k++) F.part(SPHL, blue, x + k * 0.015 * s, 0.66 * s, z + 0.16 * s, 0.006 * s, 0.03 * s, 0.006 * s); // crest
  for (let i = 0; i < 13; i++) {
    const a = -1.3 + (i / 12) * 2.6;
    F.part(PETAL, mat(i % 2 ? 0x2f8a7a : 0x3fae5a), x + Math.sin(a) * 0.28 * s, 0.4 * s + Math.cos(a) * 0.28 * s, z - 0.12 * s, 0.14 * s, 0.32 * s, 0.14 * s, 0, 0, -a);
    F.part(SPHL, mat(0x1a3a8a), x + Math.sin(a) * 0.5 * s, 0.4 * s + Math.cos(a) * 0.5 * s, z - 0.11 * s, 0.03 * s, 0.03 * s, 0.01 * s);
    F.part(SPHL, mat(0xd9b240), x + Math.sin(a) * 0.5 * s, 0.4 * s + Math.cos(a) * 0.5 * s, z - 0.105 * s, 0.014 * s, 0.014 * s, 0.006 * s);
  }
  for (const sd of [-1, 1]) F.limb([x + sd * 0.04 * s, 0.22 * s, z], [x + sd * 0.04 * s, 0.0, z + 0.03 * s], 0.012 * s, 0.01 * s, mat(0x8a7a5a));
}
function swan(F: Fig, x: number, z: number, s: number) {
  const w = mat(0xfdfaf2);
  F.part(SPH, w, x, 0.16 * s, z, 0.12 * s, 0.1 * s, 0.2 * s);
  F.tube([[x, 0.2 * s, z + 0.14 * s], [x, 0.34 * s, z + 0.12 * s], [x, 0.42 * s, z + 0.18 * s]], 0.028 * s, w, 12);
  F.part(SPH, w, x, 0.44 * s, z + 0.2 * s, 0.04 * s);
  F.part(CONE, mat(0xf6a21e), x, 0.43 * s, z + 0.26 * s, 0.015 * s, 0.05 * s, 0.015 * s, Math.PI / 2, 0, 0);
  for (const sd of [-1, 1]) F.part(SPH, w, x + sd * 0.1 * s, 0.2 * s, z - 0.03 * s, 0.03 * s, 0.07 * s, 0.15 * s, 0.3, 0, sd * 0.4);
}
function owl(F: Fig, x: number, z: number, s: number) {
  const b = mat(0xd9b88a);
  F.part(SPH, b, x, 0.16 * s, z, 0.1 * s, 0.14 * s, 0.09 * s);
  F.part(SPH, mat(0xf4e8d0), x, 0.14 * s, z + 0.05 * s, 0.07 * s, 0.1 * s, 0.05 * s);
  F.part(SPH, b, x, 0.32 * s, z, 0.085 * s);
  for (const sd of [-1, 1]) {
    F.part(SPHL, mat(0xffffff), x + sd * 0.035 * s, 0.33 * s, z + 0.07 * s, 0.028 * s, 0.028 * s, 0.01 * s);
    F.part(SPHL, mat(0xf6a21e), x + sd * 0.035 * s, 0.33 * s, z + 0.078 * s, 0.016 * s, 0.016 * s, 0.006 * s);
    F.part(SPHL, mat(PAL.black), x + sd * 0.035 * s, 0.33 * s, z + 0.082 * s, 0.008 * s, 0.008 * s, 0.004 * s);
    F.part(CONE, b, x + sd * 0.05 * s, 0.41 * s, z, 0.02 * s, 0.05 * s, 0.02 * s, 0, 0, -sd * 0.3);
  }
}

// ---------------------------------------------------------------- the tableau

/** Alada chala: each deity (or pair) framed by its own small arch instead of one shared frame. */
function separateFrames(L: Local, cx: number, cz: number, y0: number, S: number, panel: THREE.Material, rim: THREE.Material) {
  const frames: [number, number, number][] = [[-3.5, 1.15, 2.6], [-2.15, 0.62, 3.0], [0, 1.7, 4.4], [2.15, 0.62, 3.0], [3.3, 0.62, 3.0]];
  for (const [x, r, h] of frames) {
    L.put(BOX, panel, cx + x * S, y0 + (0.95 + (h - r) / 2) * S, cz - 1.5 * S, r * 2 * S, (h - r) * S, 0.1 * S, 0, 0, 0, false);
    L.put(CYL, panel, cx + x * S, y0 + (0.95 + h - r) * S, cz - 1.5 * S, r * S, 0.1 * S, r * S, Math.PI / 2, 0, 0, false);
    L.put(new THREE.TorusGeometry(1, 0.04, 6, 36, Math.PI), rim, cx + x * S, y0 + (0.95 + h - r) * S, cz - 1.44 * S, r * S, r * S, 2 * S, 0, 0, 0, false);
    for (const sd of [-1, 1]) L.put(CYL, rim, cx + (x + sd * r) * S, y0 + (0.95 + (h - r) / 2) * S, cz - 1.44 * S, 0.05 * S, (h - r) * S, 0.05 * S, 0, 0, 0, false);
    for (let i = 0; i < 13; i++) {
      const a = Math.PI * (i / 12);
      L.put(PETAL, mat(i % 2 ? PAL.shola : PAL.gold), cx + (x + Math.cos(a) * (r + 0.1)) * S, y0 + (0.95 + h - r + Math.sin(a) * (r + 0.1)) * S, cz - 1.42 * S, 0.1 * S, 0.15 * S, 0.1 * S, 0, 0, a - Math.PI / 2, false);
    }
  }
}

/**
 * The complete tableau. `cx, cz` = centre of the bedi in pandal-local coords; `y0` = floor level
 * under the bedi; `S` = overall scale.
 */
export function protima(L: Local, cx: number, cz: number, S = 1, opts: { y0?: number; panel?: number; chalchitra?: number; style?: IdolStyle } = {}) {
  STYLE = opts.style ?? 'sabeki';
  const y0 = opts.y0 ?? 0;
  const red = mat(0xb3121f), gold = mat(PAL.gold);
  const put = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0) =>
    L.put(g, m, cx + x * S, y0 + y * S, cz + z * S, sx * S, sy * S, sz * S, rx, 0, 0);
  // bedi: a white platform draped in red with a gold edge and a band of painted alpana
  put(BOX, mat(0xefe6d2), 0, 0.45, 0, 8.2, 0.9, 3.6);
  put(BOX, red, 0, 0.92, 0.05, 8.3, 0.06, 3.5);
  put(BOX, gold, 0, 0.88, 1.82, 8.3, 0.06, 0.04);
  put(BOX, red, 0, 0.6, 1.81, 8.2, 0.3, 0.02);
  for (let i = 0; i < 32; i++) put(SPHL, mat(i % 2 ? PAL.shola : 0xf6a21e), -4.0 + i * 0.258, 0.6, 1.83, 0.07, 0.07, 0.03);
  if (STYLE === 'pastel') separateFrames(L, cx, cz, y0, S, mat(opts.panel ?? 0x1f4f5a), mat(opts.chalchitra ?? PAL.gold));
  else {
  // chalchitra: the painted arch behind all the deities, with sholapith filigree
  const panel = mat(opts.panel ?? 0x1f4f5a), rim = mat(opts.chalchitra ?? PAL.gold);
  put(BOX, panel, 0, 2.6, -1.6, 7.8, 3.4, 0.12);
  put(CYL, panel, 0, 4.3, -1.6, 3.9, 0.12, 2.0, Math.PI / 2);
  put(new THREE.TorusGeometry(1, 0.035, 6, 48, Math.PI), rim, 0, 4.3, -1.52, 3.95, 2.05, 3);
  put(new THREE.TorusGeometry(1, 0.025, 6, 48, Math.PI), mat(PAL.shola), 0, 4.3, -1.5, 3.65, 1.8, 3);
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * (0.06 + (i / 10) * 0.88);
    L.put(CYL, mat(i % 2 ? 0x2f6b4e : 0xb3121f), cx + Math.cos(a) * 3.3 * S, y0 + (4.3 + Math.sin(a) * 1.55) * S, cz - 1.53 * S, 0.34 * S, 0.03 * S, 0.34 * S, Math.PI / 2, 0, 0, false);
    L.put(SPHL, mat(PAL.shola), cx + Math.cos(a) * 3.3 * S, y0 + (4.3 + Math.sin(a) * 1.55) * S, cz - 1.5 * S, 0.08 * S, 0.08 * S, 0.02 * S, 0, 0, 0, false);
  }
  for (let i = 0; i < 37; i++) {
    const a = Math.PI * (i / 36);
    L.put(PETAL, mat(i % 2 ? PAL.shola : PAL.gold), cx + Math.cos(a) * 4.02 * S, y0 + (4.3 + Math.sin(a) * 2.1) * S, cz - 1.48 * S, 0.14 * S, 0.2 * S, 0.14 * S, 0, 0, a - Math.PI / 2, false);
  }
  }
  const top = y0 + 0.95 * S;
  const fig = (x: number, z: number, s: number, ry = 0) => new Fig(L, cx + x * S, top, cz + z * S, s * S, ry);
  durga(fig(0, -0.25, 1.2));
  lion(fig(-1.05, 0.5, 1.15, 1.05));
  mahishasura(fig(1.12, 0.6, 1.3, -0.55));
  // Lakshmi (inner left) · Ganesh · Kola Bou (outer left)
  const lak = fig(-2.15, -0.35, 1.25);
  deity(lak, 1, { skin: 0xf8cdb0, sari: 0xd94f7a, border: PAL.gold, blouse: 0x8a1040, right: 'lotus', mudra: false, left: 'conch' });
  owl(fig(-2.15, -0.35, 1.25), -0.32, 0.3, 1);
  ganesh(fig(-3.2, -0.25, 1.15), 1);
  kolaBou(fig(-3.85, -0.6, 1.25), 1);
  // Saraswati (inner right) with veena and swan · Kartik (outer right) with peacock
  const sar = fig(2.15, -0.35, 1.25);
  deity(sar, 1, { skin: 0xfbe8dc, sari: 0xfdfaf2, border: PAL.gold, blouse: 0xe8c040, veena: true });
  swan(fig(2.15, -0.35, 1.25), 0.32, 0.3, 1);
  const kar = fig(3.3, -0.3, 1.25);
  deity(kar, 1, { skin: 0xf2c890, sari: 0xf6a21e, border: PAL.gold, blouse: 0x2f6b4e, male: true, right: 'arrow', left: 'bow' });
  peacock(fig(3.3, -0.3, 1.25), 0.42, -0.05, 1);
  // offerings: brass pradip lamps, the ghot (pot) with mango leaves and a green coconut,
  // marigold heaps and plates of fruit
  const brass = mat(0xc89a3a);
  for (let i = -3; i <= 3; i++) {
    const x = i * 1.0 + 0.45;
    if (i % 2 === 0) {
      put(CYL, brass, x, 0.98, 1.5, 0.12, 0.03, 0.12);
      put(CYL, brass, x, 1.08, 1.5, 0.025, 0.2, 0.025);
      put(lathe([[0.001, 0], [0.06, 0], [0.07, 0.03], [0.001, 0.03]]), brass, x, 1.18, 1.5, 1, 1, 1);
      L.put(SPHL, glow(0xffb33c, 3), cx + x * S, y0 + 1.25 * S, cz + 1.5 * S, 0.025 * S, 0.05 * S, 0.025 * S, 0, 0, 0, false);
    } else {
      // marigold heap: many small flowers
      for (let k = 0; k < 14; k++) {
        const a = k * 2.4, r = Math.sqrt(k / 14) * 0.17;
        put(SPHL, mat(k % 3 ? 0xf6a21e : 0xffc93c), x - 0.45 + Math.cos(a) * r, 0.98 + (0.17 - r) * 0.5, 1.45 + Math.sin(a) * r * 0.7, 0.05, 0.04, 0.05);
      }
    }
  }
  for (const px of [-1.6, 1.6]) {
    put(CYL, brass, px, 0.97, 1.2, 0.3, 0.02, 0.3);
    for (let k = 0; k < 5; k++) put(SPH, mat([0xf2d03a, 0xd8382a, 0x7ab04a, 0xf6a21e, 0xd8382a][k]), px + Math.cos(k * 1.25) * 0.12, 1.02, 1.2 + Math.sin(k * 1.25) * 0.1, 0.06, 0.05, 0.06);
  }
  put(SPH, mat(0xb5562f), 0, 1.12, 1.15, 0.2, 0.2, 0.2);
  put(TOR, mat(PAL.shola), 0, 1.15, 1.15, 0.2, 0.2, 0.2, Math.PI / 2);
  put(SPH, mat(PAL.red), 0, 1.13, 1.35, 0.06, 0.06, 0.015); // sindoor swastika mark
  for (let i = 0; i < 5; i++) L.put(PETAL, mat(0x2f6b3a), cx + (i - 2) * 0.06 * S, y0 + 1.42 * S, cz + 1.15 * S, 0.12 * S, 0.22 * S, 0.12 * S, 0, 0, (i - 2) * 0.35, false);
  put(SPH, mat(0x5a8a3a), 0, 1.5, 1.15, 0.11, 0.12, 0.11);
}
