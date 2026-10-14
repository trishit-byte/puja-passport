/**
 * The living city: NPC crowds, food stalls (optional street experiences), hidden discoveries,
 * photo spots and the finale celebration.
 *
 * NPCs are cheap by design — no pathfinding AI. Walkers stroll back and forth along road
 * polylines on the pavement; others idle in small social groups, queue loosely at pandal gates,
 * sit on rowaks, play the dhak, dance with dhunuchis, take photos or offer folded-hand pranam
 * toward the protima. Everyone is non-blocking (no colliders) and steps aside for the player.
 * Only NPCs near the camera are animated and drawn.
 */
import { SHOPS, type ShopKind, type ShopSign } from '../world/props/signs';
import * as THREE from 'three';
import { Character, type Look, type Pose } from '../player/Character';
import type { World } from '../world/World';
import type { PandalBuild } from '../world/pandals/common';
import type { PandalId } from '../data/pandals';
import { STALLS, SECRETS, PHOTO_SPOTS, FINALE_POINT, PLAZAS, groundHeight } from '../data/layout';
import { buildStall, type StallKind } from '../world/props/stalls';

const FOOD_HI: Record<string, string> = { phuchka: 'फुचका', chowmein: 'चाउमीन', roll: 'काठी रोल', cha: 'चाय', jhalmuri: 'झालमुड़ी', mishti: 'मिष्टी' };
import { PANDALS } from '../data/pandals';
import { toon, glow } from '../rendering/materials';
import { unitBox } from '../world/Batcher';
import { Rng } from '../utils/rng';
import { toPlanet } from '../utils/planet';
import { damp, dampAngle, lerp } from '../utils/math';
import type { InteractionSystem } from '../interactions/InteractionSystem';
import type { UI, DialogueLine } from '../ui/UI';
import type { AudioEngine, SoundSpot } from '../audio/AudioEngine';
import type { Progress } from '../gameplay/Progress';
import type { Player } from '../player/Player';
import { makeProp, type PlayerActions, type PropKind } from '../player/Actions';
import { QUALITY } from '../rendering/Renderer';

type Mode = 'walk' | 'idle' | 'sit' | 'drum' | 'dance' | 'photo' | 'pray' | 'vendor' | 'queue' | 'eat';

interface Npc {
  ch: Character;
  mode: Mode;
  pos: THREE.Vector3;
  yaw: number;
  baseYaw: number;
  home: THREE.Vector3;
  path?: THREE.Vector3[];
  t: number; // path parameter (index float)
  dir: 1 | -1;
  speed: number;
  role: string;
  lines: DialogueLine[];
  greetCd: number;
  visible: boolean;
  /** Crowd rank 0…1: walkers with rank above the current density stay home. */
  rank?: number;
  onRoad?: boolean;
}

const SKINS = [0xc98a62, 0xb5764f, 0xd9a07a, 0x9a6444, 0xe0b08a, 0xa86f4c];
const SARI = [0xb3121f, 0xf6a21e, 0x2f6b4e, 0x1a5fb4, 0xd94f7a, 0x7a3e9d, 0xf4eedf, 0xe8743a, 0x0f6b6b];
const KURTA = [0xf4eedf, 0xf2c14e, 0xe8743a, 0x2f6b4e, 0x7a3e9d, 0x1a5fb4, 0xd9a5a0, 0xfaf6ea];
const SHIRT = [0x3a6ea5, 0xe8e2d0, 0x9b2c2c, 0x2f6b4e, 0x6a5acd, 0xf2c14e];

const GREETINGS: DialogueLine[][] = [
  [{ name: 'Mashima', bn: 'শুভ শারদীয়া!', text: 'Shubho Sharodiya! Have you seen the Rajbarir Pujo yet? Two hundred years of Pujo in that zamindar house.', tr: '“Happy autumn festival!”' }],
  [{ name: 'Rintu', bn: 'কী সুন্দর প্যান্ডেল!', text: 'Ki shundor pandal! Every year the theme pandals get wilder. I heard there’s one that’s all underwater.', tr: '“What a beautiful pandal!”' }],
  [{ name: 'Volunteer Dada', bn: 'ওই দিকে যান', text: 'Oi dike jan — Alok Pally is that way, under all the light arches. Mind the queue!', tr: '“Please go that way.”' }],
  [{ name: 'Tuku', bn: 'ফুচকা খাবে?', text: 'Fuchka khabe? The stall by Mela Maidan does the best tok-jhal-mishti water.', tr: '“Want some fuchka?”' }],
  [{ name: 'Dadu', text: 'In my day we walked to every pandal in north Kolkata in one night. Shoes in hand, of course!' }, { name: 'Dadu', text: 'Morning anjali was lovely today. Now the night belongs to you young people.' }],
  [{ name: 'Mou', bn: 'দারুণ!', text: 'Darun! Did you hear the dhak from Mela Bazaar? Follow the sound — you can’t miss it.', tr: '“Awesome!”' }],
  [{ name: 'Photographer', text: 'Hold still… perfect. The light arches make everyone look like a film star tonight.' }],
  [{ name: 'Pishi', bn: 'আস্তে আস্তে', text: 'Aste aste, go slowly. The best pandal is the one you stumble into by accident.', tr: '“Slowly, gently.”' }],
  [{ name: 'Artisan', text: 'My family has shaped clay idols for four generations. Ganga mati, straw and patience — that’s the secret.' }],
  [{ name: 'Dhunuchi dancer', text: 'When the dhak gets fast, the dhunuchi has to fly! Only two more nights till Dashami…' }],
  [{ name: 'Bubai', bn: 'নাচবি?', text: 'Nachbi? Follow the music notes on your map — every para has its DJ tonight. Press E and just dance!', tr: '“Will you dance?”' }],
  [{ name: 'Kakima', bn: 'আরতি', text: 'Don’t miss the sandhya aarti around half past seven — and the midnight one too. Every pandal rings at once!', tr: '“Aarti”' }],
  [{ name: 'Rimi', text: 'Take a selfie at each pandal gate! I’m collecting all ten for my passport memories.' }],
  [{ name: 'Tram conductor', bn: 'সাবধানে!', text: 'Sabdhane! Mind the tram lines — and the taxis honk at anyone standing in the road.', tr: '“Careful!”' }],
  [{ name: 'Montu', text: 'Ten pandals before four in the morning? Easy — if you don’t stop at every chowmein stall like me.' }],
];

export class LivingCity {
  npcs: Npc[] = [];
  /** Crowd density 0…1 for the hour (SimClock.crowdForHours). */
  density = 1;
  /** Called when the player takes a selfie (the game frames and keeps a snapshot). */
  onSelfie: ((place: string) => void) | null = null;
  /** True during the evening and midnight aartis (set by the game from the clock). */
  aartiNow = false;
  /** A purohit before each protima, performing aarti when one is on. */
  private priests: { ch: Character; pos: THREE.Vector3; id: string }[] = [];
  /** Worshippers who gather in an arc behind the viewing spot while an aarti is on. */
  private devotees: { ch: Character; pos: THREE.Vector3 }[] = [];
  /** Pedestrians currently walking on the carriageway (vehicles brake for them). */
  roadPeds: THREE.Vector3[] = [];
  private rng: Rng;
  private group = new THREE.Group();
  private stallVendors: { id: string; pos: THREE.Vector3; yaw: number; front: THREE.Vector3 }[] = [];
  private smoke: THREE.Points;
  private smokeBase: THREE.Vector3[] = [];
  private celebrating = false;
  private lanterns: THREE.Mesh[] = [];
  private maxNpcs: number;

