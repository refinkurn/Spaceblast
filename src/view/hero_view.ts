import * as THREE from 'three';
import { DIR_DX, DIR_DY } from '../sim/constants';
import type { Player } from '../sim/state';
import { toWorld } from './coords';

/** Placeholder astronaut: a suit sphere, a glass helmet and a "nose" for facing. */
export class HeroView {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private bob = 0;

  constructor(color = 0x3a7bff) {
    const suit = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 24, 16),
      new THREE.MeshLambertMaterial({ color }),
    );
    suit.position.y = 0.34;
    suit.castShadow = true;
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 24, 16),
      new THREE.MeshPhongMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.55, shininess: 90 }),
    );
    helmet.position.set(0, 0.7, 0);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    nose.position.set(0, 0.42, -0.32);
    this.body.add(suit, helmet, nose);
    this.group.add(this.body);
  }

  /** Places the hero between the previous and current tick (alpha in [0, 1]). */
  update(prev: { x: number; y: number }, p: Player, alpha: number, dt: number): void {
    toWorld(prev.x, prev.y, 0, this.from);
    toWorld(p.x, p.y, 0, this.to);
    this.group.position.lerpVectors(this.from, this.to, alpha);

    const yaw = Math.atan2(-DIR_DX[p.facing], -DIR_DY[p.facing]);
    const k = 1 - Math.exp(-18 * dt);
    const diff = Math.atan2(Math.sin(yaw - this.body.rotation.y), Math.cos(yaw - this.body.rotation.y));
    this.body.rotation.y += diff * k;

    const moving = prev.x !== p.x || prev.y !== p.y;
    this.bob = moving ? this.bob + dt * 14 : 0;
    this.body.position.y += (Math.abs(Math.sin(this.bob)) * 0.06 - this.body.position.y) * k;
  }
}
