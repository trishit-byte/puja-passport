/** Painted night sky dome: vertical gradient, soft painterly cloud bands, stars, moon and a sun glow for dawn. */
import * as THREE from 'three';
import { frameAt } from '../utils/planet';

export class Sky {
  mesh: THREE.Mesh;
  uniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uBottom: { value: new THREE.Color() },
    uCloud: { value: new THREE.Color() },
    uStars: { value: 1 },
    uSunDir: { value: new THREE.Vector3(0, -0.2, 1).normalize() },
    uSunColor: { value: new THREE.Color(0xffb36b) },
    uSun: { value: 0 },
    uMoonDir: { value: new THREE.Vector3(-0.4, 0.55, -0.7).normalize() },
    uTime: { value: 0 },
  };
  constructor() {
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
      fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uBottom, uCloud, uSunColor; uniform float uStars, uSun, uTime;
      uniform vec3 uSunDir, uMoonDir; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a=0.5, s=0.; for(int i=0;i<4;i++){ s+=a*n(p); p*=2.03; a*=0.5;} return s; }
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 c = y > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.65, y), 0.8)) : mix(uHorizon, uBottom, smoothstep(0.0, -0.25, y));
        // sun glow near horizon (dawn)
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        c += uSunColor * (pow(sd, 6.0) * 0.45 + pow(sd, 60.0) * 0.35 + smoothstep(0.9985, 0.9992, sd) * 1.6) * uSun;
        // painterly cloud bands, posterised into flat shapes
        vec2 cp = d.xz / max(y + 0.15, 0.05) * 1.3 + vec2(uTime * 0.004, 0.0);
        float cl = fbm(cp * 0.9);
        float band = smoothstep(0.52, 0.56, cl) * 0.55 + smoothstep(0.64, 0.68, cl) * 0.35;
        band *= smoothstep(0.02, 0.18, y) * (1.0 - smoothstep(0.55, 0.9, y));
        c = mix(c, uCloud, band);
        // stars
        if (uStars > 0.0 && y > 0.05) {
          vec2 sp = d.xz / (y + 0.2) * 60.0; vec2 cell = floor(sp);
          float r = h(cell); vec2 f = fract(sp) - 0.5;
          float s = step(0.985, r) * smoothstep(0.08, 0.0, length(f)) * (0.6 + 0.4 * sin(uTime * 2.0 + r * 50.0));
          c += vec3(1.0, 0.95, 0.85) * s * uStars * (1.0 - band) * smoothstep(0.05, 0.3, y);
        }
        // moon
        float md = dot(d, normalize(uMoonDir));
        c += vec3(1.0, 0.96, 0.85) * smoothstep(0.9993, 0.9996, md) * 1.6 * uStars;
        c += vec3(0.6, 0.6, 0.8) * pow(max(md, 0.0), 200.0) * 0.25 * uStars;
        gl_FragColor = vec4(c, 1.0);
      }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }
  /** Centre on the camera and tilt so the sky's zenith matches the planet's local up. */
  follow(cam: THREE.Camera, flatX: number, flatZ: number) {
    this.mesh.position.copy(cam.position);
    frameAt(flatX, flatZ, this.mesh.quaternion);
  }
}
