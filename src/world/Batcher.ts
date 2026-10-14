/**
 * Collects static geometry per (material, spatial cell) and merges it into a few large meshes.
 * The whole static city ends up as a few dozen draw calls while still being frustum-cullable by cell.
 *
 * Memory: add() only records a reference to a shared, batch-ready template of the source geometry
 * plus its matrix and colour. build() then writes each merged mesh straight into its final compact
 * arrays (16-bit positions, 8-bit normals and colours) in one pass, so loading creates almost no
 * temporary vertex data, and those arrays are dropped from JS once they're on the GPU.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { batchMaterial } from '../rendering/materials';
import { toPlanet } from '../utils/planet';
import { ensureIndex, releaseAfterUpload } from '../utils/geometry';

const CELL = 35;

interface Entry {
  t: THREE.BufferGeometry;
  m: THREE.Matrix4;
  /** Flat colour for a folded colour material; null to use the template's own colours (if any). */
  col: THREE.Color | null;
}
interface Bucket {
  mat: THREE.Material;
  shadow: boolean;
  coloured: boolean;
  textured: boolean;
  /** Any colour component above 1 (HDR glow for bloom): colours then stay float. */
  hdr: boolean;
  verts: number;
  indices: number;
  box: THREE.Box3;
  items: Entry[];
}

const _box = new THREE.Box3();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _nm = new THREE.Matrix3();

export class Batcher {
  /** Debug: vertex totals per source geometry and call site (enabled with ?census=1). */
  static census: Map<string, { n: number; verts: number }> | null = typeof location !== 'undefined' && location.search.includes('census') ? ((globalThis as any).__census = new Map()) : null;
  private buckets = new Map<string, Bucket>();
  private tmp = new THREE.Matrix4();

