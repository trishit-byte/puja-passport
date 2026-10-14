/**
 * Kolkata street-food stalls, modelled on how the real ones are set up:
 *  • fuchka — a dome of golden fuchkas heaped in a wide cloth-lined basket on a cross-legged
 *    stand; a big aluminium handi of tetul-jol (tamarind water) with a red cloth tied at its neck
 *    and a smaller pot of sweet water; a bowl of potato mash flecked with coriander and chilli;
 *    gondhoraj limes, chopped onion and green chillies; stacks of sal-leaf bowls; a bare bulb
 *  • chowmein — a wheeled thela: an open iron wok of noodles over a roaring blue gas ring with the
 *    khunti (spatula) in it, the red LPG cylinder underneath, a glass case of boiled noodles,
 *    shredded cabbage, carrot, capsicum and eggs, soy / chilli / ketchup / vinegar bottles, paper plates
 *  • kathi roll — a counter with a big black tawa (paratha frying with egg), a glass case of red
 *    kebab skewers on sticks, egg trays, dough balls and a rolling pin, bowls of onion, cucumber,
 *    chilli and lemon, rolls wrapped in paper
 *  • jhalmuri — tins on a folding stand: open tins of puffed rice, chanachur, boiled chana, onion,
 *    coconut slices, a mustard-oil bottle, the big mixing can with its spoon, newspaper cones
 *  • cha — a clay unun glowing under a blackened kettle and a dekchi of tea, stacks of clay bhNar
 *  • mishti — a glass-fronted counter of roshogolla, sondesh, chomchom, langcha and mishti doi,
 *    a brass pan balance
 * Each returns where the vendor stands (behind) and where customers queue (in front), local +z
 * being the side facing the street.
 */
import * as THREE from 'three';
import type { Batcher } from '../Batcher';
import { toon, glow, bend } from '../../rendering/materials';
import { foodSignGeometry, foodSignMaterial, type FoodSign } from './signs';
import type { BulbSystem } from './street';

export type StallKind = 'phuchka' | 'chowmein' | 'roll' | 'cha' | 'jhalmuri' | 'mishti';

const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const CYL8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const TUBE = new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1, true); // open-ended: tins, pots, case walls
const SPH = new THREE.SphereGeometry(0.5, 14, 10);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CONE = new THREE.ConeGeometry(0.5, 1, 10);
const TOR = new THREE.TorusGeometry(0.5, 0.06, 6, 20);
const BOWL = new THREE.SphereGeometry(0.5, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); // open bowl, rim up
const DOME = new THREE.SphereGeometry(0.5, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2); // upper hemisphere
const CUP = new THREE.CylinderGeometry(0.5, 0.36, 1, 10); // a clay bhNar / sal-leaf bowl shape
const WHEEL = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
WHEEL.rotateZ(Math.PI / 2);
const CAP = new THREE.CapsuleGeometry(0.5, 1, 3, 8);

let glassMat: THREE.Material | null = null;
/** Faint see-through glass for display cases (its own batch, drawn after the opaque city). */
function glass() {
  if (!glassMat) glassMat = bend(new THREE.MeshBasicMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.14, depthWrite: false }));
  return glassMat;
}

/** Small deterministic jitter so heaps look piled rather than gridded. */
const jit = (i: number, k: number) => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

