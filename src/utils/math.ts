export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Frame-rate independent exponential damping factor. */
export const damp = (lambda: number, dt: number) => 1 - Math.exp(-lambda * dt);
export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
export function dampAngle(cur: number, target: number, lambda: number, dt: number): number {
  return cur + wrapAngle(target - cur) * damp(lambda, dt);
}
export type V2 = { x: number; z: number };
export const dist2 = (a: V2, b: V2) => Math.hypot(a.x - b.x, a.z - b.z);
