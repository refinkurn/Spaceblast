import * as THREE from 'three';
import { TILE } from '../sim/constants';
import type { GameState } from '../sim/state';
import type { GameView } from '../view/game_view';

// Story cutscenes: black letterbox bars, the camera gliding between the hero,
// the boss or the rival, and dialogue typed out line by line. A "reveal" line
// slams a huge caption across the screen. Tap (or Enter) shows the whole line,
// then moves on; Skip ends the scene. The game waits while a scene plays.

const $ = (id: string) => document.getElementById(id) as HTMLElement;

export type Focus = 'hero' | 'boss' | 'rival' | 'arena';

export interface Shot {
  focus: Focus;
  /** Camera distance (1 = normal view, smaller = closer). */
  zoom?: number;
  speaker?: string;
  /** Speaker name colour (CSS). */
  color?: string;
  text: string;
  /** A huge caption across the screen (e.g. "TURNS OUT THE BOSS IS HUMAN!"). */
  reveal?: string;
  shake?: boolean;
  /** Fade in from black (the first shot of a scene). */
  fade?: boolean;
  /** Burst of debris at the focus (e.g. the boss exploding). */
  boom?: number;
}

/** Characters per second for the typewriter. */
const TYPE_SPEED = 45;

export class Cutscene {
  private shots: Shot[] = [];
  private index = -1;
  private typed = 0;
  private state!: GameState;
  private done: () => void = () => {};
  private el = $('cutscene');
  private speakerEl = $('cut-speaker');
  private textEl = $('cut-text');
  private revealEl = $('cut-reveal');
  private fadeEl = $('cut-fade');

  constructor(private view: GameView) {
    $('cut-skip').addEventListener('click', (e) => {
      e.stopPropagation();
      this.finish();
    });
    this.el.addEventListener('click', () => this.advance());
  }

  get active(): boolean {
    return this.index >= 0;
  }

  play(shots: Shot[], state: GameState, done: () => void): void {
    if (shots.length === 0) {
      done();
      return;
    }
    this.shots = shots;
    this.state = state;
    this.done = done;
    this.index = -1;
    this.el.hidden = false;
    this.el.classList.remove('in');
    void this.el.offsetWidth;
    this.el.classList.add('in');
    this.next();
  }

  /** Tap / Enter: finish typing the line, or go to the next one. */
  advance(): void {
    if (!this.active) return;
    const text = this.shots[this.index].text;
    if (this.typed < text.length) this.typed = text.length;
    else this.next();
  }

  update(dt: number): void {
    if (!this.active) return;
    const text = this.shots[this.index].text;
    if (this.typed < text.length) this.typed = Math.min(text.length, this.typed + dt * TYPE_SPEED);
    const shown = text.slice(0, Math.floor(this.typed));
    if (this.textEl.textContent !== shown) this.textEl.textContent = shown;
    this.el.classList.toggle('ready', this.typed >= text.length);
  }

  private next(): void {
    this.index++;
    if (this.index >= this.shots.length) {
      this.finish();
      return;
    }
    const shot = this.shots[this.index];
    this.typed = 0;
    this.textEl.textContent = '';
    this.speakerEl.textContent = shot.speaker ?? '';
    this.speakerEl.style.color = shot.color ?? '';
    const point = this.pointOf(shot.focus);
    this.view.rig.focus(point, shot.zoom ?? 0.55);
    if (shot.shake) this.view.rig.shake(0.5);
    if (shot.fade) {
      this.fadeEl.classList.remove('go');
      void this.fadeEl.offsetWidth;
      this.fadeEl.classList.add('go');
    }
    if (shot.boom && point) {
      const tx = Math.round(point.x + (this.state.grid.w - 1) / 2), ty = Math.round(point.z + (this.state.grid.h - 1) / 2);
      this.view.debris.burst(tx, ty, shot.boom, 40);
    }
    this.revealEl.hidden = !shot.reveal;
    if (shot.reveal) {
      this.revealEl.textContent = shot.reveal;
      this.revealEl.classList.remove('slam');
      void this.revealEl.offsetWidth;
      this.revealEl.classList.add('slam');
    }
  }

  private pointOf(focus: Focus): THREE.Vector3 | null {
    const s = this.state;
    if (focus === 'boss' && s.boss) return this.view.worldOf((s.boss.tile % s.grid.w) * TILE, Math.floor(s.boss.tile / s.grid.w) * TILE);
    const p = focus === 'hero' ? s.players[0] : focus === 'rival' ? s.players[1] : null;
    if (p) return this.view.worldOf(p.x, p.y);
    return null; // the whole arena
  }

  /** Ends the scene without its follow-up (leaving to the menu). */
  cancel(): void {
    this.done = () => {};
    this.finish();
  }

  private finish(): void {
    if (!this.active) return;
    this.index = -1;
    this.el.hidden = true;
    this.revealEl.hidden = true;
    this.view.rig.focus(null);
    this.done();
  }
}
