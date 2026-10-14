/**
 * Player actions: small, physical things the player can do in the world with E (or the touch
 * action button) — eat at a stall, sip cha, dance at a DJ box or with the dhunuchi dancers, sit on
 * a bench, fold hands in pranam at a pandal, take a selfie. Each sets a pose on the character,
 * optionally puts a prop in the right hand, plays a sound, and ends after a while or as soon as
 * the player walks away.
 */
import * as THREE from 'three';
import type { Pose } from './Character';
import type { Player } from './Player';
import { toon, glow } from '../rendering/materials';

export type PropKind = 'leafbowl' | 'roll' | 'plate' | 'bhar' | 'phone' | 'dhunuchi' | 'pradip' | null;

export interface ActionSpec {
  id: string;
  pose: Pose;
  prop?: PropKind;
  /** Seconds; omit to keep going until the player moves. */
  seconds?: number;
  /** Optionally stand at a spot facing a direction first (bench, pandal railing). */
  place?: { x: number; z: number; yaw: number };
  onEnd?: () => void;
}

const m = (c: number) => toon(c, { paint: false });

export function makeProp(kind: PropKind): THREE.Object3D | null {
  if (!kind) return null;
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(x, y, z);
    o.rotation.set(rx, 0, rz);
    o.castShadow = false;
    g.add(o);
  };
  switch (kind) {
    case 'leafbowl': // a sal-leaf bowl with a fuchka in it
      add(new THREE.CylinderGeometry(0.07, 0.045, 0.035, 12), m(0x5a7a3a), 0, -0.03, 0.04);
      add(new THREE.SphereGeometry(0.03, 8, 6), m(0xe2b05a), 0, -0.005, 0.04);
      break;
    case 'roll': // kathi roll in a paper wrap
      add(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 10), m(0xf2e6c8), 0, 0.02, 0.04, 0, 0.2);
      add(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 10), m(0xe0b468), 0.012, 0.11, 0.04, 0, 0.2);
      break;
    case 'plate': // paper plate of chowmein
      add(new THREE.CylinderGeometry(0.1, 0.08, 0.015, 16), m(0xfaf6ea), 0, -0.03, 0.06);
      add(new THREE.SphereGeometry(0.07, 10, 6), m(0xe8c46a), 0, -0.015, 0.06);
      break;
    case 'bhar': // clay bhNar cup of cha
      add(new THREE.CylinderGeometry(0.03, 0.022, 0.06, 10), m(0xb5562f), 0, 0.0, 0.035);
      add(new THREE.CylinderGeometry(0.026, 0.026, 0.004, 10), m(0x8a5a3a), 0, 0.03, 0.035);
      break;
    case 'phone':
      add(new THREE.BoxGeometry(0.06, 0.12, 0.008), m(0x1a1a22), 0, 0.03, 0.03);
      add(new THREE.BoxGeometry(0.052, 0.105, 0.002), glow(0x9ab8ff, 1.2), 0, 0.03, 0.025);
      break;
    case 'pradip': {
      // pancha-pradip: a brass aarti lamp with five flames. Held up before the face, the forearm
      // points upward, so the lamp sits beyond the fingers (hand-local −y) with the flames above it
      const brass = m(0xc89a3a);
      add(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6), brass, 0, -0.04, 0.03); // handle in the grip
      add(new THREE.CylinderGeometry(0.05, 0.09, 0.03, 12), brass, 0, -0.13, 0.03); // the lamp plate
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        add(new THREE.SphereGeometry(0.018, 6, 4), glow(0xffb33c, 3), Math.cos(a) * 0.06, -0.165, 0.03 + Math.sin(a) * 0.06);
      }
      break;
    }
    case 'dhunuchi': {
      // a terracotta dhunuchi: a flared bowl on a stem with a foot, gripped by the stem. In the
      // dance the arm is raised, so the bowl sits beyond the fingers (hand-local −y) with its mouth
      // facing that way — upward — filled with dark coconut husk and a few dull embers
      const clay = m(0xa94e2a);
      add(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 12), clay, 0, 0.03, 0.03); // foot
      add(new THREE.CylinderGeometry(0.017, 0.022, 0.13, 8), clay, 0, -0.04, 0.03); // stem in the grip
      add(new THREE.CylinderGeometry(0.045, 0.115, 0.1, 14), clay, 0, -0.15, 0.03); // the bowl, flaring upward
      add(new THREE.CylinderGeometry(0.108, 0.108, 0.01, 14), m(0x2a2420), 0, -0.196, 0.03); // husk
      for (let k = 0; k < 4; k++) {
        const a = k * 1.7;
        add(new THREE.SphereGeometry(0.016, 6, 4), glow(0xff5a1a, 1.6), Math.cos(a) * 0.05, -0.203, 0.03 + Math.sin(a) * 0.05); // embers
      }
      g.userData.upright = true; // stays upright however the hand swings
      break;
    }
  }
  g.traverse((o) => (o.frustumCulled = false));
  return g;
}

export class PlayerActions {
  current: ActionSpec | null = null;
  private t = 0;
  private prop: THREE.Object3D | null = null;

  constructor(private player: Player) {}

  get busy() {
    return this.current !== null;
  }
  is(id: string) {
    return this.current?.id === id;
  }

  start(a: ActionSpec) {
    this.stop();
    this.current = a;
    this.t = 0;
    if (a.place) {
      this.player.ghost = a.pose === 'sit';
      this.player.teleport(a.place.x, a.place.z, a.place.yaw, a.pose === 'sit');
    }
    this.player.char.pose = a.pose;
    this.prop = makeProp(a.prop ?? null);
    if (this.prop) this.player.char.setProp(this.prop);
  }

  stop() {
    const a = this.current;
    if (!a) return;
    this.current = null;
    if (this.player.ghost) {
      // stand up in front of the bench
      this.player.ghost = false;
      this.player.teleport(this.player.pos.x + Math.sin(this.player.yaw) * 0.6, this.player.pos.z + Math.cos(this.player.yaw) * 0.6, this.player.yaw);
    }
    this.player.char.pose = 'none';
    this.player.char.setProp(null);
    this.prop = null;
    a.onEnd?.();
  }

  /** `moving` = the player is pushing a movement input this frame. */
  update(dt: number, moving: boolean) {
    const a = this.current;
    if (!a) return;
    this.t += dt;
    if (moving && (a.seconds === undefined || a.pose === 'sit' || this.t > 0.6)) this.stop();
    else if (a.seconds !== undefined && this.t >= a.seconds) this.stop();
  }
}
