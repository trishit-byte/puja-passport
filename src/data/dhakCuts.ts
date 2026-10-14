/**
 * Real dhak recordings (Wikimedia Commons, CC BY-SA — see public/assets/audio/CREDITS.txt) cut
 * into segments. Every pandal plays its own sequence of cuts, cross-fading from one to the next,
 * so each neighbourhood's dhakis sound different.
 */
export const DHAK_FILES = {
  D: { url: 'assets/audio/dhak-dhody.ogg', gain: 1.0, credit: '“Durga Puja Dhak Dhol” — Mamta Jagdish Dhody (CC BY-SA 4.0)' },
} as const;

export type DhakFile = keyof typeof DHAK_FILES;
export type Cut = [file: DhakFile, start: number, end: number];

/**
 * Cut lists per sound spot (pandal id, or 'chowk' for the street dhaki). All cuts come from the one
 * high-quality recording (98 s); every pandal gets its own sections in its own order.
 */
export const DHAK_CUTS: Record<string, Cut[]> = {
  'bonedi-bari': [['D', 2, 13], ['D', 61, 72]],
  'alor-utsav': [['D', 13, 24], ['D', 84, 95]],
  'gram-bangla': [['D', 24, 35], ['D', 50, 61]],
  'shobuj-swapno': [['D', 35, 46], ['D', 6, 17]],
  'dhaker-taal': [['D', 44, 56], ['D', 72, 84], ['D', 58, 70]],
  'neel-shagor': [['D', 56, 67], ['D', 19, 30]],
  'smritir-shohor': [['D', 67, 78], ['D', 30, 41]],
  'nodir-alo': [['D', 78, 89], ['D', 40, 51]],
  nakshatralok: [['D', 15, 26], ['D', 63, 74]],
  debaloy: [['D', 46, 57], ['D', 27, 38], ['D', 74, 85]],
  chowk: [['D', 87, 98], ['D', 9, 20]],
};
