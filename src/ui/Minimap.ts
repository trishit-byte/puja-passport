/**
 * GTA-inspired circular minimap. The whole city is pre-rendered once into an offscreen canvas
 * (island, river, roads, plazas, building footprints); each frame the visible disc is drawn
 * rotated so "up" is always the camera's view direction, with markers on top:
 *   • player arrow (fixed at the centre, pointing up)
 *   • pandals — coloured lotus-diamonds (✓ when stamped)
 *   • DJ spots — music notes ♪ (no numbers), only for real boxes in the world
 *   • Sunrise Ghat — once the passport is complete
 * Markers outside the disc are pinned to its rim so you always know which way to go.
 */
import { ROADS, PLAZAS, ISLAND_R, GHAT_TOP_Z, RIVER_Z } from '../data/layout';

export interface MiniMarker {
  x: number;
  z: number;
  kind: 'pandal' | 'dj' | 'finale';
  color?: string;
  done?: boolean;
}

const PX = 2.2; // pixels per metre in the base map
const SIZE = Math.ceil(ISLAND_R * 2.1 * PX);

export class Minimap {
  el: HTMLElement;
  private cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private base: HTMLCanvasElement;
  private viewR = 70; // metres from centre to rim
  private last = 0;

  constructor(footprints: { x: number; z: number; hw: number; hd: number; yaw: number }[]) {
    this.el = document.createElement('div');
    this.el.className = 'minimap';
    this.el.setAttribute('aria-label', 'Minimap');
    this.cv = document.createElement('canvas');
    this.el.append(this.cv);
    const n = document.createElement('div');
    n.className = 'mm-north';
    n.textContent = 'N';
    this.el.append(n);
    this.g = this.cv.getContext('2d')!;
    this.base = this.render(footprints);
  }

