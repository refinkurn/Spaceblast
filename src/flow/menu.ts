import MENU_ART from '../assets/menu/menu.json';
import { SpriteView } from '../view/sprite_renderer';
import { ALIEN_CARDS } from './alien_cards';
import { POWERUP_CARDS } from './powerup_cards';
import { CONTROL_WORDS } from './tutorial_script';

// The main menu: a column of choices on the left, Astropaw standing on the
// right. Versus (Battle vs Bot, Multiplayer) and Credits open in the same column;
// Settings (with How to Play) opens as a centred card over the menu, or over the
// paused game from the pause card. Back (pinned top-left), Escape or a tap
// outside the card returns. Arrow keys move between the choices; Enter,
// Space or a tap picks one.
// The look comes from src/assets/menu/menu.json: background image (the size
// that suits the screen), readability overlay, focal point, and whether a
// character sprite stands on the right (null when the background shows them).

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export type MenuPage = 'main' | 'versus' | 'bot' | 'settings' | 'howto' | 'credits';
export type BotLevel = 'easy' | 'normal' | 'hard';
const BOT_KEY = 'spaceblast.botLevel';
/** Taps ignored for this long after the menu changes page (keyboard presses still work). */
const SWITCH_GUARD_MS = 300;

interface MenuArt {
  background: { file: string; width: number }[];
  overlay?: string;
  focal_point?: { x: number; y: number };
  character?: string | null;
}

const ART_URLS = import.meta.glob<string>('../assets/menu/*.{png,jpg,webp}', { eager: true, query: '?url', import: 'default' });
const artUrl = (file: string) => ART_URLS[`../assets/menu/${file}`];

const PAGES: Record<MenuPage, string> = {
  main: 'menu-main',
  versus: 'menu-versus-page',
  bot: 'menu-bot',
  settings: 'settings',
  howto: 'menu-howto-page',
  credits: 'menu-credits-page',
};

/** Pages shown as a centred card over what is behind them (the main menu, or a paused game). */
export const CARD_PAGES: readonly MenuPage[] = ['settings', 'howto'];

/** Where Back goes from each sub-page, and which button to refocus there. */
export const BACK: Record<Exclude<MenuPage, 'main'>, { page: MenuPage; focus: string }> = {
  versus: { page: 'main', focus: 'menu-versus' },
  bot: { page: 'versus', focus: 'mode-battle' },
  settings: { page: 'main', focus: 'menu-settings' },
  howto: { page: 'settings', focus: 'menu-howto' },
  credits: { page: 'main', focus: 'menu-credits' },
};

export class Menu {
  page: MenuPage = 'main';
  /** Difficulty for Battle vs Bot (remembered). */
  botLevel: BotLevel = 'normal';
  private el = $('menu');
  private hero = new SpriteView($<HTMLCanvasElement>('menu-hero'));
  /** When the page last changed: a double tap must not also press a button on the new page. */
  private switchedAt = 0;
  /** When Settings was opened over a game (pause card): Back hides the menu and calls this. */
  private returnTo: (() => void) | null = null;

