/** Top-level game: owns systems, routes input, runs the frame loop. */
import * as THREE from 'three';
import { releasedGeometry } from '../utils/geometry';
import { Renderer, QUALITY } from '../rendering/Renderer';
import { Sky } from '../rendering/Sky';
import { Lighting } from '../rendering/Lighting';
import { World } from '../world/World';
import { buildPandals } from '../world/pandals';
import type { PandalBuild } from '../world/pandals/common';
import { Player } from '../player/Player';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera';
import { Input, type Action } from './Input';
import { START, FINALE_POINT, PLAZAS, groundHeight } from '../data/layout';
import { PANDALS, PANDAL_BY_ID, PANDAL_IDS, type PandalId } from '../data/pandals';
import { SaveStore, type SaveData } from '../save/SaveStore';
import { Progress } from '../gameplay/Progress';
import { SimClock, formatClock, formatRemaining, stageForHours, crowdForHours, REAL_DURATION } from '../gameplay/SimClock';
import { InteractionSystem } from '../interactions/InteractionSystem';
import { PandalController } from '../gameplay/PandalController';
import { UI } from '../ui/UI';
import { drawMap } from '../ui/mapDraw';
import { AudioEngine } from '../audio/AudioEngine';
import { LivingCity } from '../npc/LivingCity';
import { toPlanet } from '../utils/planet';
import { toon, glow, bend } from '../rendering/materials';
import { Festivities } from '../world/Festivities';
import { DjBoxes } from '../npc/DjBoxes';
import { Minimap } from '../ui/Minimap';
import { TouchControls, isTouchDevice } from '../ui/TouchControls';
import { PlayerActions } from '../player/Actions';
import { addMemory, snapshot, clearMemories } from '../save/memories';
import { wrapAngle } from '../utils/math';

type Phase = 'title' | 'intro' | 'play' | 'finale';

/** Festival time shown during untimed sightseeing (11:00 PM). */
const SIGHTSEE_TIME = 23 * 3600;

export class Game {
  scene = new THREE.Scene();
  renderer: Renderer;
  sky = new Sky();
  lighting: Lighting;
  world: World;
  builds: Map<PandalId, PandalBuild>;
  player: Player;
  cam: ThirdPersonCamera;
  input: Input;
  store: SaveStore;
  data: SaveData;
  progress: Progress;
  interactions = new InteractionSystem();
  pandals: PandalController;
  ui: UI;
  audio = new AudioEngine();
  city: LivingCity;
  fest: Festivities;
  private diya!: THREE.Group;
  private guide!: THREE.Group;
  private guideChevrons: THREE.Group[] = [];
  private gateMark!: THREE.Group;
  djs: DjBoxes;
  minimap!: Minimap;
  touch: TouchControls | null = null;
  actions!: PlayerActions;
  private frustum = new THREE.Frustum();
  clock = new THREE.Clock();
  /** The festival night: 6 PM → 4 AM over 45 minutes of active play. */
  night!: SimClock;
  private lastReal = performance.now();
  time = 0;
  fps = 0;
  phase: Phase = 'title';
  private frames = 0;
  private fpsT = 0;
  private saveT = 0;
  private introT = 0;
  private finaleT = 0;
  private photo = false;
  private contextLost = false;
  stats = { frameMs: [] as number[] };

