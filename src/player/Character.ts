/**
 * Procedural stylised-realistic character used for the player and NPCs.
 * Proportions ≈ 5.6 heads (adult 1.62 m), slim limbs with knees and elbows, almond eyes,
 * layered hair, and clothing styles drawn from Puja-night streets: kurta-pyjama, sari with
 * laal-paar border and pallu, shirt-trousers, a dhaki's dhoti-kurta with dhak, and children's frocks.
 * Animation is procedural: walk↔jog blend from speed, idle breathing/blinking/glances, and gesture
 * poses (wave, eat, clap, drum, sit, pray, photo, dance).
 */
import * as THREE from 'three';
import { toon, batchMaterial } from '../rendering/materials';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lerp, damp } from '../utils/math';
import { ensureIndex, packNormals, compactIndex, releaseAfterUpload } from '../utils/geometry';

/**
 * Crowd bodies share their shape. The vertex layout of a baked body depends only on these look
 * fields, so everyone with the same key shares one copy of positions, normals, skin data and
 * index on the CPU and GPU; each person adds only a 3-byte-per-vertex colour buffer, itself
 * shared between people dressed identically.
 */
const shapeKey = (l: Look) => `${l.style}|${l.hair}|${!!l.elderly}|${!!l.glasses}|${(l.skin ?? 0) % 3 === 0}`;
type Shape = { index: THREE.BufferAttribute; attrs: Record<string, THREE.BufferAttribute>; count: number };
const shapes = new Map<string, Shape>();
const colours = new Map<string, THREE.BufferAttribute>();

/** Turn a freshly merged body into a shareable shape (compact formats; GPU-only after upload). */
function makeShape(key: string, merged: THREE.BufferGeometry): Shape {
  const n = merged.attributes.position.count;
  const bone = merged.attributes.bone as THREE.BufferAttribute;
  const si = new Uint8Array(n * 4), sw = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    si[i * 4] = bone.getX(i);
    sw[i * 4] = 255;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', merged.attributes.position);
  g.setAttribute('normal', merged.attributes.normal);
  g.setIndex(merged.index);
  packNormals(g);
  compactIndex(g);
  const shape = { index: g.index!, count: n, attrs: { position: g.attributes.position as THREE.BufferAttribute, normal: g.attributes.normal as THREE.BufferAttribute, skinIndex: new THREE.BufferAttribute(si, 4), skinWeight: new THREE.BufferAttribute(sw, 4, true) } };
  if (!shapes.has(key)) shapes.set(key, shape);
  releaseAfterUpload([...Object.values(shape.attrs), shape.index]);
  return shape;
}

/** Per-vertex outfit colours, 8-bit, in the same part order as the merged shape. */
function partColours(parts: { mesh: THREE.Mesh; cloth: boolean }[], count: number): THREE.BufferAttribute {
  const out = new Uint8Array(count * 3);
  let o = 0;
  const c8 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  for (const { mesh, cloth } of parts) {
    const n = mesh.geometry.attributes.position.count;
    const start = o;
    if (cloth) {
      const ca = mesh.geometry.attributes.color as THREE.BufferAttribute;
      for (let i = 0; i < n; i++, o += 3) {
        out[o] = c8(ca.getX(i));
        out[o + 1] = c8(ca.getY(i));
        out[o + 2] = c8(ca.getZ(i));
      }
      out.copyWithin(o, start, o); // the reversed back face repeats the same colours
      o += n * 3;
    } else {
      const col = (mesh.material as THREE.MeshToonMaterial).color;
      const r = c8(col.r), g = c8(col.g), b = c8(col.b);
      for (let i = 0; i < n; i++, o += 3) {
        out[o] = r;
        out[o + 1] = g;
        out[o + 2] = b;
      }
    }
  }
  return new THREE.BufferAttribute(out, 3, true);
}

/** Colours are shared between people dressed identically. */
function colourFor(look: Look, key: string, count: number, make: () => THREE.BufferAttribute): THREE.BufferAttribute {
  const ckey = key + JSON.stringify({ ...look, scale: 0 });
  let col = colours.get(ckey);
  if (!col || col.count !== count) {
    col = make();
    colours.set(ckey, col);
    releaseAfterUpload([col]);
  }
  return col;
}

function shareShape(shape: Shape, col: THREE.BufferAttribute): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(shape.attrs)) g.setAttribute(k, a);
  g.setAttribute('color', col);
  g.setIndex(shape.index);
  return g;
}

export interface Look {
  style: 'kurta' | 'sari' | 'shirt' | 'dhaki' | 'frock' | 'salwar' | 'tee';
  color: number;
  accent: number;
  hair: 'short' | 'bun' | 'braid' | 'bald' | 'grey';
  skin?: number;
  hairColor?: number;
  pants?: number;
  scale?: number; // children ~0.68
  elderly?: boolean;
  glasses?: boolean;
}

/**
 * Part geometries are shared by everyone with the same measurements, so building a crowd of
 * hundreds allocates each torus, box, lathe and drape once instead of once per person.
 */
const geoMemo = new Map<string, THREE.BufferGeometry>();
function memo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoMemo.get(key);
  if (!g) geoMemo.set(key, (g = make()));
  return g;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function geo<A extends any[]>(tag: string, C: new (...a: A) => THREE.BufferGeometry, ...a: A): THREE.BufferGeometry {
  return memo(tag + a.join(','), () => new C(...a));
}

const SPH = new THREE.SphereGeometry(1, 22, 16);
const SPH_LO = new THREE.SphereGeometry(1, 12, 8);
const cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 4, 12);
const capCache = new Map<string, THREE.BufferGeometry>();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const capC = (r: number, l: number) => {
  const k = r + '_' + l;
  let g = capCache.get(k);
  if (!g) capCache.set(k, (g = cap(r, l)));
  return g;
};

/** A tapered limb segment hanging down from its joint (top at y=0). */
const limbCache = new Map<string, THREE.BufferGeometry>();
function limbGeo(rTop: number, rBot: number, len: number): THREE.BufferGeometry {
  const k = `${rTop}|${rBot}|${len}`;
  let g = limbCache.get(k);
  if (!g) {
    g = geo('C', THREE.CylinderGeometry, rTop, rBot, len, 18, 1, false);
    g.translate(0, -len / 2, 0);
    limbCache.set(k, g);
  }
  return g;
}

/** A finger or thumb: a capsule hanging down from its knuckle (top at y≈0). */
const fingerCache = new Map<string, THREE.BufferGeometry>();
function fingerGeo(r: number, len: number): THREE.BufferGeometry {
  const k = `${r}|${len}`;
  let g = fingerCache.get(k);
  if (!g) {
    g = new THREE.CapsuleGeometry(r, len, 3, 8);
    g.translate(0, -len / 2, 0);
    fingerCache.set(k, g);
  }
  return g;
}

/** A lathe whose radius ripples around the axis — cloth folds that deepen toward the hem. */
function folded(pts: [number, number][], folds: number, amp: number): THREE.BufferGeometry {
  return memo(`f${folds}|${amp}|${pts}`, () => foldedGeo(pts, folds, amp));
}
function foldedGeo(pts: [number, number][], folds: number, amp: number): THREE.BufferGeometry {
  pts = upward(pts);
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), Math.max(24, folds * 4));
  const pos = g.attributes.position as THREE.BufferAttribute;
  const ys = pts.map((p) => p[1]);
  const top = Math.max(...ys), bot = Math.min(...ys);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.002) continue;
    const a = Math.atan2(z, x);
    const depth = Math.pow(Math.max(0, (top - y) / Math.max(1e-6, top - bot)), 1.4);
    const k = 1 + amp * depth * Math.sin(a * folds);
    pos.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A-line: below the waist a long kurta or kameez falls a little deeper front-to-back toward the
 * hem, so the thigh of a stepping leg stays inside the cloth instead of pushing through it.
 */
const aLines = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function aLine(src: THREE.BufferGeometry): THREE.BufferGeometry {
  let g = aLines.get(src);
  if (!g) {
    g = src.clone();
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < -0.05) pos.setZ(i, pos.getZ(i) * (1 + (-0.05 - y) * 1.1));
    }
    g.computeVertexNormals();
    aLines.set(src, g);
  }
  return g;
}

