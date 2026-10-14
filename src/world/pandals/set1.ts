/**
 * Pandals 2–4: Alo'r Utsav (light), Gram Bangla (rural folk crafts), Shobuj Swapno (nature).
 */
import * as THREE from 'three';
import { releaseImageAfterUpload } from '../../utils/geometry';
import { toon, glow, bend } from '../../rendering/materials';
import { idolTableau, gate, bediRailing, enclosure, landmarkTower, alponaMesh, cyl, sph, cone, disc, type PandalBuild, type Local } from './common';
import type { BuildCtx } from './index';

/** A mesh with its own glow material whose brightness we animate (lit / unlit states). */
export function lamp(geo: THREE.BufferGeometry, color: number, L: Local, x: number, y: number, z: number, s: THREE.Vector3Like | number, parent: THREE.Object3D, rot?: THREE.Euler) {
  const mat = bend(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.25) })) as THREE.MeshBasicMaterial;
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(L.w(x, y, z));
  if (typeof s === 'number') m.scale.setScalar(s);
  else m.scale.set(s.x, s.y, s.z);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(L.base));
  if (rot) m.quaternion.multiply(new THREE.Quaternion().setFromEuler(rot));
  m.frustumCulled = false;
  parent.add(m);
  return { mesh: m, base: new THREE.Color(color), set(k: number) { mat.color.copy(this.base).multiplyScalar(k); } };
}

function ringMarker(L: Local, x: number, z: number, color: number, parent: THREE.Object3D) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 40).rotateX(-Math.PI / 2), bend(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), transparent: true, opacity: 0.7, depthWrite: false })));
  m.position.copy(L.w(x, 0.1, z));
  m.frustumCulled = false;
  parent.add(m);
  return m;
}

