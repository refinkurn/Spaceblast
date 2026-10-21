import { leaderboard } from '../services/leaderboardApi';
import { loadProfile } from '../services/profile';
import { stageId, type ScoreBreakdown } from '../services/score';
import { t } from '../utils/i18n';

// A Story clear's score on the end-of-level card, and sending it to the online
// leaderboard (queued if offline). The rank is added to the card when it comes back.

const num = (n: number) => n.toLocaleString('en-US');

/** End-of-level score rows: the total (with your earlier best) and the breakdown. */
export function scoreRows(s: ScoreBreakdown, prevBest: number): [string, string][] {
  const parts = [t('score.clear', { n: num(s.clear) }), t('score.martians', { n: num(s.martians) })];
  if (s.time > 0) parts.push(t('score.time', { n: num(s.time) }));
  parts.push(t('score.hearts', { n: num(s.hearts) }));
  return [
    [t('summary.score'), prevBest >= s.total ? t('score.withBest', { total: num(s.total), best: num(prevBest) }) : prevBest > 0 ? t('score.newBest', { total: num(s.total) }) : num(s.total)],
    [t('summary.bonus'), parts.join(' · ')],
  ];
}

/** `cardOpen` says whether the end-of-level card is still up when the rank arrives. */
export function sendScore(level: number, score: ScoreBreakdown, heartsLeft: number, cardOpen: () => boolean): void {
  const me = loadProfile();
  void leaderboard.submit({
    device_uuid: me.uuid,
    display_name: me.name,
    stage_id: stageId(level),
    score: score.total,
    completion_time_seconds: Math.max(5, score.seconds),
    hearts_left: heartsLeft,
    stars: score.stars,
  }).then((reply) => {
    if (!reply?.ok || !cardOpen()) return;
    const list = document.getElementById('banner-summary');
    if (!list) return;
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = t('summary.onlineRank');
    dd.textContent = `#${reply.rank}`;
    row.append(dt, dd);
    list.append(row);
  });
}