export function buildStall(b: Batcher, kind: StallKind, x: number, z: number, yaw: number, bulbs: BulbSystem) {
  const base = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
  const P = (g: THREE.BufferGeometry, m: THREE.Material, px: number, py: number, pz: number, sx: number, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0, shadow = true) =>
    b.add(g, m, new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)).premultiply(base), { shadow });
  const T = (c: number) => toon(c, { paint: false });
  const steel = T(0xc8ced2), alu = T(0xa9b0b5), wood = toon(0x7a4a2a), bamboo = toon(0xb08a4a), iron = T(0x26221f);
  const sign = (kind: FoodSign | 'phuchka', w: number, y: number, zz: number) => {
    if (kind === 'phuchka') kind = 'fuchka';
    b.add(foodSignGeometry(w), foodSignMaterial(kind), new THREE.Matrix4().makeTranslation(0, y, zz).premultiply(base), { shadow: false });
    P(BOX, toon(0x2a1a10), 0, y, zz - 0.03, w + 0.1, w * 0.656 + 0.1, 0.04, 0, 0, 0, false);
  };
  /** A bottle: body, shoulder, neck and cap. */
  const bottle = (bx: number, by: number, bz: number, body: number, cap: number, h = 0.26, r = 0.055) => {
    P(CYL, T(body), bx, by + h * 0.35, bz, r * 2, h * 0.7, r * 2);
    P(CONE, T(body), bx, by + h * 0.78, bz, r * 2, h * 0.18, r * 2, 0, 0, 0, false);
    P(CYL, T(cap), bx, by + h * 0.93, bz, r * 0.8, h * 0.12, r * 0.8, 0, 0, 0, false);
  };
  /** A glass display case: thin frame at the edges, faint glass panes, a solid floor. */
  const glassCase = (cx: number, cy: number, cz: number, w: number, h: number, d: number, frame: THREE.Material) => {
    P(BOX, frame, cx, cy + 0.01, cz, w + 0.04, 0.02, d + 0.04); // floor
    for (const sz of [-1, 1]) P(BOX, frame, cx, cy + h, cz + (sz * d) / 2, w + 0.04, 0.025, 0.03, 0, 0, 0, false); // top rim
    for (const sx of [-1, 1]) P(BOX, frame, cx + (sx * w) / 2, cy + h, cz, 0.03, 0.025, d + 0.04, 0, 0, 0, false);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(BOX, frame, cx + (sx * w) / 2, cy + h / 2, cz + (sz * d) / 2, 0.025, h, 0.025, 0, 0, 0, false);
    for (const sz of [-1, 1]) P(BOX, frame, cx, cy + h - 0.01, cz + (sz * d) / 2, w, 0.02, 0.02, 0, 0, 0, false);
    const gm = glass();
    P(BOX, gm, cx, cy + h / 2, cz + d / 2, w, h, 0.004, 0, 0, 0, false);
    P(BOX, gm, cx, cy + h / 2, cz - d / 2, w, h, 0.004, 0, 0, 0, false);
    for (const sx of [-1, 1]) P(BOX, gm, cx + (sx * w) / 2, cy + h / 2, cz, 0.004, h, d, 0, 0, 0, false);
    P(BOX, gm, cx, cy + h, cz, w, 0.004, d, 0, 0, 0, false);
  };
  /**
   * A heap of small items (fuchkas, puffed rice, sweets): a solid dome in the base colour so no
   * gaps show, with n items scattered over its surface in a few shades.
   */
  const heap = (cx: number, cy: number, cz: number, R: number, H: number, n: number, colors: number[], size: [number, number, number], fill?: number) => {
    if (fill !== undefined) P(DOME, T(fill), cx, cy, cz, R * 1.9, H * 1.8, R * 1.9, 0, 0, 0, false);
    for (let i = 0; i < n; i++) {
      const rr = R * Math.sqrt((i + 0.5) / n), a = i * 2.39996;
      const y = H * (1 - (rr / R) ** 2) * (0.92 + jit(i, 1) * 0.1);
      P(SPH, T(colors[i % colors.length]), cx + Math.cos(a) * rr, cy + y, cz + Math.sin(a) * rr, size[0], size[1], size[2], jit(i, 2) * 2, jit(i, 3) * 3, 0, false);
    }
  };

  if (kind === 'phuchka') {
    // the cross-legged folding stand (two pairs of crossed legs) carrying the basket
    for (const sz of [-0.22, 0.22])
      for (const lean of [-1, 1]) P(CYL8, bamboo, 0, 0.44, sz, 0.045, 1.0, 0.045, 0, 0, lean * 0.48);
    P(CYL8, bamboo, 0, 0.44, 0, 0.04, 0.5, 0.04, Math.PI / 2, 0, 0); // the pivot rod
    // a wide, shallow basket lined with red cloth that drapes over the rim
    const by = 0.86;
    P(TUBE, toon(0xa8823c, { paint: false, side: THREE.DoubleSide }), 0, by + 0.08, 0, 1.08, 0.16, 1.08);
    P(CYL, toon(0xa8823c), 0, by, 0, 1.06, 0.02, 1.06);
    P(TOR, toon(0x8a6a2a), 0, by + 0.16, 0, 1.08, 1.08, 1.08, Math.PI / 2);
    P(new THREE.CylinderGeometry(0.5, 0.56, 1, 24, 1, true), toon(0xb3121f, { paint: false, side: THREE.DoubleSide }), 0, by + 0.1, 0, 1.12, 0.14, 1.12); // cloth skirt over the rim
    // the dome of fuchkas: round, golden, hollow puris piled high
    heap(0, by + 0.14, 0, 0.44, 0.36, 140, [0xe9b964, 0xd9a24e, 0xf0c878, 0xe2ad58], [0.085, 0.07, 0.085], 0xd9a24e);
    // a big aluminium handi of tetul-jol on a low stool at the vendor's right, a red cloth tied
    // round its neck; a smaller pot of sweet water beside it
    P(BOX, wood, 0.98, 0.25, -0.15, 0.5, 0.5, 0.5);
    P(SPH, alu, 0.98, 0.72, -0.15, 0.56, 0.5, 0.56);
    P(TUBE, alu, 0.98, 0.98, -0.15, 0.34, 0.12, 0.34);
    P(TOR, alu, 0.98, 1.04, -0.15, 0.36, 0.36, 0.5, Math.PI / 2, 0, 0, false);
    P(TOR, T(0xc81e2a), 0.98, 0.92, -0.15, 0.4, 0.4, 0.9, Math.PI / 2); // the wet red cloth
    P(CYL, T(0x4a2410), 0.98, 1.0, -0.15, 0.32, 0.02, 0.32, 0, 0, 0, false); // dark tamarind water
    P(SPH, steel, 1.0, 0.62, 0.32, 0.34, 0.3, 0.34); // sweet-water pot
    P(CYL, T(0x8a5a2a), 1.0, 0.76, 0.32, 0.2, 0.015, 0.2, 0, 0, 0, false);
    P(BOX, wood, 1.0, 0.2, 0.32, 0.36, 0.4, 0.36);
    // potato mash in a wide aluminium bowl on the left stool, flecked with coriander and chilli;
    // little bowls of chopped onion and green chillies, and halved gondhoraj limes
    P(BOX, wood, -0.98, 0.3, -0.1, 0.62, 0.6, 0.55);
    P(BOWL, alu, -0.98, 0.78, -0.1, 0.5, 0.36, 0.5);
    P(DOME, T(0xd8b25a), -0.98, 0.72, -0.1, 0.42, 0.22, 0.42, 0, 0, 0, false);
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4, r = 0.04 + jit(i, 5) * 0.14;
      P(SPH, T(i % 3 ? 0x3e8a2c : 0xc8281e), -0.98 + Math.cos(a) * r, 0.81 + (0.18 - r) * 0.35, -0.1 + Math.sin(a) * r, 0.025, 0.012, 0.025, 0, 0, 0, false);
    }
    P(BOWL, steel, -0.82, 0.66, 0.22, 0.2, 0.1, 0.2);
    P(DOME, T(0xe8c8d8), -0.82, 0.62, 0.22, 0.17, 0.06, 0.17, 0, 0, 0, false); // onion
    P(BOWL, steel, -1.14, 0.66, 0.22, 0.2, 0.1, 0.2);
    for (let i = 0; i < 6; i++) P(CAP, T(0x3a8a2a), -1.14 + (jit(i, 7) - 0.5) * 0.1, 0.65, 0.22 + (jit(i, 8) - 0.5) * 0.1, 0.018, 0.05, 0.018, Math.PI / 2, jit(i, 9) * 3, 0, false); // green chillies
    for (let i = 0; i < 4; i++) P(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), T(0x9ac040), -1.2 + i * 0.07, 0.6, -0.32, 0.06, 0.05, 0.06, 0, 0, 0, false); // limes
    // stacks of sal-leaf bowls (shal patar bati)
    for (const [sx, n] of [[-0.62, 9], [-0.5, 6]] as const) for (let k = 0; k < n; k++) P(CUP, T(k % 2 ? 0x6a7a3a : 0x5a6e32), sx, 0.62 + k * 0.022, 0.32, 0.14, 0.04, 0.14, 0, 0, 0, false);
    P(BOX, wood, -0.56, 0.3, 0.32, 0.34, 0.6, 0.3);
    // a bamboo pole with the board and a bare bulb on its wire
    P(CYL8, bamboo, -1.35, 1.5, -0.35, 0.05, 3.0, 0.05);
    P(CYL8, bamboo, -0.45, 2.98, -0.35, 0.04, 1.85, 0.04, 0, 0, Math.PI / 2);
    sign('fuchka', 1.1, 2.6, -0.3);
    P(CYL8, T(0x1a1a1a), 0, 2.45, 0.05, 0.01, 1.0, 0.01, 0, 0, 0, false); // the bulb's wire
    bulbs.add(new THREE.Vector3(0, 1.95, 0.05).applyMatrix4(base), 0xfff0c8, 0.09);
    return { vendor: new THREE.Vector3(0, 0, -0.95).applyMatrix4(base), front: new THREE.Vector3(0, 0, 1.4).applyMatrix4(base), size: [2.7, 1.4] as const };
  }
  if (kind === 'cha') {
    // cha dokan: a wooden bench-counter under a tarpaulin; a clay unun glowing under a blackened
    // kettle, an aluminium dekchi of milky tea with its strainer, stacks of clay bhNar, glass jars
    // of biscuits, an aluminium milk can, a bench for customers in front
    P(BOX, wood, 0, 0.45, -0.2, 2.2, 0.9, 0.9);
    P(BOX, toon(0x9a7a5a), 0, 0.92, -0.2, 2.3, 0.05, 1.0);
    P(CYL, toon(0x8a4a2a), 0.65, 1.12, -0.25, 0.5, 0.35, 0.5); // unun body
    P(TOR, glow(0xff6a20, 2.6), 0.65, 1.3, -0.25, 0.32, 0.32, 0.5, Math.PI / 2, 0, 0, false); // coals
    P(SPH, T(0x3a3a3c), 0.65, 1.48, -0.25, 0.38, 0.32, 0.38); // blackened kettle
    P(CYL, T(0x3a3a3c), 0.85, 1.55, -0.25, 0.04, 0.25, 0.04, 0, 0, -0.9); // spout
    P(TOR, T(0x2a2a2a), 0.65, 1.68, -0.25, 0.12, 0.12, 0.12, 0, Math.PI / 2, 0, false); // handle
    P(TUBE, alu, 0.15, 1.08, -0.35, 0.34, 0.22, 0.34); // dekchi of tea
    P(CYL, T(0xb07a4a), 0.15, 1.17, -0.35, 0.32, 0.01, 0.32, 0, 0, 0, false);
    P(TOR, alu, 0.38, 1.22, -0.35, 0.12, 0.12, 0.3, Math.PI / 2, 0, 0, false); // strainer ring
    P(CYL8, alu, 0.48, 1.22, -0.35, 0.015, 0.12, 0.015, 0, 0, Math.PI / 2, false);
    P(CYL, alu, -1.0, 1.18, -0.45, 0.26, 0.48, 0.26); // milk can
    P(CYL, alu, -1.0, 1.46, -0.45, 0.14, 0.08, 0.14, 0, 0, 0, false);
    for (let st = 0; st < 4; st++) for (let k = 0; k < 6; k++) P(CUP, toon(0xb5562f), -0.35 + st * 0.15, 0.99 + k * 0.06, 0.08, 0.11, 0.07, 0.11, 0, 0, 0, false); // bhNar stacks
    for (let k = 0; k < 3; k++) {
      P(CYL, T(0xcfe8f0), -0.62 + k * 0.2, 1.1, -0.45, 0.16, 0.3, 0.16);
      P(CYL, T(k % 2 ? 0xe8b05a : 0xd8904a), -0.62 + k * 0.2, 1.05, -0.45, 0.13, 0.18, 0.13, 0, 0, 0, false); // biscuits
      P(CYL, T(0xd94f3a), -0.62 + k * 0.2, 1.27, -0.45, 0.17, 0.04, 0.17, 0, 0, 0, false); // lids
    }
    // tarpaulin roof on bamboo poles, the board hanging under it
    for (const sx of [-1.15, 1.15]) for (const sz of [-0.7, 0.8]) P(CYL8, bamboo, sx, 1.25, sz, 0.05, 2.5, 0.05);
    P(BOX, toon(0x2f6b8a), 0, 2.52, 0.05, 2.6, 0.04, 1.8, 0.12, 0, 0);
    sign('cha', 1.0, 2.0, 0.85);
    P(BOX, wood, 0, 0.3, 1.45, 1.8, 0.07, 0.35); // customers' bench
    for (const sx of [-0.8, 0.8]) P(BOX, wood, sx, 0.15, 1.45, 0.07, 0.3, 0.3);
    bulbs.add(new THREE.Vector3(0, 2.4, 0.3).applyMatrix4(base), 0xffe8b0, 0.15);
    return { vendor: new THREE.Vector3(0, 0, -1.0).applyMatrix4(base), front: new THREE.Vector3(0.6, 0, 1.2).applyMatrix4(base), size: [2.4, 1.3] as const };
  }
  if (kind === 'jhalmuri') {
    // jhalmuriwala: open tins on a tin tray on a folding stand, the big mixing can with its spoon
    for (const sx of [-0.45, 0.45]) for (const sz of [-0.3, 0.3]) P(CYL8, bamboo, sx, 0.4, sz, 0.04, 0.85, 0.04, sz * 0.6, 0, 0);
    P(BOX, T(0xb8c0c4), 0, 0.86, 0, 1.25, 0.06, 0.82); // tin tray
    P(BOX, T(0xe8743a), 0, 0.8, 0.41, 1.25, 0.14, 0.02, 0, 0, 0, false); // painted front
    const tin = (tx: number, tz: number, r: number, h: number, fill: number, grains?: number[]) => {
      P(TUBE, T(0xb8c0c4), tx, 0.89 + h / 2, tz, r * 2, h, r * 2);
      P(CYL, T(0x8a9094), tx, 0.9, tz, r * 2, 0.01, r * 2, 0, 0, 0, false);
      P(TOR, T(0xd8dde0), tx, 0.89 + h, tz, r * 2, r * 2, r * 2, Math.PI / 2, 0, 0, false);
      if (grains) heap(tx, 0.89 + h - 0.03, tz, r * 0.85, 0.06, Math.round(r * 160), grains, [0.03, 0.02, 0.025], fill);
      else P(CYL, T(fill), tx, 0.89 + h - 0.02, tz, r * 1.9, 0.01, r * 1.9, 0, 0, 0, false);
    };
    tin(-0.3, -0.05, 0.27, 0.24, 0xf2e6c8, [0xf8efd8, 0xeee0bc, 0xfaf4e4]); // muri (puffed rice)
    tin(0.18, -0.2, 0.13, 0.18, 0xc8862a, [0xd89a3a, 0xb8742a, 0xe8b050]); // chanachur
    tin(0.45, -0.2, 0.11, 0.16, 0xe0c060, [0xe8c86a, 0xd8b050]); // boiled chana
    tin(0.18, 0.12, 0.1, 0.14, 0xe8c8d8, [0xf0d8e4, 0xd8a8c0]); // chopped onion
    tin(0.42, 0.12, 0.1, 0.14, 0x4a9a3a, [0x3a8a2a, 0x6ab04a]); // green chilli & coriander
    for (let i = 0; i < 5; i++) P(BOX, T(0xfaf6ea), 0.0 + i * 0.05, 0.92, 0.3, 0.04, 0.02, 0.12, 0, i * 0.4, 0.3, false); // coconut slices
    bottle(-0.55, 0.89, 0.25, 0xd8b020, 0xc81e2a, 0.28); // mustard oil
    // the big mixing can, a steel spoon in it
    P(TUBE, T(0xd0d6da), 0.62, 1.12, 0.22, 0.24, 0.36, 0.24);
    P(CYL, T(0xe8d8b0), 0.62, 1.2, 0.22, 0.22, 0.02, 0.22, 0, 0, 0, false);
    P(CYL8, steel, 0.66, 1.36, 0.22, 0.015, 0.4, 0.015, 0, 0, -0.3, false);
    // newspaper cones and a stack of sheets
    for (let k = 0; k < 6; k++) P(CONE, T(k % 2 ? 0xdcd8cc : 0xcac6ba), -0.62 + k * 0.075, 0.97, -0.33, 0.07, 0.17, 0.07, Math.PI, 0, 0, false);
    P(BOX, T(0xd8d4c8), -0.5, 0.9, 0.3, 0.28, 0.02, 0.2, 0, 0.3, 0, false);
    P(CYL8, bamboo, -0.68, 1.3, 0.0, 0.03, 2.6, 0.03);
    sign('jhalmuri', 1.0, 2.35, 0.05);
    bulbs.add(new THREE.Vector3(-0.68, 2.65, 0).applyMatrix4(base), 0xffe8b0, 0.12);
    return { vendor: new THREE.Vector3(0, 0, -0.75).applyMatrix4(base), front: new THREE.Vector3(0, 0, 1.15).applyMatrix4(base), size: [1.4, 1.0] as const };
  }
  if (kind === 'mishti') {
    // mishtir dokan: a glass-fronted display counter, trays of sweets inside, a brass pan balance
    P(BOX, toon(0xf4eedf), 0, 0.42, 0, 2.6, 0.84, 1.0);
    P(BOX, toon(0xb3121f), 0, 0.15, 0.51, 2.6, 0.3, 0.02, 0, 0, 0, false);
    P(BOX, toon(0xd9b240), 0, 0.85, 0, 2.66, 0.03, 1.04);
    glassCase(0, 0.86, 0.05, 2.5, 0.5, 0.9, T(0xd9b240));
    const tray = (tx: number, tz: number) => P(CYL, steel, tx, 0.89, tz, 0.5, 0.025, 0.4, 0, 0, 0, false);
    // roshogolla in syrup, sondesh, chomchom, langcha, rajbhog — two rows
    const sweets: { c: number[]; s: [number, number, number]; syrup?: number }[] = [
      { c: [0xfaf6ea, 0xf4efe2], s: [0.075, 0.07, 0.075], syrup: 0xf0e2b0 }, // roshogolla
      { c: [0xf2d8a8, 0xeccf98], s: [0.09, 0.035, 0.09] }, // sondesh
      { c: [0xe89aa8, 0xf0b088], s: [0.06, 0.05, 0.11] }, // chomchom
      { c: [0x5a2a14, 0x6a3418], s: [0.06, 0.06, 0.12] }, // langcha
      { c: [0xf2a040, 0xe89030], s: [0.09, 0.085, 0.09], syrup: 0xf0d090 }, // rajbhog
      { c: [0xfaf0d8, 0xf8e8c0], s: [0.08, 0.04, 0.08] }, // kancha golla
    ];
    sweets.forEach((sw, k) => {
      const tx = -0.85 + (k % 3) * 0.85, tz = k < 3 ? 0.22 : -0.15;
      tray(tx, tz);
      if (sw.syrup) P(CYL, T(sw.syrup), tx, 0.905, tz, 0.46, 0.01, 0.36, 0, 0, 0, false);
      for (let q = 0; q < 9; q++) {
        const qx = ((q % 3) - 1) * 0.13, qz = (Math.floor(q / 3) - 1) * 0.11;
        P(SPH, T(sw.c[q % sw.c.length]), tx + qx, 0.92 + sw.s[1] * 0.4, tz + qz, sw.s[0], sw.s[1], sw.s[2], 0, k === 2 || k === 3 ? 0.3 : 0, 0, false);
      }
    });
    // mishti doi in clay pots, and a big aluminium handi of roshogolla on the back shelf
    P(BOX, wood, 0, 1.45, -0.42, 2.6, 0.04, 0.3);
    for (let k = 0; k < 6; k++) {
      P(CUP, toon(0xb5562f), -1.05 + k * 0.32, 1.55, -0.42, 0.18, 0.16, 0.18, 0, 0, 0, false);
      P(CYL, T(0xc89058), -1.05 + k * 0.32, 1.635, -0.42, 0.17, 0.01, 0.17, 0, 0, 0, false); // the brown set top
    }
    // brass pan balance on the counter top
    P(CYL8, T(0xc8a040), 0.95, 1.6, 0.18, 0.02, 0.4, 0.02);
    P(CYL8, T(0xc8a040), 0.95, 1.8, 0.18, 0.015, 0.5, 0.015, 0, 0, Math.PI / 2);
    for (const sx of [-0.25, 0.25]) {
      for (const k of [-1, 1]) P(CYL8, T(0x8a7a50), 0.95 + sx + k * 0.05, 1.67, 0.18, 0.004, 0.26, 0.004, 0, 0, k * 0.2, false);
      P(BOWL, T(0xd4af37), 0.95 + sx, 1.53, 0.18, 0.18, 0.05, 0.18);
    }
    for (const sx of [-1.25, 1.25]) P(CYL8, steel, sx, 1.6, -0.45, 0.04, 3.2, 0.04);
    for (let k = 0; k < 7; k++) P(BOX, toon(k % 2 ? 0xf4eedf : 0xb3121f), -1.3 + (k + 0.5) * (2.6 / 7), 2.65, 0.1, 2.6 / 7, 0.05, 1.3, 0.22, 0, 0);
    sign('mishti', 1.3, 3.05, -0.4);
    bulbs.string(new THREE.Vector3(-1.3, 2.55, 0.75).applyMatrix4(base), new THREE.Vector3(1.3, 2.55, 0.75).applyMatrix4(base), 0.12, [0xffe8b0, 0xffc93c], 0.35);
    return { vendor: new THREE.Vector3(0.2, 0, -0.85).applyMatrix4(base), front: new THREE.Vector3(0, 0, 1.25).applyMatrix4(base), size: [2.7, 1.1] as const };
  }
  if (kind === 'chowmein') {
    // wheeled thela: a blue wooden body on two cycle wheels and a front leg, a steel top
    P(BOX, toon(0x2f6b8a), 0, 0.72, 0, 2.3, 0.62, 1.05);
    P(BOX, steel, 0, 1.05, 0, 2.36, 0.05, 1.1);
    for (const sx of [-0.75, 0.75]) {
      P(WHEEL, T(0x1a1a1e), sx, 0.33, -0.56, 0.66, 0.66, 0.66);
      P(CYL, T(0xb8bec2), sx, 0.33, -0.6, 0.22, 0.03, 0.22, Math.PI / 2, 0, 0, false);
    }
    P(CYL8, steel, 1.05, 0.2, 0.4, 0.05, 0.42, 0.05);
    P(CYL8, steel, -1.05, 0.2, 0.4, 0.05, 0.42, 0.05);
    // red LPG cylinder under the cart, hose up to the gas ring
    P(new THREE.CapsuleGeometry(0.17, 0.45, 4, 12), T(0xc8102e), 0.55, 0.42, 0.1, 1);
    P(CYL8, T(0x2a2a2a), 0.55, 0.78, 0.1, 0.06, 0.1, 0.06);
    // the gas ring roaring blue, and an open iron wok heaped with noodles and vegetables
    P(CYL, T(0x2a2a2a), 0.55, 1.12, 0.1, 0.42, 0.08, 0.42);
    P(TOR, glow(0x4a9aff, 2.0), 0.55, 1.16, 0.1, 0.3, 0.3, 0.7, Math.PI / 2, 0, 0, false);
    P(TOR, glow(0x7ab8ff, 1.6), 0.55, 1.18, 0.1, 0.2, 0.2, 0.7, Math.PI / 2, 0, 0, false);
    P(BOWL, iron, 0.55, 1.42, 0.1, 0.8, 0.44, 0.8);
    P(TOR, iron, 0.55, 1.42, 0.1, 0.8, 0.8, 0.5, Math.PI / 2, 0, 0, false); // rolled rim
    for (const sx of [-1, 1]) P(TOR, iron, 0.55 + sx * 0.42, 1.42, 0.1, 0.12, 0.12, 0.6, 0, 0, Math.PI / 2, false); // loop handles
    heap(0.55, 1.26, 0.1, 0.28, 0.12, 40, [0xe8c46a, 0xdcb458, 0xe8c46a, 0x8ac06a, 0xe8743a, 0x5aa04a], [0.07, 0.025, 0.04], 0xd8b050);
    P(CYL8, iron, 0.42, 1.5, 0.2, 0.025, 0.55, 0.025, 0.9, 0, 0.6, false); // khunti (spatula)
    P(BOX, iron, 0.55, 1.33, 0.13, 0.12, 0.01, 0.1, 0.9, 0, 0.6, false);
    // glass case: boiled noodles, shredded cabbage, carrot, capsicum, a tray of eggs
    glassCase(-0.55, 1.07, -0.12, 1.0, 0.55, 0.62, alu);
    heap(-0.82, 1.1, -0.18, 0.18, 0.12, 22, [0xf0d080, 0xe8c46a], [0.07, 0.02, 0.035], 0xe8c46a); // boiled noodles
    heap(-0.45, 1.1, -0.25, 0.12, 0.08, 12, [0xd8e8b8, 0xb8d890], [0.05, 0.015, 0.03], 0xc8e0a0); // cabbage
    heap(-0.45, 1.1, 0.0, 0.08, 0.05, 8, [0xe8743a], [0.04, 0.01, 0.01], 0xe8743a); // carrot
    heap(-0.25, 1.1, 0.0, 0.07, 0.05, 6, [0x3a8a2a, 0x5aa04a], [0.03, 0.015, 0.03], 0x3a8a2a); // capsicum
    P(BOX, T(0xc8b090), -0.22, 1.11, -0.28, 0.24, 0.02, 0.2, 0, 0, 0, false); // egg tray
    for (let q = 0; q < 12; q++) P(SPH, T(0xfaf6ea), -0.31 + (q % 4) * 0.06, 1.14, -0.35 + Math.floor(q / 4) * 0.065, 0.045, 0.055, 0.045, 0, 0, 0, false);
    // sauce bottles — soy, chilli, ketchup, vinegar with chillies — and a stack of paper plates
    for (const [k, c, cap] of [[0, 0x2a140a, 0xc81e2a], [1, 0x4a8a2a, 0xf4eedf], [2, 0xc8102e, 0xf4eedf], [3, 0xdde8d8, 0xd8b020]] as const) bottle(-0.05 + k * 0.12, 1.07, 0.38, c, cap, 0.28, 0.045);
    for (let k = 0; k < 8; k++) P(CYL, T(0xfaf8f0), -0.9, 1.08 + k * 0.01, 0.38, 0.22, 0.006, 0.22, 0, 0, 0, false); // paper plates
    sign('chowmein', 1.3, 2.45, -0.3);
    P(CYL8, steel, -1.05, 1.7, -0.45, 0.04, 1.3, 0.04);
    P(CYL8, steel, 1.05, 1.7, -0.45, 0.04, 1.3, 0.04);
    P(BOX, glow(0xf4fbff, 2.2), 0, 2.08, -0.38, 1.1, 0.04, 0.04, 0, 0, 0, false); // tube light
    bulbs.add(new THREE.Vector3(0, 2.62, -0.25).applyMatrix4(base), 0xffffff, 0.12);
    return { vendor: new THREE.Vector3(0.45, 0, -0.95).applyMatrix4(base), front: new THREE.Vector3(0, 0, 1.3).applyMatrix4(base), size: [2.5, 1.4] as const };
  }
  // kathi roll: a maroon counter stall under a striped awning
  P(BOX, toon(0x8c2f22), 0, 0.5, 0, 2.6, 1.0, 0.9);
  P(BOX, steel, 0, 1.03, 0, 2.66, 0.05, 0.96);
  P(BOX, T(0xf4e6c0), 0, 0.62, 0.46, 1.4, 0.5, 0.01, 0, 0, 0, false); // the painted menu panel
  for (const sx of [-1.25, 1.25]) for (const sz of [-0.42, 0.42]) P(CYL8, steel, sx, 1.75, sz, 0.05, 1.5, 0.05);
  for (let k = 0; k < 7; k++) P(BOX, toon(k % 2 ? 0xf4eedf : 0xd94f3a), -1.3 + (k + 0.5) * (2.6 / 7), 2.55, 0.1, 2.6 / 7, 0.05, 1.25, 0.25, 0, 0);
  // the big black tawa on its burner: a paratha frying with an egg spread over it
  P(CYL, T(0x2a2a2a), 0.7, 1.1, 0.05, 0.6, 0.06, 0.6);
  P(TOR, glow(0x4a9aff, 1.6), 0.7, 1.08, 0.05, 0.4, 0.4, 0.6, Math.PI / 2, 0, 0, false);
  P(CYL, T(0x1e1c1c), 0.7, 1.16, 0.05, 0.95, 0.03, 0.95);
  P(CYL, T(0xe8c070), 0.65, 1.185, 0.05, 0.5, 0.012, 0.5, 0, 0, 0, false); // paratha
  P(CYL, T(0xf4e2a0), 0.65, 1.195, 0.05, 0.42, 0.008, 0.42, 0, 0, 0, false); // egg spread on it
  P(CYL, T(0xd8a858), 0.95, 1.185, -0.2, 0.3, 0.012, 0.3, 0, 0, 0, false); // a second paratha crisping
  P(CYL8, steel, 0.4, 1.2, 0.3, 0.02, 0.3, 0.02, 0, 0.5, Math.PI / 2, false); // flat spatula
  P(BOX, steel, 0.27, 1.19, 0.38, 0.1, 0.008, 0.08, 0, 0.5, 0, false);
  // glass case of skewered kebabs (chicken, mutton) and a bowl of paneer
  glassCase(-0.2, 1.06, -0.18, 0.95, 0.4, 0.5, steel);
  for (let k = 0; k < 5; k++) {
    const kz = -0.36 + k * 0.08;
    P(CYL8, T(0xc8b088), -0.2, 1.12, kz, 0.008, 0.85, 0.008, 0, 0, Math.PI / 2, false); // the stick
    for (let q = 0; q < 6; q++) P(BOX, T(k % 2 ? 0x8a3a1a : 0xb8442a), -0.5 + q * 0.12, 1.12, kz, 0.07, 0.05, 0.05, q, q * 0.7, 0, false);
  }
  P(BOWL, steel, 0.1, 1.15, 0.0, 0.2, 0.1, 0.2);
  for (let q = 0; q < 6; q++) P(BOX, T(0xf4ecd8), 0.06 + (q % 3) * 0.04, 1.14, -0.03 + Math.floor(q / 3) * 0.05, 0.035, 0.035, 0.035, 0, q, 0, false); // paneer
  // dough balls on a tray, the rolling board and pin
  P(BOX, steel, -0.85, 1.07, 0.18, 0.4, 0.02, 0.3, 0, 0, 0, false);
  for (let q = 0; q < 8; q++) P(SPH, T(0xead2a0), -0.98 + (q % 4) * 0.085, 1.11, 0.12 + Math.floor(q / 4) * 0.11, 0.075, 0.06, 0.075, 0, 0, 0, false);
  P(CYL, wood, -0.4, 1.07, 0.25, 0.32, 0.02, 0.32, 0, 0, 0, false);
  P(CYL, T(0xb08050), -0.4, 1.1, 0.25, 0.035, 0.36, 0.035, 0, 0.4, Math.PI / 2, false); // belun
  // egg trays stacked at the end
  for (let t = 0; t < 2; t++) {
    P(BOX, T(0xc8b090), -1.08, 1.08 + t * 0.06, -0.2, 0.3, 0.02, 0.3, 0, 0, 0, false);
    for (let q = 0; q < 16; q++) P(SPH, T(0xf2e8d8), -1.19 + (q % 4) * 0.075, 1.11 + t * 0.06, -0.31 + Math.floor(q / 4) * 0.075, 0.05, 0.06, 0.05, 0, 0, 0, false);
  }
  // bowls of sliced onion, cucumber, green chilli and halved lemons
  for (const [k, c] of [[0, 0xe8c8d8], [1, 0xa8d088], [2, 0x3a8a2a], [3, 0xe8d860]] as const) {
    P(BOWL, steel, 0.25 + k * 0.2, 1.1, 0.33, 0.18, 0.09, 0.18);
    heap(0.25 + k * 0.2, 1.07, 0.33, 0.06, 0.04, 5, [c], [0.04, 0.012, 0.04], c);
  }
  // rolls wrapped in paper, and sauce bottles
  for (let k = 0; k < 3; k++) {
    P(CYL, T(0xf2e6c8), 1.05 + k * 0.0, 1.1, 0.3 - k * 0.1, 0.07, 0.24, 0.07, 0, 0, Math.PI / 2, false);
    P(CYL, T(0xe0b468), 1.17, 1.1, 0.3 - k * 0.1, 0.06, 0.05, 0.06, 0, 0, Math.PI / 2, false);
  }
  bottle(-0.62, 1.05, 0.34, 0xc8102e, 0xf4eedf, 0.26, 0.045);
  bottle(-0.5, 1.05, 0.34, 0x4a8a2a, 0xf4eedf, 0.26, 0.045);
  sign('roll', 1.4, 3.15, 0.05);
  P(BOX, glow(0xf4fbff, 2.2), 0, 2.4, -0.38, 1.4, 0.04, 0.04, 0, 0, 0, false); // tube light
  bulbs.string(new THREE.Vector3(-1.3, 2.45, 0.7).applyMatrix4(base), new THREE.Vector3(1.3, 2.45, 0.7).applyMatrix4(base), 0.12, [0xffe8b0, 0xffc93c], 0.35);
  return { vendor: new THREE.Vector3(0.3, 0, -0.85).applyMatrix4(base), front: new THREE.Vector3(0, 0, 1.25).applyMatrix4(base), size: [2.7, 1.0] as const };
}