  add(geom: THREE.BufferGeometry, mat: THREE.Material, matrix: THREE.Matrix4, opts: { shadow?: boolean } = {}) {
    const textured = !mat.userData.batchable && !!(mat as THREE.MeshBasicMaterial).map;
    // stays indexed: shared corners are stored once, not once per triangle
    const t = template(lod(geom, matrix), textured);
    if (Batcher.census) {
      const k = geom.type + ' ' + JSON.stringify((geom as THREE.BufferGeometry & { parameters?: object }).parameters ?? geom.attributes.position.count) + ' @' + (new Error().stack?.split('\n')[3]?.trim().replace(/^at /, '').replace(/\(.*\/src\//, '(').replace(/\?t=\d+/, '') ?? '');
      const e = Batcher.census.get(k) ?? { n: 0, verts: 0 };
      e.n++;
      e.verts += t.attributes.position.count;
      Batcher.census.set(k, e);
    }
    // colour-carrying materials are folded into a shared vertex-coloured material
    let col: THREE.Color | null = null;
    if (mat.userData.batchable) {
      col = (mat as THREE.MeshBasicMaterial).color;
      mat = batchMaterial(mat.userData.batch);
    }
    const coloured = !!col || !!t.attributes.color;
    const c = _v.copy(t.boundingSphere!.center).applyMatrix4(matrix);
    const shadow = opts.shadow ?? true;
    const key = `${mat.uuid}|${coloured ? 'c' : ''}|${Math.floor(c.x / CELL)},${Math.floor(c.z / CELL)}|${shadow}`;
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, (b = { mat, shadow, coloured, textured, hdr: false, verts: 0, indices: 0, box: new THREE.Box3(), items: [] }));
    b.items.push({ t, m: matrix.clone(), col });
    b.verts += t.attributes.position.count;
    b.indices += t.index!.count;
    b.box.union(_box.copy(t.boundingBox!).applyMatrix4(matrix));
    if (col ? Math.max(col.r, col.g, col.b) > 1.0001 : t.userData.hdr) b.hdr = true;
  }

  /** Convenience: add a box with centre/size/rotation. */
  box(mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, rotY = 0, base?: THREE.Matrix4, shadow = true) {
    const m = this.tmp.makeRotationY(rotY).setPosition(x, y, z);
    if (base) m.premultiply(base);
    this.add(unitBox, mat, m.clone().multiply(new THREE.Matrix4().makeScale(w, h, d)), { shadow });
  }

  addMesh(geom: THREE.BufferGeometry, mat: THREE.Material, pos: THREE.Vector3Like, rot: THREE.Euler | null, scale: THREE.Vector3Like | number, base?: THREE.Matrix4, shadow = true) {
    const s = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(scale.x, scale.y, scale.z);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(pos.x, pos.y, pos.z),
      new THREE.Quaternion().setFromEuler(rot ?? new THREE.Euler()),
      s,
    );
    if (base) m.premultiply(base);
    this.add(geom, mat, m, { shadow });
  }

  build(parent: THREE.Object3D): { meshes: number; triangles: number } {
    let meshes = 0, triangles = 0;
    for (const b of this.buckets.values()) {
      if (!b.verts) continue;
      const geo = writeBucket(b);
      // cull against where the geometry is drawn: its planet-space bounding sphere
      const flatSphere = b.box.getBoundingSphere(new THREE.Sphere());
      const flat = flatSphere.center.clone();
      const center = toPlanet(flat.x, flat.y, flat.z, new THREE.Vector3());
      const radius = flatSphere.radius * 1.1;
      const q = geo.userData.q as { offset: THREE.Vector3; scale: THREE.Vector3 };
      const mesh = new THREE.Mesh(geo, b.mat);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.compose(q.offset, new THREE.Quaternion(), q.scale);
      mesh.matrixWorldNeedsUpdate = true;
      // three.js culls with geometry bounds × the mesh matrix: express the planet-space sphere locally
      geo.boundingSphere = new THREE.Sphere(center.sub(q.offset).divideScalar(q.scale.x), radius / q.scale.x);
      mesh.userData.flatCenter = flat;
      mesh.userData.flatRadius = flatSphere.radius;
      mesh.userData.maxY = b.box.max.y;
      mesh.castShadow = b.shadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
      meshes++;
      triangles += b.indices / 3;
      releaseAfterUpload(geo);
    }
    this.buckets.clear();
    return { meshes, triangles };
  }
}

/**
 * Write one bucket's merged mesh directly in its final formats:
 * - positions as normalised 16-bit integers inside the bucket's bounding box (6 bytes per vertex
 *   instead of 12; under a millimetre of error across a 35 m cell). The offset and uniform scale
 *   become the mesh matrix, so shaders see the original coordinates through modelMatrix;
 * - normals as normalised 8-bit;
 * - colours as normalised 8-bit, or float when they carry HDR glow values for bloom.
 */
function writeBucket(b: Bucket): THREE.BufferGeometry {
  const offset = b.box.getCenter(new THREE.Vector3());
  const size = b.box.getSize(new THREE.Vector3());
  const half = Math.max(1e-4, size.x / 2, size.y / 2, size.z / 2);
  const inv = 32767 / half;
  const pos = new Int16Array(b.verts * 3);
  const nrm = new Int8Array(b.verts * 3);
  const col = b.coloured ? (b.hdr ? new Float32Array(b.verts * 3) : new Uint8Array(b.verts * 3)) : null;
  const uv = b.textured ? new Float32Array(b.verts * 2) : null;
  const idx = b.verts > 65535 ? new Uint32Array(b.indices) : new Uint16Array(b.indices);
  const k = b.hdr ? 1 : 255;
  let v = 0, ii = 0;
  for (const { t, m, col: flat } of b.items) {
    const tp = t.attributes.position as THREE.BufferAttribute, tn = t.attributes.normal as THREE.BufferAttribute;
    const tc = t.attributes.color as THREE.BufferAttribute | undefined, tu = t.attributes.uv as THREE.BufferAttribute | undefined;
    _nm.getNormalMatrix(m);
    const n = tp.count;
    for (let i = 0; i < n; i++) {
      const o = (v + i) * 3;
      _v.fromBufferAttribute(tp, i).applyMatrix4(m);
      pos[o] = Math.round((_v.x - offset.x) * inv);
      pos[o + 1] = Math.round((_v.y - offset.y) * inv);
      pos[o + 2] = Math.round((_v.z - offset.z) * inv);
      _n.fromBufferAttribute(tn, i).applyMatrix3(_nm).normalize();
      nrm[o] = Math.round(_n.x * 127);
      nrm[o + 1] = Math.round(_n.y * 127);
      nrm[o + 2] = Math.round(_n.z * 127);
      if (col) {
        const r = flat ? flat.r : tc ? tc.getX(i) : 1, g = flat ? flat.g : tc ? tc.getY(i) : 1, bl = flat ? flat.b : tc ? tc.getZ(i) : 1;
        col[o] = b.hdr ? r : Math.round(Math.min(1, Math.max(0, r)) * k);
        col[o + 1] = b.hdr ? g : Math.round(Math.min(1, Math.max(0, g)) * k);
        col[o + 2] = b.hdr ? bl : Math.round(Math.min(1, Math.max(0, bl)) * k);
      }
      if (uv && tu) {
        uv[(v + i) * 2] = tu.getX(i);
        uv[(v + i) * 2 + 1] = tu.getY(i);
      }
    }
    const ti = t.index!.array;
    for (let j = 0; j < ti.length; j++) idx[ii + j] = ti[j] + v;
    ii += ti.length;
    v += n;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3, true));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3, true));
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3, !b.hdr));
  if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.userData.q = { offset, scale: new THREE.Vector3(half, half, half) };
  return g;
}

