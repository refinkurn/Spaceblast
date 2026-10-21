import * as THREE from 'three';
import { TILE } from '../sim/constants';
import type { Player } from '../sim/state';
import { tileToWorld } from './coords';

// A soft square on the floor under the local player's tile (docs/design/radio-juice.md, part 3).
// It snaps to the tile the sim counts as the player's (round(x / TILE)), not the smooth
// in-between position, with a short slide between cells. Not a child of the hero, which glides.

/** Rounded square with a soft glowing edge, drawn once and tinted per player. */
function texture(): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.shadowColor = '#fff';
  g.shadowBlur = 8;
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.strokeStyle = '#fff';
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(8, 8, size - 16, size - 16, 10);
  g.fill();
  g.stroke();
  return new THREE.CanvasTexture(c);
}

export class TileHighlight {
  readonly mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private target = new THREE.Vector3();
  private placed = false;

  constructor() {
    this.material = new THREE.MeshBasicMaterial({ map: texture(), transparent: true, opacity: 0.45, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95).rotateX(-Math.PI / 2), this.material);
    this.mesh.renderOrder = 1; // above the floor, no flicker against it
    this.mesh.visible = false;
  }

  setColor(color: number): void {
    this.material.color.setHex(color);
  }

  /** Every frame; `p` is the local player (null: nobody to mark). */
  update(p: Player | null, dt: number): void {
    if (!p || !p.alive) {
      this.mesh.visible = false;
      this.placed = false;
      return;
    }
    tileToWorld(Math.round(p.x / TILE), Math.round(p.y / TILE), 0.03, this.target);
    // ~60 ms slide from cell to cell; the first frame snaps.
    if (this.placed) this.mesh.position.lerp(this.target, 1 - Math.exp(-dt / 0.02));
    else this.mesh.position.copy(this.target);
    this.placed = true;
    this.mesh.visible = true;
  }
}
