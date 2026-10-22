import { START_LIVES } from '../sim/constants';
import { LEVEL_COUNT, isSectorStart, levelRoster, levelSpec } from '../sim/levels';
import type { GameState, SimEvent } from '../sim/state';
import type { GameView } from '../view/game_view';
import { ALIEN_CARDS } from './alien_cards';
import type { Cutscene } from './cutscene';
import { Crawl } from './crawl';
import { martiansNear } from './encounter';
import { IntroCards } from './intro_card';
import { LeaderboardScreen } from './leaderboard_screen';
import { StoryMap } from './story_map';
import { POWERUP_CARDS } from './powerup_cards';
import { StoryProgress } from './progress';
import { scoreFor } from '../services/score';
import { scoreRows, sendScore } from './story_score';
import type { Screens } from './screens';
import { ENDING, SECTORS, levelCard, type LevelCardText } from './story';
import { ENDING_SCENE, INTRO_SCENES, OPENING_CRAWL, OPENING_TUTORIAL, OUTRO_SCENES } from './story_scenes';
import { randomTip } from './tutorial';
import { bossClearLine, storySummary } from './summary';
import { t } from '../utils/i18n';
import { fadeThrough } from './transition';

// Story Mode flow: the Story map (flow/story_map.ts), each level's
// lead-in (sector card, boss cutscene, level card), results, retrying a level
// after a game over, alien and power-up cards, and the ending. main.ts owns the game loop; this decides
// what happens around it.

const $ = (id: string) => document.getElementById(id) as HTMLElement;

/** What Story Mode needs from main.ts. */
export interface StoryHost {
  /** Builds the map for `level` and makes it the current game. */
  newLevel(level: number): GameState;
  readonly state: GameState;
  /** Shows the level card (the game waits until it is dismissed). */
  showLevelCard(card: LevelCardText): void;
  /** Starting from the map's node card: no level card, play starts now (tutorial coach, countdown). */
  beginPlay(): void;
  openMenu(): void;
}


export class StoryMode {
  level = 1;
  readonly progress = new StoryProgress();
  private livesLost = 0;
  private ending = $('ending');
  private cards: IntroCards;
  private crawl = new Crawl();
  private board = new LeaderboardScreen(() => {
    this.map.show();
    $('hub-board').focus();
  });
  private map: StoryMap;

  constructor(private host: StoryHost, private screens: Screens, private cutscene: Cutscene, private view: GameView) {
    this.cards = new IntroCards(view);
    // Map -> level and map -> menu change the whole screen (and rebuild the arena): both fade through black.
    this.map = new StoryMap(this.progress, (level) => fadeThrough(() => this.play(level, true, true)), () => fadeThrough(() => {
      this.map.hide();
      host.openMenu();
    }), () => {
      this.map.hide();
      // Open on the last level you cleared (where you have a score), not the next, unplayed one.
      let last = 1;
      for (let n = 1; n <= LEVEL_COUNT; n++) if (this.progress.stars(n) > 0) last = n;
      this.board.show(last);
    });
    // After the ending: back to the Story map (all 20 levels cleared, ready to replay for stars).
    $('ending-btn').addEventListener('click', () => fadeThrough(() => {
      this.closeEnding();
      this.map.show();
    }));
  }

  get endingOpen(): boolean {
    return !this.ending.hidden;
  }

  /** The level map, the ending or the opening crawl (the crawl handles its own keys). */
  get overlayOpen(): boolean {
    return this.map.open || !this.ending.hidden || this.crawl.active || this.board.open;
  }

  /** An alien or power-up card is up (the game waits). */
  get cardOpen(): boolean {
    return this.cards.active;
  }

  /** This power-up's intro card has been shown on this save (Kit's toasts only follow it). */
  powerupSeen(item: number): boolean {
    const card = POWERUP_CARDS[item as keyof typeof POWERUP_CARDS];
    return !!card && this.progress.seen('seenPowerups', card.id);
  }

  /** Tap / Enter on a card. */
  pressCard(): void {
    this.cards.close();
  }

