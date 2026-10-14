/** Street furniture: lamp posts, festival bulb strings, trees, benches, vehicles, food stalls. */
import * as THREE from 'three';
import { Batcher } from '../Batcher';
import { toon, glow, bend } from '../../rendering/materials';
import type { Rng } from '../../utils/rng';
import { ambassadorParts, wheelParts, WHEELS, WHEEL_R } from './ambassador';

const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const sph = new THREE.IcosahedronGeometry(0.5, 1);
const bulbGeo = new THREE.IcosahedronGeometry(0.5, 0); // bulbs are tiny glowing dots: 20 tris each
const ball = new THREE.IcosahedronGeometry(0.5, 2);
const cone = new THREE.ConeGeometry(0.5, 1, 8);
const torus = new THREE.TorusGeometry(0.5, 0.12, 6, 14);

/**
 * Festival bulbs: every bulb in the city is an instance of one of a few InstancedMeshes.
 * Two "phase" groups alternate brightness for a chasing-light twinkle at zero CPU cost per bulb.
 */
export class BulbSystem {
  private items: { p: THREE.Vector3; c: THREE.Color; phase: number; s: number }[] = [];
  mats: THREE.MeshBasicMaterial[] = [];
  add(p: THREE.Vector3, color: number, size = 0.13, phase = Math.random() < 0.5 ? 0 : 1) {
    this.items.push({ p: p.clone(), c: new THREE.Color(color), phase, s: size });
  }
  /** Catenary-ish string between two points. */
  string(a: THREE.Vector3, b: THREE.Vector3, sag: number, colors: number[], spacing = 0.6, wire?: Batcher) {
    const n = Math.max(2, Math.round(a.distanceTo(b) / spacing));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      this.add(p, colors[i % colors.length], 0.15, i % 2);
    }
    if (wire) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const p = new THREE.Vector3().lerpVectors(a, b, t);
        p.y -= Math.sin(t * Math.PI) * sag + 0.06;
        pts.push(p);
      }
      for (let i = 0; i < 8; i++) {
        const p0 = pts[i], p1 = pts[i + 1];
        const mid = p0.clone().add(p1).multiplyScalar(0.5);
        const len = p0.distanceTo(p1);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
        wire.add(cyl, toon(0x1a1622), new THREE.Matrix4().compose(mid, q, new THREE.Vector3(0.03, len, 0.03)), { shadow: false });
      }
    }
  }
  build(parent: THREE.Object3D) {
    for (const phase of [0, 1]) {
      const list = this.items.filter((i) => i.phase === phase);
      if (!list.length) continue;
      const mat = bend(new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(3) })) as THREE.MeshBasicMaterial;
      const im = new THREE.InstancedMesh(bulbGeo, mat, list.length);
      const m = new THREE.Matrix4();
      list.forEach((it, i) => {
        m.makeScale(it.s * 2, it.s * 2, it.s * 2).setPosition(it.p);
        im.setMatrixAt(i, m);
        im.setColorAt(i, it.c);
      });
      im.computeBoundingSphere();
      parent.add(im);
      this.mats.push(mat);
    }
    return this.items.length;
  }
  update(t: number, intensity = 1) {
    // two phases alternating gives the classic chasing-lights shimmer
    this.mats.forEach((m, i) => {
      const k = 0.55 + 0.45 * Math.max(0, Math.sin(t * 3.4 + i * Math.PI));
      m.color.setScalar(2.6 * k * intensity);
    });
  }
}

export function lampPost(b: Batcher, x: number, z: number, yaw: number, lamps: THREE.Vector3[]) {
  const base = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
  const iron = toon(0x2b3a3a);
  b.addMesh(cyl, iron, { x: 0, y: 2.6, z: 0 }, null, { x: 0.16, y: 5.2, z: 0.16 }, base);
  b.addMesh(cyl, iron, { x: 0, y: 0.35, z: 0 }, null, { x: 0.38, y: 0.7, z: 0.38 }, base);
  b.box(iron, 0.55, 5.1, 0, 1.2, 0.1, 0.1, 0, base);
  b.addMesh(cone, iron, { x: 1.1, y: 5.05, z: 0 }, new THREE.Euler(Math.PI, 0, 0), { x: 0.6, y: 0.35, z: 0.6 }, base);
  b.addMesh(sph, glow(0xffd38a, 3.2), { x: 1.1, y: 4.82, z: 0 }, null, 0.32, base, false);
  // marigold garland wrapped at the post
  for (let i = 0; i < 6; i++) {
    b.addMesh(sph, toon(i % 2 ? 0xf6a21e : 0xffc93c), { x: Math.cos(i) * 0.12, y: 3.3 - i * 0.18, z: Math.sin(i) * 0.12 }, null, 0.16, base, false);
  }
  lamps.push(new THREE.Vector3(1.1, 4.8, 0).applyMatrix4(base));
}

