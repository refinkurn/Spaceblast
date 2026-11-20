import type { Profile, RoomSettings, ServerMsg } from '../net/protocol';
import type { RoundStart } from './online';
import { savePrefs } from './online_prefs';

/** What the server message handler needs from the room screen (OnlineRoom in online.ts). */
export interface MessageHost {
  you: number;
  host: number;
  players: Profile[];
  settings: RoomSettings;
  code: string;
  where: string;
  prefs: { name: string; color: number };
  readonly screenOpen: boolean;
  showLobby(note?: string): void;
  hide(): void;
  renderAndSync(): void;
  onRoundStart: (s: RoundStart) => void;
  onFrames: (r: number, tick: number, c: number[][]) => void;
  onLeft: (slot: number) => void;
  onAway: (slot: number, away: boolean) => void;
  onHash: (r: number, tick: number, h: number) => void;
}

/** One message from the room server: updates the room and calls its callbacks. */
export function handleServerMsg(room: MessageHost, m: ServerMsg): void {
  switch (m.t) {
    case 'welcome': {
      const back = room.you === m.you && room.code !== '' && !room.screenOpen;
      room.you = m.you;
      room.host = m.host;
      room.players = m.players;
      room.settings = m.settings;
      room.where = m.where ?? '';
      // Reconnected mid-match: stay in the game (a resume follows) instead of the lobby.
      if (!back) room.showLobby(m.playing ? 'A match is on. You will join from the next round.' : '');
      break;
    }
    case 'profile': {
      const others = room.players.filter((p) => p.slot !== m.player.slot);
      room.players = [...others, m.player].sort((a, b) => a.slot - b.slot);
      if (m.player.slot === room.you) {
        room.prefs.color = m.player.color;
        savePrefs(room.prefs.name, m.player.color);
      }
      if (room.screenOpen) room.renderAndSync();
      break;
    }
    case 'settings':
      room.settings = m.s;
      if (room.screenOpen) room.renderAndSync();
      break;
    case 'left':
      room.players = room.players.filter((p) => p.slot !== m.slot);
      room.host = m.host;
      if (room.screenOpen) room.renderAndSync();
      room.onLeft(m.slot);
      break;
    case 'away':
      room.onAway(m.slot, m.away);
      break;
    case 'start': {
      const local = m.players.findIndex((p) => p.slot === room.you);
      room.settings = m.settings;
      if (local < 0) return; // joined mid-match: wait for the next round
      room.hide();
      room.onRoundStart({ r: m.r, seed: m.seed, players: m.players, settings: m.settings, local });
      break;
    }
    case 'f':
      room.onFrames(m.r, m.tick, m.c);
      break;
    case 'resume': {
      const local = m.players.findIndex((p) => p.slot === room.you);
      if (local < 0) return;
      room.hide();
      room.onRoundStart({ r: m.r, seed: m.seed, players: m.players, settings: m.settings, local, frames: m.c });
      break;
    }
    case 'hash':
      room.onHash(m.r, m.tick, m.h);
      break;
    case 'error':
      break;
  }
}
