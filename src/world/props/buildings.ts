/**
 * Procedural North-Kolkata style buildings. Fronts face local +Z (the street).
 *
 * A façade is a row of bays separated by pilasters. Each upper-floor bay is a tall arched window
 * (coloured-glass fanlight, moulded surround, khorkhori louvred shutters) and may carry a
 * cast-iron balcony on curved brackets. Floors are divided by stepped cornices; the roof has a
 * balustraded parapet with urn finials, plus rooftop life (stair hut, tanks, plants, laundry).
 * Street level has a rowak (raised sitting platform) with steps up to a panelled door, or a shop.
 *
 * Styles: 'bonedi' (grand mansion house, scalloped arcade), 'para' (typical para house),
 *         'shop' (para house with shopfront), 'modern' (Notun Nagar apartment block).
 */
import * as THREE from 'three';
import { Batcher, unitBox } from '../Batcher';
import { toon, glow } from '../../rendering/materials';
import type { Rng } from '../../utils/rng';
import { signMaterial, signGeometry, pickShop, SHOPS, SIGN_ASPECT, type ShopKind } from './signs';
import { fanlight, archRim, scallopRim, louvreLeaf, panelDoor, baluster, urn, bracket, ring, pot, blob, cyl8, cyl12 } from './kit';

export type BuildingStyle = 'bonedi' | 'para' | 'shop' | 'modern';

/** Faded lime-wash and plaster colours seen on old Kolkata streets. */
const LIMEWASH = [0xe8c98a, 0xdda59c, 0xefe4cf, 0xa9c4c9, 0xe2b77a, 0xc9d3b0, 0xe6cfa8, 0xd8a48a];
const BONEDI = [0xe3c68c, 0xefe6d2, 0xd9b48a, 0xe8d2b0, 0xcf9f7c];
const BRICK = 0x8a4e40;
const MODERN = [0xd8dcd6, 0xf0e2c6, 0xbcd6cf, 0xe6c9c3, 0xd6d0e4];
const SHUTTER = [0x3f6b4e, 0x4d7a57, 0x2f5d58, 0x5c7f4a, 0x6b4a2f];
const AWNING = [0xb3121f, 0x2f6b4e, 0xf28c28, 0x1a5fb4, 0x7a3e9d];
const GLASS = [0x5ec2d8, 0xd9483b, 0xf2c14e, 0x6abf69, 0x9b6bd1];

export interface BuildingSpec {
  x: number;
  z: number;
  yaw: number;
  w: number;
  d: number;
  floors: number;
  style: BuildingStyle;
  /** Fine ornament (balusters, iron rings, brackets, louvres). Off for inner-block houses. */
  detail?: boolean;
  /** Neighbourhood, which decides what kind of shops open on the ground floor. */
  district?: string;
}

const tmpM = new THREE.Matrix4();
const S = new THREE.Vector3();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const P = new THREE.Vector3();

