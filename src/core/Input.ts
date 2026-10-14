/** Keyboard + mouse-drag + wheel + gamepad input. Exposes a move vector and edge-triggered actions. */
export type Action = 'interact' | 'map' | 'passport' | 'pause' | 'advance' | 'photo' | 'skip';

const ACTION_KEYS: Record<string, Action> = {
  KeyE: 'interact',
  KeyM: 'map',
  KeyP: 'passport',
  Escape: 'pause',
  Space: 'advance',
  KeyC: 'photo',
  KeyK: 'skip',
};

export class Input {
  private down = new Set<string>();
  private pressed: Action[] = [];
  /** Raw key presses this frame (for UI pickers: digits, arrows, Enter). */
  keys: string[] = [];
  orbitDX = 0;
  orbitDY = 0;
  wheel = 0;
  dragging = false;
  enabled = true; // 3D movement input (UI still receives actions)
  private lastX = 0;
  private lastY = 0;
  private dragId: number | null = null;
  private pinch = new Map<number, { x: number; y: number }>();
  private pinchD = 0;
  private vx = 0;
  private vy = 0;
  private vjog = false;
  private runToggle = false;
  /** Touch joystick: x right, y forward, both −1…1. */
  setVirtual(x: number, y: number, jog: boolean) {
    this.vx = x;
    this.vy = y;
    this.vjog = jog;
  }
  setRunToggle(on: boolean) {
    this.runToggle = on;
  }
  private padPrev: boolean[] = [];

  constructor(el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' && (e.target as HTMLInputElement).type === 'range' && e.code.startsWith('Arrow')) return;
      this.down.add(e.code);
      if (!e.repeat) {
        this.keys.push(e.code);
        const a = ACTION_KEYS[e.code];
        if (a) this.pressed.push(a);
        if (e.code === 'Enter') this.pressed.push('advance');
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && (e.target as HTMLElement)?.tagName !== 'BUTTON') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    // camera: one pointer drags to orbit; two touch pointers pinch to zoom
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      if (e.pointerType === 'touch') this.pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch.size === 2) {
        const [a, b] = [...this.pinch.values()];
        this.pinchD = Math.hypot(a.x - b.x, a.y - b.y);
        this.dragging = false;
        this.dragId = null;
        return;
      }
      if (this.dragId !== null) return;
      this.dragId = e.pointerId;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    el.addEventListener('pointermove', (e) => {
      if (this.pinch.has(e.pointerId)) this.pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch.size === 2) {
        const [a, b] = [...this.pinch.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (Math.abs(d - this.pinchD) > 24) {
          this.wheel += d < this.pinchD ? 1 : -1;
          this.pinchD = d;
        }
        return;
      }
      if (!this.dragging || e.pointerId !== this.dragId) return;
      const k = e.pointerType === 'touch' ? 1.4 : 1; // touch swipes are shorter: a little more gain
      this.orbitDX += (e.clientX - this.lastX) * k;
      this.orbitDY += (e.clientY - this.lastY) * k;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    const up = (e: PointerEvent) => {
      this.pinch.delete(e.pointerId);
      if (e.pointerId === this.dragId) {
        this.dragging = false;
        this.dragId = null;
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
  }

  isDown(code: string) {
    return this.down.has(code);
  }

  move(): { x: number; y: number; jog: boolean } {
    let x = 0, y = 0;
    if (this.down.has('KeyW') || this.down.has('ArrowUp')) y += 1;
    if (this.down.has('KeyS') || this.down.has('ArrowDown')) y -= 1;
    if (this.down.has('KeyD') || this.down.has('ArrowRight')) x += 1;
    if (this.down.has('KeyA') || this.down.has('ArrowLeft')) x -= 1;
    let jog = this.down.has('ShiftLeft') || this.down.has('ShiftRight') || this.runToggle;
    if (this.vx || this.vy) {
      x += this.vx;
      y += this.vy;
      jog ||= this.vjog;
    }
    const pad = navigator.getGamepads?.()[0];
    if (pad) {
      const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
      if (Math.hypot(ax, ay) > 0.2) {
        x += ax;
        y -= ay;
      }
      const rx = pad.axes[2] ?? 0, ry = pad.axes[3] ?? 0;
      if (Math.abs(rx) > 0.2) this.orbitDX += rx * 12;
      if (Math.abs(ry) > 0.2) this.orbitDY += ry * 8;
      jog ||= !!pad.buttons[10]?.pressed || !!pad.buttons[6]?.pressed;
    }
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y, jog };
  }

  pollGamepad() {
    const pad = navigator.getGamepads?.()[0];
    if (!pad) return;
    const map: [number, Action][] = [[0, 'interact'], [1, 'pause'], [3, 'passport'], [2, 'map'], [9, 'pause']];
    for (const [i, a] of map) {
      const p = !!pad.buttons[i]?.pressed;
      if (p && !this.padPrev[i]) this.pressed.push(a === 'interact' ? 'interact' : a);
      this.padPrev[i] = p;
    }
  }

  /** Drain edge-triggered actions for this frame. */
  consume(): Action[] {
    const p = this.pressed;
    this.pressed = [];
    return p;
  }
  consumeKeys(): string[] {
    const k = this.keys;
    this.keys = [];
    return k;
  }
  consumeOrbit() {
    const r = { dx: this.orbitDX, dy: this.orbitDY, wheel: this.wheel };
    this.orbitDX = this.orbitDY = this.wheel = 0;
    return r;
  }
  /** Inject actions programmatically (on-screen buttons, tests). */
  push(a: Action) {
    this.pressed.push(a);
  }
}
