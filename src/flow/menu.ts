import MENU_ART from '../assets/menu/menu.json';
import { SpriteView } from '../view/sprite_renderer';
import { ALIEN_CARDS } from './alien_cards';
import { POWERUP_CARDS } from './powerup_cards';
import { CONTROL_WORDS } from './tutorial_script';

// The main menu: a column of choices on the left, Astropaw standing on the
// right. Battle vs Bot, Settings, How to Play and Credits open in the same
// column (Back or Escape returns). Arrow keys move between the choices; Enter,
// Space or a tap picks one.
// The look comes from src/assets/menu/menu.json: background image (the size
// that suits the screen), readability overlay, focal point, and whether a
// character sprite stands on the right (null when the background shows them).

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export type MenuPage = 'main' | 'bot' | 'settings' | 'howto' | 'credits';
export type BotLevel = 'easy' | 'normal' | 'hard';
const BOT_KEY = 'spaceblast.botLevel';

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
  bot: 'menu-bot',
  settings: 'settings',
  howto: 'menu-howto-page',
  credits: 'menu-credits-page',
};

export class Menu {
  page: MenuPage = 'main';
  /** Difficulty for Battle vs Bot (remembered). */
  botLevel: BotLevel = 'normal';
  private el = $('menu');
  private hero = new SpriteView($<HTMLCanvasElement>('menu-hero'));

  /** `onBattle` starts a battle once a difficulty is picked. */
  constructor(onBattle: () => void) {
    try {
      const saved = localStorage.getItem(BOT_KEY);
      if (saved === 'easy' || saved === 'normal' || saved === 'hard') this.botLevel = saved;
    } catch { /* private mode */ }
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
    window.addEventListener('keydown', (e) => this.key(e));
    window.addEventListener('resize', () => this.drawHero());
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  /** Shows the menu on its main page. */
  show(): void {
    this.el.hidden = false;
    this.open('main');
  }

  hide(): void {
    this.el.hidden = true;
  }

  open(page: MenuPage): void {
    this.page = page;
    for (const [p, id] of Object.entries(PAGES)) $(id).hidden = p !== page;
    this.el.classList.toggle('sub', page !== 'main');
    if (page === 'bot') {
      for (const b of $('menu-bot').querySelectorAll('[data-level]')) {
        b.setAttribute('aria-current', String((b as HTMLElement).dataset.level === this.botLevel));
      }
    }
    const first = page === 'bot' ? $('menu-bot').querySelector<HTMLElement>(`[data-level="${this.botLevel}"]`) : this.choices()[0];
    first?.focus();
    this.drawHero();
  }

  /** Back to the main column (from a submenu). */
  back(): void {
    const from = this.page;
    this.open('main');
    const to = { bot: 'mode-battle', settings: 'menu-settings', howto: 'menu-howto', credits: 'menu-credits' }[from as Exclude<MenuPage, 'main'>];
    if (to) $(to).focus();
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

  /** The buttons and sliders of the open page, top to bottom. */
  private choices(): HTMLElement[] {
    return [...$(PAGES[this.page]).querySelectorAll<HTMLElement>('button, input')].filter((b) => b.offsetParent !== null);
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
