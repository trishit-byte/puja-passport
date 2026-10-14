/**
 * Toon material factory. Every world material shares a 3-step gradient ramp (cel look) and an
 * injected tiny-planet vertex mapping (see utils/planet.ts): gameplay stays on a flat plane while
 * everything renders wrapped onto a small sphere with a near, curved horizon.
 */
import * as THREE from 'three';
import { PLANET_GLSL, planetUniform } from '../utils/planet';


let ramp: THREE.DataTexture | null = null;
export function toonRamp(): THREE.DataTexture {
  if (ramp) return ramp;
  const steps = new Uint8Array([70, 70, 150, 150, 255, 255].flatMap((v) => [v, v, v, 255]));
  ramp = new THREE.DataTexture(steps, 6, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
}

/**
 * Painterly surface treatment for lit (toon) materials: low-frequency world-space mottling like
 * lime-washed plaster, and a soft grime/AO gradient near the ground. Keeps flat colours alive.
 */
const PAINT_FRAG = /* glsl */ `
  float ph(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
  float pn(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(mix(ph(i),ph(i+vec3(1,0,0)),f.x), mix(ph(i+vec3(0,1,0)),ph(i+vec3(1,1,0)),f.x), f.y),
               mix(mix(ph(i+vec3(0,0,1)),ph(i+vec3(1,0,1)),f.x), mix(ph(i+vec3(0,1,1)),ph(i+vec3(1,1,1)),f.x), f.y), f.z); }
`;

export function bend(mat: THREE.Material, paint = false): THREE.Material {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    prev?.call(mat, shader, r);
    shader.uniforms.uPlanetR = planetUniform;
    if (paint) {
      shader.vertexShader = 'varying vec3 vPaintW;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vPaintW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = 'varying vec3 vPaintW;\n' + PAINT_FRAG + shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float m = pn(vPaintW * 0.35) * 0.6 + pn(vPaintW * 1.7) * 0.4;
          diffuseColor.rgb *= 0.86 + 0.2 * m;
          diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.0, 1.4, vPaintW.y));
        }`,
      );
    }
    shader.vertexShader = PLANET_GLSL + '\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
  vec4 wp = modelMatrix * mvPosition;
  wp.xyz = toPlanet(wp.xyz);
  mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;`,
    );
  };
  // Lit surfaces (toon / lambert) are clamped just below the bloom threshold, so only real light
  // sources (bulbs, lanterns, flames — unlit "glow" materials) bloom. White kurtas, walls and
  // marble under strong festival lights no longer glare or look like they emit light.
  const lit = (mat as THREE.MeshToonMaterial).isMeshToonMaterial || (mat as THREE.MeshLambertMaterial).isMeshLambertMaterial;
  if (lit) {
    const prev2 = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, r) => {
      prev2.call(mat, shader, r);
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(0.9));');
    };
  }
  mat.customProgramCacheKey = () => (paint ? 'bend-paint' : 'bend') + (lit ? '-lit' : '');
  return mat;
}

const cache = new Map<string, THREE.Material>();

export function toon(color: number, opts: { emissive?: number; emissiveIntensity?: number; side?: THREE.Side; paint?: boolean } = {}) {
  const paint = opts.paint ?? true;
  const key = `t${color}_${opts.emissive ?? 0}_${opts.emissiveIntensity ?? 0}_${opts.side ?? 0}_${paint}`;
  let m = cache.get(key);
  if (!m) {
    m = bend(
      new THREE.MeshToonMaterial({
        color,
        gradientMap: toonRamp(),
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 1,
        side: opts.side ?? THREE.FrontSide,
      }),
      paint,
    );
    m.userData.batch = `toon${paint ? 'P' : 'N'}${opts.side ?? 0}`;
    m.userData.batchable = !opts.emissive;
    cache.set(key, m);
  }
  return m as THREE.MeshToonMaterial;
}

/**
 * Shared vertex-coloured materials used by the static-geometry Batcher: thousands of differently
 * coloured props collapse into one material (and so a handful of draw calls per spatial cell).
 */
const batchMats = new Map<string, THREE.Material>();
export function batchMaterial(kind: string): THREE.Material {
  let m = batchMats.get(kind);
  if (m) return m;
  if (kind === 'glow') {
    m = bend(new THREE.MeshBasicMaterial({ vertexColors: true }));
  } else {
    const paint = kind[4] === 'P';
    const side = Number(kind.slice(5)) as THREE.Side;
    m = bend(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp(), side }), paint);
  }
  batchMats.set(kind, m);
  return m;
}

/**
 * Smooth (non-banded) lit material for large flat surfaces — ground, roads, plazas. Cel bands on
 * the floor turn every street lamp into hard rings, so floors use soft Lambert shading instead.
 */
export function soft(color: number) {
  const key = `s${color}`;
  let m = cache.get(key);
  if (!m) {
    m = bend(new THREE.MeshLambertMaterial({ color }), true);
    cache.set(key, m);
  }
  return m as THREE.MeshLambertMaterial;
}

/** Unlit glowing material for bulbs, lanterns and diyas (feeds bloom). */
export function glow(color: number, intensity = 3) {
  const key = `g${color}_${intensity}`;
  let m = cache.get(key);
  if (!m) {
    const c = new THREE.Color(color).multiplyScalar(intensity);
    m = bend(new THREE.MeshBasicMaterial({ color: c, toneMapped: true }));
    m.userData.batch = 'glow';
    m.userData.batchable = true;
    cache.set(key, m);
  }
  return m as THREE.MeshBasicMaterial;
}

/** Instanced-colour toon material (crowds, bulb strings). */
export function toonInstanced() {
  return bend(new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonRamp() })) as THREE.MeshToonMaterial;
}
