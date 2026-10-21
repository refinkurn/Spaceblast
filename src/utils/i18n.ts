import locales from '../config/locales.json';

// Interface text by key (src/config/locales.json): menus, HUD, buttons, alerts
// and Kit's radio toasts. The story script (story.ts, story_scenes.ts,
// tutorial_script.ts) stays in its own files for now.
//
// t('battle.round', { n: 2 }) -> "Round 2". A key missing in the current
// language falls back to English, then to the key itself, so a gap never
// shows up blank.

type Dict = Record<string, string>;
const TABLES = locales as Record<string, Dict>;
export const FALLBACK = 'en';

let current: string = FALLBACK;

/** Switches the language (unknown codes keep English). */
export function setLocale(code: string): void {
  current = TABLES[code] ? code : FALLBACK;
}

export function locale(): string {
  return current;
}

/** The text for `key`, with `{name}` placeholders filled from `vars`. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const text = TABLES[current]?.[key] ?? TABLES[FALLBACK][key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

/** Fills every `[data-i18n]` element's text and `[data-i18n-aria]` aria-label under `root`. */
export function applyDom(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = t(el.dataset.i18n!);
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria!));
}
