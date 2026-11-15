import { afterEach, describe, expect, it, vi } from 'vitest';
import { initCrazySdk, resetCrazySdk, type CrazySdk } from '../services/crazygames';

vi.mock('./transition', () => ({ fadeThrough: (fn: () => void) => fn() }));
vi.mock('./story_score', () => ({ scoreRows: () => [], sendScore: () => {} }));
vi.mock('./summary', () => ({ storySummary: () => [], bossClearLine: () => '' }));
vi.mock('../services/analytics', () => ({ analytics: { track: () => {} } }));
vi.mock('../config/portal', async (orig) => ({ ...(await orig<object>()), CRAZY_ADS: true }));

import { StoryResults } from './story_results';

type Cb = { adFinished?: () => void };
const ok = () => Promise.resolve();
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
afterEach(() => resetCrazySdk());

/** Results with fakes: records the banner and what the game did. */
function setup() {
  const banner: { onPrimary?: () => void; onMenu?: () => void } = {};
  const calls: string[] = [];
  const screens = {
    bannerOpen: false,
    hideBanner: () => {},
    showBanner: (_a: string, _b: string, _c: string, onClick: () => void, _d: string, _e: string, extra: { onMenu?: () => void }) => {
      banner.onPrimary = onClick;
      banner.onMenu = extra.onMenu;
    },
  };
  const state = { tick: 600, martians: [], players: [{}], items: [] } as never;
  const results = new StoryResults({
    host: { state } as never,
    screens: screens as never,
    cutscene: { play: (_s: unknown, _st: unknown, done: () => void) => done() } as never,
    progress: { add: () => {}, clear: () => {}, save: () => {}, bestScore: () => 0 } as never,
    level: () => 3,
    livesLost: () => 3,
    play: (n, story) => calls.push(`play ${n} ${story}`),
    showMap: () => calls.push('map'),
    showEnding: () => {},
  });
  return { results, banner, calls };
}

async function readySdk() {
  const asked: Cb[] = [];
  const sdk: CrazySdk = { init: ok, environment: 'crazygames', ad: { requestAd: (_t, cb: Cb) => { asked.push(cb); }, hasAdblock: () => false } };
  await initCrazySdk({ enabled: true, load: ok, find: () => sdk });
  return asked;
}

describe('Story results and midgame ads', () => {
  it('game over: "Retry" waits for the ad, "Map" does not', async () => {
    const asked = await readySdk();
    const { results, banner, calls } = setup();
    results.gameOver();
    banner.onMenu!();
    expect(calls).toEqual(['map']);
    expect(asked).toHaveLength(0);
    banner.onPrimary!();
    expect(calls).toEqual(['map']);
    asked[0].adFinished!();
    await tick();
    expect(calls).toEqual(['map', 'play 3 false']);
  });

  it('level clear: "Next level" waits for the ad, "Map" does not', async () => {
    const asked = await readySdk();
    const { results, banner, calls } = setup();
    results.cleared();
    banner.onMenu!();
    expect(calls).toEqual(['map']);
    expect(asked).toHaveLength(0);
    banner.onPrimary!();
    expect(calls).toEqual(['map']);
    asked[0].adFinished!();
    await tick();
    expect(calls).toEqual(['map', 'play 4 true']);
  });

  it('no SDK: both actions run at once', () => {
    const { results, banner, calls } = setup();
    results.gameOver();
    banner.onPrimary!();
    expect(calls).toEqual(['play 3 false']);
  });
});
