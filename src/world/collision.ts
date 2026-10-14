/** 2D collision on the XZ plane: player circle vs oriented boxes and circles, with a spatial hash. */
export interface BoxCollider {
  kind: 'box';
  x: number;
  z: number;
  hw: number; // half width (local x)
  hd: number; // half depth (local z)
  yaw: number;
  /** Rays for camera occlusion ignore low colliders (railings). */
  height: number;
}
export interface CircleCollider {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
  height: number;
}
export type Collider = BoxCollider | CircleCollider;

const CELL = 16;

export class CollisionWorld {
  private grid = new Map<string, Collider[]>();
  all: Collider[] = [];
  // the far edge reaches Nodir Opare's deck out on the river (the river's edge, the bridge rails and
  // the deck rails keep everyone out of the water itself)
  bounds = { minX: -200, maxX: 200, minZ: -200, maxZ: 160 };
  /** Radial limit (island coast). */
  radius = 1e9;

  addBox(x: number, z: number, w: number, d: number, yaw = 0, height = 6) {
    this.add({ kind: 'box', x, z, hw: w / 2, hd: d / 2, yaw, height });
  }
  addCircle(x: number, z: number, r: number, height = 3) {
    this.add({ kind: 'circle', x, z, r, height });
  }
  private add(c: Collider) {
    this.all.push(c);
    const ext = c.kind === 'box' ? Math.hypot(c.hw, c.hd) : c.r;
    for (let gx = Math.floor((c.x - ext) / CELL); gx <= Math.floor((c.x + ext) / CELL); gx++)
      for (let gz = Math.floor((c.z - ext) / CELL); gz <= Math.floor((c.z + ext) / CELL); gz++) {
        const k = gx + ',' + gz;
        let a = this.grid.get(k);
        if (!a) this.grid.set(k, (a = []));
        a.push(c);
      }
  }
  near(x: number, z: number, r: number): Collider[] {
    const out = new Set<Collider>();
    for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++)
      for (let gz = Math.floor((z - r) / CELL); gz <= Math.floor((z + r) / CELL); gz++)
        this.grid.get(gx + ',' + gz)?.forEach((c) => out.add(c));
    return [...out];
  }

  /** Push a circle out of all overlapping colliders (slides along walls). Returns resolved position. */
  resolve(x: number, z: number, r: number): { x: number; z: number; hit: boolean } {
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const c of this.near(x, z, r + 1)) {
        const p = pushOut(c, x, z, r);
        if (p) {
          x += p.x;
          z += p.z;
          moved = hit = true;
        }
      }
      if (!moved) break;
    }
    const b = this.bounds;
    const d = Math.hypot(x, z);
    if (d > this.radius) {
      x *= this.radius / d;
      z *= this.radius / d;
      hit = true;
    }
    x = Math.min(b.maxX, Math.max(b.minX, x));
    z = Math.min(b.maxZ, Math.max(b.minZ, z));
    return { x, z, hit };
  }

  /** Distance along a 2D ray (from, dir normalised) to the first collider taller than minHeight. */
  raycast(ox: number, oz: number, dx: number, dz: number, maxDist: number, minHeight: number): number {
    let best = maxDist;
    const steps = Math.ceil(maxDist / 4);
    const seen = new Set<Collider>();
    for (let i = 0; i <= steps; i++) {
      const px = ox + dx * i * 4, pz = oz + dz * i * 4;
      for (const c of this.near(px, pz, 5)) {
        // only solid boxes (buildings, walls) occlude the camera — never posts, trees or railings
        if (seen.has(c) || c.height < minHeight || c.kind !== 'box') continue;
        seen.add(c);
        const t = rayHit(c, ox, oz, dx, dz);
        if (t !== null && t < best) best = t;
      }
    }
    return best;
  }
}

function pushOut(c: Collider, x: number, z: number, r: number): { x: number; z: number } | null {
  if (c.kind === 'circle') {
    const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
    if (d >= m) return null;
    if (d < 1e-6) return { x: m, z: 0 };
    return { x: (dx / d) * (m - d), z: (dz / d) * (m - d) };
  }
  const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
  // world → local (rotation about Y by yaw: local x axis = (cos, -sin) in xz for three's Y rotation)
  const wx = x - c.x, wz = z - c.z;
  const lx = wx * cs - wz * sn;
  const lz = wx * sn + wz * cs;
  const qx = Math.max(-c.hw, Math.min(c.hw, lx));
  const qz = Math.max(-c.hd, Math.min(c.hd, lz));
  let ox = lx - qx, oz = lz - qz;
  let d = Math.hypot(ox, oz);
  let push: number;
  if (d > 1e-6) {
    if (d >= r) return null;
    push = r - d;
    ox /= d;
    oz /= d;
  } else {
    // centre inside box: push out along the shallowest axis
    const px = c.hw - Math.abs(lx), pz = c.hd - Math.abs(lz);
    if (px < pz) {
      ox = Math.sign(lx) || 1; oz = 0; push = px + r;
    } else {
      ox = 0; oz = Math.sign(lz) || 1; push = pz + r;
    }
  }
  // local → world
  const vx = ox * push, vz = oz * push;
  return { x: vx * cs + vz * sn, z: -vx * sn + vz * cs };
}

function rayHit(c: Collider, ox: number, oz: number, dx: number, dz: number): number | null {
  if (c.kind === 'circle') {
    const fx = ox - c.x, fz = oz - c.z;
    const b = fx * dx + fz * dz, cc = fx * fx + fz * fz - c.r * c.r;
    const disc = b * b - cc;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    return t >= 0 ? t : null;
  }
  const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
  const wx = ox - c.x, wz = oz - c.z;
  const lx = wx * cs - wz * sn, lz = wx * sn + wz * cs;
  const ldx = dx * cs - dz * sn, ldz = dx * sn + dz * cs;
  let tmin = -Infinity, tmax = Infinity;
  for (const [o, d, h] of [[lx, ldx, c.hw], [lz, ldz, c.hd]] as const) {
    if (Math.abs(d) < 1e-9) {
      if (o < -h || o > h) return null;
    } else {
      let t1 = (-h - o) / d, t2 = (h - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
    }
  }
  if (tmax < Math.max(tmin, 0)) return null;
  return tmin >= 0 ? tmin : null; // origin inside → ignore
}
