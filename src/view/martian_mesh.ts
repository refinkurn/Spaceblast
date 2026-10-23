import * as THREE from 'three';
import { Kind } from '../sim/constants';
import { MARTIAN_COLOR } from './play_colors';

// Low-poly Martians, built in code (docs/design/martian-look.md). Each species
// keeps its gameplay colour (play_colors.ts) and gets its own silhouette:
//   Goopling  a jelly "space octopus": dome, six stubby tentacles, big eyes
//   Sniffer   low and lean on four quick legs, a long twitching snout, two feelers
//   Phaser    a floating see-through jellyfish hood, a glowing ring, trailing tentacles
//   Builder   a stocky crab with rocky back plates, two big claws, toxic drips
// The front is -z. View only.

export interface MartianParts {
  /** Recoloured when frozen; its emissive goes dark in a Blackout. */
  skin: THREE.MeshStandardMaterial;
  /** Squash/wobble pivot. */
  body: THREE.Group;
  tentacles: THREE.Object3D[];
  legs: THREE.Object3D[];
  claws: THREE.Object3D[];
  feelers: THREE.Object3D[];
  snout?: THREE.Object3D;
  ring?: THREE.Object3D;
  drip?: THREE.Object3D;
}

const flat = (color: number, emissive = 0.15) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, roughness: 0.45, flatShading: true });

// Shared geometry (all low-poly).
const G = {
  dome: new THREE.SphereGeometry(0.32, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2),
  skirt: new THREE.CylinderGeometry(0.32, 0.27, 0.08, 9),
  tentacle: new THREE.ConeGeometry(0.075, 0.3, 5).translate(0, -0.15, 0),
  eye: new THREE.IcosahedronGeometry(0.085, 1),
  pupil: new THREE.IcosahedronGeometry(0.045, 0),
  sniffBody: new THREE.IcosahedronGeometry(0.25, 0).scale(0.95, 0.6, 1.35),
  snout: new THREE.ConeGeometry(0.07, 0.34, 6).rotateX(-Math.PI / 2).translate(0, 0, -0.17),
  nose: new THREE.IcosahedronGeometry(0.05, 0),
  leg: new THREE.BoxGeometry(0.05, 0.2, 0.05).translate(0, -0.1, 0),
  feeler: new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4).translate(0, 0.11, 0),
  feelerTip: new THREE.IcosahedronGeometry(0.035, 0),
  hood: new THREE.SphereGeometry(0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
  ring: new THREE.TorusGeometry(0.31, 0.035, 5, 16),
  trail: new THREE.ConeGeometry(0.035, 0.34, 4).rotateX(Math.PI).translate(0, -0.17, 0),
  shell: new THREE.DodecahedronGeometry(0.3, 0).scale(1.2, 0.62, 1),
  plate: new THREE.DodecahedronGeometry(0.12, 0),
  arm: new THREE.BoxGeometry(0.07, 0.07, 0.18).translate(0, 0, -0.09),
  pincer: new THREE.BoxGeometry(0.06, 0.05, 0.12).translate(0, 0, -0.06),
  crabLeg: new THREE.BoxGeometry(0.04, 0.04, 0.2).translate(0, 0, 0.1),
  drip: new THREE.IcosahedronGeometry(0.035, 0),
};
const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
const eyeDark = new THREE.MeshBasicMaterial({ color: 0x220a33 });

/** Two eyes with pupils, `spread` apart, looking forward. */
function eyes(parent: THREE.Object3D, y: number, spread: number, z: number, size = 1): void {
  for (const side of [-1, 1]) {
    const e = new THREE.Mesh(G.eye, eyeWhite);
    e.scale.setScalar(size);
    e.position.set(side * spread, y, z);
    const p = new THREE.Mesh(G.pupil, eyeDark);
    p.position.set(0, 0, -0.06);
    e.add(p);
    parent.add(e);
  }
}

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  return o;
}

