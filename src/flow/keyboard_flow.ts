import type { Cinematic } from './cinematic';
import type { Congrats } from './congrats';
import type { Cutscene } from './cutscene';
import type { OnlineRoom } from './online';
import type { PauseMenu } from './pause';
import type { Screens } from './screens';
import type { StoryMode } from './story_mode';
import { session } from './session';

export interface KeyboardFlowDeps {
  screens: Screens;
  online: OnlineRoom;
  story: StoryMode;
  pause: PauseMenu;
  cutscene: Cutscene;
  cine: Cinematic;
  congrats: Congrats;
  canPause(): boolean;
  openMenu(): void;
  skipCard(): void;
}

/** Keyboard shortcuts for menus, cards and pause, plus taps on the level card and the board. */
export function installKeyboardFlow(d: KeyboardFlowDeps) {
  const { screens, online, story, pause, cutscene, cine, congrats } = d;
  window.addEventListener('keydown', (e) => {
    if (screens.menuOpen || online.screenOpen || story.overlayOpen) return;
    // Held keys repeat: a held Enter must not press "Next round" again and again.
    if (e.repeat) return;
    if (pause.open) {
      if (e.code === 'Escape' || e.code === 'KeyP') pause.close();
      return;
    }
    if (e.code === 'KeyP' && d.canPause()) { pause.show(session.mode); return; }
    const confirm = e.code === 'Enter' || e.code === 'Space';
    if (e.code === 'Escape') { if (d.canPause()) pause.show(session.mode); else d.openMenu(); }
    else if (cutscene.active) {
      if (confirm) cutscene.advance();
    } else if (story.cardOpen) {
      if (confirm) story.pressCard();
    } else if (cine.active) {
      if (e.code === 'Enter') cine.skip(); // not Space: that's the charge key
    }
    else if (confirm && congrats.open) congrats.pressPrimary();
    else if (confirm && screens.storyOpen) screens.pressStory();
    else if (confirm && screens.bannerOpen) screens.pressPrimary();
    else if (confirm && session.cardUp) d.skipCard();
  });
  document.getElementById('level-card')!.addEventListener('click', d.skipCard);
  document.getElementById('game')!.addEventListener('pointerdown', () => cine.skip());
}