  /** `onBattle` starts a battle once a difficulty is picked. */
  constructor(onBattle: () => void) {
    try {
      const saved = localStorage.getItem(BOT_KEY);
      if (saved === 'easy' || saved === 'normal' || saved === 'hard') this.botLevel = saved;
    } catch { /* private mode */ }
    $('menu-versus').addEventListener('click', () => this.open('versus'));
    $('mode-battle').addEventListener('click', () => this.open('bot'));
    $('menu-settings').addEventListener('click', () => this.open('settings'));
    $('menu-howto').addEventListener('click', () => this.open('howto'));
    $('menu-credits').addEventListener('click', () => this.open('credits'));
    for (const b of this.el.querySelectorAll<HTMLButtonElement>('.menu-back')) b.addEventListener('click', () => this.back());
    for (const b of $('menu-bot').querySelectorAll<HTMLButtonElement>('[data-level]')) {
      b.addEventListener('click', () => {
        this.botLevel = b.dataset.level as BotLevel;
        try { localStorage.setItem(BOT_KEY, this.botLevel); } catch { /* private mode */ }
        onBattle();
      });
    }
    $('howto-body').innerHTML = howToPlay();
    this.applyArt(MENU_ART as MenuArt);
    this.el.addEventListener('click', (e) => {
      if (performance.now() - this.switchedAt < SWITCH_GUARD_MS && e.detail > 0) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, true);
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el && CARD_PAGES.includes(this.page)) this.back();
    });
    window.addEventListener('keydown', (e) => this.key(e));
    window.addEventListener('resize', () => this.drawHero());
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  /** Settings above the game; Back (or Escape) closes it and calls `onBack`. */
  openSettingsOver(onBack: () => void): void {
    this.returnTo = onBack;
    this.el.hidden = false;
    this.open('settings');
  }

  /** Shows the menu on its main page. */
  show(): void {
    this.returnTo = null;
    this.switchedAt = performance.now();
    this.el.hidden = false;
    this.open('main');
  }

  hide(): void {
    this.el.hidden = true;
    this.el.classList.remove('card', 'over');
  }

  open(page: MenuPage): void {
    if (page !== this.page || this.el.hidden) this.switchedAt = performance.now();
    this.page = page;
    // A card page keeps the main menu under it; over a game nothing is under it (the game shows through).
    const card = CARD_PAGES.includes(page);
    const under: MenuPage | null = card && !this.returnTo ? 'main' : null;
    for (const [p, id] of Object.entries(PAGES)) $(id).hidden = p !== page && p !== under;
    this.el.classList.toggle('sub', page !== 'main' && !card);
    this.el.classList.toggle('card', card);
    this.el.classList.toggle('over', this.returnTo !== null);
    if (page === 'bot') {
      for (const b of $('menu-bot').querySelectorAll('[data-level]')) {
        b.setAttribute('aria-current', String((b as HTMLElement).dataset.level === this.botLevel));
      }
    }
    // Back is first in every sub-page; start on the first real choice instead.
    const list = this.choices();
    const first = page === 'bot'
      ? $('menu-bot').querySelector<HTMLElement>(`[data-level="${this.botLevel}"]`)
      : (list.find((b) => !b.classList.contains('menu-back')) ?? list[0]);
    first?.focus();
    this.drawHero();
  }

  /** One step back: Battle vs Bot returns to Versus, How to Play to Settings, the rest to the main column. */
  back(): void {
    const from = this.page;
    if (from === 'main') return;
    if (from === 'settings' && this.returnTo) {
      const back = this.returnTo;
      this.returnTo = null;
      this.hide();
      back();
      return;
    }
    const step = BACK[from];
    this.open(step.page);
    $(step.focus).focus();
  }

  /** Background (smallest image that covers the screen), overlay, and the optional character. */
  private applyArt(art: MenuArt): void {
    const need = Math.max(window.screen.width, window.screen.height) * Math.min(2, window.devicePixelRatio || 1);
    const sizes = [...art.background].filter((b) => artUrl(b.file)).sort((a, b) => a.width - b.width);
    const bg = sizes.find((b) => b.width >= need) ?? sizes.at(-1);
    if (bg) {
      const layers = [art.overlay && artUrl(art.overlay), artUrl(bg.file)].filter(Boolean).map((u) => `url("${u}")`);
      const focal = art.focal_point ?? { x: 0.5, y: 0.5 };
      this.el.style.backgroundImage = layers.join(', ');
      this.el.style.backgroundSize = layers.length > 1 ? '100% 100%, cover' : 'cover';
      this.el.style.backgroundPosition = layers.length > 1 ? `0 0, ${focal.x * 100}% ${focal.y * 100}%` : `${focal.x * 100}% ${focal.y * 100}%`;
      this.el.style.backgroundRepeat = 'no-repeat';
      this.el.classList.add('art');
    }
    if (art.character) this.hero.show(art.character, 'neutral');
    else $('menu-hero').hidden = true;
  }

  private drawHero(): void {
    if (this.isOpen && this.hero.character) requestAnimationFrame(() => this.hero.draw());
  }

  /** The buttons and sliders of the open page, top to bottom (Back included: it is fixed, so offsetParent can't tell if it shows). */
  private choices(): HTMLElement[] {
    return [...$(PAGES[this.page]).querySelectorAll<HTMLElement>('button, input')].filter((b) => b.getClientRects().length > 0);
  }

  private key(e: KeyboardEvent): void {
    if (!this.isOpen || $('start-screen').offsetParent !== null) return;
    if (e.code === 'Escape' && this.page !== 'main') {
      this.back();
      return;
    }
    const up = e.code === 'ArrowUp' || e.code === 'KeyW';
    const down = e.code === 'ArrowDown' || e.code === 'KeyS';
    if (!up && !down) return;
    e.preventDefault();
    const list = this.choices();
    if (list.length === 0) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next = i < 0 ? 0 : (i + (down ? 1 : -1) + list.length) % list.length;
    list[next].focus();
  }
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** How to Play, built from the same text as the in-game cards. */
function howToPlay(): string {
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const words = touch ? CONTROL_WORDS.touch : CONTROL_WORDS.keyboard;
  const list = (items: { name: string; text: string }[]) =>
    `<ul>${items.map((i) => `<li><strong>${esc(i.name)}</strong>: ${esc(i.text)}</li>`).join('')}</ul>`;
  return [
    '<h3>Goal</h3>',
    '<p>Find the Warp Gate to escape each level. Break rocks, grab power-ups and keep away from the Martians.</p>',
    '<h3>Controls</h3>',
    `<p>Move with ${esc(words.MOVE)}. Drop a charge with ${esc(words.CHARGE)}. Step away before it explodes!</p>`,
    '<h3>Martians</h3>',
    list(Object.values(ALIEN_CARDS)),
    '<h3>Power-ups</h3>',
    list(Object.values(POWERUP_CARDS).filter((c) => !!c)),
    '<h3>Battle</h3>',
    '<p>Last astronaut standing wins the round. Near the end, the arena collapses from the edge inward.</p>',
  ].join('');
}
