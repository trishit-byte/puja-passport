/**
 * DOM user interface. Everything is real HTML (keyboard- and screen-reader-accessible) layered over
 * the canvas: title, HUD, prompts, toasts, discovery banners, dialogue, info cards, rhythm and
 * postcard overlays, passport, map, pause/settings, outfit picker and the finale.
 */
import { loadMemories } from '../save/memories';
import { PANDALS, PANDAL_BY_ID, DISTRICTS, type PandalId } from '../data/pandals';
import type { SaveData, Settings, Outfit } from '../save/SaveStore';
import type { Action } from '../core/Input';
import { STAMP_ART } from './stamps';
import type { RhythmMachine, MatchMachine } from '../interactions/machines';

export interface DialogueLine {
  name: string;
  text: string;
  bn?: string; // Bengali phrase shown in script
  tr?: string; // translation
}

type Modal = 'title' | 'passport' | 'map' | 'pause' | 'dialogue' | 'picker' | 'rhythm' | 'finale' | 'info' | 'outfit' | 'confirm' | 'photo' | 'tutorial' | 'scene';

const h = (tag: string, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface UIHooks {
  onStart(action: 'continue' | 'new' | 'sightseeing'): void;
  onMenu(): void;
  onResume(): void;
  onSettings(s: Partial<Settings>): void;
  onAudio(a: Partial<SaveData['audio']>): void;
  onOutfit(o: Outfit): void;
  onReset(): void;
  onPhoto(): void;
  onClick(): void;
  drawMap(canvas: HTMLCanvasElement): void;
}

export class UI {
  root = document.getElementById('ui')!;
  modals: Modal[] = [];
  private hud!: HTMLElement;
  /** Hide the HUD (and minimap/touch controls via CSS) for cinematics. */
  cinematic(on: boolean) {
    document.documentElement.classList.toggle('cinematic', on);
  }
  private counter!: HTMLElement;
  private compassEl!: HTMLElement;
  private compassMarks: HTMLElement[] = [];
  private promptEl!: HTMLElement;
  private toasts!: HTMLElement;
  private banner!: HTMLElement;
  private live!: HTMLElement;
  private layer!: HTMLElement;
  private dlg: { lines: DialogueLine[]; i: number; onEnd?: () => void; el: HTMLElement } | null = null;
  private picker: { el: HTMLElement; m: MatchMachine; onPick: (id: string) => void; sel: number } | null = null;
  private rhythm: { el: HTMLElement; m: RhythmMachine | null; onSkip?: () => void; onCancel?: () => void } | null = null;
  private mapCanvas: HTMLCanvasElement | null = null;
  private loading!: HTMLElement;
  private bannerT = 0;
  data!: SaveData;

  constructor(private hooks: UIHooks) {
    this.build();
  }

  get blocking() {
    return this.modals.length > 0;
  }
  top() {
    return this.modals[this.modals.length - 1];
  }

  private push(m: Modal) {
    if (!this.modals.includes(m)) this.modals.push(m);
    this.root.classList.toggle('modal-open', this.modals.length > 0);
  }
  private pop(m: Modal) {
    this.modals = this.modals.filter((x) => x !== m);
    this.root.classList.toggle('modal-open', this.modals.length > 0);
  }

  private build() {
    this.loading = (this.root.querySelector('.loading') as HTMLElement) ?? h('div');
    this.hud = h('div', 'hud hidden');
    this.hud.innerHTML = `
      <div class="clock" role="timer" aria-live="off"><div class="clock-city"><span class="hud-bn">আনন্দপুর</span> <span class="city-en">ANANDAPUR</span></div><div class="clock-time">6:00 PM</div><div class="clock-left">Time left 45:00</div></div>
      <div class="hud-right">
        <button class="pill counter" data-act="passport" aria-label="Open Puja Passport (P)"><span class="pp-icon"></span><span class="count"><span class="pp-word">Puja Passport — </span>0/${PANDALS.length}</span></button>
        <button class="icon-btn" data-act="map" aria-label="City map (M)" title="Map (M)">${ICON.map}</button>
        <button class="icon-btn" data-act="photo" aria-label="Photo mode (C)" title="Photo mode (C)">${ICON.camera}</button>
        <button class="icon-btn" data-act="pause" aria-label="Settings and pause (Esc)" title="Pause (Esc)">${ICON.menu}</button>
      </div>`;
    this.counter = this.hud.querySelector('.count')!;
    this.compassEl = h('div', 'compass');
    this.compassEl.setAttribute('aria-hidden', 'true');
    this.hud.append(this.compassEl);
    this.hud.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hooks.onClick();
        this.handle((b as HTMLElement).dataset.act as Action);
      }),
    );
    this.promptEl = h('div', 'prompt hidden');
    this.promptEl.setAttribute('role', 'status');
    this.toasts = h('div', 'toasts');
    this.banner = h('div', 'banner hidden');
    this.live = h('div', 'sr-only');
    this.live.setAttribute('aria-live', 'polite');
    this.layer = h('div', 'layer');
    this.root.append(this.hud, this.promptEl, this.toasts, this.banner, this.layer, this.live);
  }

  setLoading(p: number, text?: string) {
    const bar = this.loading.querySelector('.bar span') as HTMLElement | null;
    if (bar) bar.style.width = `${Math.round(p * 100)}%`;
    if (text && this.loading.querySelector('.loading-sub')) this.loading.querySelector('.loading-sub')!.textContent = text;
  }
  hideLoading() {
    this.loading.classList.add('fade');
    setTimeout(() => this.loading.remove(), 800);
  }

  // ------------------------------------------------------------------ title
  /**
   * Title screen. Buttons depend on the saved session: a fresh night, an unfinished timed night,
   * a completed or failed night, or untimed sightseeing.
   */
  showTitle(st: { status: string; stamps: number; clock: string; left: string }) {
    this.push('title');
    this.hud.classList.add('hidden');
    const el = h('div', 'title-screen');
    const btn = (a: string, label: string, primary = false, sub = '') =>
      `<button class="btn ${primary ? 'primary' : ''}" data-a="${a}">${label}${sub ? `<small>${sub}</small>` : ''}</button>`;
    let buttons = '';
    if (st.status === 'active') buttons = btn('continue', 'Continue the Night', true, `${st.clock} · ${st.left} left · ${st.stamps}/${PANDALS.length} stamps`) + btn('new', 'Start a New Night');
    else if (st.status === 'success') buttons = btn('continue', 'Keep Exploring', true, `Passport complete · ${st.stamps}/${PANDALS.length}`) + btn('new', 'Play the Night Again');
    else if (st.status === 'failed') buttons = btn('new', 'Try the Night Again', true, '6:00 PM – 4:00 AM · 45 minutes') + btn('sightseeing', 'Sightseeing', false, 'untimed free roam');
    else if (st.status === 'sightseeing') buttons = btn('continue', 'Continue Sightseeing', true, 'untimed') + btn('new', 'Try the Timed Night');
    else buttons = btn('new', 'Start the Night', true, '6:00 PM – 4:00 AM · 45 minutes');
    el.innerHTML = `
      <div class="title-card">
        <div class="title-kicker"><span class="tk-pp"></span>Puja Passport <span lang="bn">· পূজা পাসপোর্ট</span></div>
        <h1 class="title-city" aria-label="Anandapur"><span class="tc-bn" lang="bn">আনন্দপুর</span><span class="tc-en">ANANDAPUR</span></h1>
        <div class="title-where">A Durga Puja night in the city of lights</div>
        <ul class="title-rules">
          <li><b>Hop every pandal in town.</b> Ten pandals glow across Anandapur — the map and the compass show the way.</li>
          <li><b>Collect your stamps.</b> Ring the bell at each pandal to stamp your Puja Passport.</li>
          <li><b>Eat, dance, have fun.</b> Fuchka, kathi rolls and chowmein on every corner; DJ spots to dance at; dhunuchi, aarti and dhak along the way.</li>
          <li><b>Beat the dawn.</b> The night runs 6:00 PM → 4:00 AM (45 minutes). Fill all ten stamps before the sun comes up!</li>
        </ul>
        <div class="title-buttons">${buttons}
          <button class="btn" data-a="outfit">Outfit</button>
          <button class="btn" data-a="settings">Settings</button>
        </div>
        <p class="title-note">Best with sound · <span class="kb">WASD / arrows to walk · drag to look</span><span class="touch">joystick to walk · swipe to look</span></p>
      </div>`;
    for (const a of ['continue', 'new', 'sightseeing'] as const) {
      el.querySelector(`[data-a=${a}]`)?.addEventListener('click', () => {
        this.hooks.onClick();
        const go = () => {
          el.classList.add('fade');
          setTimeout(() => el.remove(), 900);
          this.pop('title');
          this.hud.classList.remove('hidden');
          this.hooks.onStart(a);
        };
        if (a === 'new' && st.status === 'active') this.confirm('Start a new night?', 'Your current night (stamps and remaining time) will be replaced by a fresh 6:00 PM start.', go, 'Start over');
        else go();
      });
    }
    el.querySelector('[data-a=outfit]')!.addEventListener('click', () => this.openOutfit());
    el.querySelector('[data-a=settings]')!.addEventListener('click', () => this.openPause(true));
    this.layer.append(el);
    (el.querySelector('.title-buttons .btn') as HTMLElement).focus({ preventScroll: true });
  }

  /** Festival clock in the HUD. `left` null hides the countdown (sightseeing / finished). */
  setClock(time: string, left: string | null, urgent: boolean) {
    const t = this.hud.querySelector('.clock-time') as HTMLElement;
    if (t.textContent !== time) t.textContent = time;
    const l = this.hud.querySelector('.clock-left') as HTMLElement;
    const txt = left === null ? 'Sightseeing · untimed' : left === 'done' ? 'Passport complete ✓' : `Time left ${left}`;
    if (l.textContent !== txt) l.textContent = txt;
    this.hud.querySelector('.clock')!.classList.toggle('urgent', urgent);
  }

  /** End of the night without every stamp. */
  nightOver(stamps: number, onRetry: () => void, onMenu: () => void, onSightsee: () => void) {
    this.closeAll([]);
    const el = h('div', 'nightover');
    const pct = Math.round((stamps / PANDALS.length) * 100);
    el.innerHTML = `<div class="pause-card nightover-card" role="alertdialog">
      <div class="pp-bn" lang="bn">ভোর হয়ে এল</div>
      <div class="pp-bn" lang="hi">भोर हो गई</div>
      <div class="pause-title">4:00 AM — the Pujo night has ended</div>
      <p class="no-msg">The Pujo night has come to an end. Anandapur will be waiting for you again.</p>
      <div class="no-score"><span class="no-big">${stamps}<small>/${PANDALS.length}</small></span><span>stamps collected · ${pct}% of the passport</span></div>
      <div class="finale-stamps">${PANDALS.map((p) => `<div class="mini ${this.data.stamps.includes(p.id) ? '' : 'missing'}" title="${esc(p.name)}" style="--c:${STAMP_ART[p.id].color}">${this.data.stamps.includes(p.id) ? STAMP_ART[p.id].svg : '?'}</div>`).join('')}</div>
      <div class="pause-buttons"><button class="btn primary" data-a="retry">Try the Night Again</button><button class="btn" data-a="sight">Sightseeing (untimed)</button><button class="btn" data-a="menu">Main Menu</button></div>
    </div>`;
    this.layer.append(el);
    this.push('finale');
    const close = (fn: () => void) => () => {
      el.remove();
      this.pop('finale');
      fn();
    };
    el.querySelector('[data-a=retry]')!.addEventListener('click', close(onRetry));
    el.querySelector('[data-a=sight]')!.addEventListener('click', close(onSightsee));
    el.querySelector('[data-a=menu]')!.addEventListener('click', close(onMenu));
    (el.querySelector('[data-a=retry]') as HTMLElement).focus({ preventScroll: true });
    this.say(`The night has ended. ${stamps} of ${PANDALS.length} stamps collected.`);
  }

  // ------------------------------------------------------------------ HUD bits
  setCount(n: number) {
    this.counter.innerHTML = `<span class="pp-word">Puja Passport — </span>${n}/${PANDALS.length}`;
    this.counter.parentElement!.classList.toggle('complete', n >= 8);
  }

  /** Top-centre compass: markers for each pandal's tower within ±90° of the view direction. */
  compass(marks: { n: number; rel: number; dist: number; color: string; done: boolean; name: string; dj?: boolean }[]) {
    if (this.compassMarks.length !== marks.length) {
      this.compassMarks.forEach((m) => m.remove());
      this.compassMarks = [];
      this.compassEl.innerHTML = '<div class="compass-line"></div>';
      this.compassMarks = marks.map(() => {
        const e = h('div', 'cmark');
        this.compassEl.append(e);
        return e;
      });
    }
    marks.forEach((m, i) => {
      const e = this.compassMarks[i];
      const visible = Math.abs(m.rel) < 1.55;
      e.style.opacity = visible ? String(Math.max(0.35, 1 - Math.abs(m.rel) / 1.8)) : '0';
      e.style.left = `${50 + (m.rel / 1.55) * 50}%`;
      e.style.setProperty('--c', m.color);
      const html = m.dj ? `<span class="cdot">♪</span>` : `<span class="cdot">${m.done ? '✓' : m.n}</span><span class="cdist">${Math.round(m.dist)}m</span>`;
      if (e.innerHTML !== html) e.innerHTML = html;
      e.classList.toggle('done', m.done);
      e.classList.toggle('dj', !!m.dj);
    });
  }

  prompt(text: string | null) {
    if (!text || this.blocking) {
      this.promptEl.classList.add('hidden');
      return;
    }
    const html = `<kbd>E</kbd> ${esc(text)}`;
    if (this.promptEl.innerHTML !== html) this.promptEl.innerHTML = html;
    this.promptEl.classList.remove('hidden');
  }

  toast(msg: string, opts: { bn?: string; duration?: number } = {}) {
    const t = h('div', 'toast');
    t.innerHTML = `${opts.bn ? `<span class="bn" lang="bn">${esc(opts.bn)}</span> ` : ''}${esc(msg)}`;
    this.toasts.append(t);
    this.say(msg);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild!.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 500);
    }, (opts.duration ?? 3.2) * 1000);
  }

  say(msg: string) {
    this.live.textContent = msg;
  }

  discovered(id: PandalId) {
    const p = PANDAL_BY_ID[id];
    const d = DISTRICTS.find((x) => x.id === p.district)!;
    this.banner.innerHTML = `<div class="banner-kicker">Pandal discovered · ${esc(d.name)}</div><div class="banner-bn" lang="bn">${p.bn}</div><div class="banner-bn banner-hi" lang="hi">${p.hi}</div><div class="banner-title">${esc(p.name)}</div><div class="banner-sub">${esc(p.theme)}${this.data.settings.translations ? ` — <em>“${esc(p.meaning)}”</em>` : ''}</div>`;
    this.banner.classList.remove('hidden');
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    this.say(`Discovered ${p.name}`);
    clearTimeout(this.bannerT);
    this.bannerT = window.setTimeout(() => this.banner.classList.remove('show'), 4200);
  }

  // ------------------------------------------------------------------ dialogue
  dialogue(lines: DialogueLine[], onEnd?: () => void) {
    if (this.dlg) this.dlg.el.remove();
    const el = h('div', 'dialogue');
    el.setAttribute('role', 'dialog');
    this.layer.append(el);
    this.dlg = { lines, i: 0, onEnd, el };
    this.push('dialogue');
    this.renderDialogue();
  }
  private renderDialogue() {
    const d = this.dlg!;
    const l = d.lines[d.i];
    const tr = this.data.settings.translations && l.tr ? `<div class="dlg-tr">${esc(l.tr)}</div>` : '';
    d.el.innerHTML = `<div class="dlg-name">${esc(l.name)}</div><div class="dlg-box"><p>${l.bn ? `<span class="bn" lang="bn">${esc(l.bn)}</span> ` : ''}${esc(l.text)}</p>${tr}<button class="dlg-next" aria-label="Next">▶</button><div class="dlg-hint"><kbd>Space</kbd> continue</div></div>`;
    d.el.querySelector('.dlg-next')!.addEventListener('click', () => this.advance());
    this.say(`${l.name}: ${l.text}`);
  }
  advance() {
    const d = this.dlg;
    if (!d) return;
    this.hooks.onClick();
    d.i++;
    if (d.i >= d.lines.length) {
      d.el.remove();
      this.dlg = null;
      this.pop('dialogue');
      d.onEnd?.();
    } else this.renderDialogue();
  }

  info(title: string, text: string) {
    const el = h('div', 'info-card');
    el.innerHTML = `<div class="info-title">${esc(title)}</div><p>${esc(text)}</p><button class="btn small">Close <kbd>Space</kbd></button>`;
    this.layer.append(el);
    this.push('info');
    const close = () => {
      el.remove();
      this.pop('info');
    };
    el.querySelector('button')!.addEventListener('click', close);
    (el as any)._close = close;
    this.say(`${title}. ${text}`);
  }

  /** A short vignette for street experiences (phuchka, cha…). */
  scene(title: string, text: string, bn: string | undefined, seconds: number, onEnd?: () => void) {
    const el = h('div', 'scene-card');
    el.innerHTML = `${bn ? `<div class="scene-bn" lang="bn">${esc(bn)}</div>` : ''}<div class="scene-title">${esc(title)}</div><p>${esc(text)}</p><div class="scene-bar"><span></span></div><div class="dlg-hint"><kbd>Space</kbd> skip</div>`;
    this.layer.append(el);
    this.push('scene');
    const bar = el.querySelector('.scene-bar span') as HTMLElement;
    bar.style.transition = `width ${seconds}s linear`;
    requestAnimationFrame(() => (bar.style.width = '100%'));
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      el.classList.add('out');
      setTimeout(() => el.remove(), 400);
      this.pop('scene');
      onEnd?.();
    };
    (el as any)._close = close;
    setTimeout(close, seconds * 1000);
    this.say(`${title}. ${text}`);
  }

  // ------------------------------------------------------------------ rhythm (Dhaker Taal)
  rhythmCue(pattern: number[], onDone: () => void, playBeat: (i: number) => void, onSkip?: () => void, onCancel?: () => void) {
    this.rhythmEnd();
    const el = h('div', 'rhythm');
    el.innerHTML = `<div class="rhythm-title">Listen to the dhaki…</div><div class="drums">${pattern.map(() => `<div class="drum"><div class="drum-face"></div></div>`).join('')}</div><div class="rhythm-sub">Watch the drums light up — <em>dhak… dhak-dhak</em></div><button class="btn small skip">Skip <kbd>K</kbd></button>`;
    this.layer.append(el);
    this.rhythm = { el, m: null, onSkip, onCancel };
    this.push('rhythm');
    el.querySelector('.skip')!.addEventListener('click', () => this.rhythm?.onSkip?.());
    const drums = [...el.querySelectorAll('.drum')];
    const owner = this.rhythm;
    pattern.forEach((t, i) =>
      setTimeout(() => {
        if (this.rhythm !== owner) return;
        drums[i]?.classList.add('hit');
        playBeat(i);
        setTimeout(() => drums[i]?.classList.remove('hit'), 220);
      }, 700 + t * 1000),
    );
    setTimeout(() => this.rhythm === owner && onDone(), 700 + pattern[pattern.length - 1] * 1000 + 600);
  }
  rhythmListen(m: RhythmMachine, onSkip: () => void) {
    if (!this.rhythm) return;
    this.rhythm.m = m;
    this.rhythm.onSkip = onSkip;
    this.rhythm.el.querySelector('.rhythm-title')!.textContent = 'Your turn! Tap E three times in the same rhythm';
    this.rhythm.el.querySelector('.rhythm-sub')!.innerHTML = 'Each tap lights a drum. Take your time — there’s no fail.';
    this.rhythm.el.classList.add('listening');
  }
  rhythmTap(count: number) {
    const drums = this.rhythm?.el.querySelectorAll('.drum');
    drums?.[count - 1]?.classList.add('tapped');
  }
  rhythmEnd() {
    if (!this.rhythm) return;
    this.rhythm.el.remove();
    this.rhythm = null;
    this.pop('rhythm');
  }
  get rhythmActive() {
    return !!this.rhythm?.m;
  }

  // ------------------------------------------------------------------ postcard picker (Smritir Shohor)
  pickPostcard(m: MatchMachine, onPick: (id: string) => void) {
    const el = h('div', 'picker');
    const cards = m.cards;
    el.innerHTML = `<div class="picker-title">Choose a postcard</div><div class="cards">${cards
      .map(
        (c, i) => `<button class="postcard ${m.isPlaced(c.id) ? 'used' : ''}" data-i="${i}" ${m.isPlaced(c.id) ? 'disabled' : ''}>
          <div class="pc-art pc-${c.id}">${POSTCARD_ART[c.id] ?? ''}</div><div class="pc-title">${i + 1}. ${esc(c.title)}</div><div class="pc-cap">${esc(c.caption)}</div></button>`,
      )
      .join('')}</div><div class="dlg-hint"><kbd>1</kbd>–<kbd>3</kbd> or <kbd>←</kbd><kbd>→</kbd> then <kbd>Enter</kbd> · <kbd>Esc</kbd> close</div>`;
    this.layer.append(el);
    this.push('picker');
    this.picker = { el, m, onPick, sel: cards.findIndex((c) => !m.isPlaced(c.id)) };
    el.querySelectorAll<HTMLButtonElement>('.postcard').forEach((b) => b.addEventListener('click', () => this.choose(Number(b.dataset.i))));
    this.highlightPicker();
  }
  private highlightPicker() {
    const p = this.picker!;
    p.el.querySelectorAll('.postcard').forEach((b, i) => b.classList.toggle('sel', i === p.sel));
    (p.el.querySelectorAll('.postcard')[p.sel] as HTMLElement)?.focus({ preventScroll: true });
  }
  private choose(i: number) {
    const p = this.picker;
    if (!p) return;
    const c = p.m.cards[i];
    if (!c || p.m.isPlaced(c.id)) return;
    p.el.remove();
    this.picker = null;
    this.pop('picker');
    p.onPick(c.id);
  }

  // ------------------------------------------------------------------ passport
  openPassport(data: SaveData, justStamped?: PandalId) {
    this.closeAll(['passport']);
    const el = h('div', 'passport-wrap');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Puja Passport');
    const slots = PANDALS.map((p, i) => {
      const done = data.stamps.includes(p.id);
      const disc = data.discovered.includes(p.id);
      const d = DISTRICTS.find((x) => x.id === p.district)!;
      return `<div class="slot ${done ? 'done' : ''} ${justStamped === p.id ? 'fresh' : ''}" style="--c:${STAMP_ART[p.id].color}">
        <div class="slot-num">${i + 1}</div>
        <div class="slot-art">${done ? STAMP_ART[p.id].svg : `<div class="slot-empty">${disc ? '◌' : '?'}</div>`}</div>
        <div class="slot-name">${disc || done ? esc(p.name) : 'Undiscovered pandal'}</div>
        <div class="slot-bn" lang="bn">${disc || done ? p.bn : ''}</div>
        <div class="slot-bn slot-hi" lang="hi">${disc || done ? p.hi : ''}</div>
        <div class="slot-district">${esc(d.name)}</div>
        <div class="slot-status">${done ? 'Stamped ✓' : disc ? 'Discovered — not yet stamped' : 'Keep exploring'}</div>
      </div>`;
    }).join('');
    const secrets = data.secrets.length;
    el.innerHTML = `<div class="passport">
      <div class="pp-header"><div class="pp-bn" lang="bn">পূজা পাসপোর্ট</div><div class="pp-bn" lang="hi">पूजा पासपोर्ट</div><div class="pp-title">PUJA PASSPORT</div><div class="pp-sub">Anandapur · Ashtami Night · ${data.stamps.length}/${PANDALS.length} stamps</div></div>
      <div class="slots">${slots}</div>
      ${(() => {
        const mem = loadMemories();
        return `<div class="pp-memories"><div class="pp-mem-title">Memories <span lang="bn">স্মৃতি</span></div>${
          mem.length
            ? `<div class="pp-mem-strip">${mem.map((m) => `<figure><img src="${m.img}" alt="Selfie at ${esc(m.place)}"><figcaption>${esc(m.place)} · ${esc(m.at)}</figcaption></figure>`).join('')}</div>`
            : '<p class="pp-mem-empty">Take selfies at the photo spots — they will be kept here.</p>'
        }</div>`;
      })()}
      <div class="pp-footer"><span>Little discoveries: ${secrets}/5</span><button class="btn small" data-a="close">Close <kbd>P</kbd></button></div>
    </div>`;
    el.querySelector('[data-a=close]')!.addEventListener('click', () => this.close('passport'));
    el.addEventListener('click', (e) => e.target === el && this.close('passport'));
    this.layer.append(el);
    this.push('passport');
    (el.querySelector('[data-a=close]') as HTMLElement).focus({ preventScroll: true });
  }

  /** Big celebratory stamp moment, then the passport opens on the new stamp. */
  stampCelebration(id: PandalId, data: SaveData, then?: () => void) {
    const p = PANDAL_BY_ID[id];
    const el = h('div', 'stamp-moment');
    el.innerHTML = `<div class="stamp-big" style="--c:${STAMP_ART[p.id].color}">${STAMP_ART[p.id].svg}</div><div class="stamp-caption">${esc(p.stamp.label)} — stamped!</div><div class="stamp-count">Puja Passport ${data.stamps.length}/${PANDALS.length}</div>`;
    this.layer.append(el);
    this.say(`Stamp collected: ${p.stamp.label}. ${data.stamps.length} of ${PANDALS.length}.`);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => {
        el.remove();
        then?.();
      }, 500);
    }, 2300);
  }

  // ------------------------------------------------------------------ map
  openMap() {
    this.closeAll(['map']);
    const el = h('div', 'map-wrap');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'City map');
    el.innerHTML = `<div class="map-card"><div class="map-head"><div><div class="pp-bn" lang="bn">আনন্দপুর</div><div class="map-title">City of Anandapur</div></div><button class="btn small" data-a="close">Close <kbd>M</kbd></button></div><canvas width="900" height="760"></canvas><div class="map-legend"><span><i class="lg you"></i>You</span><span><i class="lg done"></i>Stamped</span><span><i class="lg disc"></i>Discovered</span><span><i class="lg unk"></i>Rumoured pandal</span><span><i class="lg dj">♪</i>DJ spot</span></div></div>`;
    this.mapCanvas = el.querySelector('canvas');
    el.querySelector('[data-a=close]')!.addEventListener('click', () => this.close('map'));
    el.addEventListener('click', (e) => e.target === el && this.close('map'));
    this.layer.append(el);
    this.push('map');
    this.hooks.drawMap(this.mapCanvas!);
    (el.querySelector('[data-a=close]') as HTMLElement).focus({ preventScroll: true });
  }
  refreshMap() {
    if (this.mapCanvas && this.modals.includes('map')) this.hooks.drawMap(this.mapCanvas);
  }

  // ------------------------------------------------------------------ pause / settings
  openPause(fromTitle = false) {
    this.closeAll(fromTitle ? ['title'] : []);
    const s = this.data.settings, a = this.data.audio;
    const el = h('div', 'pause-wrap');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Paused — settings');
    el.innerHTML = `<div class="pause-card">
      <div class="pause-title">${fromTitle ? 'Settings' : 'Paused'}</div>
      <div class="set-grid">
        <label>Master volume <input type="range" min="0" max="1" step="0.05" data-k="master" value="${a.master}"></label>
        <label>Music <input type="range" min="0" max="1" step="0.05" data-k="music" value="${a.music}"></label>
        <label>Ambience <input type="range" min="0" max="1" step="0.05" data-k="ambient" value="${a.ambient}"></label>
        <label class="chk"><input type="checkbox" data-k="muted" ${a.muted ? 'checked' : ''}> Mute all sound</label>
        <label>Graphics quality <select data-k="quality"><option value="low">Low (integrated GPUs)</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        <label class="chk"><input type="checkbox" data-k="reducedMotion" ${s.reducedMotion ? 'checked' : ''}> Reduced motion</label>
        <label class="chk"><input type="checkbox" data-k="guidance" ${s.guidance ? 'checked' : ''}> Wayfinding guidance (show all pandals on map)</label>
        <label class="chk"><input type="checkbox" data-k="translations" ${s.translations ? 'checked' : ''}> Show English translations of Bengali</label>
        <label class="chk"><input type="checkbox" data-k="subtitles" ${s.subtitles ? 'checked' : ''}> Subtitles for spoken cues</label>
      </div>
      <div class="controls-help kbd-only"><b>Controls</b> · WASD/Arrows walk · Shift jog · Drag to look · Wheel zoom · E interact · M map · P passport · C photo · Space advance · Esc pause</div>
      <div class="controls-help touch-only"><b>Controls</b> · Joystick (lower-left) to walk; hold it forward for 2 s to run · Swipe to look · Pinch to zoom · Round button to interact · Map, passport and ☰ buttons at the top</div>
      <div class="pause-buttons">
        ${fromTitle ? '' : '<button class="btn primary" data-a="resume">Resume</button>'}
        <button class="btn" data-a="outfit">Outfit</button>
        <button class="btn danger" data-a="reset">Reset Adventure</button>
        ${fromTitle ? '<button class="btn primary" data-a="back">Back</button>' : ''}
      </div>
      <p class="about credit-maker">Made by <b>Trishit Mondal</b>, with his coding agents · IG <a href="https://www.instagram.com/trishit_mondal/" target="_blank" rel="noopener">@trishit_mondal</a></p>
      <p class="about">Dhak recording: “Durga Puja Dhak Dhol” by Mamta Jagdish Dhody, Wikimedia Commons (CC BY-SA 4.0). Crowd recording: “Crowd Talking 003”, Wikimedia Commons (CC0). Font: Baloo Da 2 (OFL).</p>
      <p class="about">Anandapur and its pandals are fictional. Durga Puja is a living tradition inscribed by UNESCO in 2021; this game is a loving tribute, not a depiction of real worship.</p>
    </div>`;
    (el.querySelector('select') as HTMLSelectElement).value = s.quality;
    el.querySelectorAll('input[type=range]').forEach((inp) =>
      inp.addEventListener('input', () => this.hooks.onAudio({ [(inp as HTMLInputElement).dataset.k!]: Number((inp as HTMLInputElement).value) })),
    );
    el.querySelectorAll('input[type=checkbox]').forEach((inp) =>
      inp.addEventListener('change', () => {
        const k = (inp as HTMLInputElement).dataset.k!;
        const v = (inp as HTMLInputElement).checked;
        if (k === 'muted') this.hooks.onAudio({ muted: v });
        else this.hooks.onSettings({ [k]: v });
      }),
    );
    el.querySelector('select')!.addEventListener('change', (e) => this.hooks.onSettings({ quality: (e.target as HTMLSelectElement).value as Settings['quality'] }));
    el.querySelector('[data-a=resume]')?.addEventListener('click', () => this.close('pause'));
    el.querySelector('[data-a=back]')?.addEventListener('click', () => this.close('pause'));
    el.querySelector('[data-a=outfit]')!.addEventListener('click', () => this.openOutfit());
    el.querySelector('[data-a=reset]')!.addEventListener('click', () =>
      this.confirm('Reset your adventure?', 'All stamps, discoveries and your position will be cleared. This cannot be undone.', () => this.hooks.onReset()),
    );
    this.layer.append(el);
    this.push('pause');
    ((el.querySelector('[data-a=resume]') ?? el.querySelector('[data-a=back]')) as HTMLElement).focus({ preventScroll: true });
  }

  confirm(title: string, text: string, yes: () => void, yesLabel = 'Yes, reset') {
    const el = h('div', 'confirm-wrap');
    el.innerHTML = `<div class="confirm-card" role="alertdialog"><div class="pause-title">${esc(title)}</div><p>${esc(text)}</p><div class="pause-buttons"><button class="btn" data-a="no">Cancel</button><button class="btn danger" data-a="yes">${esc(yesLabel)}</button></div></div>`;
    this.layer.append(el);
    this.push('confirm');
    const close = () => {
      el.remove();
      this.pop('confirm');
    };
    el.querySelector('[data-a=no]')!.addEventListener('click', close);
    el.querySelector('[data-a=yes]')!.addEventListener('click', () => {
      close();
      yes();
    });
    (el.querySelector('[data-a=no]') as HTMLElement).focus({ preventScroll: true });
  }

  openOutfit() {
    const o = { ...this.data.outfit };
    const el = h('div', 'outfit-wrap');
    const styles: [Outfit['style'], string][] = [['kurta', 'Kurta-pyjama'], ['sari', 'Sari'], ['salwar', 'Salwar kameez'], ['shirt', 'Shirt & trousers'], ['tee', 'T-shirt & jeans']];
    const colors = [0xf4eedf, 0xf2c14e, 0xb3121f, 0x2f6b4e, 0x1a5fb4, 0xd94f7a, 0x7a3e9d, 0xe8743a];
    const accents = [0xb3121f, 0xd4af37, 0x2f6b4e, 0x1a5fb4, 0xf4eedf];
    const hairs: [Outfit['hair'], string][] = [['short', 'Short'], ['bun', 'Khopa (bun)'], ['braid', 'Beni (braid)']];
    const sw = (c: number, k: string) => `<button class="swatch" data-k="${k}" data-v="${c}" style="background:#${c.toString(16).padStart(6, '0')}" aria-label="colour #${c.toString(16)}"></button>`;
    el.innerHTML = `<div class="pause-card"><div class="pause-title">Choose your Puja outfit</div>
      <div class="opt-row"><span>Style</span>${styles.map(([v, n]) => `<button class="chip" data-k="style" data-v="${v}">${n}</button>`).join('')}</div>
      <div class="opt-row"><span>Colour</span>${colors.map((c) => sw(c, 'color')).join('')}</div>
      <div class="opt-row"><span>Border / accent</span>${accents.map((c) => sw(c, 'accent')).join('')}</div>
      <div class="opt-row"><span>Hair</span>${hairs.map(([v, n]) => `<button class="chip" data-k="hair" data-v="${v}">${n}</button>`).join('')}</div>
      <div class="pause-buttons"><button class="btn primary" data-a="done">Done</button></div></div>`;
    const mark = () =>
      el.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => b.classList.toggle('on', String((o as any)[b.dataset.k!]) === b.dataset.v));
    el.querySelectorAll<HTMLElement>('[data-k]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.k!;
        (o as any)[k] = k === 'color' || k === 'accent' ? Number(b.dataset.v) : b.dataset.v;
        mark();
        this.hooks.onOutfit({ ...o });
      }),
    );
    mark();
    el.querySelector('[data-a=done]')!.addEventListener('click', () => {
      el.remove();
      this.pop('outfit');
    });
    this.layer.append(el);
    this.push('outfit');
  }

  // ------------------------------------------------------------------ tutorial
  tutorial(steps: { text: string; keys: string }[], onEnd: () => void) {
    const el = h('div', 'tutorial');
    let i = 0;
    const render = () => {
      el.innerHTML = `<div class="tut-keys">${steps[i].keys}</div><div class="tut-text">${steps[i].text}</div><div class="tut-actions"><button class="btn small" data-a="skip">Skip tips</button><button class="btn small primary" data-a="next">${i < steps.length - 1 ? 'Next' : 'Let’s go!'}</button></div>`;
      el.querySelector('[data-a=next]')!.addEventListener('click', () => {
        i++;
        if (i >= steps.length) end();
        else render();
      });
      el.querySelector('[data-a=skip]')!.addEventListener('click', end);
    };
    const end = () => {
      el.remove();
      onEnd();
    };
    render();
    this.layer.append(el);
  }

  // ------------------------------------------------------------------ finale
  finaleInvite() {
    this.dialogue(
      [
        { name: 'Puja Passport', text: '8 / 8 — PUJA PASSPORT COMPLETE!' },
        { name: 'Pishi', text: 'Every street has a story. Every pandal has a memory.' },
        { name: 'Pishi', text: 'Come down to Nodi Ghat before dawn — the river will be waiting for you.', bn: 'নদী ঘাটে চলো!', tr: '“Let’s go to the river ghat!”' },
      ],
      undefined,
    );
  }

  finale(data: SaveData, onClose: () => void) {
    this.closeAll([]);
    const el = h('div', 'finale');
    el.innerHTML = `<div class="finale-card">
      <div class="finale-bn" lang="bn">শুভ শারদীয়া</div>
      <div class="finale-bn" lang="hi">शुभ शारदीया</div>
      <div class="finale-line big">Shubho Sharodiya.</div>
      <div class="finale-line">Thank you for exploring Anandapur.</div>
      <div class="finale-line">Your Pujo night will always be here.</div>
      <div class="finale-line credit-maker">Made by Trishit Mondal, with his coding agents · IG @trishit_mondal</div>
      <div class="finale-stamps">${PANDALS.map((p) => `<div class="mini" title="${esc(p.name)}" style="--c:${STAMP_ART[p.id].color}">${data.stamps.includes(p.id) ? STAMP_ART[p.id].svg : ''}</div>`).join('')}</div>
      <button class="btn primary" data-a="close">Keep exploring</button></div>`;
    this.layer.append(el);
    this.push('finale');
    el.querySelector('[data-a=close]')!.addEventListener('click', () => {
      el.classList.add('fade');
      setTimeout(() => el.remove(), 700);
      this.pop('finale');
      this.cinematic(false);
      onClose();
    });
    setTimeout(() => el.classList.add('show'), 50);
    setTimeout(() => (el.querySelector('[data-a=close]') as HTMLElement)?.focus({ preventScroll: true }), 1200);
  }

  // ------------------------------------------------------------------ photo mode
  photoMode(on: boolean) {
    this.root.classList.toggle('photo', on);
    if (on) {
      this.push('photo');
      const el = h('div', 'photo-bar');
      el.innerHTML = `<span>Photo mode — drag to frame, wheel to zoom</span><button class="btn small primary" data-a="snap">Save photo</button><button class="btn small" data-a="exit">Exit <kbd>C</kbd></button>`;
      el.querySelector('[data-a=snap]')!.addEventListener('click', () => this.hooks.onPhoto());
      el.querySelector('[data-a=exit]')!.addEventListener('click', () => this.handle('photo'));
      this.root.append(el);
    } else {
      this.pop('photo');
      this.root.querySelector('.photo-bar')?.remove();
    }
  }

  contextLost(on: boolean) {
    let el = this.root.querySelector('.ctx-lost');
    if (on && !el) {
      el = h('div', 'ctx-lost', '<div class="pause-card"><div class="pause-title">Restoring the lights…</div><p>The graphics context was lost. Your progress is saved — it should recover in a moment, or reload the page.</p></div>');
      this.root.append(el);
    } else if (!on) el?.remove();
  }

  // ------------------------------------------------------------------ input routing
  private close(m: Modal) {
    const sel: Record<string, string> = { passport: '.passport-wrap', map: '.map-wrap', pause: '.pause-wrap', outfit: '.outfit-wrap', picker: '.picker' };
    if (sel[m]) this.layer.querySelector(sel[m])?.remove();
    if (m === 'picker') this.picker = null;
    if (m === 'pause') this.hooks.onResume();
    this.pop(m);
  }
  private closeAll(except: Modal[]) {
    for (const m of ['passport', 'map', 'pause'] as Modal[]) if (!except.includes(m) && this.modals.includes(m)) this.close(m);
  }

  /** Route an action; returns true if the UI consumed it. */
  handle(a: Action | 'confirm', keys: string[] = []): boolean {
    const top = this.top();
    if (top === 'photo') {
      if (a === 'photo' || a === 'pause') {
        this.photoMode(false);
        return true;
      }
      return false;
    }
    if (top === 'outfit') {
      if (a === 'pause') (this.layer.querySelector('.outfit-wrap [data-a=done]') as HTMLElement)?.click();
      return true;
    }
    if (top === 'title' || top === 'finale' || top === 'confirm') return true;
    if (top === 'dialogue') {
      if (a === 'advance' || a === 'interact') this.advance();
      return true;
    }
    if (top === 'info' || top === 'scene') {
      if (a === 'advance' || a === 'interact' || a === 'pause') {
        const sel = top === 'info' ? '.info-card' : '.scene-card';
        (this.layer.querySelector(sel) as any)?._close?.();
      }
      return true;
    }
    if (top === 'picker' && this.picker) {
      const p = this.picker;
      for (const k of keys) {
        if (k === 'ArrowRight' || k === 'ArrowDown') p.sel = (p.sel + 1) % p.m.cards.length;
        if (k === 'ArrowLeft' || k === 'ArrowUp') p.sel = (p.sel + p.m.cards.length - 1) % p.m.cards.length;
        if (/^Digit[1-9]$/.test(k)) this.choose(Number(k.slice(5)) - 1);
      }
      if (this.picker) this.highlightPicker();
      if (a === 'advance' || a === 'interact') this.choose(p.sel);
      if (a === 'pause') this.close('picker');
      return true;
    }
    if (top === 'rhythm') {
      if (a === 'skip') this.rhythm?.onSkip?.();
      if (a === 'pause') this.rhythm?.onCancel?.();
      return a !== 'interact'; // E taps go through to the game
    }
    if (a === 'passport') {
      if (top === 'passport') this.close('passport');
      else this.openPassport(this.data);
      return true;
    }
    if (a === 'map') {
      if (top === 'map') this.close('map');
      else this.openMap();
      return true;
    }
    if (a === 'pause') {
      if (top === 'passport' || top === 'map' || top === 'pause') this.close(top);
      else this.openPause();
      return true;
    }
    if (a === 'photo') {
      if (!this.blocking) this.photoMode(true);
      return true;
    }
    return this.blocking;
  }
}

