/**
 * Selfie "memories": small JPEG snapshots kept in their own localStorage key (not in the save
 * schema, so a full or blocked storage never breaks progress). The newest nine are kept.
 */
export interface Memory {
  img: string; // data URL (JPEG, 320×180)
  at: string; // in-game clock, e.g. "9:40 PM"
  place: string;
}
const KEY = 'anandapur.memories';
const MAX = 9;

export function loadMemories(): Memory[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((m) => m && typeof m.img === 'string' && m.img.startsWith('data:image/')).slice(-MAX) : [];
  } catch {
    return [];
  }
}

export function addMemory(m: Memory): boolean {
  const list = [...loadMemories(), m].slice(-MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function clearMemories() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Downscale the WebGL canvas (just rendered) to a 320×180 cover-cropped JPEG. */
export function snapshot(src: HTMLCanvasElement): string {
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 180;
  const g = c.getContext('2d')!;
  const k = Math.max(320 / src.width, 180 / src.height);
  const w = src.width * k, h = src.height * k;
  g.drawImage(src, (320 - w) / 2, (180 - h) / 2, w, h);
  return c.toDataURL('image/jpeg', 0.78);
}
