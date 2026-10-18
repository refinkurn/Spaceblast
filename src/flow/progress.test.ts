import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoryProgress, starsFor } from './progress';

describe('story progress', () => {
  it('gives 1 star for a clear, +1 for no lives lost, +1 for a quick clear', () => {
    expect(starsFor(1, 0, 60 * 60)).toBe(3);
    expect(starsFor(1, 1, 60 * 60)).toBe(2);
    expect(starsFor(1, 0, 120 * 60)).toBe(2);
    expect(starsFor(1, 2, 120 * 60)).toBe(1);
    // Boss levels can't be rushed: time doesn't count there.
    expect(starsFor(5, 0, 200 * 60)).toBe(3);
  });

  it('unlocks the next level, keeps the best stars, and finishes after level 20', () => {
    const p = new StoryProgress();
    expect(p.unlocked).toBe(1);
    expect(p.started).toBe(false);
    p.clear(1, 2);
    p.clear(1, 1);
    expect(p.stars(1)).toBe(2);
    expect(p.unlocked).toBe(2);
    p.clear(7, 3);
    expect(p.unlocked).toBe(8);
    p.clear(3, 3); // replaying an earlier level doesn't lock anything
    expect(p.unlocked).toBe(8);
    expect(p.totalStars).toBe(8);
    p.clear(20, 1);
    expect(p.finished).toBe(true);
    expect(p.unlocked).toBe(20);
  });

  describe('intro cards', () => {
    afterEach(() => vi.unstubAllGlobals());

    const fakeStorage = (start: Record<string, string> = {}) => {
      const data = { ...start };
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => data[k] ?? null,
        setItem: (k: string, v: string) => { data[k] = v; },
        removeItem: (k: string) => { delete data[k]; },
      });
      return data;
    };

    it('remembers which alien and power-up cards were shown, per save', () => {
      fakeStorage();
      const p = new StoryProgress();
      expect(p.seen('seenEnemies', 'goopling')).toBe(false);
      p.markSeen('seenEnemies', 'goopling');
      p.markSeen('seenEnemies', 'goopling');
      p.markSeen('seenPowerups', 'freeze_pulse');
      // A new visit (a fresh StoryProgress) still knows.
      const again = new StoryProgress();
      expect(again.seen('seenEnemies', 'goopling')).toBe(true);
      expect(again.seen('seenPowerups', 'goopling')).toBe(false);
      expect(again.seen('seenPowerups', 'freeze_pulse')).toBe(true);
    });

    it('shows the opening card once per save, and again after a tutorial reset', () => {
      fakeStorage();
      const p = new StoryProgress();
      expect(p.tutorialSeen).toBe(false);
      p.markTutorialSeen();
      p.markSeen('seenEnemies', 'goopling');
      expect(new StoryProgress().tutorialSeen).toBe(true);
      p.clear(1, 3);
      p.resetTutorial();
      const again = new StoryProgress();
      expect(again.tutorialSeen).toBe(false);
      expect(again.seen('seenEnemies', 'goopling')).toBe(false);
      expect(again.stars(1)).toBe(3); // the story itself is kept
    });

    it('keeps tutorial steps in the save, and moves old saves over', () => {
      const store = fakeStorage({
        'spaceblast.story': JSON.stringify({ unlocked: 2, seenAliens: ['goopling'], seenPowerUps: ['speed_boost'] }),
        'spaceblast.tutorial': JSON.stringify(['move', 'pillars']),
      });
      const p = new StoryProgress();
      expect(p.beats.has('move') && p.beats.has('pillars')).toBe(true);
      expect(p.seen('seenEnemies', 'goopling')).toBe(true);
      expect(p.seen('seenPowerups', 'speed_boost')).toBe(true);
      expect(store['spaceblast.tutorial']).toBeUndefined();
      p.beats.add('gate');
      expect(new StoryProgress().beats.has('gate')).toBe(true);
    });

    it('ignores broken or edited card lists', () => {
      fakeStorage({ 'spaceblast.story': JSON.stringify({ unlocked: 3, seenAliens: ['sniffer', 7, '<b>', 'sniffer'], seenPowerUps: 'x' }) });
      const p = new StoryProgress();
      expect(p.unlocked).toBe(3);
      expect(p.seen('seenEnemies', 'sniffer')).toBe(true);
      expect(p.seen('seenEnemies', '<b>')).toBe(false);
      expect(p.seen('seenPowerups', 'x')).toBe(false);
    });
  });
});
