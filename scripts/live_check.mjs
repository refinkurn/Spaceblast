// `npm run live`: is the live game healthy? The page (Vercel) and the room
// server's page copy (Cloudflare) must answer, run the same build (a room seats
// one build only), and the server's APIs must answer. With --wait it keeps
// trying for up to 12 minutes while a push is still deploying (used by CI).
const PAGE = process.env.LIVE_PAGE || 'https://spaceblast.vercel.app';
const SERVER = process.env.LIVE_SERVER || 'https://spaceblast.refinkurn.workers.dev';
const want = (process.env.EXPECT_BUILD || '').slice(0, 12);
const wait = process.argv.includes('--wait');

async function build(site) {
  const html = await (await fetch(`${site}/`, { cache: 'no-store' })).text();
  const js = html.match(/assets\/index-[\w-]+\.js/)?.[0];
  if (!js) throw new Error(`${site}: no game script in the page`);
  const code = await (await fetch(`${site}/${js}`)).text();
  // The build version sent on room joins (?v=): the commit, 12 hex characters.
  if (want && code.includes(want)) return want;
  return code.match(/["'`]([0-9a-f]{12})["'`]/)?.[1] ?? 'unknown';
}

async function check() {
  const problems = [];
  const [page, server] = await Promise.all([build(PAGE), build(SERVER)]);
  if (page !== server) problems.push(`page runs build ${page}, server copy runs ${server}: players on the two addresses cannot share a room`);
  if (want && page !== want) problems.push(`page runs build ${page}, expected ${want}`);
  const bad = await fetch(`${SERVER}/api/events`, { method: 'POST', body: '{' });
  if (bad.status !== 400) problems.push(`/api/events answered ${bad.status} to a broken post (want 400)`);
  const ok = await fetch(`${SERVER}/api/events`, { method: 'POST', body: JSON.stringify({ events: [] }) });
  if (ok.status !== 204) problems.push(`/api/events answered ${ok.status} to an empty batch (want 204)`);
  const scores = await fetch(`${SERVER}/api/scores?stage_id=story-1`);
  if (scores.status >= 500) problems.push(`/api/scores answered ${scores.status}`);
  const room = await fetch(`${SERVER}/room/ABCD`);
  if (room.status !== 426) problems.push(`/room answered ${room.status} to a plain request (want 426)`);
  return { page, server, problems };
}

const deadline = Date.now() + (wait ? 12 * 60_000 : 0);
for (;;) {
  let r;
  try { r = await check(); } catch (e) { r = { problems: [String(e.message ?? e)] }; }
  if (r.problems.length === 0) { console.log(`Live OK: page and server both run build ${r.page}.`); process.exit(0); }
  if (Date.now() >= deadline) { console.log('LIVE PROBLEMS:\n- ' + r.problems.join('\n- ')); process.exit(1); }
  await new Promise((res) => setTimeout(res, 20_000));
}
