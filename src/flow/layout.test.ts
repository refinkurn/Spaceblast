import { describe, expect, it } from 'vitest';
import html from '../../index.html?raw';
import css from '../style.css?raw';

// Layout rules checked on the markup and styles: the HUD's corner groups,
// icon + text menu items, the level card box.

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

describe('menu items', () => {
  it('pair an icon with a text label and stay 48 px tall', () => {
    for (const id of ['mode-survival', 'menu-versus', 'menu-settings', 'menu-credits', 'mode-battle', 'mode-online']) {
      const b = block(id);
      expect(b).toMatch(/<svg class="ui-icon"[^>]*><use href="#i-\w+"\/><\/svg><span[^>]*>[^<]+<\/span>/);
    }
    for (const level of ['easy', 'normal', 'hard']) {
      expect(html).toMatch(new RegExp(`data-level="${level}"><svg class="ui-icon"[^>]*><use href="#i-${level}"/></svg><span>`));
    }
    expect(rule(css, '.menu-list button, .menu-back')).toContain('min-height: 48px');
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
