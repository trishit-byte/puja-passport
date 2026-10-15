/**
 * Builds the static city: ground, roads, plazas, buildings, street furniture, festival lights,
 * river and ghat. Pandals are built by their own builders (src/world/pandals) and registered here.
 */
import * as THREE from 'three';
import { releaseImageAfterUpload } from '../utils/geometry';
import { Batcher, unitBox } from './Batcher';
import { CollisionWorld } from './collision';
import { sampleRoads, RoadField, ribbon, dashes, type RoadSample } from './roads';
import { buildBuilding, type BuildingStyle } from './props/buildings';
import { BulbSystem, lampPost, tree, palm, bench, taxi, rickshaw } from './props/street';
import { toon, glow, bend, soft } from '../rendering/materials';
void glow;
import { PLAZAS, RIVER_Z, GHAT_TOP_Z, groundHeight, ISLAND_R, RIVER_PANDAL, LANDMARKS } from '../data/layout';
import { buildStatue, buildMandir } from './props/landmarks';
import { PLANET_R, planetUniform, normalAt, toPlanet } from '../utils/planet';
import { PANDALS, districtAt, type DistrictId } from '../data/pandals';
import type { ShopKind } from './props/signs';
import { Rng } from '../utils/rng';

interface Footprint {
  x: number;
  z: number;
  hw: number;
  hd: number;
  yaw: number;
}

const DISTRICT_LIGHTS: Record<DistrictId, number[]> = {
  // Chandannagar-style multicolour strings — saturated, festive, never just white
  bonedi: [0xffc93c, 0xff3d6e, 0xffe8b0, 0xff8a1a, 0x4dd4ff],
  alok: [0xffc93c, 0xff2d9a, 0x2de8ff, 0x8aff4a, 0xb05aff, 0xff6a1a],
  mela: [0xff6a1a, 0xffd23c, 0xff2d6a, 0x3dffb0, 0x5a8aff],
  notun: [0x2de8ff, 0xc05aff, 0xff4fd8, 0x7fffd4, 0xffd23c],
  ghat: [0xffc93c, 0xff8a3a, 0xffe8b0, 0x6ad8ff],
};

export class World {
  root = new THREE.Group();
  colliders = new CollisionWorld();
  bulbs = new BulbSystem();
  lampPositions: THREE.Vector3[] = [];
  roads: RoadSample[] = [];
  field!: RoadField;
  footprints: Footprint[] = [];
  /** Where each open shop's attendant stands (behind the counter), facing the street. */
  shopkeepers: { pos: THREE.Vector3; yaw: number; kind: ShopKind; shop: number }[] = [];
  benches: { x: number; z: number; yaw: number }[] = [];
  stats = { buildings: 0, meshes: 0, triangles: 0, bulbs: 0 };
  water!: THREE.Mesh;
  waterUniforms = { uTime: { value: 0 }, uSky: { value: new THREE.Color(0x1b1f3b) }, uGlow: { value: new THREE.Color(0xffb36b) } };
  lightPools!: THREE.InstancedMesh;
  private rng: Rng;
  batch = new Batcher();
  /** Extra exclusion circles (pandal plots, plazas, stall spots…). */
  exclusions: { x: number; z: number; r: number }[] = [];

  constructor(seed: number) {
    this.rng = new Rng(seed);
  }

  build(extraExclusions: { x: number; z: number; r: number }[] = []) {
    this.roads = sampleRoads();
    this.field = new RoadField(this.roads);
    this.exclusions.push(...PLAZAS, ...PANDALS.map((p) => ({ x: p.x, z: p.z, r: p.radius + 2 })), ...LANDMARKS, ...extraExclusions);
    this.ground();
    this.roadMeshes();
    this.streetBuildings();
    this.backfill();
    this.landmarks();
    this.streetFurniture();
    this.festivalLights();
    this.riverAndGhat();
    this.perimeter();
    return this;
  }