  /** Areas world generation must keep free (stalls, secrets, photo spots). */
  static exclusions() {
    return [
      ...STALLS.map((s) => ({ x: s.x, z: s.z, r: 4 })),
      ...SECRETS.map((s) => ({ x: s.x, z: s.z, r: s.id === 'kumortuli' ? 7 : 3 })),
      ...PHOTO_SPOTS.map((s) => ({ x: s.x, z: s.z, r: 3 })),
    ];
  }

  constructor(private world: World, scene: THREE.Scene, seed: number, private builds: Map<PandalId, PandalBuild>, quality: keyof typeof QUALITY = 'high') {
    this.rng = new Rng(seed * 7 + 3);
    this.maxNpcs = QUALITY[quality].npcs;
    scene.add(this.group);
    this.buildStalls();
    this.buildPriests();
    this.buildSecrets();
    this.populate();
    // dhunuchi smoke: soft points drifting up from dancers
    const n = 320;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 4).fill(1), 4)); // alpha fades each puff
    // a soft, round puff (not hard squares)
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const cx = c.getContext('2d')!;
    const grad = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = grad;
    cx.fillRect(0, 0, 64, 64);
    const puff = new THREE.CanvasTexture(c);
    this.smoke = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe0d8e8, map: puff, size: 0.9, transparent: true, opacity: 0.5, depthWrite: false, vertexColors: true }));
    this.smoke.frustumCulled = false;
    // (smoke rendered in flat space would not follow the planet; we map positions on the CPU)
    scene.add(this.smoke);
  }

  // ---------------------------------------------------------------- stalls
  /** A purohit for each pandal, standing before the bedi facing the protima, with a pancha-pradip. */
  private buildPriests() {
    for (const [id, b] of this.builds) {
      const L = b.view.look, d = b.darshan;
      let dx = L.x - d.x, dz = L.z - d.z, n = Math.hypot(dx, dz);
      if (n < 0.5) continue; // pandals whose view target sits over the viewing spot: no room in front of the bedi
      dx /= n;
      dz /= n;
      const pos = new THREE.Vector3(d.x + dx * Math.min(n * 0.5, 2.2), 0, d.z + dz * Math.min(n * 0.5, 2.2));
      pos.y = groundHeight(pos.x, pos.z); // (Nodir Opare's floor is its deck over the river)
      const ch = new Character({ style: 'kurta', color: 0xfaf6ea, accent: 0xb3121f, hair: 'bald', skin: 0xb5764f, pants: 0xfaf6ea }, true);
      this.claim(pos.x, pos.z, 0.7); // the purohit circles his lamp: keep clear of him
      ch.group.position.copy(pos);
      ch.group.rotation.y = Math.atan2(dx, dz);
      ch.pose = 'aarti';
      ch.setProp(makeProp('pradip'));
      ch.group.visible = false;
      this.group.add(ch.group);
      this.priests.push({ ch, pos, id });
      // an arc of worshippers behind the viewing spot, all facing the protima
      const yaw = Math.atan2(dx, dz);
      for (let k = 0; k < 7; k++) {
        const a = (k - 3) * 0.32;
        const r = 2.4 + (k % 2) * 1.1;
        const px = d.x - Math.sin(yaw + a) * r, pz = d.z - Math.cos(yaw + a) * r;
        if (!this.world.isClear(px, pz, 0.35)) continue;
        const free = this.freeSpot(new THREE.Vector3(px, 0, pz), 0.45);
        if (!free) continue;
        this.claim(free.x, free.z, 0.45);
        const dv = new Character(this.look(this.rng.pick(['woman', 'woman', 'man', 'elder', 'child'])), true);
        dv.group.position.set(free.x, groundHeight(free.x, free.z), free.z);
        dv.group.rotation.y = yaw + a * 0.3;
        dv.pose = k % 3 === 1 ? 'clap' : 'pray';
        dv.group.visible = false;
        this.group.add(dv.group);
        this.devotees.push({ ch: dv, pos: dv.group.position.clone() });
      }
    }
  }

  private buildStalls() {
    const b = this.world.batch;
    // every food stall is a modelled kind (see world/props/stalls.ts)
    const place = (id: string, x: number, z: number, yaw: number) => {
      const r = buildStall(b, id as StallKind, x, z, yaw, this.world.bulbs);
      this.world.colliders.addBox(x, z, r.size[0], r.size[1], yaw, 1.2);
      this.stallVendors.push({ id, pos: r.vendor, yaw, front: r.front });
    };
    for (const s of STALLS) place(s.id, s.x, s.z, s.yaw);
    // more phuchka, chowmein and roll stalls on clear pavement along the busier streets,
    // spaced out, never inside a pandal or blocking a doorway
    const want: string[] = ['chowmein', 'phuchka', 'roll', 'chowmein', 'phuchka', 'roll', 'chowmein', 'phuchka', 'roll', 'chowmein'];
    const spots: { x: number; z: number; yaw: number }[] = [];
    for (const sm of this.world.roads) {
      if (sm.road.kind === 'lane') continue;
      for (let i = 2; i < sm.pts.length - 2; i += 2)
        for (const side of [1, -1]) {
          const off = sm.road.width / 2 + 1.5;
          const x = sm.pts[i].x + sm.normals[i].x * side * off, z = sm.pts[i].z + sm.normals[i].z * side * off;
          if (z > 95 || Math.hypot(x, z) > 170) continue;
          if (PANDALS.some((pd) => Math.hypot(pd.x - x, pd.z - z) < pd.radius + 4)) continue;
          if (!this.world.isClear(x, z, 1.9)) continue;
          spots.push({ x, z, yaw: Math.atan2(-sm.normals[i].x * side, -sm.normals[i].z * side) });
        }
    }
    const taken = this.stallVendors.map((v) => v.pos.clone());
    for (const id of want) {
      let best = -1, bestD = 0;
      spots.forEach((sp, k) => {
        const d = Math.min(...taken.map((t) => Math.hypot(t.x - sp.x, t.z - sp.z)));
        if (d > bestD) {
          bestD = d;
          best = k;
        }
      });
      if (best < 0 || bestD < 22) break;
      const sp = spots.splice(best, 1)[0];
      place(id, sp.x, sp.z, sp.yaw);
      taken.push(new THREE.Vector3(sp.x, 0, sp.z));
    }
  }

  // ---------------------------------------------------------------- secrets
  private buildSecrets() {
    const b = this.world.batch;
    for (const s of SECRETS) {
      if (s.id === 'kumortuli') {
        // artisans' lane: straw armatures and unpainted clay figures under a tarp
        for (let k = 0; k < 5; k++) {
          const x = s.x - 8 + k * 4, z = s.z + (k % 2 ? 2.4 : -2.4);
          b.addMesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 8), toon(k % 2 ? 0xc9a46a : 0x8a6e5a), new THREE.Vector3(x, 1.1, z), null, 1);
          b.addMesh(new THREE.SphereGeometry(0.3, 10, 8), toon(0x8a6e5a), new THREE.Vector3(x, 2.5, z), null, 1);
          b.box(toon(0x2f5d7a), x, 3.3, z, 2.2, 0.06, 2.2, 0.1, undefined, false);
          this.world.colliders.addCircle(x, z, 0.6, 2.5);
        }
      } else if (s.id === 'cat') {
        b.addMesh(new THREE.SphereGeometry(0.25, 10, 8), toon(0xe8823a), new THREE.Vector3(s.x, 3.95, s.z), null, { x: 1.4, y: 0.8, z: 0.9 });
        b.addMesh(new THREE.SphereGeometry(0.15, 10, 8), toon(0xe8823a), new THREE.Vector3(s.x + 0.32, 4.05, s.z), null, 1);
        b.box(toon(0xf4eedf), s.x, 3.7, s.z, 2.2, 0.15, 0.9);
      } else if (s.id === 'gramophone') {
        b.box(toon(0x5a3d2b), s.x, 0.5, s.z, 0.8, 1.0, 0.6);
        b.addMesh(new THREE.ConeGeometry(0.45, 0.8, 14, 1, true), toon(0xd4af37, { side: THREE.DoubleSide }), new THREE.Vector3(s.x, 1.5, s.z), new THREE.Euler(0, 0, 0.9), 1);
      } else if (s.id === 'postbox') {
        b.addMesh(new THREE.CylinderGeometry(0.35, 0.35, 1.4, 14), toon(0xb3121f), new THREE.Vector3(s.x, 0.7, s.z), null, 1);
        b.addMesh(new THREE.SphereGeometry(0.37, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xb3121f), new THREE.Vector3(s.x, 1.4, s.z), null, 1);
        this.world.colliders.addCircle(s.x, s.z, 0.4, 1.6);
      } else if (s.id === 'boat') {
        const y = groundHeight(s.x, s.z) - 0.6;
        b.addMesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon(0x6b3a22, { side: THREE.DoubleSide }), new THREE.Vector3(s.x, y + 0.6, s.z + 4), null, { x: 1.2, y: 0.7, z: 3.5 });
        b.box(toon(0x8a5a2b), s.x, y + 1.3, s.z + 4, 1.6, 0.9, 2.2);
      }
    }
    // floating river lanterns off the ghat (animated)
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), glow(0xffb33c, 3));
      m.position.set(-60 + this.rng.range(0, 160), -2.35, 114 + this.rng.range(0, 30));
      m.frustumCulled = false;
      this.group.add(m);
      this.lanterns.push(m);
    }
  }

  // ---------------------------------------------------------------- people
  private look(kind: string): Look {
    const r = this.rng;
    const skin = r.pick(SKINS);
    switch (kind) {
      case 'woman':
        if (r.chance(0.3)) return { style: 'salwar', color: r.pick(SARI), accent: r.pick([0xd4af37, 0xf4eedf, 0xb3121f, 0x2f6b4e]), hair: r.pick(['bun', 'braid']), skin };
        return { style: 'sari', color: r.pick(SARI), accent: r.pick([0xb3121f, 0xd4af37, 0x2f6b4e]), hair: r.pick(['bun', 'braid']), skin };
      case 'man':
        if (r.chance(0.22)) return { style: 'tee', color: r.pick([0x1a1a20, 0xf4f4f0, 0xb3121f, 0x2f6b8a, 0xf2c14e]), accent: r.pick([0xf6a21e, 0xffffff, 0xd94f7a]), hair: 'short', skin, pants: r.pick([0x2a3a5a, 0x3a4a6a, 0x1a1a20]) };
        return r.chance(0.6) ? { style: 'kurta', color: r.pick(KURTA), accent: r.pick([0xb3121f, 0xd4af37, 0x2f6b4e]), hair: 'short', skin } : { style: 'shirt', color: r.pick(SHIRT), accent: 0xf4eedf, hair: 'short', skin, pants: r.pick([0x2e3550, 0x3a3a3a, 0x6b5a48]) };
      case 'child':
        return r.chance(0.5) ? { style: 'frock', color: r.pick([0xf2c14e, 0xd94f7a, 0x5ec2d8, 0xb6f08a]), accent: 0xffffff, hair: r.pick(['bun', 'braid']), skin, scale: 0.66 } : { style: 'kurta', color: r.pick(KURTA), accent: 0xb3121f, hair: 'short', skin, scale: 0.64 };
      case 'elder':
        return r.chance(0.5) ? { style: 'kurta', color: 0xf4eedf, accent: 0xd4af37, hair: r.pick(['grey', 'bald']), skin, elderly: true, glasses: true } : { style: 'sari', color: 0xf4eedf, accent: 0xb3121f, hair: 'grey', skin, elderly: true, glasses: r.chance(0.5) };
      case 'dhaki':
        return { style: 'dhaki', color: 0xf4eedf, accent: 0xb3121f, hair: 'short', skin, pants: 0xf4eedf };
      case 'volunteer':
        return { style: 'shirt', color: 0xf6a21e, accent: 0xb3121f, hair: 'short', skin, pants: 0x2e3550 };
      default:
        return { style: 'shirt', color: r.pick(SHIRT), accent: 0xf4eedf, hair: 'short', skin };
    }
  }

  /**
   * Personal space: everyone standing still gets a radius, wider for dancers (swinging arms and
   * dhunuchis) and people eating, and nobody is placed inside anyone else's. A taken spot moves
   * the newcomer to the nearest free one close by; if there's none, they don't appear.
   */
  private taken = new Map<number, { x: number; z: number; r: number }[]>();
  private takenKey = (x: number, z: number) => cellKey(Math.floor(x / 2), Math.floor(z / 2));
  private personal(mode: Mode) {
    return mode === 'dance' ? 0.95 : mode === 'eat' ? 0.5 : mode === 'drum' ? 0.6 : 0.42;
  }
  private isFree(x: number, z: number, r: number) {
    const gx = Math.floor(x / 2), gz = Math.floor(z / 2);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const o of this.taken.get(cellKey(gx + i, gz + j)) ?? NONE) if ((o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + r) ** 2) return false;
    return true;
  }
  private claim(x: number, z: number, r: number) {
    const k = this.takenKey(x, z);
    let a = this.taken.get(k);
    if (!a) this.taken.set(k, (a = []));
    a.push({ x, z, r });
  }
  /** The nearest free standing spot to p (within ~1.8 m), or null. */
  private freeSpot(p: THREE.Vector3, r: number): THREE.Vector3 | null {
    if (this.isFree(p.x, p.z, r) && this.world.isClear(p.x, p.z, 0.3)) return p;
    for (let k = 1; k <= 5; k++)
      for (let a = 0; a < 10; a++) {
        const ang = (a / 10) * Math.PI * 2 + k * 0.7;
        const x = p.x + Math.cos(ang) * k * 0.35, z = p.z + Math.sin(ang) * k * 0.35;
        if (this.isFree(x, z, r) && this.world.isClear(x, z, 0.3)) return new THREE.Vector3(x, p.y, z);
      }
    return null;
  }

  /** Shopkeepers dressed for their trade. */
  private shopkeeperLook(kind: ShopKind): Look {
    const r = this.rng, skin = r.pick(SKINS);
    switch (kind) {
      case 'sweets':
      case 'telebhaja':
      case 'tea':
      case 'hotel':
      case 'biryani':
        // the moyra / cook: white vest-like kurta, a gamchha-red accent
        return { style: 'kurta', color: 0xf8f4ea, accent: 0xb3121f, hair: r.pick(['short', 'bald']), skin, pants: 0xf4eedf };
      case 'books':
        return r.chance(0.6) ? { style: 'kurta', color: 0xefe4cf, accent: 0x6b4a2f, hair: 'grey', skin, elderly: true, glasses: true } : { style: 'shirt', color: 0xdfe6ef, accent: 0xf4eedf, hair: 'short', skin, glasses: true, pants: 0x2e3550 };
      case 'clothing':
      case 'gift':
        return r.chance(0.5) ? { style: 'sari', color: r.pick(SARI), accent: 0xd4af37, hair: 'bun', skin } : { style: 'kurta', color: r.pick(KURTA), accent: 0xd4af37, hair: 'short', skin };
      case 'jewellers':
        return { style: 'kurta', color: 0xf4e3b0, accent: 0xd4af37, hair: 'short', skin };
      case 'medical':
        return { style: 'shirt', color: 0xffffff, accent: 0x0f8a4a, hair: 'short', skin, glasses: r.chance(0.5), pants: 0x2e3550 };
      case 'puja':
        return { style: 'kurta', color: 0xf2c14e, accent: 0xb3121f, hair: r.pick(['short', 'bald']), skin };
      default:
        return r.chance(0.3) ? { style: 'sari', color: r.pick(SARI), accent: 0xb3121f, hair: 'bun', skin } : { style: 'shirt', color: r.pick(SHIRT), accent: 0xf4eedf, hair: 'short', skin, pants: r.pick([0x2e3550, 0x3a3a3a, 0x6b5a48]) };
    }
  }

  private add(kind: string, mode: Mode, pos: THREE.Vector3, yaw: number, extra: Partial<Npc> = {}, always = false, look?: Look) {
    if (!always && this.npcs.length >= this.maxNpcs) return null;
    if (mode !== 'walk') {
      const r = this.personal(mode);
      if (mode === 'vendor') this.claim(pos.x, pos.z, r); // shopkeepers and vendors stand behind their counters
      else {
        const spot = this.freeSpot(pos, r);
        if (!spot) return null;
        pos = spot;
        this.claim(pos.x, pos.z, r);
      }
    }
    const ch = new Character(look ?? this.look(kind), true);
    ch.group.position.copy(pos);
    ch.group.rotation.y = yaw;
    this.group.add(ch.group);
    const lines = extra.lines ?? this.rng.pick(GREETINGS);
    const npc: Npc = { ch, mode, pos: pos.clone(), yaw, baseYaw: yaw, home: pos.clone(), t: 0, dir: 1, speed: this.rng.range(1.0, 1.45), role: kind, lines, greetCd: 0, visible: true, ...extra };
    (npc as any).animSlot = this.npcs.length % 6; // spread the skipped frames across the crowd
    (npc as any).ax = 0;
    (npc as any).az = 0;
    const poses: Partial<Record<Mode, Pose>> = { sit: 'sit', drum: 'drum', dance: 'dance', photo: 'photo', pray: 'pray', vendor: 'none' };
    ch.pose = poses[mode] ?? 'none';
    if (mode === 'photo') ch.setProp(makeProp('phone')); // taking a photo of the protima
    this.npcs.push(npc);
    return npc;
  }

  private populate() {
    const r = this.rng;
    // 1) pandal crowds: loose queues at gates, families admiring the protima, a few in pranam
    for (const [id, b] of this.builds) {
      const g = b.gate, d = b.darshan;
      const dir = new THREE.Vector3().subVectors(d, g).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const yawIn = Math.atan2(dir.x, dir.z);
      for (let k = 0; k < 4; k++) {
        const p = g.clone().addScaledVector(dir, -4 - k * 1.1).addScaledVector(side, 3.5 + r.range(-0.3, 0.3));
        this.add(r.pick(['woman', 'man', 'man', 'child', 'elder']), 'queue', p, yawIn);
      }
      for (let k = 0; k < 4; k++) {
        const p = d.clone().addScaledVector(side, -4 + k * 2.6 + r.range(-0.4, 0.4)).addScaledVector(dir, r.range(-1, 1.5));
        this.add(r.pick(['woman', 'man', 'child', 'elder']), k === 1 ? 'pray' : k === 3 ? 'photo' : 'idle', p, yawIn + r.range(-0.2, 0.2));
      }
      this.add('volunteer', 'idle', g.clone().addScaledVector(side, -3), yawIn + Math.PI, {
        lines: [{ name: 'Volunteer', bn: 'লাইনে দাঁড়ান', text: 'Line-e dNaran, please — one line in through প্রবেশ, out through প্রস্থান. Enjoy the darshan!', tr: '“Please stand in line.”' }],
      });
      // every pandal has its pair of dhakis playing near the protima
      if (id !== 'dhaker-taal')
        for (let k = 0; k < 2; k++)
          this.add('dhaki', 'drum', d.clone().addScaledVector(side, k ? 5.2 : -5.2).addScaledVector(dir, -1.5), yawIn + Math.PI + (k ? -0.5 : 0.5), {
            lines: [{ name: 'Dhaki', bn: 'ঢাকের তাল', text: 'Dhyang kur-kur, dhyang kur-kur! We play from Shoshthi till Dashami — the pujo isn’t complete without the dhak.', tr: '“The rhythm of the dhak.”' }],
          });
      // the dhunuchi naach before the protima at every pandal: two dancers (three at Dhaker Taal),
      // men and women, a dhunuchi in the right hand, often a second in the left; one expert per
      // pandal holds a third in the teeth. Smoke rises from each.
      const nd = id === 'dhaker-taal' ? 3 : 2;
      for (let k = 0; k < nd; k++) {
        const off = nd === 3 ? (k - 1) * 2.4 : k ? 1.9 : -1.9;
        const p = d.clone().addScaledVector(side, off).addScaledVector(dir, 1.4);
        if (!this.world.isClear(p.x, p.z, 0.4)) continue;
        const n = this.add(k % 2 ? 'woman' : 'man', 'dance', p, yawIn + (off > 0 ? 0.5 : -0.5), { lines: [{ name: 'Dhunuchi dancer', bn: 'ধুনুচি নাচ', text: 'When the dhak gets fast, the dhunuchi has to fly! Pick one up and join us.' }] }, true);
        if (!n) continue;
        n.ch.pose = 'dhunuchi';
        n.ch.setProp(makeProp('dhunuchi'));
        if (k % 2 === 1 || r.chance(0.5)) n.ch.holdLeft(makeProp('dhunuchi')!);
        if (k === 0) n.ch.holdInMouth(makeProp('dhunuchi')!);
        this.smokeBase.push(n.pos);
      }
      if (id === 'dhaker-taal') {
        for (let k = 0; k < 3; k++) this.add('dhaki', 'drum', d.clone().addScaledVector(side, -3 + k * 3).addScaledVector(dir, -3), yawIn + Math.PI, { lines: [{ name: 'Dhaki', text: 'We came from a village near Bankura for the Pujo — every year since my grandfather’s time. Go on, try a beat!' }] });
      }
    }
    // 2) walkers along the roads (on the pavement), in families and pairs
    const roads = this.world.roads.filter((s) => s.road.kind !== 'lane' || r.chance(0.5));
    let guard = 0, walkers = 0;
    const quota = Math.round(this.maxNpcs * 0.8); // walkers have their own budget, separate from vendors and shopkeepers
    while (walkers < quota && guard++ < 600) {
      const s = r.pick(roads);
      const sideSign = r.chance(0.5) ? 1 : -1;
      // on Pujo nights the crowd spills off the pavement onto the roadway
      const onRoad = s.road.kind !== 'lane' && r.chance(0.45);
      const off = onRoad ? r.range(0.8, s.road.width / 2 - 0.6) : s.road.width / 2 + (s.road.kind === 'lane' ? -1.2 : 0.9);
      const path = s.pts.map((p, i) => p.clone().addScaledVector(s.normals[i], off * sideSign + r.range(-0.4, 0.4)));
      const rank = r.next();
      const t = r.range(0, path.length - 1);
      const group = r.pick(['single', 'pair', 'family']);
      const members = group === 'family' ? ['woman', 'man', 'child'] : group === 'pair' ? [r.pick(['woman', 'man']), r.pick(['woman', 'man'])] : [r.pick(['woman', 'man', 'elder'])];
      const speed = r.range(0.95, 1.3);
      const dirn = r.chance(0.5) ? 1 : -1;
      members.forEach((m, k) => {
        const p = path[Math.floor(t)].clone();
        if (this.add(m, 'walk', p, 0, { path, t: t - k * 0.55 * dirn, dir: dirn as 1 | -1, speed, rank, onRoad, role: 'walker' }, true)) walkers++;
      });
    }
    // 3) vendors behind stalls, elders sitting on benches/rowaks
    for (const v of this.stallVendors) {
      const lines: Record<string, DialogueLine[]> = {
        phuchka: [{ name: 'Fuchkawala', bn: 'ফুচকা খাবে?', text: 'Fuchka khabe? Tok, jhal, mishti — I’ll make it just how you like.', tr: '“Want some fuchka?”' }],
        cha: [{ name: 'Cha-wala', bn: 'এক ভাঁড় চা?', text: 'Ek bhNar cha? Fresh boiled, with a little elaichi. Sit, sit.', tr: '“A clay cup of tea?”' }],
        jhalmuri: [{ name: 'Jhalmuri-wala', bn: 'ঝালমুড়ি!', text: 'Jhalmuri! Puffed rice, mustard oil, green chilli, a squeeze of lime.' }],
        mishti: [{ name: 'Moira', bn: 'মিষ্টি', text: 'Roshogolla, sondesh, mishti doi — Pujo isn’t Pujo without mishti!' }],
        roll: [{ name: 'Roll-wala', bn: 'কাঠি রোল', text: 'Egg roll, chicken roll, paneer roll — paratha straight off the tawa, onion, lebu, a dash of sauce. Wrapped in paper!' }],
        chowmein: [{ name: 'Chowmein-da', bn: 'চাউমিন', text: 'Hakka chowmein, extra sauce, extra chilli! Tangra-style — a Kolkata favourite since forever.' }],
      };
      // vendors face the street (stall front is local +z)
      this.add('man', 'vendor', v.pos, v.yaw, { lines: lines[v.id], role: 'vendor-' + v.id }, true);
      // customers: a line waiting at the counter, and a few eating to one side with the stall's
      // own food; at the fuchka stall they stand round the vendor in a ring, leaf bowls held out,
      // as he hands each one a fuchka in turn. (Fewer on lower graphics settings.)
      const busy = Math.max(0.25, this.maxNpcs / 320);
      const fwd = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw));
      const side = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
      const food: Record<string, PropKind> = { phuchka: 'leafbowl', jhalmuri: 'leafbowl', mishti: 'leafbowl', roll: 'roll', chowmein: 'plate', cha: 'bhar' };
      const customer = (p: THREE.Vector3, yaw: number, eating: boolean) => {
        if (!this.world.isClear(p.x, p.z, 0.3)) return;
        const n = this.add(r.pick(['woman', 'man', 'child', 'man', 'woman', 'elder']), eating ? 'eat' : 'queue', p, yaw, {}, true);
        if (n && eating) {
          n.ch.pose = 'eat';
          n.ch.setProp(makeProp(food[v.id] ?? 'leafbowl'));
        }
      };
      if (v.id === 'phuchka') {
        const ring = Math.round(4 + 3 * busy);
        for (let k = 0; k < ring; k++) {
          const a = -1.2 + (2.4 * k) / Math.max(1, ring - 1);
          const p = v.front.clone().addScaledVector(fwd, -0.2 + Math.cos(a) * 1.1).addScaledVector(side, Math.sin(a) * 1.5);
          customer(p, Math.atan2(v.front.x - fwd.x * 1.3 - p.x, v.front.z - fwd.z * 1.3 - p.z), true);
        }
        for (let k = 0; k < Math.round(1 + 2 * busy); k++) customer(v.front.clone().addScaledVector(fwd, 1.9 + k * 0.75).addScaledVector(side, 0.3), v.yaw + Math.PI, false);
      } else {
        const line = Math.round(2 + 3.5 * busy);
        for (let k = 0; k < line; k++) customer(v.front.clone().addScaledVector(fwd, 0.15 + k * 0.72).addScaledVector(side, (k % 2 ? 0.08 : -0.08)), v.yaw + Math.PI + r.range(-0.15, 0.15), false);
        for (let k = 0; k < Math.round(1 + 2 * busy); k++) {
          const p = v.front.clone().addScaledVector(side, (k % 2 ? 1 : -1) * (1.7 + Math.floor(k / 2) * 0.8)).addScaledVector(fwd, 0.6 + (k % 3) * 0.3);
          customer(p, v.yaw + Math.PI + (k % 2 ? 0.6 : -0.6), true);
        }
      }
    }
    for (const p of this.world.footprints.slice(0, 200)) {
      if (this.npcs.length >= this.maxNpcs) break;
      if (!r.chance(0.05)) continue;
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      const pos = new THREE.Vector3(p.x + fx * (p.hd + 0.7), 0.7, p.z + fz * (p.hd + 0.7));
      if (this.world.field.clearance(pos.x, pos.z) < 0.5) continue;
      this.add('elder', 'sit', pos, p.yaw);
    }
    const busyShops = Math.max(0.2, this.maxNpcs / 320);
    // every open shop is staffed, by someone who fits the trade, who greets you in its name
    for (const k of this.world.shopkeepers) {
      const shop = SHOPS[k.shop];
      const look = this.shopkeeperLook(k.kind);
      const n = this.add('man', 'vendor', k.pos.clone(), k.yaw, { lines: shopLines(shop), role: 'shopkeeper' }, true, look);
      if (n) n.baseYaw = k.yaw;
      // Pujo shopping: customers at the counter, one or two more waiting their turn
      if (!r.chance(busyShops >= 0.9 ? 0.75 : 0.1 + 0.35 * busyShops)) continue;
      const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw), sx = Math.cos(k.yaw), sz = -Math.sin(k.yaw);
      const count = 1 + (r.chance(0.6 * busyShops) ? 1 : 0) + (r.chance(0.3 * busyShops) ? 1 : 0);
      for (let c = 0; c < count; c++) {
        const off = (c - (count - 1) / 2) * 0.9;
        const p = new THREE.Vector3(k.pos.x + fx * (2.3 + (c === 2 ? 0.8 : 0)) + sx * off, 0, k.pos.z + fz * (2.3 + (c === 2 ? 0.8 : 0)) + sz * off);
        if (!this.world.isClear(p.x, p.z, 0.3)) continue;
        this.add(r.pick(['woman', 'woman', 'man', 'elder', 'child']), 'queue', p, k.yaw + Math.PI + r.range(-0.25, 0.25), {}, true);
      }
    }
    // balloon sellers with bobbing bunches of balloons at the plazas
    for (const pl of PLAZAS.slice(0, 5)) {
      const n = this.add('man', 'idle', new THREE.Vector3(pl.x - pl.r * 0.55, 0, pl.z + pl.r * 0.4), r.range(0, 6.28), {
        lines: [{ name: 'Balloon-wala', bn: 'বেলুন!', text: 'Belun! Balloons for the little ones — red, gold, green, every colour of Pujo!' }],
      });
      if (n) this.addBalloons(n);
    }
    // an artisan at work in the Kumortuli lane
    const k = SECRETS.find((s) => s.id === 'kumortuli')!;
    this.add('man', 'idle', new THREE.Vector3(k.x - 1, 0, k.z), Math.PI / 2, { role: 'artisan', lines: GREETINGS[8] });
    // a roaming pair of dhakis near the main chowk (their sound draws you toward Mela Bazaar)
    this.add('dhaki', 'drum', new THREE.Vector3(-58, 0, -12), -1.2);
  }

  private balloons: { g: THREE.Group; ph: number }[] = [];
  private addBalloons(n: Npc) {
    const g = new THREE.Group();
    g.position.set(0.35, 1.1, 0.1);
    const cols = [0xff2d6a, 0xffd23c, 0x2de8ff, 0x8aff4a, 0xb05aff, 0xff8a1a, 0xffffff];
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), toon(cols[i % cols.length], { paint: false }));
      b.scale.y = 1.2;
      const a = (i / 9) * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.35 * (i % 2 ? 1 : 0.5), 1.6 + (i % 3) * 0.3, Math.sin(a) * 0.35 * (i % 2 ? 1 : 0.5));
      b.frustumCulled = false;
      g.add(b);
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, b.position.y), toon(0xdddddd, { paint: false }));
      str.position.set(b.position.x / 2, b.position.y / 2, b.position.z / 2);
      str.frustumCulled = false;
      g.add(str);
    }
    n.ch.group.add(g);
    this.balloons.push({ g, ph: Math.random() * 6 });
  }

  /** People out and about within r metres (for the crowd sound): by distance and the hour, not the view. */
  peopleNear(x: number, z: number, r: number) {
    let n = 0;
    for (const q of this.npcs) if ((q.rank === undefined || q.rank <= this.density) && (q.pos.x - x) ** 2 + (q.pos.z - z) ** 2 < r * r) n++;
    return n;
  }

  /** Where the dhak ensembles (and aarti bells) are heard from — every pandal has its dhakis. */
  dhakSpots(): SoundSpot[] {
    const out: SoundSpot[] = [];
    for (const [id, b] of this.builds) {
      out.push({ id, x: b.darshan.x, z: b.darshan.z, kind: 'dhak', vol: id === 'dhaker-taal' ? 1.5 : 0.95, dhakis: id === 'dhaker-taal' ? 3 : 2 });
      const always = id === 'bonedi-bari' || id === 'gram-bangla' || id === 'nodir-alo';
      out.push({ id: id + '-aarti', x: b.view.look.x, z: b.view.look.z, kind: 'aarti', vol: always ? 0.8 : 1.0, timed: !always });
    }
    out.push({ id: 'chowk', x: -58, z: -12, kind: 'dhak', vol: 0.8, dhakis: 1 });
    return out;
  }

  // ---------------------------------------------------------------- interactions
  registerInteractions(sys: InteractionSystem, ui: UI, audio: AudioEngine, progress: Progress, player: Player, actions: PlayerActions) {
    // talk to anyone nearby
    for (const n of this.npcs) {
      if (n.role.startsWith('vendor')) continue;
      sys.add({
        id: 'npc',
        get pos() {
          return n.pos;
        },
        radius: 2.3,
        prompt: () => (n.visible ? `Talk to ${n.lines[0].name}` : null),
        act: () => {
          n.greetCd = 6;
          n.ch.pose = 'wave';
          ui.dialogue(n.lines, () => (n.ch.pose = n.mode === 'drum' ? 'drum' : n.mode === 'dance' ? 'dance' : n.mode === 'sit' ? 'sit' : 'none'));
        },
      });
    }
    // food stalls: a short, skippable vignette — no hunger bar, just a treat
    const scenes: Record<string, { title: string; text: string; bn?: string; pose: Pose; sfx: () => void }> = {
      phuchka: { title: 'Fuchka!', bn: 'ফুচকা', text: 'Crack, fill, dunk — the fuchkawala hands you one perfect fuchka after another. Tangy, spicy, gone in one bite.', pose: 'eat', sfx: () => audio.eat() },
      cha: { title: 'A bhNar of cha', bn: 'চা', text: 'Steam curls from the little clay cup. You sip slowly while the street hums around you.', pose: 'eat', sfx: () => audio.sip() },
      jhalmuri: { title: 'Jhalmuri', bn: 'ঝালমুড়ি', text: 'A paper cone of puffed rice tossed with mustard oil and chilli. Crunchy, sharp, perfect for walking.', pose: 'eat', sfx: () => audio.eat() },
      mishti: { title: 'Mishti', bn: 'মিষ্টি', text: 'A soft, syrupy roshogolla. Sweet enough to make the whole night slow down.', pose: 'eat', sfx: () => audio.eat() },
      roll: { title: 'Kathi roll', bn: 'রোল', text: 'Hot off the tawa, wrapped in paper — you eat it walking, like everyone else.', pose: 'eat', sfx: () => audio.eat() },
      chowmein: { title: 'Chowmein', bn: 'চাউমিন', text: 'A paper plate of smoky Hakka noodles, cabbage, spring onion and far too much chilli sauce. Perfect.', pose: 'eat', sfx: () => audio.eat() },
    };
    for (const v of this.stallVendors) {
      const vendor = this.npcs.find((n) => n.role === 'vendor-' + v.id && n.pos.distanceTo(v.pos) < 0.5);
      sys.add({
        id: 'stall-' + v.id,
        pos: v.front,
        radius: 2.8,
        priority: 1.5, // at a stall counter, buying beats chatting to the queue
        prompt: () => (actions.is('eat-' + v.id) ? null : (v.id === 'cha' ? 'Drink cha' : `Eat ${scenes[v.id].title.replace('!', '')}`)),
        act: () => {
          const sc = scenes[v.id];
          const props: Record<string, PropKind> = { phuchka: 'leafbowl', roll: 'roll', chowmein: 'plate', cha: 'bhar', jhalmuri: 'leafbowl', mishti: 'leafbowl' };
          // face the counter and eat — no menus: the vendor's line and the taste as captions
          const yaw = Math.atan2(v.pos.x - player.pos.x, v.pos.z - player.pos.z);
          actions.start({ id: 'eat-' + v.id, pose: 'eat', prop: props[v.id], seconds: 5.5, place: { x: player.pos.x, z: player.pos.z, yaw } });
          if (vendor) {
            vendor.ch.pose = 'wave';
            setTimeout(() => (vendor.ch.pose = 'none'), 1500);
          }
          const line = vendor?.lines[0];
          if (line) ui.toast(line.text, { bn: line.bn, duration: 3 });
          setTimeout(() => ui.toast(sc.text, { bn: FOOD_HI[v.id] ? `${sc.bn} · ${FOOD_HI[v.id]}` : sc.bn, duration: 4 }), 1400);
          sc.sfx();
          setTimeout(() => sc.sfx(), 1800);
          setTimeout(() => sc.sfx(), 3600);
        },
      });
    }
    // sit on the plaza benches
    for (const bn of this.world.benches) {
      sys.add({
        id: 'bench',
        pos: new THREE.Vector3(bn.x + Math.sin(bn.yaw) * 0.9, 0, bn.z + Math.cos(bn.yaw) * 0.9),
        radius: 1.8,
        priority: 0.6,
        prompt: () => (actions.is('sit') ? null : 'Sit on the bench'),
        act: () => actions.start({ id: 'sit', pose: 'sit', place: { x: bn.x + Math.sin(bn.yaw) * 0.08, z: bn.z + Math.cos(bn.yaw) * 0.08, yaw: bn.yaw } }),
      });
    }
    // a selfie spot just outside each pandal's gate (the gate and its name board behind you)
    for (const [id, b] of this.builds) {
      const def = PANDALS.find((q) => q.id === id)!;
      const ox = b.gate.x - b.darshan.x, oz = b.gate.z - b.darshan.z, on = Math.hypot(ox, oz) || 1;
      const pos = new THREE.Vector3(b.gate.x + (ox / on) * 6, 0, b.gate.z + (oz / on) * 6);
      sys.add({
        id: 'photo-gate-' + id,
        pos,
        radius: 2.2,
        priority: 0.1,
        prompt: () => (actions.is('selfie') ? null : `Take a selfie at ${def.name}`),
        act: () => {
          // face away from the gate so it frames the shot behind you
          const yaw = Math.atan2(ox, oz);
          actions.start({ id: 'selfie', pose: 'photo', prop: 'phone', seconds: 3.5, place: { x: player.pos.x, z: player.pos.z, yaw } });
          this.onSelfie?.(def.name);
          setTimeout(() => {
            audio.click();
            ui.toast(`Click! You and ${def.name}, saved to the Memories page of your passport.`, { bn: 'ছবি · फ़ोटो' });
          }, 1400);
        },
      });
    }
    // the aarti: join in (folded hands) while a purohit waves the lamp before the protima
    for (const p of this.priests) {
      sys.add({
        id: 'aarti-' + p.id,
        pos: this.builds.get(p.id as PandalId)!.darshan,
        radius: 3.5,
        priority: 1.4,
        prompt: () => (this.aartiNow && !actions.is('aarti') ? 'Join the aarti' : null),
        act: () => {
          const yaw = Math.atan2(p.pos.x - player.pos.x, p.pos.z - player.pos.z);
          actions.start({ id: 'aarti', pose: 'pray', seconds: 6, place: { x: player.pos.x, z: player.pos.z, yaw } });
          audio.bell();
          ui.toast('The purohit circles the five-flamed lamp before Ma Durga; the dhak and the bells swell. You fold your hands.', { bn: 'আরতি · आरती', duration: 5 });
        },
      });
    }
    // pranam before the protima: folded hands at each pandal's viewing spot (a gesture, no reward)
    for (const [id, b] of this.builds) {
      const L = b.view.look, d = b.darshan;
      sys.add({
        id: 'pranam-' + id,
        pos: d,
        radius: 2.4,
        priority: 0.2,
        prompt: () => (actions.is('pranam') || this.aartiNow ? null : 'Offer pranam to Ma Durga'),
        act: () => {
          actions.start({ id: 'pranam', pose: 'pranam', seconds: 5.3, place: { x: player.pos.x, z: player.pos.z, yaw: Math.atan2(L.x - player.pos.x, L.z - player.pos.z) } });
          audio.bell();
          ui.toast('You fold your hands before Ma Durga. The dhak swells, the incense drifts.', { bn: 'প্রণাম', duration: 4 });
        },
      });
    }
    // join the dhunuchi naach with the dancers at Dhaker Taal
    for (const n of this.npcs.filter((q) => q.mode === 'dance')) {
      sys.add({
        id: 'dhunuchi',
        get pos() {
          return n.pos;
        },
        radius: 2.6,
        priority: 1.2,
        prompt: () => (actions.is('dhunuchi') ? null : 'Join the dhunuchi naach'),
        act: () => {
          actions.start({ id: 'dhunuchi', pose: 'dhunuchi', prop: 'dhunuchi' });
          ui.toast('You lift the dhunuchi and sway to the dhak — walk away to stop.', { bn: 'ধুনুচি নাচ' });
        },
      });
    }
    // hidden discoveries (optional)
    for (const s of SECRETS) {
      sys.add({
        id: 'secret-' + s.id,
        pos: new THREE.Vector3(s.x, 0, s.z),
        radius: s.r + 1,
        priority: 0.2,
        prompt: () => (progress.data.secrets.includes(s.id) ? null : `Look closer: ${s.title}`),
        act: () => {
          if (progress.findSecret(s.id)) {
            audio.chime();
            ui.info(`${s.title} — little discovery ${progress.data.secrets.length}/5`, s.text);
          }
        },
      });
    }
    // photo spots
    for (const ps of PHOTO_SPOTS) {
      sys.add({
        id: 'photo-' + ps.id,
        pos: new THREE.Vector3(ps.x, 0, ps.z),
        radius: 3,
        priority: 0.1,
        prompt: () => (actions.is('selfie') ? null : `Take a selfie — ${ps.title}`),
        act: () => {
          actions.start({ id: 'selfie', pose: 'photo', prop: 'phone', seconds: 3.5 });
          this.onSelfie?.(ps.title);
          setTimeout(() => {
            audio.click();
            ui.toast('Click! A Puja selfie, saved to the Memories page of your passport.', { bn: 'ছবি · फ़ोटो' });
          }, 1400);
        },
      });
    }
    // the finale viewpoint marker (only meaningful after all stamps)
    void FINALE_POINT;
  }

  celebrate(on: boolean) {
    this.celebrating = on;
    for (const n of this.npcs) {
      const d = Math.hypot(n.pos.x - FINALE_POINT.x, n.pos.z - FINALE_POINT.z);
      if (on && d < 40 && n.mode !== 'drum') n.ch.pose = this.rng.chance(0.5) ? 'wave' : 'clap';
      if (!on && (n.ch.pose === 'wave' || n.ch.pose === 'clap')) n.ch.pose = n.mode === 'sit' ? 'sit' : n.mode === 'dance' ? 'dance' : 'none';
    }
  }

  // ---------------------------------------------------------------- update
  private frame = 0;
  /** Walkers by 2 m cell, rebuilt each frame (for keeping a gap between them). */
  private walkGrid = new Map<number, Npc[]>();
  update(dt: number, t: number, player: THREE.Vector3, cam: THREE.Vector3, frustum?: THREE.Frustum) {
    this.frame++;
    for (const a of this.walkGrid.values()) a.length = 0; // reuse the cell arrays frame to frame
    for (const n of this.npcs) {
      if (n.mode !== 'walk' || Math.abs(n.pos.x - cam.x) + Math.abs(n.pos.z - cam.z) > 80) continue;
      const k = this.takenKey(n.pos.x, n.pos.z);
      let a = this.walkGrid.get(k);
      if (!a) this.walkGrid.set(k, (a = []));
      a.push(n);
    }
    for (const p of this.priests) {
      const on = this.aartiNow && Math.hypot(p.pos.x - player.x, p.pos.z - player.z) < 60;
      p.ch.group.visible = on;
      if (on) p.ch.update(dt, 0, 0);
    }
    for (const q of this.devotees) {
      const on = this.aartiNow && Math.hypot(q.pos.x - player.x, q.pos.z - player.z) < 45;
      q.ch.group.visible = on;
      if (on) q.ch.update(dt, 0, 0);
    }
    this.roadPeds = this.npcs.filter((n) => n.onRoad && (n.rank ?? 0) <= this.density && Math.abs(n.pos.x - player.x) + Math.abs(n.pos.z - player.z) < 90).map((n) => n.pos);
    const tmp = new THREE.Vector3();
    const sphere = new THREE.Sphere(new THREE.Vector3(), 1.6);
    for (const n of this.npcs) {
      const dc = Math.hypot(n.pos.x - cam.x, n.pos.z - cam.z);
      let vis = dc < 55; // beyond this the planet's curve hides people anyway
      if (vis && frustum) {
        // characters are drawn on the planet: test their mapped position against the view frustum
        toPlanet(n.pos.x, 1, n.pos.z, sphere.center);
        vis = frustum.intersectsSphere(sphere);
      }
      if (vis !== n.visible) {
        n.visible = vis;
        n.ch.group.visible = vis;
      }
      const shadow = dc < 18;
      if (shadow !== (n as any).shadow) {
        (n as any).shadow = shadow;
        n.ch.setShadows(shadow);
      }
      if (n.rank !== undefined && n.rank > this.density) {
        // not out yet (early evening) or gone home (small hours)
        if (n.visible) {
          n.visible = false;
          n.ch.group.visible = false;
        }
        continue;
      }
      let speed = 0;
      if (n.mode === 'walk' && n.path) {
        // advance along the path; turn around at the ends
        const i = Math.max(0, Math.min(n.path.length - 2, Math.floor(n.t)));
        const seg = n.path[i].distanceTo(n.path[i + 1]) || 1;
        // yield to the player: slow down and sidestep when close
        const dp = Math.hypot(n.pos.x - player.x, n.pos.z - player.z);
        const slow = dp < 2.2 ? 0.25 : 1;
        n.t += ((n.speed * slow * dt) / seg) * n.dir;
        if (n.t >= n.path.length - 1.01) n.dir = -1;
        if (n.t <= 0) n.dir = 1;
        n.t = Math.max(0, Math.min(n.path.length - 1.01, n.t));
        const j = Math.floor(n.t);
        tmp.lerpVectors(n.path[j], n.path[j + 1], n.t - j);
        // keep a decent gap: ease sideways round anyone standing in the way, and round other walkers
        if (dc < 60) {
          let px = 0, pz = 0;
          const gx = Math.floor(tmp.x / 2), gz = Math.floor(tmp.z / 2);
          for (let a = -1; a <= 1; a++)
            for (let b = -1; b <= 1; b++) {
              for (const o of this.taken.get(cellKey(gx + a, gz + b)) ?? NONE) {
                const dx = tmp.x + (n as any).ax - o.x, dz = tmp.z + (n as any).az - o.z, d = Math.hypot(dx, dz), want = o.r + 0.45;
                if (d < want && d > 1e-3) {
                  px += (dx / d) * (want - d);
                  pz += (dz / d) * (want - d);
                }
              }
              for (const o of this.walkGrid.get(cellKey(gx + a, gz + b)) ?? NONE_N) {
                if (o === n) continue;
                const dx = tmp.x + (n as any).ax - o.pos.x, dz = tmp.z + (n as any).az - o.pos.z, d = Math.hypot(dx, dz);
                if (d < 0.85 && d > 1e-3) {
                  px += (dx / d) * (0.85 - d) * 0.5;
                  pz += (dz / d) * (0.85 - d) * 0.5;
                }
              }
            }
          const k = Math.min(1, dt * 6);
          (n as any).ax = Math.max(-1.2, Math.min(1.2, (n as any).ax * (1 - k * 0.25) + px * k * 2));
          (n as any).az = Math.max(-1.2, Math.min(1.2, (n as any).az * (1 - k * 0.25) + pz * k * 2));
          tmp.x += (n as any).ax;
          tmp.z += (n as any).az;
        }
        if (dp < 1.6) {
          const away = new THREE.Vector3(n.pos.x - player.x, 0, n.pos.z - player.z).normalize().multiplyScalar(1.6 - dp);
          tmp.add(away);
        }
        const vx = tmp.x - n.pos.x, vz = tmp.z - n.pos.z;
        speed = Math.hypot(vx, vz) / Math.max(dt, 1e-4);
        if (speed > 0.2) n.yaw = dampAngle(n.yaw, Math.atan2(vx, vz), 8, dt);
        n.pos.x = tmp.x;
        n.pos.z = tmp.z;
      } else {
        // idle-type NPCs turn to greet the player when they come close
        const dp = Math.hypot(n.pos.x - player.x, n.pos.z - player.z);
        n.greetCd -= dt;
        const look = dp < 3.2 && n.mode !== 'drum' && n.mode !== 'dance' && n.mode !== 'sit' && n.mode !== 'eat';
        const target = look ? Math.atan2(player.x - n.pos.x, player.z - n.pos.z) : n.baseYaw;
        n.yaw = dampAngle(n.yaw, target, 4, dt);
        if (look && n.greetCd <= 0 && n.ch.pose === 'none' && n.mode !== 'vendor') {
          n.ch.pose = 'wave';
          n.greetCd = 12;
          setTimeout(() => n.ch.pose === 'wave' && !this.celebrating && (n.ch.pose = n.mode === 'pray' ? 'pray' : n.mode === 'photo' ? 'photo' : 'none'), 1800);
        }
      }
      if (!vis) continue;
      n.pos.y = lerp(n.pos.y, n.mode === 'sit' ? n.home.y - 0.7 + 0.25 : groundHeight(n.pos.x, n.pos.z), damp(10, dt));
      n.ch.group.position.copy(n.pos);
      n.ch.group.rotation.y = n.yaw;
      // animation level of detail: people further than 25 m animate every 2nd frame, beyond 40 m
      // every 3rd (with the time they skipped), which nobody can tell at that distance
      const every = dc > 40 ? 3 : dc > 25 ? 2 : 1;
      const acc = ((n as any).animDt ?? 0) + dt;
      if ((this.frame + (n as any).animSlot) % every === 0) {
        n.ch.update(acc, speed, 0);
        (n as any).animDt = 0;
      } else (n as any).animDt = acc;
    }
    // dhunuchi smoke: rising, swirling puffs (positions mapped onto the planet on the CPU)
    const pos = this.smoke.geometry.attributes.position as THREE.BufferAttribute;
    const col = this.smoke.geometry.attributes.color as THREE.BufferAttribute;
    const per = Math.max(1, Math.floor(pos.count / Math.max(1, this.smokeBase.length)));
    for (let i = 0; i < pos.count; i++) {
      const b = this.smokeBase[Math.floor(i / per) % Math.max(1, this.smokeBase.length)];
      if (!b) break;
      // puffs rise from the raised dhunuchi (about 2.3 m up), widen, drift and fade out
      const life = (t * 0.3 + i * 0.137) % 1;
      const x = b.x + Math.sin(i * 3.1 + t * 0.7) * (0.15 + 0.6 * life), y = b.y + 2.3 + life * 2.4, z = b.z + Math.cos(i * 1.7 + t * 0.6) * (0.15 + 0.6 * life);
      const m = this.world.mapPoint(x, y, z);
      pos.setXYZ(i, m.x, m.y, m.z);
      col.setW(i, Math.sin(life * Math.PI) * (1 - life * 0.4));
    }
    col.needsUpdate = true;
    pos.needsUpdate = true;
    for (const b of this.balloons) b.g.rotation.set(Math.sin(t * 0.9 + b.ph) * 0.06, Math.sin(t * 0.3 + b.ph) * 0.3, Math.cos(t * 0.8 + b.ph) * 0.06);
    // floating river lanterns bob and drift
    this.lanterns.forEach((l, i) => {
      l.position.y = -2.35 + Math.sin(t * 1.3 + i) * 0.05;
      l.position.x += Math.sin(t * 0.1 + i) * 0.004;
    });
    void unitBox;
  }
}

