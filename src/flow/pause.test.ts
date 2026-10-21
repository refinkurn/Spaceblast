import { describe, expect, it } from 'vitest';
import html from '../../index.html?raw';
import { restartLabel } from './pause';

describe('pause card', () => {
  it('names the restart button after the mode', () => {
    expect(restartLabel('survival')).toBe('Restart level');
    expect(restartLabel('battle')).toBe('Restart round');
  });

  it('has Resume, Restart, Settings, Quit and a quit confirm', () => {
    const card = html.match(/<div id="pause-card"[\s\S]*?<div id="alert"/)![0];
    for (const id of ['pause-resume', 'pause-restart', 'pause-settings', 'pause-quit', 'pause-quit-yes', 'pause-keep']) {
      expect(card).toContain(`id="${id}"`);
    }
    expect(card).toContain('Progress on this level is lost.');
  });

  it('the HUD button is a Pause button, not Menu', () => {
    const btn = html.match(/<button id="menu-btn"[^>]*>/)![0];
    expect(btn).toContain('aria-label="Pause"');
  });
});
