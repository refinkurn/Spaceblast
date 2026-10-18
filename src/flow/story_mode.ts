import { START_LIVES } from '../sim/constants';
import { LEVEL_COUNT, isSectorStart, levelRoster, levelSpec } from '../sim/levels';
import type { GameState, SimEvent } from '../sim/state';
import type { GameView } from '../view/game_view';
import { ALIEN_CARDS } from './alien_cards';
import type { Cutscene } from './cutscene';
import { IntroCards } from './intro_card';
import { POWERUP_CARDS } from './powerup_cards';
import { StoryProgress, starsFor } from './progress';
import type { Screens } from './screens';
import { BOSS_NAMES, ENDING, SECTORS, levelCard } from './story';
import { INTRO_SCENES, OUTRO_SCENES } from './story_scenes';
import { randomTip } from './tutorial';

// Story Mode flow: the level map (continue / replay with stars), each level's
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
  showLevelCard(level: string, sector: string): void;
  openMenu(): void;
}

const starText = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

export class StoryMode {
  level = 1;
  readonly progress = new StoryProgress();
  private livesLost = 0;
  private hub = $('story-hub');
  private ending = $('ending');
  private cards: IntroCards;

  constructor(private host: StoryHost, private screens: Screens, private cutscene: Cutscene, private view: GameView) {
    this.cards = new IntroCards(view);
    $('hub-back').addEventListener('click', () => {
      this.hub.hidden = true;
      host.openMenu();
    });
    $('hub-continue').addEventListener('click', () => this.play(this.progress.unlocked, true));
    $('ending-btn').addEventListener('click', () => {
      this.closeEnding();
      host.openMenu();
    });
  }

  get endingOpen(): boolean {
    return !this.ending.hidden;
  }

  get overlayOpen(): boolean {
    return !this.hub.hidden || !this.ending.hidden;
  }

  /** An alien or power-up card is up (the game waits). */
  get cardOpen(): boolean {
    return this.cards.active;
  }

  /** Tap / Enter on a card. */
  pressCard(): void {
    this.cards.close();
  }

  /** A new map or leaving the level: no cards. */
  cancelCards(): void {
    this.cards.cancel();
  }

  /** The level card was closed: introduce any Martian kind not met before on this save. */
  levelStarted(): void {
    const state = this.host.state;
    for (const kind of new Set(levelSpec(this.level).roster)) {
      const card = ALIEN_CARDS[kind];
      if (this.progress.seen('seenAliens', card.id)) continue;
      this.progress.markSeen('seenAliens', card.id);
      this.cards.show(card, state, kind);
    }
  }

  /** "Story Mode" on the menu: the level map, or straight into level 1 the first time. */
  open(): void {
    if (!this.progress.started) {
      this.play(1, true);
      return;
    }
    this.renderHub();
    this.hub.hidden = false;
    $('hub-continue').focus();
  }

  closeOverlays(): void {
    this.hub.hidden = true;
    this.cards.cancel();
    this.closeEnding();
  }

  /** Starts a level: sector story card, boss cutscene, level card, then play. */
  play(level: number, withStory: boolean): void {
    this.hub.hidden = true;
    this.screens.hideStory();
    this.cutscene.cancel();
    this.level = level;
    this.livesLost = 0;
    const spec = levelSpec(level);
    const state = this.host.newLevel(level);
    const brief = () => {
      const card = levelCard(spec);
      this.host.showLevelCard(card.level, card.sector);
    };
    // Retrying after a game over skips the scenes and goes straight to the level card.
    const scene = withStory ? INTRO_SCENES[level] : undefined;
    const intro = () => this.cutscene.play(scene ?? [], state, brief);
    // Sectors with an opening scene get it instead of the plain story card.
    if (withStory && isSectorStart(level) && !scene) {
      const sector = SECTORS[spec.sector - 1];
      this.screens.showStory(`Sector ${spec.sector} of 4`, sector.name, sector.story, 'Begin', intro);
    } else {
      intro();
    }
  }

  /** Every Story tick: play time. */
  tick(): void {
    this.progress.add({ ticks: 1 });
  }

  /** Story results and run stats from sim events. */
  event(e: SimEvent): void {
    switch (e.type) {
      case 'item_picked': {
        const card = e.id === 0 ? POWERUP_CARDS[e.item as keyof typeof POWERUP_CARDS] : undefined;
        if (card && !this.progress.seen('seenPowerUps', card.id)) {
          this.progress.markSeen('seenPowerUps', card.id);
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
    // The Renegade Pilot counts as a boss too.
    if (spec.rival) this.progress.add({ bosses: 1 });
    const stars = starsFor(level, Math.min(this.livesLost, START_LIVES), state.tick);
    this.progress.clear(level, stars);
    this.cutscene.play(OUTRO_SCENES[level] ?? [], state, () => {
      if (level >= LEVEL_COUNT) {
        this.showEnding();
        return;
      }
      const next = level + 1;
      const title = spec.boss ? `${BOSS_NAMES[spec.boss]} destroyed!` : `Level ${level} clear!`;
      const upNext = isSectorStart(next) ? `Sector ${spec.sector} complete. Next: ${SECTORS[spec.sector].name}.` : `Next: level ${next}, ${levelRoster(next).length} Martians.`;
      this.screens.showBanner(`${title}  ${starText(stars)}`, upNext, 'Next level', () => this.play(next, true));
    });
  }

  private gameOver(): void {
    this.progress.save();
    const level = this.level;
    this.screens.showBanner('Game over', `The Martians got you on level ${level}. Your progress is saved.`, `Retry level ${level}`, () => this.play(level, false), 'Menu', randomTip());
  }

  private showEnding(): void {
    const s = this.progress.stats;
    const minutes = Math.floor(s.ticks / 3600);
    const seconds = Math.floor(s.ticks / 60) % 60;
    const rows: [string, string][] = [
      ['Levels cleared', `${LEVEL_COUNT} / ${LEVEL_COUNT}`],
      ['Stars', `${this.progress.totalStars} / ${LEVEL_COUNT * 3}`],
      ['Martians defeated', String(s.martians)],
      ['Bosses beaten', String(s.bosses)],
      ['Lives lost', String(s.livesLost)],
      ['Time played', `${minutes}m ${String(seconds).padStart(2, '0')}s`],
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

  private renderHub(): void {
    const p = this.progress;
    const next = p.unlocked;
    $('hub-continue').textContent = p.finished && next >= LEVEL_COUNT
      ? `Play level ${next} again`
      : `Continue · Level ${next} · ${SECTORS[levelSpec(next).sector - 1].name}`;
    $('hub-stars').textContent = `★ ${p.totalStars} / ${LEVEL_COUNT * 3} stars${p.finished ? ' · Story complete!' : ''}`;
    const grid = $('hub-levels');
    grid.innerHTML = '';
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      const spec = levelSpec(n);
      const b = document.createElement('button');
      b.type = 'button';
      b.disabled = n > next;
      if (spec.boss) b.classList.add('boss');
      if (spec.rival) b.classList.add('duel');
      if (n === next) b.classList.add('current');
      const num = document.createElement('span');
      num.textContent = String(n);
      const stars = document.createElement('span');
      stars.className = 'stars';
      stars.textContent = p.stars(n) ? starText(p.stars(n)) : '';
      b.append(num, stars);
      b.setAttribute('aria-label', `Level ${n}${p.stars(n) ? `, ${p.stars(n)} stars` : ''}${n > next ? ', locked' : ''}`);
      b.addEventListener('click', () => this.play(n, true));
      grid.append(b);
    }
  }
}
