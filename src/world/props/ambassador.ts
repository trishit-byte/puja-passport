/**
 * The yellow Hindustan Ambassador taxi, Kolkata's icon. The rounded, upright 1950s body has a
 * domed bonnet and boot, bulging front wings, round chrome headlights in the grille, a tall
 * glasshouse with slim pillars, a chrome bumper, a roof "TAXI" lamp and black-and-white hubcaps.
 * Returns parts (geometry, material, local matrix) that work both for static batches (parked
 * cars) and for scene meshes (moving traffic). Wheels are separate: see WHEELS.
 */
import * as THREE from 'three';
import { toon, glow } from '../../rendering/materials';

export interface Part {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  m: THREE.Matrix4;
  shadow: boolean;
}

const SPH = new THREE.SphereGeometry(1, 16, 10);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
let cache: Part[] | null = null;

export const WHEELS: [number, number][] = [[-0.78, 1.32], [0.78, 1.32], [-0.78, -1.28], [0.78, -1.28]];
export const WHEEL_R = 0.36;

export function ambassadorParts(): Part[] {
  if (cache) return cache;
  const yellow = toon(0xf2c230, { paint: false }), black = toon(0x1a1a20, { paint: false }), glass = toon(0x26303a, { paint: false });
  const chrome = toon(0xdfe4e8, { paint: false }), red = toon(0xc81e2a, { paint: false });
  const parts: Part[] = [];
  const P = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0, shadow = true) =>
    parts.push({ geo, mat, m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)), shadow });
  // lower body: a long slab with rounded ends
  P(BOX, yellow, 0, 0.72, 0, 1.68, 0.56, 3.6);
  P(SPH, yellow, 0, 0.78, 1.68, 0.84, 0.36, 0.5); // domed bonnet nose
  P(SPH, yellow, 0, 0.8, -1.7, 0.84, 0.38, 0.45); // rounded boot
  P(SPH, yellow, 0, 0.96, 1.05, 0.8, 0.16, 0.8); // the bonnet's hump
  P(SPH, yellow, 0, 0.98, -1.25, 0.8, 0.14, 0.55); // boot lid
  for (const sd of [-1, 1]) {
    P(SPH, yellow, sd * 0.72, 0.8, 1.35, 0.2, 0.32, 0.62); // bulging front wings
    P(SPH, yellow, sd * 0.72, 0.8, -1.3, 0.2, 0.3, 0.55); // rear haunches
    // round headlights in chrome rims, set in the grille
    P(CYL, chrome, sd * 0.55, 0.88, 2.08, 0.15, 0.06, 0.15, Math.PI / 2, 0, 0, false);
    P(CYL, glow(0xfff1c4, 2.2), sd * 0.55, 0.88, 2.11, 0.12, 0.04, 0.12, Math.PI / 2, 0, 0, false);
    P(BOX, red, sd * 0.62, 0.86, -2.13, 0.16, 0.2, 0.04, 0, 0, 0, false); // tail lamps
    P(BOX, black, sd * 0.86, 1.22, 0.62, 0.05, 0.08, 0.12, 0, 0, 0, false); // wing mirrors
  }
  // grille: vertical chrome slats between the headlights
  P(BOX, black, 0, 0.84, 2.1, 0.7, 0.3, 0.04, 0, 0, 0, false);
  for (let k = -3; k <= 3; k++) P(BOX, chrome, k * 0.09, 0.84, 2.13, 0.025, 0.28, 0.02, 0, 0, 0, false);
  // chrome bumpers
  P(BOX, chrome, 0, 0.52, 2.1, 1.6, 0.11, 0.1);
  P(BOX, chrome, 0, 0.5, -2.12, 1.7, 0.12, 0.1);
  // a black band along the sides (the Kolkata taxi stripe)
  for (const sd of [-1, 1]) P(BOX, black, sd * 0.845, 0.72, 0, 0.02, 0.08, 3.4, 0, 0, 0, false);
  // glasshouse: tall upright cabin, slim pillars, dark glass
  P(BOX, yellow, 0, 1.47, -0.22, 1.5, 0.12, 1.95); // roof
  P(SPH, yellow, 0, 1.49, -0.22, 0.76, 0.08, 1.0); // domed roof skin
  P(BOX, glass, 0, 1.23, -0.22, 1.52, 0.4, 1.9, 0, 0, 0, false);
  for (const z of [0.72, -0.22, -1.16]) for (const sd of [-1, 1]) P(BOX, yellow, sd * 0.75, 1.23, z, 0.06, 0.42, 0.1, 0, 0, 0, false); // A, B, C pillars
  P(BOX, glass, 0, 1.2, 0.84, 1.46, 0.38, 0.06, -0.35, 0, 0, false); // raked windscreen
  // the roof "TAXI" lamp
  P(BOX, black, 0, 1.6, -0.1, 0.55, 0.14, 0.22, 0, 0, 0, false);
  P(BOX, glow(0xffe8a0, 1.4), 0, 1.6, 0.0, 0.48, 0.09, 0.02, 0, 0, 0, false);
  cache = parts;
  return parts;
}

/** A wheel: black tyre and a white-rimmed hubcap (axis along x). */
export function wheelParts(): Part[] {
  const tyre = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.24, 16);
  tyre.rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(0.2, 0.2, 0.26, 12);
  hub.rotateZ(Math.PI / 2);
  const cap = new THREE.CylinderGeometry(0.1, 0.1, 0.28, 10);
  cap.rotateZ(Math.PI / 2);
  const id = new THREE.Matrix4();
  return [
    { geo: tyre, mat: toon(0x16161a, { paint: false }), m: id, shadow: true },
    { geo: hub, mat: toon(0xf4f4f0, { paint: false }), m: id, shadow: false },
    { geo: cap, mat: toon(0xb8bec2, { paint: false }), m: id, shadow: false },
  ];
}
