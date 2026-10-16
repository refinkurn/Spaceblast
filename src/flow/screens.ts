// Start screen and result banner (plain HTML overlays above the canvas).

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export type MenuChoice = 'survival' | 'battle';

export class Screens {
  private menu = $('menu');
  private banner = $('banner');
  private primary = $<HTMLButtonElement>('banner-btn');
  private onPrimary = () => {};

  constructor(onMode: (mode: MenuChoice) => void, onMenu: () => void) {
    $('mode-survival').addEventListener('click', () => onMode('survival'));
    $('mode-battle').addEventListener('click', () => onMode('battle'));
    this.primary.addEventListener('click', () => this.onPrimary());
    $('banner-menu').addEventListener('click', onMenu);
    $('menu-btn').addEventListener('click', onMenu);
  }

  get menuOpen(): boolean {
    return !this.menu.hidden;
  }

  get bannerOpen(): boolean {
    return !this.banner.hidden;
  }

  showMenu(): void {
    this.hideBanner();
    this.menu.hidden = false;
    $('mode-survival').focus();
  }

  hideMenu(): void {
    this.menu.hidden = true;
  }

  showBanner(title: string, text: string, button: string, onClick: () => void): void {
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
    if (this.bannerOpen) this.onPrimary();
  }
}
