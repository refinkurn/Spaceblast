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
      g.add(mesh(geo('boot-leg', () => new THREE.BoxGeometry(0.12, 0.2, 0.12)), mat('boot', () => glow(l.color, 0.6)), -0.02, 0.05, 0));
      g.add(mesh(geo('boot-foot', () => new THREE.BoxGeometry(0.14, 0.09, 0.24)), mat('boot', () => glow(l.color, 0.6)), -0.02, -0.08, 0.04));
      const wing = geo('boot-wing', () => new THREE.BoxGeometry(0.02, 0.05, 0.16));
      const white = mat('boot-wing', () => solid(l.second));
      for (const s of [-1, 1]) {
        const w = mesh(wing, white, 0.08 * s - 0.02, 0.05, -0.02);
        w.rotation.z = -0.5 * s;
        g.add(w);
      }
      break;
    }
    case Item.OxygenVest: {
      g.add(mesh(geo('helmet', () => new THREE.IcosahedronGeometry(0.17, 1)), mat('helmet', () => new THREE.MeshStandardMaterial({ color: l.color, emissive: l.second, emissiveIntensity: 0.35, roughness: 0.1, metalness: 0.1, flatShading: true }))));
      g.add(mesh(geo('visor', () => new THREE.TorusGeometry(0.17, 0.02, 6, 14)), mat('visor', () => glow(l.second, 1)), 0, 0, 0));
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
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return g;
}
