/**
 * Anonymous play counting: one tiny beacon per event to the site's own /api/hit (a Cloudflare
 * Pages Function that only keeps running totals). No cookies and no personal data; a random,
 * meaningless flag in localStorage makes "new player" count once per device. Only on the live
 * site — never in development, tests or local previews.
 */
type PlayEvent = 'visit' | 'player' | 'start' | 'stamp' | 'complete' | 'sunrise';

const live = typeof location !== 'undefined' && /\.pages\.dev$|\.workers\.dev$/.test(location.hostname) && !/debug|autostart/.test(location.search);
const phone = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export function track(e: PlayEvent) {
  if (!live) return;
  try {
    const body = JSON.stringify({ e, m: phone ? 1 : 0 });
    if (!navigator.sendBeacon?.('/api/hit', new Blob([body], { type: 'application/json' }))) fetch('/api/hit', { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch {
    /* never let counting get in the way of playing */
  }
}

/** Once per page load: an open, and (first time on this device) a new player. */
export function trackVisit() {
  track('visit');
  try {
    if (!localStorage.getItem('anandapur.counted')) {
      localStorage.setItem('anandapur.counted', '1');
      track('player');
    }
  } catch {
    /* private mode: count the visit only */
  }
}
