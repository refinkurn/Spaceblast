import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Low-poly rocks, one shape per sector (the map theme in sectors.json), built
// in code and shared by every rock of the arena (one InstancedMesh):
//   surface   a squat, chipped Mars boulder
//   shafts    a broken chunk of mine rock with a flat cut face
//   core      a cluster of amber crystals on a stone base
//   facility  a supply crate with corner straps
// Each instance gets a turn and a slight size change from its tile, so a field
// of rocks doesn't look stamped. About one tile wide, sitting on the floor.

export type RockStyle = 'surface' | 'shafts' | 'core' | 'facility';

/** A stable pseudo-random 0..1 for a tile (view only; not the sim's rng). */
export function tileNoise(tx: number, ty: number, salt = 0): number {
  let h = (tx * 374761393 + ty * 668265263 + salt * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Pushes each vertex in or out a little (same push for shared corners), for a chipped look. */
function chip(g: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = tileNoise(Math.round(x * 97), Math.round(y * 89) + Math.round(z * 83) * 7, seed) - 0.5;
    const k = 1 + n * amount;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** The rock shape for a sector, with its base at y = 0. */
export function rockGeometry(style: RockStyle): THREE.BufferGeometry {
  switch (style) {
    case 'shafts': {
      const g = chip(new THREE.DodecahedronGeometry(0.5, 0), 0.25, 2).scale(0.92, 0.8, 0.92);
      g.translate(0, 0.36, 0);
      // A flat cut face on top, like quarried rock.
      const p = g.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.68) p.setY(i, 0.68);
      g.computeVertexNormals();
      return g;
    }
    case 'core': {
      const base = chip(new THREE.DodecahedronGeometry(0.46, 0), 0.2, 3).scale(1.05, 0.55, 1.05).translate(0, 0.22, 0);
      const parts: THREE.BufferGeometry[] = [base.toNonIndexed()];
      const spikes: [number, number, number, number, number][] = [
        [0, 0.78, 0.24, 0, 0], [0.22, 0.56, 0.17, 0.32, 0.25], [-0.22, 0.6, 0.18, -0.35, -0.2], [0.06, 0.5, 0.15, -0.2, 0.45], [-0.1, 0.46, 0.14, 0.4, -0.45],
      ];
      for (const [x, h, r, rz, rx] of spikes) {
        const c = new THREE.ConeGeometry(r, h, 5).toNonIndexed();
        c.translate(0, h / 2, 0).rotateZ(rz).rotateX(rx).translate(x, 0.2, rx * 0.25);
        parts.push(c);
      }
      const g = mergeGeometries(parts.map((q) => { q.deleteAttribute('uv'); return q; }));
      g.computeVertexNormals();
      return g;
    }
    case 'facility': {
      const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(0.82, 0.76, 0.82).translate(0, 0.38, 0).toNonIndexed()];
      // Corner straps standing slightly proud of the faces.
      for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) parts.push(new THREE.BoxGeometry(0.08, 0.78, 0.08).translate(x, 0.39, z).toNonIndexed());
      parts.push(new THREE.BoxGeometry(0.86, 0.07, 0.86).translate(0, 0.74, 0).toNonIndexed());
      const g = mergeGeometries(parts.map((q) => { q.deleteAttribute('uv'); return q; }));
      g.computeVertexNormals();
      return g;
    }
    default: {
      // Surface: a squat, chipped boulder.
      const g = chip(new THREE.IcosahedronGeometry(0.52, 0), 0.3, 1).scale(1.0, 0.8, 1.0);
      g.translate(0, 0.38, 0);
      return g;
    }
  }
}

/** Instance transform for the rock on (tx, ty): its position plus a turn and a small size change (crates stay square). */
export function rockMatrix(style: RockStyle, tx: number, ty: number, at: THREE.Vector3, out = new THREE.Matrix4()): THREE.Matrix4 {
  const turn = style === 'facility' ? Math.floor(tileNoise(tx, ty, 5) * 4) * (Math.PI / 2) : tileNoise(tx, ty, 5) * Math.PI * 2;
  const s = style === 'facility' ? 1 : 0.92 + tileNoise(tx, ty, 9) * 0.16;
  return out.compose(at, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn), new THREE.Vector3(s, s * (style === 'core' ? 1.1 : 1), s));
}
