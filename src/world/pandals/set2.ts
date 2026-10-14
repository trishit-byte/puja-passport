/**
 * Pandals 5–7: Dhaker Taale (rhythm), Neel Swapno (underwater) and Smritir Shohor (old city
 * memories). Nodir Opare, out on the river, is in set3.ts.
 */
import * as THREE from 'three';
import { toon, glow, bend } from '../../rendering/materials';
import { idolTableau, gate, bediRailing, enclosure, landmarkTower, cyl, sph, cone, disc, torus, type PandalBuild, type Local } from './common';
import { lamp } from './set1';
import type { BuildCtx } from './index';
import { signGeometry, signMaterial, SIGN_ASPECT } from '../props/signs';

function ringMarker(L: Local, x: number, z: number, color: number, parent: THREE.Object3D) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 40).rotateX(-Math.PI / 2), bend(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), transparent: true, opacity: 0.7, depthWrite: false })));
  m.position.copy(L.w(x, 0.1, z));
  m.frustumCulled = false;
  parent.add(m);
  return m;
}

/** Big decorated dhak: barrel, painted rings, skins and a tall white kash plume. */
function giantDhak(L: Local, x: number, y: number, z: number, s: number, ry = 0) {
  const red = toon(0x8c2f22), skin = toon(0xefe3c2), gold = toon(0xd4af37);
  L.put(cyl, red, x, y, z, 1.6 * s, 2.6 * s, 1.6 * s, 0, ry, Math.PI / 2);
  for (const k of [-1, 1]) {
    const ox = Math.cos(ry) * k * 1.32 * s, oz = -Math.sin(ry) * k * 1.32 * s;
    L.put(cyl, skin, x + ox, y, z + oz, 1.7 * s, 0.1 * s, 1.7 * s, 0, ry, Math.PI / 2);
  }
  for (let i = 0; i < 5; i++) {
    const t = -1 + i * 0.5;
    L.put(torus, gold, x + Math.cos(ry) * t * 1.1 * s, y, z - Math.sin(ry) * t * 1.1 * s, 1.62 * s, 1.62 * s, 1.62 * s, 0, ry + Math.PI / 2, 0, false);
  }
  for (let i = 0; i < 12; i++) L.put(sph, toon(0xffffff), x + Math.sin(i * 1.3) * 0.35 * s, y + 1.0 * s + i * 0.28 * s, z + Math.cos(i) * 0.15 * s, 0.5 * s, 0.32 * s, 0.4 * s, 0, 0, 0, false);
}