  /** A new map or leaving the level: no cards. */
  cancelCards(): void {
    this.cards.cancel();
  }


  /** "Story Mode" on the menu: the Story map, or straight into level 1 the first time. */
  open(): void {
    if (!this.progress.started) {
      this.play(1, true);
      return;
    }
    this.map.show();
  }

  closeOverlays(): void {
    this.map.hide();
    this.board.hide();
    this.cards.cancel();
    this.crawl.cancel();
    this.closeEnding();
  }

  /**
   * Starts a level: sector story card, boss cutscene, level card, then play.
   * fromMap: started from the map's node card, which already showed the level's
   * goal, so there is no level card: play starts right after the scenes.
   */
  play(level: number, withStory: boolean, fromMap = false): void {
    this.map.hide();
    this.screens.hideStory();
    this.cutscene.cancel();
    this.cards.cancel();
    this.crawl.cancel();
    this.level = level;
    this.livesLost = 0;
    const spec = levelSpec(level);
    const state = this.host.newLevel(level);
    const card = () => {
      if (fromMap) this.host.beginPlay();
      else this.host.showLevelCard(levelCard(spec));
    };
    // The very first Story start on this save: after the opening scene, Captain
    // Kit's opening pop-up, then level 1's card.
    const first = level === 1 && withStory && !this.progress.tutorialSeen;
    const brief = () => {
      if (!first) return card();
      this.progress.markTutorialSeen();
      this.cards.show(OPENING_TUTORIAL, state, { done: card });
    };
    // Retrying after a game over skips the scenes and goes straight to the level card.
    const scene = withStory ? INTRO_SCENES[level] : undefined;
    const intro = () => this.cutscene.play(scene ?? [], state, brief);
    // Sectors with an opening scene get it instead of the plain story card.
    if (withStory && isSectorStart(level) && !scene) {
      const sector = SECTORS[spec.sector - 1];
      this.screens.showStory(t('story.sectorOf', { n: spec.sector }), sector.name, sector.story, t('story.begin'), intro);
    } else if (level === 1 && withStory) {
      // The story begins: the opening crawl, then the prologue scene.
      this.crawl.play(OPENING_CRAWL, intro);
    } else {
      intro();
    }
  }

  /** Every Story tick: play time, and an enemy card the first time each kind of Martian comes close. */
  tick(state: GameState): void {
    this.progress.add({ ticks: 1 });
    for (const kind of martiansNear(state)) {
      const card = ALIEN_CARDS[kind];
      if (this.progress.seen('seenEnemies', card.id)) continue;
      this.progress.markSeen('seenEnemies', card.id);
      this.cards.show(card, state, { kind });
    }
  }

  /** Story results and run stats from sim events. */
  event(e: SimEvent): void {
    switch (e.type) {
      case 'item_picked': {
        const card = e.id === 0 ? POWERUP_CARDS[e.item as keyof typeof POWERUP_CARDS] : undefined;
        if (card && !this.progress.seen('seenPowerups', card.id)) {
          this.progress.markSeen('seenPowerups', card.id);
          this.cards.show(card, this.host.state);
        }
        break;
      }
      case 'martian_killed':
        this.progress.add({ martians: 1 });
        break;
      case 'boss_defeated':
        this.progress.add({ bosses: 1 });
        break;
      case 'player_died':
        if (e.id === 0) {
          this.livesLost++;
          this.progress.add({ livesLost: 1 });
        }
        break;
      case 'level_clear':
        this.cleared();
        break;
      case 'game_over':
        this.gameOver();
        break;
    }
  }

