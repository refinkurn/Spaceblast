import * as THREE from 'three';

// One shared pool of small glowing dots (idle sparkles above power-ups and
// spawn / pick-up bursts). A single THREE.Points with a fixed size keeps it cheap
// on phones. Cosmetic only: Math.random is fine here, it never feeds the sim.

export const POOL_SIZE = 120;

export class ParticlePool {
  readonly points: THREE.Points;
  private pos = new Float32Array(POOL_SIZE * 3);
  private col = new Float32Array(POOL_SIZE * 3);
  private vel = new Float32Array(POOL_SIZE * 3);
  private life = new Float32Array(POOL_SIZE);
  private maxLife = new Float32Array(POOL_SIZE);
  private next = 0;
  private tmp = new THREE.Color();

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    for (let i = 0; i < POOL_SIZE; i++) this.pos[i * 3 + 1] = -100;
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.09, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
  }

  /** Emits one dot (the oldest one is reused when the pool is full). */
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number, life: number): void {
    const i = this.next;
    this.next = (this.next + 1) % POOL_SIZE;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.tmp.setHex(color);
    this.col.set([this.tmp.r, this.tmp.g, this.tmp.b], i * 3);
    this.life[i] = life;
    this.maxLife[i] = life;
  }

  /** A burst of `count` dots flying out from a point. */
  burst(x: number, y: number, z: number, color: number, count: number): void {
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.6 + Math.random() * 1.1;
      this.emit(x, y, z, Math.cos(a) * s, 0.8 + Math.random() * 1.2, Math.sin(a) * s, color, 0.5 + Math.random() * 0.3);
    }
  }

  update(dt: number): void {
    for (let i = 0; i < POOL_SIZE; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const p = i * 3;
      if (this.life[i] <= 0) { this.pos[p + 1] = -100; continue; }
      this.pos[p] += this.vel[p] * dt;
      this.pos[p + 1] += this.vel[p + 1] * dt;
      this.pos[p + 2] += this.vel[p + 2] * dt;
      this.vel[p + 1] -= 1.5 * dt;
      // Fade by dimming towards black (additive blending).
      const f = Math.min(1, this.life[i] / (this.maxLife[i] * 0.6));
      this.col[p] *= f > 0.98 ? 1 : 1 - dt * 2;
      this.col[p + 1] *= f > 0.98 ? 1 : 1 - dt * 2;
      this.col[p + 2] *= f > 0.98 ? 1 : 1 - dt * 2;
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  /** Dots alive (for tests). */
  get alive(): number {
    let n = 0;
    for (let i = 0; i < POOL_SIZE; i++) if (this.life[i] > 0) n++;
    return n;
  }

  clear(): void {
    this.life.fill(0);
    for (let i = 0; i < POOL_SIZE; i++) this.pos[i * 3 + 1] = -100;
  }
}
