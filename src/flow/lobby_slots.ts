import { MAX_PLAYERS, PLAYER_COLORS, type Profile } from '../net/protocol';
import { t } from '../utils/i18n';

/** One of the lobby's four seat tiles: seated players first, then bots, then open seats. */
export interface LobbySlot {
  kind: 'player' | 'bot' | 'open';
  /** "P1".."P4". */
  label: string;
  /** Full name (spoken and shown on hover; the tile shows initials). */
  name: string;
  /** Two letters for the tile ("Ana Gold" -> "AG", "Refindo" -> "RE"); '' for bots and open seats. */
  initials: string;
  /** CSS colour, '' for an open slot. */
  color: string;
  /** The room host (star on the tile). */
  host: boolean;
  you: boolean;
}

/** Two letters from a name: the first letters of the first two words, or the first two letters of one word. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length > 1 ? [...words[0]][0] + [...words[1]][0] : [...words[0]].slice(0, 2).join('');
  return letters.toUpperCase();
}

/** Bots take the free colours in order, so every browser agrees. */
export function botColorsFor(players: Profile[]): number[] {
  return PLAYER_COLORS.map((_, i) => i).filter((i) => !players.some((p) => p.color === i));
}

export function lobbySlots(players: Profile[], bots: number, host: number, you: number): LobbySlot[] {
  const botColors = botColorsFor(players);
  return Array.from({ length: MAX_PLAYERS }, (_, i): LobbySlot => {
    const label = `P${i + 1}`;
    const p = players[i];
    if (p) return { kind: 'player', label, name: p.name, initials: initialsOf(p.name), color: PLAYER_COLORS[p.color], host: p.slot === host, you: p.slot === you };
    const b = i - players.length;
    if (b < bots) return { kind: 'bot', label, name: t('lobby.bot', { n: b + 1 }), initials: '', color: PLAYER_COLORS[botColors[b]], host: false, you: false };
    // An empty seat: the host can tap it to add a bot, everyone else sees it is open.
    return { kind: 'open', label, name: you === host ? t('lobby.addBot') : t('lobby.open'), initials: '', color: '', host: false, you: false };
  });
}

/** What a host tap on a slot changes: OPEN adds a bot, BOT removes one, a player does nothing. */
export function botsAfterTap(slot: LobbySlot, bots: number): number | null {
  if (slot.kind === 'open') return bots + 1;
  if (slot.kind === 'bot') return bots - 1;
  return null;
}
