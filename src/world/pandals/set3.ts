/**
 * Pandals 9–10: Nakshatralok, the realm of stars (Bengali star-lore under a moonlit dome), and
 * Debaloy, the abode of the divine (a temple pandal).
 */
import * as THREE from 'three';
import { toon, glow, bend } from '../../rendering/materials';
import { idolTableau, gate, bediRailing, enclosure, landmarkTower, cyl, sph, cone, torus, type PandalBuild, type Local } from './common';
import { lamp } from './set1';
import { RIVER_PANDAL } from '../../data/layout';
import type { BuildCtx } from './index';

function ringMarker(L: Local, x: number, z: number, color: number, parent: THREE.Object3D) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 40).rotateX(-Math.PI / 2), bend(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), transparent: true, opacity: 0.7, depthWrite: false })));
  m.position.copy(L.w(x, 0.1, z));
  m.frustumCulled = false;
  parent.add(m);
  return m;
}

// --------------------------------------------------------------------------- Nakshatralok
/**
 * A midnight-blue hall under a starry canopy, a crescent moon and planets overhead, and three
 * constellation boards of Bengali star-lore to light: the Saptarshi (seven sages, the Great
 * Bear), the Kalpurush (the hunter, Orion) and the Dhruvatara (the pole star, with the Little
 * Bear). The protima is in the night-sky style: indigo and silver.
 */
