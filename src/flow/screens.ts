// Start screen and result banner (plain HTML overlays above the canvas).

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

import { Menu, type BotLevel } from './menu';
import { SpriteView } from '../view/sprite_renderer';
import { GOAL_ICONS } from './goal_icons';
import type { BannerExtra } from './summary';
import type { LevelCardText } from './story';
import { t } from '../utils/i18n';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export type MenuChoice = 'survival' | 'battle' | 'online';
export type { BotLevel };

export class Screens {
  private menu: Menu;
  private banner = $('banner');
  private primary = $<HTMLButtonElement>('banner-btn');
  private onPrimary = () => {};
  /** Replaces the menu action of the banner's second button for one banner. */
  private menuOverride: (() => void) | null = null;
  private sprite = new SpriteView($<HTMLCanvasElement>('banner-sprite'));
  private spriteRaf = 0;

  constructor(onMode: (mode: MenuChoice) => void, onMenu: () => void, onPause: () => void = onMenu) {
    this.menu = new Menu(() => onMode('battle'));
    $('mode-survival').addEventListener('click', () => onMode('survival'));
    $('mode-online').addEventListener('click', () => onMode('online'));
    this.primary.addEventListener('click', () => this.firePrimary());
    $('banner-menu').addEventListener('click', () => (this.menuOverride ?? onMenu)());
    $('menu-btn').addEventListener('click', onPause);
  }

  /** Difficulty for Battle vs Bot (remembered). */
  get botLevel(): BotLevel {
    return this.menu.botLevel;
  }

  /** Pause card -> Settings: the settings page over the game. */
  openSettingsOver(onBack: () => void): void {
    this.menu.openSettingsOver(onBack);
  }

  get menuOpen(): boolean {
    return this.menu.isOpen;
  }

  get bannerOpen(): boolean {
    return !this.banner.hidden;
  }

  get storyOpen(): boolean {
    return !$('story').hidden;
  }

  /** Full-screen story card; the game waits until the button is pressed. */
  showStory(kicker: string, title: string, text: string, button: string, onContinue: () => void): void {
    $('story-kicker').textContent = kicker;
    $('story-title').textContent = title;
    $('story-text').textContent = text;
    const btn = $<HTMLButtonElement>('story-btn');
    btn.setAttribute('aria-label', button);
    btn.title = button;
    btn.onclick = () => {
      $('story').hidden = true;
      onContinue();
    };
    $('story').hidden = false;
    btn.focus();
  }

  hideStory(): void {
    $('story').hidden = true;
  }

  /** Enter / Space on the story card continues. */
  pressStory(): void {
    if (this.storyOpen) $<HTMLButtonElement>('story-btn').click();
  }

  /** The compact level card: title, sector, goal row and Kit's line, up until it is tapped. */
  showLevelCard(card: LevelCardText): void {
    $('card-level').textContent = card.title;
    $('card-sector').textContent = card.sector;
    $('card-goal-icon').innerHTML = GOAL_ICONS[card.goal.icon];
    $('card-goal-text').textContent = card.goal.text;
    $('card-briefing').textContent = card.briefing;
    $('card-hint').textContent = window.matchMedia('(pointer: coarse)').matches ? t('card.tapStart') : t('card.clickStart');
    $('level-card').hidden = false;
  }

  hideLevelCard(): void {
    $('level-card').hidden = true;
  }

  showMenu(): void {
    this.hideBanner();
    this.hideLevelCard();
    $('story').hidden = true;
    this.menu.show();
  }

  hideMenu(): void {
    this.menu.hide();
  }

  /** The end-of-match card: big title, Bosco's pose, a summary and two buttons. `menuLabel` renames the second one (it always goes to the menu). */
  showBanner(title: string, text: string, button: string, onClick: () => void, menuLabel = t('banner.mainMenu'), tip = '', extra: BannerExtra = {}): void {
    $('banner-menu').textContent = menuLabel;
    this.menuOverride = extra.onMenu ?? null;
    $('banner-tip').textContent = tip ? `Tip: ${tip}` : '';
    $('banner-tip').hidden = !tip;
    $('banner-title').textContent = title;
    $('banner-text').textContent = text;
    const rows = extra.summary ?? [];
    const summary = $('banner-summary');
    // A long value (the score breakdown) gets a full-width row instead of wrapping in a narrow cell.
    summary.innerHTML = rows.map(([k, v]) => `<div${v.length > 22 ? ' class="wide"' : ''}><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    summary.hidden = rows.length === 0;
    this.sprite.show(extra.pose ? 'astropaw' : null, extra.pose ?? 'neutral');
    this.primary.querySelector('.go-label')!.textContent = button;
    this.onPrimary = onClick;
    this.banner.hidden = false;
    this.animate();
  }

  /** Draws Bosco's pose while the card is up. */
  private animate(): void {
    if (this.spriteRaf) return;
    const tick = () => {
      if (this.banner.hidden) { this.spriteRaf = 0; return; }
      this.sprite.draw();
      this.spriteRaf = requestAnimationFrame(tick);
    };
    this.spriteRaf = requestAnimationFrame(tick);
  }

  hideBanner(): void {
    this.banner.hidden = true;
  }

  /** Enter / Space on an open banner presses its main button. */
  pressPrimary(): void {
    if (this.bannerOpen) this.firePrimary();
  }

  /** The main button works once per banner: frantic taps can't skip rounds or levels. */
  private firePrimary(): void {
    const action = this.onPrimary;
    this.onPrimary = () => {};
    action();
  }
}
