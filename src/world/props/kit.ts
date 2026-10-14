/**
 * Reusable architectural pieces for Bengali buildings, built once and instanced into batches:
 * arched fanlights, khorkhori louvred shutters, lathe-turned balusters and urns, balcony brackets,
 * panelled doors. All geometry is non-indexed-friendly and shares the toon look.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const lathe = (pts: [number, number][], seg = 8) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

/** Half-disc fanlight (flat, facing +z), radius 0.5, base at y=0. */
export const fanlight = (() => {
  const g = new THREE.CircleGeometry(0.5, 16, 0, Math.PI);
  return g;
})();

/** Half-ring arch moulding, radius 0.5, facing +z. */
export const archRim = new THREE.TorusGeometry(0.5, 0.07, 4, 12, Math.PI);

/** Multi-foliate (scalloped) arch rim used on thakur-dalan style arcades. */
export const scallopRim = (() => {
  const parts: THREE.BufferGeometry[] = [];
  const lobes = 5;
  for (let i = 0; i < lobes; i++) {
    const a0 = (i / lobes) * Math.PI, a1 = ((i + 1) / lobes) * Math.PI, am = (a0 + a1) / 2;
    const r = 0.5, lr = Math.sin((a1 - a0) / 2) * r * 1.05;
    const t = new THREE.TorusGeometry(lr, 0.05, 4, 8, Math.PI);
    t.rotateZ(am - Math.PI / 2);
    t.translate(Math.cos(am) * r * 0.92, Math.sin(am) * r * 0.92, 0);
    parts.push(t);
  }
  return mergeGeometries(parts)!;
})();

/** Khorkhori shutter leaf: frame + horizontal louvres. Size 1×1 (scaled per window), facing +z. */
export const louvreLeaf = (() => {
  const parts: THREE.BufferGeometry[] = [];
  const frame = (w: number, h: number, x: number, y: number) => parts.push(new THREE.BoxGeometry(w, h, 0.08).translate(x, y, 0));
  frame(1, 0.07, 0, 0.465);
  frame(1, 0.07, 0, -0.465);
  frame(0.08, 1, 0.46, 0);
  frame(0.08, 1, -0.46, 0);
  frame(1, 0.06, 0, 0.0);
  for (let i = 0; i < 6; i++) {
    const y = -0.42 + (i + 0.5) * (0.84 / 6);
    if (Math.abs(y) < 0.04) continue;
    const s = new THREE.BoxGeometry(0.86, 0.045, 0.05);
    s.rotateX(-0.5);
    s.translate(0, y, 0.01);
    parts.push(s);
  }
  return mergeGeometries(parts)!;
})();

/** Panelled double door 1×1, facing +z. */
export const panelDoor = (() => {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(new THREE.BoxGeometry(1, 1, 0.05));
  for (const x of [-0.25, 0.25])
    for (const y of [-0.25, 0.22]) parts.push(new THREE.BoxGeometry(0.34, y > 0 ? 0.36 : 0.4, 0.04).translate(x, y, 0.035));
  parts.push(new THREE.BoxGeometry(0.02, 1, 0.07).translate(0, 0, 0.03));
  return mergeGeometries(parts)!;
})();

/** Turned baluster, height 1. */
export const baluster = lathe([[0, 0], [0.16, 0], [0.16, 0.1], [0.17, 0.42], [0.07, 0.78], [0.15, 0.9], [0.15, 1], [0, 1]], 6);

/** Rooftop urn finial, height ~1. */
export const urn = lathe([[0, 0], [0.22, 0], [0.22, 0.1], [0.12, 0.18], [0.3, 0.42], [0.12, 0.72], [0.16, 0.8], [0.06, 0.92], [0, 1.05]], 8);

/** Cast-iron balcony bracket (quarter-curve), 1×1 in YZ, attached to the wall at z=0. */
export const bracket = (() => {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.lineTo(0, 1);
  sh.lineTo(1, 1);
  sh.quadraticCurveTo(0.25, 0.85, 0.12, 0.0);
  sh.lineTo(0, 0);
  const hole = new THREE.Path();
  hole.absarc(0.35, 0.62, 0.17, 0, Math.PI * 2, true);
  // (curveSegments kept low: brackets are small and read through their outline)
  sh.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false, curveSegments: 3 });
  g.translate(0, 0, -0.03);
  g.rotateY(-Math.PI / 2); // shape x → +z (out of the wall)
  return g;
})();

/** Small decorative ring for iron railings. */
export const ring = new THREE.TorusGeometry(0.12, 0.018, 3, 8);

/** Pot with a tulsi/plant blob. */
export const pot = lathe([[0, 0], [0.16, 0], [0.22, 0.28], [0.24, 0.32], [0, 0.32]], 6);
export const blob = new THREE.IcosahedronGeometry(0.3, 0);

export const cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
export const cyl12 = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
