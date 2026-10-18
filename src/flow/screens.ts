// Start screen and result banner (plain HTML overlays above the canvas).

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

import { Menu, type BotLevel } from './menu';

export type MenuChoice = 'survival' | 'battle' | 'online';
export type { BotLevel };

export class Screens {
  private menu: Menu;
  private banner = $('banner');
  private primary = $<HTMLButtonElement>('banner-btn');
  private onPrimary = () => {};

  constructor(onMode: (mode: MenuChoice) => void, onMenu: () => void) {
    this.menu = new Menu(() => onMode('battle'));
    $('mode-survival').addEventListener('click', () => onMode('survival'));
    $('mode-online').addEventListener('click', () => onMode('online'));
    this.primary.addEventListener('click', () => this.firePrimary());
    $('banner-menu').addEventListener('click', onMenu);
    $('menu-btn').addEventListener('click', onMenu);
  }

  /** Difficulty for Battle vs Bot (remembered). */
  get botLevel(): BotLevel {
    return this.menu.botLevel;
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
    btn.textContent = button;
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

  /** The level card: level, sector and the briefing line, up until it is tapped. */
  showLevelCard(level: string, sector: string, briefing: string): void {
    $('card-level').textContent = level;
    $('card-sector').textContent = sector;
    $('card-briefing').textContent = briefing;
    $('card-hint').textContent = window.matchMedia('(pointer: coarse)').matches ? 'Tap to continue' : 'Click to continue';
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

  /** `menuLabel` renames the second button (it always goes to the menu). */
  showBanner(title: string, text: string, button: string, onClick: () => void, menuLabel = 'Menu', tip = ''): void {
    $('banner-menu').textContent = menuLabel;
    $('banner-tip').textContent = tip ? `Tip: ${tip}` : '';
    $('banner-tip').hidden = !tip;
    $('banner-title').textContent = title;
    $('banner-text').textContent = text;
    this.primary.textContent = button;
    this.onPrimary = onClick;
    this.banner.hidden = false;
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
