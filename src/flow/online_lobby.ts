import { MAX_PLAYERS, PLAYER_COLORS, type Profile, type RoomSettings } from '../net/protocol';
import type { RoomLink } from '../net/link';
import { dragScroll } from './drag_scroll';
import { botsAfterTap, lobbySlots } from './lobby_slots';
import { arenaOptions, botLevelOptions, matchOptions, scenarioFlags, scenarioOf, scenarioOptions, timeOptions, type Scenario } from './online_options';
import { Stepper } from './stepper';
import { t } from '../utils/i18n';

// The lobby screen's contents: seat tiles, colour swatches and the host's match settings.

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** What the lobby needs from the room it shows. */
export interface LobbyHost {
  readonly players: Profile[];
  readonly settings: RoomSettings;
  readonly host: number;
  readonly you: number;
  readonly isHost: boolean;
  readonly total: number;
  send(msg: Parameters<RoomLink['send']>[0]): void;
  setStatus(text: string, error?: boolean): void;
}

export class LobbyView {
  constructor(private room: LobbyHost) {}

  private me(): Profile | undefined {
    return this.room.players.find((p) => p.slot === this.room.you);
  }

  private steppers!: {
    arena: Stepper<RoomSettings['arena']>;
    time: Stepper<number>;
    scenario: Stepper<Scenario>;
    match: Stepper<RoomSettings['match']>;
    botLevel: Stepper<RoomSettings['botLevel']>;
  };

  buildControls(): void {
    const swatches = $('online-colors');
    PLAYER_COLORS.forEach((color, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.background = color;
      b.setAttribute('aria-label', t('online.colour', { n: i + 1 }));
      b.addEventListener('click', () => this.room.send({ t: 'profile', name: this.me()?.name ?? '', color: i }));
      swatches.append(b);
    });
    // Mouse: wheel and drag scroll the colour strip sideways (a finger swipes it natively).
    dragScroll(swatches);
    // Match options: one ‹ value › selector each (the host steps; guests see the host's pick).
    this.steppers = {
      arena: new Stepper($('set-arena'), arenaOptions(), (arena) => this.changeSettings({ arena }), t('lobby.opt.arena')),
      time: new Stepper($('set-time'), timeOptions(), (time) => this.changeSettings({ time }), t('lobby.opt.time')),
      scenario: new Stepper<Scenario>($('set-scenario'), scenarioOptions(), (sc) => this.changeSettings(scenarioFlags(sc)), t('lobby.opt.scenarios')),
      match: new Stepper($('set-match'), matchOptions(), (match) => this.changeSettings({ match }), t('lobby.opt.match')),
      botLevel: new Stepper($('set-bot-level'), botLevelOptions(), (botLevel) => this.changeSettings({ botLevel }), t('lobby.opt.botLevel')),
    };
  }

  changeSettings(change: Partial<RoomSettings>): void {
    if (!this.room.isHost) return;
    this.room.send({ t: 'settings', s: { ...this.room.settings, ...change } });
  }

  render(note = ''): void {
    this.renderSlots();

    const mine = this.me()?.color;
    [...$('online-colors').children].forEach((el, i) => {
      const b = el as HTMLButtonElement;
      b.setAttribute('aria-pressed', String(i === mine));
      b.disabled = i !== mine && this.room.players.some((p) => p.color === i);
    });

    const host = this.room.isHost;
    $('settings-label').textContent = host ? t('online.matchSettings') : t('online.matchSettingsGuest');
    const st = this.steppers;
    st.arena.set(this.room.settings.arena);
    st.time.set(this.room.settings.time);
    st.scenario.set(scenarioOf(this.room.settings));
    st.match.set(this.room.settings.match);
    st.botLevel.set(this.room.settings.botLevel);
    st.arena.disabled = st.time.disabled = st.scenario.disabled = st.match.disabled = !host;
    // Bot level only matters with a bot in the room.
    st.botLevel.disabled = !host || this.room.settings.bots === 0;

    const start = $<HTMLButtonElement>('online-start');
    start.hidden = !host;
    start.disabled = this.room.total < 2;
    const waiting = this.room.total < 2
      ? t('online.shareCode', { n: this.room.players.length, max: MAX_PLAYERS })
      : host ? t('online.ready', { n: this.room.total }) : t('online.waitingHostStart');
    this.room.setStatus(note || waiting);
  }

  /** The four seat tiles in one row. The host taps an open seat (+) to add a bot and a bot to remove it. */
  private renderSlots(): void {
    const box = $('online-slots');
    box.innerHTML = '';
    const slots = lobbySlots(this.room.players, this.room.settings.bots, this.room.host, this.room.you);
    for (const slot of slots) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `slot ${slot.kind}`;
      const next = botsAfterTap(slot, this.room.settings.bots);
      card.disabled = !this.room.isHost || next === null;
      if (next !== null && this.room.isHost) card.addEventListener('click', () => this.changeSettings({ bots: next }));
      card.classList.toggle('you', slot.you);
      // Spoken / hover name: the tile itself only shows P#, initials (or a bot icon, or +) and the host star.
      const host = slot.host ? `, ${t('lobby.tag.host')}` : '';
      const spoken = next !== null && this.room.isHost
        ? (slot.kind === 'open' ? `${slot.label}: ${t('lobby.addBot')}` : `${slot.label}: ${slot.name} (${t('lobby.removeBot')})`)
        : `${slot.label}: ${slot.name}${host}`;
      card.setAttribute('aria-label', spoken);
      card.title = spoken;
      const label = document.createElement('span');
      label.className = 'slot-label';
      label.textContent = slot.label;
      const face = document.createElement('span');
      face.className = 'slot-face';
      face.setAttribute('aria-hidden', 'true');
      if (slot.color) face.style.setProperty('--seat', slot.color);
      if (slot.kind === 'player') face.textContent = slot.initials;
      else face.innerHTML = `<svg class="ui-icon"><use href="#${slot.kind === 'bot' ? 'i-bot' : 'i-plus'}"/></svg>`;
      card.append(label, face);
      if (slot.host) {
        const star = document.createElement('span');
        star.className = 'slot-star';
        star.setAttribute('aria-hidden', 'true');
        star.innerHTML = '<svg class="ui-icon"><use href="#i-credits"/></svg>';
        card.append(star);
      }
      box.append(card);
    }
  }
}
