/**
 * Hand-authored city plan (metres; +x east, +z south toward the river).
 * Roads are smoothed polylines. Only prop placement is randomised (seeded), so the city is
 * coherent, testable and identical for every player with the same seed.
 */
export interface Road {
  id: string;
  pts: [number, number][];
  width: number;
  kind: 'main' | 'street' | 'lane';
  tram?: boolean;
  /** Festival light arches/strings along this road. */
  lights?: 'arches' | 'strings' | 'none';
}

export const ROADS: Road[] = [
  { id: 'bodhon-sarani', kind: 'main', width: 12, tram: true, lights: 'strings', pts: [[-172, -22], [-120, -24], [-70, -20], [-30, -10], [0, -6], [40, -10], [72, -12], [120, -18], [172, -16]] },
  { id: 'west-street', kind: 'street', width: 8, lights: 'strings', pts: [[-70, -150], [-72, -100], [-70, -60], [-70, -20], [-76, 20], [-82, 60], [-70, 92]] },
  { id: 'central-street', kind: 'street', width: 10, lights: 'arches', pts: [[0, -150], [2, -100], [-2, -60], [0, -6], [4, 30], [2, 70], [10, 92]] },
  { id: 'east-street', kind: 'street', width: 10, lights: 'strings', pts: [[74, -150], [76, -100], [72, -50], [72, -12], [76, 30], [72, 70], [66, 92]] },
  { id: 'alok-lane', kind: 'street', width: 8, lights: 'arches', pts: [[-70, -100], [-40, -96], [2, -100], [40, -96], [76, -100]] },
  { id: 'ghat-road', kind: 'main', width: 10, lights: 'strings', pts: [[-150, 90], [-110, 92], [-70, 92], [-30, 90], [10, 92], [66, 92], [110, 90], [160, 92]] },
  { id: 'bonedi-lane', kind: 'lane', width: 5.5, lights: 'strings', pts: [[-70, -58], [-84, -56], [-96, -58]] },
  { id: 'gram-lane', kind: 'lane', width: 5.5, lights: 'strings', pts: [[-80, 40], [-90, 48], [-100, 52]] },
  { id: 'bazaar-lane', kind: 'lane', width: 6, lights: 'strings', pts: [[4, 30], [-10, 34], [-22, 32]] },
  { id: 'dhak-lane', kind: 'lane', width: 6, lights: 'strings', pts: [[20, -8], [30, -12], [34, -15]] },
  { id: 'shobuj-lane', kind: 'lane', width: 6, lights: 'strings', pts: [[76, -80], [86, -82], [90, -82]] },
  { id: 'neel-lane', kind: 'lane', width: 6, lights: 'strings', pts: [[76, 30], [88, 36], [97, 38]] },
  { id: 'kumor-gali', kind: 'lane', width: 4, lights: 'none', pts: [[-70, 0], [-52, 4], [-36, 2], [-18, -6]] },
  { id: 'park-path', kind: 'lane', width: 5, lights: 'strings', pts: [[76, -50], [100, -45], [130, -40], [150, -30]] },
  { id: 'river-steps-west', kind: 'lane', width: 6, lights: 'none', pts: [[-110, 92], [-112, 104]] },
];

/** Open plazas (no buildings). */
export const PLAZAS: { x: number; z: number; r: number; name?: string }[] = [
  { x: -70, z: -20, r: 13, name: 'Anandapur Chowk' },
  { x: 0, z: -6, r: 16, name: 'Mela Maidan' },
  { x: 72, z: -12, r: 12 },
  { x: 2, z: -100, r: 12 },
  { x: 120, z: -30, r: 22, name: 'Notun Nagar Park' },
  { x: 60, z: 104, r: 14, name: 'Sunrise Ghat' },
  { x: -50, z: 104, r: 10 },
];

export const START = { x: -72, z: -30, yaw: Math.PI * 0.8 }; // near Chowk, looking toward Bonedi Bari

/** Finale viewing point on the ghat steps. */
export const FINALE_POINT = { x: 60, z: 106, r: 5 };

export const RIVER_Z = 112; // water begins
export const ISLAND_R = 196; // coastline radius of the island city
export const GHAT_TOP_Z = 98; // steps begin descending

/**
 * Raised platforms built over the ghat steps (the riverside DJ podium): inside one, the ground is
 * its flat top. Registered while the world is built.
 */
export const PODIUMS: { x: number; z: number; r: number; top: number }[] = [];

/**
 * Nodir Opare stands out in the river on a deck of wooden piles, reached by a footbridge from the
 * ghat. Both are level with the sixth ghat step (1.45 m below the promenade, about 0.9 m above
 * the water), so you step straight from the ghat onto the bridge.
 */
