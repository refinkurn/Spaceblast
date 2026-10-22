import * as THREE from 'three';
import { Item } from '../sim/constants';

// How each power-up looks on the grid: colours, a low-poly mesh built from shared
// geometry and materials, and the glass shell around it. Colours follow
// docs/design/powerup-look.md, except that the shell is clear and there is no
// floor aura (playtest: a glow in the item's colour was confusing). Everything
// is built in code, no assets.

export interface ItemLook {
  name: string;
  /** Main colour: the item, pick-up particles, HUD. */
  color: number;
  /** Second colour: body or trim. */
  second: number;
}

export const ITEM_LOOK: Record<number, ItemLook> = {
  [Item.BeamRange]: { name: 'Beam Range+', color: 0xff5500, second: 0xffcc00 },
  [Item.ExtraCharge]: { name: 'Extra Charge', color: 0x00ffff, second: 0x1a103c },
  [Item.JetBoots]: { name: 'Speed Boost', color: 0xffe600, second: 0xffffff },
  [Item.FreezePulse]: { name: 'Freeze Pulse', color: 0xb9a4ff, second: 0xffffff },
  [Item.OxygenVest]: { name: 'Oxygen Vest', color: 0xffffff, second: 0x7fe8ff },
};

/** Every real power-up (not Item.None). */
export const ITEM_KINDS: number[] = Object.values(Item).filter((v) => v !== Item.None);

const glow = (color: number, intensity = 0.8) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4, flatShading: true });
const solid = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, flatShading: true });

const shared = new Map<string, THREE.BufferGeometry | THREE.Material>();
function cached<T extends THREE.BufferGeometry | THREE.Material>(key: string, make: () => T): T {
  let v = shared.get(key) as T | undefined;
  if (!v) shared.set(key, (v = make()));
  return v;
}
const geo = <T extends THREE.BufferGeometry>(key: string, make: () => T) => cached(`g:${key}`, make);
const mat = (key: string, make: () => THREE.Material) => cached(`m:${key}`, make);

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  return o;
}

/** A lightning bolt outline, flat, about 0.22 long (for the hoverboard deck). */
function boltGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const pts: [number, number][] = [[-0.14, 0.035], [0.0, 0.06], [-0.025, 0.0], [0.14, 0.0], [0.0, -0.06], [0.025, -0.005], [-0.14, -0.012]];
  s.moveTo(...pts[0]);
  for (const p of pts.slice(1)) s.lineTo(...p);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: false });
}

/** A heater shield (flat top, sides curving to a point), `r` half-width, `depth` thick, centred. */
function shieldGeometry(r: number, depth: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-r, r * 0.9);
  s.lineTo(r, r * 0.9);
  s.quadraticCurveTo(r, -r * 0.4, 0, -r * 1.25);
  s.quadraticCurveTo(-r, -r * 0.4, -r, r * 0.9);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** The item itself, centred on the origin and about 0.4 tall. */
