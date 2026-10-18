import { BossKind } from '../sim/constants';
import type { GameState } from '../sim/state';
import { preload } from '../view/sprite_loader';
import { SpriteView } from '../view/sprite_renderer';

// Story cutscenes, 2D pop-up style (think Ace Attorney): one character stands
// on the left, the dialogue box sits at the bottom with the speaker's name and
// portrait, and lines type out letter by letter. Tap, Enter or Space shows the
// whole line, then moves on; Skip (top right) ends the scene. A "reveal" line
// slams a huge caption across the screen. The game waits while a scene plays.

const $ = (id: string) => document.getElementById(id) as HTMLElement;

/**
 * Who a narrated shot (no speaker) shows: the boss or the rival; 'hero' and
 * 'arena' show nobody. 'martian' is for the alien cards.
 */
export type Focus = 'hero' | 'boss' | 'rival' | 'arena' | 'martian';

export interface Shot {
  focus: Focus;
  /** Camera distance for the 3D cards (1 = normal view, smaller = closer). */
  zoom?: number;
  speaker?: string;
  /** Speaker name colour (CSS). */
  color?: string;
  /** Character sprite id (src/assets/characters/<id>); set by KIT, PILOT, YOU. */
  character?: string;
  /** The character's pose (default "neutral"); any name the sprite sheet has. */
  pose?: string;
  text: string;
  /** A huge caption across the screen (e.g. "TURNS OUT THE BOSS IS HUMAN!"). */
  reveal?: string;
  shake?: boolean;
  /** Fade in from black (the first shot of a scene). */
  fade?: boolean;
  /** A bigger impact (e.g. the boss exploding); the colour tints the flash. */
  boom?: number;
}

/** Scene sounds (see audio/sfx.ts). */
export type SceneCue = 'open' | 'pose' | 'reveal' | 'boom';

const BOSS_SPRITES: Record<number, string> = {
  [BossKind.GooplingHive]: 'goopling-hive',
  [BossKind.DarknessHive]: 'darkness-hive',
  [BossKind.MazeMaster]: 'maze-master',
};

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
  private sprite = new SpriteView($('cut-sprite') as HTMLCanvasElement);
  private portrait = new SpriteView($('cut-portrait') as HTMLCanvasElement);

  constructor(private sound: (cue: SceneCue) => void = () => {}) {
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
    // Only this scene's characters are loaded.
    preload(shots.map((s) => this.characterOf(s)).filter((c): c is string => !!c));
    this.sprite.show(null);
    this.portrait.show(null);
    this.el.hidden = false;
    this.el.classList.remove('in');
    void this.el.offsetWidth;
    this.el.classList.add('in');
    this.sound('open');
    this.next();
  }

  /** Tap / Enter / Space: finish typing the line, or go to the next one. */
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
    const now = performance.now();
    this.sprite.draw(now);
    this.portrait.draw(now);
  }

  /** The character a shot shows: its speaker, or the boss / rival it narrates. */
  private characterOf(shot: Shot): string | null {
    if (shot.character) return shot.character;
    if (shot.speaker) return null;
    if (shot.focus === 'boss') return this.state.boss ? BOSS_SPRITES[this.state.boss.kind] ?? null : null;
    if (shot.focus === 'rival') return 'renegade-pilot';
    return null;
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
    this.el.classList.toggle('narration', !shot.speaker);

    const who = this.characterOf(shot);
    const pose = shot.pose ?? 'neutral';
    const changed = who !== this.sprite.character;
    const posed = !changed && who !== null && pose !== this.shots[this.index - 1]?.pose;
    this.sprite.show(who, pose);
    this.portrait.show(shot.speaker ? who : null, pose);
    this.el.classList.toggle('alone', !who);
    if (changed && who) this.restart('enter');
    else if (posed) this.restart('bump');
    if (changed || posed) this.sound('pose');

    if (shot.shake) this.restart('shake');
    if (shot.fade) {
      this.fadeEl.classList.remove('go');
      void this.fadeEl.offsetWidth;
      this.fadeEl.classList.add('go');
    }
    if (shot.boom) {
      this.el.style.setProperty('--boom', `#${shot.boom.toString(16).padStart(6, '0')}`);
      this.restart('flash');
    }
    this.revealEl.hidden = !shot.reveal;
    if (shot.reveal) {
      this.revealEl.textContent = shot.reveal;
      this.revealEl.classList.remove('slam');
      void this.revealEl.offsetWidth;
      this.revealEl.classList.add('slam');
    }
    if (shot.boom) this.sound('boom');
    else if (shot.reveal) this.sound('reveal');
  }

  /** Replays a one-shot CSS animation class on the scene. */
  private restart(cls: 'enter' | 'bump' | 'shake' | 'flash'): void {
    this.el.classList.remove(cls);
    void this.el.offsetWidth;
    this.el.classList.add(cls);
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
    this.el.classList.remove('enter', 'bump', 'shake', 'flash');
    this.done();
  }
}