export function buildNakshatralok(ctx: BuildCtx): PandalBuild {
  const { L, cols, bulbs, def } = ctx;
  const dyn = new THREE.Group();
  L.dyn = dyn;
  const R = 14;
  const navy = toon(0x141a3a), deep = toon(0x0d1430), silver = toon(0xc8d4ee);
  enclosure(L, cols, R, 7, navy, 3.2);
  gate(L, R + 0.2, 7, 6.5, { frame: 0x1b2a5a, cloth: 0x0d1430, accent: 0xc0d8ff }, { bn: def.bn, en: def.name }, bulbs, dyn);
  // star lights along the wall tops
  for (let i = 0; i < 40; i++) {
    const u = i / 40;
    for (const sx of [-1, 1]) bulbs.add(L.w(sx * R, 3.4 + (i % 3) * 0.15, R - u * 2 * R), i % 4 ? 0xdfe8ff : 0x9fc0ff, 0.07, i % 2);
  }
  // the starry canopy over the hall: four slim poles, a midnight-blue ceiling hung with stars
  for (const sx of [-11, 11]) for (const sz of [-12, 6]) L.put(cyl, silver, sx, 4.6, sz, 0.3, 9.2, 0.3);
  L.box(deep, 0, 9.3, -3, 23, 0.3, 19);
  for (let i = 0; i < 140; i++) {
    const x = ((i * 37) % 210) / 10 - 10.5, z = ((i * 53) % 170) / 10 - 11.5;
    bulbs.add(L.w(x, 9.05 - ((i * 7) % 5) * 0.12, z), i % 5 ? 0xe8efff : 0xaac8ff, 0.05 + (i % 3) * 0.02, i % 2);
  }
  // a great crescent moon above the protima and three planets along the hall
  const moon = lamp(new THREE.TorusGeometry(1.6, 0.42, 10, 40, Math.PI * 1.25), 0xfff2c8, L, 4.5, 7.6, -11.2, 1, dyn, new THREE.Euler(0, 0, -0.9));
  const planets: { m: ReturnType<typeof lamp> }[] = [];
  for (const [x, y, z, r, c] of [[-6, 7.2, 1, 0.9, 0xd9a65a], [6.5, 6.8, -2, 0.6, 0xc8553a], [-2.5, 7.8, 5, 0.7, 0x5a8ad8]] as const) {
    planets.push({ m: lamp(new THREE.SphereGeometry(1, 20, 14), c, L, x, y, z, r, dyn) });
    L.put(cyl, silver, x, (y + r + 9.15) / 2, z, 0.02, 9.15 - y - r, 0.02, 0, 0, 0, false); // hanging wire
  }
  L.put(torus, silver, -6, 7.2, 1, 3.2, 3.2, 3.2, 1.25, 0, 0.3, false); // Saturn-like ring round the first
  // the protima before a midnight-blue frame scattered with silver stars
  L.box(deep, 0, 4.4, -13.3, 10, 8.4, 0.4);
  for (let i = 0; i < 26; i++) bulbs.add(L.w(-4.6 + ((i * 31) % 92) / 10, 1.2 + ((i * 17) % 70) / 10, -13.05), 0xe8efff, 0.06, i % 2);
  idolTableau(L, 0, -11, 1.0, { panel: 0x101a3a, chalchitra: 0xc0d8ff, style: 'akash' });
  bediRailing(L, cols, -6.6, 11);
  // the three constellation boards, angled toward the path
  const constellations: [string, number, number, number, [number, number][], [number, number][]][] = [
    // Saptarshi: the seven sages — the bowl and handle of the Great Bear
    ['star-saptarshi', -8.5, 2.5, Math.PI / 2 - 0.3, [[-1.1, 0.5], [-0.5, 0.65], [0.0, 0.5], [0.45, 0.2], [0.55, -0.4], [1.2, -0.3], [1.15, 0.3]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]],
    // Kalpurush: the hunter — shoulders, the three-star belt and the feet
    ['star-kalpurush', 8.5, 2.5, -Math.PI / 2 + 0.3, [[-0.7, 0.75], [0.7, 0.8], [-0.25, 0.0], [0.0, -0.05], [0.25, -0.1], [-0.6, -0.8], [0.75, -0.75]], [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]]],
    // Dhruvatara: the pole star at the tip of the Little Bear
    ['star-dhruva', 8.5, -4, -Math.PI / 2 + 0.5, [[-1.0, 0.7], [-0.45, 0.45], [0.0, 0.3], [0.45, 0.1], [0.5, -0.4], [1.05, -0.45], [1.0, 0.05]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]],
  ];
  const boards = constellations.map(([id, x, z, ry, stars, links]) => {
    const base = new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z);
    const at = (lx: number, ly: number, lz = 0) => new THREE.Vector3(lx, ly, lz).applyMatrix4(base);
    const c = at(0, 2.2);
    L.box(deep, c.x, 2.2, c.z, 3.2, 2.4, 0.12, ry); // the board, its face toward local +z
    L.box(silver, c.x, 0.5, c.z, 0.3, 1.0, 0.3, ry);
    for (const sx of [-1.65, 1.65]) {
      const q = at(sx, 0);
      L.put(cyl, silver, q.x, 1.7, q.z, 0.1, 3.4, 0.1);
    }
    cols.addBox(L.w(c.x, 0, c.z).x, L.w(c.x, 0, c.z).z, 3.4, 0.6, def.facing + ry, 3);
    const pts = stars.map(([sx, sy]) => at(sx * 1.3, 2.2 + sy * 1.3, 0.12));
    const lamps = pts.map((q, i) => lamp(new THREE.IcosahedronGeometry(i === 0 && id === 'star-dhruva' ? 0.17 : 0.1, 1), 0xf0f6ff, L, q.x, q.y, q.z, 1, dyn));
    const lines = links.map(([a, b]) => {
      const pa = pts[a], pb = pts[b], mid = pa.clone().add(pb).multiplyScalar(0.5), len = pa.distanceTo(pb);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), pb.clone().sub(pa).normalize());
      return lamp(new THREE.BoxGeometry(0.025, 0.025, len), 0x8fb4ff, L, mid.x, mid.y, mid.z, 1, dyn, new THREE.Euler().setFromQuaternion(q));
    });
    const fx = x + Math.sin(ry) * 1.8, fz = z + Math.cos(ry) * 1.8;
    return { id, lamps, lines, ring: ringMarker(L, fx, fz, 0xc0d8ff, dyn), front: [fx, fz] as const };
  });
  landmarkTower(L, 12, -12, 20, [0xc0d8ff, 0x7fa8ff, 0xffffff], bulbs, 0x1b2a5a);
  const flash = new Map<string, number>();
  return {
    targets: boards.map((b) => ({ id: b.id, pos: L.w(b.front[0], 0, b.front[1]), radius: 2.2 })),
    lights: [
      { pos: L.w(0, 7, -9), color: 0xbfd4ff, intensity: 16, distance: 22 },
      { pos: L.w(0, 5, 2), color: 0x9fc0ff, intensity: 9, distance: 16 },
    ],
    dynamic: dyn,
    update(t, dt, done, complete) {
      boards.forEach((b, i) => {
        const on = done.includes(b.id) || complete;
        const f = flash.get(b.id) ?? 0;
        flash.set(b.id, Math.max(0, f - dt));
        b.lamps.forEach((l, k) => l.set(on ? 3 + Math.sin(t * 4 + k * 1.3) * 0.6 + f * 4 : 0.5 + 0.2 * Math.sin(t * 2 + k + i)));
        b.lines.forEach((l) => l.set(on ? 1.6 + f * 3 : 0.15));
        b.ring.visible = !on;
      });
      const k = complete ? 1 : done.length / 3;
      moon.set(1.2 + k * 1.6 + Math.sin(t * 0.8) * 0.1);
      planets.forEach((p, i) => p.m.set(0.8 + k * 1.4 + Math.sin(t + i) * 0.1));
    },
    onActivate(id) {
      flash.set(id, 0.8);
    },
    view: { pos: L.w(0, 3, 8), look: L.w(0, 4, -8) },
    gate: L.w(0, 0, R - 3),
    darshan: L.w(0, 0, -3),
  };
}

