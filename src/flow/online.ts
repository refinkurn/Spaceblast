import { RoomLink, savedSeat } from '../net/link';
import {
  CODE_LETTERS, DEFAULT_SETTINGS, MAX_PLAYERS,
  type ClientMsg, type Profile, type RoomSettings,
} from '../net/protocol';
import { leaveRoom } from './ad_points';
import { leftRoom, updateRoom } from '../services/crazygames_room';
import { shareInvite } from './invite';
import { botColorsFor } from './lobby_slots';
import { JoinFlow } from './online_join';
import { handleServerMsg } from './online_messages';
import { LobbyView } from './online_lobby';
import { crazyAccountName, onAccountName } from '../services/crazygames';
import { backLabel, loadPrefs } from './online_prefs';
import { t } from '../utils/i18n';

export { botColorsFor };

// The "Play online" screens: your name, create or join a room, then the lobby
// (colour, and the host's match settings). During a match main.ts gets the
// server's frames through the callbacks below; the connection itself (ping,
// reconnecting) lives in net/link.ts.

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface RoundStart {
  r: number;
  seed: number;
  /** Humans in sim player order; bots follow them. */
  players: Profile[];
  settings: RoomSettings;
  /** This browser's sim player id. */
  local: number;
  /** Reconnecting mid-round: every tick so far, to catch up from the start. */
  frames?: number[][];
}

export class OnlineRoom {
  onRoundStart: (s: RoundStart) => void = () => {};
  onFrames: (r: number, tick: number, c: number[][]) => void = () => {};
  onLeft: (slot: number) => void = () => {};
  /** A player's connection dropped (they're reconnecting) or came back. */
  onAway: (slot: number, away: boolean) => void = () => {};
  /** This browser lost its connection and is reconnecting (true), or is back (false). */
  onReconnecting: (on: boolean) => void = () => {};
  onHash: (r: number, tick: number, h: number) => void = () => {};
  /** The room was closed: by Back/Leave (reason '') or a dropped connection. */
  onExit: (reason: string) => void = () => {};

  you = -1;
  host = -1;
  players: Profile[] = [];
  settings: RoomSettings = { ...DEFAULT_SETTINGS };
  code = '';
  private net = new RoomLink();
  private lobby = new LobbyView(this);
  private screen = $('online');
  private status = $('online-status');
  private codeInput = $<HTMLInputElement>('online-code');
  private nameInput = $<HTMLInputElement>('online-name');
  prefs = loadPrefs();
  private lastStart = -Infinity;
  private joiner: JoinFlow;

