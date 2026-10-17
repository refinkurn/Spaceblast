import { NetClient, randomCode } from '../net/client';
import { CLOSE_AWAY, CODE_LETTERS, isRoomCode, MAX_PLAYERS, type ServerMsg } from '../net/protocol';

// The "Play online" screens: create or join a room, then the lobby where the
// host starts the match. During a match main.ts gets the inputs through the
// callbacks below.

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** CSS colours of the 4 astronauts (same order as the hero models). */
export const PLAYER_COLORS = ['#3a7bff', '#ff6a3d', '#4fd17a', '#c77dff'];

export interface RoundStart {
  r: number;
  seed: number;
  /** Room slots in sim player order. */
  slots: number[];
  /** This browser's sim player id. */
  local: number;
}

const ERRORS: Record<string, string> = {
  taken: 'That code is already in use.',
  not_found: 'No room with that code. Check the letters.',
  full: 'That room is full (4 players).',
  bad_code: 'Room codes are 4 letters.',
};

export class OnlineRoom {
  onRoundStart: (s: RoundStart) => void = () => {};
  onInput: (slot: number, r: number, tick: number, c: number[]) => void = () => {};
  onLeft: (slot: number, lastTick: number) => void = () => {};
  onHash: (r: number, tick: number, h: number) => void = () => {};
  /** The room was closed: by Back/Leave (reason '') or a dropped connection. */
  onExit: (reason: string) => void = () => {};

  you = -1;
  host = -1;
  slots: number[] = [];
  code = '';
  private net = new NetClient();
  private screen = $('online');
  private status = $('online-status');
  private codeInput = $<HTMLInputElement>('online-code');

  constructor() {
    this.net.onMessage = (m) => this.handle(m);
    this.net.onDrop = (code) =>
      this.exit(code === CLOSE_AWAY ? 'You were away from the game too long, so you left the room.' : 'Connection to the room was lost.');
    $('online-create').addEventListener('click', () => this.create());
    $('online-join').addEventListener('click', () => this.join(this.codeInput.value));
    this.codeInput.addEventListener('input', () => {
      this.codeInput.value = [...this.codeInput.value.toUpperCase()].filter((c) => CODE_LETTERS.includes(c)).join('');
    });
    this.codeInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.join(this.codeInput.value);
    });
    $('online-start').addEventListener('click', () => this.startRound());
    $('online-back').addEventListener('click', () => this.exit(''));
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

  /** Shows the create / join choice. */
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
    this.slots = [];
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
    if (!this.isHost || this.slots.length < 2) return;
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

  private async create(): Promise<void> {
    this.setStatus('Creating room…');
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const ok = await this.connect(code, true);
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
      const first = await this.net.connect(code, create);
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
        this.slots = m.slots;
        this.showLobby(m.playing ? 'A match is on. You will join from the next round.' : '');
        break;
      case 'joined':
        this.slots = [...this.slots, m.slot].sort((a, b) => a - b);
        if (this.screenOpen) this.renderLobby();
        break;
      case 'left':
        this.slots = this.slots.filter((s) => s !== m.slot);
        this.host = m.host;
        if (this.screenOpen) this.renderLobby();
        this.onLeft(m.slot, m.lastTick);
        break;
      case 'start':
        if (!m.slots.includes(this.you)) return;
        this.hide();
        this.onRoundStart({ r: m.r, seed: m.seed, slots: m.slots, local: m.slots.indexOf(this.you) });
        break;
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

  private renderLobby(note = ''): void {
    const list = $('online-players');
    list.innerHTML = '';
    for (const slot of this.slots) {
      const li = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = PLAYER_COLORS[slot];
      const tags = [slot === this.you ? 'you' : '', slot === this.host ? 'host' : ''].filter(Boolean).join(', ');
      li.append(dot, `Player ${slot + 1}${tags ? ` (${tags})` : ''}`);
      list.append(li);
    }
    const start = $<HTMLButtonElement>('online-start');
    start.hidden = !this.isHost;
    start.disabled = this.slots.length < 2;
    const waiting = this.slots.length < 2
      ? `Share the code. Waiting for players (${this.slots.length}/${MAX_PLAYERS})…`
      : this.isHost ? `${this.slots.length} players ready.` : 'Waiting for the host to start…';
    this.setStatus(note || waiting);
  }

  private setStatus(text: string, error = false): void {
    this.status.textContent = text;
    this.status.classList.toggle('error', error);
  }
}