// --------------------------------------------------------------------------- Dhaker Taal
export function buildDhakerTaal(ctx: BuildCtx): PandalBuild {
  const { L, cols, bulbs, def } = ctx;
  const dyn = new THREE.Group();
  L.dyn = dyn;
  const R = 16;
  const redM = toon(0xd9381e), white = toon(0xf4eedf);
  enclosure(L, cols, R, 7, white, 3.4);
  gate(L, R + 0.2, 7, 6.5, { frame: 0xd9381e, cloth: 0xb3121f, accent: 0xffc93c }, { bn: def.bn, en: def.name }, bulbs, dyn);
  // red-and-white striped hall with a scalloped roof edge
  for (let i = -6; i <= 6; i++) L.box(i % 2 ? redM : white, i * 1.5, 4.5, -14.6, 1.5, 9, 0.6);
  for (const x of [-10, 10]) {
    L.box(white, x, 4.5, -8, 0.6, 9, 13);
    for (let k = 0; k < 6; k++) L.box(k % 2 ? redM : white, x, 4.5, -13.5 + k * 2.2, 0.7, 9, 1.0);
  }
  L.box(redM, 0, 9.2, -8, 21, 0.5, 14);
  for (let i = 0; i < 26; i++) L.put(sph, toon(i % 2 ? 0xffc93c : 0xf4eedf), -10 + i * 0.8, 8.9, -1.1, 0.42, 0.42, 0.2, 0, 0, 0, false);
  // giant dhaks framing the hall, and a drummers' stage
  giantDhak(L, -12.5, 2.4, 6, 1.4, 0.3);
  giantDhak(L, 12.5, 2.4, 6, 1.4, -0.3);
  giantDhak(L, -7.5, 11.5, -8, 1.2, 0);
  giantDhak(L, 7.5, 11.5, -8, 1.2, 0);
  for (const [x, z] of [[-12.5, 6], [12.5, 6]] as const) cols.addCircle(L.w(x, 0, z).x, L.w(x, 0, z).z, 2.4, 4);
  L.box(toon(0x6b3a22), 0, 0.3, -3.5, 12, 0.6, 3);
  idolTableau(L, 0, -11, 1.1, { panel: 0xb3121f, chalchitra: 0xffc93c, style: 'patachitra' });
  bediRailing(L, cols, -6.2, 12);
  // rhythm lights: rows of lamps around the hall that pulse to the dhak
  const pulse: ReturnType<typeof lamp>[] = [];
  const ico = new THREE.IcosahedronGeometry(0.3, 1);
  for (let i = 0; i < 24; i++) {
    const side = i < 12 ? -1 : 1;
    const k = i % 12;
    pulse.push(lamp(ico, k % 2 ? 0xffb36b : 0xffe8b0, L, side * 9.6, 1.2 + (k % 6) * 1.3, -13 + Math.floor(k / 6) * 10, 1, dyn));
  }
  // the visitors' dhak on its stand — where you tap along
  const stand = new THREE.Group();
  stand.position.copy(L.w(0, 0, 4.2));
  stand.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(L.base));
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 20), toon(0x8c2f22, { paint: false }));
  drum.rotation.z = Math.PI / 2;
  drum.position.y = 1.1;
  const skinL = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.57, 0.05, 20), toon(0xefe3c2, { paint: false }));
  skinL.rotation.z = Math.PI / 2;
  skinL.position.set(0.62, 1.1, 0);
  const skinR = skinL.clone();
  skinR.position.x = -0.62;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.6), toon(0x6b3a22, { paint: false }));
  legs.position.y = 0.3;
  stand.add(drum, skinL, skinR, legs);
  stand.traverse((o) => (o.frustumCulled = false));
  dyn.add(stand);
  cols.addCircle(stand.position.x, stand.position.z, 0.9, 1.5);
  const ring = ringMarker(L, 0, 6.2, 0xffc93c, dyn);
  landmarkTower(L, 13.5, -13.5, 21, [0xd9381e, 0xffc93c, 0xffe8b0], bulbs, 0x6b2a1a);
  let hit = 0;
  return {
    targets: [{ id: 'dhak', pos: L.w(0, 0, 6.0), radius: 2.4 }],
    lights: [
      { pos: L.w(0, 7, -8), color: 0xffb36b, intensity: 18, distance: 22 },
      { pos: L.w(0, 4, 4), color: 0xff7a3c, intensity: 9, distance: 16 },
    ],
    dynamic: dyn,
    update(t, dt, _done, complete) {
      hit = Math.max(0, hit - dt * 4);
      // ambient beat: the hall lights throb in the 12-step dhak cycle
      const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2.6)), 6);
      pulse.forEach((p, i) => p.set(1.0 + beat * 2.2 * ((i % 3) / 2 + 0.5) + hit * 3));
      drum.scale.setScalar(1 + hit * 0.08);
      ring.visible = !complete;
    },
    onActivate() {
      hit = 1;
    },
    view: { pos: L.w(0, 3, 9), look: L.w(0, 4, -11) },
    gate: L.w(0, 0, R - 3),
    darshan: L.w(0, 0, -1),
  };
}