export function buildBuilding(b: Batcher, s: BuildingSpec, rng: Rng) {
  const base = new THREE.Matrix4().makeRotationY(s.yaw).setPosition(s.x, 0, s.z);
  const put = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0, shadow = true) => {
    tmpM.compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz)).premultiply(base);
    b.add(geo, mat, tmpM, { shadow });
  };
  const box = (mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, shadow = true) => put(unitBox, mat, x, y, z, w, h, d, 0, 0, 0, shadow);

  const modern = s.style === 'modern';
  const fine = s.detail !== false;
  const brick = !modern && s.style !== 'bonedi' && rng.chance(0.12);
  const wallC = brick ? BRICK : rng.pick(modern ? MODERN : s.style === 'bonedi' ? BONEDI : LIMEWASH);
  const wall = toon(wallC);
  const trimC = modern ? 0xb7bec2 : brick ? 0xe9dcc2 : rng.pick([0xf4eedf, 0xfbf3e2, 0xe9dcc2]);
  const trim = toon(trimC);
  const shutter = toon(rng.pick(SHUTTER));
  const iron = toon(0x24222a);
  const plinth = toon(0x8c3a28); // red-oxide
  const darkWin = toon(0x231f2e);
  const fh = modern ? 3.1 : 3.7;
  const H = s.floors * fh;
  const { w, d } = s;
  const F = d / 2; // front plane

  // main mass
  box(wall, 0, H / 2, 0, w, H, d);
  // ground-floor rusticated base (horizontal grooves read as ink lines)
  if (!modern) {
    for (let k = 0; k < 3; k++) box(wall, 0, 0.55 + k * 0.9, F + 0.04, w + 0.02, 0.78, 0.08, false);
    box(plinth, 0, 0.25, F + 0.06, w + 0.06, 0.5, 0.14);
  }

  // stepped cornice at each floor line and a deep one at the roof
  for (let f = 1; f <= s.floors; f++) {
    const y = f * fh;
    const deep = f === s.floors ? 1.6 : 1;
    box(trim, 0, y - 0.32, F + 0.08 * deep, w + 0.12, 0.12, 0.16 * deep, false);
    box(trim, 0, y - 0.18, F + 0.14 * deep, w + 0.3, 0.14, 0.28 * deep, f === s.floors);
    box(trim, 0, y - 0.04, F + 0.2 * deep, w + 0.45, 0.12, 0.4 * deep, f === s.floors);
  }

  // bays + pilasters
  const bays = Math.max(1, Math.round(w / (modern ? 3 : 2.5)));
  const bw = w / bays;
  if (!modern) {
    for (let i = 0; i <= bays; i++) {
      const x = -w / 2 + i * bw;
      box(trim, x, fh + (H - fh) / 2, F + 0.06, 0.32, H - fh - 0.2, 0.12, false);
      box(trim, x, H - 0.55, F + 0.1, 0.44, 0.25, 0.18, false); // capital
    }
  }

  // ---- street level ----
  const shop = s.style === 'shop' || (s.style === 'para' && rng.chance(0.3));
  let keeper: THREE.Vector3 | null = null;
  let shopKind: ShopKind | null = null;
  let shopIndex = -1;
  if (shop) {
    // Shopfront, bottom to top: opening (0–2.4 m) with a counter set back from the street and the
    // shopkeeper standing behind it; a striped awning just above the opening; the signboard on the
    // fascia (2.7–3.4 m) — below the first-floor cornice, so nothing above can cover it.
    const sw = Math.min(w - 1.2, 6);
    box(glow(rng.pick([0xffcf7a, 0xffd99a, 0xffe2b0]), 1.0), 0, 1.25, F + 0.02, sw, 2.3, 0.06, false); // lit interior
    box(wall, -sw / 2 - 0.15, 1.3, F + 0.12, 0.3, 2.6, 0.2);
    box(wall, sw / 2 + 0.15, 1.3, F + 0.12, 0.3, 2.6, 0.2);
    box(toon(0x4a3a2a), 0, 2.5, F + 0.1, sw + 0.3, 0.2, 0.2); // lintel
    // the shop: its name decides what's on the shelves and the counter
    const shopId = pickShop(s.district ?? 'mela', () => rng.next());
    shopKind = SHOPS[shopId].kind;
    shopIndex = shopId;
    stockShop(shopKind, sw, F, rng, box, put);
    keeper = new THREE.Vector3(rng.range(-sw / 4, sw / 4), 0, F + 0.6).applyMatrix4(base);
    // striped canvas awning right above the opening
    const aw = rng.pick(AWNING);
    for (let k = 0; k < 6; k++) put(unitBox, toon(k % 2 ? aw : 0xf4eedf), -(sw + 0.4) / 2 + ((k + 0.5) * (sw + 0.4)) / 6, 2.62, F + 0.62, (sw + 0.4) / 6, 0.05, 1.1, 0.35, 0, 0);
    // signboard on the fascia
    // sized to the board's own proportions so the lettering is never squashed, and kept within the
    // fascia (2.7–3.45 m): clear of the awning below and the first-floor cornice above
    const sgh = Math.min(0.78, (sw - 0.1) / SIGN_ASPECT), sgw = sgh * SIGN_ASPECT;
    tmpM.makeTranslation(0, 3.08, F + 0.47).premultiply(base);
    b.add(signGeometry(shopId, sgw, sgh), signMaterial(), tmpM, { shadow: false });
    box(toon(0x3a2a1a), 0, 3.08, F + 0.42, sgw + 0.12, sgh + 0.12, 0.08, false);
  } else if (!modern) {
    // rowak: a raised platform along the front where neighbours sit and chat
    box(toon(0xb9a88e), 0, 0.35, F + 0.7, w - 0.4, 0.7, 1.4);
    box(toon(0x8c7b66), 0, 0.71, F + 0.7, w - 0.3, 0.06, 1.5, false);
    // steps up to a panelled door in the central bay
    const dx = bays % 2 ? 0 : -bw / 2;
    for (let k = 0; k < 2; k++) box(toon(0xb9a88e), dx, 0.17 + k * 0.35 - 0.17, F + 1.65 + (1 - k) * 0.35, 1.6, 0.35 + k * 0.35, 0.35, false);
    put(panelDoor, shutter, dx, 1.95, F + 0.05, 1.3, 2.5, 1);
    box(trim, dx, 3.32, F + 0.1, 1.8, 0.22, 0.16, false);
    put(fanlight, glow(rng.pick(GLASS), 0.9), dx, 3.25 - 0.02, F + 0.06, 1.25, 0.5, 1, 0, 0, 0, false);
    // side windows on the ground floor with iron grilles
    for (let i = 0; i < bays; i++) {
      const x = -w / 2 + (i + 0.5) * bw;
      if (Math.abs(x - dx) < bw * 0.6) continue;
      const lit = rng.chance(0.5);
      box(lit ? glow(0xffcf7a, 1.1) : darkWin, x, 2.05, F + 0.02, 0.95, 1.5, 0.05, false);
      for (let k = -2; k <= 2; k++) box(iron, x + k * 0.2, 2.05, F + 0.1, 0.035, 1.5, 0.035, false);
      box(trim, x, 2.92, F + 0.08, 1.25, 0.16, 0.14, false);
    }
  }

  // ---- upper floors ----
  for (let f = 1; f < s.floors; f++) {
    const y0 = f * fh;
    const balconyFloor = !modern && (f === 1 ? rng.chance(0.75) : rng.chance(0.35));
    const continuous = balconyFloor && rng.chance(0.5);
    for (let i = 0; i < bays; i++) {
      const x = -w / 2 + (i + 0.5) * bw;
      if (modern) {
        const lit = rng.chance(0.5);
        box(lit ? glow(rng.pick([0xffe2b0, 0xdff3ff, 0xffd38a]), 1.0) : darkWin, x, y0 + 1.55, F + 0.02, bw * 0.55, 1.5, 0.05, false);
        box(trim, x, y0 + 0.7, F + 0.12, bw * 0.62, 0.1, 0.25, false);
        if (rng.chance(0.4)) {
          box(trim, x, y0 + 0.1, F + 0.65, bw * 0.85, 0.18, 1.3);
          box(toon(0xe8eef0), x, y0 + 0.65, F + 1.28, bw * 0.85, 0.9, 0.06, false);
          if (rng.chance(0.5)) put(pot, toon(0xb5562f), x + bw * 0.3, y0 + 0.2, F + 1.0, 1, 1, 1);
        }
        continue;
      }
      // tall arched window: dark/lit glass, coloured fanlight, moulded surround
      const ww = Math.min(1.15, bw * 0.48), wh = 2.0;
      const wy = y0 + 0.55 + wh / 2;
      const lit = rng.chance(0.68);
      box(lit ? glow(rng.pick([0xffcf7a, 0xffd99a, 0xffbe6b]), 1.3) : darkWin, x, wy, F + 0.02, ww, wh, 0.05, false);
      put(fanlight, glow(rng.pick(GLASS), lit ? 1.1 : 0.55), x, wy + wh / 2, F + 0.03, ww, ww, 1, 0, 0, 0, false);
      put(s.style === 'bonedi' && rng.chance(0.5) ? scallopRim : archRim, trim, x, wy + wh / 2, F + 0.08, ww + 0.18, ww + 0.18, 1.4, 0, 0, 0, false);
      box(trim, x - ww / 2 - 0.1, wy, F + 0.07, 0.14, wh, 0.12, false);
      box(trim, x + ww / 2 + 0.1, wy, F + 0.07, 0.14, wh, 0.12, false);
      box(trim, x, wy - wh / 2 - 0.08, F + 0.12, ww + 0.45, 0.14, 0.24, false); // sill
      // khorkhori shutters: closed, half-open or open
      const open = rng.pick([0, 0.9, 1.8, 1.8]);
      const leaf = fine ? louvreLeaf : unitBox;
      const lz = fine ? 1 : 0.06;
      if (open === 0 && !lit) {
        put(leaf, shutter, x - ww / 4, wy, F + 0.08, ww / 2, wh, lz);
        put(leaf, shutter, x + ww / 4, wy, F + 0.08, ww / 2, wh, lz);
      } else {
        const hx = ww / 2;
        put(leaf, shutter, x - hx, wy, F + 0.08 + Math.sin(open) * hx / 2, hx, wh, lz, 0, open * 0.5 + (open > 1 ? 0.6 : 0), 0);
        put(leaf, shutter, x + hx, wy, F + 0.08 + Math.sin(open) * hx / 2, hx, wh, lz, 0, -(open * 0.5 + (open > 1 ? 0.6 : 0)), 0);
      }
      // cast-iron balcony on curved brackets
      if (balconyFloor && (continuous || rng.chance(0.6))) {
        const bwid = continuous ? bw + 0.02 : ww + 1.0;
        box(trim, x, y0 + 0.42, F + 0.55, bwid, 0.14, 1.1);
        if (fine && !(shop && f === 1) && (!continuous || i === 0 || i === bays - 1 || i % 2 === 0)) {
          put(bracket, iron, x - bwid / 2 + 0.2, y0 - 0.25, F, 1, 0.65, 0.95);
          put(bracket, iron, x + bwid / 2 - 0.2, y0 - 0.25, F, 1, 0.65, 0.95);
        }
        box(iron, x, y0 + 1.48, F + 1.07, bwid, 0.06, 0.08, false); // hand rail
        box(iron, x, y0 + 0.56, F + 1.07, bwid, 0.05, 0.06, false);
        const n = Math.max(3, Math.round(bwid / 0.3));
        for (let k = 0; k <= n; k++) box(iron, x - bwid / 2 + (k * bwid) / n, y0 + 1.02, F + 1.07, 0.025, 0.9, 0.025, false);
        if (fine) for (let k = 0; k < Math.floor(bwid / 0.45); k++) put(ring, iron, x - bwid / 2 + 0.25 + k * 0.45, y0 + 1.25, F + 1.08, 1, 1, 1, 0, 0, 0, false);
        if (!continuous || i === 0 || i === bays - 1) {
          box(iron, x - bwid / 2, y0 + 1.02, F + 0.55, 0.05, 0.95, 1.05, false);
          box(iron, x + bwid / 2, y0 + 1.02, F + 0.55, 0.05, 0.95, 1.05, false);
        }
        // potted plants and the odd drying sari on the rail
        if (fine && rng.chance(0.45)) {
          put(pot, toon(0xb5562f), x + rng.range(-bwid / 3, bwid / 3), y0 + 0.49, F + 0.75, 1, 1, 1);
          put(blob, toon(rng.pick([0x2f6b3a, 0x3b7d42])), x + rng.range(-bwid / 3, bwid / 3), y0 + 0.95, F + 0.75, 0.9, 0.8, 0.9);
        }
        if (rng.chance(0.15)) box(toon(rng.pick([0xb3121f, 0xf6a21e, 0xd94f7a, 0xefe6d2])), x + bwid * 0.15, y0 + 1.15, F + 1.13, Math.min(1.1, bwid * 0.4), 0.65, 0.02, false);
      }
    }
  }

  // ---- roof ----
  if (modern) {
    box(wall, 0, H + 0.35, F - 0.1, w, 0.7, 0.2);
    box(wall, 0, H + 0.35, -F + 0.1, w, 0.7, 0.2);
    box(wall, w / 2 - 0.1, H + 0.35, 0, 0.2, 0.7, d);
    box(wall, -w / 2 + 0.1, H + 0.35, 0, 0.2, 0.7, d);
    box(toon(0x9aa5ad), rng.range(-w / 4, w / 4), H + 1.3, rng.range(-d / 5, d / 5), 2.4, 2.6, 2.4);
    put(cyl12, toon(0x2d2d33), rng.range(-w / 3, w / 3), H + 0.8, -d / 4, 1.4, 1.4, 1.4);
  } else {
    // balustraded parapet across the front, solid elsewhere
    const top = H + 0.28;
    box(trim, 0, H + 0.08, F + 0.05, w + 0.1, 0.16, 0.5);
    const nb = fine ? Math.floor(w / 0.32) : 0;
    if (!fine) box(trim, 0, H + 0.5, F + 0.05, w, 0.7, 0.3);
    for (let k = 0; k < nb; k++) {
      const x = -w / 2 + 0.2 + k * ((w - 0.4) / (nb - 1));
      if (k % Math.max(4, Math.round(nb / bays)) === 0) continue;
      put(baluster, trim, x, H + 0.16, F + 0.05, 0.9, 0.75, 0.9, 0, 0, 0, false);
    }
    for (let i = 0; i <= bays; i++) {
      const x = -w / 2 + i * bw;
      box(trim, x, top + 0.18, F + 0.05, 0.36, 0.95, 0.36);
      if (fine && (i === 0 || i === bays || rng.chance(0.4))) put(urn, trim, x, top + 0.66, F + 0.05, 0.75, 0.75, 0.75);
    }
    box(trim, 0, top + 0.62, F + 0.05, w + 0.1, 0.1, 0.42, false);
    box(wall, 0, H + 0.5, -F + 0.1, w, 1.0, 0.2);
    box(wall, w / 2 - 0.1, H + 0.5, 0, 0.2, 1.0, d);
    box(wall, -w / 2 + 0.1, H + 0.5, 0, 0.2, 1.0, d);
    // rooftop life
    if (rng.chance(0.55)) {
      // chilekotha: stair hut
      const cw = Math.min(3, w * 0.4);
      box(wall, -w / 2 + cw / 2 + 0.4, H + 1.3, -d / 2 + 1.8, cw, 2.6, 2.8);
      box(trim, -w / 2 + cw / 2 + 0.4, H + 2.65, -d / 2 + 1.8, cw + 0.3, 0.15, 3.1);
      box(shutter, -w / 2 + cw / 2 + 0.4, H + 1.05, -d / 2 + 3.22, 0.9, 2.0, 0.06, false);
    }
    if (rng.chance(0.6)) put(cyl12, toon(0x2d2d33), rng.range(0, w / 3), H + 0.95, rng.range(-d / 4, 0), 1.3, 1.3, 1.3);
    if (rng.chance(0.5)) {
      // tulsi mancha / potted plants on the terrace
      for (let k = 0; k < 3; k++) {
        const px = rng.range(-w / 3, w / 3), pz = rng.range(-d / 4, d / 4);
        put(pot, toon(0xb5562f), px, H, pz, 1.2, 1.2, 1.2);
        put(blob, toon(0x2f6b3a), px, H + 0.6, pz, 1, 0.9, 1);
      }
    }
    if (rng.chance(0.45)) {
      // laundry line with saris and gamchhas
      const lx = rng.range(-w / 4, w / 4);
      box(iron, lx, H + 1.7, 0, 0.02, 0.02, d * 0.7, false);
      for (let k = 0; k < 3; k++)
        box(toon(rng.pick([0xb3121f, 0xf6a21e, 0x2f6b4e, 0xefe6d2, 0xd94f7a, 0x1a5fb4])), lx, H + 1.25, -d * 0.25 + k * (d * 0.22), 0.03, 0.9, 1.1, false);
    }
    if (rng.chance(0.3)) put(cyl8, iron, w / 2 - 0.6, H + 2.0, d / 2 - 0.8, 0.05, 3.0, 0.05); // TV antenna mast
  }
  // ---- side façades ----
  // North-Kolkata houses show their flanks: cornices and quoins wrap round, arched louvred
  // windows on every floor, ventilator holes under the parapet, painted wall ads, patches of
  // bare brick where the plaster has fallen, drainpipes, meter boxes, peepal saplings in cracks.
  const brickM = toon(0x9c4a32), mortar = toon(0xc9a48a), pipeM = toon(0x4a4a52), green = toon(0x3b7d42);
  for (const side of [-1, 1]) {
    // side frame: x runs along the depth of the building, +z points out of the wall
    const SB = new THREE.Matrix4().makeTranslation(side * (w / 2), 0, 0).multiply(new THREE.Matrix4().makeRotationY(side * Math.PI / 2)).premultiply(base);
    const sp = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0, shadow = false) => {
      tmpM.compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz)).premultiply(SB);
      b.add(g, m, tmpM, { shadow });
    };
    const sb = (m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => sp(unitBox, m, x, y, z, sx, sy, sz);
    const D = d; // wall length on this side
    if (modern) {
      const cols = Math.max(1, Math.floor(D / 3));
      for (let f = 0; f < s.floors; f++)
        for (let k = 0; k < cols; k++) {
          const x = -D / 2 + (k + 0.5) * (D / cols), y = f * fh + 1.55;
          const lit = rng.chance(0.5);
          sb(lit ? glow(rng.pick([0xffe2b0, 0xdff3ff, 0xffd38a]), 1.0) : darkWin, x, y, 0.02, 1.3, 1.4, 0.05);
          sb(trim, x, y - 0.78, 0.1, 1.5, 0.1, 0.22);
          if (rng.chance(0.3)) sb(toon(0xd8dcd6), x + 0.9, y - 0.4, 0.25, 0.8, 0.55, 0.4); // AC unit
          if (f > 0 && rng.chance(0.2)) {
            sb(trim, x, f * fh + 0.1, 0.55, 1.8, 0.16, 1.1);
            sb(toon(0xe8eef0), x, f * fh + 0.62, 1.07, 1.8, 0.85, 0.05);
          }
        }
      for (let f = 1; f <= s.floors; f++) sb(trim, 0, f * fh - 0.1, 0.06, D + 0.1, 0.16, 0.12);
      continue;
    }
    // plinth, rusticated ground floor, floor cornices and roof cornice wrapping round
    sb(plinth, 0, 0.25, 0.06, D + 0.06, 0.5, 0.14);
    for (let k = 0; k < 3; k++) sb(wall, 0, 0.55 + k * 0.9, 0.035, D + 0.02, 0.78, 0.07);
    for (let f = 1; f <= s.floors; f++) {
      const y = f * fh;
      sb(trim, 0, y - 0.3, 0.07, D + 0.12, 0.12, 0.14);
      sb(trim, 0, y - 0.14, 0.12, D + 0.24, 0.14, 0.24);
    }
    // corner quoins (alternating long/short blocks) at both ends
    for (const ex of [-D / 2 + 0.22, D / 2 - 0.22])
      for (let y = 0.8; y < H - 0.4; y += 0.55) sb(trim, ex, y, 0.05, (Math.floor(y / 0.55) % 2 ? 0.36 : 0.5), 0.46, 0.1);
    // windows on every floor
    const nw = Math.max(1, Math.round(D / 2.6));
    const balconyFloor = s.floors > 1 && rng.chance(0.45) ? rng.int(1, s.floors - 1) : -1;
    for (let f = 0; f < s.floors; f++) {
      for (let k = 0; k < nw; k++) {
        const x = -D / 2 + (k + 0.5) * (D / nw);
        if (f === 0 && (k === 0 || rng.chance(0.35))) continue;
        const ww = 0.9, wh = f === 0 ? 1.4 : 1.8;
        const wy = f * fh + (f === 0 ? 1.7 : 0.55 + wh / 2);
        const lit = rng.chance(0.45);
        sb(lit ? glow(rng.pick([0xffcf7a, 0xffd99a]), 1.05) : darkWin, x, wy, 0.02, ww, wh, 0.05);
        if (f > 0) {
          sp(fanlight, glow(rng.pick(GLASS), lit ? 1.0 : 0.5), x, wy + wh / 2, 0.03, ww, ww, 1);
          sp(archRim, trim, x, wy + wh / 2, 0.08, ww + 0.16, ww + 0.16, 1.4);
        } else for (let g2 = -2; g2 <= 2; g2++) sb(iron, x + g2 * 0.18, wy, 0.09, 0.03, wh, 0.03); // ground-floor iron grille
        sb(trim, x - ww / 2 - 0.08, wy, 0.07, 0.12, wh, 0.1);
        sb(trim, x + ww / 2 + 0.08, wy, 0.07, 0.12, wh, 0.1);
        sb(trim, x, wy - wh / 2 - 0.07, 0.12, ww + 0.4, 0.12, 0.22); // sill
        const open = rng.pick([0, 0.9, 1.8]);
        if (open === 0 && !lit) {
          sp(fine ? louvreLeaf : unitBox, shutter, x - ww / 4, wy, 0.08, ww / 2, wh, fine ? 1 : 0.05);
          sp(fine ? louvreLeaf : unitBox, shutter, x + ww / 4, wy, 0.08, ww / 2, wh, fine ? 1 : 0.05);
        } else {
          const ang = open * 0.5 + (open > 1 ? 0.6 : 0);
          sp(fine ? louvreLeaf : unitBox, shutter, x - ww / 2, wy, 0.08 + Math.sin(open) * 0.22, ww / 2, wh, fine ? 1 : 0.05, 0, ang, 0);
          sp(fine ? louvreLeaf : unitBox, shutter, x + ww / 2, wy, 0.08 + Math.sin(open) * 0.22, ww / 2, wh, fine ? 1 : 0.05, 0, -ang, 0);
        }
        // a side balcony on one floor, with laundry on its rail
        if (f === balconyFloor && k === Math.floor(nw / 2)) {
          const y0 = f * fh;
          sb(trim, x, y0 + 0.42, 0.5, ww + 1.2, 0.14, 1.0);
          sb(iron, x, y0 + 1.42, 0.98, ww + 1.2, 0.05, 0.06);
          for (let r = 0; r <= 8; r++) sb(iron, x - (ww + 1.2) / 2 + r * ((ww + 1.2) / 8), y0 + 0.95, 0.98, 0.025, 0.95, 0.025);
          if (fine) for (const bx of [-0.5, 0.5]) sp(bracket, iron, x + bx * (ww + 0.8), y0 - 0.25, 0, 1, 0.6, 0.85, 0, -Math.PI / 2, 0);
          sb(toon(rng.pick([0xb3121f, 0xf6a21e, 0x2f6b4e, 0xefe6d2, 0xd94f7a])), x + 0.3, y0 + 1.1, 1.0, 0.9, 0.7, 0.02);
        }
      }
    }
    // ventilator holes (ghulghuli) in a row under the parapet
    for (let k = 0; k < Math.floor(D / 1.2); k++) sb(darkWin, -D / 2 + 0.6 + k * 1.2, H - 0.6, 0.02, 0.22, 0.16, 0.04);
    // patches of bare brick where the lime plaster has fallen away
    for (let n = 0; n < rng.int(1, 3); n++) {
      const px = rng.range(-D / 2 + 1, D / 2 - 1), py = rng.range(0.9, H - 1.2), pw = rng.range(0.6, 1.3), ph = rng.range(0.4, 0.8);
      sb(mortar, px, py, 0.012, pw, ph, 0.02);
      for (let r = 0; r < Math.floor(ph / 0.14); r++)
        for (let c = 0; c < Math.floor(pw / 0.26); c++) sb(brickM, px - pw / 2 + 0.13 + c * 0.26 + (r % 2) * 0.12, py - ph / 2 + 0.07 + r * 0.14, 0.02, 0.22, 0.11, 0.02);
    }
    // a hand-painted wall ad on the ground floor of some flanks
    if (rng.chance(0.35)) {
      tmpM.compose(P.set(rng.range(-D / 4, D / 4), 2.0, 0.04), Q.identity(), S.set(1, 1, 1)).premultiply(SB);
      b.add(signGeometry(rng.int(0, SHOPS.length - 1), 2.6, 2.6 / SIGN_ASPECT), signMaterial(), tmpM, { shadow: false });
    }
    // drainpipe with brackets and an electricity meter box with sagging wires
    const pxp = rng.chance(0.5) ? -D / 2 + 0.55 : D / 2 - 0.55;
    sp(cyl8, pipeM, pxp, H / 2, 0.12, 0.12, H, 0.12);
    for (let y = 1; y < H; y += 1.8) sb(pipeM, pxp, y, 0.07, 0.18, 0.06, 0.1);
    if (rng.chance(0.6)) {
      const mx = rng.range(-D / 3, D / 3);
      sb(toon(0x8a8f94), mx, 1.6, 0.08, 0.35, 0.45, 0.12);
      for (let k = 0; k < 3; k++) sb(iron, mx - 0.1 + k * 0.1, 2.6, 0.06, 0.012, 1.6, 0.012);
    }
    // a peepal sapling growing out of a crack up near the cornice
    if (rng.chance(0.4)) {
      const gx = rng.range(-D / 2 + 0.5, D / 2 - 0.5), gy = rng.range(H * 0.5, H - 0.5);
      for (let k = 0; k < 4; k++) sp(blob, green, gx + Math.cos(k * 1.7) * 0.18, gy + Math.sin(k * 2.1) * 0.15, 0.18, 0.5, 0.38, 0.5);
    }
  }
  // a wall-mounted AC unit or two on the front
  if (!modern && rng.chance(0.35)) box(toon(0xd8dcd6), rng.range(-w / 3, w / 3), fh + 0.5, F + 0.3, 0.9, 0.6, 0.4);
  return { height: H, keeper, shopKind, shopIndex };
}

