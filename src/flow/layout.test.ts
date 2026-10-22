import { describe, expect, it } from 'vitest';
import html from '../../index.html?raw';
import css from '../style.css?raw';
import locales from '../config/locales.json';

const en = (locales as Record<string, Record<string, string>>).en;
import mapCss from './story_map.css?raw';

// Layout rules checked on the markup and styles: the HUD's corner groups,
// one Back spot for every screen, icon + text menu items, the level card box.

const rule = (src: string, sel: string) => src.match(new RegExp(`(?:^|\n)${sel.replace(/[.#()]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? '';
/** The markup of the element with this id, up to its matching closing tag. */
function block(id: string): string {
  const start = html.indexOf(`id="${id}"`);
  const open = html.lastIndexOf('<', start);
  const tag = html.slice(open + 1).match(/^\w+/)![0];
  let depth = 0;
  const re = new RegExp(`<(/?)${tag}\\b`, 'g');
  re.lastIndex = open;
  for (let m; (m = re.exec(html)); ) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(open, html.indexOf('>', m.index) + 1);
  }
  throw new Error(`no end for ${id}`);
}

describe('HUD corners', () => {
  it('keeps pause, sound and full screen together in a top-right group', () => {
    const right = html.match(/<div class="hud-right">[\s\S]*?<\/div>/)![0];
    for (const id of ['full-btn', 'sound-btn', 'menu-btn']) expect(right).toContain(`id="${id}"`);
    const r = rule(css, '.hud-right');
    expect(r).toContain('position: absolute');
    expect(r).toContain('right: var(--edge-right)');
    expect(r).toContain('env(safe-area-inset-top)');
  });

  it('does not place the buttons with an auto margin (hiding full screen slid them over the hearts)', () => {
    expect(css).not.toMatch(/#full-btn \{[^}]*margin-left: auto/);
  });

  it('keeps the power-ups in the top-left column, inside the left gutter', () => {
    const left = rule(css, '.hud-left');
    // Inset from the corner, never narrower than the gutter, wider where the board leaves room.
    expect(left).toContain('left: max(var(--edge-left), 2.2vw)');
    expect(left).toContain('max-width: max(calc(var(--gutter) - 8px), var(--hud-room, 0px))');
    expect(html.match(/<div class="hud-left">[\s\S]*?id="hud-goal"/)![0]).toContain('id="hud-powers"');
  });

  it('respects the notch on both sides', () => {
    expect(css).toContain('--edge-left: max(12px, env(safe-area-inset-left))');
    expect(css).toContain('--edge-right: max(12px, env(safe-area-inset-right))');
  });
});

describe('Back buttons', () => {
  const BACKS = ['settings-done', 'online-back', 'hub-back', 'map-card-back', 'lb-back'];

  it('every Back is the same icon button (no text label) with an accessible name', () => {
    const all = [...html.matchAll(/<button[^>]*class="[^"]*\bnav-back\b[^"]*"[^>]*>([\s\S]*?)<\/button>/g)];
    // 5 menu sub-pages (Settings is one of them) + online + map + map card + leaderboard.
    expect(all.length).toBe(9);
    for (const [tag, inner] of all) {
      // The label comes from a locale key that reads "Back" (aria-label is filled at startup).
      const key = tag.match(/data-i18n-aria="([^"]+)"/)?.[1];
      expect(key && en[key]).toBe('Back');
      expect(inner).toContain('href="#i-back"');
      expect(inner.replace(/<[^>]*>/g, '').trim()).toBe('');
    }
    for (const id of BACKS) expect(block(id)).toContain('nav-back');
  });

  it('is pinned to one top-left screen spot, 48 px', () => {
    const back = rule(css, '.nav-back');
    expect(back).toContain('position: fixed');
    expect(back).toContain('top: var(--edge-top)');
    expect(back).toContain('left: var(--edge-left)');
    expect(back).toContain('width: 48px');
    expect(back).toContain('height: 48px');
  });

  it('no screen moves its Back somewhere else', () => {
    expect(mapCss).toContain('.map-head'); // story_map.css really loaded (vite.config test.css.include)
    for (const id of BACKS) {
      expect(css).not.toMatch(new RegExp(`#${id}[^{]*\\{[^}]*position`));
      expect(mapCss).not.toMatch(new RegExp(`#${id}\\b`));
    }
    // The map card's Back sits outside the card, whose entry animation would carry a fixed child with it.
    const card = html.match(/<div class="map-card" [\s\S]*?<\/ul>/)![0];
    expect(card).not.toContain('map-card-back');
  });
});

describe('menu items', () => {
  it('pair an icon with a text label and stay 48 px tall', () => {
    for (const id of ['mode-survival', 'menu-versus', 'menu-settings', 'menu-credits', 'mode-battle', 'mode-online']) {
      const b = block(id);
      expect(b).toMatch(/<svg class="ui-icon"[^>]*><use href="#i-\w+"\/><\/svg><span[^>]*>[^<]+<\/span>/);
    }
    for (const level of ['easy', 'normal', 'hard']) {
      expect(html).toMatch(new RegExp(`data-level="${level}"><svg class="ui-icon"[^>]*><use href="#i-${level}"/></svg><span data-i18n="menu\\.${level}">`));
    }
    expect(rule(css, '.menu-list button:not(.nav-back)')).toContain('min-height: 48px');
  });

  it('every icon the page uses is in the sprite', () => {
    for (const [, name] of html.matchAll(/href="#(i-[\w-]+)"/g)) expect(html).toContain(`<symbol id="${name}"`);
  });
});

