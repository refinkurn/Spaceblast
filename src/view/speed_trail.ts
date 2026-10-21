import * as THREE from 'three';

// Speed Boost trail: a short fading yellow ribbon behind the feet while the
// astronaut moves with boots. A fixed pool of segments, view only.

export const TRAIL_SEGMENTS = 8;
const SPACING = 0.05; // seconds between segments

/** Vest bubble brightness: a little more for each armor point, up to 3. */
export function bubbleOpacity(armor: number): number {
  return 0.3 + 0.05 * Math.min(Math.max(armor, 1), 3);
}

/** How long a segment lives: the trail grows a little with each boots level. */
export function trailLife(boots: number): number {
  return 0.16 + 0.04 * Math.min(Math.max(boots, 1), 5);
}

const GEO = new THREE.BoxGeometry(0.22, 0.05, 0.22);
const MAT = new THREE.MeshBasicMaterial({ color: 0xffe600, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });

export class SpeedTrail {
  readonly group = new THREE.Group();
  private segs: { mesh: THREE.Mesh; world: THREE.Vector3; age: number; life: number }[] = [];
  private next = 0;
  private clock = 0;

  constructor() {
    for (let i = 0; i < TRAIL_SEGMENTS; i++) {
      const mesh = new THREE.Mesh(GEO, MAT);
      mesh.visible = false;
      this.group.add(mesh);
      this.segs.push({ mesh, world: new THREE.Vector3(), age: 1, life: 0 });
    }
  }

  /** `at`: the astronaut's world position. `emit`: true while moving with boots. */
  update(dt: number, at: THREE.Vector3, emit: boolean, boots: number): void {
    this.clock += dt;
    if (emit && this.clock >= SPACING) {
      this.clock = 0;
      const s = this.segs[this.next];
      this.next = (this.next + 1) % TRAIL_SEGMENTS;
      s.world.set(at.x, 0.08, at.z);
      s.age = 0;
      s.life = trailLife(boots);
    }
    for (const s of this.segs) {
      if (s.age >= s.life) { s.mesh.visible = false; continue; }
      s.age += dt;
      const f = 1 - s.age / s.life;
      s.mesh.visible = f > 0;
      // The group moves with the astronaut, so keep each segment where it was dropped.
      s.mesh.position.set(s.world.x - at.x, s.world.y, s.world.z - at.z);
      s.mesh.scale.setScalar(Math.max(f, 0.01));
    }
  }

  /** Segments showing (for tests). */
  get visible(): number {
    return this.segs.filter((s) => s.mesh.visible).length;
  }
}
