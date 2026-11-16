import { afterEach, describe, expect, it, vi } from 'vitest';
import { canJoinFromUi, sdkEntry } from '../flow/crazy_join';
import { CODE_LENGTH, CODE_LETTERS } from '../net/protocol';
import { initCrazySdk, resetCrazySdk, type CrazySdk } from './crazygames';
import { isInstantMultiplayer, leftRoom, onJoinRoom, onMuteAudio, resetCrazyRoom, updateRoom } from './crazygames_room';

const ok = () => Promise.resolve();
const code = CODE_LETTERS.slice(0, CODE_LENGTH);

type Listener = (p: Record<string, unknown> | null | undefined) => void;

function make() {
  const calls: unknown[] = [];
  let listener: Listener | null = null;
  const sdk: CrazySdk = {
    init: ok,
    environment: 'crazygames',
    game: {
      updateRoom: (d) => { calls.push(d); },
      leftRoom: () => { calls.push('left'); },
      addJoinRoomListener: (l) => { listener = l; },
    },
  };
  return { sdk, calls, fire: (p: Record<string, unknown> | null) => listener?.(p) };
}

const ready = (sdk: CrazySdk) => initCrazySdk({ enabled: true, load: ok, find: () => sdk });

afterEach(() => { resetCrazySdk(); resetCrazyRoom(); vi.restoreAllMocks(); });

describe('room data', () => {
  it('lobby: joinable; round start: not joinable; full: not joinable; same state is not repeated', async () => {
    const { sdk, calls } = make();
    await ready(sdk);
    updateRoom(code, true);
    updateRoom(code, true);
    updateRoom(code, false); // a round starts
    updateRoom(code, true); // back in the lobby
    updateRoom(code, false); // room full
    expect(calls).toEqual([
      { roomId: code, isJoinable: true, inviteParams: { roomId: code } },
      { roomId: code, isJoinable: false, inviteParams: { roomId: code } },
      { roomId: code, isJoinable: true, inviteParams: { roomId: code } },
      { roomId: code, isJoinable: false, inviteParams: { roomId: code } },
    ]);
  });

  it('leaving calls leftRoom once, and only after a room was announced', async () => {
    const { sdk, calls } = make();
    await ready(sdk);
    leftRoom();
    expect(calls).toEqual([]);
    updateRoom(code, true);
    leftRoom();
    leftRoom();
    expect(calls.filter((c) => c === 'left')).toHaveLength(1);
    updateRoom(code, true); // a new room with the same code is announced again
    expect(calls).toHaveLength(3);
  });

  it('makes no call on our own site, before init, or without a code', async () => {
    const { sdk, calls } = make();
    updateRoom(code, true); // no SDK yet
    await initCrazySdk({ enabled: false, load: ok, find: () => sdk });
    updateRoom(code, true);
    leftRoom();
    onJoinRoom(() => {});
    expect(calls).toEqual([]);
    resetCrazySdk();
    await ready(sdk);
    updateRoom('', true);
    expect(calls).toEqual([]);
  });

  it('a throwing SDK never breaks the game', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sdk } = make();
    sdk.game!.updateRoom = () => { throw new Error('x'); };
    sdk.game!.leftRoom = () => { throw new Error('y'); };
    await ready(sdk);
    expect(() => updateRoom(code, true)).not.toThrow();
    expect(() => leftRoom()).not.toThrow();
  });
});

describe('join-room listener', () => {
  it('hands over a valid code (upper-cased) and ignores bad ones', async () => {
    const { sdk, fire } = make();
    await ready(sdk);
    const got: string[] = [];
    onJoinRoom((c) => got.push(c));
    fire({ roomId: code.toLowerCase() });
    fire({ roomId: '<script>' });
    fire({});
    fire(null);
    expect(got).toEqual([code]);
  });

  it('registers once even if asked twice, and waits for the SDK', async () => {
    const { sdk, fire } = make();
    const got: string[] = [];
    onJoinRoom((c) => got.push(c)); // before init
    await ready(sdk);
    onJoinRoom((c) => got.push(c)); // second ask: no second listener
    fire({ roomId: code });
    expect(got).toEqual([code]);
  });

  it('a throwing handler does not escape', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sdk, fire } = make();
    await ready(sdk);
    onJoinRoom(() => { throw new Error('x'); });
    expect(() => fire({ roomId: code })).not.toThrow();
  });
});