export function tree(b: Batcher, x: number, z: number, rng: Rng, scale = 1) {
  const s = scale * rng.range(0.85, 1.25);
  const trunk = toon(0x5a3d2b);
  const greens = [0x2f6b3a, 0x3b7d42, 0x24583a, 0x4a8a3a];
  const base = new THREE.Matrix4().makeRotationY(rng.range(0, 6.28)).setPosition(x, 0, z);
  b.addMesh(cyl, trunk, { x: 0, y: 1.6 * s, z: 0 }, new THREE.Euler(0.05, 0, 0.06), { x: 0.35 * s, y: 3.2 * s, z: 0.35 * s }, base);
  const blobs = rng.int(3, 5);
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * 6.28;
    b.addMesh(ball, toon(rng.pick(greens)), { x: Math.cos(a) * 1.0 * s, y: (3.6 + rng.range(-0.3, 0.6)) * s, z: Math.sin(a) * 1.0 * s }, null, rng.range(2.0, 2.8) * s, base);
  }
  b.addMesh(ball, toon(rng.pick(greens)), { x: 0, y: 4.6 * s, z: 0 }, null, 2.6 * s, base);
}

export function palm(b: Batcher, x: number, z: number, rng: Rng) {
  const base = new THREE.Matrix4().makeRotationY(rng.range(0, 6.28)).setPosition(x, 0, z);
  const h = rng.range(6, 8.5);
  const lean = rng.range(-0.15, 0.15);
  for (let i = 0; i < 6; i++) {
    const y = (i + 0.5) * (h / 6);
    b.addMesh(cyl, toon(0x6b5240), { x: lean * y, y, z: 0 }, new THREE.Euler(0, 0, -lean), { x: 0.32 - i * 0.02, y: h / 6 + 0.05, z: 0.32 - i * 0.02 }, base);
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 6.28;
    const m = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationZ(-0.5)).setPosition(lean * h, h, 0);
    b.add(new THREE.BoxGeometry(3.2, 0.06, 0.7).translate(1.5, 0, 0), toon(i % 2 ? 0x2f6b3a : 0x3f8a46), m.premultiply(base));
  }
}

export function bench(b: Batcher, x: number, z: number, yaw: number) {
  const base = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
  const wood = toon(0x7a4a2a), iron = toon(0x2b2b33);
  b.box(wood, 0, 0.5, 0, 2.0, 0.1, 0.6, 0, base);
  b.box(wood, 0, 0.9, -0.28, 2.0, 0.4, 0.08, 0, base);
  b.box(iron, -0.85, 0.25, 0, 0.08, 0.5, 0.55, 0, base);
  b.box(iron, 0.85, 0.25, 0, 0.08, 0.5, 0.55, 0, base);
}

export function taxi(b: Batcher, x: number, z: number, yaw: number) {
  const base = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
  for (const p of ambassadorParts()) b.add(p.geo, p.mat, p.m.clone().premultiply(base), { shadow: p.shadow });
  for (const [wx, wz] of WHEELS) for (const p of wheelParts()) b.add(p.geo, p.mat, new THREE.Matrix4().makeTranslation(wx, WHEEL_R, wz).premultiply(base), { shadow: p.shadow });
}

export function rickshaw(b: Batcher, x: number, z: number, yaw: number) {
  const base = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
  const red = toon(0x9b1c1c), wood = toon(0x5a3d2b), hood = toon(0x1e1e26);
  b.box(red, 0, 1.0, 0, 1.2, 0.5, 0.9, 0, base);
  b.box(red, 0, 1.4, -0.4, 1.2, 0.8, 0.12, 0, base);
  b.addMesh(cyl, hood, { x: 0, y: 1.9, z: -0.25 }, new THREE.Euler(0, 0, Math.PI / 2), { x: 1.1, y: 1.25, z: 1.1 }, base);
  for (const sx of [-0.7, 0.7]) {
    b.addMesh(torus, wood, { x: sx, y: 0.75, z: 0 }, new THREE.Euler(0, Math.PI / 2, 0), 1.4, base);
    b.box(wood, sx * 0.55, 0.9, 1.3, 0.06, 0.06, 2.4, -0.0, base, false);
  }
}


export function tram(b: Batcher, x: number, z: number, yaw: number) {
  const base = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
  const green = toon(0x3f6b4e), cream = toon(0xefe3c2), dark = toon(0x22242c);
  b.box(green, 0, 1.0, 0, 2.4, 1.2, 9.0, 0, base);
  b.box(cream, 0, 2.2, 0, 2.4, 1.2, 9.0, 0, base);
  b.box(green, 0, 2.95, 0, 2.5, 0.3, 9.2, 0, base);
  for (let i = -3; i <= 3; i++) {
    b.box(glow(0xffd99a, 1.3), 1.22, 2.25, i * 1.2, 0.04, 0.75, 0.9, 0, base, false);
    b.box(glow(0xffd99a, 1.3), -1.22, 2.25, i * 1.2, 0.04, 0.75, 0.9, 0, base, false);
  }
  b.box(dark, 0, 0.3, 0, 2.0, 0.4, 8.0, 0, base);
  b.box(dark, 0, 3.6, 0, 0.06, 1.2, 0.06, 0.4, base, false);
}
