/**
 * Shared pandal building blocks.
 *
 * The idol tableau follows the traditional ekchala arrangement (see docs/durga-puja-research.md):
 * viewer's left → right: Ganesh (with Kola Bou), Lakshmi, Durga on the lion with Mahishasura at her
 * feet, Saraswati, Kartik — all beneath an arched chalchitra. It is deliberately static and sits
 * on a raised bedi behind a low railing: the player can admire it but never touch, walk onto or
 * interact with it.
 */
import * as THREE from 'three';
import { releaseImageAfterUpload } from '../../utils/geometry';
import type { Batcher } from '../Batcher';
import { unitBox } from '../Batcher';
import { toon, glow, bend } from '../../rendering/materials';
import type { CollisionWorld } from '../collision';
import type { BulbSystem } from '../props/street';
import { protima, type IdolStyle } from './protima';
import { PANDALS } from '../../data/pandals';

export interface PandalTarget {
  id: string;
  /** Flat-space position of the interaction station. */
  pos: THREE.Vector3;
  radius: number;
}

export interface PandalBuild {
  targets: PandalTarget[];
  /** Point lights to feed the dynamic light pool (flat positions). */
  lights: { pos: THREE.Vector3; color: number; intensity: number; distance: number }[];
  /** Dynamic (animated) objects added to the scene directly. */
  dynamic: THREE.Object3D;
  /** Per-frame animation; `done` lists completed target ids, `complete` when the stamp is earned. */
  update(t: number, dt: number, done: string[], complete: boolean): void;
  /** One-shot feedback when a target is activated. */
  onActivate(id: string): void;
  /** Where the camera frames the central installation (flat): position and look target. */
  view: { pos: THREE.Vector3; look: THREE.Vector3 };
  /** Points just inside the gate (for NPC paths) and the idol viewing spot. */
  gate: THREE.Vector3;
  darshan: THREE.Vector3;
}

const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
const sph = new THREE.SphereGeometry(0.5, 16, 12);
const cone = new THREE.ConeGeometry(0.5, 1, 12);
const disc = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
const torus = new THREE.TorusGeometry(0.5, 0.05, 6, 32);

/** Local helper: put geometry into the batch in pandal-local coordinates. */
export class Local {
  m = new THREE.Matrix4();
  /** Optional dynamic group for non-batched pieces (signs etc). */
  dyn?: THREE.Object3D;
  constructor(public b: Batcher, public base: THREE.Matrix4) {}
  put(g: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0, shadow = true) {
    this.m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)).premultiply(this.base);
    this.b.add(g, mat, this.m, { shadow });
  }
  box(mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0, shadow = true) {
    this.put(unitBox, mat, x, y, z, w, h, d, 0, ry, 0, shadow);
  }
  cyl(mat: THREE.Material, x: number, y: number, z: number, r: number, h: number, shadow = true) {
    this.put(cyl, mat, x, y, z, r * 2, h, r * 2, 0, 0, 0, shadow);
  }
  sph(mat: THREE.Material, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, shadow = true) {
    this.put(sph, mat, x, y, z, sx * 2, sy * 2, sz * 2, 0, 0, 0, shadow);
  }
  /** Local → world (flat) point. */
  w(x: number, y: number, z: number) {
    return new THREE.Vector3(x, y, z).applyMatrix4(this.base);
  }
}

/** The protima tableau on its bedi (see protima.ts for the full iconography). */
export function idolTableau(L: Local, cx: number, cz: number, scale = 1, opts: { chalchitra?: number; panel?: number; sholapith?: boolean; y0?: number; style?: IdolStyle } = {}) {
  protima(L, cx, cz, scale, { y0: opts.y0, panel: opts.panel, chalchitra: opts.chalchitra, style: opts.style });
}