describe('when a join from the CrazyGames UI is followed', () => {
  const idle = { inRoom: false, menuOpen: false, storyMapOpen: false, onlineScreenOpen: false };
  it('in the menu, the Story map or the Multiplayer screen: yes', () => {
    expect(canJoinFromUi({ ...idle, menuOpen: true })).toBe(true);
    expect(canJoinFromUi({ ...idle, storyMapOpen: true })).toBe(true);
    expect(canJoinFromUi({ ...idle, onlineScreenOpen: true })).toBe(true);
  });
  it('during play (a Story level, Battle vs Bot, an online round) or when already in a room: no', () => {
    expect(canJoinFromUi(idle)).toBe(false);
    expect(canJoinFromUi({ ...idle, menuOpen: true, inRoom: true })).toBe(false);
  });
});

describe('Instant Multiplayer', () => {
  it('reads the flag after init; false without the SDK or when not set', async () => {
    expect(isInstantMultiplayer()).toBe(false); // no SDK yet
    const { sdk } = make();
    await ready(sdk);
    expect(isInstantMultiplayer()).toBe(false); // not set
    resetCrazySdk();
    sdk.game!.isInstantMultiplayer = true;
    await ready(sdk);
    expect(isInstantMultiplayer()).toBe(true);
    resetCrazySdk();
    await initCrazySdk({ enabled: false, load: ok, find: () => sdk }); // our own site
    expect(isInstantMultiplayer()).toBe(false);
  });

  it('instant creates a room, an invite wins over it, neither does nothing', () => {
    expect(sdkEntry(null, true)).toBe('create');
    expect(sdkEntry(code, true)).toEqual({ join: code });
    expect(sdkEntry(code, false)).toEqual({ join: code });
    expect(sdkEntry(null, false)).toBeNull();
  });
});

describe('muteAudio setting', () => {
  type SettingsListener = (s: { muteAudio?: boolean } | null | undefined) => void;
  function withSettings(muteAudio: boolean | undefined) {
    const { sdk } = make();
    let change: SettingsListener | null = null;
    sdk.game!.settings = { muteAudio };
    sdk.game!.addSettingsChangeListener = (l) => { change = l; };
    return { sdk, change: (s: { muteAudio?: boolean } | null) => change?.(s) };
  }

  it('on at start: told true; off or missing: told false', async () => {
    for (const [value, expected] of [[true, true], [false, false], [undefined, false]] as const) {
      resetCrazySdk(); resetCrazyRoom();
      const { sdk } = withSettings(value);
      await ready(sdk);
      const got: boolean[] = [];
      onMuteAudio((m) => got.push(m));
      expect(got).toEqual([expected]);
    }
  });

  it('a change during play is passed on (on, then off)', async () => {
    const { sdk, change } = withSettings(false);
    await ready(sdk);
    const got: boolean[] = [];
    onMuteAudio((m) => got.push(m));
    change({ muteAudio: true });
    change({ muteAudio: false });
    change(null);
    expect(got).toEqual([false, true, false, false]);
  });

  it('waits for the SDK, watches once, and does nothing on our own site', async () => {
    const { sdk, change } = withSettings(true);
    const got: boolean[] = [];
    onMuteAudio((m) => got.push(m)); // before init
    expect(got).toEqual([]);
    await ready(sdk);
    onMuteAudio((m) => got.push(m)); // a second ask changes nothing
    change({ muteAudio: false });
    expect(got).toEqual([true, false]);
    resetCrazySdk(); resetCrazyRoom();
    const own = withSettings(true);
    await initCrazySdk({ enabled: false, load: ok, find: () => own.sdk });
    const none: boolean[] = [];
    onMuteAudio((m) => none.push(m));
    expect(none).toEqual([]);
  });
});
