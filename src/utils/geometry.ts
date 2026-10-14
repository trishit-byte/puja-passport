/**
 * Memory helpers for big merged meshes. Static batches and crowd bodies hold millions of
 * vertices, so they are kept indexed and stored in compact vertex formats: normals as normalised
 * 8-bit, colours as normalised 8-bit (unless they carry HDR values for bloom).
 */
import * as THREE from 'three';

/** Give a non-indexed geometry a trivial index so it can merge with indexed ones. */
export function ensureIndex(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  return g;
}

/** Shrink the index to 16 bits when the vertex count allows it. */
export function compactIndex(g: THREE.BufferGeometry) {
  const idx = g.index;
  if (!idx || g.attributes.position.count > 65535 || idx.array instanceof Uint16Array) return;
  g.setIndex(new THREE.BufferAttribute(Uint16Array.from(idx.array as ArrayLike<number>), 1));
}

/** Float normals → normalised Int8 (3 bytes per vertex instead of 12). */
export function packNormals(g: THREE.BufferGeometry) {
  const a = g.attributes.normal as THREE.BufferAttribute | undefined;
  if (!a || a.array instanceof Int8Array) return;
  const out = new Int8Array(a.count * 3);
  for (let i = 0; i < a.count; i++) {
    let x = a.getX(i), y = a.getY(i), z = a.getZ(i);
    const l = Math.hypot(x, y, z) || 1;
    x /= l;
    y /= l;
    z /= l;
    out[i * 3] = Math.round(x * 127);
    out[i * 3 + 1] = Math.round(y * 127);
    out[i * 3 + 2] = Math.round(z * 127);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3, true));
}

/** Float colours in 0…1 → normalised Uint8 (3 bytes per vertex instead of 12). */
export function packColors(a: THREE.BufferAttribute): THREE.BufferAttribute {
  if (a.array instanceof Uint8Array) return a;
  const out = new Uint8Array(a.count * 3);
  for (let i = 0; i < a.count; i++) {
    out[i * 3] = Math.round(Math.min(1, Math.max(0, a.getX(i))) * 255);
    out[i * 3 + 1] = Math.round(Math.min(1, Math.max(0, a.getY(i))) * 255);
    out[i * 3 + 2] = Math.round(Math.min(1, Math.max(0, a.getZ(i))) * 255);
  }
  return new THREE.BufferAttribute(out, 3, true);
}

/** True when every colour component fits 0…1 (HDR glow colours above 1 must stay float). */
export function colorsFit(a: THREE.BufferAttribute): boolean {
  const arr = a.array as ArrayLike<number>;
  for (let i = 0; i < arr.length; i++) if (arr[i] > 1.0001) return false;
  return true;
}

/** Set once any geometry has dropped its CPU copy; a lost WebGL context then needs a page reload. */
export let releasedGeometry = false;
function release(this: { array: unknown }) {
  // the GPU keeps its copy; three.js never reads these arrays again unless the data changes
  this.array = EMPTY;
}
const EMPTY = new Float32Array(0);

/**
 * Free a static geometry's JS-side vertex and index arrays once they've been uploaded to the GPU.
 * Halves the memory big static meshes cost. Only for geometry that never changes and is never
 * raycast; bounding volumes must be computed beforehand.
 */
export function releaseAfterUpload(g: THREE.BufferGeometry | THREE.BufferAttribute[]) {
  releasedGeometry = true;
  const list = Array.isArray(g) ? g : [...Object.values(g.attributes), ...(g.index ? [g.index] : [])];
  for (const a of list) (a as THREE.BufferAttribute).onUpload(release);
}

/**
 * Drop a texture's source canvas once it's on the GPU (each 1024-wide board canvas holds about
 * 1.4 MB). Only for textures that are drawn once and never redrawn.
 */
export function releaseImageAfterUpload(t: THREE.Texture) {
  releasedGeometry = true;
  t.onUpdate = () => {
    const im = t.image as { width: number; height: number };
    t.image = { width: im.width, height: im.height };
    t.onUpdate = () => {};
  };
}
