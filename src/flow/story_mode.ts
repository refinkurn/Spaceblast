import { LEVEL_COUNT, isSectorStart, levelSpec } from '../sim/levels';
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
import { StoryResults } from './story_results';
import type { Screens } from './screens';
import { ENDING, SECTORS, levelCard, type LevelCardText } from './story';
import { INTRO_SCENES, OPENING_CRAWL, OPENING_TUTORIAL } from './story_scenes';
import { t } from '../utils/i18n';
import { fadeThrough } from './transition';
import { analytics } from '../services/analytics';
import { watchAccountMerge } from './account_sync';

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
  private results: StoryResults;

  constructor(private host: StoryHost, private screens: Screens, private cutscene: Cutscene, private view: GameView) {
    this.cards = new IntroCards(view);
    this.results = new StoryResults({
      host,
      screens,
      cutscene,
      progress: this.progress,
      level: () => this.level,
      livesLost: () => this.livesLost,
      play: (level, withStory) => this.play(level, withStory),
      showMap: (from) => this.map.show(from === undefined ? undefined : { from }),
      showEnding: () => this.showEnding(),
    });
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
    // CrazyGames account: once the SDK is ready its copy of the progress is merged with this device's.
    watchAccountMerge(this.progress, () => { if (this.map.open) this.map.show(); });
    // After the ending: back to the Story map (all 20 levels cleared, ready to replay for stars).
    $('ending-btn').addEventListener('click', () => fadeThrough(() => {
      this.closeEnding();
      this.map.show();
    }));
  }

  /** The Story map is on screen. */
  get mapOpen(): boolean {
    return this.map.open;
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

  /**
   * Quick start (config/portal.ts): a first-time portal player goes straight into
   * level 1. The coach prompts teach the controls; the opening crawl and prologue
   * are kept for after that first clear (see `play`).
   */
  coldOpen(): void {
    this.progress.setIntroPending(true);
    this.play(1, false, true);
  }

  /** A save that has never played Story, seen the opening card or had a quick start. */
  get fresh(): boolean {
    return !this.progress.started && !this.progress.tutorialSeen && !this.progress.introPending;
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
    analytics.track({ name: 'level_start', level, mode: 'story' });
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
    const begin = () => {
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
    };
    // After a quick start the opening story is still owed: it plays as a look
    // back before the next level (level 1 itself opens with it anyway).
    if (withStory && this.progress.introPending) {
      if (level > 1) {
        // The flag clears only once the story has played: leaving midway shows it again next time.
        const seen = () => {
          this.progress.setIntroPending(false);
          this.progress.markTutorialSeen(); // they have played: Kit's opening card would be old news
          begin();
        };
        this.screens.showStory(t('story.earlierKicker'), t('story.earlierTitle'), t('story.earlierText'), t('story.begin'), () =>
          this.crawl.play(OPENING_CRAWL, () => this.cutscene.play(INTRO_SCENES[1] ?? [], state, seen)));
        return;
      }
      this.progress.setIntroPending(false);
    }
    begin();
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
        this.results.cleared();
        break;
      case 'game_over':
        this.results.gameOver();
        break;
    }
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
