/**
 * Tiny-planet mapping. All gameplay (layout, collision, saves) lives on a flat XZ plane; rendering
 * wraps that plane onto a sphere using an azimuthal-equidistant projection around the city centre:
 *
 *   flat (x, h, z)  →  C + (R + h) · (sinφ·x/d, cosφ, sinφ·z/d),   d = |(x,z)|, φ = d / R,  C = (0,-R,0)
 *
 * Distances from the centre are preserved exactly; local shapes are preserved up to a rotation,
 * so characters and buildings look undistorted while streets curve away over a near horizon.
 * The same function exists in GLSL (materials.ts) and here for cameras, lights and UI projection.
 */
import * as THREE from 'three';

export const PLANET_R = 165;

export const PLANET_GLSL = /* glsl */ `
uniform float uPlanetR;
vec3 toPlanet(vec3 p){
  float d = length(p.xz);
  if (d < 1e-4) return vec3(p.x, p.y, p.z);
  float phi = d / uPlanetR;
  vec2 dir = p.xz / d;
  float r = uPlanetR + p.y;
  return vec3(sin(phi) * dir.x * r, cos(phi) * r - uPlanetR, sin(phi) * dir.y * r);
}`;

export const planetUniform = { value: PLANET_R };

export function toPlanet(x: number, y: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  const R = planetUniform.value;
  const d = Math.hypot(x, z);
  if (d < 1e-4) return out.set(x, y, z);
  const phi = d / R;
  const r = R + y;
  return out.set((Math.sin(phi) * x / d) * r, Math.cos(phi) * r - R, (Math.sin(phi) * z / d) * r);
}

export function normalAt(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  return toPlanet(x, 0, z, out).add(new THREE.Vector3(0, planetUniform.value, 0)).normalize();
}

const UP = new THREE.Vector3(0, 1, 0);
/** Rotation carrying the flat frame at (x,z) onto the planet's local frame there. */
export function frameAt(x: number, z: number, out = new THREE.Quaternion()): THREE.Quaternion {
  return out.setFromUnitVectors(UP, normalAt(x, z));
}

/** Angular distance (radians) between two flat points as seen from the planet centre. */
export function angleBetween(ax: number, az: number, bx: number, bz: number): number {
  const a = normalAt(ax, az), b = normalAt(bx, bz);
  return Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
}
