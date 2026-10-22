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
    expect(left).toContain('left: var(--edge-left)');
    expect(left).toContain('max-width: calc(var(--gutter) - 8px)');
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
  it('holds every part in one box with a launch icon button', () => {
    const card = block('level-card');
    expect(card.match(/class="card-box"/g)).toHaveLength(1);
    for (const id of ['card-level', 'card-sector', 'card-goal-text', 'card-briefing', 'card-launch', 'card-hint']) expect(card).toContain(`id="${id}"`);
    expect(block('card-launch')).toContain('href="#i-rocket"');
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
    expect(rule(css, '.hud-health')).toContain('grid-template-columns: repeat(3, 16px)');
    expect(rule(css, '.hud-left')).toContain('border-radius: 12px');
  });
});
