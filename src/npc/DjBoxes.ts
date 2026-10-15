/**
 * Para DJ boxes: in an open patch of ground just outside each pandal, a medium speaker cube with
 * LED edges, a glowing dance floor and swinging coloured spots, with a ring of 5–6 people dancing
 * along (party dancing, folk "nach", clapping; the dhunuchi naach belongs to the pandals and the dhak). Music comes from AudioEngine DJ
 * channels — the player's own song files if present, otherwise original generated tracks — and
 * every light and dancer pulses with what that box is actually playing.
 */
import * as THREE from 'three';
import { Character, type Look, type Pose } from '../player/Character';
import { makeProp } from '../player/Actions';
import { bend, toon } from '../rendering/materials';
import { PANDALS } from '../data/pandals';
import { PLAZAS, FINALE_POINT, PODIUMS, groundHeight } from '../data/layout';
import type { World } from '../world/World';
import type { AudioEngine } from '../audio/AudioEngine';
import type { InteractionSystem } from '../interactions/InteractionSystem';
import type { UI } from '../ui/UI';
import type { PlayerActions } from '../player/Actions';
import { Rng } from '../utils/rng';
import { toPlanet } from '../utils/planet';

interface Box {
  x: number;
  z: number;
  group: THREE.Group;
  dj: Character;
  leds: THREE.MeshBasicMaterial[];
  floor: THREE.MeshBasicMaterial;
  spots: { pivot: THREE.Group; ph: number }[];
  dancers: { ch: Character; ang: number; r: number; spin: number }[];
  announced: number;
  pandal: string;
}

/** Total DJ dance areas in the city. */
export const DJ_COUNT = 12;

const LED = [0xff2d9a, 0x2de8ff, 0xffd23c, 0x8aff4a, 0xb05aff, 0xff6a1a];

export class DjBoxes {
  root = new THREE.Group();
  boxes: Box[] = [];
  private rng: Rng;

