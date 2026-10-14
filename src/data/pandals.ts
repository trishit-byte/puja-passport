/**
 * Data-driven pandal definitions. Pure data — no Three.js imports — so game logic and tests
 * can use it directly. Geometry builders are looked up by `id` in src/world/pandals/index.ts.
 */
export type DistrictId = 'bonedi' | 'alok' | 'mela' | 'notun' | 'ghat';

export type InteractionSpec =
  | { kind: 'single'; targetId: string; prompt: string; doneText: string }
  | { kind: 'set'; targets: { id: string; prompt: string; info?: string }[]; ordered?: boolean; doneText: string }
  | { kind: 'rhythm'; pattern: number[]; tolerance: number; prompt: string; doneText: string }
  | {
      kind: 'match';
      cards: { id: string; title: string; caption: string }[];
      landmarks: { id: string; cardId: string; prompt: string }[];
      doneText: string;
    };

export interface PandalDef {
  id: PandalId;
  name: string;
  bn: string;
  /** Name in Devanagari script. */
  hi: string;
  roman: string;
  meaning: string;
  district: DistrictId;
  theme: string;
  /** Plot centre (world metres). */
  x: number;
  z: number;
  /** Yaw (radians) the entrance faces, i.e. direction from plot centre out through the gate. */
  facing: number;
  /** Floor height when the pandal stands on a raised deck (Nodir Opare, out in the river). */
  y?: number;
  radius: number;
  palette: { primary: number; secondary: number; accent: number; light: number };
  interaction: InteractionSpec;
  stamp: { id: string; label: string };
  blurb: string;
}

export type PandalId =
  | 'bonedi-bari'
  | 'alor-utsav'
  | 'gram-bangla'
  | 'shobuj-swapno'
  | 'dhaker-taal'
  | 'neel-shagor'
  | 'smritir-shohor'
  | 'nodir-alo'
  | 'nakshatralok'
  | 'debaloy';

export const PANDAL_IDS: PandalId[] = [
  'bonedi-bari',
  'alor-utsav',
  'gram-bangla',
  'shobuj-swapno',
  'dhaker-taal',
  'neel-shagor',
  'smritir-shohor',
  'nodir-alo',
  'nakshatralok',
  'debaloy',
];