function body(item: number): THREE.Group {
  const g = new THREE.Group();
  const l = ITEM_LOOK[item];
  switch (item) {
    case Item.ExtraCharge: {
      g.add(mesh(geo('charge', () => new THREE.IcosahedronGeometry(0.15, 0)), mat('charge', () => solid(l.second))));
      g.add(mesh(geo('fuse', () => new THREE.OctahedronGeometry(0.07, 0)), mat('fuse', () => glow(l.color, 1.2)), 0, 0.2, 0));
      break;
    }
    case Item.BeamRange: {
      const flame = geo('flame', () => new THREE.ConeGeometry(0.075, 0.3, 5));
      const outer = mat('flame-o', () => glow(l.color, 0.9));
      const inner = mat('flame-i', () => glow(l.second, 1));
      g.add(mesh(flame, inner, 0, 0, 0));
      for (const a of [0, 2.1, 4.2]) {
        const f = mesh(flame, outer, Math.cos(a) * 0.09, -0.03, Math.sin(a) * 0.09);
        f.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
        g.add(f);
      }
      break;
    }
    case Item.JetBoots: {
      // Speed Boost: a hoverboard tilted nose-up as if racing, a lightning bolt on
      // its deck and a boost flame behind it.
      const board = new THREE.Group();
      board.add(mesh(geo('board', () => new THREE.CapsuleGeometry(0.075, 0.26, 2, 8).rotateZ(Math.PI / 2).scale(1, 0.32, 1)), mat('board', () => glow(l.color, 0.55))));
      const bolt = mesh(geo('bolt', () => boltGeometry()), mat('bolt', () => glow(0x2b3fbf, 0.9)), 0, 0.028, 0);
      bolt.rotation.x = -Math.PI / 2;
      board.add(bolt);
      const flame = mesh(geo('boost', () => new THREE.ConeGeometry(0.06, 0.2, 6).rotateZ(Math.PI / 2)), mat('boost', () => glow(0xff8a00, 1.2)), -0.29, 0, 0);
      board.add(flame);
      for (const z of [-0.06, 0.06]) board.add(mesh(geo('pad', () => new THREE.CylinderGeometry(0.035, 0.035, 0.02, 8)), mat('pad', () => glow(0x7fe8ff, 1)), 0.08, -0.035, z), mesh(geo('pad', () => new THREE.CylinderGeometry(0.035, 0.035, 0.02, 8)), mat('pad', () => glow(0x7fe8ff, 1)), -0.1, -0.035, z));
      board.rotation.z = 0.42; // nose up: running fast
      board.rotation.x = 0.18;
      g.add(board);
      break;
    }
    case Item.OxygenVest: {
      // Oxygen Vest: a shield (white face, pale cyan rim) with an O2 bar across it.
      g.add(mesh(geo('shield-rim', () => shieldGeometry(0.2, 0.03)), mat('shield-rim', () => glow(l.second, 0.9)), 0, 0, -0.025));
      g.add(mesh(geo('shield', () => shieldGeometry(0.165, 0.05)), mat('shield', () => new THREE.MeshStandardMaterial({ color: l.color, emissive: l.second, emissiveIntensity: 0.25, roughness: 0.25, metalness: 0.1, flatShading: true }))));
      g.add(mesh(geo('shield-bar', () => new THREE.BoxGeometry(0.16, 0.04, 0.02)), mat('shield-bar', () => glow(l.second, 1)), 0, 0.03, 0.04));
      g.add(mesh(geo('shield-bar-v', () => new THREE.BoxGeometry(0.04, 0.16, 0.02)), mat('shield-bar', () => glow(l.second, 1)), 0, 0.03, 0.04));
      break;
    }
    default: {
      // Freeze Pulse: a cluster of ice crystals.
      const ice = mat('ice', () => glow(l.color, 0.7));
      g.add(mesh(geo('ice-big', () => new THREE.OctahedronGeometry(0.17, 0)), ice));
      const small = geo('ice-small', () => new THREE.OctahedronGeometry(0.08, 0));
      const white = mat('ice-w', () => glow(l.second, 0.6));
      g.add(mesh(small, white, 0.14, -0.07, 0.04), mesh(small, white, -0.12, -0.08, -0.06), mesh(small, ice, 0.02, 0.15, -0.1));
      break;
    }
  }
  return g;
}

/** The item fills most of its shell (playtest: items were too small to notice). */
export const BODY_SCALE = 1.3;

/** Shell colour: pale neutral glass, the same for every item, so the coloured item inside is the only colour. */
export const SHELL_COLOR = 0xdfe8f2;

/** The clear glass shell, one geometry and one material for every item. */
export function shellMesh(_item: number): THREE.Mesh {
  const m = mesh(
    geo('shell', () => new THREE.IcosahedronGeometry(0.3, 1)),
    mat('shell', () => new THREE.MeshStandardMaterial({
      color: SHELL_COLOR, transparent: true, opacity: 0.16, depthWrite: false, roughness: 0.15, metalness: 0.1, flatShading: true,
    })),
  );
  m.castShadow = false;
  return m;
}

/** The item's own mesh (spins inside the shell). */
export function itemBody(item: number): THREE.Group {
  const g = body(item);
  g.scale.setScalar(BODY_SCALE);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return g;
}
