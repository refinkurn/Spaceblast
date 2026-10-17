// Developer level select: jump to any Story level with optional cheats.
// Unlocked by opening the page with #dev in the URL, by tapping the menu title
// 5 times, or automatically in `npm run dev`. Cheats touch the sim from outside,
// so they are for testing only and never part of a real game.

import { LEVEL_COUNT, levelSpec } from '../sim/levels';
import { BossKind } from '../sim/constants';

export interface DevOptions {
  /** Hero can't be hurt. */
  god: boolean;
  /** Start with Beam Range, Extra Charge and Speed Boost at 5. */
  maxPower: boolean;
  /** Show the sector story card when jumping to levels 1, 6, 11, 16. */
  story: boolean;
}

/** Shield value used for god mode; the hero view doesn't blink above GOD_SHIELD / 2. */
export const GOD_SHIELD = 1_000_000_000;

const KEY = 'spaceblast.dev';

function load(): { unlocked: boolean; opts: DevOptions } {
  const fallback = { unlocked: false, opts: { god: false, maxPower: false, story: false } };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export class DevPanel {
  readonly opts: DevOptions;
  private unlocked: boolean;
  private panel = document.createElement('div');
  private toggle = document.createElement('button');

  constructor(private onLevel: (level: number) => void) {
    const saved = load();
    this.opts = saved.opts;
    this.unlocked = saved.unlocked || import.meta.env.DEV || location.hash === '#dev';
    this.build();
    window.addEventListener('hashchange', () => location.hash === '#dev' && this.unlock());
    let taps = 0;
    let last = 0;
    document.querySelector('#menu h1')?.addEventListener('click', () => {
      const now = performance.now();
      taps = now - last < 600 ? taps + 1 : 1;
      last = now;
      if (taps >= 5) this.unlock();
    });
  }

  private unlock(): void {
    this.unlocked = true;
    this.save();
    this.toggle.hidden = false;
    this.panel.hidden = false;
  }

  private save(): void {
    try { localStorage.setItem(KEY, JSON.stringify({ unlocked: this.unlocked, opts: this.opts })); } catch { /* private mode */ }
  }

  private build(): void {
    const menu = document.getElementById('menu')!;
    this.toggle.id = 'dev-toggle';
    this.toggle.type = 'button';
    this.toggle.textContent = 'Dev: levels';
    this.toggle.hidden = !this.unlocked;
    this.toggle.addEventListener('click', () => (this.panel.hidden = !this.panel.hidden));

    this.panel.id = 'dev-panel';
    this.panel.hidden = true;
    const grid = document.createElement('div');
    grid.className = 'dev-levels';
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      const spec = levelSpec(n);
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(n);
      if (spec.boss !== BossKind.None) { b.classList.add('boss'); b.title = 'Boss'; }
      if (spec.rival) { b.classList.add('duel'); b.title = 'Rival duel'; }
      b.addEventListener('click', () => this.onLevel(n));
      grid.append(b);
    }
    const toggles = document.createElement('div');
    toggles.className = 'dev-toggles';
    const labels: [keyof DevOptions, string][] = [['god', 'God mode'], ['maxPower', 'Max power-ups'], ['story', 'Story cards']];
    for (const [key, text] of labels) {
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = this.opts[key];
      box.addEventListener('change', () => { this.opts[key] = box.checked; this.save(); });
      label.append(box, ' ', text);
      toggles.append(label);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'dev-close';
    close.textContent = 'Close';
    close.addEventListener('click', () => (this.panel.hidden = true));
    const head = document.createElement('div');
    head.className = 'dev-head';
    head.innerHTML = '<strong>Developer level select</strong><span>S1: 1–5 · S2: 6–10 · S3: 11–15 · S4: 16–20 · red = boss · gold = duel</span>';
    this.panel.append(head, grid, toggles, close);
    menu.append(this.toggle, this.panel);
  }

  hide(): void {
    this.panel.hidden = true;
  }
}
