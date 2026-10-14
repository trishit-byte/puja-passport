/**
 * Fallback pandal: a bamboo-and-cloth pavilion in the pandal's palette, with interaction stations
 * placed in a semicircle in the visitor area. Used until a dedicated builder exists for a pandal.
 */
import * as THREE from 'three';
import { toon, glow, bend } from '../../rendering/materials';
import { idolTableau, gate, bediRailing, wall, cyl, sph, type PandalBuild, type PandalTarget } from './common';
import type { BuildCtx } from './index';

export function targetIds(spec: BuildCtx['def']['interaction']): string[] {
  switch (spec.kind) {
    case 'single':
      return [spec.targetId];
    case 'set':
      return spec.targets.map((t) => t.id);
    case 'rhythm':
      return ['dhak'];
    case 'match':
      return ['postcards', ...spec.landmarks.map((l) => l.id)];
  }
}

export function buildGeneric(ctx: BuildCtx): PandalBuild {
  const { L, cols, bulbs, def } = ctx;
  const p = def.palette;
  const dyn = new THREE.Group();
  const prim = toon(p.primary), sec = toon(p.secondary), acc = toon(p.accent);
  const R = 15;
  wall(L, cols, -R, 15, -4, 15, 3.5, sec);
  wall(L, cols, 4, 15, R, 15, 3.5, sec);
  wall(L, cols, -R, 15, -R, -14, 5, sec);
  wall(L, cols, R, 15, R, -14, 5, sec);
  wall(L, cols, -R, -14, R, -14, 8, sec);
  gate(L, 15.2, 6.5, 6, { frame: p.secondary, cloth: p.primary, accent: p.accent }, { bn: def.bn, en: def.name }, bulbs, dyn);
  // canopy pavilion over the idol
  for (const x of [-8, 8]) for (const z of [-12, -3]) L.put(cyl, prim, x, 4, z, 0.6, 8, 0.6);
  L.box(acc, 0, 8.3, -7.5, 18, 0.5, 11);
  L.put(sph, prim, 0, 8.6, -7.5, 14, 4, 9);
  idolTableau(L, 0, -9, 0.95, { panel: p.secondary, chalchitra: p.accent });
  bediRailing(L, cols, -3.6, 12);
  const ids = targetIds(def.interaction);
  const targets: PandalTarget[] = [];
  const markers: THREE.Mesh[] = [];
  ids.forEach((id, i) => {
    const a = Math.PI * (0.2 + (0.6 * i) / Math.max(1, ids.length - 1));
    const x = Math.cos(a) * 9 * (ids.length === 1 ? 0 : 1), z = 3 + Math.sin(a) * 4;
    L.put(cyl, sec, x, 0.6, z, 0.9, 1.2, 0.9);
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 2), bend(new THREE.MeshBasicMaterial({ color: new THREE.Color(p.light).multiplyScalar(1.2) })));
    orb.position.copy(L.w(x, 1.7, z));
    orb.frustumCulled = false;
    dyn.add(orb);
    markers.push(orb);
    const w = L.w(x, 0, z + 1.3);
    cols.addCircle(L.w(x, 0, z).x, L.w(x, 0, z).z, 0.9, 1.2);
    targets.push({ id, pos: w, radius: 2.2 });
  });
  return {
    targets,
    lights: [
      { pos: L.w(0, 6, -6), color: p.light, intensity: 16, distance: 22 },
      { pos: L.w(0, 4, 4), color: p.light, intensity: 8, distance: 16 },
    ],
    dynamic: dyn,
    update(t, _dt, done) {
      markers.forEach((m, i) => {
        const d = done.includes(ids[i]);
        (m.material as THREE.MeshBasicMaterial).color.set(p.light).multiplyScalar(d ? 4 : 1 + 0.4 * Math.sin(t * 3 + i));
        m.position.y = 1.7 + Math.sin(t * 2 + i) * 0.1;
      });
    },
    onActivate() {},
    view: { pos: L.w(0, 3, 6), look: L.w(0, 3, -9) },
    gate: L.w(0, 0, 12),
    darshan: L.w(0, 0, 0),
  };
}
void glow;
