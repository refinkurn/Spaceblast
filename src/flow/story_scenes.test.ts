import { describe, expect, it } from 'vitest';
import { characterMeta } from '../view/sprite_loader';
import { INTRO_SCENES, OUTRO_SCENES } from './story_scenes';

describe('story scenes', () => {
  it('only asks for characters and poses that have a sprite sheet description', () => {
    const shots = [...Object.values(INTRO_SCENES), ...Object.values(OUTRO_SCENES)].flat();
    for (const shot of shots) {
      // Narrated boss and rival shots show the boss (every boss has the same poses) or the pilot.
      const who = shot.character ?? (shot.speaker ? null : shot.focus === 'boss' ? 'goopling-hive' : shot.focus === 'rival' ? 'renegade-pilot' : null);
      if (!who) continue;
      const meta = characterMeta(who);
      expect(meta, who).toBeDefined();
      expect(Object.keys(meta!.poses), `${who}: ${shot.text}`).toContain(shot.pose ?? 'neutral');
    }
  });
});
