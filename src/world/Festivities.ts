/**
 * Festival energy layer:
 *  • sweeping searchlight beams above every pandal (in its palette) — visible from anywhere on the
 *    little planet, so they double as wayfinding;
 *  • Chandannagar-style light boards: big bulb-drawn motifs (peacock, lotus, butterfly, swan, star)
 *    whose colours ripple and cycle;
 *  • slow traffic: yellow taxis and a tram trundling along the main roads (they politely stop for you).
 */
import * as THREE from 'three';
import { bend, toon, glow, batchMaterial } from '../rendering/materials';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ensureIndex, packNormals, packColors, colorsFit, compactIndex } from '../utils/geometry';

/** Compact vertex formats for a merged vehicle body. */
function compact(g: THREE.BufferGeometry) {
  packNormals(g);
  const col = g.attributes.color as THREE.BufferAttribute;
  if (colorsFit(col)) g.setAttribute('color', packColors(col));
  compactIndex(g);
  return g;
}
import { PANDALS } from '../data/pandals';
import { PLAZAS } from '../data/layout';
import type { RoadSample } from './roads';
import type { World } from './World';
import { Rng } from '../utils/rng';
import { Character } from '../player/Character';
import { ambassadorParts, wheelParts, WHEELS, WHEEL_R } from './props/ambassador';

const beamVert = 'varying float vH;\nvoid main(){\n vH = uv.y;\n vec3 transformed = position;\n#include <project_vertex>\n}';
const beamFrag = /* glsl */ `uniform vec3 uColor; uniform float uAlpha; varying float vH;
  void main(){ float a = pow(1.0 - vH, 1.6) * uAlpha; gl_FragColor = vec4(uColor * a, a); }`;

type Motif = 'peacock' | 'lotus' | 'butterfly' | 'swan' | 'star';

function motifPoints(m: Motif): { x: number; y: number; g: number }[] {
  const pts: { x: number; y: number; g: number }[] = [];
  const add = (x: number, y: number, g: number) => pts.push({ x, y, g });
  const N = 140;
  if (m === 'lotus') {
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI;
      const r = Math.abs(Math.cos(3 * t)) * 2.2 + 0.2;
      add(Math.cos(t) * r, Math.sin(t) * r * 1.1, Math.floor(i / 20));
    }
    for (let i = 0; i < 30; i++) add(-2.4 + (i / 29) * 4.8, -0.15, 9);
  } else if (m === 'butterfly') {
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      const r = Math.exp(Math.sin(t)) - 2 * Math.cos(4 * t) + Math.pow(Math.sin((2 * t - Math.PI) / 24), 5);
      add(Math.sin(t) * r * 0.55, Math.cos(t) * r * 0.55 + 0.6, i % 4);
    }
  } else if (m === 'peacock') {
    for (let k = 0; k < 7; k++)
      for (let i = 0; i < 14; i++) {
        const a = Math.PI * (0.15 + (0.7 * k) / 6);
        const r = 0.6 + (i / 13) * 2.4;
        add(Math.cos(a) * r, Math.sin(a) * r * 0.9, i > 10 ? 9 : k % 3);
      }
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * Math.PI * 2;
      add(Math.cos(t) * 0.35, -0.4 + Math.sin(t) * 0.6, 5);
    }
  } else if (m === 'swan') {
    for (let i = 0; i < N; i++) {
      const t = i / N;
      if (t < 0.5) {
        const a = t * 2 * Math.PI;
        add(Math.cos(a) * 1.9, -0.6 + Math.sin(a) * 0.7 * (Math.sin(a) < 0 ? 1 : 0.4), 1);
      } else {
        const u = (t - 0.5) * 2;
        add(1.4 - Math.sin(u * Math.PI) * 0.9, -0.3 + u * 2.4, 2);
      }
    }
  } else {
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      const r = 1.2 + 1.0 * Math.cos(5 * t);
      add(Math.cos(t) * r, Math.sin(t) * r, i % 5);
    }
  }
  return pts;
}

