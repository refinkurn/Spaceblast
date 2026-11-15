import { START_LIVES } from '../sim/constants';
import { gemsCollected } from '../sim/items';
import { LEVEL_COUNT, isSectorStart, levelRoster, levelSpec } from '../sim/levels';
import { scoreFor } from '../services/score';
import { analytics } from '../services/analytics';
import { t } from '../utils/i18n';
import type { Cutscene } from './cutscene';
import { tally } from './match_tally';
import type { StoryProgress } from './progress';
import type { Screens } from './screens';
import { SECTORS, levelCard } from './story';
import type { StoryHost } from './story_mode';
import { ENDING_SCENE, OUTRO_SCENES } from './story_scenes';
import { scoreRows, sendScore } from './story_score';
import { bossClearLine, storySummary } from './summary';
import { randomTip } from './tutorial';
import { fadeThrough } from './transition';

// Story level results: the level-clear and game-over banners and their
// "Next level" / "Retry" / "Map" actions. Split out of story_mode.ts.

/** What the results need from Story Mode. */
export interface StoryResultsDeps {
  host: StoryHost;
  screens: Screens;
  cutscene: Cutscene;
  progress: StoryProgress;
  level(): number;
  livesLost(): number;
  play(level: number, withStory: boolean): void;
  /** Opens the Story map (`from`: the level just cleared, where Bosco walks on from). */
  showMap(from?: number): void;
  showEnding(): void;
}

export class StoryResults {
  constructor(private deps: StoryResultsDeps) {}

  cleared(): void {
    const state = this.deps.host.state;
    const level = this.deps.level();
    const spec = levelSpec(level);
    analytics.track({ name: 'level_clear', level, mode: 'story', value: Math.round(state.tick / 60) });
    // The Ducking duel counts as a boss too.
    if (spec.rival) this.deps.progress.add({ bosses: 1 });
    const lost = Math.min(this.deps.livesLost(), START_LIVES);
    const martians = state.martians.filter((m) => !m.alive).length;
    const heartsLeft = START_LIVES - lost;
    const gems = gemsCollected(state);
    const score = scoreFor({ level, martians, ticks: state.tick, heartsLeft, gems });
    const stars = score.stars;
    const prevBest = this.deps.progress.bestScore(level);
    this.deps.progress.clear(level, stars, score.total);
    sendScore(level, score, heartsLeft, gems, () => this.deps.screens.bannerOpen);
    // After the duel, the ending scene follows straight on.
    const outro = [...(OUTRO_SCENES[level] ?? []), ...(level >= LEVEL_COUNT ? ENDING_SCENE : [])];
    this.deps.cutscene.play(outro, state, () => {
      if (level >= LEVEL_COUNT) {
        this.deps.showEnding();
        return;
      }
      const next = level + 1;
      const line = spec.boss ? bossClearLine(spec.boss) : t('story.levelClear', { n: level });
      // Boss and duel levels have no Martian roster: name their goal instead of "0 Martians".
      const nextSpec = levelSpec(next);
      const nextGoal = nextSpec.boss || nextSpec.rival ? levelCard(nextSpec).goal.text : t('story.martians', { n: levelRoster(next).length });
      const upNext = isSectorStart(next) ? t('story.sectorComplete', { n: spec.sector, name: SECTORS[spec.sector].name }) : t('story.next', { n: next, goal: nextGoal });
      this.deps.screens.showBanner(spec.boss ? t('banner.survived') : t('banner.levelClear'), `${line}\n${upNext}`, t('banner.nextLevel'), () => fadeThrough(() => this.deps.play(next, true)), t('banner.map'), '', {
        pose: 'happy', summary: [...scoreRows(score, prevBest), ...storySummary(state, tally, lost, stars)],
        // "Map" goes back to the Story map, where Bosco walks (or warps) on to the next node.
        onMenu: () => fadeThrough(() => {
          this.deps.screens.hideBanner();
          this.deps.showMap(level);
        }),
      });
    });
  }

  gameOver(): void {
    this.deps.progress.save();
    const level = this.deps.level();
    analytics.track({ name: 'level_fail', level, mode: 'story', value: Math.round(this.deps.host.state.tick / 60) });
    this.deps.screens.showBanner(t('banner.defeated'), t(level === LEVEL_COUNT ? 'story.gameOverDuel' : 'story.gameOver', { n: level }), t('story.retry', { n: level }), () => fadeThrough(() => this.deps.play(level, false)), t('banner.map'), randomTip(),
      {
        pose: 'defeated', summary: storySummary(this.deps.host.state, tally, this.deps.livesLost(), 0),
        // "Map" goes back to the Story map, not the main menu.
        onMenu: () => fadeThrough(() => {
          this.deps.screens.hideBanner();
          this.deps.showMap();
        }),
      });
  }
}
