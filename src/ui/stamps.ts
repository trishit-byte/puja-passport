/**
 * Original illustrated passport stamps (inline SVG). Per the cultural checklist, stamps depict each
 * pandal's architecture or theme motif — never the goddess's face.
 */
import type { PandalId } from '../data/pandals';

const frame = (inner: string, color: string, bn: string) => `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs><filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.6"/></filter></defs>
  <g filter="url(#rough)" fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="60" cy="60" r="54" stroke-width="4"/>
    <circle cx="60" cy="60" r="47" stroke-width="1.6" stroke-dasharray="3 3"/>
    ${inner}
    <path id="arc" d="M 22 66 A 38 38 0 0 0 98 66" stroke="none"/>
  </g>
  <text font-family="'Baloo Da 2', 'Noto Sans Bengali', sans-serif" font-weight="800" font-size="11" fill="${color}" text-anchor="middle"><textPath href="#arc" startOffset="50%">${bn}</textPath></text>
</svg>`;

export const STAMP_ART: Record<PandalId, { svg: string; color: string }> = {
  'bonedi-bari': {
    color: '#b3121f',
    svg: frame(`
      <path d="M30 78 h60 M34 78 v-26 h52 v26 M34 52 l26 -16 l26 16" stroke-width="3"/>
      <path d="M40 78 v-18 a5 5 0 0 1 10 0 v18 M55 78 v-18 a5 5 0 0 1 10 0 v18 M70 78 v-18 a5 5 0 0 1 10 0 v18" stroke-width="2.4"/>
      <path d="M44 46 h32" stroke-width="2"/><circle cx="60" cy="42" r="3" stroke-width="2"/>`, '#b3121f', 'রাজবাড়ির পুজো'),
  },
  'alor-utsav': {
    color: '#c77a00',
    svg: frame(`
      <path d="M60 28 v8 M50 36 h20 l-4 6 h-12 z" stroke-width="2.6"/>
      <path d="M48 42 q-6 16 0 30 h24 q6 -14 0 -30 z" stroke-width="3"/>
      <path d="M52 50 h16 M51 58 h18 M52 66 h16" stroke-width="1.8"/>
      <path d="M54 72 l-2 8 h16 l-2 -8" stroke-width="2.4"/>
      <path d="M36 50 l-6 -3 M84 50 l6 -3 M34 62 h-7 M86 62 h7 M38 74 l-6 4 M82 74 l6 4" stroke-width="2.2"/>`, '#c77a00', 'আলোর ঠিকানা'),
  },
  'gram-bangla': {
    color: '#2f6b4e',
    svg: frame(`
      <path d="M30 62 q14 -18 34 -6 q12 8 26 -4 q-6 14 -26 16 q-20 2 -34 -6 z" stroke-width="3"/>
      <circle cx="40" cy="58" r="2.6" fill="#2f6b4e"/>
      <path d="M52 56 q4 6 0 12 M60 55 q4 7 0 14 M68 56 q4 6 0 12" stroke-width="1.8"/>
      <path d="M90 52 l8 -6 v16 z" stroke-width="2.4"/>
      <path d="M40 80 q20 6 40 0" stroke-width="2"/>`, '#2f6b4e', 'মাটির টান'),
  },
  'shobuj-swapno': {
    color: '#2f8a3a',
    svg: frame(`
      <path d="M60 84 q-30 -14 -18 -46 q12 -8 18 -10 q6 2 18 10 q12 32 -18 46 z" stroke-width="3"/>
      <path d="M60 84 v-54" stroke-width="2.4"/>
      <path d="M60 44 l-10 -6 M60 54 l-13 -7 M60 64 l-12 -6 M60 44 l10 -6 M60 54 l13 -7 M60 64 l12 -6" stroke-width="1.8"/>`, '#2f8a3a', 'অরণ্যের আহ্বান'),
  },
  'dhaker-taal': {
    color: '#b3121f',
    svg: frame(`
      <ellipse cx="44" cy="62" rx="7" ry="16" stroke-width="2.6"/>
      <ellipse cx="80" cy="62" rx="7" ry="16" stroke-width="2.6"/>
      <path d="M44 46 h36 M44 78 h36" stroke-width="2.6"/>
      <path d="M50 46 l10 32 l10 -32 l10 32" stroke-width="1.6"/>
      <path d="M62 44 q-4 -10 2 -18 q2 8 6 8 q-2 -8 4 -12 q2 10 -2 22" stroke-width="2"/>`, '#b3121f', 'ঢাকের তালে'),
  },
  'neel-shagor': {
    color: '#1a5fb4',
    svg: frame(`
      <path d="M36 72 q24 -44 48 0 z" stroke-width="3"/>
      <path d="M60 72 v-26 M48 72 l8 -22 M72 72 l-8 -22 M42 72 l14 -16 M78 72 l-14 -16" stroke-width="1.6"/>
      <circle cx="60" cy="80" r="5" stroke-width="2.4"/>
      <path d="M30 44 q6 -4 12 0 q-6 4 -12 0 z M86 38 q6 -4 12 0 q-6 4 -12 0 z" stroke-width="1.8"/>`, '#1a5fb4', 'নীল স্বপ্ন'),
  },
  'smritir-shohor': {
    color: '#3f6b4e',
    svg: frame(`
      <rect x="32" y="48" width="56" height="24" rx="4" stroke-width="3"/>
      <path d="M32 58 h56" stroke-width="1.6"/>
      <rect x="38" y="51" width="8" height="5" stroke-width="1.6"/><rect x="50" y="51" width="8" height="5" stroke-width="1.6"/><rect x="62" y="51" width="8" height="5" stroke-width="1.6"/><rect x="74" y="51" width="8" height="5" stroke-width="1.6"/>
      <circle cx="42" cy="76" r="4" stroke-width="2.4"/><circle cx="78" cy="76" r="4" stroke-width="2.4"/>
      <path d="M60 48 l-6 -14 M60 48 l6 -14 M48 34 h24" stroke-width="2"/>
      <path d="M26 82 h68" stroke-width="2"/>`, '#3f6b4e', 'স্মৃতির শহর'),
  },
  'nodir-alo': {
    color: '#c46a1e',
    svg: frame(`
      <path d="M44 66 q16 10 32 0 l-4 -6 h-24 z" stroke-width="3"/>
      <path d="M60 58 q-6 -8 0 -18 q6 10 0 18 z" stroke-width="2.4"/>
      <path d="M28 76 q8 -4 16 0 t16 0 t16 0 t16 0 M34 84 q8 -4 16 0 t16 0 t16 0" stroke-width="2"/>`, '#c46a1e', 'নদীর ওপারে'),
  },
  nakshatralok: {
    color: '#2a4a9a',
    svg: frame(`
      <path d="M60 30 l5 13 h14 l-11 8 l4 14 l-12 -8 l-12 8 l4 -14 l-11 -8 h14 z" stroke-width="3"/>
      <path d="M30 70 l8 -4 l9 3 l8 -2 M55 67 l6 6 l8 -3 l-1 -8 z" stroke-width="1.8"/>
      <circle cx="30" cy="70" r="1.8" fill="#2a4a9a"/><circle cx="38" cy="66" r="1.8" fill="#2a4a9a"/><circle cx="47" cy="69" r="1.8" fill="#2a4a9a"/><circle cx="55" cy="67" r="1.8" fill="#2a4a9a"/>
      <path d="M80 72 a8 8 0 1 0 6 -12 a6 6 0 1 1 -6 12 z" stroke-width="2.2"/>`, '#2a4a9a', 'নক্ষত্রলোক'),
  },
  debaloy: {
    color: '#8a1a1a',
    svg: frame(`
      <path d="M44 80 v-16 q0 -24 16 -38 q16 14 16 38 v16 z" stroke-width="3"/>
      <path d="M48 64 q12 -6 24 0 M47 54 q13 -6 26 0 M50 44 q10 -5 20 0" stroke-width="1.8"/>
      <ellipse cx="60" cy="25" rx="7" ry="2.6" stroke-width="2"/>
      <path d="M60 22 v-6 M60 16 l6 2 l-6 2" stroke-width="2"/>
      <path d="M54 80 v-8 a6 6 0 0 1 12 0 v8" stroke-width="2.2"/>
      <path d="M34 80 h52" stroke-width="2.4"/>`, '#8a1a1a', 'দেবালয়'),
  },
};
