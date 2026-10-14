/**
 * Unified interaction framework. Anything the player can press E on registers an Interactable;
 * each frame the system finds the best candidate (nearest, roughly in front of the player)
 * and exposes its prompt. Pandal stations, food stalls, NPCs and photo spots all use this.
 */
import * as THREE from 'three';

export interface Interactable {
  id: string;
  pos: THREE.Vector3; // flat
  radius: number;
  /** Prompt text, or null when currently unavailable. */
  prompt(): string | null;
  act(): void;
  /** Optional: prefer this when several overlap. */
  priority?: number;
}

export class InteractionSystem {
  items: Interactable[] = [];
  current: Interactable | null = null;

  add(i: Interactable) {
    this.items.push(i);
    return i;
  }

  update(player: THREE.Vector3, yaw: number) {
    let best: Interactable | null = null;
    let bestScore = Infinity;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (const it of this.items) {
      const dx = it.pos.x - player.x, dz = it.pos.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d > it.radius) continue;
      if (it.prompt() === null) continue;
      // facing bonus: things in front are preferred, but nothing is pixel-perfect
      const facing = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      const score = d - facing * 0.8 - (it.priority ?? 0);
      if (score < bestScore) {
        bestScore = score;
        best = it;
      }
    }
    this.current = best;
    return best;
  }

  trigger(): boolean {
    if (!this.current) return false;
    this.current.act();
    return true;
  }
}
