/**
 * Glue between pandal data, their 3D builds, interaction machines and progress.
 * Handles discovery (entering a pandal's grounds), contextual interactions per kind
 * (single / set / rhythm / match) and stamping — only after the interaction succeeds.
 */
import * as THREE from 'three';
import { PANDALS, PANDAL_BY_ID, type PandalId } from '../data/pandals';
import { createMachine, RhythmMachine, MatchMachine, type Machine } from '../interactions/machines';
import type { InteractionSystem } from '../interactions/InteractionSystem';
import type { PandalBuild } from '../world/pandals/common';
import type { Progress } from './Progress';

export interface PandalUI {
  toast(msg: string, opts?: { bn?: string; duration?: number }): void;
  discovered(id: PandalId): void;
  stamped(id: PandalId): void;
  rhythmCue(pattern: number[], onDone: () => void, onSkip: () => void, onCancel: () => void): void;
  rhythmListen(machine: RhythmMachine, onSkip: () => void): void;
  rhythmEnd(): void;
  pickPostcard(machine: MatchMachine, onPick: (cardId: string) => void): void;
  info(title: string, text: string): void;
}
export interface PandalAudio {
  bell(): void;
  chime(): void;
  dhak(accent?: boolean): void;
  stamp(): void;
  soft(): void;
}

export class PandalController {
  machines = new Map<PandalId, Machine>();
  inside: PandalId | null = null;
  time = 0;

  constructor(
    private builds: Map<PandalId, PandalBuild>,
    private progress: Progress,
    private interactions: InteractionSystem,
    private ui: PandalUI,
    private audio: PandalAudio,
  ) {
    for (const def of PANDALS) {
      this.machines.set(def.id, createMachine(def.interaction));
      const build = builds.get(def.id)!;
      for (const t of build.targets) {
        this.interactions.add({
          id: `${def.id}:${t.id}`,
          pos: t.pos,
          radius: t.radius,
          priority: 0.5,
          prompt: () => this.promptFor(def.id, t.id),
          act: () => this.act(def.id, t.id),
        });
      }
    }
  }

  /**
   * Whether a pandal's activity is done (its installation shows its finished state). The stamp is
   * separate — the entrance bell gives it at any time — except at Rajbarir Pujo, whose courtyard
   * bell is both the activity and the stamp.
   */
  isComplete(id: PandalId) {
    const bellIsActivity = !this.builds.get(id)!.targets.some((t) => t.id === 'stamp-bell');
    return this.machines.get(id)!.isComplete() || (bellIsActivity && this.progress.hasStamp(id));
  }

  promptFor(id: PandalId, target: string): string | null {
    // the entrance bell gives the stamp straight away; the pandal's activity is an optional extra
    if (target === 'stamp-bell') return this.progress.hasStamp(id) ? 'Ring the bell again' : 'Ring the bell — receive your stamp';
    if (target === 'bell' && this.progress.hasStamp(id)) return 'Ring the bell again';
    return this.machines.get(id)!.promptFor(target);
  }

  act(id: PandalId, target: string) {
    const build = this.builds.get(id)!;
    const m = this.machines.get(id)!;
    if (target === 'stamp-bell') {
      build.onActivate('stamp-bell');
      this.audio.bell();
      if (this.progress.stamp(id)) {
        this.audio.stamp();
        this.ui.stamped(id);
      }
      return;
    }
    if (target === 'bell' && this.progress.hasStamp(id)) {
      // revisiting Rajbarir Pujo's courtyard bell: a chime, never a second stamp
      build.onActivate(target);
      this.audio.bell();
      return;
    }
    if (m instanceof RhythmMachine) {
      if (m.phase === 'idle') {
        m.startListening();
        // one path for Skip button / K (any phase): close overlay, unfreeze, award
        const skip = () => {
          this.ui.rhythmEnd();
          this.finish(id, m.skip());
        };
        // Esc: close overlay, unfreeze, no award; the player can try again any time
        const cancel = () => {
          this.ui.rhythmEnd();
          m.phase = 'idle';
        };
        this.ui.rhythmCue(
          m.pattern,
          () => {
            if (m.isComplete() || m.phase !== 'listening') return;
            m.beginRepeat();
            this.ui.rhythmListen(m, skip);
          },
          skip,
          cancel,
        );
      } else if (m.phase === 'repeat') {
        this.audio.dhak(true);
        build.onActivate('dhak');
        const r = m.act('dhak', this.time);
        if (r.type === 'complete') {
          this.ui.rhythmEnd();
          this.finish(id, r);
        } else if (r.type === 'reject') {
          this.ui.rhythmEnd();
          this.ui.toast(r.message);
        }
      }
      return;
    }
    if (m instanceof MatchMachine && target === 'postcards') {
      this.audio.soft();
      this.ui.pickPostcard(m, (cardId) => {
        m.select(cardId);
        const c = m.cards.find((x) => x.id === cardId)!;
        this.ui.toast(`You picked up “${c.title}”. Find the scene it shows.`);
      });
      return;
    }
    const r = m.act(target, this.time);
    if (r.type === 'noop') return;
    build.onActivate(target);
    if (target === 'bell') this.audio.bell();
    else if (r.type !== 'reject') this.audio.chime();
    if (r.type === 'reject') {
      this.audio.soft();
      this.ui.toast(r.message);
      return;
    }
    // folk-art panels etc. carry a short info card
    const def = PANDAL_BY_ID[id];
    if (def.interaction.kind === 'set') {
      const t = def.interaction.targets.find((x) => x.id === target);
      if (t?.info) this.ui.info(t.prompt.replace(/^Look at the /, '').replace(/^./, (c) => c.toUpperCase()), t.info);
    }
    if (r.type === 'progress' && r.message) this.ui.toast(r.message);
    if (r.type === 'complete') this.finish(id, r);
  }

  private finish(id: PandalId, r: { type: string; message?: string }) {
    if (r.type !== 'complete') return;
    if (r.message) this.ui.toast(r.message, { duration: 4.5 });
    // every pandal except Rajbarir Pujo (whose courtyard bell *is* the activity) stamps at its
    // entrance bell, whenever you ring it; finishing the activity is its own reward
    if (this.builds.get(id)!.targets.some((t) => t.id === 'stamp-bell')) {
      if (!this.progress.hasStamp(id)) setTimeout(() => this.ui.toast('Ring the pandal bell by the entrance for your stamp, if you haven’t yet.', { duration: 4 }), 1800);
      return;
    }
    if (this.progress.stamp(id)) {
      this.audio.stamp();
      this.ui.stamped(id);
    }
  }

  /** Discovery + per-frame pandal animation. */
  update(dt: number, player: THREE.Vector3) {
    this.time += dt;
    let inside: PandalId | null = null;
    for (const def of PANDALS) {
      const d = Math.hypot(player.x - def.x, player.z - def.z);
      if (d < def.radius - 4) inside = def.id;
      const build = this.builds.get(def.id)!;
      // animated pieces only matter within sight (the planet's curve hides the rest)
      build.dynamic.visible = d < def.radius + 70;
      (build as { stamped?: boolean }).stamped = this.progress.hasStamp(def.id);
      build.update(this.time, dt, this.machines.get(def.id)!.doneTargets(), this.isComplete(def.id));
    }
    if (inside && inside !== this.inside && this.progress.discover(inside)) this.ui.discovered(inside);
    this.inside = inside;
  }

  /** Testing/debug: complete a pandal as if its interaction had succeeded. */
  debugComplete(id: PandalId) {
    if (this.progress.stamp(id)) {
      this.audio.stamp();
      this.ui.stamped(id);
    }
  }
}
