import * as THREE from 'three';
import { DIR_DX, DIR_DY, GOD_SHIELD, TILE } from '../sim/constants';
import type { Player } from '../sim/state';
import { toWorld } from './coords';
import { GLIDE_SECONDS, GLIDE_SECONDS_YOU, SNAP_DISTANCE, glideFactor } from './smooth';
import { SpeedTrail, bubbleOpacity } from './speed_trail';
import { HeroAnimator } from './hero_anim';
import { DUCK_SUIT, FIGURE_SCALE, buildAstronaut, setHead, type AstronautParts, type HeadKind } from './astronaut_mesh';

/** One astronaut: the low-poly figure (astronaut_mesh.ts) plus facing, bob, shield blink, vest bubble and effects. */
export class HeroView {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private target = new THREE.Vector3();
  /** The drawn position has been set since the hero (re)appeared, so it may glide from there. */
  private placed = false;
  /** Online: glide towards the sim position instead of drawing it exactly (see view/smooth.ts). */
  smooth = false;
  private bob = 0;
  /** Oxygen Vest bubble: pale cyan, pulses, a little brighter with each armor point (up to 3). */
  private bubbleMaterial = new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.4, depthWrite: false });
  private bubble = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), this.bubbleMaterial);
  private pulse = 0;
  /** Speed Boost trail (view only). Off at reduced quality. */
  private trail = new SpeedTrail();
  reduced = false;

  /** Bobbing arrow over this browser's own astronaut in online matches. */
  private marker = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.5, 4),
    new THREE.MeshBasicMaterial({ color: 0xffe14d }),
  );
  private markerTime = 0;
  /** Seconds into the victory dance, 0 when not celebrating. */
  private cheering = 0;
  private figure: AstronautParts;
  private head: HeadKind = 'corgi';
  private baseColor: number;
  /** Breathing, run lean, charge squash, hurt shake + flash (view/hero_anim.ts). */
  readonly anim = new HeroAnimator();
  /** The squash/lean/shake pivot inside the body, so they don't fight the walk bob and facing. */
  private pose = new THREE.Group();

  constructor(color = 0x3a7bff) {
    this.baseColor = color;
    this.figure = buildAstronaut(color, 'corgi');
    this.figure.root.scale.setScalar(FIGURE_SCALE);
    this.pose.add(this.figure.root);
    this.body.add(this.pose);
    this.body.rotation.order = 'YXZ'; // face first, then lean
    this.bubble.position.y = 0.42;
    this.bubble.visible = false;
    this.marker.rotation.x = Math.PI; // point down at the astronaut
    this.marker.visible = false;
    this.group.add(this.body, this.bubble, this.marker, this.trail.group);
  }

  /** Suit colour (online players pick theirs). */
  setColor(color: number): void {
    this.baseColor = color;
    this.figure.suit.color.setHex(this.head === 'duck' ? DUCK_SUIT : color);
  }

  /** Bosco's corgi head (default) or Ducking's duck head and dark violet suit (level 20 rival). */
  setHead(kind: HeadKind): void {
    if (kind === this.head) return;
    this.head = kind;
    setHead(this.figure.head, kind);
    this.setColor(this.baseColor);
  }

  /** Victory dance for the round-end cinematic: hops and spins. */
  celebrate(on: boolean): void {
    this.cheering = on ? 0.001 : 0;
    if (!on) this.body.rotation.z = 0;
  }

  /** A new map: the next update draws the hero exactly where it is, without gliding from the old map. */
  resetGlide(): void {
    this.placed = false;
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
    if (this.bubble.visible) {
      this.pulse += dt;
      this.bubble.scale.setScalar(1 + 0.04 * Math.sin(this.pulse * 3));
      this.bubbleMaterial.opacity = bubbleOpacity(p.armor) + 0.05 * Math.sin(this.pulse * 3);
    }
    if (this.marker.visible) {
      this.markerTime += dt;
      this.marker.position.y = 1.45 + Math.sin(this.markerTime * 4) * 0.1;
    }
    toWorld(prev.x, prev.y, 0, this.from);
    toWorld(p.x, p.y, 0, this.to);
    this.target.lerpVectors(this.from, this.to, alpha);
    // Online ticks arrive unevenly: glide the drawn position (view/smooth.ts). Offline ticks are even: exact.
    if (!this.smooth || !this.placed || !p.alive || this.target.distanceTo(this.group.position) > SNAP_DISTANCE) {
      this.group.position.copy(this.target);
    } else {
      this.group.position.lerp(this.target, glideFactor(dt, this.marker.visible ? GLIDE_SECONDS_YOU : GLIDE_SECONDS));
    }
    this.placed = p.alive;

    const yaw = Math.atan2(-DIR_DX[p.facing], -DIR_DY[p.facing]);
    const k = 1 - Math.exp(-18 * dt);
    const diff = Math.atan2(Math.sin(yaw - this.body.rotation.y), Math.cos(yaw - this.body.rotation.y));
    this.body.rotation.y += diff * k;

    const moving = prev.x !== p.x || prev.y !== p.y;
    this.trail.update(dt, this.group.position, this.cheering === 0 && moving && p.boots > 0 && !this.reduced, p.boots);
    this.anim.celebrating = this.cheering > 0;
    const tiles = moving ? (Math.hypot(p.x - prev.x, p.y - prev.y) / TILE) * 60 : 0;
    const a = this.anim.step(dt, moving && this.cheering === 0, tiles);
    this.pose.scale.set(a.scaleXZ, a.scaleY, a.scaleXZ);
    this.pose.rotation.x = -a.lean + a.tilt; // the nose is at -z: forward is -z
    this.pose.position.set(a.shake, a.rise, 0);
    this.figure.suit.emissive.setScalar(a.flash * 0.8);
    this.figure.packLight.visible = !this.reduced;
    const f = this.figure;
    f.legL.rotation.x = a.legL;
    f.legR.rotation.x = a.legR;
    f.armL.rotation.x = a.armL;
    f.armR.rotation.x = a.armR;
    if (this.cheering > 0) {
      this.cheering += dt;
      this.body.position.y = Math.abs(Math.sin(this.cheering * 6)) * 0.45;
      this.body.rotation.y += dt * 7;
      return;
    }
    this.bob = moving ? this.bob + dt * 14 : 0;
    this.body.position.y += (Math.abs(Math.sin(this.bob)) * 0.06 - this.body.position.y) * k;
  }
}