/** Builds one Martian. The group's userData.parts holds the animated parts. */
export function makeMartian(kind: number): THREE.Group {
  const g = new THREE.Group();
  const color = MARTIAN_COLOR[kind];
  const skin = flat(color);
  const dark = flat(new THREE.Color(color).multiplyScalar(0.6).getHex(), 0.05);
  const body = new THREE.Group();
  body.name = 'body';
  g.add(body);
  const parts: MartianParts = { skin, body, tentacles: [], legs: [], claws: [], feelers: [] };

  if (kind === Kind.Goopling) {
    const dome = mesh(G.dome, skin, 0, 0.12, 0);
    dome.scale.y = 0.95;
    body.add(dome, mesh(G.skirt, dark, 0, 0.12, 0));
    eyes(body, 0.32, 0.12, -0.24, 1.25);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const pivot = new THREE.Group();
      pivot.position.set(Math.sin(a) * 0.26, 0.13, Math.cos(a) * 0.26);
      pivot.rotation.y = a;
      const t = mesh(G.tentacle, skin);
      t.rotation.x = -1.15; // splayed outwards (local +z points away from the centre), octopus-style
      pivot.add(t);
      body.add(pivot);
      parts.tentacles.push(pivot);
    }
  } else if (kind === Kind.Sniffer) {
    body.add(mesh(G.sniffBody, skin, 0, 0.27, 0.02));
    const snout = new THREE.Group();
    snout.position.set(0, 0.27, -0.28);
    snout.add(mesh(G.snout, skin), mesh(G.nose, eyeDark, 0, 0, -0.34));
    body.add(snout);
    parts.snout = snout;
    eyes(body, 0.37, 0.1, -0.2, 0.85);
    for (const side of [-1, 1]) {
      const f = new THREE.Group();
      f.position.set(side * 0.07, 0.4, -0.12);
      f.rotation.set(-0.5, 0, side * -0.35);
      f.add(mesh(G.feeler, dark), mesh(G.feelerTip, skin, 0, 0.22, 0));
      body.add(f);
      parts.feelers.push(f);
    }
    for (const [x, z] of [[-0.15, -0.14], [0.15, -0.14], [-0.15, 0.18], [0.15, 0.18]]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.2, z);
      leg.add(mesh(G.leg, dark));
      body.add(leg);
      parts.legs.push(leg);
    }
  } else if (kind === Kind.Phaser) {
    skin.transparent = true;
    skin.opacity = 0.72;
    body.add(mesh(G.hood, skin, 0, 0.5, 0));
    const ring = mesh(G.ring, new THREE.MeshBasicMaterial({ color: 0xc9d0ff }), 0, 0.5, 0);
    ring.rotation.x = Math.PI / 2;
    body.add(ring);
    parts.ring = ring;
    eyes(body, 0.56, 0.1, -0.2, 0.9);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.position.set(Math.sin(a) * 0.17, 0.5, Math.cos(a) * 0.17);
      pivot.add(mesh(G.trail, skin));
      body.add(pivot);
      parts.tentacles.push(pivot);
    }
  } else {
    // Builder
    body.add(mesh(G.shell, skin, 0, 0.24, 0.02));
    const rock = flat(0x6b6f5a, 0.02);
    for (const [x, y, z, s] of [[0, 0.42, 0.06, 1.1], [-0.13, 0.38, 0.12, 0.8], [0.14, 0.37, -0.02, 0.85]]) {
      const p = mesh(G.plate, rock, x, y, z);
      p.scale.setScalar(s);
      p.rotation.set(x * 4, z * 6, y);
      body.add(p);
    }
    eyes(body, 0.36, 0.09, -0.3, 0.8);
    for (const side of [-1, 1]) {
      const claw = new THREE.Group();
      claw.position.set(side * 0.24, 0.22, -0.2);
      claw.rotation.y = side * 0.35;
      const tipA = mesh(G.pincer, skin, side * 0.03, 0.02, -0.17);
      const tipB = mesh(G.pincer, dark, side * -0.01, -0.03, -0.17);
      tipA.rotation.x = -0.25;
      tipB.rotation.x = 0.25;
      claw.add(mesh(G.arm, dark), tipA, tipB);
      body.add(claw);
      parts.claws.push(claw);
    }
    for (const side of [-1, 1]) {
      for (const z of [-0.06, 0.08, 0.2]) {
        const leg = new THREE.Group();
        leg.position.set(side * 0.24, 0.16, z);
        leg.rotation.order = 'YXZ'; // turn sideways, then droop to the floor
        leg.rotation.set(0.55, side * (Math.PI / 2) + (z - 0.07) * side * -2, 0);
        leg.add(mesh(G.crabLeg, dark));
        body.add(leg);
        parts.legs.push(leg);
      }
    }
    const drip = mesh(G.drip, flat(0x9cff3a, 0.9), 0.1, 0.2, 0.05);
    body.add(drip);
    parts.drip = drip;
  }
  body.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  g.userData.parts = parts;
  return g;
}

/** A Builder's claw slap (it just built a rock): seconds left, read by animateMartian. */
export const SLAP_SECONDS = 0.25;

/**
 * Moves a Martian's parts for this frame. `t` is the view clock (seconds),
 * `seed` keeps neighbours out of step, `moving` is whether it walked this
 * tick, `frozen` stops everything (Freeze Pulse), `slap` is 0..1 of a claw slap.
 */
export function animateMartian(kind: number, parts: MartianParts, t: number, seed: number, moving: boolean, frozen: boolean, slap = 0): void {
  if (frozen) return;
  const s = t + seed;
  if (kind === Kind.Goopling) {
    parts.tentacles.forEach((p, i) => { p.rotation.z = Math.sin(s * (moving ? 9 : 4) + i * 1.3) * 0.35; });
  } else if (kind === Kind.Sniffer) {
    if (parts.snout) parts.snout.rotation.set(Math.sin(s * 11) * 0.08, Math.sin(s * 7) * 0.12, 0);
    parts.feelers.forEach((f, i) => { f.rotation.x = -0.5 + Math.sin(s * 6 + i * 2) * 0.25; });
    // Diagonal pairs step together: front-left with back-right, front-right with back-left.
    parts.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(s * 22 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.6 : 0; });
  } else if (kind === Kind.Phaser) {
    if (parts.ring) parts.ring.rotation.z = s * 1.8;
    parts.tentacles.forEach((p, i) => { p.rotation.x = Math.sin(s * 2.4 + i) * 0.3; p.rotation.z = Math.cos(s * 2 + i * 1.7) * 0.25; });
  } else {
    parts.legs.forEach((l, i) => { l.rotation.z = moving ? Math.sin(s * 14 + i * 1.1) * 0.25 : 0; });
    const up = Math.sin(Math.min(1, slap) * Math.PI);
    parts.claws.forEach((c) => { c.rotation.x = -0.9 * up; });
    if (parts.drip) {
      const k = (s * 0.8) % 1;
      parts.drip.position.y = 0.2 - k * 0.18;
      parts.drip.scale.setScalar(1 - k * 0.6);
    }
  }
}
