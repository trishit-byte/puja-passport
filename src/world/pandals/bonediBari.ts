/** Pandal 1 — Bonedi Bari Puja: heritage household worship in a thakur dalan. */
import * as THREE from 'three';
import { releaseImageAfterUpload } from '../../utils/geometry';
import { toon, glow, bend } from '../../rendering/materials';
import { scallopRim, baluster, louvreLeaf, urn, fanlight, archRim } from '../props/kit';
import { idolTableau, gate, entrySign, bediRailing, wall, alponaMesh, cyl, sph, type PandalBuild } from './common';
import type { BuildCtx } from './index';

export function buildBonediBari(ctx: BuildCtx): PandalBuild {
  const { L, cols, bulbs, def } = ctx;
  const dyn = new THREE.Group();
  const sand = toon(0xe3c68c), ivory = toon(0xf4eedf), terracotta = toon(0xb5562f), green = toon(0x3f6b4e);
  const H = 16;

  // courtyard floor: chequered marble
  const floor = checkerFloor(28, 30);
  floor.position.copy(L.w(0, 0.06, 1));
  floor.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(L.base));
  dyn.add(floor);

  // perimeter walls with entry gate (centre) and exit opening (right)
  const wallMat = sand;
  wall(L, cols, -H, 16, -3.5, 16, 4, wallMat);
  wall(L, cols, 3.5, 16, 9, 16, 4, wallMat);
  wall(L, cols, 12, 16, H, 16, 4, wallMat);
  wall(L, cols, -H, 16, -H, -16, 6, wallMat);
  wall(L, cols, H, 16, H, -16, 6, wallMat);
  wall(L, cols, -H, -16, H, -16, 9, wallMat);
  // terracotta coping and urns along the front wall
  for (const [a, b] of [[-H, -3.5], [3.5, 9], [12, H]] as const) {
    L.box(terracotta, (a + b) / 2, 4.1, 16, b - a, 0.25, 0.7);
    for (let x = a + 1; x < b - 0.5; x += 3) L.put(urn, ivory, x, 4.2, 16, 0.8, 0.8, 0.8);
  }
  gate(L, 16.2, 6.4, 6.2, { frame: 0xe3c68c, cloth: 0x8c1d18, accent: 0xd4af37 }, { bn: def.bn, en: def.name }, bulbs, dyn);
  const ent = entrySign('entry');
  ent.position.copy(L.w(-4.5, 2.2, 16.5));
  ent.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(L.base));
  dyn.add(ent);
  const ex = entrySign('exit');
  ex.position.copy(L.w(10.5, 2.4, 16.5));
  ex.quaternion.copy(ent.quaternion);
  dyn.add(ex);

  // side galleries: solid two-storey wings whose inner faces form arcades (ground) and
  // shuttered windows (upper), looking onto the courtyard
  for (const side of [-1, 1]) {
    const face = side * (H - 3); // inner face plane (local x)
    const ry = -side * Math.PI / 2; // face toward the courtyard
    L.box(sand, side * (H - 1.5), 4, -1, 3, 8, 28);
    cols.addBox(L.w(side * (H - 1.5), 0, -1).x, L.w(side * (H - 1.5), 0, -1).z, 3, 28, def.facing, 8);
    for (let i = 0; i < 6; i++) {
      const z = -12.4 + i * 4.6 + 2.3;
      // ground-floor arch: dark recess, moulded rim, pillars either side
      L.box(toon(0x2a1e1a), face - side * 0.02, 1.5, z, 0.06, 3.0, 2.6, 0, false);
      L.put(fanlight, toon(0x2a1e1a), face - side * 0.03, 3.0, z, 2.6, 1.3, 1, 0, ry, 0, false);
      L.put(archRim, ivory, face - side * 0.06, 3.0, z, 2.75, 2.75, 1.6, 0, ry, 0, false);
      L.put(cyl, ivory, face - side * 0.15, 1.5, z - 1.55, 0.5, 3.0, 0.5);
      L.put(cyl, ivory, face - side * 0.15, 1.5, z + 1.55, 0.5, 3.0, 0.5);
      // upper floor: tall shuttered window with fanlight
      L.box(toon(0x2a1e1a), face - side * 0.02, 5.6, z, 0.05, 2.0, 1.1, 0, false);
      L.put(fanlight, glow(0x5ec2d8, 0.6), face - side * 0.03, 6.6, z, 1.1, 1.1, 1, 0, ry, 0, false);
      L.put(louvreLeaf, green, face - side * 0.35, 5.6, z - 0.95, 0.55, 2.0, 1, 0, ry + side * 0.9, 0);
      L.put(louvreLeaf, green, face - side * 0.35, 5.6, z + 0.95, 0.55, 2.0, 1, 0, ry - side * 0.9, 0);
      L.box(ivory, face - side * 0.12, 4.5, z, 0.25, 0.14, 1.6, 0, false);
    }
    L.box(ivory, face - side * 0.1, 4.0, -1, 0.3, 0.35, 28, 0, false); // string course
    L.box(terracotta, face - side * 0.15, 8.0, -1, 0.45, 0.4, 28);
    // hanging lanterns along the arcade
    for (let i = 0; i < 6; i++) L.put(sph, glow(0xffc46b, 2.2), face - side * 1.2, 3.4, -12.4 + i * 4.6 + 2.3, 0.35, 0.45, 0.35, 0, 0, 0, false);
  }

  // thakur dalan: raised pillared hall at the back with scalloped arches, cornice and balustrade
  const dz = -10;
  L.box(ivory, 0, 0.7, dz, 22, 1.4, 10);
  for (let k = 0; k < 4; k++) L.box(toon(0xd9c9a8), 0, 0.17 + k * 0.35 - 0.17, dz + 5.2 + (3 - k) * 0.45, 9, 0.35 + k * 0.35, 0.45);
  L.box(sand, 0, 6.5, dz - 4.6, 22, 13, 1);
  for (let i = 0; i < 6; i++) {
    const x = -10 + i * 4;
    L.put(cyl, ivory, x, 4.4, dz + 4.4, 0.75, 6.0, 0.75);
    L.put(cyl, toon(0xd4af37), x, 7.45, dz + 4.4, 1.0, 0.25, 1.0); // capital
    L.put(cyl, ivory, x, 1.55, dz + 4.4, 1.0, 0.3, 1.0); // base
    if (i < 5) L.put(scallopRim, ivory, x + 2, 6.9, dz + 4.5, 3.6, 2.6, 1.6);
  }
  L.box(sand, 0, 8.9, dz + 4.5, 22.4, 2.4, 0.8);
  L.box(ivory, 0, 10.2, dz + 4.7, 23, 0.35, 1.3);
  L.box(sand, 0, 9.5, dz, 22, 0.6, 10); // roof slab
  for (let x = -10.6; x <= 10.6; x += 0.55) L.put(baluster, ivory, x, 10.4, dz + 4.7, 0.9, 0.9, 0.9, 0, 0, 0, false);
  L.box(ivory, 0, 11.35, dz + 4.7, 23, 0.18, 0.5);
  for (const x of [-11, -5.5, 0, 5.5, 11]) L.put(urn, toon(0xd4af37), x, 11.4, dz + 4.7, 1.1, 1.1, 1.1);
  cols.addBox(L.w(0, 0, dz - 2.4).x, L.w(0, 0, dz - 2.4).z, 22, 5.5, def.facing, 9);
  // pillars of the dalan front as colliders (camera can peek between)
  for (let i = 0; i < 6; i++) {
    const p = L.w(-10 + i * 4, 0, dz + 4.4);
    cols.addCircle(p.x, p.z, 0.45, 6);
  }
  // the protima in the dalan, with a railing so visitors stay on the courtyard side
  idolTableau(L, 0, dz - 1.4, 1.05, { panel: 0x7a1f1a, chalchitra: 0xd4af37, y0: 1.4, style: 'sabeki' });
  bediRailing(L, cols, dz + 4.95, 13);
  // chandeliers
  for (const x of [-6, 0, 6]) {
    L.put(cyl, toon(0x8a6a2a), x, 8.6, dz + 1, 0.04, 1.4, 0.04, 0, 0, 0, false);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      L.put(sph, glow(0xfff1c4, 3), x + Math.cos(a) * 0.45, 7.75, dz + 1 + Math.sin(a) * 0.45, 0.14, 0.14, 0.14, 0, 0, 0, false);
    }
    L.put(sph, glow(0xfff1c4, 2.4), x, 7.6, dz + 1, 0.28, 0.4, 0.28, 0, 0, 0, false);
  }
  // red-bordered banners and a marigold toran across the dalan front
  for (let i = 0; i < 40; i++) {
    const u = i / 39;
    L.put(sph, toon(i % 2 ? 0xf6a21e : 0xffc93c), -10 + u * 20, 7.6 - Math.abs(Math.sin(u * Math.PI * 5)) * 0.6, dz + 4.9, 0.18, 0.18, 0.18, 0, 0, 0, false);
  }
  // alpona in front of the dalan steps (walk-around: fenced by the steps/railing)
  const alp = alponaMesh(3.2);
  alp.position.copy(L.w(0, 0.08, dz + 8.9));
  dyn.add(alp);

  // visitors' bell on a carved wooden frame, in the courtyard to the side
  const bellPos = L.w(6, 0, 4);
  const frame = new THREE.Group();
  frame.position.copy(bellPos);
  frame.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(L.base));
  const wood = toon(0x6b3a22);
  const post = (x: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.9, 0.22), wood);
    m.position.set(x, 1.45, 0);
    m.castShadow = true;
    frame.add(m);
  };
  post(-0.8);
  post(0.8);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.24, 0.3), wood);
  beam.position.y = 2.95;
  frame.add(beam);
  const pivot = new THREE.Group();
  pivot.position.y = 2.85;
  frame.add(pivot);
  const bellGeo = new THREE.LatheGeometry([[0, 0], [0.32, 0], [0.3, 0.06], [0.22, 0.3], [0.17, 0.55], [0.1, 0.62], [0.04, 0.72], [0, 0.72]].map(([a, b]) => new THREE.Vector2(a, b)), 20);
  const bell = new THREE.Mesh(bellGeo, toon(0xc9a24a, { paint: false }));
  bell.rotation.x = Math.PI;
  bell.position.y = 0.05;
  bell.castShadow = true;
  pivot.add(bell);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.2), toon(0xb3121f, { paint: false }));
  rope.position.y = -1.3;
  pivot.add(rope);
  frame.traverse((o) => (o.frustumCulled = false));
  dyn.add(frame);
  cols.addCircle(bellPos.x, bellPos.z, 0.6, 1.5);
  const glowRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 40).rotateX(-Math.PI / 2), bend(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.8, 0.6), transparent: true, opacity: 0.8 })));
  glowRing.position.copy(bellPos).setY(0.1);
  glowRing.frustumCulled = false;
  dyn.add(glowRing);

  let swing = 0, swingV = 0;
  return {
    targets: [{ id: 'bell', pos: L.w(6, 0, 5.2), radius: 2.2 }],
    lights: [
      { pos: L.w(0, 6, dz + 2), color: 0xffd38a, intensity: 18, distance: 22 },
      { pos: L.w(0, 4, 4), color: 0xffb36b, intensity: 8, distance: 18 },
      { pos: L.w(-8, 5, dz + 1), color: 0xffd38a, intensity: 8, distance: 14 },
      { pos: L.w(8, 5, dz + 1), color: 0xffd38a, intensity: 8, distance: 14 },
    ],
    dynamic: dyn,
    update(t, dt, done, complete) {
      swingV += (-swing * 18 - swingV * 2.2) * dt;
      swing += swingV * dt;
      pivot.rotation.x = swing;
      glowRing.visible = !complete;
      (glowRing.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.35 * Math.sin(t * 3);
      void done;
    },
    onActivate() {
      swingV = 3.2;
    },
    view: { pos: L.w(0, 3.2, 8), look: L.w(0, 3.5, dz - 1) },
    gate: L.w(0, 0, 13),
    darshan: L.w(0, 0, 1),
  };
}

function checkerFloor(w: number, d: number): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      g.fillStyle = (i + j) % 2 ? '#4a5552' : '#e6dcc8';
      g.fillRect(i * 32, j * 32, 32, 32);
    }
  g.strokeStyle = 'rgba(80,60,40,0.25)';
  g.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i * 32); g.lineTo(256, i * 32); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  releaseImageAfterUpload(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(w / 5, d / 5); // ~0.6 m marble tiles
  tex.magFilter = THREE.NearestFilter;
  tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 14, 14).rotateX(-Math.PI / 2), bend(new THREE.MeshLambertMaterial({ map: tex }), false));
  m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
}
