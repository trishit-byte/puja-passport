/**
 * Two cheap wins in three.js's per-frame scene-graph walk, which on phones was ~23% of the frame:
 *
 * 1. An object whose position, rotation and scale haven't changed keeps its matrix: no compose,
 *    and (unless its parent moved) no world-matrix multiply for it or anything under it. Most of
 *    the city — walls, props, pandals, the parts of every idle character — is still from one
 *    frame to the next.
 * 2. A hidden object's subtree isn't updated at all (it isn't drawn). The crowd hides far-off
 *    people, so their ~15 body parts each stop costing anything. When an object is shown again
 *    it is brought up to date that same frame.
 *
 * Nothing changes on screen. Code that needs a hidden object's world position uses
 * getWorldPosition()/updateWorldMatrix(), which still update explicitly.
 */
import * as THREE from 'three';

const proto = THREE.Object3D.prototype as THREE.Object3D & { __fast?: boolean };
if (!proto.__fast) {
  proto.__fast = true;
  const baseWorld = proto.updateMatrixWorld;
  proto.updateMatrix = function (this: THREE.Object3D & { _mc?: number[] }) {
    const p = this.position, q = this.quaternion, s = this.scale;
    let c = this._mc;
    if (c && c[0] === p.x && c[1] === p.y && c[2] === p.z && c[3] === q.x && c[4] === q.y && c[5] === q.z && c[6] === q.w && c[7] === s.x && c[8] === s.y && c[9] === s.z) return;
    if (!c) c = this._mc = [];
    c[0] = p.x; c[1] = p.y; c[2] = p.z; c[3] = q.x; c[4] = q.y; c[5] = q.z; c[6] = q.w; c[7] = s.x; c[8] = s.y; c[9] = s.z;
    this.matrix.compose(p, q, s);
    this.matrixWorldNeedsUpdate = true;
  };
  proto.updateMatrixWorld = function (this: THREE.Object3D & { _hid?: boolean }, force?: boolean) {
    if (!this.visible) {
      this._hid = true;
      return;
    }
    // shown again after being hidden: its parent may have moved meanwhile, so refresh it fully
    if (this._hid) {
      this._hid = false;
      force = true;
    }
    baseWorld.call(this, force);
  };
}
