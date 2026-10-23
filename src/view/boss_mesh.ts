import * as THREE from 'three';
import { BossKind } from '../sim/constants';

// Low-poly bosses, built in code (docs/design/martian-look.md):
//   Goopling Hive  a lumpy green organic mound with pulsing pores and one big eye
//   Darkness Hive  a bigger, darker violet mound of jagged crystal with crackling arcs
//   Maze Master    a floating angular orange core inside four orbiting stone blocks
// Each is drawn on the centre tile, about 1.5 tiles across. View only.

export interface BossParts {
  root: THREE.Group;
  /** Glowing material: pulses, brighter while a wave is announced. */
  glow: THREE.MeshStandardMaterial;
  /** Scaled by the pulse (the breathing mass). */
  mass: THREE.Object3D;
  pores: THREE.Object3D[];
  arcs: THREE.Object3D[];
  blocks: THREE.Object3D[];
  core?: THREE.Object3D;
  eye?: THREE.Object3D;
}

export const BOSS_COLOR: Record<number, number> = {
  [BossKind.GooplingHive]: 0x6fd14f,
  [BossKind.DarknessHive]: 0x7a4cff,
  [BossKind.MazeMaster]: 0xff8a3d,
};

const flat = (color: number, emissive: number, intensity: number) =>
  new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: 0.5, flatShading: true });

function bigEye(r: number): THREE.Group {
  const e = new THREE.Group();
  e.add(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), new THREE.MeshBasicMaterial({ color: 0xffffff })));
  const pupil = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.5, 0), new THREE.MeshBasicMaterial({ color: 0x1a0826 }));
  pupil.position.z = -r * 0.75;
  e.add(pupil);
  return e;
}

function hive(color: number, dark: boolean): BossParts {
  const root = new THREE.Group();
  const glow = flat(color, color, 0.3);
  const shade = flat(new THREE.Color(color).multiplyScalar(dark ? 0.35 : 0.55).getHex(), color, 0.05);
  const mass = new THREE.Group();
  root.add(mass);
  // Fused lumps: a big central one and a ring of smaller ones.
  const lump = dark ? new THREE.OctahedronGeometry(1, 1) : new THREE.DodecahedronGeometry(1, 0);
  const centre = new THREE.Mesh(lump, glow);
  centre.position.y = 0.35;
  centre.rotation.y = 0.4;
  centre.scale.set(0.62, dark ? 0.72 : 0.55, 0.62);
  mass.add(centre);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const m = new THREE.Mesh(lump, i % 2 ? shade : glow);
    const s = 0.28 + (i % 3) * 0.05;
    m.scale.set(s, s * (dark ? 1.3 : 0.9), s);
    m.position.set(Math.sin(a) * 0.55, 0.15, Math.cos(a) * 0.55);
    m.rotation.set(i, i * 2, 0);
    mass.add(m);
  }
  const parts: BossParts = { root, glow, mass, pores: [], arcs: [], blocks: [] };
  // Pores (hive) or spikes (darkness) around the top.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const p = dark
      ? new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.45, 4), shade)
      : new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.08, 6), new THREE.MeshBasicMaterial({ color: 0x1d3a12 }));
    p.position.set(Math.sin(a) * 0.36, dark ? 0.75 : 0.62, Math.cos(a) * 0.36);
    p.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
    mass.add(p);
    parts.pores.push(p);
  }
  if (dark) {
    // Crackling arcs: thin zigzags that flicker on and off.
    const arcMat = new THREE.MeshBasicMaterial({ color: 0xd9c8ff });
    for (let i = 0; i < 4; i++) {
      const arc = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.2, 0.025), arcMat);
        seg.position.set(0, 0.17 * k, 0);
        seg.rotation.z = k % 2 ? 0.6 : -0.6;
        arc.add(seg);
      }
      const a = (i / 4) * Math.PI * 2 + 0.8;
      arc.position.set(Math.sin(a) * 0.62, 0.3, Math.cos(a) * 0.62);
      arc.rotation.y = a;
      root.add(arc);
      parts.arcs.push(arc);
    }
  }
  const eye = bigEye(dark ? 0.15 : 0.17);
  eye.position.set(0, dark ? 0.6 : 0.5, -0.52);
  root.add(eye);
  parts.eye = eye;
  return parts;
}

function mazeMaster(color: number): BossParts {
  const root = new THREE.Group();
  const glow = flat(color, color, 0.4);
  const stone = flat(0x5b4a40, 0x000000, 0);
  const mass = new THREE.Group();
  root.add(mass);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), glow);
  core.position.y = 0.75;
  mass.add(core);
  const inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), flat(0xfff1d6, color, 0.8));
  inner.position.y = 0.75;
  mass.add(inner);
  const parts: BossParts = { root, glow, mass, pores: [], arcs: [], blocks: [], core };
  // Four stone blocks on the cross axes (its attack runs along a row and a column).
  for (let i = 0; i < 4; i++) {
    const pivot = new THREE.Group();
    pivot.position.y = 0.55;
    pivot.rotation.y = (i * Math.PI) / 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.4, 0.26), stone);
    b.position.set(0, 0, -0.62);
    // A glowing seam on each block's face.
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.02), glow);
    seam.position.set(0, 0.06, -0.76);
    pivot.add(b, seam);
    root.add(pivot);
    parts.blocks.push(pivot);
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.46, 0.12, 8), stone);
  base.position.y = 0.07;
  root.add(base);
  const eye = bigEye(0.12);
  eye.position.set(0, 0.78, -0.3);
  root.add(eye);
  parts.eye = eye;
  return parts;
}

export function makeBoss(kind: number): BossParts {
  const color = BOSS_COLOR[kind] ?? 0xffffff;
  const parts = kind === BossKind.MazeMaster ? mazeMaster(color) : hive(color, kind === BossKind.DarknessHive);
  parts.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return parts;
}

/** One frame of a boss: `pulse` 0..1, `warning` while a wave or cross blast is announced. */
export function animateBoss(kind: number, p: BossParts, t: number, pulse: number, warning: boolean): void {
  p.glow.emissiveIntensity = 0.2 + (warning ? 0.8 : 0.3) * pulse;
  p.mass.scale.set(1 + 0.04 * pulse, 0.94 + 0.1 * pulse, 1 + 0.04 * pulse);
  p.pores.forEach((o, i) => o.scale.setScalar(0.85 + 0.3 * Math.abs(Math.sin(t * (warning ? 9 : 3) + i))));
  p.arcs.forEach((a, i) => { a.visible = Math.sin(t * 23 + i * 5.1) > (warning ? -0.3 : 0.45); });
  if (p.eye) p.eye.rotation.y = Math.sin(t * 0.7) * 0.5;
  if (kind === BossKind.MazeMaster) {
    if (p.core) p.core.rotation.y = t * (warning ? 3 : 0.8);
    // The blocks orbit slowly; during a warning they lock onto the cross axes and push out.
    const spin = warning ? 0 : t * 0.6;
    p.blocks.forEach((b, i) => {
      b.rotation.y = (i * Math.PI) / 2 + spin;
      b.position.y = 0.55 + Math.sin(t * 2 + i) * 0.05;
      b.scale.setScalar(warning ? 1.12 : 1);
    });
  }
}