  constructor(canvas: HTMLCanvasElement, seed: number, onProgress: (p: number, t: string) => void) {
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let kv: Storage | null = null;
    try {
      kv = window.localStorage;
    } catch {
      kv = null;
    }
    this.store = new SaveStore(kv, prefersReduced);
    const loaded = this.store.load();
    this.data = loaded.data;
    if (loaded.fresh && isTouchDevice()) {
      // phones and tablets: start on Medium (smaller shadow map, lower render scale); High is one tap away
      this.data.settings.quality = 'medium';
    }
    this.isTouch = isTouchDevice();
    document.documentElement.classList.toggle('touch', this.isTouch);
    this.progress = new Progress(this.data);
    this.night = new SimClock(this.data.session.elapsed);
    this.night.pause('title');

    this.renderer = new Renderer(canvas, this.scene);
    this.renderer.setQuality(this.data.settings.quality);
    this.renderer.fx.grade.uniforms.uContrast.value = this.isTouch ? 1.08 : 1.03;
    this.renderer.fx.grade.uniforms.uLift.value = this.isTouch ? 0.35 : 0.1;
    this.scene.add(this.sky.mesh);
    this.lighting = new Lighting(this.scene, this.sky, QUALITY[this.data.settings.quality].lights);
    this.lighting.setShadowQuality(QUALITY[this.data.settings.quality].shadow);
    onProgress(0.2, 'Raising the bamboo frames…');

    this.world = new World(seed);
    this.world.build(LivingCity.exclusions());
    onProgress(0.5, 'Painting the pandals…');
    this.builds = buildPandals(this.world.batch, this.world.colliders, this.world.bulbs);
    for (const b of this.builds.values()) {
      this.scene.add(b.dynamic);
      for (const l of b.lights) this.lighting.sources.push(l);
    }
    this.city = new LivingCity(this.world, this.scene, seed, this.builds, this.data.settings.quality);
    this.fest = new Festivities(this.world, seed, this.data.settings.quality);
    this.scene.add(this.fest.root);
    this.djs = new DjBoxes(this.world, seed);
    this.scene.add(this.djs.root);
    this.world.finish();
    this.scene.add(this.world.root);
    for (const p of this.world.lampPositions) this.lighting.sources.push({ pos: p, color: 0xffb35c, intensity: 5, distance: 15 });
    onProgress(0.8, 'Tuning the dhak…');

    this.player = new Player({ ...this.data.outfit }, this.world.colliders);
    this.scene.add(this.player.object);
    const sp = this.data.player ?? START;
    this.player.teleport(sp.x, sp.z, sp.yaw);
    this.player.onStep = () => this.audio.step(this.player.jogging);
    // the clay diya from Nodi'r Alo, carried in the right hand until it is set on the river
    this.diya = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.045, 0.05, 12), toon(0xb5562f, { paint: false }));
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 8), glow(0xffc04a, 4));
    flame.position.y = 0.06;
    this.diya.add(cup, flame);
    this.diya.position.set(0, -0.34, 0.08);
    this.diya.traverse((o) => (o.frustumCulled = false));
    this.diya.visible = false;
    this.player.char.attachToHand(this.diya);
    // wayfinding near a pandal: chevrons on the ground at the player's feet flowing toward the
    // entrance, and a glowing ring on the ground marking the entrance itself
    {
      const chev = new THREE.Shape();
      chev.moveTo(0, 0.45);
      chev.lineTo(0.55, -0.1);
      chev.lineTo(0.55, -0.45);
      chev.lineTo(0, 0.08);
      chev.lineTo(-0.55, -0.45);
      chev.lineTo(-0.55, -0.1);
      chev.closePath();
      const geo = new THREE.ShapeGeometry(chev);
      geo.rotateX(-Math.PI / 2); // flat on the ground, tip toward +z
      geo.rotateY(Math.PI); // tip toward +z, facing up
      const ground = { depthWrite: false, transparent: true, polygonOffset: true, polygonOffsetFactor: -4 };
      this.guide = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        // drawn over the scene like a navigation overlay: a counter, a kerb or the player's own body
        // never hides the little trail at their feet
        const overlay = { ...ground, depthTest: false };
        const ink = new THREE.Mesh(geo, bend(new THREE.MeshBasicMaterial({ color: 0x2a1206, opacity: 0.55, ...overlay })));
        ink.renderOrder = 20;
        ink.scale.setScalar(1.18);
        ink.position.set(0, -0.005, -0.02);
        const fill = new THREE.Mesh(geo, bend(new THREE.MeshBasicMaterial({ color: 0xffc93c, ...overlay })));
        fill.renderOrder = 21;
        const c = new THREE.Group();
        c.add(ink, fill);
        this.guideChevrons.push(c);
        this.guide.add(c);
      }
      this.guide.traverse((o) => (o.frustumCulled = false));
      this.guide.visible = false;
      this.scene.add(this.guide);
      // the entrance marker
      this.gateMark = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.45, 48).rotateX(-Math.PI / 2), bend(new THREE.MeshBasicMaterial({ color: 0xffd36b, ...ground })));
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.15, 48).rotateX(-Math.PI / 2), bend(new THREE.MeshBasicMaterial({ color: 0xffc93c, opacity: 0.18, ...ground })));
      this.gateMark.add(ring, disc);
      this.gateMark.traverse((o) => (o.frustumCulled = false));
      this.gateMark.visible = false;
      this.scene.add(this.gateMark);
    }
    this.cam = new ThirdPersonCamera(this.renderer.camera, this.world.colliders);
    this.cam.snapBehind(this.player.yaw);
    this.input = new Input(canvas);
    if (isTouchDevice()) {
      this.touch = new TouchControls(this.input);
      document.getElementById('ui')!.append(this.touch.el);
      this.touch.show(false);
    }

    this.ui = new UI({
      onStart: (a) => this.start2(a),
      onMenu: () => this.toMenu(),
      onResume: () => {},
      onSettings: (s) => this.applySettings(s),
      onAudio: (a) => {
        Object.assign(this.data.audio, a);
        this.audio.applySettings(this.data.audio);
        this.save();
      },
      onOutfit: (o) => {
        this.data.outfit = o;
        this.player.char.setLook({ ...o });
        this.save();
      },
      onReset: () => this.reset(),
      onPhoto: () => this.snapPhoto(),
      onClick: () => this.audio.click(),
      drawMap: (cv) => drawMap(cv, this.data, { x: this.player.pos.x, z: this.player.pos.z, yaw: this.player.yaw }, this.djs.boxes.map((b) => ({ x: b.x, z: b.z }))),
    });
    this.ui.data = this.data;
    this.ui.setCount(this.data.stamps.length);
    document.documentElement.classList.toggle('reduced-motion', this.data.settings.reducedMotion);

    this.pandals = new PandalController(
      this.builds,
      this.progress,
      this.interactions,
      {
        toast: (m, o) => this.ui.toast(m, o),
        discovered: (id) => {
          this.ui.discovered(id);
          this.save();
        },
        stamped: (id) => this.onStamped(id),
        rhythmCue: (pattern, done, skip, cancel) => {
          this.player.frozen = true;
          this.ui.rhythmCue(
            pattern,
            done,
            (i) => {
              this.audio.dhak(i !== 1);
              this.builds.get('dhaker-taal')?.onActivate('cue');
            },
            skip,
            cancel,
          );
        },
        rhythmListen: (m, skip) => this.ui.rhythmListen(m, skip),
        rhythmEnd: () => {
          this.ui.rhythmEnd();
          this.player.frozen = false;
        },
        pickPostcard: (m, pick) => this.ui.pickPostcard(m, pick),
        info: (t, x) => this.ui.info(t, x),
      },
      this.audio,
    );
    this.actions = new PlayerActions(this.player);
    this.city.registerInteractions(this.interactions, this.ui, this.audio, this.progress, this.player, this.actions);
    this.djs.register(this.audio, this.interactions, this.ui, this.actions);
    this.minimap = new Minimap(this.world.footprints);
    this.city.onSelfie = (place) => this.selfie(place);
    this.fest.onHonk = (p, kind) => this.audio.honk(Math.hypot(p.x - this.player.pos.x, p.z - this.player.pos.z), kind);
    document.getElementById('ui')!.append(this.minimap.el);
    this.minimap.el.classList.add('hidden');
    this.progress.on((e) => {
      if (e.type === 'secret') this.save();
    });

    this.interactions.add({
      id: 'finish-night',
      pos: new THREE.Vector3(FINALE_POINT.x, 0, FINALE_POINT.z),
      radius: 5,
      priority: 1,
      prompt: () => (this.data.session.status === 'success' && !this.data.finaleSeen ? 'Finish the Night — watch the sunrise' : null),
      act: () => this.startFinale(),
    });
    this.lighting.setStageTarget(this.data.finaleSeen ? 3 : stageForHours(this.night.hoursIn), true);
    if (this.data.finaleSeen) this.lighting.finaleSun = 0.85;
    this.renderer.onContextLost = () => {
      this.contextLost = true;
      this.ui.contextLost(true);
      this.save();
    };
    this.renderer.onContextRestored = () => {
      if (releasedGeometry) {
        // static meshes keep their vertex data only on the GPU (to save memory), so a new
        // context can't be refilled from JS: reload and carry straight on from the save
        this.save();
        try {
          sessionStorage.setItem('anandapur.autostart', '1');
        } catch {
          /* ignore */
        }
        location.reload();
        return;
      }
      this.contextLost = false;
      this.ui.contextLost(false);
    };
    window.addEventListener('beforeunload', () => this.save());
    // browsers only allow sound after a user gesture: (re)start audio on the first touch/key
    const unlock = () => {
      if (this.phase !== 'title') this.audio.start(this.city.dhakSpots(), { x: 40, z: 108 }).then(() => this.audio.applySettings(this.data.audio));
    };
    // (iOS counts the end of a tap, not its start, as permission to play sound)
    for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.night.pause('hidden');
        // coming back requires an explicit Resume, so a lock screen or notification never eats time
        if (this.phase === 'play' && this.timed && !this.ui.modals.includes('pause')) this.ui.openPause();
        this.save();
      } else this.night.resume('hidden');
    });
    if (loaded.recovered) setTimeout(() => this.ui.toast('Your saved adventure could not be read, so a fresh one has begun.'), 1500);
    onProgress(1, 'Ready');
  }

  // ------------------------------------------------------------------ lifecycle
  /** Whether the 45-minute challenge clock is running for this session. */
  get timed() {
    const st = this.data.session.status;
    return st === 'active' || st === 'success';
  }

  showTitle() {
    this.phase = 'title';
    this.night.pause('title');
    const st = this.data.session;
    this.ui.showTitle({ status: st.status, stamps: this.data.stamps.length, clock: formatClock(this.night.simSeconds), left: formatRemaining(this.night.remaining) });
  }

  /** Title choices: continue the saved session, start a new timed night, or untimed sightseeing. */
  private start2(action: 'continue' | 'new' | 'sightseeing') {
    const st = this.data.session;
    if (action === 'new' && (st.status !== 'none' || this.data.stamps.length)) {
      // a clean slate: stamps, discoveries and the clock all reset; settings/outfit are kept
      Object.assign(this.data, { stamps: [], discovered: [], secrets: [], finaleSeen: false, player: null, session: { elapsed: 0, status: 'active', completedAt: null } });
      // the clock too, and no more saving: frames keep running until the page unloads, and each
      // one would copy the old 4:00 AM clock back into the fresh save (then the night would
      // end again the moment it restarted)
      this.night = new SimClock(0);
      this.store.save(this.data);
      this.save = () => {};
      try {
        sessionStorage.setItem('anandapur.autostart', '1');
      } catch {
        /* ignore */
      }
      location.reload();
      return;
    }
    if (action === 'new') st.status = 'active';
    if (action === 'sightseeing') st.status = 'sightseeing';
    this.save();
    this.begin();
  }

  private toMenu() {
    this.save();
    location.reload();
  }

  private begin() {
    this.audio.start(this.city.dhakSpots(), { x: 40, z: 108 }).then(() => this.audio.applySettings(this.data.audio));
    this.phase = 'intro';
    this.introT = 0;
    this.cam.snapBehind(this.player.yaw);
  }

  /** Per-frame clock bookkeeping: pause reasons, ticking, HUD, expiry, time-driven atmosphere. */
  private updateNight(realDt: number) {
    const n = this.night;
    const playing = this.phase === 'play' || this.phase === 'finale';
    playing ? n.resume('title') : n.pause('title');
    this.ui.modals.includes('pause') ? n.pause('menu') : n.resume('menu');
    this.timed && this.phase !== 'finale' ? n.resume('ended') : n.pause('ended');
    n.tick(realDt);
    this.data.session.elapsed = n.elapsed;
    const st = this.data.session.status;
    if (st === 'sightseeing') this.ui.setClock(formatClock(SIGHTSEE_TIME), null, false);
    else this.ui.setClock(formatClock(n.simSeconds), st === 'active' ? formatRemaining(n.remaining) : st === 'success' ? 'done' : null, st === 'active' && n.remaining < 300);
    if (!this.data.finaleSeen && this.phase !== 'finale') this.lighting.setStageTarget(st === 'sightseeing' ? 2 : stageForHours(n.hoursIn));
    if (n.expired && this.phase === 'play') {
      if (st === 'active') this.nightOver();
      else if (st === 'success' && !this.data.finaleSeen) {
        this.player.teleport(FINALE_POINT.x, FINALE_POINT.z - 2, 0);
        this.startFinale();
      }
    }
  }

  /** 4:00 AM without every stamp: the challenge ends, honestly. */
  private nightOver() {
    this.data.session.status = 'failed';
    this.save();
    this.phase = 'finale';
    this.player.frozen = true;
    this.ui.prompt(null);
    this.ui.nightOver(
      this.data.stamps.length,
      () => this.start2('new'),
      () => this.toMenu(),
      () => {
        this.data.session.status = 'sightseeing';
        this.save();
        this.phase = 'play';
        this.player.frozen = false;
        this.ui.toast('Sightseeing — untimed. The challenge result stays as it was; wander as long as you like.');
      },
    );
  }

  private afterIntro() {
    this.phase = 'play';
    this.cam.override = null;
    if (!this.data.tutorialDone) {
      const steps = this.touch
        ? [
            { keys: 'Joystick · swipe to look', text: 'Touch the lower-left of the screen to walk (push all the way to jog). Swipe anywhere else to look around; pinch to zoom.' },
            { keys: 'Action button', text: 'Near glowing things, stalls and people, the big round button shows what you can do — tap it.' },
            { keys: 'Passport · map · clock', text: 'Visit all ten pandals and ring each pandal’s bell for its stamp before 4:00 AM. The clock is top-left; the minimap and compass point the way.' },
          ]
        : [
            { keys: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows · <kbd>Shift</kbd> jog', text: 'Wander the lanes of Anandapur. Drag the mouse to look around; scroll to zoom.' },
            { keys: '<kbd>E</kbd> interact', text: 'Walk up to glowing things, stalls and people and press E.' },
            { keys: '<kbd>P</kbd> passport · <kbd>M</kbd> map', text: 'Visit all ten pandals and ring each pandal’s bell for its stamp — in any order, before 4:00 AM. The clock is top-left.' },
          ];
      steps.push({ keys: 'Your first pandal', text: 'The old zamindar mansion just down this lane — the Rajbarir Pujo — is celebrating its 200th Pujo. Follow the gold arrows on the ground!' });
      this.ui.tutorial(steps, () => {
        this.data.tutorialDone = true;
        this.save();
      });
    }
  }

  private onStamped(id: PandalId) {
    this.ui.setCount(this.data.stamps.length);
    const st = this.data.session;
    if (this.progress.allStamps && st.status === 'active') {
      // success is registered the moment the eighth stamp lands — it can't be revoked afterwards
      st.status = 'success';
      st.completedAt = this.night.elapsed;
    }
    this.save();
    this.ui.stampCelebration(id, this.data, () => {
      // only the celebration of the stamp that completed the passport announces it
      if (this.progress.allStamps && !this.data.finaleSeen && this.data.stamps[this.data.stamps.length - 1] === id) {
        if (st.status === 'success') this.ui.toast(`Passport complete at ${formatClock(this.night.simSeconds)} with ${formatRemaining(this.night.remaining)} to spare!`, { duration: 5 });
        this.ui.finaleInvite();
      } else if (!this.progress.allStamps) this.ui.toast(st.status === 'active' ? `${8 - this.data.stamps.length} more pandals to find — ${formatRemaining(this.night.remaining)} left before 4 AM.` : `${8 - this.data.stamps.length} more pandals to find.`);
    });
  }

  applySettings(s: Partial<SaveData['settings']>) {
    Object.assign(this.data.settings, s);
    if (s.quality) {
      this.renderer.setQuality(s.quality);
      this.lighting.setShadowQuality(QUALITY[s.quality].shadow);
      this.lighting.pool.forEach((l, i) => (l.visible = i < QUALITY[s.quality!].lights));
    }
    document.documentElement.classList.toggle('reduced-motion', this.data.settings.reducedMotion);
    this.ui.refreshMap();
    this.save();
  }

  save() {
    this.data.player = { x: this.player.pos.x, z: this.player.pos.z, yaw: this.player.yaw };
    this.store.save(this.data);
  }

  reset() {
    this.store.reset();
    clearMemories();
    window.removeEventListener('beforeunload', () => this.save());
    this.save = () => {};
    location.reload();
  }

  // ------------------------------------------------------------------ photo
  /** Selfie: swing the camera round to face the player, keep a snapshot as a passport memory. */
  private selfie(place: string) {
    const c = this.cam;
    const prev = { yaw: c.yaw, pitch: c.pitch, dist: c.targetDistance };
    c.yaw = this.player.yaw;
    c.pitch = 0.08;
    c.targetDistance = 2.6;
    setTimeout(() => {
      const gv = this.guide.visible, mv = this.gateMark.visible;
      this.guide.visible = this.gateMark.visible = false;
      this.renderer.render(this.time);
      this.guide.visible = gv;
      this.gateMark.visible = mv;
      addMemory({ img: snapshot(this.renderer.renderer.domElement), at: formatClock(this.night.simSeconds), place });
      setTimeout(() => {
        c.yaw = prev.yaw;
        c.pitch = prev.pitch;
        c.targetDistance = prev.dist;
      }, 900);
    }, 1400);
  }

  private snapPhoto() {
    this.renderer.render(this.time);
    const url = this.renderer.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `anandapur-${Date.now()}.png`;
    a.click();
    this.audio.click();
  }

  // ------------------------------------------------------------------ frame
  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      if (!this.contextLost) this.frame();
    };
    loop();
  }

  private isTouch = false;
  frame() {
    const t0 = performance.now();
    const dt = Math.min(0.05, this.clock.getDelta());
    const nowReal = performance.now();
    const realDt = (nowReal - this.lastReal) / 1000;
    this.lastReal = nowReal;
    this.time += dt;
    this.frames++;
    this.fpsT += dt;
    if (this.fpsT > 0.5) {
      this.fps = this.frames / this.fpsT;
      this.frames = 0;
      this.fpsT = 0;
    }
    this.input.pollGamepad();
    const actions = this.input.consume();
    const keys = this.input.consumeKeys();
    for (const a of actions) this.route(a, keys);
    if (!actions.length && keys.length) this.ui.handle('noop' as Action, keys);

    const reduced = this.data.settings.reducedMotion;
    const o = this.input.consumeOrbit();
    const blocked = this.ui.blocking && !this.photo;

    if (this.phase === 'title') {
      // slow orbit high above the little planet
      const a = this.time * (reduced ? 0.02 : 0.06);
      this.cam.override = {
        pos: new THREE.Vector3(Math.cos(a) * 60, 260, Math.sin(a) * 60 + 20),
        look: new THREE.Vector3(Math.cos(a + 1) * 20, 0, Math.sin(a + 1) * 20),
      };
      this.lighting.fogScale = 0.08;
    } else if (this.phase === 'intro') {
      this.introT += dt / (reduced ? 0.6 : 3.2);
      const k = Math.min(1, this.introT);
      const e = k * k * (3 - 2 * k);
      const p = this.player.pos;
      const behind = new THREE.Vector3(p.x - Math.sin(this.player.yaw) * 5.5, p.y + 3, p.z - Math.cos(this.player.yaw) * 5.5);
      const high = new THREE.Vector3(p.x, 120, p.z + 30);
      this.cam.override = { pos: high.lerp(behind, e), look: new THREE.Vector3(p.x, p.y + 1.6, p.z) };
      this.lighting.fogScale = 0.08 + 0.92 * e;
      if (k >= 1) {
        this.cam.snapTo(this.player.pos);
        this.afterIntro();
      }
    } else {
      this.lighting.fogScale = 1;
      this.cam.orbit(blocked ? 0 : o.dx, blocked ? 0 : o.dy, blocked ? 0 : o.wheel);
    }

    const mv = this.phase === 'play' && !blocked && !this.photo ? this.input.move() : { x: 0, y: 0, jog: false };
    this.actions.update(dt, Math.hypot(mv.x, mv.y) > 0.15);
    this.player.update(dt, this.actions.busy && this.actions.current?.pose === 'sit' ? { x: 0, y: 0, jog: false } : mv, this.cam.forward());
    this.cam.autoFollow = !this.photo;
    this.cam.update(dt, this.player.pos, this.player.yaw, this.player.speed > 0.5, reduced);

    if (this.phase === 'play') {
      this.pandals.update(dt, this.player.pos);
      const nodi = this.pandals.machines.get('nodir-alo')!;
      this.diya.visible = nodi.doneTargets().includes('lamp-take') && !this.pandals.isComplete('nodir-alo');
      const cur = this.interactions.update(this.player.pos, this.player.yaw);
      const label = this.ui.rhythmActive ? 'Tap!' : cur?.prompt() ?? null;
      this.ui.prompt(label);
      this.touch?.setAction(label);
    }
    this.touch?.show((this.phase === 'play' && (!this.ui.blocking || this.ui.rhythmActive)) && !this.photo);
    this.updateNight(realDt);
    if (this.phase === 'finale') this.updateFinale(dt);

    const cam3 = this.renderer.camera;
    cam3.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam3.projectionMatrix, cam3.matrixWorldInverse));
    this.city.update(dt, this.time, this.player.pos, this.cam.flatPos, this.frustum);
    this.city.density = crowdForHours(this.night.hoursIn);
    // the evening (sandhya) aarti ~7:30–8:15 PM and the midnight aarti ~11:45 PM–12:30 AM
    const hh = this.night.hoursIn, timed = this.data.session.status === 'active' || this.data.session.status === 'success';
    const aarti = timed && ((hh >= 1.5 && hh < 2.25) || (hh >= 5.75 && hh < 6.5));
    if (aarti && !this.city.aartiNow && this.phase === 'play')
      this.ui.toast(hh < 4 ? 'Sandhya aarti has begun at every pandal: bells, conch and dhak. Find a purohit and join in!' : 'The midnight aarti is on at every pandal. Lamps circle, the dhak swells.', { bn: 'আরতি · आरती', duration: 6 });
    this.city.aartiNow = aarti;
    this.audio.aartiNow = aarti;
    this.fest.update(dt, this.time, this.player.pos, this.lighting.mood.bulbIntensity, this.city.roadPeds);
    this.djs.update(dt, this.time, this.player.pos, this.audio, this.ui, this.frustum);
    if (this.phase === 'play') this.updateCompass();
    this.updateGuide();
    this.sky.follow(this.renderer.camera, this.cam.flatPos.x, this.cam.flatPos.z);
    this.lighting.update(dt, this.player.pos, this.time);
    // phone screens run dimmer (auto-brightness, outdoors): lift their exposure a little more
    this.renderer.renderer.toneMappingExposure = this.lighting.mood.exposure * (this.isTouch ? 1.3 : 1.06);
    // the sea mirrors the sky: indigo at night, peach and gold at sunrise
    this.world.waterUniforms.uSky.value.setHex(this.lighting.mood.fog).multiplyScalar(0.55);
    this.world.waterUniforms.uGlow.value.setHex(this.lighting.finaleSun > 0.3 ? this.lighting.mood.sunColor : 0xffb36b);
    this.world.update(this.time);
    this.world.shadowReach = this.data.settings.quality === 'high' ? 1e9 : 30;
    // phone screens: a 30 cm part is ~2 px at 50 m; desktop screens keep them much further
    this.world.fineReach = this.isTouch ? 50 : 140;
    this.world.cullHorizon(this.cam.flatPos.x, this.cam.flatPos.z, this.cam.flatPos.y);
    this.audio.setListener(this.player.pos.x, this.player.pos.z, this.cam.yaw + Math.PI);
    // the crowd sound follows how many people are around you (their numbers follow the hour)
    const px = this.player.pos.x, pz = this.player.pos.z;
    this.audio.setCrowd(this.city.peopleNear(px, pz, 16) / 22);
    this.audio.update(px, pz);
    this.saveT += dt;
    if (this.saveT > 5 && this.phase === 'play') {
      this.saveT = 0;
      this.save();
    }
    this.renderer.adapt(dt);
    this.renderer.render(this.time);
    const ms = performance.now() - t0;
    this.stats.frameMs.push(ms);
    if (this.stats.frameMs.length > 600) this.stats.frameMs.shift();
  }

  private route(a: Action, keys: string[]) {
    if (this.phase !== 'play') {
      this.ui.handle(a, keys);
      return;
    }
    if (a === 'photo') {
      if (!this.ui.blocking || this.photo) {
        this.photo = !this.photo;
        this.ui.photoMode(this.photo);
      }
      return;
    }
    if (this.photo && a === 'pause') {
      this.photo = false;
      this.ui.photoMode(false);
      return;
    }
    // Dhaker Taal: E taps go straight to the rhythm machine while it's your turn
    if (a === 'interact' && this.ui.rhythmActive) {
      const m = this.pandals.machines.get('dhaker-taal') as { tapCount?: number };
      const before = m.tapCount ?? 0;
      this.ui.rhythmTap(before + 1);
      this.pandals.act('dhaker-taal', 'dhak');
      return;
    }
    if (this.ui.handle(a, keys)) return;
    if (a === 'interact') this.interactions.trigger();
  }

  /**
   * Wayfinding: within 30 m of a pandal not yet visited (and outside its grounds), three small
   * chevrons on the ground at the player's feet flow toward its entrance, and a ring on the ground
   * marks the entrance. Both disappear on arrival at the gate and once the pandal is visited.
   */
  private updateGuide() {
    const p = this.player.pos;
    let best: (typeof PANDALS)[number] | null = null;
    let bestD = Infinity;
    for (const d of PANDALS) {
      // once a pandal has been visited (entered or stamped) it no longer needs guiding to
      if (this.data.discovered.includes(d.id) || this.data.stamps.includes(d.id)) continue;
      const edge = Math.hypot(d.x - p.x, d.z - p.z) - d.radius;
      if (edge < bestD) {
        bestD = edge;
        best = d;
      }
    }
    const show = this.phase === 'play' && !this.ui.blocking && !this.photo && !!best && bestD <= 30 && bestD > 0.5;
    this.guide.visible = this.gateMark.visible = show;
    if (!show || !best) return;
    // the entrance: just outside the gate, along the pandal's facing direction
    const gx = best.x + Math.sin(best.facing) * (best.radius + 1.5), gz = best.z + Math.cos(best.facing) * (best.radius + 1.5);
    const dist = Math.hypot(gx - p.x, gz - p.z);
    this.gateMark.position.set(gx, groundHeight(gx, gz) + 0.04, gz);
    const pulse = 1 + Math.sin(this.time * 3) * 0.06;
    this.gateMark.scale.set(pulse, 1, pulse);
    if (dist < 3) {
      // standing at the gate: the arrows' job is done
      this.guide.visible = false;
      return;
    }
    const yaw = Math.atan2(gx - p.x, gz - p.z);
    this.guide.position.set(p.x, 0, p.z);
    this.guide.rotation.set(0, yaw, 0);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    // which side of the player the trail runs on: the more open one, toward the roadway and away
    // from shopfronts and stalls (road clearance is negative on the road), the right if level
    const open = (sd: number) => this.world.field.clearance(p.x + fx * 1.8 + fz * sd, p.z + fz * 1.8 - fx * sd) + (this.world.isClear(p.x + fx * 1.8 + fz * sd, p.z + fz * 1.8 - fx * sd, 0.3) ? 0 : 50);
    const side = open(0.9) < open(-0.9) - 0.3 ? 0.9 : -0.9;
    // chevrons step out from the feet toward the entrance, brightening in turn
    const span = Math.min(3.0, dist - 1.5);
    this.guideChevrons.forEach((c, k) => {
      const u = (this.time * 0.9 + k / 3) % 1;
      const along = 0.4 + u * span;
      // the trail runs just beside the player (to their right), so their own body never hides it
      // from the camera behind them; each chevron sits on the ground beneath it (steps, kerbs)
      c.position.set(side, groundHeight(p.x + fx * along + fz * side, p.z + fz * along - fx * side) + 0.14, along); // above asphalt (5 cm) and kerbs (12 cm)
      const fade = Math.sin(u * Math.PI);
      c.scale.setScalar(0.5 + 0.12 * fade);
      for (const m of c.children) {
        const mat = (m as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = (m === c.children[0] ? 0.7 : 1) * Math.min(1, fade * 1.6);
      }
    });
  }

  /** Compass ribbon: direction to each pandal's lit tower, relative to where the camera looks. */
  private updateCompass() {
    const f = this.cam.forward();
    const heading = Math.atan2(f.x, f.z);
    const p = this.player.pos;
    this.ui.compass([
      ...PANDALS.map((d, i) => {
        const rel = wrapAngle(Math.atan2(d.x - p.x, d.z - p.z) - heading);
        return { n: i + 1, rel, dist: Math.hypot(d.x - p.x, d.z - p.z), color: '#' + d.palette.accent.toString(16).padStart(6, '0'), done: this.data.stamps.includes(d.id), name: this.data.discovered.includes(d.id) ? d.name : '' };
      }),
      // DJ dance areas: a music note, no number, only when within a couple of streets
      ...this.djs.boxes
        .filter((b) => Math.hypot(b.x - p.x, b.z - p.z) < 90)
        .map((b) => ({ n: 0, rel: wrapAngle(Math.atan2(b.x - p.x, b.z - p.z) - heading), dist: Math.hypot(b.x - p.x, b.z - p.z), color: '#ff7ad9', done: false, name: '', dj: true })),
    ]);
    this.minimap.el.classList.toggle('hidden', this.phase !== 'play');
    this.minimap.update(p.x, p.z, heading, this.player.yaw, [
      ...this.djs.boxes.map((b) => ({ x: b.x, z: b.z, kind: 'dj' as const })),
      ...PANDALS.map((d) => ({ x: d.x, z: d.z, kind: 'pandal' as const, color: '#' + d.palette.accent.toString(16).padStart(6, '0'), done: this.data.stamps.includes(d.id) })),
      ...(this.data.session.status === 'success' && !this.data.finaleSeen ? [{ x: FINALE_POINT.x, z: FINALE_POINT.z, kind: 'finale' as const }] : []),
    ], this.time);
  }

  // ------------------------------------------------------------------ finale
  startFinale() {
    this.phase = 'finale';
    this.finaleT = 0;
    this.player.frozen = true;
    this.audio.setFinale(true);
    this.audio.shankh();
    this.city.celebrate(true);
    this.ui.prompt(null);
    this.ui.cinematic(true);
  }

  private updateFinale(dt: number) {
    const reduced = this.data.settings.reducedMotion;
    this.finaleT += dt;
    const t = this.finaleT;
    const p = new THREE.Vector3(FINALE_POINT.x, 0, FINALE_POINT.z);
    // gentle crane: from behind the player, rising and turning toward the sunrise over the water
    const k = Math.min(1, t / (reduced ? 1 : 9));
    const e = k * k * (3 - 2 * k);
    this.cam.override = {
      pos: new THREE.Vector3(p.x - 10 + e * 4, 2 + e * 5, p.z - 12 + e * 2),
      look: new THREE.Vector3(p.x + 12, 2 + e * 4, p.z + 40),
    };
    this.lighting.finaleSun = Math.min(1, t / (reduced ? 2 : 14));
    this.lighting.setStageTarget(3);
    if (t > (reduced ? 1.5 : 7) && !this.ui.modals.includes('finale') && !this.data.finaleSeen) {
      this.progress.completeFinale();
      this.save();
      this.ui.finale(this.data, () => {
        this.phase = 'play';
        this.player.frozen = false;
        this.cam.override = null;
        this.cam.snapBehind(this.player.yaw);
        this.cam.snapTo(this.player.pos);
        this.audio.setFinale(false);
        this.city.celebrate(false);
        this.ui.toast('Morning has come to Anandapur. The pandals glow on — explore as long as you like.');
      });
    }
  }

  // ------------------------------------------------------------------ debug / test hook (?debug=1)
  debugApi() {
    let loseExt: WEBGL_lose_context | null = null;
    return {
      teleport: (x: number, z: number, yaw = this.player.yaw) => {
        this.player.teleport(x, z, yaw);
        this.cam.snapBehind(yaw);
        this.cam.snapTo(this.player.pos);
      },
      teleportTo: (id: PandalId, inside = true) => {
        const def = PANDAL_BY_ID[id];
        const b = this.builds.get(id)!;
        const p = inside ? b.targets[0].pos : b.gate;
        const yaw = Math.atan2(def.x - p.x, def.z - p.z);
        this.player.teleport(p.x, p.z, yaw);
        this.cam.snapBehind(yaw);
        this.cam.snapTo(this.player.pos);
      },
      completePandal: (id: PandalId) => this.pandals.debugComplete(id),
      act: (id: PandalId, target: string) => this.pandals.act(id, target),
      press: (a: Action) => this.input.push(a),
      getState: () => ({
        stamps: [...this.data.stamps],
        discovered: [...this.data.discovered],
        secrets: [...this.data.secrets],
        finaleSeen: this.data.finaleSeen,
        phase: this.phase,
        modals: [...this.ui.modals],
        player: { x: this.player.pos.x, z: this.player.pos.z, yaw: this.player.yaw },
        prompt: this.interactions.current?.prompt() ?? null,
        fps: this.fps,
        audio: this.audio.ctx?.state ?? 'none',
        stage: this.lighting.stage,
      }),
      targets: () => [...this.builds.entries()].map(([id, b]) => ({ id, targets: b.targets.map((t) => ({ id: t.id, x: t.pos.x, z: t.pos.z })) })),
      setStage: (s: number) => this.lighting.setStageTarget(s, true),
      /** Test hook: jump the festival clock (active real seconds elapsed, 0…2700). */
      setElapsed: (sec: number) => {
        this.night.elapsed = Math.min(REAL_DURATION, Math.max(0, sec));
        this.data.session.elapsed = this.night.elapsed;
      },
      night: () => ({ elapsed: this.night.elapsed, clock: formatClock(this.night.simSeconds), left: formatRemaining(this.night.remaining), paused: this.night.paused, status: this.data.session.status }),
      startFinale: () => this.startFinale(),
      ids: PANDAL_IDS,
      plazas: PLAZAS,
      pandals: PANDALS.map((p) => ({ id: p.id, x: p.x, z: p.z, facing: p.facing, radius: p.radius })),
      renderInfo: () => {
        const i = this.renderer.renderer.info;
        return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, culling: this.world.culling };
      },
      frameStats: () => {
        const a = [...this.stats.frameMs].sort((x, y) => x - y);
        return { n: a.length, p50: a[Math.floor(a.length * 0.5)], p95: a[Math.floor(a.length * 0.95)], max: a[a.length - 1], fps: this.fps, dprScale: this.renderer.dprScale };
      },
      toPlanet,
      audioLevel: () => this.audio.level(),
      djBoxes: () => this.djs.boxes.map((b, i) => ({ x: b.x, z: b.z, pandal: b.pandal, dancers: b.dancers.length, playing: this.audio.djs[i]?.title ?? null, active: this.audio.djs[i]?.active ?? false })),
      recordAudio: async (ms: number) => {
        const blob = await this.audio.record(ms);
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        return { type: blob.type, b64: btoa(bin) };
      },
      loseContext: () => {
        // keep the extension object: it can't be fetched again while the context is lost
        loseExt = this.renderer.renderer.getContext().getExtension('WEBGL_lose_context');
        loseExt?.loseContext();
      },
      restoreContext: () => loseExt?.restoreContext(),
    };
  }
}
