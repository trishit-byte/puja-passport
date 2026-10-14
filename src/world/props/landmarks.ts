/**
 * Civic landmarks that fill the city's open ground: bronze statues of Netaji Subhas Chandra Bose
 * (two), Swami Vivekananda and Rabindranath Tagore on stone pedestals in small railed gardens,
 * garlanded with marigolds as Kolkata's statues are; and an aat-chala Shiva mandir of terracotta
 * brick with its pukur (pond).
 */
import * as THREE from 'three';
import { Character, type Look, type Pose } from '../../player/Character';
import { toon, glow, bend } from '../../rendering/materials';
import { releaseImageAfterUpload } from '../../utils/geometry';
import { unitBox, type Batcher } from '../Batcher';
import type { CollisionWorld } from '../collision';
import type { BulbSystem } from './street';
import type { LandmarkDef } from '../../data/layout';

const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const SPH = new THREE.SphereGeometry(0.5, 14, 10);
const CONE4 = new THREE.ConeGeometry(0.5, 1, 4, 1); // a square pyramid (rotated 45°)

interface Ctx {
  root: THREE.Object3D;
  batch: Batcher;
  colliders: CollisionWorld;
  bulbs: BulbSystem;
}

const PEOPLE: Record<string, { look: Look; pose: Pose; name: { bn: string; hi: string; en: string } }> = {
  'netaji-salute': {
    look: { style: 'shirt', color: 0x6b5a3c, accent: 0x6b5a3c, hair: 'short', glasses: true, skin: 0xb5764f },
    pose: 'salute',
    name: { bn: 'নেতাজি সুভাষচন্দ্র বসু', hi: 'नेताजी सुभाष चंद्र बोस', en: 'NETAJI SUBHAS CHANDRA BOSE' },
  },
  'netaji-point': {
    look: { style: 'shirt', color: 0x6b5a3c, accent: 0x6b5a3c, hair: 'short', glasses: true, skin: 0xb5764f },
    pose: 'point',
    name: { bn: 'নেতাজি সুভাষচন্দ্র বসু', hi: 'नेताजी सुभाष चंद्र बोस', en: 'NETAJI SUBHAS CHANDRA BOSE' },
  },
  vivekananda: {
    look: { style: 'kurta', color: 0x6b5a3c, accent: 0x6b5a3c, hair: 'short', skin: 0xb5764f },
    pose: 'foldarms',
    name: { bn: 'স্বামী বিবেকানন্দ', hi: 'स्वामी विवेकानंद', en: 'SWAMI VIVEKANANDA' },
  },
  tagore: {
    look: { style: 'kurta', color: 0x6b5a3c, accent: 0x6b5a3c, hair: 'grey', skin: 0xb5764f, elderly: true },
    pose: 'holdbook',
    name: { bn: 'রবীন্দ্রনাথ ঠাকুর', hi: 'रवींद्रनाथ ठाकुर', en: 'RABINDRANATH TAGORE' },
  },
};

/** A trilingual bronze-on-stone nameplate. */
function plaque(name: { bn: string; hi: string; en: string }): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3a2e1e';
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#c8a050';
  g.lineWidth = 8;
  g.strokeRect(10, 10, 492, 236);
  g.fillStyle = '#f0d48a';
  g.textAlign = 'center';
  const font = (n: number) => `800 ${n}px "Baloo Da 2", "Baloo 2", "Noto Sans Bengali", sans-serif`;
  let size = 52;
  for (const t of [name.bn, name.hi, name.en]) {
    g.font = font(size);
    while (g.measureText(t).width > 460 && size > 20) g.font = font(--size);
  }
  g.font = font(size);
  g.fillText(name.bn, 256, 84);
  g.fillText(name.hi, 256, 150);
  g.fillText(name.en, 256, 216);
  const tex = new THREE.CanvasTexture(c);
  releaseImageAfterUpload(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.65), bend(new THREE.MeshBasicMaterial({ map: tex })));
  m.frustumCulled = false;
  return m;
}

