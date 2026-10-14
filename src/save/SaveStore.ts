/** Versioned, validated localStorage persistence. Pure apart from the injected Storage. */
import { PANDAL_IDS, type PandalId } from '../data/pandals';
import { REAL_DURATION } from '../gameplay/SimClock';

export const SAVE_KEY = 'anandapur.save';
export const SAVE_VERSION = 3;

export interface AudioSettings {
  master: number;
  music: number;
  ambient: number;
  muted: boolean;
}

export interface Settings {
  quality: 'low' | 'medium' | 'high';
  reducedMotion: boolean;
  guidance: boolean; // show exact pandal locations on map
  translations: boolean;
  subtitles: boolean;
}

export interface Outfit {
  style: 'kurta' | 'sari' | 'shirt' | 'salwar' | 'tee';
  color: number;
  accent: number;
  hair: 'short' | 'bun' | 'braid';
}

/**
 * Timed-challenge session. `elapsed` is active real seconds consumed (not a timestamp), so
 * reloading resumes with exactly the remaining time.
 *  none        — no night started yet
 *  active      — the timed night is in progress
 *  success     — all eight stamps collected before 4:00 AM (may still be roaming before the finale)
 *  failed      — 4:00 AM reached with stamps missing
 *  sightseeing — untimed free roam, separate from the challenge
 */
export type SessionStatus = 'none' | 'active' | 'success' | 'failed' | 'sightseeing';
export interface Session {
  elapsed: number;
  status: SessionStatus;
  /** Elapsed real seconds at which the eighth stamp was collected (success). */
  completedAt: number | null;
}

export interface SaveData {
  version: number;
  stamps: PandalId[];
  discovered: PandalId[];
  secrets: string[];
  player: { x: number; z: number; yaw: number } | null;
  outfit: Outfit;
  audio: AudioSettings;
  settings: Settings;
  finaleSeen: boolean;
  tutorialDone: boolean;
  session: Session;
}

export function defaultSave(prefersReducedMotion = false): SaveData {
  return {
    version: SAVE_VERSION,
    stamps: [],
    discovered: [],
    secrets: [],
    player: null,
    outfit: { style: 'kurta', color: 0xf4eedf, accent: 0xb3121f, hair: 'short' },
    audio: { master: 0.85, music: 0.85, ambient: 0.75, muted: false },
    settings: { quality: 'high', reducedMotion: prefersReducedMotion, guidance: false, translations: true, subtitles: true },
    finaleSeen: false,
    tutorialDone: false,
    session: { elapsed: 0, status: 'none', completedAt: null },
  };
}

const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const ids = (v: unknown): PandalId[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is PandalId => PANDAL_IDS.includes(x as PandalId)))] : [];

/** Validate / migrate arbitrary parsed JSON into a well-formed SaveData. Never throws. */
export function sanitize(raw: unknown, prefersReducedMotion = false): SaveData {
  const d = defaultSave(prefersReducedMotion);
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, any>;
  // v1 stored completed stamps under `completed`
  const stamps = ids(r.stamps ?? r.completed);
  const out: SaveData = {
    version: SAVE_VERSION,
    stamps,
    discovered: [...new Set([...ids(r.discovered), ...stamps])],
    secrets: Array.isArray(r.secrets) ? [...new Set(r.secrets.filter((s: unknown) => typeof s === 'string'))].slice(0, 32) : [],
    player:
      r.player && typeof r.player === 'object' && Number.isFinite(r.player.x) && Number.isFinite(r.player.z)
        ? { x: num(r.player.x, -400, 400, 0), z: num(r.player.z, -400, 400, 0), yaw: num(r.player.yaw, -10, 10, 0) }
        : null,
    outfit: {
      style: ['kurta', 'sari', 'shirt', 'salwar', 'tee'].includes(r.outfit?.style) ? r.outfit.style : d.outfit.style,
      color: num(r.outfit?.color, 0, 0xffffff, d.outfit.color),
      accent: num(r.outfit?.accent, 0, 0xffffff, d.outfit.accent),
      hair: ['short', 'bun', 'braid'].includes(r.outfit?.hair) ? r.outfit.hair : d.outfit.hair,
    },
    audio: {
      master: num(r.audio?.master, 0, 1, d.audio.master),
      music: num(r.audio?.music, 0, 1, d.audio.music),
      ambient: num(r.audio?.ambient, 0, 1, d.audio.ambient),
      muted: bool(r.audio?.muted, d.audio.muted),
    },
    settings: {
      quality: ['low', 'medium', 'high'].includes(r.settings?.quality) ? r.settings.quality : d.settings.quality,
      reducedMotion: bool(r.settings?.reducedMotion, d.settings.reducedMotion),
      guidance: bool(r.settings?.guidance, d.settings.guidance),
      translations: bool(r.settings?.translations, d.settings.translations),
      subtitles: bool(r.settings?.subtitles, d.settings.subtitles),
    },
    finaleSeen: bool(r.finaleSeen, false) && stamps.length === PANDAL_IDS.length,
    tutorialDone: bool(r.tutorialDone, false),
    session: {
      elapsed: num(r.session?.elapsed, 0, REAL_DURATION, 0),
      status: ['none', 'active', 'success', 'failed', 'sightseeing'].includes(r.session?.status) ? r.session.status : 'none',
      completedAt: typeof r.session?.completedAt === 'number' && Number.isFinite(r.session.completedAt) ? Math.min(REAL_DURATION, Math.max(0, r.session.completedAt)) : null,
    },
  };
  return out;
}

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export class SaveStore {
  constructor(private kv: KV | null, private prefersReducedMotion = false) {}
  /** Returns the save plus whether recovery happened (corrupt data). */
  load(): { data: SaveData; recovered: boolean; fresh: boolean } {
    let raw: string | null = null;
    try {
      raw = this.kv?.getItem(SAVE_KEY) ?? null;
    } catch {
      return { data: defaultSave(this.prefersReducedMotion), recovered: true, fresh: true };
    }
    if (raw == null) return { data: defaultSave(this.prefersReducedMotion), recovered: false, fresh: true };
    try {
      return { data: sanitize(JSON.parse(raw), this.prefersReducedMotion), recovered: false, fresh: false };
    } catch {
      return { data: defaultSave(this.prefersReducedMotion), recovered: true, fresh: true };
    }
  }
  save(d: SaveData): boolean {
    try {
      this.kv?.setItem(SAVE_KEY, JSON.stringify(d));
      return true;
    } catch {
      return false;
    }
  }
  reset(): void {
    try {
      this.kv?.removeItem(SAVE_KEY);
    } catch {
      /* storage unavailable */
    }
  }
}
