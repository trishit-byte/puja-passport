/** WebGL renderer setup, quality presets, resize handling and context-loss hooks. */
import * as THREE from 'three';
import { PostFX } from './PostFX';

export type Quality = 'low' | 'medium' | 'high';

export const QUALITY: Record<Quality, { dpr: number; shadow: number; outlines: boolean; bloom: boolean; lights: number; npcs: number }> = {
  low: { dpr: 1, shadow: 0, outlines: true, bloom: false, lights: 3, npcs: 80 },
  medium: { dpr: 1.5, shadow: 1024, outlines: true, bloom: true, lights: 6, npcs: 140 },
  high: { dpr: 2, shadow: 2048, outlines: true, bloom: true, lights: 8, npcs: 320 },
};

/** Render resolution ceiling: 3840 × 2160. */
const MAX_PIXELS = 3840 * 2160;

export class Renderer {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  fx: PostFX;
  quality: Quality = 'high';
  dprScale = 1; // dynamic resolution scale (adaptive)
  onContextLost: (() => void) | null = null;
  onContextRestored: (() => void) | null = null;

  constructor(public canvas: HTMLCanvasElement, public scene: THREE.Scene) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      // every frame reaches the canvas as a full-screen post-processing quad, so the canvas needs no
      // depth or stencil buffer of its own (the scene pass has its own depth texture)
      depth: false,
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.info.autoReset = false; // count all passes of a frame
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1000);
    this.fx = new PostFX(this.renderer, scene, this.camera);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.onContextLost?.();
    });
    canvas.addEventListener('webglcontextrestored', () => this.onContextRestored?.());
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  setQuality(q: Quality) {
    this.quality = q;
    const p = QUALITY[q];
    this.renderer.shadowMap.enabled = p.shadow > 0;
    this.fx.setOptions({ outlines: p.outlines, bloom: p.bloom, aa: true });
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, QUALITY[this.quality].dpr);
    // past 4K (8.3 megapixels) extra pixels are invisible but every full-screen buffer grows with them:
    // a 2560×1440 window at 2× would need 14.7 MP per buffer, so the pixel ratio is capped there
    dpr = Math.min(dpr, Math.max(1, Math.sqrt(MAX_PIXELS / Math.max(1, w * h))));
    dpr *= this.dprScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // portrait screens: widen the vertical field of view so the horizontal view isn't a keyhole
    this.camera.fov = w / h < 1 ? 74 : w / h < 1.4 ? 64 : 58;
    this.camera.updateProjectionMatrix();
    this.fx.setSize(w, h, dpr);
  }

  private frameTimes: number[] = [];
  private adaptT = 0;
  /**
   * Adaptive resolution: keep frame time near 60 fps by nudging the render scale between 0.55 and 1.
   * Changes are small and infrequent so they are not noticeable, and motion stays smooth.
   */
  adapt(dt: number) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 90) this.frameTimes.shift();
    this.adaptT += dt;
    if (this.adaptT < 1.5 || this.frameTimes.length < 60) return;
    this.adaptT = 0;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p80 = sorted[Math.floor(sorted.length * 0.8)];
    let next = this.dprScale;
    // never go below 80% of native: a slightly lower frame rate beats a blurry picture
    if (p80 > 1 / 42) next = Math.max(0.8, this.dprScale - 0.05);
    else if (p80 < 1 / 52 && this.dprScale < 1) next = Math.min(1, this.dprScale + 0.1);
    if (next !== this.dprScale) {
      this.dprScale = next;
      this.resize();
    }
  }

  render(t: number) {
    this.renderer.info.reset();
    this.fx.render(t);
  }
}
