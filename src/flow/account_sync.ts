import { crazyAccountName, onAccountName, onCrazyReady, readAccountData } from '../services/crazygames';
import { KEY as SAVE_KEY, type StoryProgress } from './progress';

/**
 * CrazyGames account: the account's copy of the Story progress is merged with this device's when the SDK
 * is ready and again after a login during play (so progress made before the login is kept).
 * `changed` runs when the merge changed anything here (the Story map refreshes if open).
 */
export function watchAccountMerge(progress: StoryProgress, changed: () => void): void {
  const merge = () => { if (progress.mergeAccount(readAccountData(SAVE_KEY))) changed(); };
  onCrazyReady(merge);
  onAccountName(() => { if (crazyAccountName() !== null) merge(); });
}