/** A statue on its pedestal in a railed garden. `yaw` turns it to face the street. */
export function buildStatue(ctx: Ctx, def: LandmarkDef, yaw: number) {
  const who = PEOPLE[def.kind];
  const base = new THREE.Matrix4().makeRotationY(yaw).setPosition(def.x, 0, def.z);
  const box = (m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, shadow = true) => ctx.batch.box(m, x, y, z, w, h, d, 0, base, shadow);
  const put = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
    ctx.batch.addMesh(g, m, new THREE.Vector3(x, y, z).applyMatrix4(base), new THREE.Euler(0, yaw, 0), { x: sx, y: sy, z: sz }, undefined);
  const stone = toon(0xd8cfc0), stone2 = toon(0xc4b9a6), iron = toon(0x2a2a30), grass = toon(0x3f7a3a);
  // the garden: a lawn, flower beds and a low iron railing
  box(grass, 0, 0.05, 0, 6, 0.1, 6, false);
  for (const [x, z] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) for (let k = 0; k < 5; k++) put(SPH, toon(k % 2 ? 0xf6a21e : 0xc81e2a), x + Math.cos(k * 1.3) * 0.35, 0.22, z + Math.sin(k * 1.9) * 0.35, 0.35, 0.3, 0.35);
  for (let k = 0; k <= 12; k++) {
    const u = -3 + k * 0.5;
    for (const [x, z] of [[u, -3], [u, 3], [-3, u], [3, u]]) box(iron, x, 0.45, z, 0.05, 0.9, 0.05, false);
  }
  for (const [x, z, w, d] of [[0, -3, 6, 0.05], [0, 3, 6, 0.05], [-3, 0, 0.05, 6], [3, 0, 0.05, 6]] as const) box(iron, x, 0.88, z, w + 0.05, 0.06, d + 0.05, false);
  ctx.colliders.addBox(def.x, def.z, 6.2, 6.2, yaw, 1);
  for (const [x, z] of [[-3, 3], [3, 3]]) {
    box(iron, x, 1.4, z, 0.1, 2.8, 0.1);
    ctx.bulbs.add(new THREE.Vector3(x, 2.9, z).applyMatrix4(base), 0xffe8b0, 0.14);
  }
  // the pedestal: two steps, a shaft, a cornice
  box(stone2, 0, 0.2, 0, 3.2, 0.4, 3.2);
  box(stone, 0, 0.55, 0, 2.6, 0.3, 2.6);
  box(stone, 0, 1.55, 0, 1.8, 1.7, 1.8);
  box(stone2, 0, 2.5, 0, 2.1, 0.22, 2.1);
  const top = 2.61;
  const pl = plaque(who.name);
  pl.position.copy(new THREE.Vector3(0, 1.55, 0.91).applyMatrix4(base));
  pl.rotation.y = yaw;
  ctx.root.add(pl);
  // the figure: the character rig held in its pose, cast in bronze, about 1.35× life size
  const ch = new Character(who.look, true);
  ch.pose = who.pose;
  for (let i = 0; i < 90; i++) ch.update(1 / 30, 0, 0);
  const bronze = toon(0x6e5a3a, { paint: false });
  const darkBronze = toon(0x4e4030, { paint: false });
  const fit = (o: THREE.Object3D, part: 'head' | 'chest' | 'hips' | 'foreL' | 'foreR') => ch.attachTo(part, o);
  const mesh = (g: THREE.BufferGeometry, x: number, y: number, z: number, sx: number, sy: number, sz: number, m: THREE.Material = bronze) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = true;
    return o;
  };
  if (def.kind.startsWith('netaji')) {
    // the peaked military cap and a cross-belt over the tunic
    fit(mesh(CYL, 0, 0.135, -0.01, 0.25, 0.08, 0.25), 'head');
    fit(mesh(CYL, 0, 0.18, -0.01, 0.27, 0.03, 0.27), 'head');
    const visor = mesh(unitBox, 0, 0.105, 0.115, 0.17, 0.012, 0.08, darkBronze);
    visor.rotation.x = 0.35;
    fit(visor, 'head');
    const belt = mesh(unitBox, 0, 0.25, 0.135, 0.05, 0.62, 0.012, darkBronze);
    belt.rotation.z = 0.62;
    fit(belt, 'chest');
  } else if (def.kind === 'vivekananda') {
    // the turban (pagri): a full, rounded wrap in layers
    fit(mesh(SPH, 0, 0.1, -0.01, 0.31, 0.22, 0.3), 'head');
    for (const [y, r] of [[0.06, 0.15], [0.12, 0.145]] as const) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 8, 24), bronze);
      t.position.set(0, y, -0.01);
      t.rotation.x = Math.PI / 2 + 0.15;
      fit(t, 'head');
    }
    // a shawl over the shoulders
    fit(mesh(SPH, 0, 0.42, -0.02, 0.4, 0.14, 0.3), 'chest');
  } else if (def.kind === 'tagore') {
    // the flowing beard, moustache and long hair; an ankle-length robe; a book held to the chest
    fit(mesh(SPH, 0, -0.17, 0.07, 0.17, 0.36, 0.12), 'head');
    fit(mesh(SPH, 0, -0.06, 0.11, 0.1, 0.04, 0.05), 'head');
    fit(mesh(SPH, 0, -0.05, -0.09, 0.25, 0.26, 0.17), 'head');
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.3, 0.88, 20, 1, true), bronze);
    robe.position.set(0, -0.44, 0);
    robe.scale.set(1, 1, 0.85);
    fit(robe, 'hips');
    fit(mesh(unitBox, 0, -0.3, 0.06, 0.16, 0.22, 0.04, darkBronze), 'foreL');
  }
  // a fresh marigold garland round the neck, hanging down the chest
  const garland = new THREE.Group();
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2;
    const m = new THREE.Mesh(SPH, toon(k % 3 ? 0xf6a21e : 0xf2c14e, { paint: false }));
    m.scale.setScalar(0.06);
    m.position.set(Math.sin(a) * 0.17, 0.05 - (Math.cos(a) * 0.5 + 0.5) * 0.28, Math.cos(a) * 0.13 + 0.03);
    garland.add(m);
  }
  garland.position.set(0, 0.52, 0.02);
  fit(garland, 'chest');
  // everything on the figure is bronze except the garland
  ch.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if ((m as THREE.SkinnedMesh).isSkinnedMesh) m.material = bronze;
    m.frustumCulled = false;
    m.castShadow = true;
  });
  ch.group.scale.setScalar(1.35);
  ch.group.position.set(def.x, top, def.z);
  ch.group.rotation.y = yaw;
  ch.group.updateMatrixWorld(true);
  ctx.root.add(ch.group);
}