// --------------------------------------------------------------------------- Alo'r Utsav
export function buildAlorUtsav(ctx: BuildCtx): PandalBuild {
  const { L, cols, bulbs, def } = ctx;
  const dyn = new THREE.Group();
  L.dyn = dyn;
  const bamboo = toon(0xb08a4a), dark = toon(0x3a2a1a), gold = toon(0xd4af37);
  const R = 17;
  enclosure(L, cols, R, 7, toon(0x5a3a1a), 3);
  gate(L, R + 0.2, 7, 7, { frame: 0x8a5a2b, cloth: 0x7a2a10, accent: 0xffc93c }, { bn: def.bn, en: def.name }, bulbs, dyn);
  // the bamboo hall: a lattice of poles and beams, every edge strung with warm bulbs
  const warm = [0xffe8b0, 0xffc93c, 0xffb33c, 0xfff1c4];
  for (let ix = -3; ix <= 3; ix++)
    for (const iz of [-13, -6, 1]) {
      const x = ix * 3.4;
      L.put(cyl, bamboo, x, 4.5, iz, 0.28, 9, 0.28);
      for (let y = 0.6; y < 9; y += 0.55) bulbs.add(L.w(x, y, iz + 0.2), warm[Math.floor(y * 3) % 4], 0.09, Math.floor(y * 2) % 2);
    }
  for (const iz of [-13, -6, 1]) {
    L.box(bamboo, 0, 9.1, iz, 21, 0.3, 0.3);
    for (let i = 0; i <= 50; i++) {
      const u = i / 50;
      bulbs.add(L.w(-10.5 + u * 21, 9.4 + Math.sin(u * Math.PI) * 1.8, iz + 0.2), warm[i % 4], 0.11, i % 2);
    }
  }
  // arched golden roof frames
  const arch = new THREE.TorusGeometry(0.5, 0.035, 6, 28, Math.PI);
  for (let k = 0; k < 6; k++) L.put(arch, gold, 0, 9.2, -13 + k * 2.8, 21, 7, 4, 0, 0, 0, false);
  // hanging lantern clusters
  for (let i = 0; i < 18; i++) {
    const x = -9 + (i % 6) * 3.6, z = -12 + Math.floor(i / 6) * 6;
    L.put(cyl, dark, x, 8.1, z, 0.02, 1.8, 0.02, 0, 0, 0, false);
    L.put(sph, glow(i % 3 ? 0xffc93c : 0xff7a1a, 2.6), x, 7.0, z, 0.45, 0.6, 0.45, 0, 0, 0, false);
  }
  idolTableau(L, 0, -11, 1.15, { panel: 0x7a2a10, chalchitra: 0xffc93c, style: 'gilded' });
  bediRailing(L, cols, -6.2, 12);
  // three light sculptures (peacock, lotus, conch) — dark until the visitor wakes them
  const sculpt: { id: string; parts: ReturnType<typeof lamp>[]; x: number; z: number; ring: THREE.Mesh }[] = [];
  const spots: [string, number, number][] = [['sculpt-1', -8, 6], ['sculpt-2', 0, 9], ['sculpt-3', 8, 6]];
  const ico = new THREE.IcosahedronGeometry(0.5, 1);
  for (const [id, x, z] of spots) {
    L.put(cyl, dark, x, 0.4, z, 1.0, 0.8, 1.0);
    cols.addCircle(L.w(x, 0, z).x, L.w(x, 0, z).z, 1.1, 1);
    const parts: ReturnType<typeof lamp>[] = [];
    if (id === 'sculpt-1') {
      parts.push(lamp(ico, 0x3fc1c9, L, x, 1.6, z, { x: 0.8, y: 1.1, z: 0.7 }, dyn));
      parts.push(lamp(ico, 0x3fc1c9, L, x, 2.5, z + 0.2, 0.45, dyn));
      for (let k = 0; k < 9; k++) {
        const a = Math.PI * (0.1 + (0.8 * k) / 8);
        parts.push(lamp(ico, k % 2 ? 0x5ef2ff : 0xffc93c, L, x + Math.cos(a) * 1.6, 1.4 + Math.sin(a) * 1.6, z - 0.4, 0.38, dyn));
      }
    } else if (id === 'sculpt-2') {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        parts.push(lamp(new THREE.ConeGeometry(0.4, 1.4, 8), 0xff5fa2, L, x + Math.cos(a) * 0.6, 1.6, z + Math.sin(a) * 0.6, 1, dyn, new THREE.Euler(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6)));
      }
      parts.push(lamp(ico, 0xffe8b0, L, x, 1.6, z, 0.6, dyn));
    } else {
      for (let k = 0; k < 10; k++) {
        const a = k * 0.7, r = 0.2 + k * 0.08;
        parts.push(lamp(ico, k % 2 ? 0xfff1c4 : 0xffd38a, L, x + Math.cos(a) * r, 1.0 + k * 0.17, z + Math.sin(a) * r, 0.42 - k * 0.02, dyn));
      }
    }
    sculpt.push({ id, parts, x, z, ring: ringMarker(L, x, z + 1.9, 0xffc93c, dyn) });
  }
  landmarkTower(L, -13.5, -13.5, 22, [0xffc93c, 0xffe8b0, 0xff7a1a], bulbs);
  const flash = new Map<string, number>();
  return {
    targets: spots.map(([id, x, z]) => ({ id, pos: L.w(x, 0, z + 2.0), radius: 2.3 })),
    lights: [
      { pos: L.w(0, 7, -8), color: 0xffd38a, intensity: 20, distance: 24 },
      { pos: L.w(0, 4, 5), color: 0xffb33c, intensity: 10, distance: 18 },
    ],
    dynamic: dyn,
    update(t, dt, done, complete) {
      for (const s of sculpt) {
        const on = done.includes(s.id) || complete;
        const f = (flash.get(s.id) ?? 0);
        flash.set(s.id, Math.max(0, f - dt));
        s.parts.forEach((p, i) => p.set(on ? 2.4 + 0.6 * Math.sin(t * 4 + i * 0.6) + f * 6 : 0.25 + 0.1 * Math.sin(t * 2 + i)));
        s.ring.visible = !on;
      }
    },
    onActivate(id) {
      flash.set(id, 0.6);
    },
    view: { pos: L.w(0, 3, 9), look: L.w(0, 4, -11) },
    gate: L.w(0, 0, R - 3),
    darshan: L.w(0, 0, -2),
  };
}

