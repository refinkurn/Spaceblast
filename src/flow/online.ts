import { randomCode } from '../net/client';
import { RoomLink, savedSeat } from '../net/link';
import {
  CODE_LETTERS, DEFAULT_SETTINGS, MAX_PLAYERS, PLAYER_COLORS, isRoomCode,
  type Profile, type RoomSettings, type ServerMsg,
} from '../net/protocol';
import { shareInvite } from './invite';
import { ROUND_SECONDS } from '../sim/constants';
import { botColorsFor, botsAfterTap, lobbySlots } from './lobby_slots';

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

const ERRORS: Record<string, string> = {
  taken: 'That code is already in use.',
  not_found: 'No room with that code. Check the letters.',
  full: 'That room is full (4 players).',
  bad_code: 'Room codes are 4 letters.',
  expired: 'That game has moved on without you.',
};

const PREFS_KEY = 'spaceblast.online';

function loadPrefs(): { name: string; color: number } {
  try {
    return { name: '', color: -1, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return { name: '', color: -1 };
  }
}

function savePrefs(name: string, color: number): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ name, color })); } catch { /* private mode */ }
}

const timeLabel = (s: number) => (s < 120 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

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
  private screen = $('online');
  private status = $('online-status');
  private codeInput = $<HTMLInputElement>('online-code');
  private nameInput = $<HTMLInputElement>('online-name');
  private prefs = loadPrefs();
  private lastStart = -Infinity;

  constructor() {
    this.net.onMessage = (m) => this.handle(m);
    this.net.onLost = (reason) => this.exit(reason);
    this.net.onReconnecting = (on) => this.onReconnecting(on);
    $('online-rejoin').addEventListener('click', () => this.rejoinSaved());
    this.nameInput.value = this.prefs.name;
    $('online-create').addEventListener('click', () => this.create());
    $('online-invite').addEventListener('click', async () => {
      const note = await shareInvite(this.code);
      $('online-invite-note').textContent = note;
      if (note) setTimeout(() => { $('online-invite-note').textContent = ''; }, 4000);
    });
    $('online-join').addEventListener('click', () => this.join(this.codeInput.value));
    this.codeInput.addEventListener('input', () => {
      this.codeInput.value = [...this.codeInput.value.toUpperCase()].filter((c) => CODE_LETTERS.includes(c)).join('');
    });
    for (const input of [this.codeInput, this.nameInput]) {
      // Typing must not move the astronaut (keyboard controls listen on window).
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') input === this.codeInput ? this.join(this.codeInput.value) : this.codeInput.focus();
      });
    }
    $('online-start').addEventListener('click', () => this.startRound());
    $('online-back').addEventListener('click', () => this.exit(''));
    this.buildLobbyControls();
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
    $('online-back').textContent = 'Back';
    this.setStatus('');
    // After a page reload mid-match: offer to get back into the seat.
    const seat = savedSeat();
    const rejoin = $('online-rejoin');
    rejoin.hidden = !seat;
    if (seat) rejoin.textContent = `Rejoin room ${seat.code}`;
  }

  /** An invite link was opened: fill in the code and focus the name. Joins only on Join. */
  prefillCode(code: string): void {
    this.codeInput.value = code;
    this.nameInput.focus();
  }

  /** Back to the lobby (the connection stays open). */
  showLobby(note = ''): void {
    $('lobby-left').append(this.status, $('online-back'));
    this.screen.hidden = false;
    $('online-choose').hidden = true;
    $('online-lobby').hidden = false;
    $('online-back').textContent = 'Leave room';
    $('online-room').textContent = this.code;
    this.renderLobby(note);
  }

  hide(): void {
    this.screen.hidden = true;
  }

  /** Leaves the room and tells main.ts. With a reason, the online screen stays up to show it. */
  exit(reason: string): void {
    this.net.leave();
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

  private me(): Profile | undefined {
    return this.players.find((p) => p.slot === this.you);
  }

  private typedName(): string {
    const name = this.nameInput.value.trim();
    savePrefs(name, this.prefs.color);
    this.prefs.name = name;
    return name;
  }

  /** True while creating or joining: extra taps are ignored. */
  private busy = false;

  private async create(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.setStatus('Creating room…');
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const ok = await this.connect(randomCode(), true);
        if (ok !== 'taken') return;
      }
      this.setStatus('Could not create a room. Try again.', true);
    } finally {
      this.busy = false;
    }
  }

  private async join(raw: string): Promise<void> {
    if (this.busy) return;
    const code = raw.trim().toUpperCase();
    if (!isRoomCode(code)) {
      this.setStatus(ERRORS.bad_code, true);
      return;
    }
    this.busy = true;
    this.setStatus('Joining…');
    try {
      await this.connect(code, false);
    } finally {
      this.busy = false;
    }
  }

  /** After a page reload: back into the saved seat. */
  private async rejoinSaved(): Promise<void> {
    const seat = savedSeat();
    if (!seat || this.busy) return;
    this.busy = true;
    this.code = seat.code;
    this.setStatus('Rejoining…');
    try {
      const first = await this.net.rejoin(seat);
      if (first.t === 'error') this.setStatus(ERRORS[first.reason] ?? first.reason, true);
    } catch {
      this.setStatus('Could not reach the room server.', true);
    } finally {
      this.busy = false;
    }
  }

  /** Returns 'ok', an error reason, or 'offline'. */
  private async connect(code: string, create: boolean): Promise<string> {
    this.code = code; // the welcome (and the lobby) can arrive before connect() resolves
    try {
      const first = await this.net.connect(code, create, this.typedName(), this.prefs.color);
      if (first.t === 'error') {
        if (first.reason !== 'taken' || !create) this.setStatus(ERRORS[first.reason] ?? first.reason, true);
        return first.reason;
      }
      return 'ok';
    } catch {
      this.setStatus('Could not reach the room server. Online play needs the hosted version of the game (see ONLINE.md).', true);
      return 'offline';
    }
  }

  private handle(m: ServerMsg): void {
    switch (m.t) {
      case 'welcome': {
        const back = this.you === m.you && this.code !== '' && !this.screenOpen;
        this.you = m.you;
        this.host = m.host;
        this.players = m.players;
        this.settings = m.settings;
        this.where = m.where ?? '';
        // Reconnected mid-match: stay in the game (a resume follows) instead of the lobby.
        if (!back) this.showLobby(m.playing ? 'A match is on. You will join from the next round.' : '');
        break;
      }
      case 'profile': {
        const others = this.players.filter((p) => p.slot !== m.player.slot);
        this.players = [...others, m.player].sort((a, b) => a.slot - b.slot);
        if (m.player.slot === this.you) {
          this.prefs.color = m.player.color;
          savePrefs(this.prefs.name, m.player.color);
        }
        if (this.screenOpen) this.renderLobby();
        break;
      }
      case 'settings':
        this.settings = m.s;
        if (this.screenOpen) this.renderLobby();
        break;
      case 'left':
        this.players = this.players.filter((p) => p.slot !== m.slot);
        this.host = m.host;
        if (this.screenOpen) this.renderLobby();
        this.onLeft(m.slot);
        break;
      case 'away':
        this.onAway(m.slot, m.away);
        break;
      case 'start': {
        const local = m.players.findIndex((p) => p.slot === this.you);
        this.settings = m.settings;
        if (local < 0) return; // joined mid-match: wait for the next round
        this.hide();
        this.onRoundStart({ r: m.r, seed: m.seed, players: m.players, settings: m.settings, local });
        break;
      }
      case 'f':
        this.onFrames(m.r, m.tick, m.c);
        break;
      case 'resume': {
        const local = m.players.findIndex((p) => p.slot === this.you);
        if (local < 0) return;
        this.hide();
        this.onRoundStart({ r: m.r, seed: m.seed, players: m.players, settings: m.settings, local, frames: m.c });
        break;
      }
      case 'hash':
        this.onHash(m.r, m.tick, m.h);
        break;
      case 'error':
        break;
    }
  }

  // --- Lobby ----------------------------------------------------------------------

  private buildLobbyControls(): void {
    const swatches = $('online-colors');
    PLAYER_COLORS.forEach((color, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.background = color;
      b.setAttribute('aria-label', `Colour ${i + 1}`);
      b.addEventListener('click', () => this.net.send({ t: 'profile', name: this.me()?.name ?? '', color: i }));
      swatches.append(b);
    });
    const times = $('set-time');
    for (const s of ROUND_SECONDS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = timeLabel(s);
      b.dataset.time = String(s);
      b.addEventListener('click', () => this.changeSettings({ time: s }));
      times.append(b);
    }
    $('set-maze').addEventListener('click', () => this.changeSettings({ maze: !this.settings.maze }));
    $('set-blackout').addEventListener('click', () => this.changeSettings({ blackout: !this.settings.blackout }));
    for (const el of $('set-match').children) {
      const b = el as HTMLButtonElement;
      b.addEventListener('click', () => this.changeSettings({ match: b.dataset.match as RoomSettings['match'] }));
    }
    for (const el of $('set-bot-level').children) {
      const b = el as HTMLButtonElement;
      b.addEventListener('click', () => this.changeSettings({ botLevel: b.dataset.level as RoomSettings['botLevel'] }));
    }
  }

  private changeSettings(change: Partial<RoomSettings>): void {
    if (!this.isHost) return;
    this.net.send({ t: 'settings', s: { ...this.settings, ...change } });
  }

  private renderLobby(note = ''): void {
    this.renderSlots();

    const mine = this.me()?.color;
    [...$('online-colors').children].forEach((el, i) => {
      const b = el as HTMLButtonElement;
      b.setAttribute('aria-pressed', String(i === mine));
      b.disabled = i !== mine && this.players.some((p) => p.color === i);
    });

    const host = this.isHost;
    $('settings-label').textContent = host ? 'Match settings' : 'Match settings (the host picks)';
    for (const el of $('set-time').children) {
      const b = el as HTMLButtonElement;
      b.setAttribute('aria-pressed', String(Number(b.dataset.time) === this.settings.time));
      b.disabled = !host;
    }
    const toggle = (id: string, on: boolean) => {
      $(id).setAttribute('aria-pressed', String(on));
      $<HTMLButtonElement>(id).disabled = !host;
    };
    for (const el of $('set-match').children) {
      const b = el as HTMLButtonElement;
      b.setAttribute('aria-pressed', String(b.dataset.match === this.settings.match));
      b.disabled = !host;
    }
    for (const el of $('set-bot-level').children) {
      const b = el as HTMLButtonElement;
      b.setAttribute('aria-pressed', String(b.dataset.level === this.settings.botLevel));
      b.disabled = !host || this.settings.bots === 0;
    }
    toggle('set-maze', this.settings.maze);
    toggle('set-blackout', this.settings.blackout);

    const start = $<HTMLButtonElement>('online-start');
    start.hidden = !host;
    start.disabled = this.total < 2;
    const waiting = this.total < 2
      ? `Share the code, or add a bot. ${this.players.length}/${MAX_PLAYERS} players.`
      : host ? `${this.total} astronauts ready.` : 'Waiting for the host to start…';
    this.setStatus(note || waiting);
  }

  /** The four slot cards. The host taps OPEN to add a bot and BOT to remove one. */
  private renderSlots(): void {
    const box = $('online-slots');
    box.innerHTML = '';
    const slots = lobbySlots(this.players, this.settings.bots, this.host, this.you);
    for (const slot of slots) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `slot ${slot.kind}`;
      const next = botsAfterTap(slot, this.settings.bots);
      card.disabled = !this.isHost || next === null;
      if (next !== null && this.isHost) {
        card.setAttribute('aria-label', slot.kind === 'open' ? `${slot.label}: add a bot` : `${slot.label}: remove ${slot.name}`);
        card.addEventListener('click', () => this.changeSettings({ bots: next }));
      }
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = slot.color || 'transparent';
      const name = document.createElement('span');
      name.className = 'slot-name';
      name.textContent = slot.you ? `${slot.name} (you)` : slot.name;
      const tag = document.createElement('span');
      tag.className = 'slot-tag';
      tag.textContent = slot.tag;
      const label = document.createElement('span');
      label.className = 'slot-label';
      label.textContent = slot.label;
      card.append(label, dot, name, tag);
      box.append(card);
    }
  }

  private setStatus(text: string, error = false): void {
    this.status.textContent = text;
    this.status.classList.toggle('error', error);
  }
}
