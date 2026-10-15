/**
 * Post-processing chain:
 *   scene → (HDR target + depth) → ink outline composite → selective-ish bloom → grade → OutputPass
 * The outline is a screen-space depth-discontinuity pass with noise-jittered sampling so lines
 * look hand-inked rather than mechanically perfect.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

const outlineFrag = /* glsl */ `
#include <packing>
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform vec2 uRes; uniform float uNear; uniform float uFar; uniform float uThick; uniform float uTime;
uniform vec3 uInk; uniform float uEnabled; uniform mat4 uProjInv;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
// reconstruct view-space position from the depth buffer
vec3 vp(vec2 uv){
  float d = texture2D(tDepth, uv).x;
  vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return v.xyz / v.w;
}
vec3 nrm(vec3 a, vec3 b){ return normalize(cross(a, b)); }
void main(){
  vec4 col = texture2D(tColor, vUv);
  if (uEnabled < 0.5) { gl_FragColor = col; return; }
  // hand-drawn wobble: line thickness varies slowly along the stroke and "boils" a few times a second
  float wob = n2(vUv * uRes / 22.0); // static hand-drawn variation (no frame-to-frame boil → smooth motion)
  vec2 o = uThick * (0.6 + 0.8 * wob) / uRes;
  vec3 c = vp(vUv);
  vec3 l = vp(vUv - vec2(o.x, 0.0)), r = vp(vUv + vec2(o.x, 0.0));
  vec3 u = vp(vUv + vec2(0.0, o.y)), d = vp(vUv - vec2(0.0, o.y));
  vec3 ul = vp(vUv + vec2(-o.x, o.y)), ur = vp(vUv + o), dl = vp(vUv - o), dr = vp(vUv + vec2(o.x, -o.y));
  float dc = -c.z;
  // silhouette: depth discontinuity relative to distance
  float lap = abs(-l.z - r.z - u.z - d.z + 4.0 * c.z);
  float sil = smoothstep(0.02 * dc + 0.05, 0.045 * dc + 0.14, lap);
  // creases: normal discontinuity between neighbouring pixels
  vec3 nc = nrm(r - l, u - d);
  float cr = 0.0;
  cr = max(cr, 1.0 - dot(nc, nrm(r - c, ur - dr)));
  cr = max(cr, 1.0 - dot(nc, nrm(c - l, ul - dl)));
  cr = max(cr, 1.0 - dot(nc, nrm(ur - ul, u - c)));
  cr = max(cr, 1.0 - dot(nc, nrm(dr - dl, c - d)));
  float crease = smoothstep(0.12, 0.3, cr) * (1.0 - smoothstep(25.0, 70.0, dc));
  float e = max(sil, crease * 0.85);
  // break strokes up slightly, fade into the distance
  e *= smoothstep(0.1, 0.45, n2(vUv * uRes / 5.0 + 11.0)) * 0.3 + 0.7;
  e *= 1.0 - smoothstep(110.0, 300.0, dc);
  if (texture2D(tDepth, vUv).x > 0.99999) e = 0.0;
  gl_FragColor = vec4(mix(col.rgb, uInk + col.rgb * 0.1, e * 0.9), col.a);
}`;

const quadVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

class SceneOutlinePass extends Pass {
  rt: THREE.WebGLRenderTarget;
  quad: FullScreenQuad;
  mat: THREE.ShaderMaterial;
  constructor(public scene: THREE.Scene, public camera: THREE.PerspectiveCamera) {
    super();
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
    this.rt.depthTexture = new THREE.DepthTexture(1, 1);
    this.rt.depthTexture.type = THREE.UnsignedIntType;
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.rt.texture },
        tDepth: { value: this.rt.depthTexture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uNear: { value: camera.near },
        uFar: { value: camera.far },
        uThick: { value: 1.4 },
        uTime: { value: 0 },
        uInk: { value: new THREE.Color(0x140c1e) },
        uEnabled: { value: 1 },
        uProjInv: { value: new THREE.Matrix4() },
      },
      vertexShader: quadVert,
      fragmentShader: outlineFrag,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.mat);
  }
  setSize(w: number, h: number) {
    this.rt.setSize(w, h);
    this.mat.uniforms.uRes.value.set(w, h);
    this.mat.uniforms.uThick.value = Math.max(1.3, h / 640);
  }
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget) {
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    this.mat.uniforms.uNear.value = this.camera.near;
    this.mat.uniforms.uFar.value = this.camera.far;
    this.mat.uniforms.uProjInv.value.copy(this.camera.projectionMatrixInverse);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.22 },
    uGrain: { value: 0.01 },
    uSat: { value: 1.32 },
    uContrast: { value: 1.0 },
    uLift: { value: 0.0 },
    uShadowTint: { value: new THREE.Color(0.95, 0.92, 1.15) },
    uHighTint: { value: new THREE.Color(1.1, 1.0, 0.88) },
  },
  vertexShader: quadVert,
  fragmentShader: /* glsl */ `
  uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uSat, uContrast, uLift; uniform vec3 uShadowTint, uHighTint;
  varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
  void main(){
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = dot(c, vec3(0.2126,0.7152,0.0722));
    c = mix(vec3(l), c, uSat);
    c = pow(max(c, 0.0) / 0.18, vec3(uContrast)) * 0.18; // contrast about mid-grey (scene-linear)
    c += uLift * (1.0 - smoothstep(0.0, 0.25, l)) * (c + 0.02); // open up the deepest shadows only
    c *= mix(uShadowTint, uHighTint, smoothstep(0.05, 0.8, l));
    vec2 q = vUv - 0.5; c *= 1.0 - uVignette * dot(q, q) * 2.2;
    c += (h(vUv * 913.0 + fract(uTime) * 37.0) - 0.5) * uGrain * (0.3 + l);
    gl_FragColor = vec4(max(c, 0.0), 1.0);
  }`,
};

export interface FXOptions {
  outlines: boolean;
  bloom: boolean;
  aa: boolean;
}

export class PostFX {
  composer: EffectComposer;
  scenePass: SceneOutlinePass;
  bloom: UnrealBloomPass;
  grade: ShaderPass;
  constructor(public renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    // the composer's ping-pong buffers only ever hold full-screen quads: no depth buffers
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.composer = new EffectComposer(renderer, rt);
    this.scenePass = new SceneOutlinePass(scene, camera);
    this.composer.addPass(this.scenePass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.28, 0.95);
    // bloom's mip chain is blur passes only; drop the depth buffers three.js would attach to each
    for (const t of [this.bloom.renderTargetBright, ...this.bloom.renderTargetsHorizontal, ...this.bloom.renderTargetsVertical]) t.depthBuffer = false;
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.smaa = new SMAAPass(1, 1);
    this.composer.addPass(this.smaa);
  }
  smaa: SMAAPass;
  setOptions(o: FXOptions) {
    this.scenePass.mat.uniforms.uEnabled.value = o.outlines ? 1 : 0;
    this.bloom.enabled = o.bloom;
    this.smaa.enabled = o.aa;
  }
  setSize(w: number, h: number, dpr: number) {
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
  }
  render(t: number) {
    this.scenePass.mat.uniforms.uTime.value = t;
    this.grade.uniforms.uTime.value = t;
    this.composer.render();
  }
}
