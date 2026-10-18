import { TILE } from '../sim/constants';
import type { GameState } from '../sim/state';
import type { GameView } from '../view/game_view';
import type { Shot } from './cutscene';

// Pokédex-style intro cards: the first time a kind of Martian shows up or a
// power-up is picked up in Story Mode, Captain Kit explains it. A card is one
// cutscene shot (camera focus, shake, boom...) shown as a pop-up; the game
// waits until it is tapped. Cards queue up if several come at once.
// The text lives in alien_cards.ts and powerup_cards.ts.

const $ = (id: string) => document.getElementById(id) as HTMLElement;

/** What a card can show besides its shot; each part is left out if missing. */
export interface CardParts {
  name?: string;
  /** Inline SVG. */
  icon?: string;
  /** "Beware" or "How to use". */
  label?: string;
  hint?: string;
}

export interface IntroCard extends Shot, CardParts {
  /** Saved once seen, so the card never shows again on this save. */
  id: string;
  name: string;
  icon: string;
}

export interface CardOptions {
  /** For focus 'martian': which kind to look at. */
  kind?: number;
  /** Runs when the card is closed. */
  done?: () => void;
  /** Shows a Skip button, which runs this instead of `done`. */
  skip?: () => void;
}

/** A simple Martian silhouette in the given colour (until the real art is in). */
export function martianIcon(color: string): string {
  return `<svg viewBox="0 0 48 48" class="intro-martian"><path fill="${color}" d="M6 42C6 22 13 8 24 8s18 14 18 34c-3-3-6-3-9 0-3-3-6-3-9 0-3-3-6-3-9 0-3-3-6-3-9 0z"/>` +
    '<circle cx="18" cy="24" r="5" fill="#fff"/><circle cx="30" cy="24" r="5" fill="#fff"/><circle cx="19" cy="25" r="2.4" fill="#111"/><circle cx="31" cy="25" r="2.4" fill="#111"/></svg>';
}

interface Queued extends CardOptions {
  card: Shot & CardParts;
}

export class IntroCards {
  private queue: Queued[] = [];
  private current: Queued | null = null;
  private state!: GameState;
  private el = $('intro-card');

  constructor(private view: GameView) {
    this.el.addEventListener('click', () => this.close());
    $('intro-skip').addEventListener('click', (e) => {
      e.stopPropagation();
      this.close(true);
    });
  }

  get active(): boolean {
    return this.current !== null;
  }

  show(card: Shot & CardParts, state: GameState, opts: CardOptions = {}): void {
    this.state = state;
    this.queue.push({ card, ...opts });
    if (!this.current) this.next();
  }

  /** Tap / Enter (or Skip): the next card, or back to the game. */
  close(skipped = false): void {
    const q = this.current;
    if (!q) return;
    this.current = null;
    this.next();
    (skipped && q.skip ? q.skip : q.done)?.();
  }

  /** Leaving the level: drop every card. */
  cancel(): void {
    this.queue = [];
    if (!this.current) return;
    this.current = null;
    this.hide();
  }

  private next(): void {
    const q = this.queue.shift();
    if (!q) {
      this.hide();
      return;
    }
    this.current = q;
    const { card } = q;
    $('intro-icon').innerHTML = card.icon ?? '';
    $('intro-name').textContent = card.name ?? '';
    $('intro-text').textContent = `“${card.text}”`;
    const speaker = $('intro-speaker');
    speaker.textContent = card.speaker ? `— ${card.speaker}` : '';
    speaker.style.color = card.color ?? '';
    $('intro-label').textContent = card.label ? `${card.label}:` : '';
    $('intro-hint').textContent = card.hint ?? '';
    $('intro-skip').hidden = !q.skip;
    $('intro-tap').textContent = window.matchMedia('(pointer: coarse)').matches ? 'Tap to continue' : 'Click to continue';
    this.el.hidden = false;
    this.el.classList.toggle('fade', !!card.fade);
    this.el.classList.remove('pop');
    void this.el.offsetWidth;
    this.el.classList.add('pop');
    const point = this.pointOf(q);
    this.view.rig.focus(point, card.zoom ?? 0.55);
    if (card.shake) this.view.rig.shake(0.5);
    if (card.boom && point) {
      const s = this.state;
      const tx = Math.round(point.x + (s.grid.w - 1) / 2), ty = Math.round(point.z + (s.grid.h - 1) / 2);
      this.view.debris.burst(tx, ty, card.boom, 40);
    }
  }

  private hide(): void {
    this.el.hidden = true;
    this.view.rig.focus(null);
  }

  private pointOf(q: Queued) {
    const s = this.state;
    const focus = q.card.focus;
    if (focus === 'martian') {
      const m = s.martians.find((m) => m.alive && m.kind === q.kind);
      return m ? this.view.worldOf(m.x, m.y) : null;
    }
    if (focus === 'boss' && s.boss) return this.view.worldOf((s.boss.tile % s.grid.w) * TILE, Math.floor(s.boss.tile / s.grid.w) * TILE);
    const p = focus === 'hero' ? s.players[0] : focus === 'rival' ? s.players[1] : null;
    return p ? this.view.worldOf(p.x, p.y) : null;
  }
}
