import { afterEach, describe, expect, it, vi } from 'vitest';
import { initCrazySdk, resetCrazySdk, type CrazySdk } from '../services/crazygames';
import { botMatchEndActions, leaveRoom } from './ad_points';

type Cb = { adFinished?: () => void };
const ok = () => Promise.resolve();
async function ready() {
  const asked: Cb[] = [];
  const sdk: CrazySdk = { init: ok, environment: 'crazygames', ad: { requestAd: (_t, cb: Cb) => { asked.push(cb); }, hasAdblock: () => false } };
  await initCrazySdk({ enabled: true, load: ok, find: () => sdk });
  return asked;
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
afterEach(() => resetCrazySdk());

describe('Battle vs Bot end screen', () => {
  it('with ads off both ways out run at once', () => {
    const go = { playAgain: vi.fn(), menu: vi.fn() };
    const out = botMatchEndActions(go, { enabled: false });
    out.playAgain();
    out.menu();
    expect(go.playAgain).toHaveBeenCalledOnce();
    expect(go.menu).toHaveBeenCalledOnce();
  });

  it('with ads on they wait for the ad', async () => {
    const asked = await ready();
    const go = { playAgain: vi.fn(), menu: vi.fn() };
    const out = botMatchEndActions(go, { enabled: true });
    out.menu();
    expect(go.menu).not.toHaveBeenCalled();
    asked[0].adFinished!();
    await tick();
    expect(go.menu).toHaveBeenCalledOnce();
    out.playAgain();
    expect(go.playAgain).not.toHaveBeenCalled();
    asked[1].adFinished!();
    await tick();
    expect(go.playAgain).toHaveBeenCalledOnce();
  });
});

describe('Leaving an online room', () => {
  it('in a room: an ad first; outside a room (the choose screen): no ad', async () => {
    const asked = await ready();
    const exit = vi.fn();
    leaveRoom(false, exit, { enabled: true });
    expect(exit).toHaveBeenCalledOnce();
    expect(asked).toHaveLength(0);
    leaveRoom(true, exit, { enabled: true });
    expect(exit).toHaveBeenCalledOnce();
    asked[0].adFinished!();
    await tick();
    expect(exit).toHaveBeenCalledTimes(2);
  });

  it('ads off: leaves at once', () => {
    const exit = vi.fn();
    leaveRoom(true, exit, { enabled: false });
    expect(exit).toHaveBeenCalledOnce();
  });
});