export const PANDALS: PandalDef[] = [
  {
    id: 'bonedi-bari',
    name: 'Rajbarir Pujo',
    bn: 'রাজবাড়ির পুজো',
    hi: 'राजबाड़ीर पूजो',
    roman: 'Rajbarir Pujo',
    meaning: 'The Royal Courtyard',
    district: 'bonedi',
    theme: 'A traditional Pujo in an old zamindar mansion',
    x: -118,
    z: -58,
    facing: Math.PI / 2, // gate opens east
    radius: 21,
    palette: { primary: 0xe3c68c, secondary: 0xb5562f, accent: 0xb3121f, light: 0xffd89a },
    interaction: {
      kind: 'single',
      targetId: 'bell',
      prompt: 'Ring the visitors’ bell',
      doneText: 'The bell’s soft chime drifts across the courtyard.',
    },
    stamp: { id: 'mansion', label: 'Heritage mansion' },
    blurb: 'A grand traditional Durga Puja inside an old Bengali zamindar mansion, with elegant pillars and classic decorations. The goddess stands in the pillared thakur dalan.',
  },
  {
    id: 'alor-utsav',
    name: 'Alor Thikana',
    bn: 'আলোর ঠিকানা',
    hi: 'आलोर ठिकाना',
    roman: 'Alor Thikana',
    meaning: 'Where Light Lives',
    district: 'alok',
    theme: 'Lamps, glowing arches and light installations',
    x: -4,
    z: -118,
    facing: 0, // gate opens south (+z)
    radius: 21,
    palette: { primary: 0xffc93c, secondary: 0x8a5a2b, accent: 0xff7a1a, light: 0xffe8b0 },
    interaction: {
      kind: 'set',
      targets: [
        { id: 'sculpt-1', prompt: 'Light the peacock sculpture' },
        { id: 'sculpt-2', prompt: 'Light the lotus sculpture' },
        { id: 'sculpt-3', prompt: 'Light the conch sculpture' },
      ],
      doneText: 'All three sculptures glow — the whole bamboo hall shimmers gold.',
    },
    stamp: { id: 'lantern', label: 'Golden lantern' },
    blurb: 'A spectacular pandal of thousands of hanging lamps, glowing arches and elaborate light installations, in the spirit of Bengal’s famed light-artisans.',
  },
  {
    id: 'gram-bangla',
    name: 'Matir Taan',
    bn: 'মাটির টান',
    hi: 'माटीर टान',
    roman: 'Matir Tan',
    meaning: 'The Call of the Earth',
    district: 'bonedi',
    theme: 'Rural Bengal: terracotta, clay, folk painting and village architecture',
    x: -122,
    z: 52,
    facing: Math.PI / 2,
    radius: 21,
    palette: { primary: 0xc9a46a, secondary: 0xb5562f, accent: 0x2f6b4e, light: 0xffcf8a },
    interaction: {
      kind: 'set',
      targets: [
        {
          id: 'panel-pat',
          prompt: 'Look at the patachitra scroll',
          info: 'Patachitra: painted scrolls that patuas unroll while singing the story, panel by panel.',
        },
        {
          id: 'panel-terracotta',
          prompt: 'Look at the terracotta panel',
          info: 'Terracotta: carved brick panels like those on Bishnupur’s temples, showing epics and daily life.',
        },
        {
          id: 'panel-dokra',
          prompt: 'Look at the dokra figures',
          info: 'Dokra: lost-wax brass figures — horses, elephants, musicians — cast by rural metalsmiths.',
        },
      ],
      doneText: 'You’ve seen all three crafts. The village courtyard hums with folk songs.',
    },
    stamp: { id: 'folk', label: 'Folk-art fish' },
    blurb: 'A rural Bengal pandal of terracotta art, clay sculptures, folk paintings and village architecture.',
  },
  {
    id: 'shobuj-swapno',
    name: 'Aranyer Ahoban',
    bn: 'অরণ্যের আহ্বান',
    hi: 'अरण्येर आह्वान',
    roman: 'Oronner Ahoban',
    meaning: 'Call of the Forest',
    district: 'notun',
    theme: 'An enchanted forest',
    x: 112,
    z: -82,
    facing: -Math.PI / 2, // opens west
    radius: 22,
    palette: { primary: 0x3fae5a, secondary: 0x1f5e3a, accent: 0xb6f08a, light: 0xb8ffb0 },
    interaction: {
      kind: 'set',
      targets: [
        { id: 'glow-1', prompt: 'Wake the firefly lantern' },
        { id: 'glow-2', prompt: 'Wake the dewdrop lantern' },
        { id: 'glow-3', prompt: 'Wake the seed lantern' },
      ],
      doneText: 'The great tree breathes light from root to crown.',
    },
    stamp: { id: 'leaf', label: 'Green leaf' },
    blurb: 'An enchanted forest pandal of monumental trees, glowing plants and birds, its great tree of life breathing light.',
  },
  {
    id: 'dhaker-taal',
    name: 'Dhaker Taale',
    bn: 'ঢাকের তালে',
    hi: 'ढाकेर ताले',
    roman: 'Dhaker Tale',
    meaning: 'To the Beat of the Dhak',
    district: 'mela',
    theme: 'Bengali music, the dhak and dance',
    x: 34,
    z: -36,
    facing: Math.PI, // opens north (-z) toward main road
    radius: 20,
    palette: { primary: 0xd9381e, secondary: 0xf4eedf, accent: 0xffc93c, light: 0xffb36b },
    interaction: {
      kind: 'rhythm',
      pattern: [0, 0.5, 1.0],
      tolerance: 0.28,
      prompt: 'Tap along with the dhaki',
      doneText: 'The dhaki grins and nods — you kept the beat!',
    },
    stamp: { id: 'dhak', label: 'Dhak drum' },
    blurb: 'A pandal celebrating Bengali music, the traditional dhak and dance: giant painted dhaks frame the hall and you can drum along.',
  },
  {
    id: 'neel-shagor',
    name: 'Neel Swapno',
    bn: 'নীল স্বপ্ন',
    hi: 'नील स्वप्नो',
    roman: 'Nil Shopno',
    meaning: 'The Blue Dream',
    district: 'notun',
    theme: 'An ocean dream',
    x: 118,
    z: 38,
    facing: -Math.PI / 2,
    radius: 21,
    palette: { primary: 0x1a5fb4, secondary: 0x0b2a5b, accent: 0x5ef2ff, light: 0x7fe8ff },
    interaction: {
      kind: 'single',
      targetId: 'pearl',
      prompt: 'Touch the glowing pearl',
      doneText: 'The pearl glows and a shoal of paper fish swirls overhead.',
    },
    stamp: { id: 'shell', label: 'Pearl shell' },
    blurb: 'A magical ocean-inspired pandal of suspended fish, flowing blue fabrics and underwater scenery.',
  },
  {
    id: 'smritir-shohor',
    name: 'Smritir Shohor',
    bn: 'স্মৃতির শহর',
    hi: 'स्मृतिर शोहोर',
    roman: 'Smritir Shohor',
    meaning: 'City of Memories',
    district: 'mela',
    theme: 'Nostalgia for old Kolkata',
    x: -30,
    z: 52,
    facing: 0,
    radius: 21,
    palette: { primary: 0xd9a5a0, secondary: 0x3f6b4e, accent: 0xe3c68c, light: 0xffe0a8 },
    interaction: {
      kind: 'match',
      cards: [
        { id: 'card-tram', title: 'The old tram', caption: 'A green-and-cream tram rattling past' },
        { id: 'card-clock', title: 'The clock tower', caption: 'A market clock tower at dusk' },
        { id: 'card-cha', title: 'The tea corner', caption: 'Steam over clay cups at a corner stall' },
      ],
      landmarks: [
        { id: 'lm-tram', cardId: 'card-tram', prompt: 'Place a postcard by the miniature tram' },
        { id: 'lm-clock', cardId: 'card-clock', prompt: 'Place a postcard by the clock tower' },
        { id: 'lm-cha', cardId: 'card-cha', prompt: 'Place a postcard by the tea corner' },
      ],
      doneText: 'Every postcard is home. An old radio starts to crackle a tune.',
    },
    stamp: { id: 'tram', label: 'Miniature tram' },
    blurb: 'A nostalgic old Kolkata of trams, bookshops, historic streets and traditional city life.',
  },
  {
    id: 'nodir-alo',
    name: 'Nodir Opare',
    bn: 'নদীর ওপারে',
    hi: 'नोदीर ओपारे',
    roman: 'Nodir Opare',
    meaning: 'Across the River',
    district: 'ghat',
    theme: 'The riverside: ghats, boats, reflections and floating lights',
    x: 0,
    z: 141,
    y: -1.45,
    facing: Math.PI, // out in the river; the gate opens north onto the footbridge from the ghat
    radius: 17,
    palette: { primary: 0xf6a21e, secondary: 0x103b45, accent: 0xffe8b0, light: 0xffd38a },
    interaction: {
      kind: 'set',
      ordered: true,
      targets: [
        { id: 'lamp-take', prompt: 'Take a clay lamp from the volunteer' },
        { id: 'lamp-place', prompt: 'Float your lamp on the river from the landing' },
      ],
      doneText: 'Your little flame joins hundreds of others, shimmering on the water.',
    },
    stamp: { id: 'river-lamp', label: 'River lantern' },
    blurb: 'A riverside pandal of illuminated ghats, boats, reflections and floating-light installations.',
  },
  {
    id: 'nakshatralok',
    name: 'Nakshatralok',
    bn: 'নক্ষত্রলোক',
    hi: 'नक्षत्रलोक',
    roman: 'Nokkhotrolok',
    meaning: 'Realm of Stars',
    district: 'alok',
    theme: 'The heavens: constellations, planets and a moonlit dome',
    x: -34,
    z: -160,
    facing: 0, // opens south, toward the city
    radius: 17,
    palette: { primary: 0x1b2a5a, secondary: 0x0d1430, accent: 0xc0d8ff, light: 0xbfd4ff },
    interaction: {
      kind: 'set',
      targets: [
        { id: 'star-saptarshi', prompt: 'Light the Saptarshi — the seven sages (Great Bear)' },
        { id: 'star-kalpurush', prompt: 'Light the Kalpurush — the hunter (Orion)' },
        { id: 'star-dhruva', prompt: 'Light the Dhruvatara — the pole star' },
      ],
      doneText: 'The three constellations blaze, and the whole starry dome begins to twinkle.',
    },
    stamp: { id: 'star', label: 'Pole star' },
    blurb: 'A celestial pandal of constellations, planetary sculptures and a moonlit dome of a thousand star lights, where the Saptarshi, the Kalpurush and the Dhruvatara wait to be lit.',
  },
  {
    id: 'debaloy',
    name: 'Debaloy',
    bn: 'দেবালয়',
    hi: 'देबालय',
    roman: 'Debaloy',
    meaning: 'Abode of the Divine',
    district: 'bonedi',
    theme: 'A grand temple: carved architecture and a ceremonial entrance',
    x: -158,
    z: 6,
    facing: Math.PI, // opens north, onto Bodhon Sarani
    radius: 17,
    palette: { primary: 0xb3121f, secondary: 0x8a6a4a, accent: 0xd4af37, light: 0xffd89a },
    interaction: {
      kind: 'set',
      ordered: true,
      targets: [
        { id: 'shankha', prompt: 'Blow the shankha at the temple gate' },
        { id: 'deepastambha', prompt: 'Light the deepastambha, the lamp tower' },
        { id: 'pushpanjali', prompt: 'Offer flowers at the bedi (pushpanjali)' },
      ],
      doneText: 'The conch sounds, the lamp tower blazes, and your flowers join the Ashtami anjali.',
    },
    stamp: { id: 'temple', label: 'Temple shikhara' },
    blurb: 'A majestic temple pandal of intricate carved architecture and traditional ornamentation, an imposing ceremonial entrance, and a grand Durga Pratima beneath a towering shikhara.',
  },
];

