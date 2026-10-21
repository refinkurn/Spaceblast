import { describe, expect, it } from 'vitest';
import { PLAYER_COLORS } from '../net/protocol';
import { botColorsFor, botsAfterTap, lobbySlots } from './lobby_slots';

const players = [{ slot: 0, name: 'Ana', color: 0 }, { slot: 1, name: 'Ben', color: 1 }];

describe('lobby slot cards', () => {
  it('always shows 4 slots: players, then bots, then OPEN', () => {
    const slots = lobbySlots(players, 1, 0, 1);
    expect(slots.map((s) => s.kind)).toEqual(['player', 'player', 'bot', 'open']);
    expect(slots.map((s) => s.label)).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(slots[0].tag).toBe('HOST');
    expect(slots[1].you).toBe(true);
    expect(slots[2]).toMatchObject({ name: 'Bot 1', tag: 'BOT', color: PLAYER_COLORS[botColorsFor(players)[0]] });
    expect(slots[3].tag).toBe('OPEN');
  });

  it('a 4th player joining takes the last slot and bots make room', () => {
    const four = [...players, { slot: 2, name: 'Cy', color: 2 }, { slot: 3, name: 'Di', color: 3 }];
    expect(lobbySlots(four, 0, 0, 0).every((s) => s.kind === 'player')).toBe(true);
  });

  it('tapping OPEN adds a bot, BOT removes one, a player does nothing', () => {
    const slots = lobbySlots(players, 1, 0, 0);
    expect(botsAfterTap(slots[3], 1)).toBe(2);
    expect(botsAfterTap(slots[2], 1)).toBe(0);
    expect(botsAfterTap(slots[0], 1)).toBeNull();
  });
});
