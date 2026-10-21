import { bossWaveCount } from '../sim/boss';
import type { GameState, SimEvent } from '../sim/state';
import { SpriteView } from '../view/sprite_renderer';
import { RADIO, RADIO_POWERUP, type RadioLine } from './radio_lines';
import './radio_toast.css';
import { t } from '../utils/i18n';

// Captain Kit's radio toasts in Story Mode (docs/design/radio-juice.md): a
// one-line pill in the alert lane under the HUD. One at a time, a queue of at
// most 3 (an older copy of the same line is dropped), 3 s each. It never pauses
// the game and never takes input, and it waits while an alert, the boss
// announcement or a tutorial tip is up.

/** How long a toast stays (slide in and out are extra). */
export const SHOW_MS = 3000;
const SLIDE_MS = 250;
export const QUEUE_MAX = 3;

/** The waiting lines: newest last, at most QUEUE_MAX, no duplicates (the older copy goes). */
export class ToastQueue {
  readonly items: RadioLine[] = [];

  push(line: RadioLine): void {
    const dup = this.items.findIndex((l) => l.key === line.key);
    if (dup >= 0) this.items.splice(dup, 1);
    this.items.push(line);
    while (this.items.length > QUEUE_MAX) this.items.shift();
  }

  next(): RadioLine | undefined {
    return this.items.shift();
  }

  clear(): void {
    this.items.length = 0;
  }
}

/** Which toast, if any, a sim event earns (pure). `seenCard(item)`: that power-up's intro card was already shown. */
export function toastFor(e: SimEvent, state: GameState, local: number, seenCard: (item: number) => boolean): RadioLine | null {
  switch (e.type) {
    case 'gate_opened':
      return state.boss || state.rival ? null : RADIO.gateOpen;
    case 'player_died':
      return e.id === local && state.players[local]?.lives === 1 ? RADIO.lastHeart : null;
    case 'armor_hit':
      return e.id === local ? RADIO.vestHit : null;
    case 'boss_wave':
      return state.boss && e.wave === bossWaveCount(state.boss) ? RADIO.lastWave : null;
    case 'item_picked':
      return e.id === local && seenCard(e.item) ? RADIO_POWERUP[e.item as keyof typeof RADIO_POWERUP] ?? null : null;
    default:
      return null;
  }
}

export class RadioToasts {
  private el = document.getElementById('radio-toast') as HTMLElement;
  private text = document.getElementById('radio-text') as HTMLElement;
  private portrait = new SpriteView(document.getElementById('radio-portrait') as HTMLCanvasElement, 'portrait');
  private queue = new ToastQueue();
  /** Lines already said this level (each trigger once per level). */
  private said = new Set<string>();
  private showing: RadioLine | null = null;
  private until = 0;

  /** A new level: nothing queued, every line may be said again. */
  reset(): void {
    this.queue.clear();
    this.said.clear();
    this.stop();
  }

  /** Story events (call before story.event, so a power-up's first pick-up still gets its card and no toast). */
  event(e: SimEvent, state: GameState, seenCard: (item: number) => boolean): void {
    const line = toastFor(e, state, 0, seenCard);
    if (!line || this.said.has(line.key)) return;
    // Every absorbed hit gets its line; the other triggers speak once per level.
    if (line !== RADIO.vestHit) this.said.add(line.key);
    this.queue.push(line);
  }

  /** Every frame. `blocked`: something else owns the lane or the moment (alert, announcement, tip, cutscene, card, pause, countdown). */
  update(now: number, blocked: boolean): void {
    if (this.showing) {
      this.portrait.draw(now); // the atlas may still be loading on the first frame
      if (now >= this.until + SLIDE_MS) this.stop();
      else if (now >= this.until) this.el.classList.remove('in');
      else if (blocked) {
        // An alert took the lane: this line gets its turn again afterwards.
        this.queue.items.unshift(this.showing);
        this.queue.items.length = Math.min(this.queue.items.length, QUEUE_MAX);
        this.stop();
      }
      return;
    }
    if (blocked) return;
    const line = this.queue.next();
    if (!line) return;
    this.showing = line;
    this.until = now + SLIDE_MS + SHOW_MS;
    this.text.textContent = t(line.key);
    this.portrait.show('captain-kit', line.danger ? 'worried' : 'neutral');
    this.portrait.draw(now);
    this.el.hidden = false;
    void this.el.offsetWidth;
    this.el.classList.add('in');
  }

  private stop(): void {
    this.showing = null;
    this.el.classList.remove('in');
    this.el.hidden = true;
  }
}