// --------------------------------------------------------------------------- Debaloy
/**
 * Debaloy, the abode of the divine: a temple pandal. An imposing ceremonial entrance (a stepped
 * gateway tower flanked by caparisoned stone elephants), a pillared nat-mandir over the visitors,
 * and at the back the sanctum on a stepped plinth under a tall curvilinear rekha shikhara with
 * its amalaka and kalash. A deepastambha (lamp tower) stands in the courtyard. The visitor's
 * ritual, in order: blow the shankha at the gate, light the lamp tower, offer flowers at the bedi.
 * The protima is larger than elsewhere, in rich red and heavy gold.
 */
export function buildDebaloy(ctx: BuildCtx): PandalBuild {
  const { L, cols, bulbs, def } = ctx;
  const dyn = new THREE.Group();
  L.dyn = dyn;
  const R = 14;
  const stone = toon(0xc9a37a), stoneDark = toon(0x9a7a56), carve = toon(0xe3c68c), gold = toon(0xd4af37), red = toon(0xb3121f);
  enclosure(L, cols, R, 7, stone, 3.4);
  gate(L, R + 0.2, 7, 6.5, { frame: 0x8a6a4a, cloth: 0xb3121f, accent: 0xd4af37 }, { bn: def.bn, en: def.name }, bulbs, dyn);
  // ---- the ceremonial entrance: tall carved pillars and a stepped gateway tower above the gate
  for (const sx of [-1, 1]) {
    L.box(stoneDark, sx * 4.9, 5.2, R + 0.2, 1.2, 10.4, 1.2);
    for (let k = 0; k < 6; k++) L.box(carve, sx * 4.9, 1.2 + k * 1.7, R + 0.2, 1.36, 0.22, 1.36, 0, false); // carved bands
    L.put(sph, gold, sx * 4.9, 10.8, R + 0.2, 0.9, 0.9, 0.9); // kalash on each pillar
    cols.addCircle(L.w(sx * 4.9, 0, R + 0.2).x, L.w(sx * 4.9, 0, R + 0.2).z, 0.8, 8);
  }
  const tiers = [[10.8, 8.4], [8.6, 9.7], [6.6, 10.9], [4.6, 12.0], [2.8, 13.0]];
  for (const [w, y] of tiers) {
    L.box(stone, 0, y, R + 0.2, w, 1.2, 1.6);
    L.box(carve, 0, y + 0.66, R + 0.2, w + 0.3, 0.14, 1.8, 0, false);
    for (let k = 0; k < Math.floor(w / 1.2); k++) L.put(sph, red, -w / 2 + 0.6 + k * 1.2, y, R + 1.02, 0.28, 0.5, 0.08, 0, 0, 0, false); // niches
  }
  L.put(sph, gold, 0, 14.0, R + 0.2, 1.1, 0.9, 1.1);
  L.put(cone, gold, 0, 14.9, R + 0.2, 0.5, 1.0, 0.5);
  for (let i = 0; i < 26; i++) bulbs.add(L.w(-5.4 + (i / 25) * 10.8, 9.1, R + 1.05), i % 2 ? 0xffe8b0 : 0xffc93c, 0.09, i % 2);
  // a pair of caparisoned stone elephants guarding the entrance, outside the gate
  for (const sx of [-1, 1]) {
    const ex = sx * 7.6, ez = R + 3.2;
    L.put(sph, stone, ex, 1.9, ez, 1.6, 1.7, 2.6); // body
    L.put(sph, stone, ex, 2.8, ez + 1.3, 1.3, 1.3, 1.2); // head
    for (const lz of [-0.8, 0.8]) for (const lx of [-0.5, 0.5]) L.put(cyl, stone, ex + lx, 0.7, ez + lz, 0.5, 1.4, 0.5); // legs
    L.put(cyl, stone, ex, 1.9, ez + 2.2, 0.32, 1.9, 0.32, 0.25, 0, 0); // trunk
    for (const tx of [-0.3, 0.3]) L.put(cone, toon(0xf4eedf), ex + tx, 2.3, ez + 1.95, 0.12, 0.9, 0.12, Math.PI / 2 + 0.3, 0, 0, false); // tusks
    for (const ax of [-0.75, 0.75]) L.put(sph, stone, ex + ax, 2.9, ez + 1.1, 0.12, 1.0, 0.8, 0, 0, 0, false); // ears
    L.box(red, ex, 2.75, ez - 0.1, 1.75, 0.9, 1.8); // saddle cloth
    L.box(gold, ex, 2.3, ez - 0.1, 1.8, 0.1, 1.85, 0, false); // its gold border
    L.box(stoneDark, ex, 0.25, ez + 0.2, 2.4, 0.5, 4.2); // plinth
    cols.addBox(L.w(ex, 0, ez + 0.2).x, L.w(ex, 0, ez + 0.2).z, 2.4, 4.2, def.facing, 3);
  }
  // ---- the nat-mandir: two rows of carved pillars under a flat roof with a cornice
  for (const sx of [-5.6, 5.6])
    for (const z of [6.5, 2.5, -1.5]) {
      L.put(cyl, stone, sx, 3.0, z, 0.7, 6.0, 0.7);
      L.box(carve, sx, 0.3, z, 1.1, 0.6, 1.1);
      L.box(carve, sx, 5.85, z, 1.2, 0.3, 1.2);
      for (let k = 1; k < 4; k++) L.put(torus, carve, sx, k * 1.4, z, 0.75, 0.75, 0.75, Math.PI / 2, 0, 0, false);
      cols.addCircle(L.w(sx, 0, z).x, L.w(sx, 0, z).z, 0.45, 6);
    }
  L.box(stone, 0, 6.25, 2.5, 12.6, 0.5, 11);
  L.box(carve, 0, 6.6, 2.5, 13.2, 0.2, 11.6, 0, false);
  for (let i = 0; i < 18; i++) bulbs.add(L.w(-6.4 + (i / 17) * 12.8, 6.1, 8.05), 0xffe8b0, 0.08, i % 2);
  // ---- the sanctum: a stepped plinth, side walls and the rekha shikhara rising above the protima
  for (let k = 0; k < 3; k++) L.box(stoneDark, 0, 0.15 + k * 0.3, -11.5 + k * 0.4, 11 - k * 0.6, 0.3, 5 - k * 0.8);
  for (const sx of [-1, 1]) L.box(stone, sx * 5.2, 4.2, -11.6, 0.8, 8.4, 4.4);
  L.box(stone, 0, 8.7, -11.6, 11.2, 0.8, 4.4);
  L.box(carve, 0, 8.25, -9.35, 11.2, 0.3, 0.2, 0, false);
  for (let k = 0; k < 10; k++) {
    const t = k / 9, w = 9.4 - t * 6.4, d = 4 - t * 2.4;
    L.box(k % 2 ? stone : carve, 0, 9.4 + k * 1.05, -11.6, w, 1.05, d); // curving shikhara courses
  }
  L.put(sph, carve, 0, 20.3, -11.6, 3.6, 0.9, 2.4); // amalaka
  L.put(sph, gold, 0, 21.2, -11.6, 0.9, 1.1, 0.9); // kalash
  L.put(cyl, stoneDark, 0, 22.6, -11.6, 0.06, 2.2, 0.06, 0, 0, 0, false);
  L.box(red, 0.45, 23.3, -11.6, 0.9, 0.55, 0.03, 0, false); // the temple flag
  idolTableau(L, 0, -11.2, 1.18, { y0: 0.75, panel: 0x7a1414, chalchitra: 0xd4af37, style: 'regal' });
  bediRailing(L, cols, -6.9, 10.4);
  // ---- the three stations of the ritual
  // the shankha on a carved stand just inside the gate
  L.box(carve, -4.2, 0.55, 10.5, 0.8, 1.1, 0.8);
  L.put(cone, toon(0xfaf6ea), -4.2, 1.3, 10.5, 0.22, 0.6, 0.22, 0, 0, Math.PI / 2);
  L.put(sph, toon(0xfaf6ea), -4.0, 1.3, 10.5, 0.25, 0.22, 0.22);
  cols.addCircle(L.w(-4.2, 0, 10.5).x, L.w(-4.2, 0, 10.5).z, 0.5, 1.2);
  // the deepastambha: a tall stone lamp tower ringed with little lamps
  const dx = 8.8, dz = 1.5;
  L.put(cyl, stoneDark, dx, 2.4, dz, 0.6, 4.8, 0.6);
  L.box(stoneDark, dx, 0.3, dz, 1.6, 0.6, 1.6);
  const flames: ReturnType<typeof lamp>[] = [];
  for (let k = 0; k < 6; k++) {
    const y = 1.2 + k * 0.7, r = 0.75 - k * 0.06;
    L.put(torus, carve, dx, y, dz, r * 2, r * 2, r * 2, Math.PI / 2, 0, 0, false);
    for (let q = 0; q < 8; q++) {
      const a = (q / 8) * Math.PI * 2 + k * 0.4;
      flames.push(lamp(new THREE.SphereGeometry(0.07, 6, 5), 0xffb33c, L, dx + Math.cos(a) * r, y + 0.12, dz + Math.sin(a) * r, 1, dyn));
    }
  }
  cols.addCircle(L.w(dx, 0, dz).x, L.w(dx, 0, dz).z, 0.9, 5);
  // a brass plate of marigolds and jaba flowers before the bedi, for the anjali
  // (set at the bedi's side, clear of the dhunuchi dancers before the protima)
  const fx = 5.4, fz = -5.9;
  L.box(carve, fx, 0.45, fz, 0.7, 0.9, 0.7);
  L.put(cyl, gold, fx, 0.93, fz, 0.6, 0.04, 0.6);
  for (let q = 0; q < 9; q++) L.put(sph, toon(q % 3 ? 0xf6a21e : 0xc81e2a), fx + Math.cos(q) * 0.18, 1.0, fz + Math.sin(q * 1.7) * 0.18, 0.12, 0.08, 0.12, 0, 0, 0, false);
  cols.addCircle(L.w(fx, 0, fz).x, L.w(fx, 0, fz).z, 0.45, 1);
  const stations: [string, number, number][] = [['shankha', -4.2, 8.9], ['deepastambha', 7.1, 2.2], ['pushpanjali', fx, fz + 1.5]];
  const rings = stations.map(([, x, z]) => ringMarker(L, x, z, 0xd4af37, dyn));
  landmarkTower(L, 12, -12, 20, [0xffd89a, 0xb3121f, 0xffe8b0], bulbs, 0x8a6a4a);
  const flash = new Map<string, number>();
  return {
    targets: stations.map(([id, x, z]) => ({ id, pos: L.w(x, 0, z), radius: 2.2 })),
    lights: [
      { pos: L.w(0, 7, -9), color: 0xffd89a, intensity: 18, distance: 24 },
      { pos: L.w(0, 5, 3), color: 0xffc27a, intensity: 9, distance: 16 },
    ],
    dynamic: dyn,
    update(t, dt, done, complete) {
      stations.forEach(([id], i) => {
        flash.set(id, Math.max(0, (flash.get(id) ?? 0) - dt));
        rings[i].visible = !(done.includes(id) || complete);
      });
      const lit = done.includes('deepastambha') || complete;
      flames.forEach((f, k) => f.set(lit ? 2.6 + Math.sin(t * 9 + k * 1.7) * 0.5 : 0.08));
    },
    onActivate(id) {
      flash.set(id, 0.8);
    },
    view: { pos: L.w(0, 3, 8), look: L.w(0, 4, -8) },
    gate: L.w(0, 0, R - 3),
    darshan: L.w(0, 0, -3.2),
  };
}
// --------------------------------------------------------------------------- Nodir Opare
/**
 * Nodir Opare, across the river: the pandal stands out on the water on a plank deck carried by a
 * grid of wooden piles driven into the riverbed, braced with beams, its edge railed and strung
 * with lights. A railed footbridge on piers runs out to it from the sixth ghat step (deck level,
 * about 0.9 m above the water), under a marigold toran. Two country boats are moored alongside,
 * and beyond the far rail a ring of floating diyas drifts in the mist; you float your own lamp
 * there from the rail. Inside, an open riverside pavilion with a boat-shaped canopy.
 * Local frame: deck top at y = 0, +z toward the bridge and the ghat.
 */