  constructor() {
    this.joiner = new JoinFlow(this, this.net, this.prefs, this.nameInput);
    this.net.onMessage = (m) => handleServerMsg(this, m);
    this.net.onLost = (reason) => this.exit(reason);
    this.net.onReconnecting = (on) => this.onReconnecting(on);
    $('online-rejoin').addEventListener('click', () => this.joiner.rejoinSaved());
    this.showName();
    onAccountName(() => this.showName());
    $('online-create').addEventListener('click', () => this.joiner.create());
    $('online-invite').addEventListener('click', async () => {
      const note = await shareInvite(this.code);
      $('online-invite-note').textContent = note;
      if (note) setTimeout(() => { $('online-invite-note').textContent = ''; }, 4000);
    });
    $('online-join').addEventListener('click', () => this.joiner.join(this.codeInput.value));
    this.codeInput.addEventListener('input', () => {
      this.codeInput.value = [...this.codeInput.value.toUpperCase()].filter((c) => CODE_LETTERS.includes(c)).join('');
    });
    for (const input of [this.codeInput, this.nameInput]) {
      // Typing must not move the astronaut (keyboard controls listen on window).
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') input === this.codeInput ? this.joiner.join(this.codeInput.value) : this.codeInput.focus();
      });
    }
    $('online-start').addEventListener('click', () => this.startRound());
    $('online-back').addEventListener('click', () => this.leave());
    this.lobby.buildControls();
  }

  /** In a room (connected, or reconnecting to our seat). */
  get connected(): boolean {
    return this.net.open || this.net.reconnecting;
  }

  /** Smoothed ping to the room server, in ms. */
  get rtt(): number {
    return this.net.rtt;
  }

  /** The data centre the room runs in (e.g. "SIN"), or '' when the server doesn't say. */
  where = '';

  /** How much that ping wobbles, in ms. */
  get rttSpread(): number {
    return this.net.rttSpread;
  }

  get reconnecting(): boolean {
    return this.net.reconnecting;
  }

  /** The connection looks stuck: reconnect now. */
  retryNow(): void {
    this.net.retryNow();
  }

  get isHost(): boolean {
    return this.you >= 0 && this.you === this.host;
  }

  get screenOpen(): boolean {
    return !this.screen.hidden;
  }

  /** Humans and bots together. */
  get total(): number {
    return this.players.length + this.settings.bots;
  }

  /** Shows the name + create / join screen. */
  open(): void {
    // Status and Back sit under the choices here, and in the lobby's left column there.
    this.screen.querySelector('.online-card')!.append(this.status, $('online-back'));
    this.screen.hidden = false;
    $('online-choose').hidden = false;
    $('online-lobby').hidden = true;
    backLabel(t('html.online-back'));
    this.setStatus('');
    // After a page reload mid-match: offer to get back into the seat.
    const seat = savedSeat();
    const rejoin = $('online-rejoin');
    rejoin.hidden = !seat;
    if (seat) rejoin.querySelector('span')!.textContent = t('online.rejoinRoom', { code: seat.code });
  }

  /** The name field: the CrazyGames username (read-only, with a hint) when logged in, else the saved name. */
  private showName(): void {
    const account = crazyAccountName();
    this.nameInput.value = account ?? this.prefs.name;
    this.nameInput.readOnly = account !== null;
    $('online-name-note').textContent = account ? t('online.fromCrazyGames') : '';
  }

  /** Instant Multiplayer: create a room now with the saved name and colour (a failure shows today's error). */
  createNow(): void {
    void this.joiner.create();
  }

  /** An invite link was opened: fill in the code and focus the name. Joins only on Join. */
  prefillCode(code: string): void {
    this.codeInput.value = code;
    this.nameInput.focus();
  }

  /** CrazyGames portal: tells it the room and whether a friend can still join (a free seat). */
  private syncRoom(): void {
    updateRoom(this.code, this.total < MAX_PLAYERS);
  }

  renderAndSync(): void {
    this.lobby.render();
    this.syncRoom();
  }

  /** Back to the lobby (the connection stays open). */
  showLobby(note = ''): void {
    $('lobby-left').append(this.status, $('online-back'));
    this.screen.hidden = false;
    $('online-choose').hidden = true;
    $('online-lobby').hidden = false;
    backLabel(t('online.leaveRoom'));
    $('online-room').textContent = this.code;
    this.lobby.render(note);
    this.syncRoom();
  }

  hide(): void {
    this.screen.hidden = true;
    if (this.you >= 0) updateRoom(this.code, false); // a round is starting: not joinable
  }

  /** The player leaves the room for the menu: a midgame ad first when in a room (never between rounds). */
  leave(): void {
    leaveRoom(this.connected, () => this.exit(''));
  }

  /** Leaves the room and tells main.ts. With a reason, the online screen stays up to show it. */
  exit(reason: string): void {
    this.net.leave();
    leftRoom();
    this.you = this.host = -1;
    this.players = [];
    if (reason) {
      this.open();
      this.setStatus(reason, true);
    } else {
      this.hide();
    }
    this.onExit(reason);
  }

  /** Host: start the next round (or a new match) with everyone in the room. */
  startRound(): void {
    if (!this.isHost || this.total < 2) return;
    // One start per tap burst: repeated taps would start (and count) several rounds.
    const now = performance.now();
    if (now - this.lastStart < 1500) return;
    this.lastStart = now;
    // Math.random only picks the seed; every browser gets the same one.
    this.net.send({ t: 'start', seed: (Math.random() * 0xffffffff) >>> 0 });
  }

  /** Any message to the room server. */
  send(msg: ClientMsg): void {
    this.net.send(msg);
  }

  sendInput(r: number, tick: number, c: number[]): void {
    this.net.send({ t: 'in', r, tick, c });
  }

  /** This browser's round is over (lets the server stop its clock). */
  sendOver(r: number): void {
    this.net.send({ t: 'over', r });
  }

  sendHash(r: number, tick: number, h: number): void {
    this.net.send({ t: 'hash', r, tick, h });
  }

  setStatus(text: string, error = false): void {
    this.status.textContent = text;
    this.status.classList.toggle('error', error);
  }
}
