/**
 * DJ boxes: spatial music sources in the open plazas.
 *
 * Playlist: public/assets/audio/songs/songs.json lists songs by file name. Files the player has
 * added themselves are streamed through an <audio> element into the box's panner. No song files
 * ship with the game. When none are present, each box plays one of three ORIGINAL generated
 * "Pujo dance" tracks: a four-on-the-floor festival groove layered with chopped CC dhak
 * recordings, a bass line and a harmonium/shehnai-style lead in Bengali-flavoured scales.
 *
 * Every box has an AnalyserNode so the LEDs and dancers pulse with whatever is actually playing.
 */
import type { AudioEngine } from './AudioEngine';

export interface SongEntry {
  file: string;
  title: string;
  artist: string;
}

interface GenTrack {
  title: string;
  bpm: number;
  scale: number[]; // semitones from root
  root: number; // Hz
  lead: 'harmonium' | 'shehnai';
  dhakSlices: [number, number][]; // [start, length] seconds in the dhak recording 'D'
}

export const GENERATED: GenTrack[] = [
  { title: 'Dhaker Dhamaka (Anandapur Remix)', bpm: 124, scale: [0, 2, 4, 7, 9], root: 110, lead: 'harmonium', dhakSlices: [[44.0, 0.48], [47.9, 0.48], [58.3, 0.48]] },
  { title: 'Ashtami Raat', bpm: 108, scale: [0, 1, 4, 5, 7, 8, 11], root: 98, lead: 'shehnai', dhakSlices: [[72.2, 0.55], [30.4, 0.55]] },
  { title: 'Sharod Utsav', bpm: 132, scale: [0, 2, 4, 5, 7, 9, 11], root: 123.5, lead: 'harmonium', dhakSlices: [[16.1, 0.45], [3.3, 0.45], [85.6, 0.45]] },
];

export class DjChannel {
  panner: PannerNode;
  out: GainNode;
  analyser: AnalyserNode;
  el: HTMLAudioElement | null = null;
  private media: MediaElementAudioSourceNode | null = null;
  gen = 0;
  song = -1;
  next = 0;
  step = 0;
  bar = 0;
  noteIdx = 2;
  active = false;
  title = '';
  private data = new Float32Array(512);

  constructor(private eng: AudioEngine, private ctx: AudioContext, dest: AudioNode, public x: number, public z: number, seed: number) {
    this.panner = ctx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = 1;
    this.panner.rolloffFactor = 0; // distance loudness handled in setDistance()
    this.panner.maxDistance = 10000;
    this.panner.positionX.value = x;
    this.panner.positionY.value = 1.5;
    this.panner.positionZ.value = z;
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.out.connect(this.analyser);
    this.out.connect(this.panner).connect(dest);
    this.gen = seed % GENERATED.length;
  }

  /** Full on the dance floor (≤4 m), fading quickly, and completely silent beyond 15 m. */
  setDistance(d: number) {
    const near = 4, far = 15;
    const k = Math.min(1, Math.max(0, (far - d) / (far - near)));
    this.out.gain.setTargetAtTime(1.5 * k * k, this.ctx.currentTime, 0.15);
  }

  /** Loudness 0..1 of what this box is playing right now (drives LEDs and dancers). */
  level(): number {
    this.analyser.getFloatTimeDomainData(this.data);
    let s = 0;
    for (const v of this.data) s += v * v;
    return Math.min(1, Math.sqrt(s / this.data.length) * 4);
  }

  /**
   * The song this box is on. Its <audio> element exists only while the box is audible (the player
   * within 16 m): a far box keeps just its place in the song, so a dozen boxes never buffer a
   * dozen MP3 streams at once.
   */
  private track: { entry: SongEntry; onEnded: () => void; at: number } | null = null;

  playSong(entry: SongEntry, index: number, onEnded: () => void) {
    this.stopSong();
    this.song = index;
    this.title = `${entry.title} — ${entry.artist}`;
    this.track = { entry, onEnded, at: 0 };
    if (this.active) this.openTrack();
  }

