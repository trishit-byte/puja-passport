/**
 * Procedural WebAudio sound for Anandapur — every sound is synthesised at runtime (no recordings,
 * no licensing concerns, zero download):
 *   • spatial dhak ensembles (louder near Dhaker Taal and roaming dhakis)
 *   • crowd murmur bed, river wash near the ghat
 *   • bell (inharmonic partials), chimes, stamp thump, footsteps, UI ticks
 *   • DJ-box music (the owner's songs, or original generated tracks as a fallback) — see DjMusic.ts
 * The AudioContext is only created after a user gesture (Start button).
 */
import { DHAK_FILES, DHAK_CUTS, type DhakFile } from '../data/dhakCuts';
import { DjChannel, unlockSongPlayers, type SongEntry } from './DjMusic';

export interface AudioSettings {
  master: number;
  music: number;
  ambient: number;
  muted: boolean;
}

type Src = { x: number; z: number; gain: GainNode; panner: PannerNode };
/** A dhak ensemble (dhakis + kansor) or an aarti spot (ghanta bells + shankh) placed in the world. */
type Ensemble = Src & { timed?: boolean; id: string; kind: 'dhak' | 'aarti'; vol: number; next: number; idx: number; bar: number; step: number; dhakis: number; cutIdx: number; nextCut: number; playing: { src: AudioBufferSourceNode; g: GainNode }[] };
export type SoundSpot = { id: string; x: number; z: number; kind: 'dhak' | 'aarti'; vol?: number; dhakis?: number; timed?: boolean };

/**
 * Dhak bols as 16-step bars: D = "dhyang" (deep stroke + stick slap), k = "kur" (treble flick),
 * r = roll (three rapid flicks), . = rest. The kansor rings on every beat.
 */
const BOLS = ['D.kkD.kkD.D.kkr.', 'D..kD..kD.kkD.r.', 'D.kkD.kkDkkkDkkk', 'D.k.D.k.DDkkrrD.'];