export function buildNodirOpare(ctx: BuildCtx): PandalBuild {
  const { L, cols, bulbs, def } = ctx;
  const dyn = new THREE.Group();
  L.dyn = dyn;
  const P = RIVER_PANDAL.platform.hw; // half-size of the deck
  const water = -2.42 - RIVER_PANDAL.deckY; // the river surface, in deck-local height
  const bed = water - 2.4; // the riverbed the piles stand on
  const plank = toon(0x8a5a34), plank2 = toon(0x7a4c2a), pile = toon(0x4a3020), rail = toon(0x6b4a2f), teal = toon(0x103b45), cream = toon(0xefe3c2);
  // ---- the deck: planked in 4 m tiles (short pieces follow the planet's curve without sagging)
  for (let x = -P; x < P - 0.01; x += 4.25)
    for (let z = -P; z < P - 0.01; z += 4.25) L.box((Math.round((x + z) / 4.25) & 1) ? plank : plank2, x + 2.125, -0.15, z + 2.125, 4.27, 0.3, 4.27);
  // ---- the piles, driven into the riverbed, with beams under the deck between them
  for (let x = -P; x <= P + 0.01; x += 4.25)
    for (let z = -P; z <= P + 0.01; z += 4.25) L.put(cyl, pile, x, (bed - 0.3) / 2, z, 0.44, -bed - 0.3, 0.44);
  for (let z = -P; z <= P + 0.01; z += 4.25) for (let x = -P; x < P - 0.01; x += 4.25) L.box(pile, x + 2.125, -0.42, z, 4.25, 0.24, 0.3, 0, false);
  // ---- railing round the deck edge (open toward the bridge), bulbs along its top
  const railRun = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 2));
    const ry = Math.atan2(bx - ax, bz - az);
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
      L.box(rail, x, 0.5, z, 0.12, 1.0, 0.12, 0, false);
      if (k < n) {
        const mx = x + (bx - ax) / n / 2, mz = z + (bz - az) / n / 2;
        L.box(rail, mx, 0.98, mz, 0.08, 0.08, len / n, ry, false);
        L.box(rail, mx, 0.55, mz, 0.05, 0.05, len / n, ry, false);
      }
      if (k % 2 === 0) bulbs.add(L.w(x, 1.12, z), k % 4 ? 0xffd38a : 0xffe8b0, 0.08, k % 2);
    }
    const c = L.w((ax + bx) / 2, 0, (az + bz) / 2);
    cols.addBox(c.x, c.z, 0.5, len + 0.2, def.facing + ry, 1.2); // thin across, long along the run
  };
  railRun(-P, P, -RIVER_PANDAL.bridge.hw - 0.1, P);
  railRun(RIVER_PANDAL.bridge.hw + 0.1, P, P, P);
  railRun(-P, -P, P, -P);
  railRun(-P, -P, -P, P);
  railRun(P, -P, P, P);
  // ---- the footbridge to the ghat: planks on piers, railed, lanterns on its posts, a marigold toran
  const bLen = RIVER_PANDAL.bridge.z1 - RIVER_PANDAL.bridge.z0, bw = RIVER_PANDAL.bridge.hw;
  const bz0 = P, bz1 = P + bLen; // deck-local z where the bridge leaves the platform and reaches the ghat
  for (let z = bz0; z < bz1 - 0.01; z += 2) L.box(z % 4 < 2 ? plank : plank2, 0, -0.12, z + 1, bw * 2, 0.24, 2.02);
  for (let z = bz0 + 3; z < bz1 - 1; z += 3) for (const sx of [-1, 1]) L.put(cyl, pile, sx * (bw - 0.2), (bed - 0.25) / 2, z, 0.3, -bed - 0.25, 0.3);
  for (let z = bz0 + 3; z < bz1 - 1; z += 3) L.box(pile, 0, -0.34, z, bw * 2, 0.2, 0.3, 0, false); // cross-beams
  // the railings stop where the bridge meets the ghat step it is level with
  const stepEdge = bz1 - 1.3;
  for (const sx of [-1, 1]) railRun(sx * (bw + 0.05), bz0, sx * (bw + 0.05), stepEdge);
  for (const sx of [-1, 1]) {
    L.put(cyl, toon(0xb08a4a), sx * (bw + 0.3), 2.0, bz1 - 0.6, 0.18, 4.0, 0.18); // toran posts
    cols.addCircle(L.w(sx * (bw + 0.3), 0, bz1 - 0.6).x, L.w(sx * (bw + 0.3), 0, bz1 - 0.6).z, 0.25, 4);
  }
  L.box(toon(0xb08a4a), 0, 4.0, bz1 - 0.6, bw * 2 + 1.0, 0.18, 0.18);
  for (let k = 0; k < 13; k++) {
    const u = k / 12;
    L.put(sph, toon(k % 2 ? 0xf6a21e : 0xf2c14e), -bw - 0.4 + u * (bw * 2 + 0.8), 3.7 - Math.sin(u * Math.PI) * 0.45, bz1 - 0.6, 0.22, 0.22, 0.22, 0, 0, 0, false);
    bulbs.add(L.w(-bw - 0.4 + u * (bw * 2 + 0.8), 4.15, bz1 - 0.6), k % 2 ? 0xffd38a : 0xffe8b0, 0.08, k % 2);
  }
  // ---- two country boats moored alongside, roped to the piles
  const hull = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  for (const [bx, bzz, ry] of [[-P - 2.2, -4, 0], [P + 2.2, 5, 0.1]] as const) {
    L.put(hull, toon(0x6b3a22, { side: THREE.DoubleSide }), bx, water + 0.55, bzz, 1.0, 0.75, 3.6, 0, ry, 0);
    L.box(toon(0x8a5a2b), bx, water + 0.6, bzz, 1.5, 0.08, 4.5, ry);
    L.put(hull, toon(0x2a4a3a, { side: THREE.DoubleSide }), bx, water + 1.3, bzz + 0.6, 0.9, -0.7, 1.4, 0, ry, 0); // the woven chhoi shelter
    L.put(cyl, toon(0xc8b090), (bx + Math.sign(bx) * -P) / 2 + Math.sign(bx) * 0.2, -0.3, bzz, 0.03, Math.abs(bx) - P + 0.2, 0.03, 0, 0, Math.PI / 2, false); // mooring rope
  }
  // ---- the pandal on the deck: an open riverside pavilion with a boat-shaped canopy
  const R = 13;
  enclosure(L, cols, R, 8, teal, 2.8, false);
  gate(L, R + 0.2, 8, 6, { frame: 0x103b45, cloth: 0xf6a21e, accent: 0xffe8b0 }, { bn: def.bn, en: def.name }, bulbs, dyn);
  for (const x of [-8, -2.7, 2.7, 8]) for (const z of [-11, -2.5]) L.put(cyl, rail, x, 3.4, z, 0.3, 6.8, 0.3);
  L.put(hull, toon(0x8a5a2b, { side: THREE.DoubleSide }), 0, 9.2, -6.8, 9.6, -2.4, 5.8);
  for (let i = 0; i < 34; i++) {
    const u = i / 33;
    bulbs.add(L.w(-8.6 + u * 17.2, 6.8 - Math.sin(u * Math.PI) * 0.7, -2.2), i % 2 ? 0xffd38a : 0xffe8b0, 0.11, i % 2);
  }
  for (let k = 0; k < 10; k++) L.put(sph, glow(k % 2 ? 0xffd38a : 0xf6a21e, 2.4), -8 + (k % 5) * 4, 6.0, -10.5 + Math.floor(k / 5) * 6.5, 0.38, 0.52, 0.38, 0, 0, 0, false);
  idolTableau(L, 0, -9, 1.0, { panel: 0x103b45, chalchitra: 0xf6a21e, style: 'pastel' });
  bediRailing(L, cols, -4.4, 10);
  // the volunteer's lamp table just inside the gate
  L.box(cream, -5, 0.5, 8.5, 2.4, 1.0, 1.0);
  for (let k = 0; k < 6; k++) L.put(cyl, toon(0xb5562f), -5.9 + k * 0.36, 1.06, 8.5, 0.11, 0.1, 0.11, 0, 0, 0, false);
  cols.addBox(L.w(-5, 0, 8.5).x, L.w(-5, 0, 8.5).z, 2.4, 1.0, def.facing, 1);
  // the walkway round the pandal leads to the far rail over the open river, where lamps are
  // floated: a little shelf on the rail there
  L.box(cream, 0, 0.9, -P + 0.35, 2.2, 0.08, 0.5, 0, false);
  // ---- the floating-light installation on the water beyond the far rail
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.12, 6, 40).rotateX(Math.PI / 2), toon(0x8a5a2b, { paint: false }));
  ring.position.copy(L.w(0, water + 0.05, -P - 3.6));
  ring.frustumCulled = false;
  dyn.add(ring);
  const diyaG = new THREE.SphereGeometry(0.16, 10, 6);
  const floating = Array.from({ length: 24 }, (_, k) => {
    const a = (k / 24) * Math.PI * 2;
    return lamp(diyaG, 0xffb33c, L, Math.cos(a) * 2.4, water + 0.15, -P - 3.6 + Math.sin(a) * 2.4, 1, dyn);
  });
  const yours = lamp(new THREE.SphereGeometry(0.22, 12, 8), 0xffe8b0, L, 0, water + 0.18, -P - 1.6, 1, dyn);
  yours.mesh.visible = false;
  // mist over the water: a soft-edged sheet (a radial fade, so it never shows a hard outline)
  const mc = document.createElement('canvas');
  mc.width = mc.height = 64;
  const mg = mc.getContext('2d')!;
  const grad = mg.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  mg.fillStyle = grad;
  mg.fillRect(0, 0, 64, 64);
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(30, 16).rotateX(-Math.PI / 2), bend(new THREE.MeshBasicMaterial({ color: 0xc8c8e8, map: new THREE.CanvasTexture(mc), transparent: true, opacity: 0.12, depthWrite: false })));
  mist.position.copy(L.w(0, water + 0.7, -P - 6));
  mist.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(L.base));
  mist.frustumCulled = false;
  dyn.add(mist);
  const markGate = ringMarker(L, -5, 10.1, 0xffd38a, dyn);
  const markRiver = ringMarker(L, 0, -P + 1.4, 0xffd38a, dyn);
  landmarkTower(L, -10.5, -10.5, 20, [0xf6a21e, 0xffe8b0, 0xffd38a], bulbs, 0x103b45);
  return {
    targets: [
      { id: 'lamp-take', pos: L.w(-5, 0, 10), radius: 2.2 },
      { id: 'lamp-place', pos: L.w(0, 0, -P + 1.4), radius: 2.4 },
    ],
    lights: [
      { pos: L.w(0, 6, -6), color: 0xffd38a, intensity: 16, distance: 22 },
      { pos: L.w(0, 1.5, -P - 2), color: 0xffb33c, intensity: 8, distance: 14 },
    ],
    dynamic: dyn,
    update(t, _dt, done, complete) {
      floating.forEach((f, i) => {
        f.set(2.4 + Math.sin(t * 2 + i) * 0.6);
        f.mesh.position.y = L.w(0, water + 0.15, 0).y + Math.sin(t * 1.2 + i) * 0.04;
      });
      const placed = complete || done.includes('lamp-place');
      yours.mesh.visible = placed;
      yours.set(3.5 + Math.sin(t * 2) * 0.5);
      const holding = done.includes('lamp-take') && !placed;
      markGate.visible = !done.includes('lamp-take') && !complete;
      markRiver.visible = holding;
      (mist.material as THREE.MeshBasicMaterial).opacity = 0.1 + 0.04 * Math.sin(t * 0.3);
    },
    onActivate() {},
    view: { pos: L.w(0, 3, 7), look: L.w(0, 3.5, -9) },
    gate: L.w(0, 0, R - 3),
    darshan: L.w(0, 0, -1),
  };
}
void glow;