  constructor(private world: World, seed: number) {
    this.rng = new Rng(seed * 31 + 7);
    // 1) the open plazas (most are a short walk from a pandal); Sunrise Ghat stays calm for the finale
    for (const pl of PLAZAS) {
      if (Math.hypot(pl.x - FINALE_POINT.x, pl.z - FINALE_POINT.z) < 20) continue;
      const near = [...PANDALS].sort((a, b) => Math.hypot(a.x - pl.x, a.z - pl.z) - Math.hypot(b.x - pl.x, b.z - pl.z))[0];
      // plaza centres are road junctions: use a corner of the plaza that is off the carriageways
      let spot: { x: number; z: number } | null = null;
      for (let k = 0; k < 48 && !spot; k++) {
        const a = (k / 12) * Math.PI * 2 + 0.26, rr = 5 + Math.floor(k / 12) * 2.5;
        const x = pl.x + Math.cos(a) * rr, z = pl.z + Math.sin(a) * rr;
        if (this.world.field.clearance(x, z) > 3.2 && this.clearAt(x, z, 3.0)) spot = { x, z };
      }
      if (spot) this.build(spot.x, spot.z, Math.atan2(near.x - spot.x, near.z - spot.z), near.id);
    }
    // 2) any pandal still without music nearby gets a box in open ground outside its gate
    for (const p of PANDALS) {
      if (this.boxes.some((b) => Math.hypot(b.x - p.x, b.z - p.z) < p.radius + 30)) continue;
      const spot = this.findSpot(p.x, p.z, p.radius, p.facing);
      if (spot) this.build(spot.x, spot.z, spot.yaw, p.id);
    }
    // 3) fill up to DJ_COUNT with open roadside ground, always choosing the spot farthest from
    //    existing boxes so the dance areas spread across the whole city
    const cands: { x: number; z: number; yaw: number }[] = [];
    for (const sm of this.world.roads) {
      if (sm.road.kind === 'lane') continue;
      for (let i = 0; i < sm.pts.length; i += 3)
        for (const side of [1, -1]) {
          const off = sm.road.width / 2 + 4.2;
          const x = sm.pts[i].x + sm.normals[i].x * side * off, z = sm.pts[i].z + sm.normals[i].z * side * off;
          if (z > 96 || Math.hypot(x, z) > 170) continue;
          if (Math.hypot(x - FINALE_POINT.x, z - FINALE_POINT.z) < 25) continue;
          if (PANDALS.some((o) => Math.hypot(o.x - x, o.z - z) < o.radius + 16)) continue;
          if (this.world.field.clearance(x, z) < 3.2 || !this.clearAt(x, z, 3.0)) continue;
          cands.push({ x, z, yaw: Math.atan2(-sm.normals[i].x * side, -sm.normals[i].z * side) });
        }
    }
    while (this.boxes.length < DJ_COUNT && cands.length) {
      let best = -1, bestD = 0;
      cands.forEach((c, k) => {
        const d = Math.min(...this.boxes.map((b) => Math.hypot(b.x - c.x, b.z - c.z)));
        if (d > bestD) {
          bestD = d;
          best = k;
        }
      });
      if (best < 0 || bestD < 36) break;
      const c = cands.splice(best, 1)[0];
      const near = [...PANDALS].sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))[0];
      this.build(c.x, c.z, c.yaw, near.id);
    }
  }

  /**
   * A round stone podium over the ghat steps, its top level with the promenade (y = 0): a slab
   * on a plinth that runs down into the steps, a balustrade hung with marigolds on the river side
   * (open toward the promenade, where you walk on), and colliders along the balustrade.
   */
  private podium(g: THREE.Group, x: number, z: number) {
    const R = 6.8;
    PODIUMS.push({ x, z, r: R, top: 0 });
    const stone = toon(0xc2b196), plinthM = toon(0x9a8a72), trim = toon(0xe6dcc6), rail = toon(0xd8ccb2);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, lx: number, ly: number, lz: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(lx, ly, lz);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      return m;
    };
    add(new THREE.CylinderGeometry(R, R, 0.22, 48), stone, 0, -0.1, 0);
    add(new THREE.CylinderGeometry(R - 0.15, R - 0.4, 3.2, 48, 1, true), plinthM, 0, -1.8, 0);
    add(new THREE.TorusGeometry(R, 0.08, 6, 64), trim, 0, 0.0, 0).rotation.x = Math.PI / 2;
    // balustrade along the river side only (world z beyond the podium centre)
    const inv = new THREE.Matrix4().makeRotationY(-g.rotation.y);
    const post = new THREE.CylinderGeometry(0.07, 0.09, 0.75, 8);
    const bloom = new THREE.SphereGeometry(0.07, 8, 6);
    const marigold = [toon(0xf6a21e), toon(0xf2c14e)];
    const N = 56;
    let prev: THREE.Vector3 | null = null;
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2;
      const wx = Math.sin(a) * (R - 0.2), wz = Math.cos(a) * (R - 0.2);
      if (wz < 1.2) {
        prev = null;
        continue; // the promenade side stays open
      }
      const lp = new THREE.Vector3(wx, 0, wz).applyMatrix4(inv); // world offset → group-local
      add(post, rail, lp.x, 0.38, lp.z);
      this.world.colliders.addCircle(x + wx, z + wz, 0.32, 1);
      if (prev) {
        const mid = prev.clone().add(lp).multiplyScalar(0.5), len = prev.distanceTo(lp);
        const bar = add(new THREE.BoxGeometry(0.1, 0.08, len), rail, mid.x, 0.78, mid.z);
        bar.rotation.set(0, Math.atan2(lp.x - prev.x, lp.z - prev.z), 0);
        if (k % 2) add(bloom, marigold[k % 4 === 1 ? 0 : 1], mid.x, 0.66, mid.z); // marigold garland
      }
      prev = lp;
    }
  }

  /** True if no collider (building, stall, post, tree…) lies within `clear` metres. */
  private clearAt(x: number, z: number, clear: number) {
    return !this.world.colliders.near(x, z, clear + 6).some((c) => {
      if (c.kind === 'circle') return Math.hypot(c.x - x, c.z - z) < c.r + clear;
      // distance from point to the oriented box
      const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
      const wx = x - c.x, wz = z - c.z;
      const lx = wx * cs - wz * sn, lz = wx * sn + wz * cs;
      const dx = Math.max(0, Math.abs(lx) - c.hw), dz = Math.max(0, Math.abs(lz) - c.hd);
      return Math.hypot(dx, dz) < clear;
    });
  }

  /** Search the ground around a pandal's front for a ~9 m wide clear patch near the road. */
  private findSpot(px: number, pz: number, R: number, facing: number) {
    let best: { x: number; z: number; yaw: number; score: number } | null = null;
    for (let k = 0; k < 400; k++) {
      const a = facing + this.rng.range(-1.6, 1.6);
      const d = R + this.rng.range(16, 34);
      const x = px + Math.sin(a) * d, z = pz + Math.cos(a) * d;
      if (z > 96 || Math.hypot(x, z) > 175) continue;
      if (!this.clearAt(x, z, 3.4)) continue;
      if (PANDALS.some((o) => Math.hypot(o.x - x, o.z - z) < o.radius + 3)) continue;
      const roadGap = this.world.field.clearance(x, z);
      if (roadGap < 3.2) continue; // keep the dance floor off the carriageway (traffic!)
      // prefer close to the pandal and close to (but not on) a road
      const score = d + Math.abs(roadGap - 3) * 0.6;
      if (!best || score < best.score) best = { x, z, yaw: Math.atan2(px - x, pz - z), score };
    }
    return best;
  }

  private build(x: number, z: number, yaw: number, pandal: string) {
    // keep boxes at least 50 m apart, so the music zones don't overlap
    // zones are 15 m in radius: keep boxes far enough apart that zones never overlap
    if (this.boxes.length >= DJ_COUNT || this.boxes.some((b) => Math.hypot(b.x - x, b.z - z) < 36)) return;
    // …and a DJ zone must never reach into a pandal's grounds (inside a pandal you hear its dhak)
    if (PANDALS.some((o) => Math.hypot(o.x - x, o.z - z) < o.radius + 16)) return;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    // on the ghat steps the dance floor would hang in the air: build a stone podium level with the
    // riverside promenade, jutting out over the steps
    let low = 0;
    for (let k = 0; k < 24; k++) for (const rr of [3, 6.5]) low = Math.min(low, groundHeight(x + Math.sin((k / 24) * Math.PI * 2) * rr, z + Math.cos((k / 24) * Math.PI * 2) * rr));
    if (low < -0.05) this.podium(g, x, z);
    const S = 1.5; // medium cube
    const body = new THREE.Mesh(new THREE.BoxGeometry(S, S, S), toon(0x1c1a22, { paint: false }));
    body.position.y = S / 2;
    body.castShadow = true;
    g.add(body);
    // speaker cones on all four faces (woofer + tweeter)
    const cone = new THREE.CylinderGeometry(0.42, 0.3, 0.08, 24);
    const tw = new THREE.CylinderGeometry(0.16, 0.12, 0.08, 18);
    for (let f = 0; f < 4; f++) {
      const ry = (f * Math.PI) / 2;
      const nx = Math.sin(ry), nz = Math.cos(ry);
      for (const [geo, y, mat] of [[cone, 0.55, toon(0x3a3640, { paint: false })], [tw, 1.18, toon(0x55505c, { paint: false })]] as const) {
        const m = new THREE.Mesh(geo, mat);
        m.rotation.set(Math.PI / 2, 0, 0);
        const holder = new THREE.Group();
        holder.rotation.y = ry;
        m.position.set(0, y, S / 2 + 0.02);
        holder.add(m);
        g.add(holder);
      }
      void nx;
      void nz;
    }
    // LED edge strips (12 edges), each its own colour, animated
    const leds: THREE.MeshBasicMaterial[] = [];
    const edge = (w: number, h: number, d: number, px: number, py: number, pz: number, i: number) => {
      const mat = bend(new THREE.MeshBasicMaterial({ color: new THREE.Color(LED[i % LED.length]).multiplyScalar(3) })) as THREE.MeshBasicMaterial;
      leds.push(mat);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(px, py, pz);
      g.add(m);
    };
    const e = S / 2 + 0.01, th = 0.05;
    let i = 0;
    for (const y of [0.02, S]) for (const [a, b] of [[e, 0], [-e, 0]]) edge(th, th, S, a, y, b, i++);
    for (const y of [0.02, S]) for (const [a, b] of [[0, e], [0, -e]]) edge(S, th, th, a, y, b, i++);
    for (const [a, b] of [[e, e], [e, -e], [-e, e], [-e, -e]]) edge(th, S, th, a, S / 2, b, i++);
    // DJ deck + laptop on top, and a little marigold garland (it's Pujo, after all)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.5), toon(0x2a2a30, { paint: false }));
    deck.position.set(0, S + 0.05, 0);
    g.add(deck);
    for (let k = 0; k < 2; k++) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 20), toon(0x111111, { paint: false }));
      disc.position.set(k ? 0.28 : -0.28, S + 0.12, 0);
      g.add(disc);
    }
    for (let k = 0; k < 10; k++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), toon(k % 2 ? 0xf6a21e : 0xffc93c, { paint: false }));
      const a = (k / 9) * Math.PI;
      m.position.set(-0.7 + (k / 9) * 1.4, S - 0.05 - Math.sin(a) * 0.18, S / 2 + 0.06);
      g.add(m);
    }
    // tall speaker stacks either side (three cabinets each, woofers facing the floor) and the DJ
    // behind the deck on a little riser, working the mixer
    const cab = toon(0x1c1a22, { paint: false }), coneM = toon(0x3a3640, { paint: false });
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.55), cab);
        c.position.set(sx * 1.25, 0.35 + k * 0.72, -0.15);
        c.castShadow = true;
        g.add(c);
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.05, 20), coneM);
        w.rotation.x = Math.PI / 2;
        w.position.set(sx * 1.25, 0.35 + k * 0.72, 0.14);
        g.add(w);
      }
      edge(0.64, 0.04, 0.04, sx * 1.25, 2.18, 0.13, i++); // LED strip on top
    }
    const riser = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.9), toon(0x2a2a30, { paint: false }));
    riser.position.set(0, 0.225, -1.25);
    g.add(riser);
    const dj = new Character({ style: 'tee', color: this.rng.pick([0x1a1a20, 0xb3121f, 0x2f6b8a]), accent: 0xff2d9a, hair: 'short', skin: 0xb5764f, pants: 0x2a3a5a }, true);
    dj.group.position.set(0, 0.45, -1.15);
    dj.pose = 'drum';
    g.add(dj.group);
    // glowing dance floor
    const floorMat = bend(new THREE.MeshBasicMaterial({ color: 0xff2d9a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })) as THREE.MeshBasicMaterial;
    const floor = new THREE.Mesh(new THREE.RingGeometry(1.0, 4.6, 48, 3).rotateX(-Math.PI / 2), floorMat);
    floor.position.y = 0.06;
    floor.renderOrder = 2;
    g.add(floor);
    // two swinging coloured spotlights on stands
    const spots: Box['spots'] = [];
    const beamGeo = new THREE.ConeGeometry(1.4, 7, 18, 1, true);
    beamGeo.translate(0, -3.5, 0);
    beamGeo.rotateX(Math.PI); // apex at the lamp, beam fanning up into the night
    for (const sx of [-1, 1]) {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 2.6), toon(0x2a2a30, { paint: false }));
      stand.position.set(sx * 3.2, 1.3, -1.2);
      g.add(stand);
      const pivot = new THREE.Group();
      pivot.position.set(sx * 3.2, 2.6, -1.2);
      const beam = new THREE.Mesh(
        beamGeo,
        bend(new THREE.MeshBasicMaterial({ color: new THREE.Color(sx > 0 ? 0x2de8ff : 0xff2d9a).multiplyScalar(0.5), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
      );
      pivot.add(beam);
      g.add(pivot);
      spots.push({ pivot, ph: this.rng.range(0, 6) });
    }
    // merge every static, solid part into the world's static batches (one draw call per cell)
    // instead of ~40 separate meshes per DJ spot; animated LEDs, floor, beams and people stay live
    g.updateMatrixWorld(true);
    const bake: THREE.Mesh[] = [];
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh) return;
      if (!(m.material as THREE.Material & { isMeshToonMaterial?: boolean }).isMeshToonMaterial) return;
      let p: THREE.Object3D | null = m.parent;
      while (p && p !== g) {
        if (p === dj.group) return;
        p = p.parent;
      }
      bake.push(m);
    });
    for (const m of bake) {
      this.world.batch.add(m.geometry, m.material as THREE.Material, m.matrixWorld.clone(), { shadow: m.castShadow });
      m.parent!.remove(m);
    }
    g.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.frustumCulled = false) : 0));
    this.root.add(g);
    this.world.colliders.addCircle(x, z, 1.15, 1.8);
    // the dancers
    const dancers: Box['dancers'] = [];
    // a busy floor: inner ring (dancing + folk nach), outer ring dancing the other way, and a
    // loose crowd of spectators clapping, waving and filming on their phones
    const skins = [0xc98a62, 0xb5764f, 0xd9a07a, 0x9a6444, 0xe0b08a];
    const R = this.rng;
    const man = (): Look => ({ style: R.chance(0.65) ? 'kurta' : 'shirt', color: R.pick([0xf4eedf, 0xf2c14e, 0xe8743a, 0xfaf6ea, 0x3a6ea5, 0x9b2c2c, 0x7a3e9d]), accent: R.pick([0xb3121f, 0xd4af37]), hair: 'short', skin: R.pick(skins), pants: R.pick([0xf4eedf, 0x2e3550]) });
    const woman = (): Look => ({ style: 'sari', color: R.pick([0xf4eedf, 0xb3121f, 0xf6a21e, 0xd94f7a, 0x2f6b4e, 0x1a5fb4, 0x7a3e9d]), accent: R.pick([0xb3121f, 0xd4af37]), hair: R.pick(['bun', 'braid']), skin: R.pick(skins) });
    const kid = (): Look => (R.chance(0.5) ? { style: 'frock', color: R.pick([0xf2c14e, 0x5ec2d8, 0xd94f7a, 0xb6f08a]), accent: 0xffffff, hair: 'braid', skin: R.pick(skins), scale: 0.66 } : { style: 'kurta', color: R.pick([0xf2c14e, 0xe8743a]), accent: 0xb3121f, hair: 'short', skin: R.pick(skins), scale: 0.64 });
    const plan: { look: Look; pose: Pose; ring: 0 | 1 | 2 }[] = [];
    const inner = R.int(5, 6), outer = R.int(5, 6), crowd = R.int(4, 6);
    for (let k = 0; k < inner; k++) plan.push(k % 2 ? { look: woman(), pose: 'nach', ring: 0 } : { look: man(), pose: 'dance', ring: 0 });
    for (let k = 0; k < outer; k++) {
      const r = k % 3;
      plan.push(r === 0 ? { look: woman(), pose: 'nach', ring: 1 } : r === 1 ? { look: man(), pose: 'dance', ring: 1 } : { look: kid(), pose: R.chance(0.5) ? 'dance' : 'clap', ring: 1 });
    }
    for (let k = 0; k < crowd; k++) plan.push({ look: R.chance(0.5) ? woman() : R.chance(0.7) ? man() : kid(), pose: R.pick(['clap', 'clap', 'photo', 'wave', 'dance'] as Pose[]), ring: 2 });
    const counts = [inner, outer, crowd];
    const idx = [0, 0, 0];
    plan.forEach((l) => {
      const ch = new Character(l.look, true);
      ch.pose = l.pose;
      ch.tempo = R.range(0.9, 1.12);
      if (l.pose === 'photo') ch.setProp(makeProp('phone')); // filming the dance on a phone
      this.root.add(ch.group);
      const i = idx[l.ring]++;
      const n = counts[l.ring];
      const radius = [2.2, 3.6, 5.3][l.ring] + R.range(-0.25, 0.25);
      const spin = l.ring === 0 ? R.range(0.16, 0.22) : l.ring === 1 ? -R.range(0.1, 0.15) : 0;
      dancers.push({ ch, ang: (i / n) * Math.PI * 2 + l.ring * 0.4 + R.range(-0.15, 0.15), r: radius, spin });
    });
    this.boxes.push({ x, z, group: g, leds, floor: floorMat, spots, dancers, announced: -999, pandal, dj });
  }

  /** Hook up audio channels and E-to-change-song interactions. */
  register(audio: AudioEngine, sys: InteractionSystem, ui: UI, actions: PlayerActions) {
    audio.addDjBoxes(this.boxes.map((b) => ({ x: b.x, z: b.z })));
    this.boxes.forEach((b, i) => {
      sys.add({
        id: 'dj-' + i,
        pos: new THREE.Vector3(b.x, 0, b.z),
        radius: 5.5,
        priority: 1.2,
        // E: dance (until you walk away); E again while dancing: ask the DJ for another song
        prompt: () => (actions.is('dance') ? 'Change Music' : 'Dance'),
        act: () => {
          if (!actions.is('dance')) {
            const moves: ('dance' | 'nach' | 'dhunuchi')[] = ['dance', 'nach', 'dance'];
            actions.start({ id: 'dance', pose: moves[Math.floor(Math.random() * moves.length)] });
            ui.toast(document.documentElement.classList.contains('touch') ? 'You join the dance! Walk away to stop · tap Change Music for the next song.' : 'You join the dance! Walk away to stop · E changes the music.', { bn: '♪' });
            return;
          }
          const ch = audio.djs[i];
          if (!ch) return;
          audio.nextTrack(ch);
          ui.toast('The DJ spins the next song!', { bn: '♪' });
        },
      });
    });
  }

  update(dt: number, t: number, player: THREE.Vector3, audio: AudioEngine, ui: UI, frustum?: THREE.Frustum) {
    const sphere = new THREE.Sphere(new THREE.Vector3(), 7);
    this.boxes.forEach((b, i) => {
      const near = Math.hypot(b.x - player.x, b.z - player.z);
      let vis = near < 48;
      if (vis && frustum) {
        toPlanet(b.x, 1.5, b.z, sphere.center);
        vis = frustum.intersectsSphere(sphere);
      }
      b.group.visible = vis;
      const ch = audio.djs[i];
      const lvl = ch && ch.active ? ch.level() : 0.35 + 0.25 * Math.max(0, Math.sin(t * 8));
      if (vis) {
        b.dj.energy = lvl;
        b.dj.update(dt, 0, 0);
      }
      for (const d of b.dancers) {
        d.ch.group.visible = vis;
        if (!vis) continue;
        d.ang += d.spin * dt;
        const x = b.x + Math.sin(d.ang) * d.r, z = b.z + Math.cos(d.ang) * d.r;
        d.ch.group.position.set(x, 0, z);
        // face the box, turning a little with the step
        d.ch.group.rotation.y = Math.atan2(b.x - x, b.z - z) + (d.spin === 0 ? 0 : Math.sin(t * 2 + d.ang) * 0.4);
        d.ch.energy = lvl;
        d.ch.update(dt, d.spin === 0 ? 0 : 0.15, 0);
        const sh = near < 18;
        if ((d as any).sh !== sh) {
          (d as any).sh = sh;
          d.ch.setShadows(sh);
        }
      }
      if (!vis) return;
      const beat = Math.min(1, lvl * 1.4);
      b.leds.forEach((m, k) => {
        const c = LED[(k + Math.floor(t * 3)) % LED.length];
        m.color.set(c).multiplyScalar(1.2 + beat * 1.8);
      });
      b.floor.color.set(LED[Math.floor(t * 1.5) % LED.length]);
      b.floor.opacity = 0.12 + beat * 0.22;
      for (const s of b.spots) s.pivot.rotation.set(Math.sin(t * 1.3 + s.ph) * 0.7, t * 0.8 + s.ph, Math.cos(t * 1.1 + s.ph) * 0.5);
    });
  }
}
