import { describe, expect, it } from 'vitest';
import { BACK, type MenuPage } from './menu';

import html from '../../index.html?raw';

describe('menu pages', () => {
  it('Back from Battle vs Bot returns to Versus, from How to Play to Settings', () => {
    expect(BACK.bot.page).toBe('versus');
    expect(BACK.howto.page).toBe('settings');
    expect(BACK.versus.page).toBe('main');
    expect(BACK.settings.page).toBe('main');
    expect(BACK.credits.page).toBe('main');
  });

  it('every Back path ends at the main page', () => {
    for (const start of Object.keys(BACK) as Exclude<MenuPage, 'main'>[]) {
      let page: MenuPage = start;
      for (let i = 0; i < 5 && page !== 'main'; i++) page = BACK[page as Exclude<MenuPage, 'main'>].page;
      expect(page).toBe('main');
    }
  });

  it('the main page has exactly 4 buttons', () => {
    const main = html.match(/<nav id="menu-main"[\s\S]*?<\/nav>/)![0];
    expect(main.match(/<button/g)).toHaveLength(4);
    for (const label of ['Story Mode', 'Versus', 'Settings', 'Credits']) expect(main).toContain(`>${label}<`);
    expect(main).not.toContain('How to Play');
  });

  it('Versus holds Battle vs Bot and Multiplayer; Settings holds How to Play', () => {
    const versus = html.match(/<nav id="menu-versus-page"[\s\S]*?<\/nav>/)![0];
    expect(versus).toContain('id="mode-battle"');
    expect(versus).toContain('id="mode-online"');
    const settings = html.match(/<div id="settings"[\s\S]*?\n        <\/div>/)![0];
    expect(settings).toContain('id="menu-howto"');
  });

  it('Back is the first button on every sub-page', () => {
    for (const id of ['menu-versus-page', 'menu-bot', 'settings', 'menu-howto-page', 'menu-credits-page']) {
      const page = html.match(new RegExp(`id="${id}"[\\s\\S]*?<button[^>]*>`))![0];
      expect(page).toContain('menu-back');
    }
  });
});
