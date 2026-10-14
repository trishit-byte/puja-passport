/** Player controller: camera-relative movement with acceleration, yaw smoothing, collision and ground follow. */
import * as THREE from 'three';
import { Character, type Look } from './Character';
import type { CollisionWorld } from '../world/collision';
import { groundHeight } from '../data/layout';
import { damp, dampAngle, lerp } from '../utils/math';

export const WALK = 3.6;
export const JOG = 6.4;
export const RADIUS = 0.38;

export class Player {
  char: Character;
  pos = new THREE.Vector3();
  vel = new THREE.Vector2();
  yaw = 0;
  speed = 0;
  jogging = false;
  frozen = false;
  /** While seated on a bench etc. the player sits inside the prop's collider. */
  ghost = false;
  /** Distance walked (stats / footsteps). */
  stepPhase = 0;
  onStep: (() => void) | null = null;

  constructor(look: Look, private colliders: CollisionWorld) {
    this.char = new Character(look);
  }

  get object() {
    return this.char.group;
  }

  teleport(x: number, z: number, yaw = this.yaw, exact = false) {
    const r = exact ? { x, z } : this.colliders.resolve(x, z, RADIUS);
    this.pos.set(r.x, groundHeight(r.x, r.z), r.z);
    this.yaw = yaw;
    this.vel.set(0, 0);
    this.sync();
  }

  update(dt: number, move: { x: number; y: number; jog: boolean }, fwd: { x: number; z: number }) {
    let wx = 0, wz = 0;
    if (!this.frozen) {
      // camera-relative: forward = fwd, right = (-fwd.z, fwd.x)
      wx = fwd.x * move.y + -fwd.z * move.x;
      wz = fwd.z * move.y + fwd.x * move.x;
    }
    const mag = Math.hypot(wx, wz);
    this.jogging = move.jog && mag > 0.1;
    const top = this.jogging ? JOG : WALK;
    const tx = mag > 0.01 ? (wx / Math.max(1, mag)) * top : 0;
    const tz = mag > 0.01 ? (wz / Math.max(1, mag)) * top : 0;
    const accel = mag > 0.01 ? 9 : 12;
    this.vel.x = lerp(this.vel.x, tx, damp(accel, dt));
    this.vel.y = lerp(this.vel.y, tz, damp(accel, dt));
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.y * dt;
    const r = this.ghost ? { x: nx, z: nz } : this.colliders.resolve(nx, nz, RADIUS);
    const realV = Math.hypot(r.x - this.pos.x, r.z - this.pos.z) / Math.max(dt, 1e-4);
    this.pos.x = r.x;
    this.pos.z = r.z;
    this.pos.y = lerp(this.pos.y, groundHeight(r.x, r.z), damp(14, dt));
    this.speed = Math.min(realV, Math.hypot(this.vel.x, this.vel.y));
    if (this.speed > 0.3) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.y), 11, dt);
    const prev = Math.floor(this.stepPhase);
    this.stepPhase += (this.speed * dt) / (this.jogging ? 0.95 : 0.7);
    if (Math.floor(this.stepPhase) !== prev && this.speed > 0.5) this.onStep?.();
    this.char.update(dt, this.speed, this.jogging ? 1 : 0);
    this.sync();
  }

  sync() {
    this.char.group.position.copy(this.pos);
    this.char.group.rotation.y = this.yaw;
  }
}
