/**
 * Orbiting third-person camera: critically damped follow, drag-to-orbit, wheel zoom, pitch clamp
 * allowing an upward look at tall pandals, and occlusion handling (pull in fast, ease out slowly).
 */
import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp } from '../utils/math';
import type { CollisionWorld } from '../world/collision';
import { toPlanet, normalAt } from '../utils/planet';

export class ThirdPersonCamera {
  yaw = Math.PI; // camera sits behind player looking along -z by default
  pitch = 0.3; // positive = looking down at player
  distance = 5.5;
  targetDistance = 5.5;
  private actualDist = 5.5;
  private lift = 0;
  private focus = new THREE.Vector3();
  private smoothedYaw = Math.PI;
  private smoothedPitch = 0.3;
  autoFollow = true;
  /** When set, the camera is driven externally (cinematics). */
  override: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  private idleT = 0;
  /** Flat-space camera position/target (gameplay space); the real camera is mapped onto the planet. */
  flatPos = new THREE.Vector3();
  flatLook = new THREE.Vector3();
  private upS = new THREE.Vector3(0, 1, 0);

  /** Place the real camera from flat-space position/target, with "up" following the planet surface. */
  private apply(dt: number) {
    toPlanet(this.flatPos.x, this.flatPos.y, this.flatPos.z, this.camera.position);
    const n = normalAt(this.flatLook.x, this.flatLook.z);
    this.upS.lerp(n, Math.min(1, dt * 8)).normalize();
    this.camera.up.copy(this.upS);
    this.camera.lookAt(toPlanet(this.flatLook.x, this.flatLook.y, this.flatLook.z));
  }

  constructor(public camera: THREE.PerspectiveCamera, private colliders: CollisionWorld) {}

  orbit(dx: number, dy: number, wheel: number) {
    if (dx || dy) this.idleT = 0;
    this.yaw -= dx * 0.005;
    this.pitch = clamp(this.pitch + dy * 0.004, -0.2, 1.15);
    if (wheel) this.targetDistance = clamp(this.targetDistance + wheel * 0.9, 4, 14);
  }

  snapBehind(playerYaw: number) {
    this.yaw = this.smoothedYaw = playerYaw + Math.PI;
  }

  /** Jump straight to the current target (no smoothing), e.g. after a teleport. */
  snapTo(target: THREE.Vector3) {
    this.focus.set(target.x, target.y + 1.45, target.z);
    this.smoothedYaw = this.yaw;
    this.smoothedPitch = this.pitch;
    this.distance = this.actualDist = this.targetDistance;
  }

  update(dt: number, target: THREE.Vector3, playerYaw: number, moving: boolean, reducedMotion: boolean) {
    // portrait: pull back and look down a touch more so the character sits in the lower-middle
    const portrait = this.camera.aspect < 1;
    const dMul = portrait ? 1.3 : 1;
    if (this.override) {
      this.flatPos.lerp(this.override.pos, damp(reducedMotion ? 20 : 2.2, dt));
      this.focus.lerp(this.override.look, damp(reducedMotion ? 20 : 2.2, dt));
      this.flatLook.copy(this.focus);
      this.apply(dt);
      return;
    }
    this.idleT += dt;
    // gently swing behind the player while walking if the user hasn't touched the camera recently
    if (this.autoFollow && moving && this.idleT > 1.2) {
      this.yaw = dampAngle(this.yaw, playerYaw + Math.PI, 0.9, dt);
    }
    this.smoothedYaw = dampAngle(this.smoothedYaw, this.yaw, 14, dt);
    this.smoothedPitch = lerp(this.smoothedPitch, this.pitch, damp(14, dt));
    this.distance = lerp(this.distance, this.targetDistance, damp(6, dt));
    const head = new THREE.Vector3(target.x, target.y + 1.45, target.z);
    this.focus.lerp(head, damp(12, dt));
    // occlusion: shorten distance to the first tall collider between focus and camera
    const cp = Math.cos(this.smoothedPitch);
    const dx = Math.sin(this.smoothedYaw) * cp, dz = Math.cos(this.smoothedYaw) * cp;
    const hl = Math.hypot(dx, dz) || 1;
    const hitH = this.colliders.raycast(this.focus.x, this.focus.z, dx / hl, dz / hl, this.distance * hl + 0.6, 4);
    // blocked by a wall: come in a little (never closer than 3 m) and rise to look over it,
    // so the view always stays a third-person shot of the character
    const allowed = Math.max(3, hitH / hl - 0.5);
    const want = Math.min(this.distance, allowed);
    const blocked = want < this.distance - 0.3;
    this.actualDist = lerp(this.actualDist, want, damp(want < this.actualDist ? 10 : 3, dt));
    this.lift = lerp(this.lift, blocked ? Math.min(3, (this.distance - want) * 0.6) : 0, damp(4, dt));
    const d = this.actualDist * dMul;
    const pos = new THREE.Vector3(
      this.focus.x + Math.sin(this.smoothedYaw) * cp * d,
      this.focus.y + Math.sin(this.smoothedPitch) * d + this.lift,
      this.focus.z + Math.cos(this.smoothedYaw) * cp * d,
    );
    pos.y = Math.max(pos.y, target.y + 0.35);
    this.flatPos.copy(pos);
    // look slightly above the head so the horizon and rooftops get more frame
    this.flatLook.copy(this.focus);
    this.flatLook.y += 0.35 - this.smoothedPitch * 0.2;
    this.apply(dt);
  }

  /** Horizontal forward direction (camera → focus), for camera-relative movement. */
  forward(): { x: number; z: number } {
    return { x: -Math.sin(this.smoothedYaw), z: -Math.cos(this.smoothedYaw) };
  }
}