/** Painted alpona disc (rice-paste floor art) as a flat decal; returns the mesh. */
export function alponaMesh(radius: number, colors = ['#f4eedf', '#b3121f']): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.translate(256, 256);
  g.strokeStyle = colors[0];
  g.fillStyle = colors[0];
  g.lineWidth = 7;
  g.lineCap = 'round';
  for (let ring = 0; ring < 4; ring++) {
    const r = 60 + ring * 55;
    const petals = 8 + ring * 4;
    for (let i = 0; i < petals; i++) {
      g.save();
      g.rotate((i / petals) * Math.PI * 2 + ring * 0.2);
      g.beginPath();
      g.moveTo(0, r - 30);
      g.quadraticCurveTo(18, r, 0, r + 30);
      g.quadraticCurveTo(-18, r, 0, r - 30);
      g.stroke();
      g.beginPath();
      g.arc(0, r + 42, 5, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.beginPath();
    g.arc(0, 0, r - 36, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = colors[1];
  g.beginPath();
  g.arc(0, 0, 22, 0, Math.PI * 2);
  g.fill();
  // little paired feet motif (Lakshmi's footsteps) at the centre-front
  g.fillStyle = colors[1];
  for (const sx of [-14, 14]) {
    g.beginPath();
    g.ellipse(sx, 120, 8, 16, 0, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  releaseImageAfterUpload(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0, radius, 48, 6).rotateX(-Math.PI / 2),
    bend(new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), false),
  );
  // RingGeometry UVs map the full square, so the canvas centres on the disc
  m.renderOrder = 1;
  m.frustumCulled = false;
  return m;
}

/** Gate (toran) with a painted Bengali/English name board. Gate stands at local z, facing +z. */
export function gate(L: Local, z: number, width: number, height: number, colors: { frame: number; cloth: number; accent: number }, name: { bn: string; en: string }, bulbs: BulbSystem, parent: THREE.Object3D) {
  const frame = toon(colors.frame);
  for (const sx of [-1, 1]) {
    L.box(frame, sx * width / 2, height / 2, z, 0.7, height, 0.7);
    L.box(toon(colors.cloth), sx * width / 2, height / 2, z + 0.37, 0.75, height - 0.4, 0.04, 0, false);
    L.put(cone, toon(colors.accent), sx * width / 2, height + 0.5, z, 0.9, 1.0, 0.9);
  }
  L.box(frame, 0, height + 0.6, z, width + 1.2, 2.2, 0.6);
  // scalloped cloth valance
  for (let i = 0; i < Math.floor(width / 0.6); i++) L.put(sph, toon(i % 2 ? colors.cloth : colors.accent), -width / 2 + 0.3 + i * 0.6, height - 0.72, z + 0.36, 0.6, 0.5, 0.1, 0, 0, 0, false);
  // bulbs outlining the gate
  for (let i = 0; i <= 30; i++) {
    const u = i / 30;
    bulbs.add(L.w(-width / 2 - 0.6 + u * (width + 1.2), height + 1.75, z + 0.35), i % 2 ? 0xffe8b0 : 0xffc93c, 0.1, i % 2);
  }
  for (let i = 0; i <= 14; i++) for (const sx of [-1, 1]) bulbs.add(L.w(sx * (width / 2 + 0.38), (i / 14) * height, z + 0.38), 0xffe8b0, 0.08, i % 2);
  // name board (own texture)
  const board = nameBoard(name.bn, PANDALS.find((d) => d.bn === name.bn)?.hi ?? '', name.en, colors);
  board.position.copy(L.w(0, height + 0.62, z + 0.32));
  board.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(L.base));
  parent.add(board);
}

function nameBoard(bn: string, hi: string, en: string, colors: { frame: number; cloth: number; accent: number }): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 352;
  const g = c.getContext('2d')!;
  g.fillStyle = '#' + colors.cloth.toString(16).padStart(6, '0');
  g.fillRect(0, 0, 1024, 352);
  g.strokeStyle = '#ffd36b';
  g.lineWidth = 10;
  g.strokeRect(14, 14, 996, 324);
  g.fillStyle = '#fff6dc';
  g.textAlign = 'center';
  let size = 96;
  for (const t of [bn, hi, en.toUpperCase()]) {
    g.font = `800 ${size}px "Baloo Da 2", "Baloo 2", "Noto Sans Bengali", sans-serif`;
    while (g.measureText(t).width > 940 && size > 30) g.font = `800 ${--size}px "Baloo Da 2", "Baloo 2", "Noto Sans Bengali", sans-serif`;
  }
  g.font = `800 ${size}px "Baloo Da 2", "Baloo 2", "Noto Sans Bengali", sans-serif`;
  // Bengali, then Devanagari, then English — one family (Baloo), one size
  g.fillText(bn, 512, 108);
  g.fillText(hi, 512, 214);
  g.fillText(en.toUpperCase(), 512, 316);
  const tex = new THREE.CanvasTexture(c);
  releaseImageAfterUpload(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.06), bend(new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.2, 1.2, 1.2) })));
  m.frustumCulled = false;
  return m;
}

/** Small entry/exit signboard (প্রবেশ / প্রস্থান). */
export function entrySign(text: 'entry' | 'exit'): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = text === 'entry' ? '#2f6b4e' : '#b3121f';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.font = '800 40px "Baloo Da 2", "Baloo 2", "Noto Sans Bengali", sans-serif';
  g.fillText(text === 'entry' ? 'প্রবেশ' : 'প্রস্থান', 128, 58);
  g.fillText(text === 'entry' ? 'ENTRY' : 'EXIT', 128, 108);
  const tex = new THREE.CanvasTexture(c);
  releaseImageAfterUpload(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), bend(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })));
  m.frustumCulled = false;
  return m;
}

