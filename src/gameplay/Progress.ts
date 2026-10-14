/**
 * Pure progression model over SaveData: idempotent stamping, discovery, secrets and the finale gate.
 * Emits simple events so UI/audio can react without the model knowing about them.
 */
import { PANDAL_IDS, type PandalId } from '../data/pandals';
import type { SaveData } from '../save/SaveStore';

export type ProgressEvent =
  | { type: 'stamp'; id: PandalId; count: number }
  | { type: 'discover'; id: PandalId }
  | { type: 'secret'; id: string }
  | { type: 'all-stamps' }
  | { type: 'finale' };

export class Progress {
  private listeners: ((e: ProgressEvent) => void)[] = [];
  constructor(public data: SaveData) {}

  on(fn: (e: ProgressEvent) => void) {
    this.listeners.push(fn);
  }
  private emit(e: ProgressEvent) {
    for (const l of this.listeners) l(e);
  }

  get stampCount() {
    return this.data.stamps.length;
  }
  hasStamp(id: PandalId) {
    return this.data.stamps.includes(id);
  }
  isDiscovered(id: PandalId) {
    return this.data.discovered.includes(id);
  }
  get allStamps() {
    return PANDAL_IDS.every((id) => this.data.stamps.includes(id));
  }

  /** Award a stamp. Returns false (and does nothing) if already stamped — revisits never duplicate. */
  stamp(id: PandalId): boolean {
    if (!PANDAL_IDS.includes(id) || this.hasStamp(id)) return false;
    this.data.stamps.push(id);
    if (!this.isDiscovered(id)) this.data.discovered.push(id);
    this.emit({ type: 'stamp', id, count: this.stampCount });
    if (this.allStamps) this.emit({ type: 'all-stamps' });
    return true;
  }

  discover(id: PandalId): boolean {
    if (this.isDiscovered(id)) return false;
    this.data.discovered.push(id);
    this.emit({ type: 'discover', id });
    return true;
  }

  findSecret(id: string): boolean {
    if (this.data.secrets.includes(id)) return false;
    this.data.secrets.push(id);
    this.emit({ type: 'secret', id });
    return true;
  }

  /** The finale requires every stamp AND reaching the riverside viewpoint. */
  canTriggerFinale(atViewpoint: boolean) {
    return this.allStamps && atViewpoint;
  }

  completeFinale() {
    if (this.data.finaleSeen) return false;
    this.data.finaleSeen = true;
    this.emit({ type: 'finale' });
    return true;
  }
}