/** Lathe profiles must run bottom → top for outward-facing surfaces. */
function upward(pts: [number, number][]): [number, number][] {
  return pts[0][1] > pts[pts.length - 1][1] ? [...pts].reverse() : pts;
}

/** Darken/lighten a hex colour. */
function shade(hex: number, k: number): number {
  const c = new THREE.Color(hex).multiplyScalar(k);
  return c.getHex();
}

let clothMat: THREE.Material | null = null;
function clothMaterial() {
  if (!clothMat) clothMat = toonV();
  return clothMat;
}
function toonV() {
  const m = toon(0xffffff, { paint: false, side: THREE.DoubleSide }).clone();
  (m as THREE.MeshToonMaterial).vertexColors = true;
  m.onBeforeCompile = toon(0xffffff, { paint: false, side: THREE.DoubleSide }).onBeforeCompile;
  m.customProgramCacheKey = toon(0xffffff, { paint: false, side: THREE.DoubleSide }).customProgramCacheKey;
  return m;
}

/**
 * A cloth band (sari pallu, gamchha) following a curve: four vertices across, so the woven border
 * colour runs along both edges and the body colour fills the middle.
 */
function ribbon(pts: [number, number, number][], width: number, body: number, border: number): THREE.BufferGeometry {
  return memo(`r${width}|${body}|${border}|${pts}`, () => ribbonGeo(pts, width, body, border));
}
function ribbonGeo(pts: [number, number, number][], width: number, body: number, border: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const N = 28;
  const across = [-0.5, -0.36, 0.36, 0.5];
  const cb = new THREE.Color(body), cr = new THREE.Color(border);
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const c = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const out = new THREE.Vector3(c.x, 0, c.z).normalize(); // away from the body axis
    const side = new THREE.Vector3().crossVectors(tan, out).normalize();
    across.forEach((a, k) => {
      const p = c.clone().addScaledVector(side, a * width);
      pos.push(p.x, p.y, p.z);
      const cc = k === 0 || k === 3 ? cr : cb;
      col.push(cc.r, cc.g, cc.b);
    });
    if (i > 0)
      for (let k = 0; k < 3; k++) {
        const a0 = (i - 1) * 4 + k, b0 = i * 4 + k;
        idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
      }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export type Pose = 'none' | 'wave' | 'eat' | 'clap' | 'drum' | 'sit' | 'pray' | 'pranam' | 'aarti' | 'salute' | 'point' | 'foldarms' | 'holdbook' | 'photo' | 'dance' | 'dhunuchi' | 'nach';

const HIP_Y = 0.88;
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
/** Turns a prop so its local −y (where a held bowl sits) points straight up. */
const FLIP_UP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);

export class Character {
  group = new THREE.Group();
  private body = new THREE.Group();
  private hips = new THREE.Bone();
  private chest = new THREE.Bone();
  private head = new THREE.Bone();
  private thighL = new THREE.Bone();
  private thighR = new THREE.Bone();
  private shinL = new THREE.Bone();
  private shinR = new THREE.Bone();
  private armL = new THREE.Bone();
  private armR = new THREE.Bone();
  private foreL = new THREE.Bone();
  private foreR = new THREE.Bone();
  private skirt: THREE.Bone | null = null;
  private eyes: THREE.Object3D[] = [];
  private phase = Math.random() * 10;
  private blinkT = Math.random() * 3;
  private speedS = 0;
  private time = Math.random() * 10;
  pose: Pose = 'none';
  private poseW = 0;
  /** Stride length factor and limit for the outfit (see build). */
  private stride = 1;
  private strideCap = 1;
  /** Seconds since the current pose began (timed poses such as the kneeling pranam). */
  private poseT = 0;
  private lastPose: Pose = 'none';
  prop: THREE.Object3D | null = null;
  /** 0..1 music energy, makes dance poses bigger/faster. */
  energy = 0.6;
  /** Optional per-dancer tempo multiplier. */
  tempo = 1;
  private parts: THREE.Mesh[] = [];

  constructor(public look: Look, private baked = false) {
    this.group.add(this.body);
    this.build();
  }

