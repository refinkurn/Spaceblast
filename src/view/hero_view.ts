import * as THREE from 'three';
import { DIR_DX, DIR_DY } from '../sim/constants';
import type { Player } from '../sim/state';
import { toWorld } from './coords';
import { GOD_SHIELD } from '../flow/dev';

/** Placeholder astronaut: a suit sphere, a glass helmet and a "nose" for facing. */
export class HeroView {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private bob = 0;
  private bubble = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }),
  );

  /** Bobbing arrow over this browser's own astronaut in online matches. */
  private marker = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.5, 4),
    new THREE.MeshBasicMaterial({ color: 0xffe14d }),
  );
  private markerTime = 0;

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
    this.bubble.position.y = 0.42;
    this.bubble.visible = false;
    this.marker.rotation.x = Math.PI; // point down at the astronaut
    this.marker.visible = false;
    this.group.add(this.body, this.bubble, this.marker);
  }

  /** Shows the "this is you" arrow. */
  setYou(on: boolean): void {
    this.marker.visible = on;
  }

  /** Places the hero between the previous and current tick (alpha in [0, 1]). */
  update(prev: { x: number; y: number }, p: Player, alpha: number, dt: number): void {
    this.group.visible = p.alive;
    // Shield after a hit or a respawn: blink. Oxygen Vest armor: a bubble while any is left.
    // (A huge shield is the dev god mode: no blinking.)
    this.body.visible = p.shield === 0 || p.shield > GOD_SHIELD / 2 || Math.floor(p.shield / 6) % 2 === 0;
    this.bubble.visible = p.armor > 0;
    if (this.marker.visible) {
      this.markerTime += dt;
      this.marker.position.y = 1.45 + Math.sin(this.markerTime * 4) * 0.1;
    }
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