/** What a shopkeeper says, by trade, naming their shop. */
function shopLines(shop: ShopSign): DialogueLine[] {
  const name = shop.en.replace(/\b([A-Z])([A-Z']*)/g, (_, a: string, b: string) => a + b.toLowerCase()).replace("'S", "'s");
  const who = 'Dokandar';
  const say: Record<ShopKind, string> = {
    sweets: `Welcome to ${name}! Fresh rosogolla, nolen gurer sandesh and mishti doi — take a box home for the guests.`,
    tea: `${name} — cha in a bhaanr, five rupees. Sit, rest your feet, the night is long.`,
    telebhaja: `${name}: beguni, aloor chop, fuluri, hot from the kadai. Eat them with muri!`,
    rolls: `${name} — egg roll, chicken roll, double egg if you're hungry.`,
    fuchka: `${name} — how many? Teteul jol or doi?`,
    hotel: `${name}: bhaat, dal, aloo posto, macher jhol. Home taste, honest prices.`,
    biryani: `${name} — mutton biryani with the potato and the egg, fresh from the handi.`,
    books: `${name}. The new Pujabarshiki annuals are in — Anandamela, Shuktara, all of them!`,
    clothing: `${name} — tant, Dhakai, Baluchari… a new sari for Ashtami?`,
    general: `${name}. Everything for the house, and everything for the Pujo.`,
    gift: `${name} — gifts for everyone you love. We'll wrap it for free.`,
    puja: `${name}: dhunuchi, dhuno, conch, sindoor, everything for the puja.`,
    medical: `${name}. Walked too far tonight? Pain balm, ORS, plasters — we're open till late.`,
    photo: `${name} — a family photo in your Pujo best? Ready by Dashami.`,
    jewellers: `${name}. A pair of jhumkas for the festival? Come, sit, have a look.`,
    tailor: `${name}: Pujo orders all done… almost! Collect your panjabi tomorrow.`,
    cycle: `${name} — puncture? Five minutes. New bell? Ten rupees.`,
  };
  return [{ name: who, bn: shop.bn, text: say[shop.kind], tr: shop.en }];
}

/** 2 m grid cell → one number (no string keys in the per-frame loops). */
const cellKey = (gx: number, gz: number) => (gx + 512) * 1024 + (gz + 512);
const NONE: { x: number; z: number; r: number }[] = [];
const NONE_N: Npc[] = [];