// --------------------------------------------------------------------------- Gram Bangla
/** Painted mud-wall / scroll texture (patachitra-style figures, borders and alpona). */
function folkTexture(kind: 'pat' | 'mud' | 'terracotta'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d')!;
  if (kind === 'mud') {
    g.fillStyle = '#b07a4f';
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#f4eedf';
    g.strokeStyle = '#f4eedf';
    g.lineWidth = 6;
    for (let x = 30; x < 512; x += 80) {
      g.beginPath();
      g.moveTo(x, 470);
      g.quadraticCurveTo(x + 20, 390, x, 330);
      g.stroke();
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.ellipse(x + (k % 2 ? 14 : -14), 440 - k * 30, 12, 6, k % 2 ? 0.6 : -0.6, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.fillRect(0, 490, 512, 10);
    for (let x = 0; x < 512; x += 24) {
      g.beginPath();
      g.arc(x + 12, 300, 7, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === 'pat') {
    g.fillStyle = '#f1dfb0';
    g.fillRect(0, 0, 512, 512);
    const cols = ['#b3121f', '#1f4f5a', '#f6a21e', '#2f6b4e'];
    g.lineWidth = 10;
    g.strokeStyle = '#b3121f';
    g.strokeRect(10, 10, 492, 492);
    for (let row = 0; row < 3; row++) {
      g.strokeStyle = '#3a2416';
      g.lineWidth = 4;
      g.strokeRect(30, 30 + row * 158, 452, 146);
      for (let k = 0; k < 3; k++) {
        const x = 90 + k * 150, y = 105 + row * 158;
        g.fillStyle = cols[(row + k) % 4];
        g.beginPath();
        g.ellipse(x, y + 18, 26, 42, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#e9b98a';
        g.beginPath();
        g.arc(x, y - 34, 18, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#111';
        g.beginPath();
        g.ellipse(x + 6, y - 36, 7, 3, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else {
    g.fillStyle = '#b5562f';
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#8c3a1e';
    for (let y = 0; y < 512; y += 64)
      for (let x = 0; x < 512; x += 64) {
        g.fillRect(x + 4, y + 4, 56, 56);
        g.fillStyle = '#d07a4a';
        g.beginPath();
        g.arc(x + 32, y + 26, 10, 0, Math.PI * 2);
        g.fill();
        g.fillRect(x + 24, y + 36, 16, 20);
        g.fillStyle = '#8c3a1e';
      }
  }
  const t = new THREE.CanvasTexture(c);
  releaseImageAfterUpload(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function texturedPanel(tex: THREE.Texture, w: number, h: number) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), bend(new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })));
}

export function buildGramBangla(ctx: BuildCtx): PandalBuild {
  const { L, cols, bulbs, def } = ctx;
  const dyn = new THREE.Group();
  L.dyn = dyn;
  const thatch = toon(0xc9a46a, { side: THREE.DoubleSide }), mudM = toon(0xa86f48), bamboo = toon(0x9c7a44), straw = toon(0xd8b86a);
  const R = 17;
  // woven bamboo fence instead of walls
  enclosure(L, cols, R, 6, toon(0x9c7a44), 1.6);
  for (let i = -R; i <= R; i += 0.8) {
    for (const [ax, az] of [[i, -R], [-R, i], [R, i]] as const) L.put(cyl, bamboo, ax, 1.0, az, 0.09, 2.0, 0.09, 0, 0, 0, false);
  }
  gate(L, R + 0.2, 6, 5, { frame: 0x9c7a44, cloth: 0x2f6b4e, accent: 0xf6a21e }, { bn: def.bn, en: def.name }, bulbs, dyn);
  const mudTex = folkTexture('mud');
  // village huts with mud walls painted in white alpona, and curved thatched roofs
  for (const [x, z, ry] of [[-11, -2, 0.4], [11, -2, -0.4], [-11, 8, 0.2]] as const) {
    L.box(mudM, x, 1.4, z, 5, 2.8, 4, ry);
    const wallPanel = texturedPanel(mudTex, 4.8, 2.6);
    wallPanel.position.copy(L.w(x + Math.sin(ry) * 2.02, 1.4, z + Math.cos(ry) * 2.02));
    wallPanel.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(L.base)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)));
    wallPanel.frustumCulled = false;
    dyn.add(wallPanel);
    L.put(cone, thatch, x, 3.9, z, 7.2, 2.4, 5.6, 0, ry + Math.PI / 4, 0);
    L.put(sph, straw, x, 5.1, z, 0.35, 0.35, 0.35);
    const w = L.w(x, 0, z);
    cols.addBox(w.x, w.z, 5.2, 4.2, def.facing + ry, 3);
  }
  // the protima under a grand two-tier aat-chala thatched pavilion
  for (const x of [-6, 6]) for (const z of [-15, -6]) L.put(cyl, bamboo, x, 3.4, z, 0.35, 6.8, 0.35);
  L.put(cone, thatch, 0, 8.2, -10.5, 18, 3.0, 13, 0, Math.PI / 4, 0);
  L.put(cone, thatch, 0, 10.4, -10.5, 7, 2.2, 5, 0, Math.PI / 4, 0);
  L.put(sph, toon(0xd4af37), 0, 11.7, -10.5, 0.4, 0.4, 0.4);
  idolTableau(L, 0, -11, 1.0, { panel: 0x2f6b4e, chalchitra: 0xd4af37, sholapith: true, style: 'terracotta' });
  bediRailing(L, cols, -6.6, 11);
  // banyan tree, haystack, hanging clay pots
  L.put(cyl, toon(0x5a3d2b), 12, 3, 10, 1.2, 6, 1.2);
  for (let k = 0; k < 6; k++) L.put(sph, toon(k % 2 ? 0x2f6b3a : 0x3b7d42), 12 + Math.cos(k) * 2.2, 6.5 + (k % 3) * 0.6, 10 + Math.sin(k) * 2.2, 3, 2.4, 3);
  for (let k = 0; k < 5; k++) L.put(cyl, toon(0x5a3d2b), 12 + Math.cos(k * 1.3) * 2.6, 2.5, 10 + Math.sin(k * 1.3) * 2.6, 0.12, 5, 0.12, 0, 0, 0, false);
  cols.addCircle(L.w(12, 0, 10).x, L.w(12, 0, 10).z, 1.4, 6);
  L.put(cone, straw, -13, 1.6, 13, 3, 3.2, 3);
  cols.addCircle(L.w(-13, 0, 13).x, L.w(-13, 0, 13).z, 1.4, 3);
  // clay water pots (kolshi) by the gate
  for (let k = 0; k < 3; k++) {
    L.put(sph, toon(0xb5562f), -14 + k * 0.9, 0.3, 12, 0.32, 0.3, 0.32);
    L.put(cyl, toon(0xb5562f), -14 + k * 0.9, 0.62, 12, 0.13, 0.12, 0.13, 0, 0, 0, false);
  }
  const alp = alponaMesh(3, ['#f4eedf', '#b3121f']);
  alp.position.copy(L.w(0, 0.08, -2));
  dyn.add(alp);
  // the three crafts: patachitra scroll (on a stand), terracotta panel, dokra figures on a low table
  const pat = texturedPanel(folkTexture('pat'), 1.6, 2.6);
  const terr = texturedPanel(folkTexture('terracotta'), 2.4, 1.8);
  const stations: [string, number, number][] = [['panel-pat', -6, 4], ['panel-terracotta', 0, 6], ['panel-dokra', 6, 4]];
  for (const [id, x, z] of stations) {
    if (id === 'panel-pat') {
      L.put(cyl, bamboo, x - 0.9, 1.6, z, 0.08, 3.2, 0.08);
      L.put(cyl, bamboo, x + 0.9, 1.6, z, 0.08, 3.2, 0.08);
      L.put(cyl, toon(0x6b3a22), x, 3.05, z, 0.12, 2.0, 0.12, 0, 0, Math.PI / 2);
      pat.position.copy(L.w(x, 1.7, z));
      pat.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(L.base));
      pat.frustumCulled = false;
      dyn.add(pat);
    } else if (id === 'panel-terracotta') {
      L.box(toon(0x8c3a1e), x, 1.3, z - 0.1, 2.8, 2.6, 0.3);
      terr.position.copy(L.w(x, 1.4, z + 0.06));
      terr.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(L.base));
      terr.frustumCulled = false;
      dyn.add(terr);
    } else {
      L.box(toon(0x6b3a22), x, 0.45, z, 2.4, 0.9, 1.2);
      for (let k = 0; k < 4; k++) {
        const fx = x - 0.8 + k * 0.53;
        L.put(sph, toon(0xb98a3a), fx, 1.15, z, 0.18, 0.13, 0.32);
        L.put(sph, toon(0xb98a3a), fx, 1.35, z + 0.22, 0.08, 0.14, 0.08);
        for (const lx of [-0.08, 0.08]) L.put(cyl, toon(0xb98a3a), fx + lx, 0.98, z, 0.03, 0.25, 0.03);
      }
    }
    const w = L.w(x, 0, z);
    cols.addCircle(w.x, w.z, 1.1, 2);
  }
  const rings = stations.map(([, x, z]) => ringMarker(L, x, z + 1.8, 0xf6a21e, dyn));
  landmarkTower(L, 14, -14, 20, [0xf6a21e, 0xffe8b0, 0x2f6b4e], bulbs, 0x6b4a2a);
  return {
    targets: stations.map(([id, x, z]) => ({ id, pos: L.w(x, 0, z + 1.9), radius: 2.3 })),
    lights: [
      { pos: L.w(0, 6, -9), color: 0xffcf8a, intensity: 16, distance: 20 },
      { pos: L.w(0, 3, 5), color: 0xffb36b, intensity: 9, distance: 16 },
    ],
    dynamic: dyn,
    update(_t, _dt, done, complete) {
      stations.forEach(([id], i) => (rings[i].visible = !(done.includes(id) || complete)));
    },
    onActivate() {},
    view: { pos: L.w(0, 3, 6), look: L.w(0, 3.5, -11) },
    gate: L.w(0, 0, R - 3),
    darshan: L.w(0, 0, -3),
  };
}

// --------------------------------------------------------------------------- Shobuj Swapno
/** A big stylised leaf: a flattened, bent ellipsoid with a midrib. */
function leafGeo(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 16, 10);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    z *= 0.08;
    x *= 0.42 * (1 - Math.abs(y) * 0.35);
    z += -0.35 * y * y; // curl
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

export function buildShobujSwapno(ctx: BuildCtx): PandalBuild {
  const { L, cols, bulbs, def } = ctx;
  const dyn = new THREE.Group();
  L.dyn = dyn;
  const leafG = leafGeo();
  const greens = [0x2f8a3a, 0x3fae5a, 0x1f6b3a, 0x5cc06a];
  const bamboo = toon(0x7fae4a);
  const R = 18;
  enclosure(L, cols, R, 7, toon(0x2f5d3a), 2.6);
  gate(L, R + 0.2, 7, 6, { frame: 0x2f6b3a, cloth: 0x1f5e3a, accent: 0xb6f08a }, { bn: def.bn, en: def.name }, bulbs, dyn);
  // bamboo groves along the walls
  for (let i = 0; i < 40; i++) {
    const side = i % 2 ? 1 : -1;
    const z = -16 + (i / 40) * 30;
    const x = side * (15 + (i % 3) * 0.6);
    const h = 7 + (i % 5);
    L.put(cyl, bamboo, x, h / 2, z, 0.18, h, 0.18);
    for (let k = 0; k < 3; k++) L.put(leafGeo(), toon(greens[k % 4], { side: THREE.DoubleSide }), x, h - k * 0.8, z, 0.4, 0.8, 0.4, 0.6, k * 2, side * 0.8, false);
  }
  // giant arching leaves forming a canopy over the visitor path
  for (let k = 0; k < 10; k++) {
    const side = k % 2 ? 1 : -1;
    const z = 12 - Math.floor(k / 2) * 5;
    L.put(leafG, toon(greens[k % 4], { side: THREE.DoubleSide }), side * 5.5, 5.5, z, 4.5, 6.5, 4.5, 0.2, side * 0.3, side * 0.9);
  }
  // little water channels either side of the path
  for (const x of [-3.2, 3.2]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 22, 1, 10).rotateX(-Math.PI / 2), bend(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3fb6c9).multiplyScalar(0.9) })));
    w.position.copy(L.w(x, 0.07, 2));
    w.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(L.base));
    w.frustumCulled = false;
    dyn.add(w);
  }
  // the tree of life: thick trunk, roots, and a crown that wakes with light
  // set to one side of the courtyard, so the view from the gate to the protima stays open
  const tx = -9.5, tz = 1;
  L.put(cyl, toon(0x5a3d2b), tx, 3, tz, 1.3, 6, 1.3);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    L.put(cyl, toon(0x5a3d2b), tx + Math.cos(a) * 1.1, 0.4, tz + Math.sin(a) * 1.1, 0.25, 1.6, 0.25, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    L.put(cyl, toon(0x5a3d2b), tx + Math.cos(a) * 1.2, 6.8, tz + Math.sin(a) * 1.2, 0.3, 3, 0.3, Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
  }
  cols.addCircle(L.w(tx, 0, tz).x, L.w(tx, 0, tz).z, 1.6, 8);
  const crown: ReturnType<typeof lamp>[] = [];
  const ico = new THREE.IcosahedronGeometry(1, 1);
  for (let k = 0; k < 14; k++) {
    const a = k * 2.4, r = 1.5 + (k % 4) * 0.7;
    crown.push(lamp(ico, greens[k % 4] === 0x1f6b3a ? 0x7cf08a : 0xb8ffb0, L, tx + Math.cos(a) * r, 8.4 + (k % 3) * 0.8, tz + Math.sin(a) * r, 1.3, dyn));
  }
  // the three glowing elements around the tree
  const stations: [string, number, number, number][] = [['glow-1', -13.5, 3.5, 0xfff27a], ['glow-2', -5.5, 3.5, 0x7fe8ff], ['glow-3', -9.5, 6.5, 0xb6f08a]];
  const glows = stations.map(([, x, z, c]) => {
    L.put(cyl, toon(0x2f5d3a), x, 0.35, z, 0.6, 0.7, 0.6);
    cols.addCircle(L.w(x, 0, z).x, L.w(x, 0, z).z, 0.7, 1);
    return lamp(new THREE.IcosahedronGeometry(0.55, 2), c, L, x, 1.25, z, 1, dyn);
  });
  const rings = stations.map(([, x, z]) => ringMarker(L, x, z + 1.6, 0xb6f08a, dyn));
  // the protima under a leaf-roofed canopy at the back
  for (let k = 0; k < 5; k++) L.put(leafG, toon(greens[k % 4], { side: THREE.DoubleSide }), -6 + k * 3, 8.5, -11, 3, 4, 3, 1.1, 0, (k - 2) * 0.3);
  idolTableau(L, 0, -12, 1.05, { panel: 0x1f5e3a, chalchitra: 0xb6f08a, style: 'eco' });
  bediRailing(L, cols, -7.5, 11);
  landmarkTower(L, -14, -15, 22, [0xb6f08a, 0x7cf08a, 0xffe8b0], bulbs, 0x2f5d3a);
  const flash = new Map<string, number>();
  return {
    targets: stations.map(([id, x, z]) => ({ id, pos: L.w(x, 0, z + 1.7), radius: 2.3 })),
    lights: [
      { pos: L.w(0, 7, -9), color: 0xb8ffb0, intensity: 16, distance: 22 },
      { pos: L.w(0, 5, -2), color: 0x7cf08a, intensity: 10, distance: 16 },
    ],
    dynamic: dyn,
    update(t, dt, done, complete) {
      stations.forEach(([id], i) => {
        const on = done.includes(id) || complete;
        const f = flash.get(id) ?? 0;
        flash.set(id, Math.max(0, f - dt));
        glows[i].set(on ? 3 + Math.sin(t * 3 + i) * 0.5 + f * 5 : 0.35 + 0.15 * Math.sin(t * 2 + i));
        rings[i].visible = !on;
      });
      const lit = done.length / 3;
      const k = complete ? 1 : lit;
      crown.forEach((c, i) => c.set(0.25 + k * (1.8 + 0.6 * Math.sin(t * 1.5 + i * 0.7))));
    },
    onActivate(id) {
      flash.set(id, 0.6);
    },
    view: { pos: L.w(0, 3, 9), look: L.w(0, 5, -6) },
    gate: L.w(0, 0, R - 3),
    darshan: L.w(0, 0, -6),
  };
}
void sph;
void disc;
