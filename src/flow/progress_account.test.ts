import { afterEach, describe, expect, it, vi } from 'vitest';
import { initCrazySdk, onCrazyReady, resetCrazySdk, type CrazySdk } from '../services/crazygames';
import { KEY, StoryProgress, mergeSaved, sanitize } from './progress';

const ok = () => Promise.resolve();

/** A ready SDK whose `data` is a plain map (the account's copy). */
async function account(initial: Record<string, string> = {}) {
  const store = { ...initial };
  const sdk: CrazySdk = { init: ok, environment: 'crazygames', data: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } } };
  await initCrazySdk({ enabled: true, load: ok, find: () => sdk });
  return store;
}

const saved = (over: Record<string, unknown>) => JSON.stringify(over);

afterEach(() => { resetCrazySdk(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('mergeSaved', () => {
  it('takes the best of each field', () => {
    const a = sanitize({ unlocked: 5, stars: { 1: 3, 2: 1 }, scores: { 1: 5000 }, stats: { martians: 10, bosses: 1, livesLost: 4, ticks: 100 }, tutorialSeen: false, seenBeats: ['a'] });
    const b = sanitize({ unlocked: 3, stars: { 1: 2, 2: 3, 3: 1 }, scores: { 1: 6000, 3: 100 }, stats: { martians: 4, bosses: 2, livesLost: 9, ticks: 50 }, tutorialSeen: true, seenBeats: ['b'] });
    const m = mergeSaved(a, b);
    expect(m.unlocked).toBe(5);
    expect(m.stars).toEqual({ 1: 3, 2: 3, 3: 1 });
    expect(m.scores).toEqual({ 1: 6000, 3: 100 });
    expect(m.stats).toEqual({ martians: 10, bosses: 2, livesLost: 9, ticks: 100 });
    expect(m.tutorialSeen).toBe(true);
    expect(m.seenBeats.sort()).toEqual(['a', 'b']);
  });

  it('introPending stays true only when both copies have it', () => {
    const yes = sanitize({ introPending: true });
    const no = sanitize({ introPending: false });
    expect(mergeSaved(yes, yes).introPending).toBe(true);
    expect(mergeSaved(yes, no).introPending).toBe(false);
    expect(mergeSaved(no, yes).introPending).toBe(false);
  });

  it('finished wins if either has it', () => {
    expect(mergeSaved(sanitize({ finished: true }), sanitize({})).finished).toBe(true);
  });
});

describe('progress on the CrazyGames account', () => {
  it('further on the account: this device catches up, and both copies are saved', async () => {
    const store = await account({ [KEY]: saved({ unlocked: 8, stars: { 7: 3 } }) });
    const p = new StoryProgress();
    expect(p.mergeAccount(store[KEY])).toBe(true);
    expect(p.unlocked).toBe(8);
    expect(p.stars(7)).toBe(3);
    expect(JSON.parse(store[KEY]).unlocked).toBe(8);
  });

  it('further locally: nothing changes here and the account gets the local copy', async () => {
    const store = await account({ [KEY]: saved({ unlocked: 2 }) });
    const p = new StoryProgress();
    p.clear(5, 3, 900); // writes to the account too
    expect(p.mergeAccount(store[KEY])).toBe(false);
    expect(p.unlocked).toBe(6);
    expect(JSON.parse(store[KEY]).unlocked).toBe(6);
    expect(JSON.parse(store[KEY]).scores[5]).toBe(900);
  });

  it('seen lists are joined', async () => {
    const store = await account();
    const p = new StoryProgress();
    p.markSeen('seenEnemies', 'blob');
    p.mergeAccount(saved({ seenEnemies: ['spitter'], seenPowerups: ['bomb'] }));
    expect(p.seen('seenEnemies', 'blob')).toBe(true);
    expect(p.seen('seenEnemies', 'spitter')).toBe(true);
    expect(p.seen('seenPowerups', 'bomb')).toBe(true);
    expect(JSON.parse(store[KEY]).seenEnemies.sort()).toEqual(['blob', 'spitter']);
  });

  it('bad account data is ignored', async () => {
    await account();
    const p = new StoryProgress();
    p.clear(2, 2);
    expect(p.mergeAccount('{not json')).toBe(false);
    expect(p.mergeAccount('42')).toBe(false);
    expect(p.mergeAccount(saved({ unlocked: -5, stars: { 1: 'x', 2: -3 }, seenBeats: [1, '<script>'], stats: 'no' }))).toBe(false);
    expect(p.unlocked).toBe(3);
    expect(p.stars(2)).toBe(2);
    expect(p.seen('seenBeats', '<script>')).toBe(false);
  });

  it('nothing on the account yet: it gets this device\'s copy', async () => {
    const store = await account();
    const p = new StoryProgress();
    p.clear(1, 1);
    delete store[KEY];
    expect(p.mergeAccount(null)).toBe(false);
    expect(JSON.parse(store[KEY]).unlocked).toBe(2);
  });

  it('no SDK: localStorage only, as today', () => {
    const mem: Record<string, string> = {};
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } });
    const p = new StoryProgress();
    p.clear(4, 2);
    expect(JSON.parse(mem[KEY]).unlocked).toBe(5);
    expect(p.mergeAccount(null)).toBe(false); // no account copy without the SDK
  });
});

describe('onCrazyReady', () => {
  it('runs when init finishes, or at once if it already has; never without the SDK', async () => {
    const early = vi.fn();
    onCrazyReady(early);
    expect(early).not.toHaveBeenCalled();
    await account();
    expect(early).toHaveBeenCalledOnce();
    const late = vi.fn();
    onCrazyReady(late);
    expect(late).toHaveBeenCalledOnce();
  });

  it('is not run when the SDK is blocked', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const never = vi.fn();
    onCrazyReady(never);
    await initCrazySdk({ enabled: true, load: () => Promise.reject(new Error('blocked')) });
    expect(never).not.toHaveBeenCalled();
  });
});