/** Positional sources are panned anyway: a mono copy plays the same and takes half the memory. */
function toMono(c: BaseAudioContext, b: AudioBuffer): AudioBuffer {
  if (b.numberOfChannels < 2) return b;
  const m = c.createBuffer(1, b.length, b.sampleRate);
  const out = m.getChannelData(0);
  const n = b.numberOfChannels;
  for (let ch = 0; ch < n; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < d.length; i++) out[i] += d[i] / n;
  }
  return m;
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private amb!: GainNode;
  private sfx!: GainNode;
  private noiseBuf!: AudioBuffer;
  private ensembles: Ensemble[] = [];
  private buffers: Partial<Record<DhakFile, AudioBuffer>> = {};
  samplesReady = false;

  /** Fetch + decode the real dhak recordings; until (or unless) they load, the synthesised dhak plays. */
  private async loadSamples() {
    const c = this.ctx!;
    try {
      await Promise.all(
        (Object.keys(DHAK_FILES) as DhakFile[]).map(async (k) => {
          const res = await fetch(DHAK_FILES[k].url);
          if (!res.ok) throw new Error(`${k}: ${res.status}`);
          this.buffers[k] = toMono(c, await c.decodeAudioData(await res.arrayBuffer()));
        }),
      );
      this.samplesReady = true;
    } catch (e) {
      console.warn('Dhak recordings unavailable, using synthesised dhak', e);
    }
  }

  /** Schedule the next cut of this pandal's recording, cross-fading over the previous one. */
  private playCut(e: Ensemble, t: number) {
    const cuts = DHAK_CUTS[e.id];
    const [file, a, b] = cuts[e.cutIdx++ % cuts.length];
    const buf = this.buffers[file]!;
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    const dur = Math.min(b, buf.duration) - a;
    const fade = 0.6;
    const level = DHAK_FILES[file].gain * e.vol * 0.75;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + fade);
    g.gain.setValueAtTime(level, t + dur - fade);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(g).connect(e.gain);
    src.start(t, a, dur);
    const rec = { src, g };
    e.playing.push(rec);
    src.onended = () => (e.playing = e.playing.filter((p) => p !== rec));
    e.nextCut = t + dur - fade;
  }
  analyser: AnalyserNode | null = null;
  private lx = 0;
  private lz = 0;
  private finaleMode = false;
  private riverSrc: Src | null = null;
  settings: AudioSettings = { master: 0.85, music: 0.85, ambient: 0.75, muted: false };

  get running() {
    return this.ctx?.state === 'running';
  }

  /** Must be called from a user gesture. */
  /**
   * Call inside any tap: unlock the song players and set the audio up as media playback, so the
   * iPhone ring/silent switch doesn't mute the game; resume a suspended context.
   */
  prime() {
    unlockSongPlayers();
    try {
      const as = (navigator as any).audioSession;
      if (as && as.type !== 'playback') as.type = 'playback';
    } catch {
      /* not supported */
    }
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  async start(spots: SoundSpot[], river: { x: number; z: number }) {
    // still inside the Start tap here
    this.prime();
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain();
      // gentle bus compressor: several dhak ensembles + crowd can stack up near pandals
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 10;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.25;
      this.master.connect(comp).connect(c.destination);
      this.analyser = c.createAnalyser();
      this.analyser.fftSize = 2048;
      this.master.connect(this.analyser);
      this.music = c.createGain();
      this.amb = c.createGain();
      this.sfx = c.createGain();
      for (const g of [this.music, this.amb, this.sfx]) g.connect(this.master);
      this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + w * 0.029591;
        b1 = 0.985 * b1 + w * 0.032534;
        b2 = 0.95 * b2 + w * 0.048056;
        d[i] = (b0 + b1 + b2 + w * 0.05) * 0.9; // pinkish
      }
      this.applySettings();
      this.crowd();
      for (const sp of spots) {
        const src = this.spatial(sp.x, sp.z, 1.0, 40);
        this.ensembles.push({ ...src, timed: sp.timed, id: sp.id, cutIdx: Math.floor(Math.random() * 3), nextCut: 0, playing: [], kind: sp.kind, vol: sp.vol ?? 1, next: c.currentTime + 0.3 + Math.random() * 0.5, idx: 0, bar: Math.floor(Math.random() * 4), step: 0.118 + Math.random() * 0.012, dhakis: sp.dhakis ?? 2 });
      }
      this.loadSamples();
      this.createDjs();
      this.loadPlaylist();
      this.riverSrc = this.spatial(river.x, river.z, 0.0, 30);
      this.riverLoop(this.riverSrc);
    }
    if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => {});
    if (!this.wakeHooked) {
      // phones suspend audio on calls, app switches and screen locks: pick it up again on the
      // next touch or when the page is shown
      this.wakeHooked = true;
      const wake = (e?: Event) => {
        if (e && e.type !== 'visibilitychange') unlockSongPlayers();
        if (this.ctx && this.ctx.state !== 'running' && !document.hidden) this.ctx.resume().catch(() => {});
      };
      for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) document.addEventListener(ev, wake, { passive: true });
      document.addEventListener('visibilitychange', wake);
    }
  }
  private wakeHooked = false;

  applySettings(s: Partial<AudioSettings> = {}) {
    Object.assign(this.settings, s);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const on = this.settings.muted ? 0 : 1;
    this.master.gain.setTargetAtTime(this.settings.master * on, t, 0.05);
    this.music.gain.setTargetAtTime(this.settings.music * 1.0, t, 0.1);
    this.amb.gain.setTargetAtTime(this.settings.ambient * (1 - this.djPresence), t, 0.1);
    this.sfx.gain.setTargetAtTime(0.9, t, 0.05);
  }

  private spatial(x: number, z: number, gain: number, ref: number): Src {
    const c = this.ctx!;
    const p = c.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    // panning only; loudness vs distance is shaped by hand in update() (sharper, musical fades)
    p.refDistance = 1;
    p.maxDistance = 10000;
    p.rolloffFactor = 0;
    p.positionX.value = x;
    p.positionY.value = 2;
    p.positionZ.value = z;
    const g = c.createGain();
    g.gain.value = gain;
    g.connect(p).connect(this.amb);
    void ref;
    return { x, z, gain: g, panner: p };
  }

  setListener(x: number, z: number, yaw: number) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(x, t, 0.05);
      l.positionY.setTargetAtTime(1.6, t, 0.05);
      l.positionZ.setTargetAtTime(z, t, 0.05);
      l.forwardX.setTargetAtTime(Math.sin(yaw), t, 0.05);
      l.forwardY.setTargetAtTime(0, t, 0.05);
      l.forwardZ.setTargetAtTime(Math.cos(yaw), t, 0.05);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      (l as any).setPosition(x, 1.6, z);
      (l as any).setOrientation(Math.sin(yaw), 0, Math.cos(yaw), 0, 1, 0);
    }
  }

  // ---------------- one-shots ----------------
  private env(g: GainNode, t: number, a: number, peak: number, dec: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  noise(dest: AudioNode, t: number, dur: number, type: BiquadFilterType, f: number, q: number, peak: number) {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.playbackRate.value = 1 + Math.random() * 0.2;
    const fl = c.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    fl.Q.value = q;
    const g = c.createGain();
    this.env(g, t, 0.003, peak, dur);
    s.connect(fl).connect(g).connect(dest);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  tone(dest: AudioNode, t: number, f: number, dur: number, type: OscillatorType, peak: number, attack = 0.005, f2?: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur * 0.6);
    const g = c.createGain();
    this.env(g, t, attack, peak, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  /**
   * A dhak stroke. The dhak is a big barrel drum played with thin bamboo sticks: its voice is a
   * boomy membrane (with plenty of 150–400 Hz body so it carries on laptop speakers) plus a
   * crisp, slightly rattly stick slap. "D" = dhyang (full stroke), "k" = kur (treble flick).
   */
  dhakStroke(dest: AudioNode, t: number, stroke: 'D' | 'k', vol = 1) {
    const j = 1 + (Math.random() - 0.5) * 0.06;
    if (stroke === 'D') {
      // membrane modes with a pitch drop
      for (const [r, a, dec] of [[1, 0.55, 0.42], [1.59, 0.32, 0.28], [2.14, 0.22, 0.2], [2.65, 0.12, 0.14]] as const)
        this.tone(dest, t, 150 * r * j, dec, 'sine', a * vol, 0.002, 98 * r * j);
      this.tone(dest, t, 310 * j, 0.09, 'triangle', 0.18 * vol, 0.001, 240 * j);
      this.noise(dest, t, 0.07, 'bandpass', 1500, 1.0, 0.85 * vol); // stick slap
      this.noise(dest, t + 0.004, 0.12, 'bandpass', 3200, 2.0, 0.3 * vol); // head rattle
    } else {
      this.tone(dest, t, 520 * j, 0.06, 'triangle', 0.16 * vol, 0.001, 380 * j);
      this.noise(dest, t, 0.045, 'bandpass', 2300 * j, 1.4, 0.7 * vol);
      this.noise(dest, t, 0.03, 'highpass', 5000, 0.7, 0.08 * vol);
    }
  }

  /** Kansor: hand-held bell-metal gong — bright, inharmonic, short "chhan". */
  kansor(dest: AudioNode, t: number, vol = 1) {
    for (const [r, a, dec] of [[1, 0.1, 0.35], [2.76, 0.07, 0.25], [5.4, 0.05, 0.18], [8.93, 0.03, 0.12]] as const)
      this.tone(dest, t, 720 * r, dec, 'sine', a * 1.6 * vol, 0.001);
    this.noise(dest, t, 0.07, 'highpass', 4000, 0.8, 0.3 * vol);
  }

  /** Aarti ghanta: small brass hand bell, rung in quick bursts. */
  ghanta(dest: AudioNode, t: number, vol = 1) {
    for (const [r, a, dec] of [[1, 0.12, 1.2], [2.41, 0.06, 0.8], [3.9, 0.04, 0.5], [5.3, 0.025, 0.35]] as const)
      this.tone(dest, t, 1350 * r, dec, 'sine', a * vol, 0.001);
  }

  /** Back-compat: interaction hits (Dhaker Taal taps) use a full stroke. */
  dhakHit(dest: AudioNode, t: number, accent: boolean, vol = 1) {
    this.dhakStroke(dest, t, accent ? 'D' : 'k', vol);
  }

  dhak(accent = true) {
    if (!this.ctx) return;
    this.dhakStroke(this.sfx, this.ctx.currentTime, accent ? 'D' : 'k', 1.3);
    if (accent) this.kansor(this.sfx, this.ctx.currentTime, 0.6);
  }

  bell() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f0 = 640;
    [1, 2.32, 4.25, 5.43, 6.8, 8.2].forEach((r, i) => this.tone(this.sfx, t, f0 * r, 3.2 / (1 + i * 0.5), 'sine', 0.22 / (1 + i * 0.6), 0.002));
    this.noise(this.sfx, t, 0.04, 'highpass', 3000, 0.7, 0.15);
  }

  /** A vehicle horn / rickshaw bell at a world position, attenuated by distance to the listener. */
  /** True during the evening and midnight aartis (bells ring at every pandal). */
  aartiNow = false;

  honk(dist: number, kind: 'car' | 'bike' | 'bell') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = Math.max(0, 1 - dist / 25) * 0.5;
    if (g <= 0.01) return;
    if (kind === 'bell') {
      for (const k of [0, 0.14]) [1, 2.7, 5.1].forEach((r, i) => this.tone(this.sfx, t + k, 2100 * r, 0.35, 'sine', (g * 0.3) / (1 + i), 0.002));
    } else {
      const f = kind === 'car' ? 410 : 620;
      const n = kind === 'car' ? 2 : 3;
      for (let k = 0; k < n; k++) {
        this.tone(this.sfx, t + k * 0.22, f, 0.16, 'square', g * 0.16, 0.01);
        this.tone(this.sfx, t + k * 0.22, f * 1.26, 0.16, 'square', g * 0.11, 0.01);
      }
    }
  }

  chime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      this.tone(this.sfx, t + i * 0.09, f, 0.9, 'triangle', 0.12, 0.004);
      this.tone(this.sfx, t + i * 0.09, f * 2, 0.6, 'sine', 0.05, 0.004);
    });
  }

  stamp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(this.sfx, t, 110, 0.25, 'sine', 0.6, 0.002, 60);
    this.noise(this.sfx, t, 0.08, 'lowpass', 1800, 0.5, 0.5);
    // celebratory flourish: a small Bhupali run on a bright pluck
    [392, 440, 523.25, 587.33, 659.25].forEach((f, i) => this.tone(this.sfx, t + 0.25 + i * 0.07, f, 0.5, 'triangle', 0.09, 0.003));
    this.shankh(t + 0.6, 0.5);
  }

  /** Conch (shankh) call: breathy sawtooth through a resonant band. */
  shankh(t = this.ctx?.currentTime ?? 0, vol = 1) {
    if (!this.ctx) return;
    this.shankhAt(this.sfx, t, vol);
  }

  shankhAt(dest: AudioNode, t: number, vol = 1) {
    if (!this.ctx) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(330, t);
    o.frequency.linearRampToValueAtTime(349, t + 0.25);
    o.frequency.linearRampToValueAtTime(330, t + 1.4);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 3;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08 * vol, t + 0.25);
    g.gain.setValueAtTime(0.08 * vol, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    o.connect(f).connect(g).connect(dest);
    o.start(t);
    o.stop(t + 1.9);
  }

  soft() {
    if (!this.ctx) return;
    this.tone(this.sfx, this.ctx.currentTime, 440, 0.3, 'sine', 0.08);
  }

  click() {
    if (!this.ctx) return;
    this.tone(this.sfx, this.ctx.currentTime, 1200, 0.05, 'square', 0.03);
  }

  step(jog: boolean) {
    if (!this.ctx) return;
    this.noise(this.sfx, this.ctx.currentTime, jog ? 0.07 : 0.05, 'lowpass', jog ? 900 : 700, 0.7, jog ? 0.12 : 0.07);
  }

  eat() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) this.noise(this.sfx, t + i * 0.35, 0.06, 'highpass', 2500, 1, 0.12); // crunch!
  }

  sip() {
    if (!this.ctx) return;
    this.noise(this.sfx, this.ctx.currentTime, 0.5, 'bandpass', 1200, 4, 0.05);
  }

  // ---------------- beds ----------------
  /**
   * The crowd: a real recording of a crowd talking (CC0, see CREDITS.txt), looped seamlessly.
   * Two layers play from different points in the loop so it never audibly repeats: a near layer
   * whose level follows how many people are around you (and so the hour), and a softer, duller
   * far layer that keeps a faint city hum everywhere.
   */
  private crowdBus!: GainNode;
  private crowdNear!: GainNode;
  private crowdLevel = 0;
  private crowd() {
    const c = this.ctx!;
    this.crowdBus = c.createGain();
    this.crowdBus.gain.value = 1;
    this.crowdBus.connect(this.amb);
    this.crowdNear = c.createGain();
    this.crowdNear.gain.value = 0;
    this.crowdNear.connect(this.crowdBus);
    const far = c.createGain();
    far.gain.value = 0.12;
    far.connect(this.crowdBus);
    fetch('assets/audio/crowd-walla.ogg')
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((ab) => c.decodeAudioData(ab))
      .then((buf) => {
        const layer = (dest: AudioNode, offset: number, rate: number, pan: number, lowpass: number) => {
          const s = c.createBufferSource();
          s.buffer = buf;
          s.loop = true;
          s.playbackRate.value = rate;
          const lp = c.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = lowpass;
          const p = c.createStereoPanner();
          p.pan.value = pan;
          s.connect(lp).connect(p).connect(dest);
          s.start(c.currentTime + 0.05, offset % buf.duration);
        };
        layer(this.crowdNear, 0, 1, -0.15, 9000);
        layer(this.crowdNear, buf.duration * 0.47, 0.985, 0.2, 7000);
        layer(far, buf.duration * 0.23, 0.97, 0, 1600);
      })
      .catch((e) => console.warn('Crowd recording unavailable', e));
  }

  /** How busy it is around the listener, 0 (empty) … 1 (packed). */
  setCrowd(level: number) {
    this.crowdLevel = Math.max(0, Math.min(1, level));
  }

  private tickCrowd() {
    if (!this.crowdNear) return;
    const k = this.crowdLevel;
    this.crowdNear.gain.setTargetAtTime(0.05 + 0.75 * k, this.ctx!.currentTime, 0.9);
  }

  private riverLoop(src: Src) {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    s.playbackRate.value = 0.5;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const g = c.createGain();
    g.gain.value = 0.9;
    s.connect(f).connect(g).connect(src.gain);
    src.gain.gain.value = 1.2;
    s.start();
  }


  /** RMS output level in dBFS (for tests / debugging). */
  level(): number {
    if (!this.analyser) return -Infinity;
    const a = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(a);
    let s = 0;
    for (const v of a) s += v * v;
    return 10 * Math.log10(s / a.length + 1e-12);
  }

  /** Record the mixed output for `ms` milliseconds (debug: lets us listen to a headless session). */
  record(ms: number): Promise<Blob> {
    const c = this.ctx!;
    const dest = c.createMediaStreamDestination();
    this.master.connect(dest);
    const rec = new MediaRecorder(dest.stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    return new Promise((res) => {
      rec.onstop = () => {
        this.master.disconnect(dest);
        res(new Blob(chunks, { type: rec.mimeType }));
      };
      rec.start();
      setTimeout(() => rec.stop(), ms);
    });
  }

  // ---------------- DJ boxes ----------------
  djs: DjChannel[] = [];
  /** 0..1 how deep the listener is inside a DJ zone (ducks everything else). */
  djPresence = 0;
  songs: SongEntry[] = [];
  private djPending: { x: number; z: number }[] = [];

  /** Register DJ box positions (call before or after start). */
  addDjBoxes(spots: { x: number; z: number }[]) {
    this.djPending.push(...spots);
    if (this.ctx) this.createDjs();
  }

  private createDjs() {
    const c = this.ctx!;
    for (const sp of this.djPending.splice(0)) {
      const ch = new DjChannel(this, c, this.music, sp.x, sp.z, this.djs.length);
      this.djs.push(ch);
      this.nextTrack(ch, true);
    }
  }

  /** Read the list of songs the player has added (generated by scripts/scan-songs.mjs). */
  private async loadPlaylist() {
    try {
      const res = await fetch('assets/audio/songs/available.json');
      if (!res.ok) return;
      this.songs = ((await res.json()).songs ?? []) as SongEntry[];
      if (this.songs.length) this.djs.forEach((d) => this.nextTrack(d, true));
    } catch {
      /* no list: built-in tracks only */
    }
  }

  /**
   * Songs are dealt like a shuffled deck: every song is used once before any repeats, so with
   * 12 DJ spots and 7 songs all of them are playing somewhere, and the next song a box moves on to
   * is the least recently dealt one (never the one it just played).
   */
  private deck: number[] = [];
  private dealSong(avoid: number) {
    if (!this.deck.length) {
      this.deck = this.songs.map((_, i) => i);
      for (let i = this.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
      }
    }
    let k = this.deck.findIndex((x) => x !== avoid);
    if (k < 0) k = 0;
    return this.deck.splice(k, 1)[0];
  }

  /** Advance a DJ box to its next song. */
  nextTrack(ch: DjChannel, initial = false) {
    if (this.songs.length) {
      const i = this.dealSong(ch.song);
      ch.playSong(this.songs[i], i, () => this.nextTrack(ch));
    } else ch.playGenerated(initial ? ch.gen : ch.gen + 1);
    return ch.title;
  }

  // drum-machine voices for the generated tracks
  kick(dest: AudioNode, t: number) {
    this.tone(dest, t, 150, 0.32, 'sine', 0.9, 0.002, 45);
    this.noise(dest, t, 0.02, 'lowpass', 1200, 0.7, 0.25);
  }
  clap(dest: AudioNode, t: number) {
    for (let i = 0; i < 3; i++) this.noise(dest, t + i * 0.011, 0.09, 'bandpass', 1400, 0.9, 0.35);
  }
  hat(dest: AudioNode, t: number, open: boolean) {
    this.noise(dest, t, open ? 0.14 : 0.035, 'highpass', 7500, 0.7, open ? 0.12 : 0.06);
  }
  bass(dest: AudioNode, t: number, f: number, dur: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(900, t);
    fl.frequency.exponentialRampToValueAtTime(180, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl).connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  lead(dest: AudioNode, t: number, f: number, dur: number, kind: 'harmonium' | 'shehnai') {
    const c = this.ctx!;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(kind === 'shehnai' ? 0.09 : 0.07, t + 0.03);
    g.gain.setValueAtTime(kind === 'shehnai' ? 0.09 : 0.07, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.3);
    const fl = c.createBiquadFilter();
    fl.type = kind === 'shehnai' ? 'bandpass' : 'lowpass';
    fl.frequency.value = kind === 'shehnai' ? 1400 : 2400;
    fl.Q.value = kind === 'shehnai' ? 2.5 : 0.8;
    fl.connect(g).connect(dest);
    for (const det of kind === 'shehnai' ? [0] : [-5, 5]) {
      const o = c.createOscillator();
      o.type = kind === 'shehnai' ? 'sawtooth' : 'square';
      o.frequency.value = f;
      o.detune.value = det;
      if (kind === 'shehnai') {
        const v = c.createOscillator();
        v.frequency.value = 5.5;
        const vg = c.createGain();
        vg.gain.value = f * 0.012;
        v.connect(vg).connect(o.frequency);
        v.start(t);
        v.stop(t + dur * 1.4);
      }
      o.connect(fl);
      o.start(t);
      o.stop(t + dur * 1.4);
    }
  }
  /** A short slice of the real dhak recording (chopped like a remix). */
  dhakSlice(dest: AudioNode, t: number, start: number, len: number, vol = 1) {
    const buf = this.buffers.D;
    if (!buf) {
      this.dhakStroke(dest, t, 'D', vol);
      return;
    }
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.9 * vol, t + 0.005);
    g.gain.setValueAtTime(0.9 * vol, t + len * 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    src.connect(g).connect(dest);
    src.start(t, start, len + 0.02);
  }

  setFinale(on: boolean) {
    this.finaleMode = on;
  }

  /** Schedules DJ music and dhak slightly ahead of time; shapes loudness by distance. Call every frame. */
  update(listenerX: number, listenerZ: number) {
    this.lx = listenerX;
    this.lz = listenerZ;
    if (!this.ctx || this.ctx.state !== 'running') return;
    const c = this.ctx;
    this.tickCrowd();
    const ahead = c.currentTime + 0.25;
    // the river: full on the ghat steps, fading out within ~45 m of the water's edge
    if (this.riverSrc) {
      const fromWater = Math.max(0, 112 - this.lz);
      const k = Math.min(1, Math.max(0, (55 - fromWater) / 45));
      this.riverSrc.gain.gain.setTargetAtTime(0.9 * k * k, c.currentTime, 0.4);
    }
    // DJ boxes: only those within earshot play (saves CPU; streamed songs pause when far)
    let nearest = Infinity;
    for (const d of this.djs) {
      const dist = Math.hypot(d.x - this.lx, d.z - this.lz);
      nearest = Math.min(nearest, dist);
      d.setActive(dist < 16); // beyond the fade radius the song is paused: zero music there
      d.setDistance(dist);
      d.schedule(ahead);
    }
    // inside a DJ zone it's only the DJ: dhak, aarti, crowd and river (the ambience bus) duck out
    const presence = Math.min(1, Math.max(0, (16 - nearest) / 4)); // 0 at 16 m → 1 at 12 m
    if (Math.abs(presence - this.djPresence) > 0.01) {
      this.djPresence = presence;
      this.amb.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.ambient * (1 - presence), c.currentTime, 0.25);
    }
    // dhak ensembles at every pandal (only those within earshot are scheduled)
    for (const e of this.ensembles) {
      const d = Math.hypot(e.x - this.lx, e.z - this.lz);
      if (d > 70) {
        e.next = Math.max(e.next, c.currentTime + 0.1);
        // out of earshot: let any playing cut fade quickly and stop scheduling
        for (const p of e.playing) {
          p.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.3);
          p.src.stop(c.currentTime + 1.5);
        }
        e.playing = [];
        e.nextCut = 0;
        continue;
      }
      // the evening and midnight aartis: bells at every pandal only while an aarti is on
      if (e.timed && !this.aartiNow) {
        e.gain.gain.setTargetAtTime(0, c.currentTime, 0.6);
        e.next = Math.max(e.next, c.currentTime + 0.1);
        continue;
      }
      // dhak is full inside a pandal's grounds and fades out within ~30 m of leaving it
      const near = e.kind === 'aarti' ? 10 : 18, far = e.kind === 'aarti' ? 30 : 50;
      const k = Math.min(1, Math.max(0, (far - d) / (far - near)));
      e.gain.gain.setTargetAtTime(k * k, c.currentTime, 0.25);
      if (k <= 0.001) {
        e.next = Math.max(e.next, c.currentTime + 0.1);
        continue;
      }
      if (e.kind === 'dhak' && this.samplesReady && DHAK_CUTS[e.id]) {
        if (e.nextCut < ahead) this.playCut(e, Math.max(c.currentTime + 0.05, e.nextCut));
        continue;
      }
      if (e.kind === 'aarti') {
        while (e.next < ahead) {
          // bursts of ghanta, with a long shankh call every few cycles
          if (e.idx % 24 < 10) this.ghanta(e.gain, e.next, e.vol * (0.6 + Math.random() * 0.4));
          if (e.idx % 96 === 40) this.shankhAt(e.gain, e.next, 0.9 * e.vol);
          e.idx++;
          e.next += 0.16 + Math.random() * 0.03;
        }
        continue;
      }
      const step = this.finaleMode ? e.step * 0.82 : e.step;
      while (e.next < ahead) {
        const bol = BOLS[e.bar % BOLS.length];
        const ch = bol[e.idx % 16];
        const v = e.vol;
        // a slightly loose ensemble: each dhaki is a few ms apart, which makes it sound "live"
        for (let k = 0; k < e.dhakis; k++) {
          const tt = e.next + k * 0.012 + Math.random() * 0.006;
          if (ch === 'D') this.dhakStroke(e.gain, tt, 'D', v * (k ? 0.7 : 1));
          else if (ch === 'k') this.dhakStroke(e.gain, tt, 'k', v * 0.8);
          else if (ch === 'r') for (let q = 0; q < 3; q++) this.dhakStroke(e.gain, tt + q * step / 3, 'k', v * 0.6);
        }
        if (e.idx % 4 === 0) this.kansor(e.gain, e.next, v * (e.idx % 16 === 0 ? 1 : 0.7));
        e.idx++;
        if (e.idx % 16 === 0) e.bar = Math.random() < 0.6 ? e.bar : Math.floor(Math.random() * BOLS.length);
        e.next += step;
      }
    }
  }
}