type Box = (mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, shadow?: boolean) => void;
type Put = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx?: number, ry?: number, rz?: number, shadow?: boolean) => void;

/**
 * Stock a shopfront to match its trade: back-wall shelves (two rows) and what sits on the counter.
 * Kept to a few dozen boxes a shop, like the generic goods it replaces.
 */
function stockShop(kind: ShopKind, sw: number, F: number, rng: Rng, box: Box, put: Put) {
  const shelf = toon(0x6b4a2f);
  const n = Math.floor(sw / 0.45);
  const x0 = -sw / 2 + 0.4;
  const shelves = (fill: (k: number, y: number, x: number) => void, ys = [0.9, 1.5], col = shelf) => {
    for (const y of ys) {
      box(col, 0, y, F + 0.16, sw - 0.3, 0.06, 0.25, false);
      for (let k = 0; k < n; k++) fill(k, y, x0 + k * 0.45);
    }
  };
  const counter = (top = 0xefe6d2, front = 0x6b4a2f) => {
    box(toon(front), 0, 0.5, F + 1.25, sw - 0.6, 1.0, 0.6);
    box(toon(top), 0, 1.02, F + 1.25, sw - 0.5, 0.05, 0.7, false);
  };
  const along = (count: number, f: (x: number, k: number) => void) => {
    for (let k = 0; k < count; k++) f(-sw / 2 + 0.9 + k * ((sw - 1.8) / Math.max(1, count - 1)), k);
  };
  const glassCase = (tint: number) => {
    // a glass-fronted display counter: the classic mishti-dokan / jeweller's case
    box(toon(0x8a5a32), 0, 0.3, F + 1.25, sw - 0.6, 0.6, 0.6);
    // open glass (no pane drawn), a slim frame at the corners, a lit strip under the top
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(toon(tint), (sx * (sw - 0.62)) / 2, 0.83, F + 1.25 + sz * 0.29, 0.04, 0.46, 0.04, false);
    box(toon(tint), 0, 1.07, F + 1.25, sw - 0.5, 0.04, 0.68, false);
    box(glow(0xfff1cf, 0.9), 0, 1.04, F + 1.25, sw - 0.7, 0.02, 0.4, false);
  };
  switch (kind) {
    case 'sweets': {
      // trays of rosogolla, sandesh, ledikeni and mihidana behind the glass; mishti-doi pots behind
      glassCase(0xe6e0d0);
      const sweet = [0xfaf6ea, 0xe8c27a, 0x7a2e12, 0xf2a03a, 0xf6dfa0];
      along(5, (x) => {
        box(toon(0xb8bcc0), x, 0.67, F + 1.25, 0.5, 0.03, 0.36, false);
        for (let j = 0; j < 3; j++) put(cyl12, toon(rng.pick(sweet)), x - 0.15 + j * 0.15, 0.72, F + 1.22, 0.1, 0.07, 0.1, 0, 0, 0, false);
      });
      shelves((k, y, x) => put(cyl12, toon(k % 3 ? 0xa0522d : 0xc0703a), x, y + 0.12, F + 0.17, 0.24, 0.2, 0.24, 0, 0, 0, false));
      break;
    }
    case 'books': {
      // spines packed shelf to shelf, and stacks of new Pujabarshiki annuals on the counter
      const spine = [0x1a4f9c, 0xb3121f, 0x2f6b4e, 0xf2c14e, 0x5a2f86, 0xefe4cf, 0x3b2a12];
      shelves((k, y, x) => {
        for (let j = 0; j < 4; j++) box(toon(spine[(k * 3 + j) % spine.length]), x - 0.16 + j * 0.1, y + 0.17, F + 0.17, 0.08, 0.26 + ((k + j) % 3) * 0.03, 0.18, false);
      }, [0.7, 1.2, 1.7]);
      counter(0xd9c9a8);
      along(4, (x, k) => box(toon(spine[(k * 2) % spine.length]), x, 1.12, F + 1.25, 0.36, 0.14, 0.26, false));
      break;
    }
    case 'clothing': {
      // folded saris in jewel colours, a few draped open on a rail, bolts on the counter
      const sari = [0xb3121f, 0xf2c14e, 0x2f6b4e, 0xd94f7a, 0x5a2f86, 0xf28c28, 0x1a5fb4, 0xfaf6ea];
      shelves((k, y, x) => {
        for (let j = 0; j < 3; j++) box(toon(sari[(k + j * 3 + (y > 1 ? 4 : 0)) % sari.length]), x, y + 0.06 + j * 0.07, F + 0.17, 0.36, 0.06, 0.2, false);
      });
      box(toon(0x9a7a3a), 0, 2.15, F + 0.35, sw - 0.6, 0.04, 0.04, false);
      along(3, (x, k) => box(toon(sari[(k * 3 + 1) % sari.length]), x, 1.7, F + 0.36, 0.55, 0.9, 0.02, false));
      counter(0xfaf6ea);
      along(4, (x, k) => box(toon(sari[(k * 2 + 2) % sari.length]), x, 1.1, F + 1.25, 0.42, 0.1, 0.3, false));
      break;
    }
    case 'jewellers': {
      glassCase(0x3b2a12);
      along(5, (x) => {
        box(toon(0x8a1a2a), x, 0.67, F + 1.25, 0.42, 0.03, 0.3, false);
        put(cyl12, toon(0xffcf5a), x, 0.72, F + 1.25, 0.2, 0.03, 0.2, 0, 0, 0, false);
      });
      shelves((k, y, x) => box(toon(k % 2 ? 0x8a1a2a : 0x1a3a5a), x, y + 0.1, F + 0.17, 0.3, 0.18, 0.12, false), [1.2, 1.7], toon(0x3b2a12));
      break;
    }
    case 'puja': {
      // dashakarma bhandar: brass lamps and pots, conch shells, bundles of incense, red and yellow
      shelves((k, y, x) => {
        if (k % 3 === 0) put(cyl12, toon(0xd4a03a), x, y + 0.15, F + 0.17, 0.24, 0.24, 0.24, 0, 0, 0, false);
        else if (k % 3 === 1) box(toon(rng.pick([0xb3121f, 0xf2c14e, 0xf28c28])), x, y + 0.12, F + 0.17, 0.3, 0.18, 0.16, false);
        else put(cyl12, toon(0xf4eedf), x, y + 0.1, F + 0.17, 0.16, 0.14, 0.24, 0, 0, Math.PI / 2, false);
      });
      counter(0xb3121f);
      along(4, (x, k) => put(cyl12, toon(k % 2 ? 0xd4a03a : 0xf28c28), x, 1.18, F + 1.25, 0.3, 0.26, 0.3));
      break;
    }
    case 'medical': {
      shelves((k, y, x) => {
        for (let j = 0; j < 3; j++) box(toon([0xffffff, 0x8fd0e0, 0xf2c14e, 0xe8e8e0][(k + j) % 4]), x - 0.12 + j * 0.12, y + 0.08, F + 0.17, 0.1, 0.13, 0.12, false);
      }, [0.7, 1.15, 1.6]);
      counter(0xf8f8f2, 0xdfe6e2);
      box(toon(0x0f8a4a), sw / 2 - 0.5, 2.1, F + 0.25, 0.4, 0.12, 0.04, false); // the green cross
      box(toon(0x0f8a4a), sw / 2 - 0.5, 2.1, F + 0.25, 0.12, 0.4, 0.04, false);
      break;
    }
    case 'photo': {
      // framed portraits and Pujo photos on the walls, a camera on a tripod
      shelves((k, y, x) => {
        box(toon(0x3b2a12), x, y + 0.2, F + 0.16, 0.34, 0.3, 0.03, false);
        box(toon(rng.pick([0xe8c27a, 0xb3121f, 0x5ec2d8, 0xf2c14e])), x, y + 0.2, F + 0.18, 0.26, 0.22, 0.02, false);
      }, [0.9, 1.5]);
      counter(0x1a1a20, 0x103b45);
      put(cyl8, toon(0x1a1a20), sw / 4, 1.2, F + 1.25, 0.03, 0.4, 0.03);
      box(toon(0x1a1a20), sw / 4, 1.45, F + 1.25, 0.22, 0.14, 0.12, false);
      break;
    }
    case 'tailor': {
      const cloth = [0x2e3550, 0xfaf6ea, 0x6b5a48, 0x2f6b4e, 0xb3121f];
      shelves((k, y, x) => put(cyl12, toon(cloth[k % cloth.length]), x, y + 0.12, F + 0.17, 0.2, 0.36, 0.2, 0, 0, Math.PI / 2, false));
      counter(0xd9c9a8);
      // the sewing machine
      box(toon(0x1a1a20), -sw / 4, 1.15, F + 1.25, 0.4, 0.2, 0.16, false);
      box(toon(0x1a1a20), -sw / 4 + 0.15, 1.3, F + 1.25, 0.08, 0.22, 0.12, false);
      box(toon(0xfaf6ea), sw / 5, 1.08, F + 1.25, 0.6, 0.04, 0.4, false);
      break;
    }
    case 'cycle': {
      // wheels hung on the wall, a bicycle at the front
      for (let k = 0; k < Math.min(4, Math.floor((sw - 0.6) / 0.7)); k++) put(ring, toon(0x1a1a20), x0 + 0.1 + k * 0.7, 1.6, F + 0.2, 2.4, 2.4, 2.4, 0, 0, 0, false);
      box(toon(0x6b4a2f), 0, 0.4, F + 1.25, sw - 0.6, 0.8, 0.6);
      for (const sx of [-0.45, 0.45]) put(ring, toon(0x1a1a20), sx, 0.33, F + 1.75, 2.6, 2.6, 2.6, 0, 0, 0, false);
      box(toon(0x1a5fb4), 0, 0.6, F + 1.75, 0.9, 0.05, 0.05, false);
      break;
    }
    case 'gift': {
      // wrapped boxes with ribbons, soft toys, a string of tinsel
      shelves((k, y, x) => {
        const c = [0xd94f7a, 0x5ec2d8, 0xf2c14e, 0x6abf69, 0xb05aff][(k + (y > 1 ? 2 : 0)) % 5];
        box(toon(c), x, y + 0.14, F + 0.17, 0.3, 0.24, 0.2, false);
        box(toon(0xffe08a), x, y + 0.14, F + 0.18, 0.04, 0.25, 0.21, false);
      });
      counter(0xffffff, 0xc8406e);
      along(4, (x, k) => put(blob, toon([0xf2c14e, 0xd9a07a, 0xffffff, 0xd94f7a][k]), x, 1.2, F + 1.25, 0.45, 0.5, 0.42));
      break;
    }
    case 'tea':
    case 'telebhaja': {
      // a clay-oven counter: kettle or a black kadai of oil with fritters, glass jars of biscuits
      counter(0x5a4a3a, 0x8a4e40);
      if (kind === 'tea') {
        put(cyl12, toon(0x9aa0a6), -sw / 4, 1.2, F + 1.25, 0.32, 0.3, 0.32);
        along(5, (x) => put(cyl12, toon(0xd9c9a8), x, 1.09, F + 1.45, 0.08, 0.1, 0.08, 0, 0, 0, false)); // bhaanr
      } else {
        put(cyl12, toon(0x1a1a20), -sw / 5, 1.1, F + 1.25, 0.7, 0.12, 0.7);
        along(5, (x) => put(blob, toon(rng.pick([0xd98a2a, 0xc0703a, 0xe8a83a])), x, 1.1, F + 1.5, 0.3, 0.16, 0.24, 0, 0, 0, false)); // beguni, aloor chop
      }
      shelves((k, y, x) => put(cyl12, glow(0xffe2b0, 0.35), x, y + 0.15, F + 0.17, 0.24, 0.26, 0.24, 0, 0, 0, false), [1.4]);
      break;
    }
    case 'hotel':
    case 'biryani': {
      // a pice hotel / biryani house: benches and tables inside, and at the front either a big
      // red-cloth-sealed biryani handi or rice and dal pots
      for (const y of [0.45, 0.75]) box(toon(0x6b4a2f), 0, y, F + 0.45, sw - 0.6, y === 0.75 ? 0.05 : 0.5, y === 0.75 ? 0.5 : 0.1, false);
      counter(0xd9c9a8);
      if (kind === 'biryani') {
        put(cyl12, toon(0x8a6a3a), -sw / 4, 1.32, F + 1.25, 0.8, 0.55, 0.8);
        put(cyl12, toon(0xb3121f), -sw / 4, 1.62, F + 1.25, 0.84, 0.06, 0.84, 0, 0, 0, false);
      } else along(3, (x) => put(cyl12, toon(0xb8bcc0), x, 1.2, F + 1.25, 0.4, 0.32, 0.4));
      shelves((k, y, x) => put(cyl12, toon(0xb8bcc0), x, y + 0.08, F + 0.17, 0.3, 0.06, 0.3, 0, 0, 0, false), [1.6]);
      break;
    }
    default: {
      // general / mudikhana: tins, jars and sacks of rice and dal
      const goods = [0xf2c14e, 0xd9483b, 0x6abf69, 0xefe6d2, 0x5ec2d8, 0xb05aff];
      shelves((k, y, x) => box(toon(rng.pick(goods)), x, y + 0.16, F + 0.17, 0.26, 0.26, 0.18, false));
      counter();
      along(4, (x) => put(cyl12, toon(rng.pick([0xe8dcc0, 0xd9c9a8, 0xc8b48a])), x, 1.22, F + 1.25, 0.34, 0.34, 0.34));
    }
  }
}
