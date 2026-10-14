/**
 * Pure interaction state machines. One per pandal, created from its InteractionSpec.
 * They know nothing about rendering; the InteractionSystem feeds them player actions.
 */
import type { InteractionSpec } from '../data/pandals';

export type ActResult =
  | { type: 'progress'; message?: string }
  | { type: 'complete'; message: string }
  | { type: 'reject'; message: string }
  | { type: 'noop' };

export interface Machine {
  readonly kind: InteractionSpec['kind'];
  /** Interaction target ids that currently accept E. */
  activeTargets(): string[];
  /** Ids already activated (for visuals). */
  doneTargets(): string[];
  isComplete(): boolean;
  promptFor(targetId: string): string | null;
  act(targetId: string, now?: number): ActResult;
}

export class SingleMachine implements Machine {
  readonly kind = 'single' as const;
  private done = false;
  constructor(private spec: Extract<InteractionSpec, { kind: 'single' }>) {}
  activeTargets() {
    return this.done ? [] : [this.spec.targetId];
  }
  doneTargets() {
    return this.done ? [this.spec.targetId] : [];
  }
  isComplete() {
    return this.done;
  }
  promptFor(id: string) {
    return !this.done && id === this.spec.targetId ? this.spec.prompt : null;
  }
  act(id: string): ActResult {
    if (this.done || id !== this.spec.targetId) return { type: 'noop' };
    this.done = true;
    return { type: 'complete', message: this.spec.doneText };
  }
}

export class SetMachine implements Machine {
  readonly kind = 'set' as const;
  private activated = new Set<string>();
  constructor(private spec: Extract<InteractionSpec, { kind: 'set' }>) {}
  private remaining() {
    return this.spec.targets.filter((t) => !this.activated.has(t.id));
  }
  activeTargets() {
    const rem = this.remaining();
    if (this.spec.ordered) return rem.length ? [rem[0].id] : [];
    return rem.map((t) => t.id);
  }
  doneTargets() {
    return [...this.activated];
  }
  isComplete() {
    return this.remaining().length === 0;
  }
  promptFor(id: string) {
    if (!this.activeTargets().includes(id)) return null;
    return this.spec.targets.find((t) => t.id === id)?.prompt ?? null;
  }
  act(id: string): ActResult {
    if (!this.activeTargets().includes(id)) return { type: 'noop' };
    this.activated.add(id);
    const t = this.spec.targets.find((x) => x.id === id)!;
    if (this.isComplete()) return { type: 'complete', message: this.spec.doneText };
    const left = this.remaining().length;
    const info = t.info ? t.info + ' ' : '';
    return {
      type: 'progress',
      message: this.spec.ordered ? info || undefined : `${info}(${this.spec.targets.length - left}/${this.spec.targets.length})`,
    };
  }
}

/**
 * Rhythm: the dhaki plays `pattern` (beat offsets in seconds); the player taps it back.
 * Timing is judged on the *intervals* between taps, with a generous tolerance, so
 * absolute reaction time doesn't matter. Skipping always completes (accessibility).
 */