// --------------------------------------------------------------------------- Neel Shagor
export function buildNeelShagor(ctx: BuildCtx): PandalBuild {
  const { L, cols, bulbs, def } = ctx;
  const dyn = new THREE.Group();
  L.dyn = dyn;
  const R = 17;
  const deep = toon(0x0b2a5b), blue = toon(0x1a5fb4), cyan = toon(0x3fb6c9);
  enclosure(L, cols, R, 7, deep, 4);
  gate(L, R + 0.2, 7, 6.5, { frame: 0x0b2a5b, cloth: 0x1a5fb4, accent: 0x5ef2ff }, { bn: def.bn, en: def.name }, bulbs, dyn);
  // wave-arch tunnel leading in
  for (let k = 0; k < 5; k++) {
    L.put(torus, k % 2 ? blue : cyan, 0, 0, 12 - k * 3, 9, 9, 6, 0, 0, 0);
    for (let i = 0; i < 16; i++) {
      const a = Math.PI * (i / 15);
      bulbs.add(L.w(Math.cos(a) * 4.5, Math.sin(a) * 4.5, 12 - k * 3), i % 2 ? 0x5ef2ff : 0xffffff, 0.1, i % 2);
    }
  }
  // dark ocean hall: walls with wave scallops, a domed blue ceiling
  for (const x of [-12, 12]) for (let z = -14; z <= 2; z += 2) L.put(sph, z % 4 ? blue : cyan, x, 7.5, z, 1.4, 1.0, 1.4, 0, 0, 0, false);
  L.put(sph, toon(0x0b2a5b, { side: THREE.DoubleSide }), 0, 4, -7, 26, 14, 18);
  // seaweed and coral
  for (let i = 0; i < 18; i++) {
    const x = (i % 2 ? -1 : 1) * (8 + (i % 4)), z = -14 + (i / 18) * 26;
    L.put(cone, toon(i % 3 ? 0x1f8a6a : 0x3fae8a), x, 1.6, z, 0.6, 3.2 + (i % 3), 0.6, 0.1 * (i % 5), 0, 0.15);
    if (i % 3 === 0) L.put(sph, toon(0xff7a8a), x + 1, 0.6, z, 0.9, 0.7, 0.9);
  }
  // suspended fish sculptures — a slowly circling shoal
  const shoal = new THREE.Group();
  shoal.position.copy(L.w(0, 7, -4));
  dyn.add(shoal);
  const fishGeo = new THREE.SphereGeometry(0.5, 10, 6);
  fishGeo.scale(1.6, 0.6, 0.35);
  const tailGeo = new THREE.ConeGeometry(0.35, 0.6, 4);
  tailGeo.rotateZ(Math.PI / 2);
  tailGeo.translate(-1.0, 0, 0);
  const fishes: THREE.Group[] = [];
  for (let i = 0; i < 22; i++) {
    const f = new THREE.Group();
    const c = [0xffb33c, 0x5ef2ff, 0xff7a8a, 0xffe8b0][i % 4];
    const body = new THREE.Mesh(fishGeo, bend(new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.2) })));
    const tail = new THREE.Mesh(tailGeo, body.material);
    f.add(body, tail);
    f.userData = { r: 3 + (i % 5) * 1.2, h: (i % 7) * 0.6 - 2, sp: 0.2 + (i % 3) * 0.08, ph: i * 0.9 };
    f.traverse((o) => (o.frustumCulled = false));
    shoal.add(f);
    fishes.push(f);
  }
  // projected water caustics on the floor
  const caus = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 24, 10, 10).rotateX(-Math.PI / 2),
    bend(
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec2 vUv;\nvoid main(){\n vUv = uv * 6.0;\n vec3 transformed = position;\n#include <project_vertex>\n}',
        fragmentShader: /* glsl */ `uniform float uTime; varying vec2 vUv;
          void main(){ vec2 p = vUv; float c = 0.0;
            for (int i = 0; i < 3; i++) { p += vec2(sin(p.y * 1.7 + uTime * 0.6), cos(p.x * 1.3 - uTime * 0.5)) * 0.35; c += abs(sin(p.x + p.y)); }
            c = pow(1.0 - abs(c / 3.0 - 0.5) * 2.0, 6.0);
            gl_FragColor = vec4(vec3(0.3, 0.85, 1.0) * c * 0.6, 1.0); }`,
      }),
    ),
  );
  caus.position.copy(L.w(0, 0.08, -3));
  caus.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(L.base));
  caus.frustumCulled = false;
  dyn.add(caus);
  // the protima under a scallop-shell canopy
  L.put(sph, toon(0xf4d6c8, { side: THREE.DoubleSide }), 0, 9.6, -13.4, 10, 7, 2.5, 0, 0, 0);
  for (let i = 0; i < 9; i++) L.put(cyl, toon(0xe8b8a8), (-4 + i) * 1.1, 9.6, -12.3, 0.12, 6, 0.12, 0, 0, (i - 4) * 0.16, false);
  idolTableau(L, 0, -12, 1.05, { panel: 0x0b2a5b, chalchitra: 0x5ef2ff, style: 'sea' });
  bediRailing(L, cols, -7.8, 11);
  // the giant clam with its glowing pearl, tucked among the coral on the right — you have to look for it
  const cx = 9, cz = -2;
  L.put(sph, toon(0xc8b8e8), cx, 0.5, cz, 1.6, 0.6, 1.4);
  L.put(sph, toon(0xc8b8e8, { side: THREE.DoubleSide }), cx, 1.2, cz - 0.9, 1.6, 1.0, 0.5, -0.7, 0, 0);
  cols.addCircle(L.w(cx, 0, cz).x, L.w(cx, 0, cz).z, 1.4, 1.2);
  const pearl = lamp(new THREE.IcosahedronGeometry(0.32, 3), 0xf8f4ff, L, cx, 1.0, cz, 1, dyn);
  landmarkTower(L, -14, -14, 22, [0x5ef2ff, 0x7fe8ff, 0xffffff], bulbs, 0x0b2a5b);
  let burst = 0;
  return {
    targets: [{ id: 'pearl', pos: L.w(cx - 1.4, 0, cz + 1.6), radius: 2.3 }],
    lights: [
      { pos: L.w(0, 6, -8), color: 0x5ef2ff, intensity: 16, distance: 22 },
      { pos: L.w(0, 3, 4), color: 0x3fb6c9, intensity: 10, distance: 18 },
    ],
    dynamic: dyn,
    update(t, dt, _done, complete) {
      burst = Math.max(0, burst - dt * 0.4);
      (caus.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      fishes.forEach((f) => {
        const u = f.userData;
        const a = t * u.sp * (1 + burst * 3) + u.ph;
        f.position.set(Math.cos(a) * u.r, u.h + Math.sin(t + u.ph) * 0.3, Math.sin(a) * u.r);
        f.rotation.y = -a;
      });
      pearl.set(complete ? 3.5 + Math.sin(t * 3) * 0.6 : 0.9 + 0.5 * Math.sin(t * 2.5));
    },
    onActivate() {
      burst = 1;
    },
    view: { pos: L.w(0, 3, 8), look: L.w(0, 4, -12) },
    gate: L.w(0, 0, R - 3),
    darshan: L.w(0, 0, -4),
  };
}