const ICON = {
  map: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h14"/></svg>`,
};

const POSTCARD_ART: Record<string, string> = {
  'card-tram': `<svg viewBox="0 0 100 60"><rect width="100" height="60" fill="#e9dcbc"/><rect x="14" y="22" width="72" height="22" rx="3" fill="#3f6b4e"/><rect x="14" y="22" width="72" height="9" fill="#efe3c2"/><rect x="20" y="24" width="8" height="5" fill="#ffd99a"/><rect x="32" y="24" width="8" height="5" fill="#ffd99a"/><rect x="44" y="24" width="8" height="5" fill="#ffd99a"/><rect x="56" y="24" width="8" height="5" fill="#ffd99a"/><path d="M50 22 l-5-12 M50 22 l5-12 M40 10 h20" stroke="#222" stroke-width="1.5"/><path d="M4 50 h92" stroke="#555" stroke-width="2"/><circle cx="26" cy="46" r="3" fill="#222"/><circle cx="74" cy="46" r="3" fill="#222"/></svg>`,
  'card-clock': `<svg viewBox="0 0 100 60"><rect width="100" height="60" fill="#f3c9a4"/><rect x="40" y="12" width="20" height="44" fill="#b5562f"/><path d="M36 14 l14 -10 l14 10z" fill="#8c2f22"/><circle cx="50" cy="24" r="7" fill="#f4eedf" stroke="#222"/><path d="M50 24 v-5 M50 24 h4" stroke="#222" stroke-width="1.4"/><rect x="0" y="50" width="100" height="10" fill="#7a5644"/><circle cx="82" cy="12" r="6" fill="#ffdd88"/></svg>`,
  'card-cha': `<svg viewBox="0 0 100 60"><rect width="100" height="60" fill="#d9e4dc"/><rect x="18" y="30" width="64" height="18" fill="#7a4a2a"/><path d="M30 30 q-2-10 4-16 M50 30 q-2-12 4-18 M70 30 q-2-10 4-16" stroke="#fff" stroke-width="2" fill="none" opacity="0.8"/><path d="M28 30 l2-8 h8 l2 8z M46 30 l2-8 h8 l2 8z M64 30 l2-8 h8 l2 8z" fill="#b5562f"/><rect x="0" y="48" width="100" height="12" fill="#8a7a66"/></svg>`,
};
