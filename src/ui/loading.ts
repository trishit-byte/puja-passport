/**
 * The loading screen: the Puja Passport itself — a sindoor-red booklet with a gold pandal on the
 * cover and an Anandapur stamp — under swaying strings of festival lights, with petals drifting
 * down. Progress is a row of ten diyas (one per pandal) that light up as the city is built.
 * All inline SVG and CSS: it paints at once, before any texture or model has loaded.
 */
export const DIYAS = 10;

const bulbs = (y0: number, sag: number, n: number, cols: string[]) =>
  Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1), x = 10 + t * 380, y = y0 + Math.sin(t * Math.PI) * sag;
    return `<circle class="ld-bulb" style="--d:${(i * 0.37) % 2}s" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.4" fill="${cols[i % cols.length]}"/>`;
  }).join('');

const passport = `
<svg class="ld-art" viewBox="0 0 400 260" aria-hidden="true">
  <defs>
    <linearGradient id="ldCover" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c8202c"/><stop offset="1" stop-color="#7d0c16"/></linearGradient>
    <linearGradient id="ldGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a0"/><stop offset="1" stop-color="#d9a032"/></linearGradient>
    <radialGradient id="ldHalo"><stop offset="0" stop-color="#ffb347" stop-opacity=".55"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
  </defs>
  <path d="M10 22 Q200 70 390 22" class="ld-wire"/><g>${bulbs(22, 24, 15, ['#ff5d7a', '#ffd23c', '#4ee6ff', '#8aff6a', '#ff9a3c'])}</g>
  <path d="M10 48 Q200 92 390 48" class="ld-wire"/><g>${bulbs(48, 22, 13, ['#ffd23c', '#ff5d7a', '#ff9a3c', '#b38bff'])}</g>
  <ellipse cx="200" cy="150" rx="150" ry="100" fill="url(#ldHalo)"/>
  <g class="ld-book">
    <rect x="136" y="70" width="136" height="176" rx="10" fill="#4a0810"/>
    <rect x="132" y="66" width="136" height="176" rx="10" fill="url(#ldCover)"/>
    <rect x="142" y="76" width="116" height="156" rx="6" fill="none" stroke="url(#ldGold)" stroke-width="1.6"/>
    <rect x="146" y="80" width="108" height="148" rx="4" fill="none" stroke="url(#ldGold)" stroke-width=".7" stroke-dasharray="2 2.5"/>
    <!-- the gold pandal on the cover: a shikhara-topped gate with an arched opening -->
    <g fill="url(#ldGold)">
      <path d="M196 92 l4 -8 l4 8 z"/>
      <path d="M178 124 Q182 104 196 96 h8 Q218 104 222 124 z"/>
      <rect x="170" y="124" width="60" height="6" rx="1"/>
      <path d="M172 130 h56 v34 h-56 z M188 164 v-18 a12 12 0 0 1 24 0 v18 z" fill-rule="evenodd"/>
      <rect x="166" y="164" width="68" height="5" rx="1"/>
      <circle cx="200" cy="114" r="3.2" fill="#7d0c16"/>
    </g>
    <circle cx="200" cy="153" r="5.5" fill="#ffd23c" class="ld-flame"/>
    <text x="200" y="194" text-anchor="middle" class="ld-cover-bn">পূজা পাসপোর্ট</text>
    <text x="200" y="212" text-anchor="middle" class="ld-cover-en">PUJA PASSPORT</text>
  </g>
  <!-- a stamp pressed onto the corner of the cover -->
  <g class="ld-stamp" transform="translate(280 226) rotate(-14)">
    <circle r="27" fill="rgba(255,240,210,.92)"/>
    <circle r="24" fill="none" stroke="#1f6b4e" stroke-width="2"/>
    <circle r="18" fill="none" stroke="#1f6b4e" stroke-width=".8"/>
    <text y="-1" text-anchor="middle" class="ld-stamp-bn">আনন্দপুর</text>
    <text y="8" text-anchor="middle" class="ld-stamp-en">ANANDAPUR</text>
  </g>
</svg>`;

const petals = Array.from({ length: 14 }, (_, i) => `<i class="ld-petal" style="--x:${(i * 73) % 100}vw;--d:${(i * 0.9) % 7}s;--s:${7 + (i % 5)}s;--c:${i % 3 ? '#ff9a1f' : '#ffcf3a'}"></i>`).join('');
const diyas = Array.from({ length: DIYAS }, () => `<span class="ld-diya"><b></b></span>`).join('');

export const LOADING_HTML = `
<div class="loading">
  <div class="ld-stars"></div>${petals}
  <div class="loading-inner">
    <div class="ld-city"><div class="ld-city-bn" lang="bn">আনন্দপুর</div><div class="ld-city-hi" lang="hi">आनंदपुर</div><div class="ld-city-en">ANANDAPUR</div></div>
    ${passport}
    <div class="ld-bn" lang="bn">পূজা পাসপোর্ট</div>
    <h1 class="ld-title">Puja Passport</h1>
    <div class="ld-tag">Ten pandals · one Pujo night · Anandapur</div>
    <div class="ld-diyas" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">${diyas}</div>
    <div class="loading-sub">Lighting the lamps…</div>
    <div class="ld-loading">Loading<span>.</span><span>.</span><span>.</span></div>
  </div>
</div>`;

/** Light the diyas up to progress p (0…1). */
export function setLoading(root: ParentNode, p: number, text?: string) {
  const ds = root.querySelectorAll('.ld-diya');
  const lit = Math.round(p * ds.length);
  ds.forEach((d, i) => d.classList.toggle('lit', i < lit));
  root.querySelector('.ld-diyas')?.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  if (text) {
    const sub = root.querySelector('.loading-sub');
    if (sub) sub.textContent = text;
  }
}
