/**
 * On-screen controls for touch devices (phones in portrait, tablets):
 *  • a floating joystick — touch anywhere in the lower-left zone; push past ~85% to jog
 *  • swipe anywhere else on the scene to look around (handled by Input on the canvas)
 *  • a large contextual action button (shows what E would do), a run toggle, and the HUD's
 *    existing passport / map / pause buttons
 * Multi-touch: the joystick and the camera swipe work at the same time.
 */
import type { Input } from '../core/Input';

export class TouchControls {
  el: HTMLElement;
  private zone: HTMLElement;
  private base: HTMLElement;
  private knob: HTMLElement;
  private act: HTMLButtonElement;
  private run: HTMLButtonElement;
  private pid: number | null = null;
  private ox = 0;
  private oy = 0;
  private running = false;
  private R = 56;

  constructor(private input: Input) {
    this.el = document.createElement('div');
    this.el.className = 'touch-ui';
    this.el.innerHTML = `
      <div class="joy-zone" aria-label="Move (joystick)"><div class="joy-base"><div class="joy-knob"></div></div></div>
      <div class="touch-btns">
        <button class="t-run" aria-label="Run" aria-pressed="false"><span>RUN</span></button>
        <button class="t-act" aria-label="Interact"><span class="t-act-label"></span></button>
      </div>`;
    this.zone = this.el.querySelector('.joy-zone')!;
    this.base = this.el.querySelector('.joy-base')!;
    this.knob = this.el.querySelector('.joy-knob')!;
    this.act = this.el.querySelector('.t-act')!;
    this.run = this.el.querySelector('.t-run')!;
    this.zone.addEventListener('pointerdown', (e) => this.start(e));
    this.zone.addEventListener('pointermove', (e) => this.move(e));
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.pid) return;
      this.pid = null;
      this.input.setVirtual(0, 0, false);
      this.base.classList.remove('active');
      this.knob.style.transform = 'translate(-50%, -50%)';
    };
    this.zone.addEventListener('pointerup', end);
    this.zone.addEventListener('pointercancel', end);
    this.act.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.push('interact');
      this.act.classList.add('pressed');
      setTimeout(() => this.act.classList.remove('pressed'), 150);
    });
    this.run.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.running = !this.running;
      this.run.classList.toggle('on', this.running);
      this.run.setAttribute('aria-pressed', String(this.running));
      this.input.setRunToggle(this.running);
    });
  }

  private start(e: PointerEvent) {
    if (this.pid !== null) return;
    e.preventDefault();
    this.pid = e.pointerId;
    this.zone.setPointerCapture(e.pointerId);
    const r = this.zone.getBoundingClientRect();
    this.ox = e.clientX;
    this.oy = e.clientY;
    this.base.style.left = `${e.clientX - r.left}px`;
    this.base.style.top = `${e.clientY - r.top}px`;
    this.base.classList.add('active');
    this.move(e);
  }

  private move(e: PointerEvent) {
    if (e.pointerId !== this.pid) return;
    let dx = e.clientX - this.ox, dy = e.clientY - this.oy;
    const d = Math.hypot(dx, dy);
    if (d > this.R) {
      dx *= this.R / d;
      dy *= this.R / d;
    }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const mag = Math.min(1, d / this.R);
    const dead = 0.12;
    const k = mag < dead ? 0 : (mag - dead) / (1 - dead);
    const nx = d > 0 ? dx / d : 0, ny = d > 0 ? dy / d : 0;
    this.input.setVirtual(nx * k, -ny * k, mag > 0.9);
  }

  /** Show what the action button would do right now (or dim it). */
  setAction(label: string | null) {
    const l = this.act.querySelector('.t-act-label')!;
    const txt = label ? shorten(label) : '';
    if (l.textContent !== txt) l.textContent = txt;
    this.act.classList.toggle('idle', !label);
  }

  show(on: boolean) {
    this.el.classList.toggle('hidden', !on);
    if (!on && this.pid !== null) {
      this.pid = null;
      this.input.setVirtual(0, 0, false);
    }
  }
}

function shorten(s: string) {
  const first = s.split(/ — |: | \(/)[0].replace(/ to Ma Durga$/, '');
  return first.length > 22 ? first.slice(0, 20) + '…' : first;
}

export function isTouchDevice() {
  return matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
}