/**
 * A batch-ready copy of a source geometry, made once per geometry: only the attributes the batch
 * keeps (UVs only for textured materials), and indexed. Non-indexed sources (three.js polyhedra,
 * hand-built meshes) are welded, so smooth-shaded icosahedron foliage shrinks from 960 to 162
 * vertices; flat-shaded faces keep distinct normals and stay unwelded.
 */
const templates = [new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>(), new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>()];
function template(geom: THREE.BufferGeometry, textured: boolean): THREE.BufferGeometry {
  const cache = templates[textured ? 1 : 0];
  let t = cache.get(geom);
  if (!t) {
    t = geom.clone();
    for (const name of Object.keys(t.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name) || (name === 'uv' && !textured)) t.deleteAttribute(name);
    if (textured && !t.attributes.uv) t.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(t.attributes.position.count * 2), 2));
    t = t.index ? t : mergeVertices(t, 1e-5);
    ensureIndex(t);
    if (!t.attributes.normal) t.computeVertexNormals();
    t.computeBoundingBox();
    t.computeBoundingSphere();
    const c = t.attributes.color;
    t.userData.hdr = !!c && Array.prototype.some.call(c.array, (x: number) => x > 1.0001);
    cache.set(geom, t);
  }
  return t;
}

/**
 * Spheres scaled down to beads, marigolds and bulbs don't need 16–20 segments: pick the segment
 * count from the sphere's size in the world (about one segment per 10 cm of circumference,
 * never below 8 × 6, never above the original).
 */
const lodCache = new Map<string, THREE.SphereGeometry>();
const sc = new THREE.Vector3();
function lod(geom: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry {
  if (!(geom as THREE.SphereGeometry).isBufferGeometry || geom.type !== 'SphereGeometry') return geom;
  const p = (geom as THREE.SphereGeometry).parameters;
  sc.setFromMatrixScale(matrix);
  const r = p.radius * Math.max(sc.x, sc.y, sc.z);
  const w = Math.min(p.widthSegments, Math.max(8, Math.ceil(r * 64)));
  const h = Math.min(p.heightSegments, Math.max(6, Math.round(w * 0.7)));
  if (w === p.widthSegments && h === p.heightSegments) return geom;
  const k = `${p.radius}|${w}|${h}|${p.phiStart}|${p.phiLength}|${p.thetaStart}|${p.thetaLength}`;
  let g = lodCache.get(k);
  if (!g) lodCache.set(k, (g = new THREE.SphereGeometry(p.radius, w, h, p.phiStart, p.phiLength, p.thetaStart, p.thetaLength)));
  return g;
}

export const unitBox = new THREE.BoxGeometry(1, 1, 1);