/** Low railing in front of the bedi; keeps visitors (and the camera) off the sacred platform. */
export function bediRailing(L: Local, cols: CollisionWorld, cz: number, width: number) {
  const brass = toon(0xc9a24a);
  for (let i = 0; i <= 10; i++) L.cyl(brass, -width / 2 + (i * width) / 10, 0.5, cz, 0.05, 1.0, false);
  L.box(brass, 0, 1.0, cz, width, 0.07, 0.07, 0, false);
  L.box(brass, 0, 0.55, cz, width, 0.05, 0.05, 0, false);
  const p = L.w(0, 0, cz - 2.2);
  const q = L.w(0, 0, cz);
  const yaw = Math.atan2(q.x - p.x, q.z - p.z);
  cols.addBox(p.x, p.z, width + 0.6, 4.6, yaw, 1.0);
}

/** Wall segment collider + geometry in pandal-local coordinates (from a→b). */
export function wall(L: Local, cols: CollisionWorld, ax: number, az: number, bx: number, bz: number, h: number, mat: THREE.Material, thick = 0.5) {
  const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  const len = Math.hypot(bx - ax, bz - az);
  const ry = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
  // draw in ≤5 m pieces so the wall follows the planet's curve instead of sagging
  const n = Math.max(1, Math.ceil(len / 5));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    L.box(mat, ax + (bx - ax) * u, h / 2, az + (bz - az) * u, len / n + 0.02, h, thick, ry);
  }
  // Pandal walls are dressed in cloth: vertical pleated panels alternating two shades, a red border
  // at the foot, and a scalloped marigold valance along the top — on both faces.
  const base = new THREE.Color((mat as THREE.MeshToonMaterial).color ?? 0x888888);
  const light = toon(base.clone().lerp(new THREE.Color(0xfff3d6), 0.28).getHex());
  const dark = toon(base.clone().multiplyScalar(0.82).getHex());
  const border = toon(0xb3121f), gold = toon(0xf6a21e);
  const nx = Math.sin(ry), nz = Math.cos(ry);
  const panels = Math.max(1, Math.round(len / 1.1));
  for (const sd of [-1, 1]) {
    const off = sd * (thick / 2 + 0.03);
    for (let i = 0; i < panels; i++) {
      const u = (i + 0.5) / panels;
      const x = ax + (bx - ax) * u + nx * off, z = az + (bz - az) * u + nz * off;
      L.box(i % 2 ? light : dark, x, h / 2 - 0.05, z, len / panels - 0.04, h - 0.5, 0.03, ry, false);
    }
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      L.box(border, ax + (bx - ax) * u + nx * off * 1.2, 0.22, az + (bz - az) * u + nz * off * 1.2, len / n + 0.02, 0.36, 0.04, ry, false);
    }
    const sc = Math.max(1, Math.round(len / 0.7));
    for (let i = 0; i < sc; i++) {
      const u = (i + 0.5) / sc;
      L.put(sph, i % 2 ? gold : border, ax + (bx - ax) * u + nx * off * 1.3, h - 0.32, az + (bz - az) * u + nz * off * 1.3, 0.62, 0.42, 0.08, 0, ry, 0, false);
    }
  }
  const c = L.w(mx, 0, mz);
  const yawWorld = ry + Math.atan2(L.base.elements[8], L.base.elements[10]);
  cols.addBox(c.x, c.z, len, thick + 0.2, yawWorld, h);
}

export { cyl, sph, cone, disc, torus };

/**
 * Standard square enclosure: front wall at local z=+R with a central entry gate (gateW wide) and a
 * separate exit gap at the right; side and back walls. Returns nothing (geometry + colliders).
 */
export function enclosure(L: Local, cols: CollisionWorld, R: number, gateW: number, mat: THREE.Material, h = 3.5, exit = true) {
  const g = gateW / 2;
  wall(L, cols, -R, R, -g, R, h, mat);
  if (exit) {
    wall(L, cols, g, R, R - 5, R, h, mat);
    wall(L, cols, R - 2.2, R, R, R, h, mat);
    const ex = entrySign('exit');
    ex.position.copy(L.w(R - 3.6, 2.4, R + 0.4));
    ex.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(L.base));
    L.dyn?.add(ex);
  } else wall(L, cols, g, R, R, R, h, mat);
  wall(L, cols, -R, R, -R, -R, h + 1, mat);
  wall(L, cols, R, R, R, -R, h + 1, mat);
  wall(L, cols, -R, -R, R, -R, h + 2, mat);
  const en = entrySign('entry');
  en.position.copy(L.w(-g - 1.4, 2.2, R + 0.4));
  en.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(L.base));
  L.dyn?.add(en);
}