export const PANDAL_BY_ID: Record<PandalId, PandalDef> = Object.fromEntries(
  PANDALS.map((p) => [p.id, p]),
) as Record<PandalId, PandalDef>;

export interface DistrictDef {
  id: DistrictId;
  name: string;
  bn: string;
  x: number;
  z: number;
  /** Map tint. */
  color: string;
}

export const DISTRICTS: DistrictDef[] = [
  { id: 'bonedi', name: 'Bonedi Para', bn: 'বনেদি পাড়া', x: -112, z: -5, color: '#e3c68c' },
  { id: 'alok', name: 'Alok Pally', bn: 'আলোক পল্লী', x: 0, z: -105, color: '#ffc93c' },
  { id: 'mela', name: 'Mela Bazaar', bn: 'মেলা বাজার', x: 0, z: 10, color: '#f28c28' },
  { id: 'notun', name: 'Notun Nagar', bn: 'নতুন নগর', x: 112, z: -20, color: '#7fd1c7' },
  { id: 'ghat', name: 'Nodi Ghat', bn: 'নদী ঘাট', x: 20, z: 100, color: '#8fb8de' },
];

export function districtAt(x: number, z: number): DistrictId {
  if (z > 80 || (z > 52 && x > 16 && x < 62)) return 'ghat';
  if (x < -62) return 'bonedi';
  if (x > 70) return 'notun';
  if (z < -70) return 'alok';
  return 'mela';
}
