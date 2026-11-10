import { TICK_RATE } from '../sim/constants';
import { analytics } from '../services/analytics';
import { t } from '../utils/i18n';
import type { Cinematic } from './cinematic';
import type { Congrats, Standing } from './congrats';
import type { MatchScore } from './online_match';
import type { OnlineRoom } from './online';
import type { Screens, MenuChoice } from './screens';
import type { SettingsScreen } from './settings';
import { battleSummary, type BannerExtra } from './summary';
import { tally as matchTally } from './match_tally';
import { fadeThrough } from './transition';
import { randomTip } from './tutorial';
import { BATTLE_TIPS } from './tutorial_script';
import { session } from './session';

/** You (blue), the rival (orange: battle bot or the Renegade Pilot), then players 3 and 4. */
const HERO_COLORS = [0x3a7bff, 0xff6a3d, 0x4fd17a, 0xc77dff];
/** Battle vs bot: round wins to take the match. */
const BATTLE_WINS = 3;

export interface BattleDeps {
  score: MatchScore;
  settings: SettingsScreen;
  cine: Cinematic;
  screens: Screens;
  online: OnlineRoom;
  congrats: Congrats;
  openMenu(): void;
  startModeNow(m: MenuChoice): void;
  newGame(): void;
}

/** Battle rounds (offline and online): the score, the round-end cinematic, the banners and the match result. */
export function createBattleFlow(d: BattleDeps) {
  const { score, screens, online, congrats } = d;

  /** Astronaut colours: the room's picks online, else blue for you and orange for the rival. */
  function colors(): number[] {
    return session.mode === 'online' && session.net ? session.net.colors : HERO_COLORS;
  }

  function playerKeys(): string[] {
    return session.net && session.mode === 'online' ? session.net.keys : ['p0', 'p1'];
  }

  function playerName(id: number): string {
    if (id === session.localId) return t('common.you');
    return session.net && session.mode === 'online' ? session.net.names[id] : t('battle.theBot');
  }

  function winsNeeded(): number {
    return session.net && session.mode === 'online' ? session.net.winsNeeded : BATTLE_WINS;
  }

  /** A round ended: count the win, play the cinematic, then the score or the match result. */
  function roundOver(winner: number) {
    const { mode, state, localId } = session;
    analytics.track({ name: 'round', mode: mode === 'online' ? 'online' : 'bot', value: Math.round(state.tick / TICK_RATE) });
    if (winner >= 0) score.win(playerKeys()[winner], winsNeeded());
    session.lastWinner = winner;
    const length = d.settings.value.cinematic;
    if (length === 'off') {
      afterRound();
      return;
    }
    const title = winner < 0 ? t('battle.drawTitle') : winner === localId ? t('battle.youWin') : t('battle.wins', { name: playerName(winner) });
    d.cine.start(state, {
      winner,
      kicker: t('battle.round', { n: score.round }),
      title,
      color: winner >= 0 ? colors()[winner] : 0xffffff,
      colors: colors(),
      local: mode === 'online' ? localId : -1,
      replay: length === 'full',
    }, afterRound);
  }

  function afterRound() {
    if (score.over) showMatchWinner();
    else showRoundScore();
  }

  function tally(): string {
    return playerKeys().map((key, id) => `${playerName(id)} ${score.of(key)}`).join(' · ');
  }

  function showRoundScore() {
    const { mode, state, localId, lastWinner } = session;
    const line = lastWinner < 0 ? t('battle.roundDraw') : lastWinner === localId ? t('battle.youWinRound') : t('battle.winsRound', { name: playerName(lastWinner) });
    const big = lastWinner < 0 ? t('banner.draw') : lastWinner === localId ? t('banner.victory') : t('banner.defeated');
    const extra: BannerExtra = { pose: lastWinner < 0 ? 'neutral' : lastWinner === localId ? 'happy' : 'defeated', summary: battleSummary(state, matchTally, tally()) };
    const goal = t('battle.firstTo', { n: winsNeeded() });
    const menu = t('banner.mainMenu');
    if (mode !== 'online') {
      screens.showBanner(big, `${line} · ${goal}`, t('banner.nextRound'), () => fadeThrough(() => { score.nextRound(false); d.newGame(); }), menu, randomTip(BATTLE_TIPS), extra);
    } else if (online.total < 2) {
      screens.showBanner(big, `${line} · ${t('battle.everyoneLeft')}`, t('banner.backToRoom'), () => { screens.hideBanner(); online.showLobby(); }, menu, '', extra);
    } else if (online.isHost) {
      screens.showBanner(big, `${line} · ${goal}`, t('banner.nextRound'), () => online.startRound(), menu, randomTip(BATTLE_TIPS), extra);
    } else {
      screens.showBanner(big, `${line} · ${goal}`, t('banner.waitingHost'), () => {}, menu, randomTip(BATTLE_TIPS), extra);
    }
  }

  function showMatchWinner() {
    const { mode, net, localId } = session;
    const keyList = playerKeys();
    const cols = colors();
    const standings: Standing[] = keyList.map((key, id) => ({
      name: net && mode === 'online' ? net.names[id] : id === 0 ? t('common.you') : t('common.bot'),
      color: cols[id],
      wins: score.of(key),
      you: id === localId,
    }));
    const winner = standings.find((s) => s.wins >= winsNeeded()) ?? null;
    if (mode === 'online') {
      congrats.show(winner, standings, [{ label: t('banner.backToRoom'), primary: true, onClick: () => { congrats.hide(); online.showLobby(); } }]);
    } else {
      congrats.show(winner, standings, [
        { label: t('banner.playAgain'), primary: true, onClick: () => fadeThrough(() => { congrats.hide(); d.startModeNow('battle'); }) },
        { label: t('banner.menu'), onClick: d.openMenu },
      ]);
    }
  }

  return { colors, playerKeys, playerName, roundOver, showRoundScore };
}