  /**
   * Merge every bone's meshes into one vertex-coloured mesh (≈12 draw calls per character instead
   * of ~70). Used for NPC crowds; the player keeps separate parts for blinking eyes.
   */
  private bake() {
    // One skinned mesh per character: every part is rigidly weighted to its bone, so the whole
    // person is a single draw call while the procedural animation still drives the bones.
    const bones = [this.hips, this.chest, this.head, this.thighL, this.thighR, this.shinL, this.shinR, this.armL, this.armR, this.foreL, this.foreR];
    if (this.skirt) bones.push(this.skirt);
    const boneSet = new Set<THREE.Object3D>(bones);
    this.group.updateMatrixWorld(true);
    const rootInv = this.body.matrixWorld.clone().invert();
    // every part mesh, in a fixed order, with the bone it rides on
    const parts: { mesh: THREE.Mesh; bi: number; cloth: boolean }[] = [];
    bones.forEach((bone, bi) => {
      const kill: THREE.Object3D[] = [];
      const visit = (o: THREE.Object3D) => {
        for (const c of o.children) {
          if (boneSet.has(c)) continue;
          if ((c as THREE.Mesh).isMesh) parts.push({ mesh: c as THREE.Mesh, bi, cloth: !!(c as THREE.Mesh).geometry.attributes.color });
          visit(c);
          if (o === bone) kill.push(c);
        }
      };
      visit(bone);
      kill.forEach((k) => bone.remove(k));
    });
    if (!parts.length) return;
    // cloth parts (vertex-coloured) get a reversed copy so a front-side material shows both faces
    const count = parts.reduce((n, p) => n + p.mesh.geometry.attributes.position.count * (p.cloth ? 2 : 1), 0);
    const key = shapeKey(this.look);
    const shape = shapes.get(key);
    let geometry: THREE.BufferGeometry;
    if (shape && shape.count === count) {
      // a known shape: no geometry work at all, only this outfit's colours (often cached too)
      geometry = shareShape(shape, colourFor(this.look, key, count, () => partColours(parts, count)));
    } else {
      const geos: THREE.BufferGeometry[] = [];
      for (const { mesh, bi, cloth } of parts) {
        const g = ensureIndex(mesh.geometry.clone()).applyMatrix4(rootInv.clone().multiply(mesh.matrixWorld));
        for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
        g.setAttribute('bone', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(bi), 1));
        geos.push(g);
        if (cloth) {
          const back = g.clone();
          const idx = back.index!.array;
          for (let i = 0; i < idx.length; i += 3) {
            const a = idx[i + 1];
            idx[i + 1] = idx[i + 2];
            idx[i + 2] = a;
          }
          const na = back.attributes.normal as THREE.BufferAttribute;
          for (let i = 0; i < na.count; i++) na.setXYZ(i, -na.getX(i), -na.getY(i), -na.getZ(i));
          geos.push(back);
        }
      }
      const merged = mergeGeometries(geos)!;
      geos.forEach((g) => g.dispose());
      geometry = shareShape(makeShape(key, merged), colourFor(this.look, key, count, () => partColours(parts, count)));
    }
    const mesh = new THREE.SkinnedMesh(geometry, batchMaterial('toonN0'));
    this.body.add(mesh);
    this.group.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones), mesh.matrixWorld);
    // the shared vertex data lives only on the GPU, so give three.js fixed bounds instead of
    // letting it measure the posed vertices (a person, a raised arm or a dhak plume, fits in 1.6 m)
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.6);
    mesh.boundingBox = new THREE.Box3(new THREE.Vector3(-1, -0.2, -1), new THREE.Vector3(1, 2.4, 1));
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    this.eyes = [];
    this.parts = [mesh];
  }

  private mesh(g: THREE.BufferGeometry, color: number, parent: THREE.Object3D, pos: [number, number, number], scale?: [number, number, number], shadow = true, vertexColored = false) {
    const m = new THREE.Mesh(g, vertexColored ? clothMaterial() : toon(color, { paint: false }));
    m.position.set(...pos);
    if (scale) m.scale.set(...scale);
    m.castShadow = shadow;
    m.frustumCulled = false; // drawn on the planet, not at its flat position
    parent.add(m);
    this.parts.push(m);
    return m;
  }

  /**
   * A relaxed hand at the end of the forearm: wrist, a palm turned toward the thigh (as arms hang
   * naturally), four fingers of different lengths curling gently inward, and a thumb in front.
   */
  private hand(fore: THREE.Object3D, side: number, skin: number, small: boolean) {
    const h = new THREE.Group();
    h.position.set(0, -0.208, 0);
    h.scale.setScalar(small ? 0.9 : 1);
    fore.add(h);
    const inward = -side; // the palm faces the body (−x for the left arm, +x for the right)
    this.mesh(SPH_LO, skin, h, [0, 0, 0], [0.024, 0.02, 0.03], false); // wrist
    this.mesh(SPH, skin, h, [inward * 0.002, -0.04, 0.002], [0.0165, 0.041, 0.034]); // palm, flat and a little narrower than it is long
    const fingers: [number, number, number][] = [[0.0215, 0.0082, 0.043], [0.0075, 0.0085, 0.048], [-0.007, 0.0081, 0.044], [-0.0205, 0.0072, 0.034]]; // index → little: z, radius, length
    for (const [z, r, len] of fingers) {
      const f = this.mesh(fingerGeo(r, len), skin, h, [inward * 0.003, -0.066 + Math.abs(z) * 0.25, z], undefined, false);
      f.rotation.set(z * 1.4, 0, inward * 0.28); // fan slightly, curl toward the palm
    }
    const th = this.mesh(fingerGeo(0.0095, 0.034), skin, h, [inward * 0.01, -0.018, 0.026], undefined, false); // thumb
    th.rotation.set(-0.55, 0, inward * 0.3);
  }

  build() {
    for (const g of [this.body, this.hips, this.chest, this.head, this.thighL, this.thighR, this.shinL, this.shinR, this.armL, this.armR, this.foreL, this.foreR]) g.clear();
    this.parts = [];
    this.eyes = [];
    this.skirt = null;
    const L = this.look;
    const skin = L.skin ?? 0xc98a62;
    const hairC = L.hairColor ?? (L.hair === 'grey' ? 0xcfcac2 : 0x1a1414);
    const pants = L.pants ?? (L.style === 'kurta' ? 0xf4eedf : L.style === 'dhaki' ? 0xf4eedf : 0x2e3550);
    this.body.scale.setScalar(L.scale ?? 1);
    this.body.add(this.hips);
    this.hips.position.set(0, HIP_Y, 0);

    const female = L.style === 'sari' || L.style === 'frock' || L.style === 'salwar' || L.hair === 'bun' || L.hair === 'braid';
    const sari = L.style === 'sari', frock = L.style === 'frock', salwar = L.style === 'salwar', kurta = L.style === 'kurta' || L.style === 'dhaki' || salwar, tee = L.style === 'tee';
    this.stride = sari ? 0.45 : kurta ? 0.75 : 1;
    this.strideCap = sari ? 0.26 : kurta ? 0.4 : 1;
    const legCloth = L.style === 'dhaki' ? 0xf4eedf : salwar ? shade(L.color, 0.85) : pants;

    // ---- legs: thigh (hip pivot) → shin (knee pivot) → foot ----
    // Tapered limbs; under a sari only the feet show, under a frock the calves show below the hem.
    // Pyjama legs gather at the ankle (churidar rings); trousers fall straight with a crease.
    for (const [thigh, shin, x] of [[this.thighL, this.shinL, 0.085], [this.thighR, this.shinR, -0.085]] as const) {
      thigh.position.set(x, 0, 0);
      this.hips.add(thigh);
      // trouser and jeans thighs are full at the hip and taper to the knee; churidar is slimmer
      const thighTop = kurta ? 0.072 : 0.09, thighBot = kurta ? 0.058 : 0.066;
      const shinTop = frock ? 0.05 : kurta ? 0.058 : 0.066, shinBot = frock ? 0.036 : kurta ? 0.045 : 0.056;
      if (!sari && !frock) {
        this.mesh(SPH_LO, legCloth, thigh, [0, -0.02, 0], [thighTop, thighTop * 1.1, thighTop]); // hip ball: fills the socket as the leg swings
        this.mesh(limbGeo(thighTop, thighBot, 0.44), legCloth, thigh, [0, 0, 0]);
      }
      shin.position.set(0, -0.43, 0);
      thigh.add(shin);
      // the knee is as wide as the limbs it joins, so a bent knee stays round with no notch
      const kr = Math.max(sari || frock ? 0.046 : thighBot, shinTop) + 0.002;
      if (!sari) this.mesh(SPH_LO, frock ? skin : legCloth, shin, [0, 0, 0], [kr, kr, kr * 1.05]); // (under a sari the knee is never seen)
      if (!sari) this.mesh(limbGeo(shinTop, shinBot, 0.4), frock ? skin : legCloth, shin, [0, 0, 0]);
      if (kurta) for (let k = 0; k < 3; k++) this.mesh(geo('T', THREE.TorusGeometry, 0.047, 0.008, 4, 12), legCloth, shin, [0, -0.33 + k * 0.025, 0], undefined, false).rotation.x = Math.PI / 2; // churidar gathers
      this.mesh(SPH_LO, skin, shin, [0, -0.4, 0], [0.04, 0.035, 0.04]); // ankle
      // foot
      if (L.style === 'shirt' || tee) {
        this.mesh(SPH, tee ? 0xf4f4f0 : 0x2a2420, shin, [0, -0.425, 0.045], [0.052, 0.038, 0.12]); // leather shoe
        this.mesh(geo('B', THREE.BoxGeometry, 0.1, 0.018, 0.24), 0x1a1614, shin, [0, -0.455, 0.045]);
      } else {
        this.mesh(geo('B', THREE.BoxGeometry, 0.095, 0.018, 0.24), 0x5a2e18, shin, [0, -0.455, 0.045]); // chappal sole
        this.mesh(SPH, skin, shin, [0, -0.425, 0.05], [0.042, 0.026, 0.11]); // bare foot
        this.mesh(geo('T', THREE.TorusGeometry, 0.036, 0.007, 4, 10, Math.PI), sari ? L.accent : 0x8c2f22, shin, [0, -0.43, 0.08], undefined, false).rotation.x = -0.2; // toe strap
        if (sari) this.mesh(geo('B', THREE.BoxGeometry, 0.1, 0.006, 0.24), 0xc81e2a, shin, [0, -0.446, 0.045], undefined, false); // alta (red dye) at the sole edge
      }
    }

    // ---- torso & garments ----
    this.hips.add(this.chest);
    this.chest.position.set(0, 0.0, 0);
    const lathe = (pts: [number, number][], seg = 22) => memo(`l${seg}${pts}`, () => new THREE.LatheGeometry(upward(pts).map(([r, y]) => new THREE.Vector2(r, y)), seg));
    if (sari) {
      // the sari's lower drape falls from the waist to the ankles; soft vertical folds deepen toward
      // the hem; the skirt bone counter-rotates against the hips so it sways instead of twisting
      const sk = new THREE.Bone();
      this.hips.add(sk);
      this.skirt = sk;
      this.mesh(folded([[0.001, 0.06], [0.14, 0.06], [0.152, -0.06], [0.168, -0.3], [0.19, -0.58], [0.212, -0.8], [0.218, -0.85], [0.001, -0.85]], 18, 0.06), L.color, sk, [0, 0, 0], [1, 1, 0.86]);
      this.mesh(folded([[0.2135, -0.755], [0.22, -0.765], [0.224, -0.852], [0.214, -0.856]], 18, 0.06), L.accent, sk, [0, 0, 0], [1, 1, 0.86]); // laal paar hem
      this.mesh(folded([[0.175, -0.4], [0.18, -0.41], [0.184, -0.44], [0.177, -0.445]], 18, 0.04), L.accent, sk, [0, 0, 0], [1, 1, 0.86]); // inner woven stripe
      // front pleats (kuchi), tucked at the navel and fanning toward the feet
      for (let i = 0; i < 7; i++) {
        const u = (i - 3) / 3;
        const pl = this.mesh(geo('B', THREE.BoxGeometry, 0.026, 0.7, 0.012), shade(L.color, i % 2 ? 0.86 : 1.02), sk, [u * 0.075, -0.5, 0.168]);
        pl.rotation.z = u * 0.09;
        pl.rotation.x = -0.12;
      }
      this.mesh(geo('B', THREE.BoxGeometry, 0.21, 0.05, 0.016), L.accent, sk, [0, -0.83, 0.2]); // pleat border
      // waist: the sari wraps the hips up to the navel; a sliver of midriff; fitted blouse
      this.mesh(lathe([[0.001, 0.13], [0.128, 0.13], [0.142, 0.05], [0.15, -0.06], [0.001, -0.06]]), L.color, this.chest, [0, 0, 0], [1, 1, 0.8]);
      this.mesh(lathe([[0.001, 0.21], [0.118, 0.21], [0.122, 0.13], [0.001, 0.13]]), skin, this.chest, [0, 0, 0], [1, 1, 0.78]);
      this.mesh(lathe([[0.001, 0.48], [0.06, 0.48], [0.13, 0.44], [0.152, 0.37], [0.155, 0.3], [0.134, 0.22], [0.12, 0.205], [0.001, 0.205]]), L.accent, this.chest, [0, 0, 0], [1, 1, 0.82]);
      // pallu: a curved band from the right hip, across the bodice, over the left shoulder and
      // falling down the back to the knee — woven border along both edges
      const pallu = ribbon(
        [[-0.13, -0.03, 0.124], [-0.06, 0.1, 0.126], [0.03, 0.25, 0.124], [0.1, 0.39, 0.09], [0.145, 0.47, 0.02], [0.15, 0.45, -0.08], [0.14, 0.3, -0.125], [0.13, 0.05, -0.138], [0.13, -0.28, -0.15], [0.13, -0.5, -0.16]],
        0.17,
        L.color,
        L.accent,
      );
      this.mesh(pallu, 0xffffff, this.chest, [0, 0, 0], undefined, true, true);
    } else if (salwar) {
      // salwar kameez: a fitted kameez to the knee with side slits and a border, churidar below,
      // and a dupatta draped over both shoulders, its ends falling behind
      this.mesh(aLine(folded([[0.001, 0.48], [0.07, 0.48], [0.15, 0.43], [0.16, 0.3], [0.135, 0.12], [0.15, -0.05], [0.19, -0.25], [0.21, -0.42], [0.001, -0.42]], 12, 0.04)), L.color, this.chest, [0, 0, 0], [1, 1, 0.8]);
      this.mesh(aLine(lathe([[0.206, -0.37], [0.212, -0.38], [0.213, -0.425], [0.208, -0.426]])), L.accent, this.chest, [0, 0, 0], [1, 1, 0.8]);
      for (const side of [-1, 1]) this.mesh(geo('B', THREE.BoxGeometry, 0.008, 0.18, 0.05), shade(L.color, 0.7), this.chest, [side * 0.205, -0.33, 0], undefined, false);
      this.mesh(geo('T', THREE.TorusGeometry, 0.075, 0.01, 4, 16, Math.PI), L.accent, this.chest, [0, 0.47, 0.06], [1, 1.3, 1], false).rotation.set(Math.PI / 2 + 0.3, 0, Math.PI); // neckline
      this.mesh(
        ribbon([[-0.17, -0.35, -0.15], [-0.17, 0.05, -0.15], [-0.17, 0.4, -0.06], [-0.15, 0.46, 0.06], [-0.08, 0.3, 0.15], [0, 0.24, 0.16], [0.08, 0.3, 0.15], [0.15, 0.46, 0.06], [0.17, 0.4, -0.06], [0.17, 0.05, -0.15], [0.17, -0.35, -0.15]], 0.15, L.accent, shade(L.accent, 0.7)),
        0xffffff, this.chest, [0, 0, 0], undefined, true, true,
      ); // dupatta
    } else if (tee) {
      // T-shirt and jeans
      this.mesh(lathe([[0.001, 0.48], [0.07, 0.48], [0.165, 0.44], [0.17, 0.3], [0.158, 0.1], [0.162, -0.04], [0.001, -0.04]]), L.color, this.chest, [0, 0, 0], [1, 1, 0.8]);
      this.mesh(geo('T', THREE.TorusGeometry, 0.07, 0.012, 4, 16), shade(L.color, 0.8), this.chest, [0, 0.48, 0], [1, 1, 0.82], false).rotation.x = Math.PI / 2;
      this.mesh(geo('B', THREE.BoxGeometry, 0.12, 0.08, 0.01), L.accent, this.chest, [0, 0.33, 0.135], undefined, false); // print on the chest
      this.mesh(lathe([[0.001, 0.0], [0.163, 0.0], [0.168, -0.06], [0.152, -0.13], [0.11, -0.19], [0.05, -0.235], [0.001, -0.24]]), pants, this.hips, [0, 0, 0], [1, 1, 0.74]); // jeans: hips and seat rounding into the legs
    } else if (kurta) {
      // a kurta to just above the knee: shoulders, chest, gentle waist, flared skirt with side slits
      this.mesh(aLine(folded([[0.001, 0.5], [0.075, 0.5], [0.168, 0.445], [0.178, 0.32], [0.165, 0.14], [0.175, -0.02], [0.2, -0.22], [0.22, -0.4], [0.001, -0.4]], 14, 0.035)), L.color, this.chest, [0, 0, 0], [1, 1, 0.82]);
      this.mesh(aLine(lathe([[0.2105, -0.36], [0.214, -0.37], [0.214, -0.405], [0.21, -0.406]])), L.accent, this.chest, [0, 0, 0], [1, 1, 0.8]); // hem border
      for (const side of [-1, 1]) this.mesh(geo('B', THREE.BoxGeometry, 0.008, 0.16, 0.05), shade(L.color, 0.7), this.chest, [side * 0.202, -0.32, 0], undefined, false); // side slit
      this.mesh(geo('B', THREE.BoxGeometry, 0.03, 0.24, 0.012), L.accent, this.chest, [0, 0.35, 0.136]); // placket
      for (let i = 0; i < 3; i++) this.mesh(SPH_LO, 0xd4af37, this.chest, [0, 0.45 - i * 0.07, 0.144], [0.01, 0.01, 0.007], false); // studs
      this.mesh(geo('T', THREE.TorusGeometry, 0.066, 0.016, 6, 16), L.color, this.chest, [0, 0.5, 0.0], [1, 1, 0.82]).rotation.x = Math.PI / 2; // band collar
      if (L.style === 'dhaki')
        this.mesh(ribbon([[-0.14, 0.0, 0.13], [0.0, 0.22, 0.15], [0.14, 0.45, 0.06], [0.17, 0.5, -0.05], [0.15, 0.2, -0.15]], 0.07, 0xb3121f, 0xffffff), 0xffffff, this.chest, [0, 0, 0], undefined, true, true); // gamchha
      else if (!female) this.mesh(ribbon([[0.15, 0.46, 0.1], [0.05, 0.47, 0.13], [-0.08, 0.44, 0.13], [-0.16, 0.42, 0.04], [-0.17, 0.2, -0.02]], 0.06, shade(L.accent, 1), shade(L.accent, 0.8)), 0xffffff, this.chest, [0, 0, 0], undefined, true, true); // uttariya stole
    } else if (frock) {
      const sk = new THREE.Bone();
      this.hips.add(sk);
      this.skirt = sk;
      this.mesh(folded([[0.001, 0.06], [0.125, 0.06], [0.16, -0.06], [0.25, -0.3], [0.29, -0.38], [0.001, -0.38]], 10, 0.09), L.color, sk, [0, 0, 0], [1, 1, 0.9]);
      this.mesh(folded([[0.275, -0.34], [0.293, -0.35], [0.293, -0.385], [0.28, -0.386]], 10, 0.09), L.accent, sk, [0, 0, 0], [1, 1, 0.9]);
      this.mesh(lathe([[0.001, 0.44], [0.06, 0.44], [0.122, 0.38], [0.13, 0.24], [0.12, 0.06], [0.001, 0.06]]), L.color, this.chest, [0, 0, 0], [1, 1, 0.82]);
      this.mesh(geo('T', THREE.TorusGeometry, 0.064, 0.018, 5, 14), L.accent, this.chest, [0, 0.44, 0], [1, 1, 0.82]).rotation.x = Math.PI / 2; // peter-pan collar
      this.mesh(geo('T', THREE.TorusGeometry, 0.12, 0.012, 4, 18), L.accent, this.chest, [0, 0.07, 0], [1, 1, 0.84]).rotation.x = Math.PI / 2; // sash
    } else {
      // shirt tucked into trousers: collar, buttons, pocket, belt
      this.mesh(folded([[0.001, 0.5], [0.075, 0.5], [0.17, 0.445], [0.176, 0.3], [0.16, 0.12], [0.162, -0.02], [0.001, -0.02]], 12, 0.02), L.color, this.chest, [0, 0, 0], [1, 1, 0.8]);
      this.mesh(lathe([[0.001, 0.02], [0.163, 0.02], [0.168, -0.06], [0.152, -0.13], [0.11, -0.19], [0.05, -0.235], [0.001, -0.24]]), pants, this.hips, [0, 0, 0], [1, 1, 0.74]); // trousers: hips and seat rounding into the legs
      this.mesh(geo('T', THREE.TorusGeometry, 0.164, 0.017, 5, 20), 0x2a2420, this.chest, [0, 0.0, 0], [1, 1, 0.8]).rotation.x = Math.PI / 2; // belt
      this.mesh(geo('B', THREE.BoxGeometry, 0.03, 0.02, 0.01), 0xc9a24a, this.chest, [0, 0.0, 0.135], undefined, false); // buckle
      for (const side of [-1, 1]) this.mesh(geo('B', THREE.BoxGeometry, 0.075, 0.03, 0.06), L.accent, this.chest, [side * 0.045, 0.495, 0.065], undefined, false).rotation.set(-0.5, 0, side * 0.35); // collar points
      for (let i = 0; i < 4; i++) this.mesh(SPH_LO, shade(L.color, 0.75), this.chest, [0, 0.42 - i * 0.1, 0.139], [0.009, 0.009, 0.006], false);
      this.mesh(geo('B', THREE.BoxGeometry, 0.06, 0.06, 0.008), shade(L.color, 0.9), this.chest, [0.075, 0.34, 0.132], undefined, false); // pocket
    }

    // ---- arms: shoulder → elbow → wrist → hand ----
    for (const [arm, fore, x] of [[this.armL, this.foreL, 0.19], [this.armR, this.foreR, -0.19]] as const) {
      arm.position.set(x, 0.42, 0);
      this.chest.add(arm);
      const side = x > 0 ? 1 : -1;
      const sleeve = sari ? L.accent : L.color;
      const longSleeve = (kurta && !salwar) || L.style === 'shirt';
      // short blouse / frock sleeves; full sleeves for kurta and shirt
      this.mesh(SPH, sleeve, arm, [0, -0.01, 0], [0.056, 0.046, 0.054]); // shoulder
      if (sari || frock || salwar || tee) {
        this.mesh(limbGeo(0.058, 0.054, salwar ? 0.2 : 0.12), sleeve, arm, [0, 0, 0]);
        this.mesh(limbGeo(0.047, 0.042, 0.185), skin, arm, [0, -0.11, 0]); // ends at the elbow, so a bent arm shows no stub
      } else this.mesh(limbGeo(kurta ? 0.062 : 0.056, kurta ? 0.056 : 0.05, 0.3), sleeve, arm, [0, 0, 0]);
      fore.position.set(0, -0.29, 0);
      arm.add(fore);
      const er = (longSleeve ? (kurta ? 0.056 : 0.05) : 0.042) + 0.003; // elbow as wide as the arm it joins
      this.mesh(SPH_LO, longSleeve ? sleeve : skin, fore, [0, 0, 0], [er, er, er]);
      this.mesh(limbGeo(longSleeve ? (kurta ? 0.056 : 0.048) : 0.042, longSleeve ? (kurta ? 0.054 : 0.044) : 0.032, 0.21), longSleeve ? sleeve : skin, fore, [0, 0, 0]);
      if (L.style === 'shirt') this.mesh(geo('C', THREE.CylinderGeometry, 0.046, 0.046, 0.03, 10), shade(sleeve, 0.85), fore, [0, -0.2, 0]); // cuff
      this.hand(fore, side, skin, female);
      if (sari) {
        // shakha (conch-shell white) and pola (red coral) bangles, the married Bengali woman's pair
        this.mesh(geo('T', THREE.TorusGeometry, 0.038, 0.009, 5, 14), 0xf4eedf, fore, [0, -0.205, 0]).rotation.x = Math.PI / 2;
        this.mesh(geo('T', THREE.TorusGeometry, 0.038, 0.009, 5, 14), 0xb3121f, fore, [0, -0.185, 0]).rotation.x = Math.PI / 2;
        this.mesh(geo('T', THREE.TorusGeometry, 0.037, 0.005, 4, 14), 0xd4af37, fore, [0, -0.168, 0]).rotation.x = Math.PI / 2;
      } else if (L.style !== 'shirt' && !frock) this.mesh(geo('T', THREE.TorusGeometry, 0.036, 0.004, 4, 14), 0xd4af37, fore, [0, -0.22, 0]).rotation.x = Math.PI / 2; // thin kara / watch
    }

    // ---- neck + head ----
    this.mesh(limbGeo(0.048, 0.054, 0.14), skin, this.chest, [0, 0.58, 0.004]);
    this.head.position.set(0, 0.67, 0.008);
    this.chest.add(this.head);
    // skull + softly squared jaw + cheeks
    this.mesh(SPH, skin, this.head, [0, 0.012, -0.006], [0.112, 0.13, 0.122]);
    this.mesh(SPH, skin, this.head, [0, -0.055, 0.022], female ? [0.088, 0.075, 0.09] : [0.094, 0.08, 0.094]);
    for (const sx of [-1, 1]) {
      this.mesh(SPH_LO, skin, this.head, [sx * 0.06, -0.035, 0.07], [0.04, 0.035, 0.04]); // cheek
      this.mesh(SPH_LO, skin, this.head, [sx * 0.113, -0.005, -0.008], [0.018, 0.032, 0.014]); // ear
      if (female) this.mesh(SPH_LO, 0xd4af37, this.head, [sx * 0.116, -0.04, -0.006], [0.01, 0.014, 0.01], false); // ear stud / jhumka
    }
    // face: eyes with whites, irises and upper lids; brows; nose with bridge and tip; two-tone lips
    for (const ex of [0.042, -0.042]) {
      this.mesh(SPH_LO, 0xf3ede4, this.head, [ex, 0.012, 0.106], [0.026, 0.015, 0.01], false);
      const iris = this.mesh(SPH_LO, 0x2a1810, this.head, [ex, 0.011, 0.115], [0.013, 0.013, 0.005], false);
      this.mesh(SPH_LO, 0x0a0606, iris, [0, 0, 0.4], [0.55, 0.55, 0.5], false); // pupil
      this.mesh(SPH_LO, 0xffffff, iris, [0.35, 0.35, 0.8], [0.25, 0.25, 0.3], false); // catchlight
      this.eyes.push(iris);
      this.mesh(geo('T', THREE.TorusGeometry, 0.026, 0.0045, 3, 10, Math.PI), 0x1a1210, this.head, [ex, 0.011, 0.111], [1, 0.62, 1], false); // upper lid / lashes
      if (female) this.mesh(geo('B', THREE.BoxGeometry, 0.014, 0.004, 0.004), 0x1a1210, this.head, [ex + (ex > 0 ? 0.027 : -0.027), 0.018, 0.106], undefined, false).rotation.z = ex > 0 ? 0.35 : -0.35; // kajal flick
      this.mesh(geo('T', THREE.TorusGeometry, 0.028, 0.006, 3, 10, Math.PI), hairC, this.head, [ex, 0.042, 0.108], [1, 0.4, 1], false); // brow arch
    }
    this.mesh(SPH_LO, skin, this.head, [0, 0.0, 0.118], [0.012, 0.035, 0.014], false); // nose bridge
    this.mesh(SPH_LO, skin, this.head, [0, -0.027, 0.125], [0.019, 0.016, 0.018], false); // nose tip
    this.mesh(SPH_LO, shade(skin, 0.75), this.head, [0, -0.06, 0.108], [0.022, 0.006, 0.008], false); // upper lip
    this.mesh(SPH_LO, female ? 0xa83a44 : shade(skin, 0.68), this.head, [0, -0.07, 0.106], [0.019, 0.008, 0.009], false); // lower lip
    if (sari) this.mesh(SPH_LO, 0xc81e2a, this.head, [0, 0.055, 0.121], [0.009, 0.009, 0.004], false); // red teep
    else if (frock) this.mesh(SPH_LO, 0x1a1210, this.head, [0, 0.055, 0.121], [0.006, 0.006, 0.003], false); // small kajal teep
    if (!female && !L.elderly && (L.skin ?? 0) % 3 === 0) this.mesh(SPH_LO, shade(hairC, 1), this.head, [0, -0.045, 0.112], [0.03, 0.007, 0.008], false); // moustache
    if (L.glasses) {
      for (const ex of [0.042, -0.042]) this.mesh(geo('T', THREE.TorusGeometry, 0.027, 0.004, 4, 14), 0x222222, this.head, [ex, 0.012, 0.125], undefined, false);
      this.mesh(geo('B', THREE.BoxGeometry, 0.028, 0.004, 0.004), 0x222222, this.head, [0, 0.016, 0.127], undefined, false);
    }
    // ---- hair ----
    if (L.hair !== 'bald') {
      // hair mass hugging the skull above a natural hairline, fuller at the back
      this.mesh(SPH, hairC, this.head, [0, 0.05, -0.022], [0.12, 0.118, 0.13]);
      this.mesh(SPH_LO, hairC, this.head, [0, 0.012, -0.075], [0.114, 0.11, 0.075]);
      for (const sx of [-1, 1]) this.mesh(SPH_LO, hairC, this.head, [sx * 0.098, 0.035, 0.03], [0.026, 0.06, 0.06]); // temples
      if (female) {
        // centre parting (with sindoor for the married woman in a sari) and hair swept back
        this.mesh(geo('B', THREE.BoxGeometry, 0.006, 0.004, 0.09), sari && L.hair === 'bun' ? 0xd9381e : shade(hairC, 0.6), this.head, [0, 0.168, 0.02], undefined, false).rotation.x = -0.25;
        for (const sx of [-1, 1]) this.mesh(SPH_LO, hairC, this.head, [sx * 0.05, 0.12, 0.06], [0.06, 0.04, 0.05]).rotation.z = sx * 0.4;
        if (L.hair === 'bun') {
          this.mesh(SPH, hairC, this.head, [0, -0.035, -0.15], [0.068, 0.062, 0.056]); // khopa at the nape
          if (sari) for (let i = 0; i < 12; i++) this.mesh(SPH_LO, 0xfdfbf2, this.head, [Math.cos(i * 0.52) * 0.072, -0.035 + Math.sin(i * 0.52) * 0.066, -0.17], [0.012, 0.012, 0.012], false); // jasmine gajra
        }
        if (L.hair === 'braid') {
          for (let i = 0; i < 7; i++) this.mesh(SPH_LO, hairC, this.head, [Math.sin(i * 1.4) * 0.006, -0.08 - i * 0.06, -0.13 - i * 0.008], [0.032, 0.038, 0.03]).rotation.z = (i % 2 ? 0.4 : -0.4);
          this.mesh(SPH_LO, 0xb3121f, this.head, [0, -0.52, -0.18], [0.02, 0.025, 0.02], false); // ribbon
        }
      } else {
        // a short side-parted cut with a little volume over the forehead
        this.mesh(SPH_LO, hairC, this.head, [0.025, 0.11, 0.055], [0.09, 0.042, 0.065]).rotation.z = -0.25;
        this.mesh(SPH_LO, hairC, this.head, [0, -0.04, -0.09], [0.1, 0.07, 0.055]); // nape
      }
    } else {
      this.mesh(SPH, 0xcfcac2, this.head, [0, -0.01, -0.03], [0.116, 0.1, 0.124]);
    }
    if (L.style === 'dhaki') {
      // dhak on a strap, with its tall white kash-flower plume
      const drum = new THREE.Group();
      drum.position.set(0, 0.05, 0.36);
      this.hips.add(drum);
      this.mesh(geo('C', THREE.CylinderGeometry, 0.27, 0.27, 0.66, 18), 0x8c2f22, drum, [0, 0, 0]).rotation.z = Math.PI / 2;
      for (const sx of [0.34, -0.34]) this.mesh(geo('C', THREE.CylinderGeometry, 0.28, 0.28, 0.035, 18), 0xefe3c2, drum, [sx, 0, 0]).rotation.z = Math.PI / 2;
      for (let k = 0; k < 6; k++) this.mesh(geo('T', THREE.TorusGeometry, 0.272, 0.008, 4, 20), 0xd4af37, drum, [-0.28 + k * 0.11, 0, 0]).rotation.y = Math.PI / 2;
      for (let i = 0; i < 9; i++) this.mesh(SPH_LO, 0xffffff, drum, [Math.sin(i * 1.7) * 0.07, 0.38 + i * 0.075, -0.08 + Math.cos(i) * 0.03], [0.1, 0.07, 0.08], false);
    }
    if (L.elderly) this.chest.rotation.x = 0.16;
    if (this.baked) this.bake();
    if (this.held) this.foreR.add(this.held);
    if (this.propObj) this.foreR.add(this.propObj);
  }

  /**
   * Props held by a stem (dhunuchis) stay upright however the hand swings, as a real burner does:
   * each frame their rotation cancels the hand's, leaving only the person's facing.
   */
  private upright: THREE.Object3D[] = [];
  private keepUpright() {
    const want = this.group.getWorldQuaternion(_qa).multiply(FLIP_UP);
    for (const o of this.upright) {
      if (!o.parent) continue;
      o.parent.getWorldQuaternion(_qb);
      o.quaternion.copy(_qb.invert().multiply(want));
    }
  }
  private track(o: THREE.Object3D | null) {
    this.upright = this.upright.filter((u) => u.parent && u !== o);
    if (o?.userData.upright) this.upright.push(o);
  }

  /** Attach an object to a body part (statues add caps, turbans, beards and robes). */
  attachTo(part: 'head' | 'chest' | 'hips' | 'foreL' | 'foreR', o: THREE.Object3D) {
    ({ head: this.head, chest: this.chest, hips: this.hips, foreL: this.foreL, foreR: this.foreR })[part].add(o);
  }

  /** A second prop in the left hand (a second dhunuchi). */
  holdLeft(o: THREE.Object3D) {
    o.position.set(0, -0.3, 0.03);
    this.foreL.add(o);
    this.track(o);
  }

  /** A prop held in the teeth (an expert dancer's third dhunuchi), in front of the face. */
  holdInMouth(o: THREE.Object3D) {
    o.position.set(0, -0.2, 0.17); // gripped in the teeth, the bowl rising only to the chin
    o.scale.setScalar(0.75);
    this.head.add(o);
    this.track(o);
  }

  /** A temporary prop in the right hand for player actions (a fuchka bowl, a roll, a phone…). */
  private propObj: THREE.Object3D | null = null;
  setProp(o: THREE.Object3D | null) {
    if (this.propObj) this.foreR.remove(this.propObj);
    this.propObj = o;
    if (o) {
      o.position.set(0, -0.3, 0.03);
      this.foreR.add(o);
    }
    this.track(o);
  }

  /** Hold an object in the right hand (re-attached automatically after a rebuild). */
  private held: THREE.Object3D | null = null;
  attachToHand(o: THREE.Object3D) {
    this.held = o;
    if (o.position.lengthSq() === 0) o.position.set(0, -0.3, 0.03);
    this.foreR.add(o);
  }

  setLook(l: Look) {
    this.look = l;
    this.build();
  }

  /** speed in m/s; jog in [0,1]. */
  update(dt: number, speed: number, jog = 0) {
    this.time += dt;
    this.speedS = lerp(this.speedS, speed, damp(10, dt));
    const sp = this.speedS;
    const moving = Math.min(1, sp / 1.2);
    this.phase += dt * sp * lerp(2.3, 1.75, jog);
    const ph = this.phase;
    // long garments shorten the stride: small steps in a sari, a little shorter in a long kurta
    const amp = Math.min(this.strideCap, moving * lerp(0.5, 0.78, jog) * this.stride);
    const sL = Math.sin(ph), sR = -sL;
    this.thighL.rotation.x = -sL * amp;
    this.thighR.rotation.x = -sR * amp;
    // knees bend as the leg swings through (only backwards)
    this.shinL.rotation.x = Math.max(0, Math.cos(ph)) * amp * 1.3 + moving * 0.08;
    this.shinR.rotation.x = Math.max(0, -Math.cos(ph)) * amp * 1.3 + moving * 0.08;
    const bob = Math.abs(Math.sin(ph)) * 0.035 * moving * (1 + jog);
    const breathe = Math.sin(this.time * 1.7) * 0.006 * (1 - moving);
    this.hips.position.y = HIP_Y - bob * 0.6 + breathe + moving * 0.02;
    this.hips.rotation.y = sL * 0.08 * moving;
    this.chest.rotation.x = (this.look.elderly ? 0.16 : 0) + moving * lerp(0.04, 0.16, jog);
    this.chest.rotation.y = -sL * 0.14 * moving;
    this.chest.rotation.z = 0;
    this.armL.rotation.x = sL * amp * 0.85;
    this.armR.rotation.x = sR * amp * 0.85;
    this.armL.rotation.z = 0.1 + (1 - moving) * Math.sin(this.time * 1.7) * 0.015;
    this.armR.rotation.z = -0.1 - (1 - moving) * Math.sin(this.time * 1.7) * 0.015;
    this.foreL.rotation.x = -0.18 - moving * lerp(0.2, 1.0, jog) - Math.max(0, sL) * 0.3 * moving;
    this.foreR.rotation.x = -0.18 - moving * lerp(0.2, 1.0, jog) - Math.max(0, sR) * 0.3 * moving;
    this.foreL.rotation.z = this.foreR.rotation.z = 0;
    this.head.rotation.y = (1 - moving) * Math.sin(this.time * 0.37) * 0.35 + this.hips.rotation.y * -1;
    this.head.rotation.x = -0.04;
    this.head.rotation.z = 0;
    this.hips.rotation.z = 0;
    if (this.skirt) this.skirt.rotation.y = -this.hips.rotation.y;
    if (this.pose !== this.lastPose) {
      this.lastPose = this.pose;
      this.poseT = 0;
    }
    this.poseT += dt;
    this.poseW = lerp(this.poseW, this.pose === 'none' ? 0 : 1, damp(8, dt));
    this.body.rotation.y = 0;
    if (this.poseW > 0.01) this.applyPose(this.poseW);
    if (this.upright.length) this.keepUpright();
    // blink
    this.blinkT -= dt;
    const blink = this.blinkT < 0.12 ? 0.15 : 1;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3;
    for (const e of this.eyes) e.scale.y = 0.017 * blink;
  }

  /**
   * Palms pressed together (namaskar). `up` 0 holds them before the chest; 1 raises the joined
   * hands so the fingertips touch the forehead, as in the bow of a pranam.
   */
  private namaskar(mix: (o: THREE.Object3D, ax: 'x' | 'y' | 'z', v: number) => void, up: number) {
    mix(this.armL, 'x', lerp(-0.45, -0.95, up));
    mix(this.armR, 'x', lerp(-0.45, -0.95, up));
    mix(this.armL, 'z', -0.5);
    mix(this.armR, 'z', 0.5);
    mix(this.armL, 'y', 0);
    mix(this.armR, 'y', 0);
    mix(this.foreL, 'x', lerp(-1.75, -1.95, up));
    mix(this.foreR, 'x', lerp(-1.75, -1.95, up));
    mix(this.foreL, 'z', -0.35);
    mix(this.foreR, 'z', 0.35);
  }

  private applyPose(w: number) {
    const t = this.time;
    const mix = (o: THREE.Object3D, ax: 'x' | 'y' | 'z', v: number) => (o.rotation[ax] = lerp(o.rotation[ax], v, w));
    switch (this.pose) {
      case 'wave':
        mix(this.armR, 'z', -2.7);
        mix(this.armR, 'x', 0);
        mix(this.foreR, 'z', Math.sin(t * 9) * 0.45);
        mix(this.foreR, 'x', -0.2);
        break;
      case 'eat':
        mix(this.armR, 'x', -0.9);
        mix(this.foreR, 'x', -1.6 - Math.max(0, Math.sin(t * 4)) * 0.5);
        mix(this.armL, 'x', -0.5);
        mix(this.foreL, 'x', -1.3);
        mix(this.head, 'x', 0.12);
        break;
      case 'clap': {
        const c = Math.abs(Math.sin(t * 7));
        mix(this.armL, 'x', -0.9);
        mix(this.armR, 'x', -0.9);
        mix(this.armL, 'z', -0.35 + c * 0.25);
        mix(this.armR, 'z', 0.35 - c * 0.25);
        mix(this.foreL, 'x', -0.9);
        mix(this.foreR, 'x', -0.9);
        break;
      }
      case 'drum': {
        const a = Math.max(0, Math.sin(t * 8)), b = Math.max(0, Math.sin(t * 8 + Math.PI));
        mix(this.armL, 'x', -0.3 - a * 0.6);
        mix(this.armR, 'x', -0.3 - b * 0.6);
        mix(this.armL, 'z', 0.45);
        mix(this.armR, 'z', -0.45);
        mix(this.foreL, 'x', -1.0);
        mix(this.foreR, 'x', -1.0);
        mix(this.head, 'x', 0.06 * Math.sin(t * 8));
        break;
      }
      case 'sit':
        this.hips.position.y = lerp(this.hips.position.y, 0.5, w);
        mix(this.thighL, 'x', -1.5);
        mix(this.thighR, 'x', -1.5);
        mix(this.shinL, 'x', 1.5);
        mix(this.shinR, 'x', 1.5);
        break;
      case 'pray':
        // namaskar: palms pressed together in front of the chest, head slightly bowed
        this.namaskar(mix, 0);
        mix(this.head, 'x', 0.18);
        break;
      case 'pranam': {
        // the kneeling pranam before the protima: kneel on both knees with palms joined at the
        // chest, then sit back and bow, the joined palms raised to touch the forehead, hold,
        // rise to kneeling, and stand
        const t = this.poseT;
        const ss = (a: number, b: number, v: number) => {
          const x = Math.min(1, Math.max(0, (v - a) / (b - a)));
          return x * x * (3 - 2 * x);
        };
        const kneel = ss(0, 0.7, t) * (1 - ss(4.5, 5.1, t));
        const bow = ss(1.4, 2.2, t) * (1 - ss(3.7, 4.4, t));
        const hipY = lerp(lerp(HIP_Y, 0.5, kneel), 0.4, bow);
        this.hips.position.y = lerp(this.hips.position.y, hipY, w);
        for (const th of [this.thighL, this.thighR]) mix(th, 'x', lerp(-0.12 * kneel, -0.8, bow));
        for (const sh of [this.shinL, this.shinR]) mix(sh, 'x', lerp(1.62 * kneel, 2.35, bow));
        mix(this.chest, 'x', lerp(0.06 * kneel, 0.72, bow));
        mix(this.chest, 'y', 0);
        mix(this.chest, 'z', 0);
        this.namaskar(mix, bow);
        mix(this.head, 'x', lerp(0.22, 0.42, bow));
        mix(this.head, 'y', 0);
        break;
      }
      case 'photo':
        mix(this.armL, 'x', -1.2);
        mix(this.armR, 'x', -1.2);
        mix(this.foreL, 'x', -1.2);
        mix(this.foreR, 'x', -1.2);
        mix(this.armL, 'z', -0.25);
        mix(this.armR, 'z', 0.25);
        break;
      case 'salute':
        // a military salute: right hand raised to the brow
        mix(this.armR, 'z', -1.6);
        mix(this.armR, 'x', -0.45);
        mix(this.foreR, 'x', 0);
        mix(this.foreR, 'z', -2.75);
        mix(this.head, 'x', -0.05);
        break;
      case 'point':
        // "Dilli Chalo": the right arm raised forward and up, pointing the way; the left on the hip
        mix(this.armR, 'x', -2.35);
        mix(this.armR, 'z', -0.25);
        mix(this.foreR, 'x', -0.15);
        mix(this.armL, 'z', 0.55);
        mix(this.armL, 'x', 0.15);
        mix(this.foreL, 'x', -1.3);
        mix(this.chest, 'x', -0.05);
        mix(this.head, 'x', -0.12);
        break;
      case 'foldarms':
        // arms folded across the chest (Swami Vivekananda's Chicago pose)
        mix(this.armL, 'x', -0.35);
        mix(this.armR, 'x', -0.35);
        mix(this.armL, 'z', -0.2);
        mix(this.armR, 'z', 0.2);
        mix(this.foreL, 'x', -1.65);
        mix(this.foreR, 'x', -1.65);
        mix(this.foreL, 'z', -0.95);
        mix(this.foreR, 'z', 0.95);
        mix(this.head, 'x', -0.04);
        break;
      case 'holdbook':
        // a book held against the chest in the left hand, the right hand resting over it
        mix(this.armL, 'x', -0.3);
        mix(this.armL, 'z', -0.1);
        mix(this.foreL, 'x', -1.45);
        mix(this.foreL, 'z', -0.3);
        mix(this.armR, 'x', -0.3);
        mix(this.armR, 'z', 0.15);
        mix(this.foreR, 'x', -1.2);
        mix(this.foreR, 'z', 0.55);
        mix(this.head, 'x', 0.08);
        break;
      case 'aarti': {
        // the purohit's aarti: the pancha-pradip held upright before his face and moved in slow
        // clockwise circles toward the protima; the left hand rings the ghanta at chest height
        const a = t * 2.2;
        mix(this.armR, 'x', -0.95 + Math.sin(a) * 0.22);
        mix(this.armR, 'z', -0.25 + Math.cos(a) * 0.22);
        mix(this.foreR, 'x', -1.45);
        mix(this.foreR, 'z', 0);
        mix(this.armL, 'x', -0.55);
        mix(this.armL, 'z', 0.15);
        mix(this.foreL, 'x', -1.25 + Math.sin(t * 14) * 0.08);
        mix(this.chest, 'x', 0.08);
        mix(this.head, 'x', 0.05);
        break;
      }
      case 'dhunuchi': {
        // dhunuchi naach: a frenzied, circular dance to the dhak with clay burners of smouldering
        // coconut husk, one in each hand (experts hold a third in the teeth). Each dancer cycles
        // through four movements, out of step with the others:
        //   A offering circles — both arms swing big alternating circles in front, knees bouncing
        //   B overhead swirl   — the right dhunuchi swirled high, the body swaying under it
        //   C low sweep        — bent low, both dhunuchis swept in arcs near the floor
        //   D spin             — a full turn on the spot, arms out
        const T = t * this.tempo;
        const ph = T * 2.6, beat = Math.abs(Math.sin(T * Math.PI * 2.2));
        const en = 0.75 + this.energy * 0.45;
        const cyc = T % 13;
        // weight of the movement running from a to b seconds of the 13 s cycle (soft edges, wraps)
        const win = (a: number, b: number) => {
          const ss = (e0: number, e1: number, x: number) => Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
          let m = 0;
          for (const sh of [-13, 0, 13]) m = Math.max(m, ss(a - 0.35, a + 0.35, cyc + sh) * (1 - ss(b - 0.35, b + 0.35, cyc + sh)));
          return m;
        };
        const wA = win(0, 4), wB = win(4, 8), wC = win(8, 11), wD = win(11, 13);
        const sum = wA + wB + wC + wD || 1;
        type J = { aRx: number; aRz: number; aLx: number; aLz: number; fR: number; fL: number; cx: number; cz: number; drop: number; thL: number; thR: number; shL: number; shR: number; hx: number };
        const A: J = { aRx: -1.3 + Math.sin(ph) * 1.0 * en, aRz: -0.3, aLx: -1.3 - Math.sin(ph) * 1.0 * en, aLz: 0.3, fR: -0.5, fL: -0.5, cx: 0.14, cz: Math.sin(ph) * 0.08, drop: 0.07 * beat, thL: -0.25 * beat, thR: -0.25 * beat, shL: 0.45 * beat, shR: 0.45 * beat, hx: 0.05 };
        const B: J = { aRx: Math.cos(ph) * 0.5 * en, aRz: -2.5 - Math.sin(ph) * 0.3 * en, aLx: -0.35, aLz: 1.2 + Math.sin(ph + 1) * 0.4 * en, fR: -0.45 - Math.sin(ph * 2) * 0.25, fL: -0.6, cx: 0.06, cz: Math.sin(ph) * 0.15 * en, drop: 0.05 * Math.abs(Math.sin(ph)), thL: -Math.max(0, Math.sin(ph)) * 0.5 * en, thR: -Math.max(0, -Math.sin(ph)) * 0.5 * en, shL: Math.max(0, Math.sin(ph)) * 0.8 * en, shR: Math.max(0, -Math.sin(ph)) * 0.8 * en, hx: -0.1 };
        const C: J = { aRx: -0.75 + Math.sin(ph) * 0.25, aRz: -0.35 + Math.sin(ph) * 0.75 * en, aLx: -0.75 - Math.sin(ph) * 0.25, aLz: 0.35 + Math.sin(ph) * 0.75 * en, fR: -0.3, fL: -0.3, cx: 0.72, cz: Math.sin(ph) * 0.12, drop: 0.2 + 0.04 * beat, thL: -0.65, thR: -0.65, shL: 1.0, shR: 1.0, hx: -0.35 };
        const D: J = { aRx: -0.2 + Math.sin(ph * 2) * 0.2, aRz: -1.45, aLx: -0.2 - Math.sin(ph * 2) * 0.2, aLz: 1.45, fR: -0.35, fL: -0.35, cx: 0.05, cz: 0.12, drop: 0.04, thL: -0.2 * beat, thR: -0.2 * (1 - beat), shL: 0.4 * beat, shR: 0.4 * (1 - beat), hx: -0.05 };
        const v = (k: keyof J) => (A[k] * wA + B[k] * wB + C[k] * wC + D[k] * wD) / sum;
        mix(this.armR, 'x', v('aRx'));
        mix(this.armR, 'z', v('aRz'));
        mix(this.armL, 'x', v('aLx'));
        mix(this.armL, 'z', v('aLz'));
        mix(this.foreR, 'x', v('fR'));
        mix(this.foreL, 'x', v('fL'));
        mix(this.chest, 'x', v('cx'));
        mix(this.chest, 'z', v('cz'));
        mix(this.head, 'x', v('hx'));
        mix(this.thighL, 'x', v('thL'));
        mix(this.thighR, 'x', v('thR'));
        mix(this.shinL, 'x', v('shL'));
        mix(this.shinR, 'x', v('shR'));
        this.hips.position.y -= v('drop') * w;
        // the spin: a full turn across movement D
        if (wD > 0.01) this.body.rotation.y = (Math.min(1, Math.max(0, (cyc - 11) / 2)) * Math.PI * 2) * w;
        break;
      }
      case 'nach': {
        // a graceful folk dance: hands in mudra at shoulder height, swaying hips, small steps
        const sp = 4 * this.tempo, a = t * sp;
        const en = 0.6 + this.energy * 0.5;
        mix(this.armL, 'z', 1.2 + Math.sin(a) * 0.4 * en);
        mix(this.armR, 'z', -1.2 + Math.sin(a) * 0.4 * en);
        mix(this.armL, 'x', -0.5);
        mix(this.armR, 'x', -0.5);
        mix(this.foreL, 'x', -1.3 + Math.cos(a) * 0.3);
        mix(this.foreR, 'x', -1.3 - Math.cos(a) * 0.3);
        mix(this.chest, 'z', -Math.sin(a) * 0.1 * en);
        mix(this.hips, 'z', Math.sin(a) * 0.08 * en);
        mix(this.head, 'z', Math.sin(a) * 0.12);
        mix(this.thighL, 'x', -Math.max(0, Math.sin(a)) * 0.35 * en);
        mix(this.thighR, 'x', -Math.max(0, -Math.sin(a)) * 0.35 * en);
        this.hips.position.y += Math.abs(Math.cos(a)) * 0.03 * w;
        break;
      }
      case 'dance': {
        const s = Math.sin(t * 5);
        mix(this.armL, 'z', 2.3 + s * 0.35);
        mix(this.armR, 'z', -2.3 + s * 0.35);
        mix(this.chest, 'z', s * 0.1);
        this.hips.position.y += Math.abs(s) * 0.04 * w;
        break;
      }
    }
  }

  setShadows(on: boolean) {
    for (const p of this.parts) p.castShadow = on;
  }
}
