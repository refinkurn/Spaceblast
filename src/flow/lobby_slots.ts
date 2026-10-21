import { MAX_PLAYERS, PLAYER_COLORS, type Profile } from '../net/protocol';
import { t } from '../utils/i18n';

/** One of the lobby's four slot cards: seated players first, then bots, then OPEN. */
export interface LobbySlot {
  kind: 'player' | 'bot' | 'open';
  /** "P1".."P4". */
  label: string;
  name: string;
  /** CSS colour, '' for an open slot. */
  color: string;
  /** "HOST", "BOT" or "OPEN" (a joined guest has none). */
  tag: string;
  you: boolean;
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
    if (p) return { kind: 'player', label, name: p.name, color: PLAYER_COLORS[p.color], tag: p.slot === host ? t('lobby.tag.host') : '', you: p.slot === you };
    const b = i - players.length;
    if (b < bots) return { kind: 'bot', label, name: t('lobby.bot', { n: b + 1 }), color: PLAYER_COLORS[botColors[b]], tag: t('lobby.tag.bot'), you: false };
    return { kind: 'open', label, name: t('lobby.open'), color: '', tag: t('lobby.tag.open'), you: false };
  });
}

/** What a host tap on a slot changes: OPEN adds a bot, BOT removes one, a player does nothing. */
export function botsAfterTap(slot: LobbySlot, bots: number): number | null {
  if (slot.kind === 'open') return bots + 1;
  if (slot.kind === 'bot') return bots - 1;
  return null;
}
