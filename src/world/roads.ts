/** Road sampling, distance queries and ribbon meshes. */
import * as THREE from 'three';
import { ROADS, type Road } from '../data/layout';

export interface RoadSample {
  road: Road;
  pts: THREE.Vector3[]; // y = 0
  normals: THREE.Vector3[];
  lengths: number[]; // cumulative arc length
}

export function sampleRoads(): RoadSample[] {
  return ROADS.map((road) => {
    const curve = new THREE.CatmullRomCurve3(road.pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const len = curve.getLength();
    const n = Math.max(4, Math.ceil(len / 2));
    const pts = curve.getSpacedPoints(n);
    const normals: THREE.Vector3[] = [];
    const lengths: number[] = [0];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const t = b.clone().sub(a).normalize();
      normals.push(new THREE.Vector3(-t.z, 0, t.x));
      if (i > 0) lengths.push(lengths[i - 1] + pts[i].distanceTo(pts[i - 1]));
    }
    return { road, pts, normals, lengths };
  });
}

/** Signed clearance from (x,z) to the nearest road edge (negative = on a road). */
export class RoadField {
  private segs: { ax: number; az: number; bx: number; bz: number; hw: number }[] = [];
  private grid = new Map<string, number[]>();
  constructor(samples: RoadSample[]) {
    for (const s of samples)
      for (let i = 0; i < s.pts.length - 1; i++) {
        const a = s.pts[i], b = s.pts[i + 1];
        const idx = this.segs.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, hw: s.road.width / 2 }) - 1;
        const k = `${Math.floor((a.x + b.x) / 2 / 20)},${Math.floor((a.z + b.z) / 2 / 20)}`;
        let arr = this.grid.get(k);
        if (!arr) this.grid.set(k, (arr = []));
        arr.push(idx);
      }
  }
  /** Nearest point on any road centreline (searches a widening neighbourhood). */
  nearest(x: number, z: number): { x: number; z: number; d: number } {
    let best = { x, z, d: Infinity };
    for (let ring = 1; ring <= 4 && best.d === Infinity; ring++) {
      const gx = Math.floor(x / 20), gz = Math.floor(z / 20);
      for (let i = -ring; i <= ring; i++)
        for (let j = -ring; j <= ring; j++) {
          const arr = this.grid.get(`${gx + i},${gz + j}`);
          if (!arr) continue;
          for (const si of arr) {
            const s = this.segs[si];
            const dx = s.bx - s.ax, dz = s.bz - s.az;
            const l2 = dx * dx + dz * dz || 1;
            const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / l2));
            const px = s.ax + dx * t, pz = s.az + dz * t;
            const d = Math.hypot(x - px, z - pz);
            if (d < best.d) best = { x: px, z: pz, d };
          }
        }
    }
    return best;
  }

  clearance(x: number, z: number): number {
    let best = Infinity;
    const gx = Math.floor(x / 20), gz = Math.floor(z / 20);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) {
        const arr = this.grid.get(`${gx + i},${gz + j}`);
        if (!arr) continue;
        for (const si of arr) {
          const s = this.segs[si];
          const dx = s.bx - s.ax, dz = s.bz - s.az;
          const l2 = dx * dx + dz * dz || 1;
          const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / l2));
          const d = Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t)) - s.hw;
          if (d < best) best = d;
        }
      }
    return best;
  }
}

/** Ribbon mesh along a sampled road at height y with given half-width. */
export function ribbon(s: RoadSample, halfW: number, y: number, offset = 0): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  s.pts.forEach((p, i) => {
    const n = s.normals[i];
    const c = p.clone().addScaledVector(n, offset);
    pos.push(c.x + n.x * halfW, y, c.z + n.z * halfW, c.x - n.x * halfW, y, c.z - n.z * halfW);
    uv.push(0, s.lengths[i] / 4, 1, s.lengths[i] / 4);
    if (i > 0) {
      const k = i * 2;
      idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // ensure upward normals regardless of winding
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  return g;
}

/** Dashed centre-line pieces along a road. */
export function dashes(s: RoadSample, every = 6, len = 3): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = [];
  for (let i = 0; i < s.pts.length; i++) {
    if (Math.floor(s.lengths[i] / every) === Math.floor((s.lengths[i - 1] ?? -1) / every)) continue;
    const p = s.pts[i], n = s.normals[i];
    const yaw = Math.atan2(n.z, -n.x); // tangent = (n.z, -n.x)
    out.push(new THREE.Matrix4().makeRotationY(yaw).setPosition(p.x, 0.035, p.z).multiply(new THREE.Matrix4().makeScale(0.18, 0.02, len)));
  }
  return out;
}
