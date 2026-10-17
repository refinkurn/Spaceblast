import { NetClient, randomCode } from '../net/client';
import {
  CLOSE_AWAY, CODE_LETTERS, DEFAULT_SETTINGS, MAX_PLAYERS, PLAYER_COLORS, isRoomCode,
  type Profile, type RoomSettings, type ServerMsg,
} from '../net/protocol';
import { ROUND_SECONDS } from '../sim/constants';

// The "Play online" screens: your name, create or join a room, then the lobby
// (colour, and the host's match settings). During a match main.ts gets the
// inputs through the callbacks below.

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface RoundStart {
  r: number;
  seed: number;
  /** Humans in sim player order; bots follow them. */
  players: Profile[];
  settings: RoomSettings;
  /** This browser's sim player id. */
  local: number;
}

const ERRORS: Record<string, string> = {
  taken: 'That code is already in use.',
  not_found: 'No room with that code. Check the letters.',
  full: 'That room is full (4 players).',
  bad_code: 'Room codes are 4 letters.',
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
  onInput: (slot: number, r: number, tick: number, c: number[]) => void = () => {};
  onLeft: (slot: number, lastTick: number) => void = () => {};
  onHash: (r: number, tick: number, h: number) => void = () => {};
  /** The room was closed: by Back/Leave (reason '') or a dropped connection. */
  onExit: (reason: string) => void = () => {};

  you = -1;
  host = -1;
  players: Profile[] = [];
  settings: RoomSettings = { ...DEFAULT_SETTINGS };
  code = '';
  private net = new NetClient();
  private screen = $('online');
  private status = $('online-status');
  private codeInput = $<HTMLInputElement>('online-code');
  private nameInput = $<HTMLInputElement>('online-name');
  private prefs = loadPrefs();

  constructor() {
    this.net.onMessage = (m) => this.handle(m);
    this.net.onDrop = (code) =>
      this.exit(code === CLOSE_AWAY ? 'You were away from the game too long, so you left the room.' : 'Connection to the room was lost.');
    this.nameInput.value = this.prefs.name;
    $('online-create').addEventListener('click', () => this.create());
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

  get connected(): boolean {
    return this.net.open;
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
    this.screen.hidden = false;
    $('online-choose').hidden = false;
    $('online-lobby').hidden = true;
    $('online-back').textContent = 'Back';
    this.setStatus('');
  }

  /** Back to the lobby (the connection stays open). */
  showLobby(note = ''): void {
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
    this.net.close();
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
    // Math.random only picks the seed; every browser gets the same one.
    this.net.send({ t: 'start', seed: (Math.random() * 0xffffffff) >>> 0 });
  }

  sendInput(r: number, tick: number, c: number[]): void {
    this.net.send({ t: 'in', r, tick, c });
  }

  /** Tells the room this browser's game is running (see Room.dropAway). */
  sendAlive(): void {
    this.net.send({ t: 'alive' });
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

  private async create(): Promise<void> {
    this.setStatus('Creating room…');
    for (let attempt = 0; attempt < 5; attempt++) {
      const ok = await this.connect(randomCode(), true);
      if (ok !== 'taken') return;
    }
    this.setStatus('Could not create a room. Try again.', true);
  }

  private async join(raw: string): Promise<void> {
    const code = raw.trim().toUpperCase();
    if (!isRoomCode(code)) {
      this.setStatus(ERRORS.bad_code, true);
      return;
    }
    this.setStatus('Joining…');
    await this.connect(code, false);
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
      case 'welcome':
        this.you = m.you;
        this.host = m.host;
        this.players = m.players;
        this.settings = m.settings;
        this.showLobby(m.playing ? 'A match is on. You will join from the next round.' : '');
        break;
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
        this.onLeft(m.slot, m.lastTick);
        break;
      case 'start': {
        const local = m.players.findIndex((p) => p.slot === this.you);
        this.settings = m.settings;
        if (local < 0) return; // joined mid-match: wait for the next round
        this.hide();
        this.onRoundStart({ r: m.r, seed: m.seed, players: m.players, settings: m.settings, local });
        break;
      }
      case 'in':
        this.onInput(m.slot, m.r, m.tick, m.c);
        break;
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
    $('bots-less').addEventListener('click', () => this.changeSettings({ bots: this.settings.bots - 1 }));
    $('bots-more').addEventListener('click', () => this.changeSettings({ bots: this.settings.bots + 1 }));
  }

  private changeSettings(change: Partial<RoomSettings>): void {
    if (!this.isHost) return;
    this.net.send({ t: 'settings', s: { ...this.settings, ...change } });
  }

  private renderLobby(note = ''): void {
    const list = $('online-players');
    list.innerHTML = '';
    const chip = (color: string, text: string, bot = false) => {
      const li = document.createElement('li');
      li.classList.toggle('bot', bot);
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = color;
      li.append(dot, text);
      list.append(li);
    };
    for (const p of this.players) {
      const tags = [p.slot === this.you ? 'you' : '', p.slot === this.host ? 'host' : ''].filter(Boolean).join(', ');
      chip(PLAYER_COLORS[p.color], `${p.name}${tags ? ` (${tags})` : ''}`);
    }
    const botColors = botColorsFor(this.players);
    for (let i = 0; i < this.settings.bots; i++) chip(PLAYER_COLORS[botColors[i]], `Bot ${i + 1}`, true);

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
    toggle('set-maze', this.settings.maze);
    toggle('set-blackout', this.settings.blackout);
    $('bots-count').textContent = String(this.settings.bots);
    $<HTMLButtonElement>('bots-less').disabled = !host || this.settings.bots <= 0;
    $<HTMLButtonElement>('bots-more').disabled = !host || this.total >= MAX_PLAYERS;

    const start = $<HTMLButtonElement>('online-start');
    start.hidden = !host;
    start.disabled = this.total < 2;
    const waiting = this.total < 2
      ? `Share the code, or add a bot. ${this.players.length}/${MAX_PLAYERS} players.`
      : host ? `${this.total} astronauts ready.` : 'Waiting for the host to start…';
    this.setStatus(note || waiting);
  }

  private setStatus(text: string, error = false): void {
    this.status.textContent = text;
    this.status.classList.toggle('error', error);
  }
}

/** Bots take the free colours in order, so every browser agrees. */
export function botColorsFor(players: Profile[]): number[] {
  return PLAYER_COLORS.map((_, i) => i).filter((i) => !players.some((p) => p.color === i));
}