  /** Pre-render the city at PX pixels per metre, centred on the island. */
  private render(fps: { x: number; z: number; hw: number; hd: number; yaw: number }[]) {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const g = c.getContext('2d')!;
    const P = (x: number, z: number) => [SIZE / 2 + x * PX, SIZE / 2 + z * PX] as const;
    g.fillStyle = '#2b5a6e';
    g.fillRect(0, 0, SIZE, SIZE);
    // island
    g.save();
    g.beginPath();
    g.arc(SIZE / 2, SIZE / 2, ISLAND_R * PX, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#3c3246';
    g.fillRect(0, 0, SIZE, P(0, GHAT_TOP_Z)[1]);
    g.fillStyle = '#7a6a58';
    g.fillRect(0, P(0, GHAT_TOP_Z)[1], SIZE, (RIVER_Z - GHAT_TOP_Z) * PX);
    g.restore();
    // plazas
    g.fillStyle = '#6b5e70';
    for (const p of PLAZAS) {
      g.beginPath();
      g.arc(...P(p.x, p.z), p.r * PX, 0, Math.PI * 2);
      g.fill();
    }
    // buildings
    g.fillStyle = '#56495e';
    for (const f of fps) {
      g.save();
      g.translate(...P(f.x, f.z));
      g.rotate(-f.yaw);
      g.fillRect(-f.hw * PX, -f.hd * PX, f.hw * 2 * PX, f.hd * 2 * PX);
      g.restore();
    }
    // roads: casing + fill
    for (const pass of [0, 1]) {
      for (const r of ROADS) {
        g.strokeStyle = pass ? (r.kind === 'lane' ? '#b89a7a' : '#e9dcc0') : '#1e1824';
        g.lineWidth = Math.max(3, r.width * PX * (r.kind === 'lane' ? 0.75 : 0.85)) + (pass ? 0 : 3);
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        r.pts.forEach(([x, z], i) => (i ? g.lineTo(...P(x, z)) : g.moveTo(...P(x, z))));
        g.stroke();
      }
    }
    return c;
  }

  /** heading = camera yaw on the ground (radians, atan2(dx, dz) of the view direction). */
  update(px: number, pz: number, heading: number, playerYaw: number, markers: MiniMarker[], now: number) {
    if (now - this.last < 1 / 30) return; // ~30 fps is plenty for a map
    this.last = now;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const css = this.el.clientWidth || 180;
    const W = Math.round(css * dpr);
    if (this.cv.width !== W) this.cv.width = this.cv.height = W;
    const g = this.g;
    const R = W / 2;
    const scale = R / this.viewR; // canvas px per metre
    g.save();
    g.clearRect(0, 0, W, W);
    g.beginPath();
    g.arc(R, R, R - 1, 0, Math.PI * 2);
    g.clip();
    // map: rotate so the view direction points up
    g.translate(R, R);
    g.rotate(Math.PI + heading);
    g.scale(scale / PX, scale / PX);
    g.drawImage(this.base, -(SIZE / 2 + px * PX), -(SIZE / 2 + pz * PX));
    g.restore();
    // markers
    const rot = (x: number, z: number) => {
      const dx = x - px, dz = z - pz;
      const c = Math.cos(Math.PI + heading), s = Math.sin(Math.PI + heading);
      return [(dx * c - dz * s) * scale, (dx * s + dz * c) * scale] as const;
    };
    g.save();
    g.translate(R, R);
    for (const m of markers) {
      let [x, y] = rot(m.x, m.z);
      const d = Math.hypot(x, y);
      const edge = R - 12 * dpr;
      const pinned = d > edge;
      if (pinned) {
        if (m.kind === 'dj') continue; // music spots only show when they're on the map
        x *= edge / d;
        y *= edge / d;
      }
      g.save();
      g.translate(x, y);
      if (m.kind === 'dj') {
        g.fillStyle = 'rgba(20, 12, 30, 0.85)';
        g.beginPath();
        g.arc(0, 0, 9 * dpr, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#ff7ad9';
        g.font = `800 ${13 * dpr}px "Baloo Da 2", sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('♪', 0, 1 * dpr);
      } else if (m.kind === 'pandal') {
        const s = (pinned ? 6 : 8) * dpr;
        g.rotate(Math.PI / 4);
        g.fillStyle = m.done ? '#fff6dc' : m.color ?? '#ffc93c';
        g.strokeStyle = m.done ? m.color ?? '#b3121f' : '#fff6dc';
        g.lineWidth = 2 * dpr;
        g.fillRect(-s, -s, s * 2, s * 2);
        g.strokeRect(-s, -s, s * 2, s * 2);
        if (m.done) {
          g.rotate(-Math.PI / 4);
          g.fillStyle = m.color ?? '#b3121f';
          g.font = `800 ${11 * dpr}px "Baloo Da 2", sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('✓', 0, 1 * dpr);
        }
      } else {
        g.fillStyle = '#ffb33c';
        g.beginPath();
        g.arc(0, 0, 8 * dpr, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#3a1a0a';
        g.font = `800 ${11 * dpr}px "Baloo Da 2", sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('☀', 0, 1 * dpr);
      }
      g.restore();
    }
    // player arrow (always pointing along the player's facing, relative to the view)
    g.rotate(heading - playerYaw);
    g.fillStyle = '#ff4a2a';
    g.strokeStyle = '#fff';
    g.lineWidth = 2 * dpr;
    g.beginPath();
    g.moveTo(0, -11 * dpr);
    g.lineTo(7 * dpr, 8 * dpr);
    g.lineTo(0, 4 * dpr);
    g.lineTo(-7 * dpr, 8 * dpr);
    g.closePath();
    g.stroke();
    g.fill();
    g.restore();
    // north marker rides the rim: world −z in view space is (−sin h, cos h)
    const n = this.el.querySelector('.mm-north') as HTMLElement;
    const rr = css / 2 - 9;
    n.style.transform = `translate(-50%, -50%) translate(${-Math.sin(heading) * rr}px, ${Math.cos(heading) * rr}px)`;
  }
}

