/**
 * Illustrated city map, drawn into a canvas from the same layout data as the 3D world.
 * Undiscovered pandals appear only as a soft "rumour" glow in their district (exact location
 * hidden) unless wayfinding guidance is enabled in settings.
 */
import { ROADS, PLAZAS, FINALE_POINT, ISLAND_R, GHAT_TOP_Z, RIVER_Z, DECKS, LANDMARKS } from '../data/layout';
import { PANDALS, DISTRICTS } from '../data/pandals';
import type { SaveData } from '../save/SaveStore';
import { STAMP_ART } from './stamps';

export function drawMap(cv: HTMLCanvasElement, data: SaveData, player: { x: number; z: number; yaw: number }, djs: { x: number; z: number }[] = []) {
  const g = cv.getContext('2d')!;
  const W = cv.width, H = cv.height;
  const S = Math.min(W, H) / (ISLAND_R * 2.15);
  const ox = W / 2, oz = H / 2 - 10;
  const P = (x: number, z: number) => [ox + x * S, oz + z * S] as const;
  // sea + paper
  g.fillStyle = '#e9dcbc';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#9fc3cf';
  g.beginPath();
  g.arc(ox, oz, ISLAND_R * S * 1.06, 0, Math.PI * 2);
  g.fill();
  // island (clip south of the ghat)
  g.save();
  g.beginPath();
  g.arc(ox, oz, ISLAND_R * S, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#efe3c6';
  g.fillRect(0, 0, W, P(0, GHAT_TOP_Z)[1]);
  g.fillStyle = '#d8c7a2';
  g.fillRect(0, P(0, GHAT_TOP_Z)[1], W, (RIVER_Z - GHAT_TOP_Z) * S);
  g.restore();
  g.fillStyle = '#9fc3cf';
  g.fillRect(0, P(0, RIVER_Z)[1], W, H);
  // wave hatching on the river
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 1.5;
  for (let y = P(0, RIVER_Z)[1] + 12; y < H; y += 14)
    for (let x = 10 + ((y / 14) % 2) * 20; x < W; x += 40) {
      g.beginPath();
      g.arc(x, y, 6, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
  // Nodir Opare's footbridge and deck out on the river
  g.fillStyle = '#b08a5a';
  for (const d of DECKS) {
    const [x0, y0] = P(d.x0, d.z0), [x1, y1] = P(d.x1, d.z1);
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  g.strokeStyle = '#6b4a2f';
  g.lineWidth = 1.5;
  for (const d of DECKS) {
    const [x0, y0] = P(d.x0, d.z0), [x1, y1] = P(d.x1, d.z1);
    g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }
  // district tints
  for (const d of DISTRICTS) {
    const [x, y] = P(d.x, d.z);
    const grd = g.createRadialGradient(x, y, 0, x, y, 70 * S * 2.2);
    grd.addColorStop(0, d.color + '66');
    grd.addColorStop(1, d.color + '00');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, 70 * S * 2.2, 0, Math.PI * 2);
    g.fill();
  }
  // roads
  for (const r of ROADS) {
    g.strokeStyle = r.kind === 'lane' ? '#c9a27e' : '#8c7b66';
    g.lineWidth = Math.max(2, r.width * S * 0.9);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    r.pts.forEach(([x, z], i) => (i ? g.lineTo(...P(x, z)) : g.moveTo(...P(x, z))));
    g.stroke();
  }
  for (const p of PLAZAS) {
    g.fillStyle = '#cbbb9a';
    g.beginPath();
    g.arc(...P(p.x, p.z), p.r * S, 0, Math.PI * 2);
    g.fill();
  }
  // landmarks: statues (a figure on a pedestal) and the mandir (a little temple), with a short label
  const LABEL: Record<string, string> = { 'netaji-salute': 'Netaji', 'netaji-point': 'Netaji', vivekananda: 'Vivekananda', tagore: 'Tagore', mandir: 'Shiva Mandir' };
  for (const l of LANDMARKS) {
    const [x, y] = P(l.x, l.z);
    g.fillStyle = '#6e5a3a';
    if (l.kind === 'mandir') {
      g.fillRect(x - 5, y - 2, 10, 7);
      g.beginPath();
      g.moveTo(x - 7, y - 2);
      g.lineTo(x, y - 9);
      g.lineTo(x + 7, y - 2);
      g.closePath();
      g.fill();
    } else {
      g.fillRect(x - 4, y + 1, 8, 4);
      g.beginPath();
      g.arc(x, y - 6, 2.2, 0, Math.PI * 2);
      g.fill();
      g.fillRect(x - 1.8, y - 4, 3.6, 5);
    }
    g.font = '600 10px "Baloo 2", sans-serif';
    g.textAlign = 'center';
    g.fillText(LABEL[l.kind], x, y + 15);
  }
  // DJ dance spots: a music note in a dark disc, no numbers
  for (const d of djs) {
    const [x, y] = P(d.x, d.z);
    g.fillStyle = 'rgba(40, 20, 50, 0.85)';
    g.beginPath();
    g.arc(x, y, 10, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ff7ad9';
    g.font = '800 15px "Baloo Da 2", sans-serif';
    g.textAlign = 'center';
    g.fillText('♪', x, y + 5);
  }
  // district labels
  g.textAlign = 'center';
  for (const d of DISTRICTS) {
    const [x, y] = P(d.x, d.z);
    g.fillStyle = '#5a3a22';
    g.font = '800 17px "Baloo Da 2", "Baloo 2", "Noto Sans Bengali", sans-serif';
    g.fillText(d.bn, x, y - 4);
    g.fillText(d.name.toUpperCase(), x, y + 15);
  }
  // pandals
  for (const p of PANDALS) {
    const done = data.stamps.includes(p.id), disc = data.discovered.includes(p.id);
    const [x, y] = P(p.x, p.z);
    if (done || disc || data.settings.guidance) {
      g.fillStyle = done ? STAMP_ART[p.id].color : '#fff8e6';
      g.strokeStyle = STAMP_ART[p.id].color;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x, y, 13, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = done ? '#fff' : STAMP_ART[p.id].color;
      g.font = '800 14px "Baloo Da 2", sans-serif';
      g.fillText(done ? '✓' : String(PANDALS.indexOf(p) + 1), x, y + 5);
      g.fillStyle = '#3a2416';
      g.font = '700 13px "Baloo Da 2", sans-serif';
      g.fillText(p.name, x, y + 30);
    } else {
      // rumour: a soft glow offset from the true spot, hinting at the district
      const jx = x + Math.sin(p.x) * 18, jy = y + Math.cos(p.z) * 18;
      const grd = g.createRadialGradient(jx, jy, 0, jx, jy, 34);
      grd.addColorStop(0, 'rgba(255,190,80,0.75)');
      grd.addColorStop(1, 'rgba(255,190,80,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(jx, jy, 34, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#8a5a2b';
      g.font = '800 16px "Baloo Da 2", sans-serif';
      g.fillText('?', jx, jy + 6);
    }
  }
  if (data.stamps.length >= PANDALS.length) {
    const [x, y] = P(FINALE_POINT.x, FINALE_POINT.z);
    g.fillStyle = '#ffb33c';
    g.beginPath();
    g.arc(x, y, 10, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3a2416';
    g.font = '800 13px "Baloo Da 2", sans-serif';
    g.fillText('Sunrise Ghat', x, y - 16);
  }
  // player arrow
  const [px, py] = P(player.x, player.z);
  g.save();
  g.translate(px, py);
  g.rotate(-player.yaw + Math.PI);
  g.fillStyle = '#d9381e';
  g.strokeStyle = '#fff';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, -14);
  g.lineTo(10, 10);
  g.lineTo(0, 5);
  g.lineTo(-10, 10);
  g.closePath();
  g.stroke();
  g.fill();
  g.restore();
  // compass + progress
  g.fillStyle = '#5a3a22';
  g.font = '800 16px "Baloo Da 2", sans-serif';
  g.textAlign = 'left';
  g.fillText(`Puja Passport — ${data.stamps.length}/${PANDALS.length}`, 18, 30);
  g.textAlign = 'right';
  g.fillText('N ↑', W - 18, 30);
}