export class RhythmMachine implements Machine {
  readonly kind = 'rhythm' as const;
  private taps: number[] = [];
  private done = false;
  phase: 'idle' | 'listening' | 'repeat' = 'idle';
  attempts = 0;
  constructor(private spec: Extract<InteractionSpec, { kind: 'rhythm' }>) {}
  get pattern() {
    return this.spec.pattern;
  }
  activeTargets() {
    return this.done ? [] : ['dhak'];
  }
  doneTargets() {
    return this.done ? ['dhak'] : [];
  }
  isComplete() {
    return this.done;
  }
  promptFor(id: string) {
    if (this.done || id !== 'dhak') return null;
    return this.phase === 'repeat' ? 'Tap!' : this.spec.prompt;
  }
  /** Begin a round: the caller plays the cue, then calls beginRepeat(). */
  startListening() {
    this.phase = 'listening';
    this.taps = [];
  }
  beginRepeat() {
    this.phase = 'repeat';
    this.taps = [];
  }
  get tapCount() {
    return this.taps.length;
  }
  act(id: string, now = 0): ActResult {
    if (this.done || id !== 'dhak') return { type: 'noop' };
    if (this.phase !== 'repeat') return { type: 'noop' };
    this.taps.push(now);
    if (this.taps.length < this.spec.pattern.length) return { type: 'progress' };
    this.attempts++;
    this.phase = 'idle';
    if (judgeRhythm(this.spec.pattern, this.taps, this.spec.tolerance)) {
      this.done = true;
      return { type: 'complete', message: this.spec.doneText };
    }
    this.taps = [];
    return { type: 'reject', message: 'Almost! Listen once more — dhak… dhak-dhak.' };
  }
  skip(): ActResult {
    if (this.done) return { type: 'noop' };
    this.done = true;
    this.phase = 'idle';
    return { type: 'complete', message: this.spec.doneText };
  }
}

export function judgeRhythm(pattern: number[], taps: number[], tolerance: number): boolean {
  if (taps.length !== pattern.length) return false;
  for (let i = 1; i < pattern.length; i++) {
    const want = pattern[i] - pattern[i - 1];
    const got = taps[i] - taps[i - 1];
    if (Math.abs(got - want) > tolerance + want * 0.35) return false;
  }
  return true;
}

export class MatchMachine implements Machine {
  readonly kind = 'match' as const;
  selected: string | null = null;
  private placed = new Set<string>(); // card ids placed
  constructor(private spec: Extract<InteractionSpec, { kind: 'match' }>) {}
  get cards() {
    return this.spec.cards;
  }
  isPlaced(cardId: string) {
    return this.placed.has(cardId);
  }
  activeTargets() {
    if (this.isComplete()) return [];
    const lms = this.spec.landmarks.filter((l) => !this.placed.has(l.cardId)).map((l) => l.id);
    return ['postcards', ...lms];
  }
  doneTargets() {
    return this.spec.landmarks.filter((l) => this.placed.has(l.cardId)).map((l) => l.id);
  }
  isComplete() {
    return this.placed.size === this.spec.cards.length;
  }
  promptFor(id: string) {
    if (!this.activeTargets().includes(id)) return null;
    if (id === 'postcards') return this.selected ? 'Swap postcard' : 'Pick up a postcard';
    const lm = this.spec.landmarks.find((l) => l.id === id)!;
    return this.selected ? lm.prompt : 'Look at this scene (pick up a postcard first)';
  }
  select(cardId: string): boolean {
    if (this.placed.has(cardId) || !this.spec.cards.some((c) => c.id === cardId)) return false;
    this.selected = cardId;
    return true;
  }
  act(id: string): ActResult {
    if (id === 'postcards') return { type: 'progress' }; // UI opens the card picker
    const lm = this.spec.landmarks.find((l) => l.id === id);
    if (!lm || this.placed.has(lm.cardId)) return { type: 'noop' };
    if (!this.selected) return { type: 'reject', message: 'Pick up a postcard from the stand first.' };
    if (this.selected !== lm.cardId) {
      return { type: 'reject', message: 'Hmm, this postcard shows a different scene. Try another spot.' };
    }
    this.placed.add(lm.cardId);
    this.selected = null;
    if (this.isComplete()) return { type: 'complete', message: this.spec.doneText };
    return { type: 'progress', message: `Postcard placed (${this.placed.size}/${this.spec.cards.length}).` };
  }
}

export function createMachine(spec: InteractionSpec): Machine {
  switch (spec.kind) {
    case 'single':
      return new SingleMachine(spec);
    case 'set':
      return new SetMachine(spec);
    case 'rhythm':
      return new RhythmMachine(spec);
    case 'match':
      return new MatchMachine(spec);
  }
}