  private openTrack() {
    const tr = this.track;
    if (!tr || this.el) return;
    const el = new Audio(`assets/audio/songs/${tr.entry.file}`);
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.addEventListener('ended', tr.onEnded);
    if (tr.at > 0) el.addEventListener('loadedmetadata', () => (el.currentTime = Math.min(tr.at, Math.max(0, el.duration - 1))), { once: true });
    this.el = el;
    this.media = this.ctx.createMediaElementSource(el);
    this.media.connect(this.out);
    el.play().catch(() => {});
  }

  /** Release the element and its decoded buffers, remembering where the song was. */
  private closeTrack() {
    if (!this.el) return;
    if (this.track) this.track.at = this.el.currentTime;
    this.el.pause();
    this.el.removeAttribute('src');
    this.el.load();
    this.media?.disconnect();
    this.el = null;
    this.media = null;
  }

  playGenerated(i: number) {
    this.stopSong();
    this.song = -1;
    this.gen = i % GENERATED.length;
    this.title = `${GENERATED[this.gen].title} — Anandapur original`;
    this.next = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.bar = 0;
  }

  stopSong() {
    this.closeTrack();
    this.track = null;
  }

  setActive(on: boolean) {
    if (on === this.active) return;
    this.active = on;
    if (on) this.openTrack();
    else this.closeTrack();
    if (on) this.next = Math.max(this.next, this.ctx.currentTime + 0.05);
  }

  /** Schedule generated music up to `ahead` seconds. */
  schedule(ahead: number) {
    if (!this.active || this.track) return;
    const tr = GENERATED[this.gen];
    const s16 = 60 / tr.bpm / 4;
    const e = this.eng;
    const o = this.out;
    while (this.next < ahead) {
      const t = this.next;
      const st = this.step % 16;
      const section = Math.floor(this.bar / 8) % 2; // 8-bar breakdown / 8-bar main
      const main = section === 1 || this.bar < 2 ? true : this.bar % 8 > 1;
      // kick
      if (main && st % 4 === 0) e.kick(o, t);
      // clap on 2 and 4
      if (main && (st === 4 || st === 12)) e.clap(o, t);
      // hats: offbeat opens + 16th ticks
      if (st % 4 === 2) e.hat(o, t, true);
      else if (main) e.hat(o, t, false);
      // chopped dhak on the "dhyang" positions + rolls before bar end
      if (st === 0 || st === 6 || st === 10 || (st >= 13 && this.bar % 2)) {
        const [a, len] = tr.dhakSlices[(this.bar + st) % tr.dhakSlices.length];
        e.dhakSlice(o, t, a, Math.min(len, s16 * (st >= 13 ? 1 : 3)), st === 0 ? 1 : 0.7);
      }
      // kansor on every beat in the main section
      if (main && st % 4 === 0) e.kansor(o, t, 0.35);
      // bass: root / fifth syncopation
      if ([0, 3, 6, 8, 11, 14].includes(st)) {
        const deg = st === 8 ? tr.scale[Math.min(3, tr.scale.length - 1)] : st === 14 ? tr.scale[1] : 0;
        e.bass(o, t, tr.root * Math.pow(2, deg / 12), s16 * 2.2);
      }
      // lead phrases: random walk in the scale, rests between phrases
      if (st % 2 === 0 && (this.bar % 4 < 3 || st < 8) && Math.random() < 0.7) {
        this.noteIdx = Math.max(0, Math.min(tr.scale.length * 2 - 1, this.noteIdx + (Math.random() < 0.5 ? -1 : 1)));
        const oct = Math.floor(this.noteIdx / tr.scale.length);
        const f = tr.root * 4 * Math.pow(2, (tr.scale[this.noteIdx % tr.scale.length] + 12 * oct) / 12);
        e.lead(o, t, f, s16 * 2, tr.lead);
      }
      this.step++;
      if (this.step % 16 === 0) this.bar++;
      this.next += s16;
    }
  }
}
