import * as THREE from 'three';

// Low-poly astronaut built in code (docs/design/character-animation.md): torso, backpack,
// two arms and legs on pivots, a glass helmet around a corgi (Bosco, online players, bots)
// or a duck (Ducking, level 20) head. Geometry and the fixed materials are shared by every
// astronaut; only the suit colour is per figure. View only.

export type HeadKind = 'corgi' | 'duck';

const box = (w: number, h: number, d: number): THREE.BoxGeometry => new THREE.BoxGeometry(w, h, d);
const GEO = {
  torso: box(0.36, 0.34, 0.26),
  pack: box(0.24, 0.26, 0.1),
  packLight: box(0.08, 0.04, 0.02),
  arm: box(0.1, 0.24, 0.1),
  glove: new THREE.SphereGeometry(0.065, 8, 6),
  leg: box(0.12, 0.2, 0.12),
  boot: box(0.14, 0.07, 0.19),
  helmet: new THREE.SphereGeometry(0.25, 14, 10),
  head: new THREE.SphereGeometry(0.17, 12, 8),
  snout: box(0.1, 0.08, 0.1),
  nose: box(0.045, 0.04, 0.04),
  ear: new THREE.ConeGeometry(0.06, 0.12, 4),
  bill: box(0.16, 0.035, 0.12),
};
const mat = (color: number): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color });
const MAT = {
  white: mat(0xf2f4f8),
  pack: mat(0x8d97a8),
  light: new THREE.MeshBasicMaterial({ color: 0x4de8ff }),
  helmet: new THREE.MeshPhongMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.4, shininess: 90, depthWrite: false }),
  orange: mat(0xe8943a),
  cream: mat(0xf6e6c8),
  dark: mat(0x2a1d1a),
  duck: mat(0xf4d03f),
  bill: mat(0xf08a24),
};

/** Scale of the finished figure: about 0.9 tile tall with the helmet. */
export const FIGURE_SCALE = 0.88;

/** Suit colour of Ducking, the level 20 rival (dark violet). */
export const DUCK_SUIT = 0x4b2a7a;

export interface AstronautParts {
  /** The whole figure; feet on y = 0, facing -z. */
  root: THREE.Group;
  /** Limb pivots: rotate on x to swing (positive swings the limb forward (towards -z)). */
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  torso: THREE.Mesh;
  suit: THREE.MeshLambertMaterial;
  packLight: THREE.Mesh;
  head: THREE.Group;
}

function part(geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  return mesh;
}

/** Fills the head group with a corgi or duck head (replaces what was there). */
export function setHead(head: THREE.Group, kind: HeadKind): void {
  head.clear();
  if (kind === 'corgi') {
    const skull = part(GEO.head, MAT.orange, 0, 0, 0);
    skull.scale.set(1, 0.95, 1);
    const earL = part(GEO.ear, MAT.orange, -0.1, 0.17, 0.0);
    const earR = part(GEO.ear, MAT.orange, 0.1, 0.17, 0.0);
    earL.rotation.z = 0.25;
    earR.rotation.z = -0.25;
    head.add(skull, part(GEO.snout, MAT.cream, 0, -0.04, -0.15), part(GEO.nose, MAT.dark, 0, -0.01, -0.21), earL, earR);
  } else {
    head.add(part(GEO.head, MAT.duck, 0, 0, 0), part(GEO.bill, MAT.bill, 0, -0.03, -0.19));
  }
}

/** Builds one figure. `suit` is the player's colour; `reduced` drops the backpack light. */
export function buildAstronaut(color: number, kind: HeadKind, reduced = false): AstronautParts {
  const suit = new THREE.MeshLambertMaterial({ color });
  const root = new THREE.Group();
  const torso = part(GEO.torso, suit, 0, 0.43, 0);
  torso.castShadow = true;
  const pack = part(GEO.pack, MAT.pack, 0, 0.45, 0.17);
  const packLight = part(GEO.packLight, MAT.light, 0, 0.5, 0.225);
  packLight.visible = !reduced;
  const limb = (x: number, y: number, geo: THREE.BufferGeometry, m: THREE.Material, endGeo: THREE.BufferGeometry, endY: number, endZ = 0): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    pivot.add(part(geo, m, 0, -0.1, 0), part(endGeo, MAT.white, 0, endY, endZ));
    return pivot;
  };
  const armL = limb(-0.24, 0.55, GEO.arm, suit, GEO.glove, -0.25);
  const armR = limb(0.24, 0.55, GEO.arm, suit, GEO.glove, -0.25);
  const legL = limb(-0.09, 0.25, GEO.leg, suit, GEO.boot, -0.215, -0.02);
  const legR = limb(0.09, 0.25, GEO.leg, suit, GEO.boot, -0.215, -0.02);
  const head = new THREE.Group();
  head.position.set(0, 0.76, 0);
  setHead(head, kind);
  const helmet = part(GEO.helmet, MAT.helmet, 0, 0.76, 0);
  root.add(torso, pack, packLight, armL, armR, legL, legR, head, helmet);
  return { root, legL, legR, armL, armR, torso, suit, packLight, head };
}