/**
 * Landmark light tower (Chandannagar-style lit bamboo frame) that rises above the rooftops so a
 * pandal can be spotted over the tiny planet's curved horizon from a few streets away.
 */
export function landmarkTower(L: Local, x: number, z: number, h: number, colors: number[], bulbs: BulbSystem, frame = 0x3a2a1a) {
  const mat = toon(frame);
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [cx, cz] of corners) {
    const a = L.w(x + cx * 1.6, 0, z + cz * 1.6), b = L.w(x + cx * 0.35, h, z + cz * 0.35);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    L.b.add(cyl, mat, new THREE.Matrix4().compose(mid, q, new THREE.Vector3(0.22, len, 0.22)));
    for (let i = 0; i <= 30; i++) bulbs.add(a.clone().lerp(b, i / 30), colors[i % colors.length], 0.14, i % 2);
  }
  for (let k = 1; k < 8; k++) {
    const y = (k / 8) * h, w = 1.6 - (1.25 * k) / 8;
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      const side = Math.floor(t * 4), u = (t * 4) % 1;
      const [ax, az] = corners[side], [bx, bz] = corners[(side + 1) % 4];
      bulbs.add(L.w(x + (ax + (bx - ax) * u) * w, y, z + (az + (bz - az) * u) * w), colors[(k + i) % colors.length], 0.12, (k + i) % 2);
    }
  }
  L.put(sph, glow(colors[0], 3.5), x, h + 0.8, z, 1.4, 1.4, 1.4, 0, 0, 0, false);
  L.put(cone, glow(colors[1 % colors.length], 2.5), x, h + 2.4, z, 0.6, 2.0, 0.6, 0, 0, 0, false);
  return L.w(x, h, z);
}

/**
 * The pandal bell: a brass ghanta hung from a carved wooden frame. Every pandal has one near its
 * entrance; ringing it is how a visitor receives the pandal's passport stamp.
 */
export function makeBell(L: Local, x: number, z: number, parent: THREE.Object3D, cols: CollisionWorld) {
  const frame = new THREE.Group();
  frame.position.copy(L.w(x, 0, z));
  frame.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(L.base));
  const wood = toon(0x6b3a22, { paint: false });
  for (const px of [-0.8, 0.8]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.9, 0.22), wood);
    m.position.set(px, 1.45, 0);
    m.castShadow = true;
    frame.add(m);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), wood);
    foot.position.set(px, 0.06, 0);
    frame.add(foot);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.24, 0.3), wood);
  beam.position.y = 2.95;
  frame.add(beam);
  for (const px of [-1.05, 1.05]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), toon(0xd4af37, { paint: false }));
    cap.position.set(px, 2.95, 0);
    frame.add(cap);
  }
  const pivot = new THREE.Group();
  pivot.position.y = 2.85;
  frame.add(pivot);
  const bellGeo = new THREE.LatheGeometry([[0, 0], [0.32, 0], [0.3, 0.06], [0.22, 0.3], [0.17, 0.55], [0.1, 0.62], [0.04, 0.72], [0, 0.72]].map(([a, b]) => new THREE.Vector2(a, b)), 20);
  const bell = new THREE.Mesh(bellGeo, toon(0xc9a24a, { paint: false }));
  bell.rotation.x = Math.PI;
  bell.position.y = 0.05;
  bell.castShadow = true;
  pivot.add(bell);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), toon(0x5a4a2a, { paint: false }));
  clapper.position.y = -0.62;
  pivot.add(clapper);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.2), toon(0xb3121f, { paint: false }));
  rope.position.y = -1.3;
  pivot.add(rope);
  // marigold garland on the beam
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), toon(i % 2 ? 0xf6a21e : 0xffc93c, { paint: false }));
    const u = i / 8;
    m.position.set(-0.9 + u * 1.8, 2.78 - Math.sin(u * Math.PI) * 0.18, 0.17);
    frame.add(m);
  }
  frame.traverse((o) => (o.frustumCulled = false));
  parent.add(frame);
  const w = L.w(x, 0, z);
  cols.addCircle(w.x, w.z, 0.6, 1.5);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 40).rotateX(-Math.PI / 2), bend(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.3, 0.45), transparent: true, opacity: 0.7, depthWrite: false })));
  ring.position.copy(w).setY(0.1);
  ring.frustumCulled = false;
  parent.add(ring);
  let swing = 0, swingV = 0;
  return {
    /** Where the visitor stands to pull the rope (flat world). */
    stand: L.w(x, 0, z + 1.2),
    ring() {
      swingV = 3.2;
    },
    update(t: number, dt: number, highlight: boolean) {
      swingV += (-swing * 18 - swingV * 2.2) * dt;
      swing += swingV * dt;
      pivot.rotation.x = swing;
      ring.visible = highlight;
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.3 * Math.sin(t * 3);
    },
  };
}
