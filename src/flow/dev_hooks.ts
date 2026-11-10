import { hashState } from '../sim/sim';
import type { GameView } from '../view/game_view';
import type { Cinematic } from './cinematic';
import type { DevPanel } from './dev';
import type { Screens } from './screens';
import { session } from './session';
import type { StoryMode } from './story_mode';

/**
 * Dev-only console hooks for debugging (`spaceblast.state`, `spaceblast.startLevel(n)`)
 * in the browser console. Stripped from production builds. scripts/shots.mjs uses them.
 */
export function installDevHooks(d: { view: GameView; story: StoryMode; dev: DevPanel; cine: Cinematic; screens: Screens }) {
  if (!import.meta.env.DEV) return;
  Object.assign(window, {
    spaceblast: {
      get state() { return session.state; },
      view: d.view,
      hash: () => hashState(session.state),
      /** Jump straight to a story level, e.g. spaceblast.startLevel(15). */
      startLevel(n: number, withStory = false) { session.mode = 'survival'; d.screens.hideMenu(); d.story.play(n, withStory); },
      story: d.story,
      dev: d.dev,
      cine: d.cine,
    },
  });
}