// --------------------------------------------------------------------------- Smritir Shohor
export function buildSmritirShohor(ctx: BuildCtx): PandalBuild {
  const { L, cols, bulbs, def } = ctx;
  const dyn = new THREE.Group();
  L.dyn = dyn;
  const R = 17;
  const sepia = toon(0xd9b48a), green = toon(0x3f6b4e), cream = toon(0xefe3c2);
  enclosure(L, cols, R, 7, toon(0x8a5a3a), 3.4);
  gate(L, R + 0.2, 7, 6.5, { frame: 0x3f6b4e, cloth: 0x8a5a3a, accent: 0xe3c68c }, { bn: def.bn, en: def.name }, bulbs, dyn);
  // a miniature old street of shopfronts along the back and sides, with hand-painted signboards
  for (let i = 0; i < 6; i++) {
    const x = -13 + i * 5.2;
    const c = [0xd9a5a0, 0xe3c68c, 0xa9c4c9, 0xefe4cf, 0xc9d3b0, 0xd8a48a][i];
    L.box(toon(c), x, 2.6, -15.5, 4.8, 5.2, 1.4);
    L.box(glow(0xffcf7a, 1.0), x, 1.3, -14.75, 3, 2.0, 0.05, 0, false);
    L.box(green, x - 1.7, 1.3, -14.7, 0.4, 2.2, 0.06, 0, false);
    L.box(green, x + 1.7, 1.3, -14.7, 0.4, 2.2, 0.06, 0, false);
    L.put(signGeometry([24, 5, 8, 14, 20, 22][i], 3.6, 3.6 / SIGN_ASPECT), signMaterial(), x, 3.2, -14.7, 1, 1, 1, 0, 0, 0, false);
    L.box(cream, x, 5.3, -15.1, 5, 0.3, 1.8);
  }
  // a miniature Kolkata tram on display: a still exhibit on a short length of track on a
  // plinth beside the walkway, green skirt and cream body, lit window bays, a domed roof and
  // its trolley pole, with a brass nameplate
  const tx = -6.5, tz = 7.5, ty = 0.32;
  const dark = toon(0x22242a, { paint: false });
  L.box(toon(0x8a7a66), tx, 0.15, tz, 4.9, 0.3, 1.7);
  L.box(toon(0xd4af37), tx, 0.16, tz + 0.86, 1.2, 0.16, 0.02, 0, false); // nameplate
  for (const rz of [-0.36, 0.36]) L.box(toon(0x7a7a80, { paint: false }), tx, ty + 0.02, tz + rz, 4.7, 0.04, 0.06, 0, false); // rails
  for (let k = 0; k < 10; k++) L.box(toon(0x5a3d2b), tx - 2.2 + k * 0.49, ty, tz, 0.14, 0.03, 1.1, 0, false); // sleepers
  L.box(green, tx, ty + 0.5, tz, 3.9, 0.45, 1.08); // lower skirt
  L.box(cream, tx, ty + 0.74, tz, 3.91, 0.04, 1.09, 0, false); // waist band
  L.box(cream, tx, ty + 1.02, tz, 3.9, 0.54, 1.08); // upper body
  for (const ex of [-1, 1]) {
    L.put(cyl, cream, tx + ex * 1.95, ty + 0.79, tz, 0.5, 1.0, 1.08); // rounded ends
    L.box(toon(0x26303a, { paint: false }), tx + ex * 2.2, ty + 1.05, tz, 0.02, 0.3, 0.7, 0, false); // windscreen
    L.box(glow(0xfff1c4, 2.0), tx + ex * 2.21, ty + 0.52, tz, 0.02, 0.09, 0.14, 0, false); // headlamp
    L.box(glow(0xffe9b0, 1.3), tx + ex * 2.21, ty + 1.32, tz, 0.02, 0.12, 0.55, 0, false); // destination board
  }
  for (const sd of [-1, 1])
    for (let k = 0; k < 8; k++) {
      const wx = tx - 1.58 + k * 0.45;
      L.box(glow(0xffd99a, 1.25), wx, ty + 1.04, tz + sd * 0.545, 0.35, 0.32, 0.02, 0, false); // window bay
      for (let q = 0; q < 3; q++) L.box(dark, wx - 0.11 + q * 0.11, ty + 1.04, tz + sd * 0.552, 0.015, 0.33, 0.015, 0, false); // bars
    }
  L.put(cyl, green, tx, ty + 1.29, tz, 0.26, 3.9, 1.1, 0, 0, Math.PI / 2); // domed roof
  L.box(cream, tx, ty + 1.45, tz, 2.9, 0.08, 0.45, 0, false); // ventilator
  L.box(dark, tx, ty + 0.24, tz, 3.8, 0.12, 0.9, 0, false); // underframe
  for (const bx of [-1.26, 1.26]) {
    L.box(dark, tx + bx, ty + 0.17, tz, 1.0, 0.16, 0.72, 0, false); // bogie
    for (const ax of [-0.3, 0.3]) for (const az of [-0.36, 0.36]) L.put(cyl, dark, tx + bx + ax, ty + 0.12, tz + az, 0.24, 0.05, 0.24, Math.PI / 2, 0, 0, false); // wheels
  }
  L.put(cyl, dark, tx - 0.5, ty + 2.0, tz, 0.03, 1.5, 0.03, 0, 0, 0.6, false); // trolley pole
  cols.addBox(L.w(tx, 0, tz).x, L.w(tx, 0, tz).z, 4.9, 1.7, def.facing, 1.6);
  // clock tower miniature (left) and tea corner (right)
  L.box(toon(0xb5562f), -10, 3, 2, 2, 6, 2);
  L.put(cone, toon(0x8c2f22), -10, 6.8, 2, 2.4, 1.6, 2.4, 0, Math.PI / 4, 0);
  L.put(disc, cream, -10, 4.8, 3.02, 1.2, 0.05, 1.2, Math.PI / 2, 0, 0, false);
  cols.addBox(L.w(-10, 0, 2).x, L.w(-10, 0, 2).z, 2.2, 2.2, def.facing, 6);
  L.box(toon(0x7a4a2a), 10, 0.5, 2, 2.6, 1.0, 1.2);
  L.box(toon(0x2f6b4e), 10, 2.6, 2, 3.0, 0.12, 1.8);
  for (let k = 0; k < 4; k++) L.put(cyl, toon(0xb5562f), 9.2 + k * 0.5, 1.1, 2, 0.07, 0.14, 0.07, 0, 0, 0, false);
  cols.addBox(L.w(10, 0, 2).x, L.w(10, 0, 2).z, 2.8, 1.4, def.facing, 1.2);
  // the rotating postcard stand at the centre
  const rack = new THREE.Group();
  rack.position.copy(L.w(0, 0, 10));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2), toon(0x2a2a30, { paint: false }));
  pole.position.y = 1.1;
  rack.add(pole);
  for (let k = 0; k < 4; k++) {
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.02), toon([0xe9dcbc, 0xf3c9a4, 0xd9e4dc, 0xefe3c2][k], { paint: false }));
    card.position.set(Math.cos(k * Math.PI / 2) * 0.3, 1.5, Math.sin(k * Math.PI / 2) * 0.3);
    card.rotation.y = -k * Math.PI / 2 + Math.PI / 2;
    rack.add(card);
  }
  rack.traverse((o) => (o.frustumCulled = false));
  dyn.add(rack);
  cols.addCircle(rack.position.x, rack.position.z, 0.5, 2);
  // a vintage sepia frame around the protima
  L.box(toon(0x6b4a2a), 0, 4.8, -13.2, 10.5, 8.0, 0.4);
  L.box(sepia, 0, 4.8, -13.0, 9.6, 7.2, 0.2);
  idolTableau(L, 0, -11, 1.0, { panel: 0x8a5a3a, chalchitra: 0xe3c68c, style: 'daker' });
  bediRailing(L, cols, -6.8, 11);
  // gramophone horn and a radio on the side
  L.put(cone, toon(0xd4af37, { side: THREE.DoubleSide }), -13, 1.8, -8, 1.0, 1.4, 1.0, 0, 0, 1.0);
  L.box(toon(0x5a3d2b), -13, 0.6, -8, 1.2, 1.2, 1.0);
  const marks = [ringMarker(L, 0, 8, 0xe3c68c, dyn), ringMarker(L, tx, tz + 2.1, 0xe3c68c, dyn), ringMarker(L, -10, 4.2, 0xe3c68c, dyn), ringMarker(L, 10, 4.2, 0xe3c68c, dyn)];
  landmarkTower(L, 14, -14, 20, [0xe3c68c, 0xffe0a8, 0x3f6b4e], bulbs, 0x3f6b4e);
  return {
    targets: [
      { id: 'postcards', pos: L.w(0, 0, 8.3), radius: 2.2 },
      { id: 'lm-tram', pos: L.w(tx, 0, tz + 2.1), radius: 2.0 },
      { id: 'lm-clock', pos: L.w(-10, 0, 4.0), radius: 2.2 },
      { id: 'lm-cha', pos: L.w(10, 0, 4.0), radius: 2.2 },
    ],
    lights: [
      { pos: L.w(0, 6, -8), color: 0xffe0a8, intensity: 16, distance: 22 },
      { pos: L.w(0, 4, 6), color: 0xffcf8a, intensity: 9, distance: 18 },
    ],
    dynamic: dyn,
    update(t, _dt, done, complete) {
      rack.rotation.y = t * 0.4;
      marks[0].visible = !complete;
      marks[1].visible = !complete && !done.includes('lm-tram');
      marks[2].visible = !complete && !done.includes('lm-clock');
      marks[3].visible = !complete && !done.includes('lm-cha');
    },
    onActivate() {},
    view: { pos: L.w(0, 3, 9), look: L.w(0, 3.5, -11) },
    gate: L.w(0, 0, R - 3),
    darshan: L.w(0, 0, -1),
  };
}
