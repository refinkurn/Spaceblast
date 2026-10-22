import { describe, expect, it } from 'vitest';
import html from '../../index.html?raw';
import css from '../style.css?raw';

// Layout rules checked on the markup and styles: icon + text menu items.

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
