/**
 * Lighting rig: hemisphere fill, one shadow-casting "moon" directional light that follows the
 * player, and a small pool of point lights reassigned each frame to the nearest festival light
 * sources (so only ~8 dynamic lights ever exist regardless of how many lamps the city has).
 */
import * as THREE from 'three';
import { moodAt, type Mood } from '../gameplay/atmosphere';
import type { Sky } from './Sky';
import { toPlanet } from '../utils/planet';
import { lerpColor } from '../gameplay/atmosphere';

export interface LightSource {
  pos: THREE.Vector3;
  color: number;
  intensity: number;
  distance: number;
}

export class Lighting {
  hemi = new THREE.HemisphereLight(0x6466b0, 0x4a3530, 1.2);
  moon = new THREE.DirectionalLight(0xaab8ff, 0.8);
  pool: THREE.PointLight[] = [];
  sources: LightSource[] = [];
  stage = 0;
  private stageTarget = 0;
  finaleSun = 0; // 0..1 sunrise blend driven by finale
  fogScale = 1; // title flyover thins the fog so the whole planet is visible
  mood: Mood = moodAt(0);
  private tmp = new THREE.Vector3();
  private moonDir = new THREE.Vector3(-0.45, 0.75, -0.5).normalize();

  constructor(private scene: THREE.Scene, private sky: Sky, poolSize = 8) {
    scene.add(this.hemi);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(2048, 2048);
    const c = this.moon.shadow.camera;
    c.left = c.bottom = -40;
    c.right = c.top = 40;
    c.near = 1;
    c.far = 160;
    this.moon.shadow.bias = -0.0006;
    this.moon.shadow.normalBias = 0.04;
    scene.add(this.moon, this.moon.target);
    for (let i = 0; i < poolSize; i++) {
      const l = new THREE.PointLight(0xffb36b, 0, 18, 1.6);
      scene.add(l);
      this.pool.push(l);
    }
    scene.fog = new THREE.FogExp2(0x2c2446, 0.005);
  }

  setShadowQuality(size: number) {
    this.moon.castShadow = size > 0;
    if (size > 0) {
      this.moon.shadow.mapSize.set(size, size);
      this.moon.shadow.map?.dispose();
      this.moon.shadow.map = null as any;
    }
  }

  setStageTarget(s: number, instant = false) {
    this.stageTarget = s;
    if (instant) this.stage = s;
  }

  update(dt: number, focus: THREE.Vector3, t: number) {
    this.stage += (this.stageTarget - this.stage) * (1 - Math.exp(-0.6 * dt));
    const base = moodAt(this.stage);
    const m = this.finaleSun > 0 ? blend(base, moodAt(4), this.finaleSun) : base;
    this.mood = m;
    const u = this.sky.uniforms;
    u.uTop.value.setHex(m.skyTop);
    u.uHorizon.value.setHex(m.skyHorizon);
    u.uBottom.value.setHex(m.skyBottom);
    u.uCloud.value.setHex(m.cloud);
    u.uStars.value = m.stars;
    u.uSun.value = m.sun;
    u.uSunColor.value.setHex(m.sunColor);
    u.uTime.value = t;
    // sunrise rises in the south-east over the river
    u.uSunDir.value.set(0.55, -0.12 + this.finaleSun * 0.3, 1).normalize();
    (this.scene.fog as THREE.FogExp2).color.setHex(m.fog);
    (this.scene.fog as THREE.FogExp2).density = m.fogDensity * this.fogScale;
    this.hemi.color.setHex(m.hemiSky);
    this.hemi.groundColor.setHex(m.hemiGround);
    this.hemi.intensity = m.hemiIntensity;
    this.moon.color.setHex(m.moon);
    this.moon.intensity = m.moonIntensity;
    const dir = this.finaleSun > 0 ? this.tmp.set(0.55, 0.3 + this.finaleSun * 0.25, 1).normalize() : this.moonDir;
    this.moon.position.copy(focus).addScaledVector(dir, 80);
    this.moon.target.position.copy(focus);
    // stable shadow texel snapping avoids shimmering while walking
    this.moon.target.position.x = Math.round(focus.x);
    this.moon.target.position.z = Math.round(focus.z);
    // assign point lights to nearest sources
    const sorted = this.sources
      .map((s) => ({ s, d: s.pos.distanceToSquared(focus) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.pool.length);
    this.pool.forEach((l, i) => {
      const e = sorted[i];
      if (!e) {
        l.intensity = 0;
        return;
      }
      toPlanet(e.s.pos.x, e.s.pos.y, e.s.pos.z, l.position);
      l.color.setHex(e.s.color);
      l.distance = e.s.distance;
      const fade = 1 - Math.min(1, Math.max(0, (Math.sqrt(e.d) - 45) / 25));
      l.intensity = e.s.intensity * fade * (0.92 + 0.08 * Math.sin(t * 3 + i));
    });
  }
}

function blend(a: ReturnType<typeof moodAt>, b: ReturnType<typeof moodAt>, t: number) {
  const out = moodAt(0);
  for (const k of Object.keys(a) as (keyof typeof a)[]) {
    const isNum = ['fogDensity', 'hemiIntensity', 'moonIntensity', 'stars', 'sun', 'exposure', 'windowGlow', 'bulbIntensity'].includes(k);
    (out as any)[k] = isNum ? a[k] + (b[k] - a[k]) * t : lerpColor(a[k], b[k], t);
  }
  return out;
}
