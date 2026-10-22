import { describe, expect, it } from 'vitest';
import html from '../../index.html?raw';
import locales from '../config/locales.json';
import { setLocale, t } from './i18n';

const en = (locales as Record<string, Record<string, string>>).en;

/** Every .ts file under src, as text. */
const sources = import.meta.glob('../**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('i18n', () => {
  it('looks up, fills placeholders and falls back safely', () => {
    expect(t('banner.nextLevel')).toBe('Next level');
    expect(t('battle.round', { n: 3 })).toBe('Round 3');
    expect(t('no.such.key')).toBe('no.such.key');
    setLocale('xx'); // unknown language: English
    expect(t('banner.map')).toBe('Map');
    setLocale('en');
  });

  it('every key used in the code and in index.html exists in locales.json', () => {
    const used = new Set<string>();
    for (const text of Object.values(sources)) {
      for (const m of text.matchAll(/\b(?:t|tr)\('([a-zA-Z0-9_.-]+)'/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(100);
    for (const m of html.matchAll(/data-i18n(?:-aria|-title)?="([^"]+)"/g)) used.add(m[1]);
    // Keys built at run time.
    for (const r of ['taken', 'not_found', 'full', 'bad_code', 'expired']) used.add(`online.err.${r}`);
    for (const k of ['sound.all', 'sound.sfx', 'sound.off', 'radio.gateOpen', 'radio.lastHeart', 'radio.vestHit', 'radio.lastWave',
      'radio.item.beamRange', 'radio.item.extraCharge', 'radio.item.speed', 'radio.item.vest', 'radio.item.freeze']) used.add(k);
    const missing = [...used].filter((k) => !(k in en) && k !== 'no.such.key' && k !== 'xx');
    expect(missing).toEqual([]);
  });

  it('player text never says "bomb"', () => {
    expect(Object.values(en).filter((s) => /bomb/i.test(s))).toEqual([]);
  });
});