describe('level card', () => {
  it('holds every part in one box with the proceed icon button', () => {
    const card = block('level-card');
    expect(card.match(/class="card-box"/g)).toHaveLength(1);
    for (const id of ['card-level', 'card-sector', 'card-goal-text', 'card-briefing', 'card-launch', 'card-hint']) expect(card).toContain(`id="${id}"`);
    expect(block('card-launch')).toContain('href="#i-play"');
  });
});

describe('pause card', () => {
  it('hides the count and pop-ups while paused (BLAST! drew over the card)', () => {
    for (const id of ['countdown', 'announce', 'alert', 'coach', 'radio-toast']) expect(css).toContain(`body.paused #${id}`);
    expect(css).toMatch(/body\.paused #radio-toast \{ visibility: hidden; \}/);
  });
});

describe('stats panel', () => {
  it('stacks one power-up per row and keeps hearts on a 3-column grid', () => {
    expect(rule(css, '.hud-powers')).toContain('flex-direction: column');
    expect(rule(css, '.hud-health')).toContain('grid-template-columns: repeat(3, calc(16px * var(--hs)))');
    // Every size in the panel follows the one scale.
    for (const sel of ['.hud-avatar', '.power .icon', '.pips i']) expect(rule(css, sel)).toContain('var(--hs)');
    expect(rule(css, '.hud-left')).toContain('border-radius: calc(12px * var(--hs))');
  });
});

describe('proceed and back icons', () => {
  const PROCEED = ['story-btn', 'card-launch', 'banner-btn', 'map-card-enter', 'pause-resume', 'pause-keep', 'online-rejoin', 'online-create', 'online-join', 'online-start'];
  const SKIP = ['crawl-skip', 'cut-skip', 'intro-skip'];
  const BACK = ['banner-menu', 'pause-quit', 'pause-quit-yes', 'ending-btn', 'settings-done', 'online-back', 'hub-back', 'map-card-back', 'lb-back'];

  it('every proceed button uses #i-play and every back button #i-back, nothing else', () => {
    for (const id of PROCEED) {
      const b = block(id);
      expect(b, id).toContain('href="#i-play"');
      expect(b, id).not.toContain('href="#i-back"');
    }
    for (const id of BACK) {
      const b = block(id);
      expect(b, id).toContain('href="#i-back"');
      expect(b, id).not.toContain('href="#i-play"');
    }
    for (const id of SKIP) expect(block(id), id).toContain('href="#i-skip"');
    expect(html).not.toContain('i-rocket');
  });

  it('keeps labels in a <span data-i18n> so the startup translation pass keeps the icon', () => {
    for (const id of [...PROCEED, ...BACK, ...SKIP]) expect(block(id).match(/^<button[^>]*>/)![0], id).not.toMatch(/ data-i18n="/);
  });
});

describe('dashboard buttons', () => {
  it('menu, submenu and pause buttons share one black square panel; the main action is lit, not filled', () => {
    const dash = css.slice(css.indexOf('/* Dashboard buttons'));
    for (const sel of ['.menu-list button:not(.nav-back)', '.nav-back', '.quiet-btn', '#online button:not(.nav-back)', '.pause-list button', '.icon-go']) expect(dash).toContain(sel);
    expect(dash).toContain('background: var(--dash-bg)');
    expect(dash).toContain('border-radius: var(--dash-radius)');
    expect(css).toMatch(/--dash-bg: #0[0-9a-f]{5}/);
    expect(dash).toContain('box-shadow: var(--dash-lit)');
  });
});

describe('online screen', () => {
  it('is centred, not pinned to a left panel', () => {
    expect(css).not.toContain('justify-content: flex-start;\n  padding-left: max(28px');
    expect(rule(css, '#online')).toContain('justify-content: center');
    expect(css).toMatch(/\.online-card \{ width: min\(640px, 100%\)/);
  });
});

describe('icon-only buttons', () => {
  it('Invite, Join, Save, Skip and Charge show an icon, no words, and keep a spoken name', () => {
    const save = html.match(/<button type="submit"[^>]*>[\s\S]*?<\/button>/)![0];
    for (const [b, icon] of [[block('online-invite'), 'i-share'], [block('online-join'), 'i-play'], [save, 'i-check'], [block('crawl-skip'), 'i-skip'], [block('place-btn'), 'i-charge']] as const) {
      expect(b).toContain(`href="#${icon}"`);
      expect(b.replace(/<[^>]*>/g, '').trim()).toBe('');
      expect(b).toMatch(/aria-label="|data-i18n-aria="/);
    }
  });
});

describe('settings card and selectors', () => {
  it('opens Settings and How to Play as a centred card (no transform, so Back stays in the corner)', () => {
    const card = css.slice(css.indexOf('#menu.card #settings, #menu.card #menu-howto-page {'));
    const rule = card.slice(0, card.indexOf('}'));
    expect(rule).toContain('position: fixed');
    expect(rule).toContain('margin: auto');
    expect(rule).not.toContain('transform');
    expect(css).toContain('#menu.card::after');
  });

  it('every option setting is a ‹ value › selector, in Settings and in the lobby', () => {
    for (const id of ['set-controls', 'set-joystick', 'set-vibration', 'set-shake', 'set-cinematic', 'set-time', 'set-scenario', 'set-match', 'set-bot-level']) {
      expect(html, id).toContain(`<div id="${id}"></div>`);
    }
    expect(html).not.toContain('segmented');
    expect(rule(css, '.stepper button')).toContain('height: 48px');
  });
});