/**
 * An aat-chala Shiva mandir of terracotta brick: a raised plinth with steps, the sanctum with three
 * arched entrances and a band of terracotta panels, two tiers of curved chala roofs crowned by a
 * kalash and a trishul; a paved courtyard with a tulsi mancha; and a stepped pukur beside it.
 */
export function buildMandir(ctx: Ctx, def: LandmarkDef, yaw: number) {
  // (the temple courtyard sits a little left of centre, the pukur to its right)
  const base = new THREE.Matrix4().makeRotationY(yaw).setPosition(def.x, 0, def.z).multiply(new THREE.Matrix4().makeTranslation(-3, 0, 0));
  const box = (m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, shadow = true) => ctx.batch.box(m, x, y, z, w, h, d, 0, base, shadow);
  const put = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) =>
    ctx.batch.addMesh(g, m, new THREE.Vector3(x, y, z).applyMatrix4(base), new THREE.Euler(0, yaw + ry, 0), { x: sx, y: sy, z: sz }, undefined);
  const brick = toon(0xb5562f), brickDark = toon(0x8c3f22), terracotta = toon(0xc8703a), pave = toon(0xc9b99a), white = toon(0xf4eedf), gold = toon(0xd4af37);
  // courtyard paving and a low boundary wall with a gateway at the front
  box(pave, 0, 0.04, 0, 12, 0.08, 12, false);
  for (const [x, z, w, d] of [[0, -6, 12, 0.4], [-6, 0, 0.4, 12], [6, 0, 0.4, 12], [-3.8, 6, 4.4, 0.4], [3.8, 6, 4.4, 0.4]] as const) {
    box(brick, x, 0.6, z, w, 1.2, d);
    const c = new THREE.Vector3(x, 0, z).applyMatrix4(base);
    ctx.colliders.addBox(c.x, c.z, w, d, yaw, 1.2);
  }
  // the plinth and its front steps
  box(brickDark, 0, 0.45, -1.5, 6.4, 0.9, 6.4);
  for (let k = 0; k < 3; k++) box(pave, 0, 0.15 + k * 0.3, 2.0 + (2 - k) * 0.35, 2.6, 0.3, 0.7);
  // the sanctum: brick walls, three arched entrances, a terracotta panel band
  box(brick, 0, 2.6, -1.5, 5.2, 3.4, 5.2);
  for (const x of [-1.5, 0, 1.5]) {
    box(toon(0x1a1212), x, 1.9, 1.11, 0.9, 1.6, 0.04, false);
    put(CYL, toon(0x1a1212), x, 2.7, 1.12, 0.9, 0.04, 0.9); // round arch heads
  }
  for (let k = 0; k < 9; k++) box(k % 2 ? terracotta : brickDark, -2.2 + k * 0.55, 3.75, 1.13, 0.5, 0.5, 0.05, false); // terracotta panels
  ctx.colliders.addBox(new THREE.Vector3(0, 0, -1.5).applyMatrix4(base).x, new THREE.Vector3(0, 0, -1.5).applyMatrix4(base).z, 6.4, 6.4, yaw, 4);
  // the lower chala: a broad curved roof, eaves sweeping down at the corners
  put(CONE4, brickDark, 0, 5.15, -1.5, 8.4, 1.9, 8.4, Math.PI / 4);
  box(terracotta, 0, 4.3, -1.5, 5.9, 0.18, 5.9, false);
  // the upper chala: a smaller sanctum storey and roof, then the kalash and trishul
  box(brick, 0, 6.4, -1.5, 3.0, 1.4, 3.0);
  put(CONE4, brickDark, 0, 7.75, -1.5, 4.8, 1.5, 4.8, Math.PI / 4);
  put(SPH, gold, 0, 8.65, -1.5, 0.45, 0.55, 0.45);
  put(CYL, gold, 0, 9.4, -1.5, 0.05, 1.2, 0.05);
  box(gold, 0, 9.95, -1.5, 0.5, 0.05, 0.05, false);
  for (const x of [-0.25, 0, 0.25]) box(gold, x, 10.05, -1.5, 0.05, x === 0 ? 0.32 : 0.22, 0.05, false);
  // a lamp at the sanctum door, and a tulsi mancha in the courtyard
  ctx.bulbs.add(new THREE.Vector3(0, 1.3, 1.3).applyMatrix4(base), 0xffb33c, 0.12);
  box(white, -4.2, 0.6, 3.5, 1.0, 1.2, 1.0);
  put(SPH, toon(0x3f7a3a), -4.2, 1.5, 3.5, 0.8, 0.7, 0.8);
  // the pukur beside the courtyard: a stone tank with a raised kerb, ghat steps down to still water
  const px = 10, pz = 0, pw = 5.6, pd = 6.4;
  for (const [x, z, w, d] of [[px, pz - pd / 2, pw + 0.5, 0.35], [px, pz + pd / 2, pw + 0.5, 0.35], [px - pw / 2, pz, 0.35, pd], [px + pw / 2, pz, 0.35, pd]] as const) box(brickDark, x, 0.3, z, w, 0.6, d);
  for (let k = 0; k < 3; k++) box(pave, px, 0.5 - k * 0.15, pz - pd / 2 + 0.55 + k * 0.5, pw - 0.4, 0.15, 0.5, false); // the ghat steps
  const water = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.3, pd - 0.3).rotateX(-Math.PI / 2), bend(new THREE.MeshBasicMaterial({ color: 0x23465a })));
  water.position.copy(new THREE.Vector3(px, 0.14, pz).applyMatrix4(base));
  water.rotation.y = yaw;
  water.frustumCulled = false;
  ctx.root.add(water);
  for (let k = 0; k < 5; k++) put(SPH, toon(k % 2 ? 0x3f8a4a : 0xf4c6d8), px - 1.5 + k * 0.7, 0.16, pz + 1.2 - (k % 3) * 0.8, 0.5, 0.06, 0.5); // lily pads and a lotus
  const pc = new THREE.Vector3(px, 0, pz).applyMatrix4(base);
  ctx.colliders.addBox(pc.x, pc.z, pw + 0.5, pd + 0.4, yaw, 0.6);
  void glow;
}