  finish() {
    // standalone meshes (roads, plazas, bulbs, pools) span large areas in flat space: never frustum-cull them
    this.root.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.frustumCulled = false) : 0));
    const s = this.batch.build(this.root);
    this.stats.meshes += s.meshes;
    this.stats.triangles += s.triangles;
    this.stats.bulbs = this.bulbs.build(this.root);
    this.buildLightPools();
    for (const c of this.root.children) if ((c as THREE.InstancedMesh).isInstancedMesh) c.frustumCulled = false;
  }

  private ground() {
    // island land mass: a grid clipped to a rounded coastline, sloping down to the sea at the edge.
    // Fine subdivision keeps the planet mapping smooth.
    const pos: number[] = [];
    const C = 3;
    const h = (x: number, z: number) => {
      const d = Math.hypot(x, z);
      return -4.5 * Math.min(1, Math.max(0, (d - ISLAND_R + 10) / 14));
    };
    for (let x = -ISLAND_R - 6; x < ISLAND_R + 6; x += C)
      for (let z = -ISLAND_R - 6; z < GHAT_TOP_Z; z += C) {
        const cx = x + C / 2, cz = z + C / 2;
        if (Math.hypot(cx, cz) > ISLAND_R + 6) continue;
        const z1 = Math.min(z + C, GHAT_TOP_Z);
        const q = [[x, z], [x + C, z], [x + C, z1], [x, z1]].map(([a, b]) => [a, h(a, b), b]);
        for (const i of [0, 2, 1, 0, 3, 2]) pos.push(...q[i]);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, soft(0x6f655e));
    m.receiveShadow = true;
    m.frustumCulled = false;
    this.root.add(m);
    // grass patches: park, rural edge, river bank
    const grass = soft(0x3e6b3a);
    for (const [x, z, r] of [[120, -30, 22], [-128, 48, 26], [112, -82, 20], [150, 60, 18], [-150, -100, 16]] as const) {
      const d = new THREE.Mesh(new THREE.RingGeometry(0, r, 40, 8).rotateX(-Math.PI / 2), grass);
      d.position.set(x, 0.02, z);
      d.receiveShadow = true;
      this.root.add(d);
    }
    // plazas paved with lighter stone + a central alpona ring
    for (const p of PLAZAS) {
      if (p.z > GHAT_TOP_Z) continue;
      const d = new THREE.Mesh(new THREE.RingGeometry(0, p.r, 48, 8).rotateX(-Math.PI / 2), soft(0x9c8f7c));
      d.position.set(p.x, 0.03, p.z);
      d.receiveShadow = true;
      this.root.add(d);
    }
  }

  private roadMeshes() {
    const asphalt = soft(0x34313d), curb = soft(0xb8ad9c), lane = soft(0x7a5644), stripe = toon(0xe9e2d0), rail = soft(0x9aa3ab);
    for (const s of this.roads) {
      const isLane = s.road.kind === 'lane';
      const m = new THREE.Mesh(ribbon(s, s.road.width / 2, isLane ? 0.04 : 0.05), isLane ? lane : asphalt);
      m.receiveShadow = true;
      this.root.add(m);
      if (!isLane) {
        for (const side of [1, -1]) {
          const c = new THREE.Mesh(ribbon(s, 0.25, 0.12, side * (s.road.width / 2 + 0.2)), curb);
          c.receiveShadow = true;
          this.root.add(c);
        }
        for (const d of dashes(s)) this.batch.add(unitBox, stripe, d, { shadow: false });
      }
      if (s.road.tram) {
        for (const off of [-0.75, 0.75]) this.root.add(new THREE.Mesh(ribbon(s, 0.07, 0.07, off), rail));
      }
    }
  }

  private blocked(x: number, z: number, hw: number, hd: number, yaw: number, roadMargin: number): boolean {
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const pts: [number, number][] = [[0, 0]];
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]) pts.push([a * hw, b * hd]);
    for (const [lx, lz] of pts) {
      const wx = x + lx * cs + lz * sn, wz = z - lx * sn + lz * cs;
      if (this.field.clearance(wx, wz) < roadMargin) return true;
      if (wz > GHAT_TOP_Z - 6 || Math.abs(wx) > 168 || wz < -152) return true;
    }
    const rad = Math.hypot(hw, hd);
    for (const e of this.exclusions) if (Math.hypot(e.x - x, e.z - z) < e.r + rad * 0.7) return true;
    for (const f of this.footprints) if (obbOverlap(f, { x, z, hw: hw + 0.3, hd: hd + 0.3, yaw })) return true;
    return false;
  }

  private styleFor(d: DistrictId, onMain: boolean): { style: BuildingStyle; floors: [number, number] } {
    const r = this.rng;
    switch (d) {
      case 'bonedi':
        return { style: r.chance(0.55) ? 'bonedi' : r.chance(0.3) ? 'shop' : 'para', floors: [2, 3] };
      case 'alok':
        return { style: r.chance(0.3) ? 'shop' : 'para', floors: [2, 4] };
      case 'mela':
        return { style: onMain || r.chance(0.6) ? 'shop' : 'para', floors: [2, 4] };
      case 'notun':
        return { style: r.chance(0.8) ? 'modern' : 'shop', floors: [3, 6] };
      case 'ghat':
        return { style: onMain || r.chance(0.3) ? 'shop' : r.chance(0.5) ? 'bonedi' : 'para', floors: [1, 2] };
    }
  }

  /** Statues and the mandir, each turned to face its nearest street. */
  private landmarks() {
    const ctx = { root: this.root, batch: this.batch, colliders: this.colliders, bulbs: this.bulbs };
    for (const l of LANDMARKS) {
      const n = this.field.nearest(l.x, l.z);
      const yaw = Math.atan2(n.x - l.x, n.z - l.z);
      if (l.kind === 'mandir') buildMandir(ctx, l, yaw);
      else buildStatue(ctx, l, yaw);
      this.footprints.push({ x: l.x, z: l.z, hw: l.r * 0.6, hd: l.r * 0.6, yaw });
    }
  }

  private place(x: number, z: number, w: number, d: number, yaw: number, district: DistrictId, onMain: boolean, margin: number, detail = true, street = true) {
    if (this.blocked(x, z, w / 2, d / 2, yaw, margin)) return false;
    let { style, floors } = this.styleFor(district, onMain);
    if (!street && style === 'shop') style = 'para'; // shops open onto a street, never a back lane
    const f = this.rng.int(floors[0], floors[1]);
    const res = buildBuilding(this.batch, { x, z, yaw, w, d, floors: f, style, detail, district }, this.rng);
    if (res.keeper) {
      this.shopkeepers.push({ pos: res.keeper, yaw, kind: res.shopKind!, shop: res.shopIndex });
      // the counter and the shopkeeper's space are solid: you shop from the pavement
      const sw = Math.min(w - 1.2, 6), fx = Math.sin(yaw), fz = Math.cos(yaw), off = d / 2 + 0.8;
      this.colliders.addBox(x + fx * off, z + fz * off, sw, 1.6, yaw, 1.1);
    }
    this.colliders.addBox(x, z, w, d, yaw, f * 3.3);
    this.footprints.push({ x, z, hw: w / 2, hd: d / 2, yaw });
    this.stats.buildings++;
    return true;
  }

  private streetBuildings() {
    const r = this.rng;
    for (const s of this.roads) {
      if (s.road.id.startsWith('river')) continue;
      const total = s.lengths[s.lengths.length - 1];
      for (const side of [1, -1]) {
        let t = r.range(2, 6);
        while (t < total - 2) {
          const i = s.lengths.findIndex((L) => L >= t);
          const p = s.pts[i], n = s.normals[i];
          const w = r.range(6, 10), d = r.range(7, 11);
          const sidewalk = s.road.kind === 'lane' ? 1.0 : 2.6;
          const off = s.road.width / 2 + sidewalk + d / 2;
          const x = p.x + n.x * side * off, z = p.z + n.z * side * off;
          const yaw = Math.atan2(-n.x * side, -n.z * side); // front (+z local) faces the road
          const district = districtAt(x, z);
          const ok = this.place(x, z, w, d, yaw, district, s.road.kind === 'main', sidewalk - 0.4);
          t += ok ? w + r.range(0.2, 1.2) + (r.chance(0.12) ? 4 : 0) : 3;
        }
      }
    }
  }

  private backfill() {
    const r = this.rng;
    // the whole island, out to just inside the coast, so no edge of the city stands bare
    for (let x = -180; x <= 180; x += 11)
      for (let z = -178; z <= 90; z += 11) {
        const jx = x + r.range(-3, 3), jz = z + r.range(-3, 3);
        if (Math.hypot(jx, jz) > ISLAND_R - 22) continue;
        if (this.field.clearance(jx, jz) < 9) continue;
        // face the nearest street, snapped to a right angle so inner blocks stay orderly
        const n = this.field.nearest(jx, jz);
        const raw = Math.atan2(n.x - jx, n.z - jz);
        const yaw = Math.round(raw / (Math.PI / 2)) * (Math.PI / 2) + r.range(-0.06, 0.06);
        this.place(jx, jz, r.range(7, 10), r.range(7, 10), yaw, districtAt(jx, jz), false, 2, n.d < 12, n.d < 9);
      }
  }

  private streetFurniture() {
    const r = this.rng;
    for (const s of this.roads) {
      const total = s.lengths[s.lengths.length - 1];
      const every = s.road.kind === 'lane' ? 14 : 22;
      let side = 1;
      for (let t = 6; t < total - 3; t += every) {
        const i = s.lengths.findIndex((L) => L >= t);
        const p = s.pts[i], n = s.normals[i];
        const off = s.road.width / 2 + (s.road.kind === 'lane' ? 0.5 : 1.3);
        const x = p.x + n.x * side * off, z = p.z + n.z * side * off;
        if (z > GHAT_TOP_Z + 1) continue;
        // keep pandal gateways and plots clear of street furniture
        if (PANDALS.some((pd) => Math.hypot(pd.x - x, pd.z - z) < pd.radius + 4)) {
          side = -side;
          continue;
        }
        // at a junction this kerb line crosses the side street: never stand a post in a carriageway
        if (this.field.clearance(x, z) < 0.6) {
          side = -side;
          continue;
        }
        const yaw = Math.atan2(n.x * side, n.z * side) - Math.PI / 2;
        lampPost(this.batch, x, z, Math.atan2(-n.x * side, -n.z * side) - Math.PI / 2, this.lampPositions);
        this.colliders.addCircle(x, z, 0.3, 5);
        void yaw;
        // trees between lamps on wide streets
        if (s.road.kind !== 'lane' && r.chance(0.45)) {
          const tt = Math.min(total - 1, t + every / 2);
          const j = s.lengths.findIndex((L) => L >= tt);
          const q = s.pts[j], m = s.normals[j];
          const tx = q.x - m.x * side * off, tz = q.z - m.z * side * off;
          if (this.field.clearance(tx, tz) > 0.4 && !this.blocked(tx, tz, 0.4, 0.4, 0, 0.4) && !PANDALS.some((pd) => Math.hypot(pd.x - tx, pd.z - tz) < pd.radius + 4)) {
            if (districtAt(tx, tz) === 'ghat' || districtAt(tx, tz) === 'notun') palm(this.batch, tx, tz, r);
            else tree(this.batch, tx, tz, r, 0.9);
            this.colliders.addCircle(tx, tz, 0.5, 6);
          }
        }
        side = -side;
      }
    }
    // parked vehicles along the main roads
    // (tight against the kerb, clear of the traffic lanes; narrow streets have no room to park)
    for (const s of this.roads.filter((x) => x.road.kind !== 'lane' && x.road.width >= 10)) {
      const total = s.lengths[s.lengths.length - 1];
      for (let t = 15; t < total - 10; t += r.range(18, 40)) {
        const i = s.lengths.findIndex((L) => L >= t);
        const p = s.pts[i], n = s.normals[i];
        const side = r.chance(0.5) ? 1 : -1;
        const off = s.road.width / 2 - 1.0;
        const x = p.x + n.x * side * off, z = p.z + n.z * side * off;
        if (PLAZAS.some((pl) => Math.hypot(pl.x - x, pl.z - z) < pl.r + 3)) continue;
        if (PANDALS.some((pd) => Math.hypot(pd.x - x, pd.z - z) < pd.radius + 6)) continue;
        const yaw = Math.atan2(n.z, -n.x) + (r.chance(0.5) ? 0 : Math.PI);
        if (r.chance(0.55)) {
          taxi(this.batch, x, z, yaw);
          this.colliders.addBox(x, z, 1.8, 4.1, yaw, 1.8);
        } else {
          rickshaw(this.batch, x, z, yaw);
          this.colliders.addBox(x, z, 1.5, 2.6, yaw, 1.5);
        }
      }
    }
    // trees & benches in the park and plazas
    for (let i = 0; i < 14; i++) {
      const a = r.range(0, 6.28), d = r.range(8, 20);
      const x = 120 + Math.cos(a) * d, z = -30 + Math.sin(a) * d;
      if (this.field.clearance(x, z) < 1) continue;
      tree(this.batch, x, z, r, 1.2);
      this.colliders.addCircle(x, z, 0.6, 6);
    }
    for (const p of PLAZAS.slice(0, 3)) {
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.4;
        bench(this.batch, p.x + Math.cos(a) * (p.r - 2), p.z + Math.sin(a) * (p.r - 2), -a - Math.PI / 2);
        this.benches.push({ x: p.x + Math.cos(a) * (p.r - 2), z: p.z + Math.sin(a) * (p.r - 2), yaw: -a - Math.PI / 2 });
        this.colliders.addBox(p.x + Math.cos(a) * (p.r - 2), p.z + Math.sin(a) * (p.r - 2), 2, 0.7, -a - Math.PI / 2, 1);
      }
    }
  }

  private festivalLights() {
    const r = this.rng;
    for (const s of this.roads) {
      const kind = s.road.lights ?? 'none';
      if (kind === 'none') continue;
      const total = s.lengths[s.lengths.length - 1];
      const every = kind === 'arches' ? 11 : 7;
      for (let t = 4; t < total - 2; t += every) {
        const i = s.lengths.findIndex((L) => L >= t);
        const p = s.pts[i], n = s.normals[i];
        if (PANDALS.some((pd) => Math.hypot(pd.x - p.x, pd.z - p.z) < pd.radius + 5)) continue; // gateways stay clear
        const district = districtAt(p.x, p.z);
        const cols = DISTRICT_LIGHTS[district];
        const hw = s.road.width / 2 + 0.8;
        if (kind === 'arches') {
          // a Chandannagar-style gateway: two posts + a scalloped arch of bulbs
          const a = p.clone().addScaledVector(n, hw), b = p.clone().addScaledVector(n, -hw);
          if (this.field.clearance(a.x, a.z) < 0.4 || this.field.clearance(b.x, b.z) < 0.4) continue; // a post would stand in a crossing road
          for (const q of [a, b]) {
            this.batch.addMesh(unitBox, toon(0x3a2a1a), { x: q.x, y: 3.5, z: q.z }, null, { x: 0.25, y: 7, z: 0.25 });
            for (let y = 0.5; y < 7; y += 0.45) this.bulbs.add(new THREE.Vector3(q.x, y, q.z), cols[Math.floor(y * 2) % cols.length], 0.11);
            if (q.z < GHAT_TOP_Z) this.colliders.addCircle(q.x, q.z, 0.25, 7);
          }
          const N = 26;
          for (let k = 0; k <= N; k++) {
            const u = k / N;
            const q = new THREE.Vector3().lerpVectors(a, b, u);
            q.y = 7 + Math.sin(u * Math.PI) * 2.6 + Math.abs(Math.sin(u * Math.PI * 5)) * 0.4;
            this.bulbs.add(q, cols[k % cols.length], 0.13, k % 2);
            if (k % 2 === 0) {
              const q2 = q.clone();
              q2.y -= 0.6 + 0.3 * Math.sin(u * Math.PI);
              this.bulbs.add(q2, cols[(k + 2) % cols.length], 0.1, (k + 1) % 2);
            }
          }
        } else {
          // zig-zag strings across the street
          const j = s.lengths.findIndex((L) => L >= t + every);
          if (j < 0) continue;
          const q = s.pts[j], m = s.normals[j];
          const h = s.road.kind === 'lane' ? 4.6 : 6.2;
          const a = new THREE.Vector3(p.x + n.x * hw, h, p.z + n.z * hw);
          const b = new THREE.Vector3(q.x - m.x * hw, h, q.z - m.z * hw);
          this.bulbs.string(a, b, r.range(0.6, 1.1), cols, 0.55, this.batch);
          // a hanging fabric pennant line every few spans
          if (r.chance(0.35)) this.pennants(a.clone().setY(h + 0.4), b.clone().setY(h + 0.4));
        }
      }
    }
  }

  private pennants(a: THREE.Vector3, b: THREE.Vector3) {
    const n = Math.round(a.distanceTo(b) / 0.8);
    const colors = [0xb3121f, 0xf6a21e, 0xf4eedf, 0x2f6b4e, 0x7a3e9d];
    const tri = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.25, 0, 0), new THREE.Vector3(0.25, 0, 0), new THREE.Vector3(0, -0.5, 0)]);
    tri.computeVertexNormals();
    const yaw = Math.atan2(b.x - a.x, b.z - a.z) - Math.PI / 2;
    for (let i = 1; i < n; i++) {
      const u = i / n;
      const p = new THREE.Vector3().lerpVectors(a, b, u);
      p.y -= Math.sin(u * Math.PI) * 0.7;
      this.batch.addMesh(tri, toon(colors[i % colors.length], { side: THREE.DoubleSide }), p, new THREE.Euler(0, yaw, 0), 1, undefined, false);
    }
  }

  private riverAndGhat() {
    // ghat steps: slabs descending to the water along the island's south shore
    const stone = toon(0xb9a88e), stone2 = toon(0xa89679);
    for (let k = 0; k < 9; k++) {
      const z0 = GHAT_TOP_Z + (k * (RIVER_Z + 3 - GHAT_TOP_Z)) / 9;
      const y = groundHeight(0, z0 + 0.1);
      const half = Math.sqrt(Math.max(0, (ISLAND_R + 4) ** 2 - (z0 + 1) ** 2));
      // short segments: the planet mapping bends geometry per vertex, so long slabs would sag
      for (let x = -half; x < half; x += 5) this.batch.box(k % 2 ? stone : stone2, x + 2.5, y - 0.5, z0 + 1.0, 5.02, 1.0 + 0.001 * k, 2.0);
    }
    // the river's edge stops you walking into the water, except where the footbridge to Nodir Opare runs
    const gapL = RIVER_PANDAL.x - RIVER_PANDAL.bridge.hw - 0.1, gapR = RIVER_PANDAL.x + RIVER_PANDAL.bridge.hw + 0.1;
    this.colliders.addBox((-200 + gapL) / 2, RIVER_Z + 6, gapL + 200, 6, 0, 0.5);
    this.colliders.addBox((gapR + 200) / 2, RIVER_Z + 6, 200 - gapR, 6, 0, 0.5);
    this.ghatDressing();
    // the sea: a sphere just below the island, shaded in planet space
    const R = PLANET_R - 2.45;
    const geo = new THREE.SphereGeometry(R, 160, 96);
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...this.waterUniforms, uShore: { value: normalAt(0, 106) } },
      fog: false,
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(position); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uSky, uGlow, uShore; varying vec3 vN; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){
          vec2 p = vec2(atan(vN.x, vN.y), atan(vN.z, vN.y)) * ${R.toFixed(1)};
          float w = n(p * vec2(0.08, 0.45) + vec2(uTime * 0.25, 0.0)) * 0.6 + n(p * vec2(0.3, 1.4) - vec2(uTime * 0.5, 0.0)) * 0.4;
          vec3 c = mix(uSky * 0.6, uSky * 1.35, smoothstep(0.38, 0.75, w));
          // posterised ripple highlights
          c += vec3(0.9, 0.95, 1.0) * 0.08 * step(0.78, w);
          // warm reflected streaks of the ghat lamps near the shore
          float near = smoothstep(0.75, 0.05, acos(clamp(dot(vN, uShore), -1.0, 1.0)) * ${R.toFixed(1)} / 60.0);
          float streak = smoothstep(0.6, 0.9, n(vec2(p.x * 0.35, p.y * 0.05 + uTime * 0.1)));
          c += uGlow * streak * near * (0.5 + 0.5 * w);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.water = new THREE.Mesh(geo, mat);
    this.water.position.set(0, -PLANET_R, 0);
    this.water.frustumCulled = false;
    this.root.add(this.water);
    void planetUniform;
  }

  /**
   * The ghat on a Pujo night: the ghat priests' great bamboo umbrellas over their little wooden
   * platforms, small white Shiva shrines, lamp posts with lanterns, wooden country boats with
   * hooped bamboo roofs moored at the water's edge (lanterns hung on their prows), garlands left
   * on the steps, and clusters of floating diyas drifting out from the shore.
   */
  private ghatDressing() {
    const b = this.batch, r = this.rng;
    const top = GHAT_TOP_Z + 1.2;
    const bamboo = toon(0xb08a4a), straw = toon(0xc9a45a), strawDark = toon(0x9a7a3a), wood = toon(0x6b4a2f);
    const white = toon(0xf4eedf), red = toon(0xb3121f), marigold = toon(0xf6a21e);
    const xs: number[] = [];
    // keep Sunrise Ghat (x≈60) open, and the riverside plaza where the DJ podium stands over the steps
    const djGhat = PLAZAS.filter((pl) => pl.z > GHAT_TOP_Z && Math.abs(pl.x - 60) > 20);
    for (let x = -120; x <= 120; x += 9) if (Math.abs(x - 60) > 7 && Math.abs(x - RIVER_PANDAL.x) > 5 && !djGhat.some((pl) => Math.abs(x - pl.x) < pl.r + 9)) xs.push(x + r.range(-1.5, 1.5));
    xs.forEach((x, i) => {
      const k = i % 4;
      const z = top + 0.6;
      if (k === 0) {
        // the iconic ghat umbrella: a wide, shallow straw cone on a bamboo pole, a low plank platform
        const y = groundHeight(x, z);
        b.box(wood, x, y + 0.25, z, 2.0, 0.12, 1.6, 0);
        for (const [dx, dz] of [[-0.9, -0.7], [0.9, -0.7], [-0.9, 0.7], [0.9, 0.7]]) b.box(wood, x + dx, y + 0.1, z + dz, 0.1, 0.25, 0.1, 0);
        b.addMesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), bamboo, { x, y: y + 1.6, z }, null, { x: 1, y: 3.2, z: 1 }, undefined, false);
        b.addMesh(new THREE.ConeGeometry(1, 1, 16), straw, { x, y: y + 3.2, z }, null, { x: 2.3, y: 0.7, z: 2.3 });
        b.addMesh(new THREE.ConeGeometry(1, 1, 16, 1, true), strawDark, { x, y: y + 3.0, z }, null, { x: 2.35, y: 0.32, z: 2.35 }, undefined, false);
        b.box(red, x, y + 0.33, z, 1.6, 0.04, 1.2, 0, undefined, false); // a red cloth on the platform
        this.colliders.addBox(x, z, 2.0, 1.6, 0, 0.5);
      } else if (k === 2) {
        // small whitewashed Shiva shrine with a curved roof and a little trident
        const y = groundHeight(x, z);
        b.box(white, x, y + 0.6, z, 1.2, 1.2, 1.2, 0);
        b.box(toon(0x2a2024), x, y + 0.5, z + 0.61, 0.5, 0.8, 0.02, 0, undefined, false);
        b.addMesh(new THREE.ConeGeometry(1, 1, 8), white, { x, y: y + 1.65, z }, null, { x: 0.8, y: 0.9, z: 0.8 });
        b.addMesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 4), toon(0xd9b240), { x, y: y + 2.3, z }, null, { x: 1, y: 0.4, z: 1 }, undefined, false);
        b.box(marigold, x, y + 1.15, z + 0.63, 1.1, 0.06, 0.05, 0, undefined, false);
        this.colliders.addBox(x, z, 1.3, 1.3, 0, 2);
      } else {
        // lamp post with a lantern
        const y = groundHeight(x, z);
        b.addMesh(new THREE.CylinderGeometry(0.06, 0.08, 1, 6), toon(0x2a2a30), { x, y: y + 1.5, z: z - 0.4 }, null, { x: 1, y: 3, z: 1 }, undefined, false);
        this.bulbs.add(new THREE.Vector3(x, y + 3.15, z - 0.4), 0xffd38a, 0.22, 0);
        this.colliders.addCircle(x, z - 0.4, 0.2, 3);
      }
      // garlands and diyas left on the steps
      for (let j = 0; j < 3; j++) {
        const gx = x + r.range(-3, 3), gz = top + r.range(2, 9);
        const gy = groundHeight(gx, gz);
        if (r.chance(0.5)) for (let q = 0; q < 8; q++) b.addMesh(new THREE.SphereGeometry(0.06, 6, 4), q % 2 ? marigold : red, { x: gx + Math.cos(q * 0.8) * 0.3, y: gy + 0.05, z: gz + Math.sin(q * 0.8) * 0.18 }, null, 1, undefined, false);
        else this.bulbs.add(new THREE.Vector3(gx, gy + 0.08, gz), 0xffb33c, 0.07, j % 2);
      }
    });
    // country boats (nouka) moored at the water's edge, with hooped bamboo roofs (chhoi)
    const WY = -2.35; // water surface height
    for (let i = 0; i < 9; i++) {
      const x = -110 + i * 27 + r.range(-4, 4);
      if (Math.abs(x - 60) < 9) continue;
      if (Math.abs(x - RIVER_PANDAL.x) < RIVER_PANDAL.platform.hw + 7) continue; // Nodir Opare's deck and bridge
      const z = RIVER_Z + 4 + r.range(0, 6), yaw = r.range(-0.5, 0.5) + (i % 2 ? Math.PI / 2 : 0.3);
      const base = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, WY, z);
      const hull = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      b.addMesh(hull, toon(0x4a3020), { x: 0, y: 0.3, z: 0 }, null, { x: 0.9, y: 0.6, z: 3.2 }, base);
      b.addMesh(new THREE.TorusGeometry(1, 0.05, 4, 24), toon(0x6b4a2f), { x: 0, y: 0.3, z: 0 }, new THREE.Euler(Math.PI / 2, 0, 0), { x: 0.9, y: 3.2, z: 1 }, base, false);
      for (const pz of [-2.8, 2.8]) b.addMesh(new THREE.ConeGeometry(0.15, 0.7, 6), toon(0x4a3020), { x: 0, y: 0.55, z: pz }, new THREE.Euler(pz > 0 ? 0.9 : -0.9, 0, 0), 1, base, false); // raised prow & stern
      const roof = new THREE.CylinderGeometry(0.85, 0.85, 1.8, 14, 1, true, -Math.PI / 2, Math.PI);
      b.addMesh(roof, toon(0x8a6a3a, { side: THREE.DoubleSide }), { x: 0, y: 0.45, z: -0.4 }, new THREE.Euler(Math.PI / 2, 0, Math.PI / 2), 1, base);
      for (let k = -2; k <= 2; k++) b.addMesh(new THREE.TorusGeometry(0.85, 0.035, 4, 14, Math.PI), toon(0x5a3a1a), { x: 0, y: 0.45, z: -0.4 + k * 0.42 }, null, 1, base, false); // bamboo hoops
      this.bulbs.add(new THREE.Vector3(0, 1.4, 2.6).applyMatrix4(base), 0xffc96a, 0.16, i % 2);
      b.addMesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 4), toon(0x5a3a1a), { x: 0, y: 1.0, z: 2.6 }, null, { x: 1, y: 1.0, z: 1 }, base, false);
    }
    // floating diyas drifting out from the shore, thickest in front of Sunrise Ghat
    for (let i = 0; i < 140; i++) {
      const near = i < 60;
      const x = near ? 60 + r.range(-14, 14) : r.range(-130, 130), z = RIVER_Z + r.range(2, near ? 16 : 24);
      if (Math.hypot(x, z) > ISLAND_R + 30) continue;
      if (Math.abs(x - RIVER_PANDAL.x) < RIVER_PANDAL.platform.hw + 2 && z > RIVER_PANDAL.bridge.z0 - 1) continue; // not under the deck
      b.addMesh(new THREE.CylinderGeometry(0.12, 0.08, 0.06, 8), toon(0xb5562f), { x, y: WY + 0.03, z }, null, 1, undefined, false);
      this.bulbs.add(new THREE.Vector3(x, WY + 0.13, z), r.chance(0.8) ? 0xffb33c : 0xffe08a, 0.08, i % 2);
    }
  }

  private perimeter() {
    // a soft green coastline: trees, palms and a few tall houses ring the island
    const r = this.rng;
    for (let a = 0; a < Math.PI * 2; a += 0.035) {
      const rad = ISLAND_R - 14 + r.range(-3, 3);
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (z > GHAT_TOP_Z - 14) continue;
      if (this.field.clearance(x, z) < 2) continue;
      if (r.chance(0.35)) palm(this.batch, x, z, r);
      else tree(this.batch, x, z, r, 1.3);
      if (r.chance(0.5)) tree(this.batch, x * 1.04, z * 1.04, r, 1.1);
    }
    this.colliders.radius = ISLAND_R - 18;
  }

  private buildLightPools() {
    const tex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d')!;
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, 'rgba(255,255,255,0.9)');
      grd.addColorStop(0.4, 'rgba(255,255,255,0.35)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c);
      releaseImageAfterUpload(t);
      return t;
    })();
    const mat = bend(
      new THREE.MeshBasicMaterial({ map: tex, color: 0xffa04c, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.lightPools = new THREE.InstancedMesh(geo, mat, this.lampPositions.length);
    const m = new THREE.Matrix4();
    this.lampPositions.forEach((p, i) => {
      m.makeScale(9, 1, 9).setPosition(p.x, 0.09, p.z);
      this.lightPools.setMatrixAt(i, m);
    });
    this.lightPools.renderOrder = 2;
    this.root.add(this.lightPools);
  }

  private batched: THREE.Mesh[] = [];
  culling = { shown: 0, total: 0 };
  /**
   * Horizon culling: on a small planet, anything far enough round the curve is hidden below the
   * horizon. Skip drawing those batches entirely (big win; typically half the city or more).
   */
  /** Static cells further than this (m) cast no shadow (set from the graphics preset). */
  shadowReach = 1e9;
  /** How far small parts (grille bars, bricks, balusters…) are drawn: beyond it they're under a pixel. */
  fineReach = 140;
  cullHorizon(camX: number, camZ: number, camH: number) {
    if (!this.batched.length) this.batched = this.root.children.filter((c) => (c as THREE.Mesh).userData?.flatCenter) as THREE.Mesh[];
    const R = PLANET_R;
    const camT = Math.sqrt(2 * R * Math.max(1, camH));
    let shown = 0;
    for (const m of this.batched) {
      const c = m.userData.flatCenter as THREE.Vector3;
      const d = Math.hypot(c.x - camX, c.z - camZ);
      // a cell is visible if its tallest point can peek over the curve from the camera
      const reach = camT + Math.sqrt(2 * R * Math.max(0.5, m.userData.maxY as number)) + 4;
      m.visible = d - m.userData.flatRadius < Math.min(reach, m.userData.fine ? this.fineReach : Infinity);
      if (m.visible) shown++;
      // on lighter graphics settings only nearby cells cast shadows (where you can see them land)
      if (m.userData.casts === undefined) m.userData.casts = m.castShadow;
      m.castShadow = m.userData.casts && d - m.userData.flatRadius < this.shadowReach;
    }
    this.culling = { shown, total: this.batched.length };
  }

  /** True if no collider (building, stall, post, tree…) lies within `clear` metres of (x, z). */
  isClear(x: number, z: number, clear: number) {
    return !this.colliders.near(x, z, clear + 6).some((c) => {
      if (c.kind === 'circle') return Math.hypot(c.x - x, c.z - z) < c.r + clear;
      const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
      const wx = x - c.x, wz = z - c.z;
      const lx = wx * cs - wz * sn, lz = wx * sn + wz * cs;
      return Math.hypot(Math.max(0, Math.abs(lx) - c.hw), Math.max(0, Math.abs(lz) - c.hd)) < clear;
    });
  }

  mapPoint(x: number, y: number, z: number) {
    return toPlanet(x, y, z);
  }

  update(t: number) {
    this.waterUniforms.uTime.value = t;
    this.bulbs.update(t);
  }
}

function obbOverlap(a: Footprint, b: Footprint): boolean {
  if (Math.hypot(a.x - b.x, a.z - b.z) > Math.hypot(a.hw, a.hd) + Math.hypot(b.hw, b.hd)) return false;
  const axes = [a.yaw, a.yaw + Math.PI / 2, b.yaw, b.yaw + Math.PI / 2].map((y) => [Math.cos(y), -Math.sin(y)] as const);
  const corners = (f: Footprint) => {
    const cs = Math.cos(f.yaw), sn = Math.sin(f.yaw);
    return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([u, v]) => [f.x + u * f.hw * cs + v * f.hd * sn, f.z - u * f.hw * sn + v * f.hd * cs]);
  };
  const ca = corners(a), cb = corners(b);
  for (const [ax, az] of axes) {
    const pa = ca.map(([x, z]) => x * ax + z * az), pb = cb.map(([x, z]) => x * ax + z * az);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}