/** Merge a group's direct-or-nested static meshes into one toon + one glow mesh (vertex colours). */
function mergeParts(group: THREE.Object3D) {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert();
  const toonG: THREE.BufferGeometry[] = [], glowG: THREE.BufferGeometry[] = [];
  const kill: THREE.Mesh[] = [];
  let shadow = false;
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh) return;
    // skip anything inside a character (riders) — they animate
    for (let p = m.parent; p && p !== group; p = p.parent) if (p.userData.character) return;
    const mat = m.material as THREE.MeshBasicMaterial & { isMeshToonMaterial?: boolean; isMeshBasicMaterial?: boolean };
    if (Array.isArray(mat) || (mat.side === THREE.DoubleSide && mat.isMeshToonMaterial)) return; // hoods: keep double-sided
    const isToon = !!mat.isMeshToonMaterial, isGlow = !!mat.isMeshBasicMaterial && !mat.transparent;
    if (!isToon && !isGlow) return;
    const g = ensureIndex(m.geometry.clone()).applyMatrix4(inv.clone().multiply(m.matrixWorld));
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
    const c = mat.color, cnt = g.attributes.position.count, arr = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) arr.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
    (isToon ? toonG : glowG).push(g);
    shadow ||= m.castShadow;
    kill.push(m);
  });
  for (const m of kill) m.parent!.remove(m);
  if (toonG.length) {
    const mesh = new THREE.Mesh(compact(mergeGeometries(toonG)!), batchMaterial('toonN0'));
    mesh.castShadow = shadow;
    group.add(mesh);
  }
  if (glowG.length) group.add(new THREE.Mesh(compact(mergeGeometries(glowG)!), batchMaterial('glow')));
}

interface Vehicle {
  g: THREE.Group;
  wheels: THREE.Object3D[];
  radius: number;
  path: THREE.Vector3[];
  t: number; // path parameter (segment index + fraction)
  speed: number; // cruise m/s
  cur: number; // current speed (accelerates / brakes smoothly)
  tram: boolean;
  flip: boolean; // tram: driving the return leg (body turned around)
  rider?: Character;
  blocked: number; // seconds held up by the player (→ a honk)
  honkCd: number;
  pedal?: boolean;
}

export class Festivities {
  root = new THREE.Group();
  private beams: { pivot: THREE.Group; ph: number; mat: THREE.ShaderMaterial }[] = [];
  private boards: { im: THREE.InstancedMesh; groups: number[]; palette: THREE.Color[]; ph: number; pos: THREE.Vector3 }[] = [];
  private vehicles: Vehicle[] = [];
  private tmpC = new THREE.Color();

