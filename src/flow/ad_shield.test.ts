import { afterEach, describe, expect, it, vi } from 'vitest';
import { initCrazySdk, resetCrazySdk, type CrazySdk } from '../services/crazygames';
import { midgameAd } from '../services/crazygames_ads';
import { installAdShield } from './ad_shield';

afterEach(() => resetCrazySdk());

describe('ad shield', () => {
  it('mutes and covers the page while an ad plays, then restores both', async () => {
    let cb: { adStarted?: () => void; adFinished?: () => void } = {};
    const sdk: CrazySdk = { init: () => Promise.resolve(), environment: 'crazygames', ad: { requestAd: (_t, c) => { cb = c; } } };
    await initCrazySdk({ enabled: true, load: () => Promise.resolve(), find: () => sdk });
    const children: object[] = [];
    const layer = { remove: vi.fn(() => children.splice(0)), id: '', className: '' };
    const doc = { createElement: () => layer, body: { append: (e: object) => { children.push(e); } } } as unknown as Document;
    const mute = vi.fn();
    installAdShield(mute, doc);
    const p = midgameAd({ enabled: true });
    cb.adStarted!();
    expect(mute).toHaveBeenLastCalledWith(true);
    expect(children).toHaveLength(1);
    expect(layer.id).toBe('ad-shield');
    cb.adFinished!();
    await p;
    expect(mute).toHaveBeenLastCalledWith(false);
    expect(children).toHaveLength(0);
  });
});