export const RIVER_PANDAL = {
  x: 0,
  deckY: -1.45,
  bridge: { hw: 1.6, z0: 108, z1: 124 },
  platform: { hw: 17, z0: 124, z1: 158 },
};
/** Walkable decks over the water (axis-aligned rectangles) with their top height. */
export const DECKS: { x0: number; x1: number; z0: number; z1: number; top: number }[] = [
  { x0: RIVER_PANDAL.x - RIVER_PANDAL.bridge.hw, x1: RIVER_PANDAL.x + RIVER_PANDAL.bridge.hw, z0: RIVER_PANDAL.bridge.z0, z1: RIVER_PANDAL.bridge.z1, top: RIVER_PANDAL.deckY },
  { x0: RIVER_PANDAL.x - RIVER_PANDAL.platform.hw, x1: RIVER_PANDAL.x + RIVER_PANDAL.platform.hw, z0: RIVER_PANDAL.platform.z0, z1: RIVER_PANDAL.platform.z1, top: RIVER_PANDAL.deckY },
];

/** Ground height: flat city, ghat steps descend toward the river, podiums and decks stand over them. */
export function groundHeight(x: number, z: number): number {
  for (const p of PODIUMS) if ((x - p.x) ** 2 + (z - p.z) ** 2 < p.r * p.r) return p.top;
  for (const d of DECKS) if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.top;
  if (z <= GHAT_TOP_Z) return 0;
  const t = Math.min(1, (z - GHAT_TOP_Z) / (RIVER_Z + 3 - GHAT_TOP_Z));
  const step = Math.floor(t * 9) / 9;
  return -step * 2.6;
}

/** Civic landmarks set in the city's open ground (statues and a mandir); built in props/landmarks.ts. */
export interface LandmarkDef {
  id: string;
  kind: 'netaji-salute' | 'netaji-point' | 'vivekananda' | 'tagore' | 'mandir';
  x: number;
  z: number;
  /** Ground kept clear around it. */
  r: number;
}
export const LANDMARKS: LandmarkDef[] = [
  { id: 'netaji-bazaar', kind: 'netaji-salute', x: -7, z: 16, r: 4.5 }, // Mela Bazaar, near the Chowk
  { id: 'netaji-notun', kind: 'netaji-point', x: 117, z: -6, r: 4.5 }, // Notun Nagar, on Bodhon Sarani
  { id: 'vivekananda', kind: 'vivekananda', x: -79, z: -32, r: 4.5 }, // Bonedi Para, by the west street
  { id: 'tagore', kind: 'tagore', x: 61, z: -108, r: 4.5 }, // Alok Pally
  { id: 'shiva-mandir', kind: 'mandir', x: 60, z: -158, r: 11 }, // the north edge of the city
];

/** Optional little discoveries (not required for progression). */
export const SECRETS: { id: string; x: number; z: number; r: number; title: string; text: string }[] = [
  { id: 'kumortuli', x: -44, z: 4, r: 6, title: 'Artisans’ Lane', text: 'Half-finished clay figures rest on straw frames. Their eyes will only be painted on the last day of work — the chokkhudan.' },
  { id: 'cat', x: -132, z: -8, r: 4, title: 'Rooftop Cat', text: 'A ginger cat naps on a warm balcony ledge, entirely unbothered by the dhak.' },
  { id: 'gramophone', x: 88, z: 64, r: 5, title: 'Old Gramophone', text: 'Someone has set a gramophone on a windowsill. A crackly Puja song plays for the whole lane.' },
  { id: 'postbox', x: 138, z: 70, r: 4, title: 'Red Pillar Box', text: 'An old red pillar box, stuffed with Sharodiya greeting cards.' },
  { id: 'boat', x: -96, z: 112, r: 6, title: 'Ferry Ghat', text: 'A ferryman dozes in his nouka, waiting for the dawn crossing.' },
];

/** Photo spots with a suggested camera framing (yaw/pitch). */
export const PHOTO_SPOTS: { id: string; x: number; z: number; yaw: number; pitch: number; title: string }[] = [
  { id: 'photo-arch', x: 2, z: -78, yaw: Math.PI, pitch: 0.15, title: 'Under the light arches' },
  { id: 'photo-ghat', x: 40, z: 102, yaw: 0, pitch: 0.05, title: 'River at night' },
  { id: 'photo-chowk', x: -60, z: -14, yaw: -Math.PI / 2, pitch: 0.1, title: 'Anandapur Chowk' },
];

/** Optional street experiences: id → location. */
export const STALLS: { id: 'phuchka' | 'cha' | 'jhalmuri' | 'mishti' | 'roll' | 'chowmein'; x: number; z: number; yaw: number }[] = [
  { id: 'phuchka', x: 14, z: 8, yaw: -Math.PI / 2 },
  { id: 'cha', x: -58, z: -30, yaw: -0.2 },
  { id: 'jhalmuri', x: -14, z: 14, yaw: Math.PI / 2 },
  { id: 'mishti', x: 14, z: 44, yaw: -Math.PI / 2 },
  { id: 'roll', x: 86, z: 8, yaw: Math.PI / 2 },
];
