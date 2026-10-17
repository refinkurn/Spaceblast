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

  /** Enter / Space on the story card continues. */
  pressStory(): void {
    if (this.storyOpen) $<HTMLButtonElement>('story-btn').click();
  }

  /** The level briefing card; main.ts hides it after 3 s. */
  showLevelCard(title: string, context: string, goal: string, hazards: string): void {
    $('card-title').textContent = title;
    $('card-context').textContent = context;
    $('card-goal').textContent = goal;
    $('card-hazards').textContent = hazards;
    $('level-card').hidden = false;
  }

  hideLevelCard(): void {
    $('level-card').hidden = true;
  }

  showMenu(): void {
    this.hideBanner();
    this.hideLevelCard();
    $('story').hidden = true;
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
