import * as THREE from 'three';
import { GRID_H, GRID_W, TILE } from '../sim/constants';

/** Sim sub-units -> world units. 1 tile = 1 world unit, arena centred on the origin. */
export function toWorld(x: number, y: number, height = 0, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(x / TILE - (GRID_W - 1) / 2, height, y / TILE - (GRID_H - 1) / 2);
}

export function tileToWorld(tx: number, ty: number, height = 0, out = new THREE.Vector3()): THREE.Vector3 {
  return toWorld(tx * TILE, ty * TILE, height, out);
}
