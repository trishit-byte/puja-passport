/** Pandal registry: id → geometry builder. Data (names, interaction specs) lives in src/data/pandals.ts. */
import * as THREE from 'three';
import type { Batcher } from '../Batcher';
import type { CollisionWorld } from '../collision';
import type { BulbSystem } from '../props/street';
import { PANDALS, type PandalDef, type PandalId } from '../../data/pandals';
import { Local, type PandalBuild } from './common';
import { buildBonediBari } from './bonediBari';
import { buildGeneric } from './generic';
import { buildAlorUtsav, buildGramBangla, buildShobujSwapno } from './set1';
import { buildDhakerTaal, buildNeelShagor, buildSmritirShohor } from './set2';
import { buildNakshatralok, buildDebaloy, buildNodirOpare } from './set3';
import { landmarkTower, makeBell } from './common';

export interface BuildCtx {
  L: Local;
  cols: CollisionWorld;
  bulbs: BulbSystem;
  def: PandalDef;
}

/** Bell station position in pandal-local space: just inside the entrance, to the right. */
const BELL_SPOT = { x: 7.5, z: (R: number) => Math.min(R - 6, 12) };

const BUILDERS: Partial<Record<PandalId, (c: BuildCtx) => PandalBuild>> = {
  'bonedi-bari': buildBonediBari,
  'alor-utsav': buildAlorUtsav,
  'gram-bangla': buildGramBangla,
  'shobuj-swapno': buildShobujSwapno,
  'dhaker-taal': buildDhakerTaal,
  'neel-shagor': buildNeelShagor,
  'smritir-shohor': buildSmritirShohor,
  'nodir-alo': buildNodirOpare,
  nakshatralok: buildNakshatralok,
  debaloy: buildDebaloy,
};

export function buildPandals(batch: Batcher, cols: CollisionWorld, bulbs: BulbSystem): Map<PandalId, PandalBuild> {
  const out = new Map<PandalId, PandalBuild>();
  for (const def of PANDALS) {
    const base = new THREE.Matrix4().makeRotationY(def.facing).setPosition(def.x, def.y ?? 0, def.z);
    const ctx: BuildCtx = { L: new Local(batch, base), cols, bulbs, def };
    const b = (BUILDERS[def.id] ?? buildGeneric)(ctx);
    // every pandal has a visitors' bell by its entrance: ringing it gives the passport stamp
    // (Bonedi Bari's courtyard bell is already its activity, so it doubles as the stamp bell)
    if (def.id !== 'bonedi-bari') {
      const bell = makeBell(ctx.L, BELL_SPOT.x, BELL_SPOT.z(def.radius), b.dynamic, cols);
      b.targets.push({ id: 'stamp-bell', pos: bell.stand, radius: 2.2 });
      const up = b.update.bind(b), act = b.onActivate.bind(b);
      b.update = (t, dt, done, complete) => {
        up(t, dt, done, complete);
        bell.update(t, dt, !(b as any).stamped);
      };
      b.onActivate = (id) => (id === 'stamp-bell' ? bell.ring() : act(id));
    }
    out.set(def.id, b);
    // Bonedi Bari's own landmark: a lit flag-tower on the mansion roof
    if (def.id === 'bonedi-bari') landmarkTower(ctx.L, 12, -14, 21, [0xffd89a, 0xb3121f, 0xffe8b0], bulbs, 0x8c2f22);
  }
  return out;
}
