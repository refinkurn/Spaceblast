import { afterEach, describe, expect, it, vi } from 'vitest';
import { crazyAccountName, initCrazySdk, onAccountName, resetCrazySdk, usernameToName, type CrazySdk, type CrazyUser } from './crazygames';
import { displayName, loadProfile } from './profile';

const ok = () => Promise.resolve();

/** A ready SDK whose user module answers `user` and lets the test log in later. */
async function ready(user: CrazyUser | null) {
  let listener: (u: CrazyUser | null) => void = () => {};
  const sdk: CrazySdk = { init: ok, environment: 'crazygames', user: { getUser: () => Promise.resolve(user), addAuthListener: (l) => { listener = l; } } };
  await initCrazySdk({ enabled: true, load: ok, find: () => sdk });
  return { login: (u: CrazyUser | null) => listener(u) };
}

afterEach(() => { resetCrazySdk(); vi.restoreAllMocks(); });

describe('usernameToName', () => {
  it('keeps a usable username', () => {
    expect(usernameToName('Luna Star')).toBe('Luna Star');
  });
  it('turns a dot (or other refused character) into an underscore', () => {
    expect(usernameToName('luna.star')).toBe('luna_star');
    expect(usernameToName('a@b!c')).toBe('a_b_c');
  });
  it('cuts a long one to the name limit', () => {
    expect(usernameToName('SuperLongCrazyName99')).toBe('SuperLongCra');
  });
  it('refuses what cannot be used: too short, rude, not text, nothing but replaced characters', () => {
    expect(usernameToName('x')).toBeNull();
    expect(usernameToName('fuckface')).toBeNull();
    expect(usernameToName(undefined)).toBeNull();
    expect(usernameToName('日本語')).toBeNull();
  });
});

describe('account name', () => {
  it('logged in: the username is the display name', async () => {
    await ready({ username: 'luna.star' });
    expect(crazyAccountName()).toBe('luna_star');
    expect(displayName()).toBe('luna_star');
  });

  it('an unusable username keeps the device name', async () => {
    await ready({ username: 'x' });
    expect(crazyAccountName()).toBeNull();
    expect(displayName()).toBe(loadProfile().name);
  });

  it('logged out keeps the device name', async () => {
    await ready(null);
    expect(crazyAccountName()).toBeNull();
    expect(displayName()).toBe(loadProfile().name);
  });

  it('no SDK (our own site, blocked script) keeps the device name', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await initCrazySdk({ enabled: true, load: () => Promise.reject(new Error('blocked')) });
    expect(crazyAccountName()).toBeNull();
    expect(displayName()).toBe(loadProfile().name);
  });

  it('a login during play changes the name and tells listeners; a logout puts it back', async () => {
    const { login } = await ready(null);
    const heard = vi.fn();
    onAccountName(heard);
    login({ username: 'Bosco Fan' });
    expect(displayName()).toBe('Bosco Fan');
    expect(heard).toHaveBeenCalledOnce();
    login({ username: 'Bosco Fan' }); // same again: nothing to tell
    expect(heard).toHaveBeenCalledOnce();
    login(null);
    expect(displayName()).toBe(loadProfile().name);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('a user module that throws does not break init', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sdk: CrazySdk = { init: ok, environment: 'crazygames', user: { getUser: () => Promise.reject(new Error('no')) } };
    await initCrazySdk({ enabled: true, load: ok, find: () => sdk });
    expect(crazyAccountName()).toBeNull();
  });
});