  constructor(world: World, seed: number, quality: 'low' | 'medium' | 'high' = 'high') {
    const rng = new Rng(seed * 13 + 5);
    // ---- searchlights ----
    const beamGeo = new THREE.CylinderGeometry(7, 0.35, 110, 20, 8, true);
    beamGeo.translate(0, 55, 0);
    for (const p of PANDALS) {
      for (let k = 0; k < 2; k++) {
        const mat = bend(
          new THREE.ShaderMaterial({
            uniforms: { uColor: { value: new THREE.Color(k ? p.palette.light : p.palette.accent).multiplyScalar(1.4) }, uAlpha: { value: 0.22 } },
            vertexShader: beamVert,
            fragmentShader: beamFrag,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
          }),
        ) as THREE.ShaderMaterial;
        const pivot = new THREE.Group();
        const back = new THREE.Vector3(-Math.sin(p.facing), 0, -Math.cos(p.facing)).multiplyScalar(p.radius - 4);
        pivot.position.set(p.x + back.x + (k ? 3 : -3) * Math.cos(p.facing), 8, p.z + back.z - (k ? 3 : -3) * Math.sin(p.facing));
        const mesh = new THREE.Mesh(beamGeo, mat);
        mesh.frustumCulled = false;
        mesh.renderOrder = 5;
        pivot.add(mesh);
        this.root.add(pivot);
        this.beams.push({ pivot, ph: rng.range(0, 6.28) + k * Math.PI, mat });
      }
    }
    // ---- light boards (on two poles, facing the road) ----
    const spots: { x: number; z: number; yaw: number }[] = [];
    for (const s of world.roads) {
      if (s.road.kind === 'lane') continue;
      const total = s.lengths[s.lengths.length - 1];
      for (let t = 20; t < total - 10; t += 46) {
        const i = s.lengths.findIndex((L) => L >= t);
        const p = s.pts[i], n = s.normals[i];
        const side = rng.chance(0.5) ? 1 : -1;
        const off = s.road.width / 2 + 1.6;
        const x = p.x + n.x * side * off, z = p.z + n.z * side * off;
        if (PANDALS.some((pd) => Math.hypot(pd.x - x, pd.z - z) < pd.radius + 6)) continue;
        if (PLAZAS.some((pl) => Math.hypot(pl.x - x, pl.z - z) < pl.r)) continue;
        if (world.footprints.some((f) => Math.hypot(f.x - x, f.z - z) < Math.max(f.hw, f.hd) + 0.6)) continue;
        spots.push({ x, z, yaw: Math.atan2(-n.x * side, -n.z * side) });
      }
    }
    for (const pl of PLAZAS.slice(0, 5)) spots.push({ x: pl.x + pl.r * 0.7, z: pl.z - pl.r * 0.7, yaw: -Math.PI * 0.75 });
    const motifs: Motif[] = ['peacock', 'lotus', 'butterfly', 'swan', 'star'];
    const palettes = [
      [0xff2d9a, 0x2de8ff, 0xffd23c, 0x8aff4a, 0xb05aff, 0xff6a1a],
      [0xffd23c, 0xff3d3d, 0xff8a1a, 0xffffff, 0x3dffb0, 0x5a8aff],
      [0x2de8ff, 0xc05aff, 0xff4fd8, 0x7fffd4, 0xffd23c, 0xff6a1a],
    ];
    const bulb = new THREE.IcosahedronGeometry(0.11, 0);
    const pole = toon(0x2a2030);
    spots.forEach((sp, i) => {
      const m = motifs[i % motifs.length];
      const pts = motifPoints(m);
      const im = new THREE.InstancedMesh(bulb, bend(new THREE.MeshBasicMaterial({ color: 0xffffff })), pts.length);
      const base = new THREE.Matrix4().makeRotationY(sp.yaw).setPosition(sp.x, 6.2, sp.z);
      const mt = new THREE.Matrix4();
      pts.forEach((q, j) => {
        mt.makeTranslation(q.x * 0.95, q.y * 0.95, 0).premultiply(base);
        im.setMatrixAt(j, mt);
        im.setColorAt(j, new THREE.Color(0xffffff));
      });
      im.frustumCulled = false;
      this.root.add(im);
      this.boards.push({ im, groups: pts.map((q) => q.g), palette: palettes[i % 3].map((c) => new THREE.Color(c)), ph: rng.range(0, 10), pos: new THREE.Vector3(sp.x, 0, sp.z) });
      // bamboo poles + a dark frame behind the motif
      for (const ox of [-2.8, 2.8]) world.batch.addMesh(new THREE.CylinderGeometry(0.12, 0.14, 9, 6), pole, new THREE.Vector3(ox, 4.5, -0.2).applyMatrix4(new THREE.Matrix4().makeRotationY(sp.yaw).setPosition(sp.x, 0, sp.z)), null, 1);
      world.colliders.addCircle(sp.x, sp.z, 0.4, 2);
    });
    // ---- traffic ----
    // Every vehicle drives a closed loop: out along the left lane of its road, a U-turn at the end,
    // back along the other lane. Wheels are real geometry that roll with the distance travelled.
    const tyre = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 14);
    tyre.rotateZ(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(0.16, 0.16, 0.26, 8);
    hub.rotateZ(Math.PI / 2);
    const tyreM = toon(0x1a1a1e, { paint: false }), hubM = toon(0xc8ccd0, { paint: false });
    const mk = (kind: 'taxi' | 'tram' | 'auto' | 'rickshaw' | 'bike') => {
      const g = new THREE.Group();
      const body = new THREE.Group();
      g.add(body);
      const wheels: THREE.Object3D[] = [];
      const box = (w: number, h: number, d: number, c: THREE.Material, y: number, z = 0, parent = body) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), c);
        m.position.set(0, y, z);
        m.castShadow = true;
        parent.add(m);
        return m;
      };
      const wheel = (x: number, z: number, r = 0.36) => {
        const w = new THREE.Group();
        const t = new THREE.Mesh(tyre, tyreM);
        const hb = new THREE.Mesh(hub, hubM);
        w.add(t, hb);
        w.scale.setScalar(r / 0.36);
        w.position.set(x, r, z);
        g.add(w);
        wheels.push(w);
      };
      let radius = 0.36;
      let rider: Character | undefined;
      const seat = (y: number, z: number, look: ConstructorParameters<typeof Character>[0]) => {
        rider = new Character(look, true);
        rider.group.userData.character = true;
        rider.pose = 'sit';
        rider.group.position.set(0, y - 0.5, z);
        g.add(rider.group);
      };
      if (kind === 'rickshaw') {
        // cycle-rickshaw: a bicycle front (single wheel, handlebar, the rickshawala pedalling)
        // pulling a two-wheeled passenger seat with a folding hood
        radius = 0.42;
        const frame = toon(0x2a5a8a, { paint: false });
        box(0.08, 0.08, 1.5, frame, 0.55, 0.45);
        box(0.06, 0.7, 0.06, frame, 0.75, 1.15);
        box(0.6, 0.04, 0.04, toon(0x2a2a2a, { paint: false }), 1.12, 1.18);
        box(0.25, 0.06, 0.3, toon(0x3a2a1a, { paint: false }), 0.92, 0.55);
        box(1.2, 0.12, 0.7, toon(0x3a2a1a, { paint: false }), 0.6, -0.55);
        box(1.0, 0.18, 0.55, toon(0xb3121f, { paint: false }), 0.95, -0.6); // seat cushion
        box(1.0, 0.55, 0.1, toon(0xb3121f, { paint: false }), 1.25, -0.88);
        const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.05, 16, 1, true, -Math.PI / 2, Math.PI), toon(0x1e1e26, { paint: false, side: THREE.DoubleSide }));
        hood.rotation.z = Math.PI / 2;
        hood.position.set(0, 1.35, -0.75);
        hood.castShadow = true;
        body.add(hood);
        for (let k = 0; k < 6; k++) box(1.02, 0.04, 0.04, toon(k % 2 ? 0xf2c14e : 0xd94f7a, { paint: false }), 1.35 + Math.sin((k / 5) * Math.PI) * 0.6, -0.75 + Math.cos((k / 5) * Math.PI) * 0.6); // painted hood ribs
        wheel(0, 1.25, 0.36);
        wheel(-0.6, -0.6, 0.42);
        wheel(0.6, -0.6, 0.42);
        seat(1.05, 0.55, { style: 'shirt', color: 0xf4eedf, accent: 0x2f6b4e, hair: 'short', pants: 0x5a6a7a });
      } else if (kind === 'bike') {
        // motorbike with its rider
        radius = 0.32;
        box(0.22, 0.35, 1.3, toon(0xb3121f, { paint: false }), 0.65, 0);
        box(0.3, 0.12, 0.7, toon(0x1e1e26, { paint: false }), 0.88, -0.25);
        box(0.6, 0.04, 0.04, toon(0x2a2a2a, { paint: false }), 1.1, 0.55);
        box(0.18, 0.14, 0.06, glow(0xfff1c4, 2.2), 0.95, 0.7);
        wheel(0, 0.62, 0.32);
        wheel(0, -0.62, 0.32);
        seat(0.98, -0.2, { style: 'shirt', color: [0x3a6ea5, 0x9b2c2c, 0x2f6b4e][Math.floor(Math.random() * 3)], accent: 0xf4eedf, hair: 'short' });
      } else if (kind === 'taxi') {
        // the yellow Ambassador (shared model with the parked taxis)
        for (const p of ambassadorParts()) {
          const m = new THREE.Mesh(p.geo, p.mat);
          m.applyMatrix4(p.m);
          m.castShadow = p.shadow;
          body.add(m);
        }
        for (const [x, z] of WHEELS) {
          const w = new THREE.Group();
          for (const p of wheelParts()) w.add(new THREE.Mesh(p.geo, p.mat));
          w.position.set(x, WHEEL_R, z);
          g.add(w);
          wheels.push(w);
        }
      } else if (kind === 'auto') {
        // Kolkata auto: green lower body, yellow upper, a black canvas roof on a tubular frame,
        // a tapered nose with one round headlamp and a handlebar, the driver up front and a bench
        // seat behind; one front wheel, two rear
        radius = 0.26;
        const green = toon(0x2f7d3a, { paint: false }), yel = toon(0xf2c230, { paint: false }), canvas = toon(0x1e1e26, { paint: false }), chrome = toon(0xc8ccd0, { paint: false });
        const part = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, rz = 0) => {
          const o = new THREE.Mesh(geo, m);
          o.position.set(x, y, z);
          o.scale.set(sx, sy, sz);
          o.rotation.set(rx, 0, rz);
          o.castShadow = true;
          body.add(o);
        };
        const sph = new THREE.SphereGeometry(1, 14, 10), cylg = new THREE.CylinderGeometry(1, 1, 1, 10);
        part(sph, green, 0, 0.62, -0.35, 0.68, 0.32, 1.0); // rounded tub
        part(sph, green, 0, 0.66, 0.65, 0.42, 0.42, 0.5); // tapered nose
        part(sph, yel, 0, 0.98, 0.72, 0.36, 0.22, 0.32); // nose cowl
        part(cylg, chrome, 0, 0.9, 1.06, 0.1, 0.05, 0.1, Math.PI / 2); // headlamp rim
        part(cylg, glow(0xfff1c4, 2.2), 0, 0.9, 1.09, 0.08, 0.03, 0.08, Math.PI / 2);
        part(cylg, toon(0x2a2a2a, { paint: false }), 0, 1.3, 0.55, 0.025, 0.7, 0.025, 0, Math.PI / 2); // handlebar
        part(new THREE.BoxGeometry(1, 1, 1), toon(0x9ab8c8, { paint: false }), 0, 1.42, 0.62, 1.05, 0.5, 0.04, -0.25); // windscreen
        for (const sd of [-1, 1]) {
          part(new THREE.BoxGeometry(1, 1, 1), yel, sd * 0.62, 1.12, -0.45, 0.05, 0.45, 1.2); // yellow side panels
          part(cylg, chrome, sd * 0.62, 1.5, 0.55, 0.025, 0.9, 0.025); // roof frame posts
          part(cylg, chrome, sd * 0.62, 1.5, -1.05, 0.025, 0.9, 0.025);
        }
        part(new THREE.BoxGeometry(1, 1, 1), canvas, 0, 1.96, -0.25, 1.34, 0.1, 1.9); // canvas roof
        part(sph, canvas, 0, 2.0, -0.25, 0.67, 0.1, 0.95);
        part(new THREE.BoxGeometry(1, 1, 1), canvas, 0, 1.6, -1.12, 1.3, 0.75, 0.05); // canvas wrapped down the back…
        part(new THREE.BoxGeometry(1, 1, 1), toon(0x9ab8c8, { paint: false }), 0, 1.68, -1.15, 0.5, 0.22, 0.02); // …with a little rear window
        for (const sd of [-1, 1]) part(new THREE.BoxGeometry(1, 1, 1), canvas, sd * 0.64, 1.72, -0.75, 0.04, 0.5, 0.75); // rear side curtains
        part(new THREE.BoxGeometry(1, 1, 1), yel, 0, 0.95, -1.12, 1.3, 0.3, 0.06); // yellow tail panel
        for (const sd of [-1, 1]) part(new THREE.BoxGeometry(1, 1, 1), glow(0xff3030, 1.6), sd * 0.5, 0.95, -1.16, 0.12, 0.1, 0.02);
        part(new THREE.BoxGeometry(1, 1, 1), toon(0x3a2a1a, { paint: false }), 0, 0.98, -0.65, 1.1, 0.15, 0.55); // rear bench
        part(new THREE.BoxGeometry(1, 1, 1), toon(0x3a2a1a, { paint: false }), 0, 1.3, -0.95, 1.1, 0.5, 0.1);
        wheel(0, 0.95, 0.26);
        wheel(-0.6, -0.85, 0.26);
        wheel(0.6, -0.85, 0.26);
        seat(1.0, 0.2, { style: 'shirt', color: [0xf4eedf, 0x3a6ea5, 0x9b2c2c][Math.floor(Math.random() * 3)], accent: 0x2f6b4e, hair: 'short', pants: 0x5a6a7a });
      } else {
        // Kolkata tram: cream upper body over a green skirt, rounded ends, a row of window bays
        // with vertical bars and warm interior light, a domed roof with ventilator, a destination
        // board, a driver at the front, two bogies on the rails and the trolley pole to the wire
        radius = 0.33;
        const green = toon(0x2f6b4e, { paint: false }), cream = toon(0xefe3c2, { paint: false }), dark = toon(0x22242a, { paint: false });
        const warm = glow(0xffd99a, 1.25), barM = toon(0x3a3a40, { paint: false });
        box(2.4, 1.0, 8.6, green, 1.1); // lower skirt
        box(2.42, 0.08, 8.62, cream, 1.62); // waist band
        box(2.4, 1.2, 8.6, cream, 2.25); // upper body
        for (const ez of [-1, 1]) {
          // rounded ends with a three-pane windscreen and a headlamp
          const end = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.2, 18), cream);
          end.position.set(0, 1.75, ez * 4.3);
          end.scale.set(1, 1, 0.45);
          end.castShadow = true;
          body.add(end);
          // windscreen panes following the curved end
          for (const wx of [-0.66, 0, 0.66]) {
            const pane = box(0.55, 0.65, 0.04, toon(0x26303a, { paint: false }), 2.3, ez * (4.3 + 0.45 * Math.sqrt(1.44 - wx * wx) + 0.03));
            pane.position.x = wx;
            pane.rotation.y = -ez * Math.atan2(wx * 0.45, Math.sqrt(1.44 - wx * wx)) * 1.2;
          }
          box(0.3, 0.2, 0.05, glow(0xfff1c4, 2.0), 1.15, ez * (4.3 + 0.54 + 0.03));
          // destination board above the windscreen
          box(1.2, 0.26, 0.05, glow(0xffe9b0, 1.3), 2.85, ez * (4.3 + 0.54 + 0.04));
        }
        // window bays with bars along both sides
        for (const sd of [-1, 1])
          for (let k = 0; k < 8; k++) {
            const z = -3.5 + k * 1.0;
            box(0.04, 0.7, 0.78, warm, 2.3, z).position.x = sd * 1.21;
            for (let q = 0; q < 4; q++) box(0.03, 0.72, 0.03, barM, 2.3, z - 0.3 + q * 0.2).position.x = sd * 1.23;
          }
        // domed roof with a raised ventilator
        const roofG = new THREE.CylinderGeometry(1.22, 1.22, 8.6, 20);
        roofG.rotateX(Math.PI / 2);
        const roof = new THREE.Mesh(roofG, green);
        roof.scale.set(1, 0.28, 1);
        roof.position.set(0, 2.85, 0);
        roof.castShadow = true;
        body.add(roof);
        box(1.0, 0.18, 6.5, cream, 3.25);
        box(2.0, 0.25, 8.4, dark, 0.55); // underframe
        for (const bz of [-2.8, 2.8]) {
          box(1.6, 0.35, 2.2, dark, 0.42, bz, g);
          for (const az of [-0.7, 0.7]) for (const ax of [-0.75, 0.75]) wheel(ax, bz + az, 0.33);
        }
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.4), dark);
        pole.position.set(0, 4.55, -1.6);
        pole.rotation.x = -0.55;
        body.add(pole);
        seat(1.5, 3.7, { style: 'shirt', color: 0x3a6ea5, accent: 0xf4eedf, hair: 'short', pants: 0x2e3550 });
      }
      // collapse the many coloured parts into one vertex-coloured mesh per group (body, each wheel):
      // ~2 draw calls per vehicle body instead of dozens
      mergeParts(body);
      for (const w of wheels) mergeParts(w);
      g.traverse((o) => (o.frustumCulled = false));
      this.root.add(g);
      return { g, wheels, radius, rider };
    };
    /**
     * Closed loop: lane on the left side out, back on the other lane (driving on the left, as in
     * India), U-turning at the ends. Traffic never enters a pandal's grounds: a road that runs into
     * one is cut short there. Where a lane would touch anything solid (a gate, a pole, a parked car,
     * a stall) it eases sideways within its own half of the road; if there's no room, the route
     * turns back before it.
     */
    const ROUTE_R = 0.95; // half a car's width plus a little air
    const blocked = (x: number, z: number) => {
      if (PANDALS.some((pd) => Math.hypot(pd.x - x, pd.z - z) < pd.radius + 1)) return true;
      const r = world.colliders.resolve(x, z, ROUTE_R);
      return Math.hypot(r.x - x, r.z - z) > 0.02;
    };
    const loop = (road: RoadSample, lane: number) => {
      // check the lane every metre (road samples are 2 m apart)
      const s = { road: road.road, pts: [] as THREE.Vector3[], normals: [] as THREE.Vector3[] };
      road.pts.forEach((p, i) => {
        s.pts.push(p);
        s.normals.push(road.normals[i]);
        if (i < road.pts.length - 1) {
          s.pts.push(p.clone().lerp(road.pts[i + 1], 0.5));
          s.normals.push(road.normals[i].clone().add(road.normals[i + 1]).normalize());
        }
      });
      const n = s.pts.length;
      const half = s.road.width / 2;
      // lateral offset for each sample on one side (sign ±1), or NaN where nothing fits
      const sideOffsets = (sign: number) => {
        const d = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const p = s.pts[i], nm = s.normals[i];
          const at = (o: number) => !blocked(p.x + nm.x * o, p.z + nm.z * o);
          let best = NaN;
          if (at(sign * lane)) best = sign * lane;
          else
            for (let k = 1; k <= 12 && Number.isNaN(best); k++)
              for (const dir of [-1, 1]) {
                const o = sign * (lane + dir * k * 0.25);
                if (Math.abs(o) < 0.9 || Math.abs(o) > half - 0.6) continue; // stay in our own half
                if (at(o)) {
                  best = o;
                  break;
                }
              }
          d[i] = best;
        }
        // ease into and out of each swerve over ~10 m so the car doesn't jink
        const out = new Float32Array(n);
        const W = 10;
        for (let i = 0; i < n; i++) {
          if (Number.isNaN(d[i])) {
            out[i] = NaN;
            continue;
          }
          let shift = 0;
          for (let j = Math.max(0, i - W); j <= Math.min(n - 1, i + W); j++) {
            if (Number.isNaN(d[j])) continue;
            const sh = (d[j] - sign * lane) * (1 - Math.abs(i - j) / (W + 1));
            if (Math.abs(sh) > Math.abs(shift)) shift = sh;
          }
          out[i] = sign * lane + shift;
        }
        return out;
      };
      const L = sideOffsets(1), R = sideOffsets(-1);
      // the longest stretch where both lanes are drivable
      let a = 0, b = -1, start = 0;
      for (let i = 0; i <= n; i++) {
        const ok = i < n && !Number.isNaN(L[i]) && !Number.isNaN(R[i]);
        if (!ok) {
          if (i - 1 - start > b - a) {
            a = start;
            b = i - 1;
          }
          start = i + 1;
        }
      }
      const pt = (i: number, o: number) => s.pts[i].clone().addScaledVector(s.normals[i], o);
      const out: THREE.Vector3[] = [], back: THREE.Vector3[] = [];
      for (let i = a; i <= b; i++) out.push(pt(i, L[i]));
      for (let i = b; i >= a; i--) back.push(pt(i, R[i]));
      return [...out, ...back, out[0].clone()];
    };
    const tramLine = (s: RoadSample) => [...s.pts.map((p) => p.clone()), ...s.pts.map((p) => p.clone()).reverse().slice(1)];
    const road = (id: string) => world.roads.find((r) => r.road.id === id)!;
    const add = (v: ReturnType<typeof mk>, path: THREE.Vector3[], t: number, speed: number, tram = false) =>
      this.vehicles.push({ g: v.g, wheels: v.wheels, radius: v.radius, path, t, speed, cur: 0, tram, flip: false, rider: v.rider, blocked: 0, honkCd: 0, pedal: speed < 3 });
    add(mk('tram'), tramLine(road('bodhon-sarani')), 10, 3.0, true);
    const main = loop(road('bodhon-sarani'), 3.2);
    add(mk('taxi'), main, 20, 7);
    add(mk('taxi'), main, 95, 6.5);
    add(mk('auto'), main, 150, 6);
    add(mk('taxi'), main, 210, 7);
    const ghatL = loop(road('ghat-road'), 2.6);
    add(mk('taxi'), ghatL, 15, 6);
    add(mk('auto'), ghatL, 90, 5.5);
    const central = loop(road('central-street'), 2.6);
    add(mk('taxi'), central, 30, 6);
    add(mk('auto'), central, 100, 5.5);
    const east = loop(road('east-street'), 2.6);
    add(mk('taxi'), east, 60, 6.5);
    add(mk('auto'), east, 5, 5);
    const west = loop(road('west-street'), 2.0);
    add(mk('auto'), west, 40, 5);
    // cycle-rickshaws dawdle on the lanes nearest the curb, motorbikes weave in between
    add(mk('rickshaw'), loop(road('bodhon-sarani'), 4.6), 60, 2.4);
    add(mk('rickshaw'), loop(road('central-street'), 3.6), 70, 2.2);
    add(mk('rickshaw'), loop(road('ghat-road'), 3.4), 50, 2.3);
    add(mk('rickshaw'), west, 110, 2.1);
    add(mk('bike'), main, 130, 8.5);
    add(mk('bike'), central, 140, 8);
    add(mk('bike'), east, 120, 8);
    add(mk('auto'), main, 250, 6);
    // a busy Pujo night: more taxis, autos, rickshaws and bikes, spread out along each loop
    // (all of them on High, half on Medium, none on Low: each car is several draw calls)
    const share = quality === 'high' ? 1 : quality === 'medium' ? 0.5 : 0;
    const more = (path: THREE.Vector3[], kinds: ('taxi' | 'auto' | 'rickshaw' | 'bike')[], phase: number) =>
      kinds.slice(0, Math.round(kinds.length * share)).forEach((k, i, arr) => add(mk(k), path, ((phase + (i + 0.5) / arr.length) % 1) * (path.length - 1), k === 'rickshaw' ? 2.2 : k === 'bike' ? 8 : k === 'auto' ? 5.5 : 6.5));
    more(main, ['taxi', 'auto', 'taxi', 'bike', 'auto'], 0.07);
    more(ghatL, ['taxi', 'bike', 'auto'], 0.31);
    more(central, ['taxi', 'auto', 'bike'], 0.53);
    more(east, ['auto', 'taxi', 'rickshaw'], 0.19);
    more(west, ['taxi', 'bike'], 0.71);
  }

  /** Called when a held-up vehicle sounds its horn (world position). */
  onHonk: ((p: THREE.Vector3, kind: 'car' | 'bike' | 'bell') => void) | null = null;

  update(dt: number, t: number, player: THREE.Vector3, energy = 1, peds: THREE.Vector3[] = []) {
    for (const b of this.beams) {
      const a = t * 0.35 + b.ph;
      b.pivot.rotation.set(Math.sin(a) * 0.38, a * 0.6, Math.cos(a * 1.3) * 0.38);
      b.mat.uniforms.uAlpha.value = 0.16 * energy;
    }
    for (const bd of this.boards) {
      const bp = bd.pos;
      bd.im.visible = Math.hypot(bp.x - player.x, bp.z - player.z) < 75;
      if (!bd.im.visible) continue;
      // colour waves ripple through each motif's segments
      const n = bd.groups.length;
      for (let i = 0; i < n; i++) {
        const k = Math.floor(t * 2.2 + bd.ph + bd.groups[i] * 0.7 + (i % 7) * 0.02);
        const c = bd.palette[((k % bd.palette.length) + bd.palette.length) % bd.palette.length];
        const pulse = 0.65 + 0.35 * Math.max(0, Math.sin(t * 6 + i * 0.35 + bd.ph));
        this.tmpC.copy(c).multiplyScalar(2.4 * pulse * energy);
        bd.im.setColorAt(i, this.tmpC);
      }
      bd.im.instanceColor!.needsUpdate = true;
    }
    for (const v of this.vehicles) {
      const n = v.path.length;
      const i = Math.floor(v.t) % (n - 1);
      const f = v.t - Math.floor(v.t);
      const here = new THREE.Vector3().lerpVectors(v.path[i], v.path[i + 1], f);
      const dir = v.path[i + 1].clone().sub(v.path[i]);
      const seg = dir.length() || 1;
      dir.divideScalar(seg);
      // brake for the player or for a vehicle just ahead in the same direction
      const toP = new THREE.Vector3(player.x - here.x, 0, player.z - here.z);
      const byPlayer = toP.length() < 8 && toP.dot(dir) > 0 && Math.abs(toP.x * dir.z - toP.z * dir.x) < 2.2;
      let blocked = byPlayer;
      // pedestrians who wander onto the road
      for (const q of peds) {
        if (blocked) break;
        const dx = q.x - here.x, dz = q.z - here.z;
        if (dx * dx + dz * dz < 36 && dx * dir.x + dz * dir.z > 0.5 && Math.abs(dx * dir.z - dz * dir.x) < 1.4) blocked = true;
      }
      // honk at the player when held up (Kolkata!)
      v.honkCd -= dt;
      v.blocked = byPlayer && toP.length() < 8 ? v.blocked + dt : 0;
      if (v.blocked > 1.2 && v.honkCd <= 0 && !v.tram) {
        v.honkCd = 4 + Math.random() * 3;
        this.onHonk?.(here.clone(), v.pedal ? 'bell' : v.radius < 0.34 ? 'bike' : 'car');
      }
      for (const o of this.vehicles) {
        if (o === v || blocked) continue;
        const d = o.g.position.clone().sub(here);
        if (d.length() < 7 && d.dot(dir) > 1 && Math.abs(d.x * dir.z - d.z * dir.x) < 1.6) blocked = true;
      }
      const target = blocked ? 0 : v.speed;
      v.cur += Math.sign(target - v.cur) * Math.min(Math.abs(target - v.cur), (blocked ? 9 : 2.5) * dt);
      const step = v.cur * dt;
      v.t += step / seg;
      if (v.t >= n - 1) v.t -= n - 1;
      v.g.position.copy(here);
      v.g.visible = Math.hypot(here.x - player.x, here.z - player.z) < 75;
      // steer smoothly toward the heading a few metres ahead
      const j = Math.min(n - 1, i + 2);
      const ahead = v.path[j].clone().sub(here);
      const yaw = Math.atan2(ahead.x, ahead.z);
      let dy = yaw - v.g.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      v.g.rotation.y += dy * Math.min(1, dt * (v.tram ? 2 : 4));
      // wheels roll: angle = distance / radius
      for (const w of v.wheels) w.rotation.x += step / v.radius;
      if (v.rider && v.g.visible) v.rider.update(dt, 0, 0);
    }
  }
}
