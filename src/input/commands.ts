import { Dir } from '../sim/constants';
import type { PlayerCommand } from '../sim/command';
import type { KeyboardSource } from './keyboard';
import type { TouchSource } from './touch';

/** Minor stick component needed to count as a fallback direction. */
const SECONDARY_THRESHOLD = 0.35;

/** Turns the local devices into one PlayerCommand per tick. */
export function readLocalCommand(keys: KeyboardSource, touch: TouchSource): PlayerCommand {
  const place = keys.place || touch.place;
  const keyDirs = keys.directions();
  if (keyDirs.length > 0) return { dir: keyDirs[0], alt: keyDirs[1] ?? Dir.None, place };

  const { x, y } = touch.vector;
  if (x === 0 && y === 0) return { dir: Dir.None, alt: Dir.None, place };
  const xDir = x > 0 ? Dir.Right : Dir.Left;
  const yDir = y > 0 ? Dir.Down : Dir.Up;
  const horizontal = Math.abs(x) >= Math.abs(y);
  const minor = horizontal ? Math.abs(y) : Math.abs(x);
  return {
    dir: horizontal ? xDir : yDir,
    alt: minor >= SECONDARY_THRESHOLD ? (horizontal ? yDir : xDir) : Dir.None,
    place,
  };
}