  private cleared(): void {
    const state = this.host.state;
    const level = this.level;
    const spec = levelSpec(level);
    // The Ducking duel counts as a boss too.
    if (spec.rival) this.progress.add({ bosses: 1 });
    const lost = Math.min(this.livesLost, START_LIVES);
    const martians = state.martians.filter((m) => !m.alive).length;
    const heartsLeft = START_LIVES - lost;
    const score = scoreFor({ level, martians, ticks: state.tick, heartsLeft });
    const stars = score.stars;
    const prevBest = this.progress.bestScore(level);
    this.progress.clear(level, stars, score.total);
    sendScore(level, score, heartsLeft, () => this.screens.bannerOpen);
    // After the duel, the ending scene follows straight on.
    const outro = [...(OUTRO_SCENES[level] ?? []), ...(level >= LEVEL_COUNT ? ENDING_SCENE : [])];
    this.cutscene.play(outro, state, () => {
      if (level >= LEVEL_COUNT) {
        this.showEnding();
        return;
      }
      const next = level + 1;
      const line = spec.boss ? bossClearLine(spec.boss) : t('story.levelClear', { n: level });
      // Boss and duel levels have no Martian roster: name their goal instead of "0 Martians".
      const nextSpec = levelSpec(next);
      const nextGoal = nextSpec.boss || nextSpec.rival ? levelCard(nextSpec).goal.text : t('story.martians', { n: levelRoster(next).length });
      const upNext = isSectorStart(next) ? t('story.sectorComplete', { n: spec.sector, name: SECTORS[spec.sector].name }) : t('story.next', { n: next, goal: nextGoal });
      this.screens.showBanner(spec.boss ? t('banner.survived') : t('banner.levelClear'), `${line}\n${upNext}`, t('banner.nextLevel'), () => fadeThrough(() => this.play(next, true)), t('banner.map'), '', {
        pose: 'happy', summary: [...storySummary(state, lost, stars), ...scoreRows(score, prevBest)],
        // "Map" goes back to the Story map, where Bosco walks (or warps) on to the next node.
        onMenu: () => fadeThrough(() => {
          this.screens.hideBanner();
          this.map.show({ from: level });
        }),
      });
    });
  }

  private gameOver(): void {
    this.progress.save();
    const level = this.level;
    this.screens.showBanner(t('banner.defeated'), t(level === LEVEL_COUNT ? 'story.gameOverDuel' : 'story.gameOver', { n: level }), t('story.retry', { n: level }), () => fadeThrough(() => this.play(level, false)), t('banner.map'), randomTip(),
      {
        pose: 'defeated', summary: storySummary(this.host.state, Math.min(this.livesLost, START_LIVES), 0),
        // "Map" goes back to the Story map, not the main menu.
        onMenu: () => fadeThrough(() => {
          this.screens.hideBanner();
          this.map.show();
        }),
      });
  }

  private showEnding(): void {
    const s = this.progress.stats;
    const minutes = Math.floor(s.ticks / 3600);
    const seconds = Math.floor(s.ticks / 60) % 60;
    const rows: [string, string][] = [
      [t('ending.levels'), `${LEVEL_COUNT} / ${LEVEL_COUNT}`],
      [t('ending.stars'), `${this.progress.totalStars} / ${LEVEL_COUNT * 3}`],
      [t('ending.martians'), String(s.martians)],
      [t('ending.bosses'), String(s.bosses)],
      [t('ending.lives'), String(s.livesLost)],
      [t('ending.time'), t('ending.timeValue', { m: minutes, s: String(seconds).padStart(2, '0') })],
    ];
    const list = $('ending-stats');
    list.innerHTML = '';
    rows.forEach(([label, value], i) => {
      const li = document.createElement('li');
      li.style.animationDelay = `${0.3 + i * 0.35}s`;
      const strong = document.createElement('strong');
      strong.textContent = value;
      li.append(label, strong);
      list.append(li);
    });
    $('ending-text').textContent = ENDING;
    // The hero dances on the right while the stats roll in on the left.
    const hero = this.host.state.players[0];
    this.view.heroes[0].celebrate(true);
    this.view.rig.focus(this.view.worldOf(hero.x - 3500, hero.y), 0.5);
    this.ending.hidden = false;
  }

  private closeEnding(): void {
    if (this.ending.hidden) return;
    this.ending.hidden = true;
    this.view.heroes[0].celebrate(false);
    this.view.rig.focus(null);
  }
}
