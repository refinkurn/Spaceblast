import * as THREE from 'three';
import { GRID_H, GRID_W } from '../sim/constants';
import type { ArenaLook, PropKind } from './sector_look';

// The terrain around the arena: a ground plane in the sector's colour and a
// few low-poly props just outside the walls (on the left, right and far side,
// where a landscape screen shows them). Decoration only: nothing here is in
// the sim. No shadows, a handful of meshes per sector, so phones don't pay.

/** Where props stand: x/z in world units (the walls are at x = ±7, z = ±6). */
export function propSlots(): [number, number][] {
  const sx = GRID_W / 2 + 2.6;
  const sz = GRID_H / 2;
  return [
    [-sx, -sz + 1], [-sx, 0.5], [-sx, sz - 0.5],
    [sx, -sz + 1.5], [sx, 0], [sx, sz - 1],
    [-sx + 3, -sz - 2.3], [sx - 3, -sz - 2.3],
  ];
}

const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });
const glow = (color: number) => new THREE.MeshBasicMaterial({ color });

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = h / 2, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  return mesh;
}

/** One prop, built around its own origin on the ground. `i` varies its turn and size a little. */
function prop(kind: PropKind, look: ArenaLook, i: number): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'landing_gear': {
      // A crashed ship's leg: a slanted strut on a foot pad.
      const metal = lambert(0x9aa3b0);
      const strut = box(0.22, 2.2, 0.22, metal, 0, 1.0);
      strut.rotation.z = 0.5;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.18, 10), metal);
      pad.position.set(0.5, 0.09, 0);
      g.add(strut, pad, box(0.9, 0.18, 0.5, lambert(0x6b7280), -0.45, 1.95));
      break;
    }
    case 'solar_panel': {
      // A shattered solar panel, tilted on its post.
      const panel = box(1.6, 0.06, 1.0, lambert(0x1e3a8a), 0, 0.9);
      panel.rotation.x = -0.6;
      panel.rotation.z = 0.25;
      const crack = box(1.2, 0.07, 0.05, glow(0x93c5fd), 0, 0.92);
      crack.rotation.copy(panel.rotation);
      g.add(box(0.1, 0.9, 0.1, lambert(0x6b7280), 0, 0.45), panel, crack);
      break;
    }
    case 'dust_rock': {
      // Duller than the breakable rocks (which share look.rock), so scenery never reads as something to blast.
      const dull = new THREE.Color(look.rock).lerp(new THREE.Color(look.ground), 0.55).getHex();
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), lambert(dull));
      rock.position.y = 0.35;
      rock.scale.set(1.3, 0.7, 1);
      g.add(rock);
      break;
    }
    case 'gantry': {
      // Rusty mine gantry: two posts and a crossbeam.
      const rust = lambert(0x8a4a20);
      g.add(box(0.2, 2.4, 0.2, rust, -0.7), box(0.2, 2.4, 0.2, rust, 0.7), box(1.8, 0.22, 0.26, rust, 0, 2.3), box(1.5, 0.08, 0.08, lambert(0x5a3010), 0, 1.4));
      break;
    }
    case 'floodlight': {
      // Industrial floodlight: a pole with a lit amber head.
      const head = box(0.6, 0.35, 0.3, glow(0xD69E2E), 0, 2.2);
      head.rotation.x = 0.5;
      g.add(box(0.12, 2.1, 0.12, lambert(0x4a5568), 0, 1.05), head);
      break;
    }
    case 'hazard_plank': {
      // A warning barrier: amber and black blocks in a row.
      for (let k = 0; k < 4; k++) g.add(box(0.4, 0.3, 0.3, k % 2 === 0 ? glow(0xD69E2E) : lambert(0x111111), -0.6 + k * 0.4, 0.5));
      g.add(box(0.1, 0.5, 0.1, lambert(0x4a5568), -0.75, 0.25), box(0.1, 0.5, 0.1, lambert(0x4a5568), 0.75, 0.25));
      break;
    }
    case 'crystal': {
      // A cluster of glowing cyan crystals.
      const cyan = glow(0x00F5FF);
      const sizes = [[0, 1.4, 0.32], [0.42, 0.9, 0.24], [-0.38, 1.05, 0.26]];
      for (const [x, h, r] of sizes) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), cyan);
        c.position.set(x, h / 2, (x * 0.6) % 0.3);
        c.rotation.z = -x * 0.5;
        g.add(c);
      }
      break;
    }
    case 'drill_rig': {
      // An old colony drill rig, left where the miners stopped: a frame, a bit
      // sunk in the rock, and a crystal it was cutting.
      const steel = lambert(0x3a2a5c);
      g.add(box(0.12, 2.0, 0.12, steel, -0.45, 1.0), box(0.12, 2.0, 0.12, steel, 0.45, 1.0), box(1.05, 0.14, 0.14, steel, 0, 2.0), box(0.18, 1.3, 0.18, lambert(0x6b5a7a), 0, 1.15));
      const bit = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 6), glow(0x10B981));
      bit.position.y = 0.32;
      bit.rotation.x = Math.PI;
      g.add(bit);
      break;
    }
    case 'vat': {
      // A glass containment vat of toxic green liquid.
      const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.3, 14), glow(0x22C55E));
      liquid.position.y = 0.85;
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.7, 14), new THREE.MeshLambertMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.25, depthWrite: false }));
      glass.position.y = 0.95;
      g.add(box(1.1, 0.2, 1.1, lambert(0x334155), 0, 0.1), liquid, glass, box(1.1, 0.16, 1.1, lambert(0x475569), 0, 1.86));
      break;
    }
    case 'alarm_bar': {
      // A flashing alarm bar on a post (it pulses in updateProps).
      g.add(box(0.12, 1.6, 0.12, lambert(0x475569), 0, 0.8), box(0.9, 0.22, 0.22, glow(0xEF4444), 0, 1.7));
      g.userData.alarm = true;
      break;
    }
  }
  g.rotation.y = (i * 1.37) % (Math.PI * 2);
  g.scale.setScalar(0.9 + (i % 3) * 0.08);
  return g;
}

/** The sector's ground plane and props, as one group. */
export function buildProps(look: ArenaLook, kinds: readonly PropKind[]): THREE.Group {
  const group = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), lambert(look.ground));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.11;
  ground.receiveShadow = true;
  group.add(ground);
  if (kinds.length === 0) return group;
  propSlots().forEach(([x, z], i) => {
    const p = prop(kinds[i % kinds.length], look, i);
    p.position.set(x, 0, z);
    group.add(p);
  });
  return group;
}

/** Alarm bars blink (about once a second); everything else stands still. */
export function updateProps(group: THREE.Group, time: number): void {
  const on = Math.sin(time * 6) > 0;
  group.traverse((o) => {
    if (o.userData.alarm) (o.children[1] as THREE.Mesh).visible = on;
  });
}

export function disposeProps(group: THREE.Group): void {
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
  group.clear();
}
