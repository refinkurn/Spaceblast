// Phone-size screenshots of the key screens, with checks that fail the run on a
// script error, a blank canvas or a missing screen. Runs against the dev server
// (it has the `spaceblast` console hooks). `npm run shots`; CI uploads shots/.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5187;
const OUT = 'shots';
const SIZES = [
  { name: 'phone', w: 844, h: 390, touch: true },
  { name: 'cg-mobile', w: 800, h: 450, touch: true }, // CrazyGames mobile frame
  { name: 'cg-desktop', w: 907, h: 510, touch: false }, // CrazyGames desktop frame
];
const local = '/opt/pw-browsers/chromium';
const problems = [];
const fail = (m) => { problems.push(m); console.log('  FAIL', m); };

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch { /* gone */ } };
process.on('exit', stop);
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 500));
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  ...(existsSync(local) ? { executablePath: local } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const visible = (p, id) => p.evaluate((i) => { const e = document.getElementById(i); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, id);
const tapCards = (p) => p.evaluate(() => { for (const id of ['cutscene', 'intro-card', 'level-card']) { const e = document.getElementById(id); if (e && !e.hidden) e.click(); } });
/** The 3D canvas drew something: a screenshot of it is not one flat colour. */
async function canvasAlive(p) {
  const png = await p.locator('#game').screenshot();
  return new Set(png.subarray(200, 4000)).size > 40 && png.length > 8000;
}

for (const s of SIZES) {
  console.log(`${s.name} ${s.w}x${s.h}`);
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, hasTouch: s.touch });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fail(`${s.name}: script error: ${e.message}`));
  const shot = (name) => p.screenshot({ path: `${OUT}/${s.name}-${name}.png` });
  const need = async (id, what) => { if (!(await visible(p, id))) fail(`${s.name}: ${what} (#${id}) not showing`); };

  await p.goto(`http://localhost:${PORT}/`);
  await p.waitForTimeout(1200);
  await need('start-screen', 'start screen');
  await shot('1-start');
  await p.click('#start-screen');
  await p.waitForTimeout(900);
  await need('menu', 'menu');
  await shot('2-menu');
  // Overflow: nothing in the menu may be wider than the screen.
  const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (wide) fail(`${s.name}: menu scrolls sideways`);

  // Story level 2 (no tutorial): level card, then play.
  await p.evaluate(() => window.spaceblast.startLevel(2));
  await p.waitForTimeout(900);
  await need('level-card', 'level card');
  await shot('3-level-card');
  for (let i = 0; i < 8; i++) { await tapCards(p); await p.waitForTimeout(250); }
  await p.waitForTimeout(3200);
  // The level runs once the cards and the 3-2-1 count are over: a slow machine (CI) may need longer.
  const t0 = await p.evaluate(() => window.spaceblast.state.tick);
  let t1 = t0;
  for (let i = 0; i < 20 && !(t1 > t0); i++) {
    await tapCards(p);
    await p.waitForTimeout(500);
    t1 = await p.evaluate(() => window.spaceblast.state.tick);
  }
  if (!(t1 > t0)) fail(`${s.name}: Story level is not running`);
  if (!(await canvasAlive(p))) fail(`${s.name}: arena canvas looks blank`);
  await need('hud', 'HUD');
  await shot('4-play');
  if (!s.touch && (await visible(p, 'stick-zone'))) fail(`${s.name}: touch joystick shows for a mouse-and-keyboard player`);
  if (s.touch) {
    const box = await p.evaluate(() => { const b = document.getElementById('place-btn').getBoundingClientRect(); return [b.width, b.height, b.right, innerWidth]; });
    if (box[0] < 48 || box[1] < 48) fail(`${s.name}: Charge button under 48 px`);
    if (box[2] > box[3] + 1) fail(`${s.name}: Charge button off screen`);
  }

  // Level cleared: the end-of-level card.
  await p.evaluate(() => { const st = window.spaceblast.state; const c = st.grid.cells; c[st.gate] = 0; const h = st.players[0]; h.x = (st.gate % st.grid.w) * 1000; h.y = Math.floor(st.gate / st.grid.w) * 1000; });
  await p.waitForTimeout(2500);
  for (let i = 0; i < 12; i++) { await tapCards(p); await p.waitForTimeout(150); }
  await p.waitForTimeout(800);
  await need('banner', 'end-of-level card');
  await shot('5-level-clear');

  // Multiplayer lobby screen.
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  await p.evaluate(() => { const b = document.querySelector('#banner button:last-of-type'); if (b && !document.getElementById('banner').hidden) b.click(); });
  await p.waitForTimeout(900);
  if (await visible(p, 'menu')) {
    await p.evaluate(() => document.getElementById('mode-online').click());
    await p.waitForTimeout(700);
    await need('online', 'Multiplayer screen');
    await shot('6-multiplayer');
  } else {
    await shot('6-after-clear');
  }
  await ctx.close();
}

// Quick start (portal builds; `?quickstart` here): a fresh save plays level 1 after one tap.
{
  console.log('quick start 800x450');
  const ctx = await browser.newContext({ viewport: { width: 800, height: 450 }, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fail(`quick start: script error: ${e.message}`));
  await p.goto(`http://localhost:${PORT}/?quickstart`);
  await p.waitForTimeout(1200);
  await p.click('#start-screen');
  await p.waitForTimeout(1500);
  for (const id of ['start-screen', 'menu', 'crawl', 'cutscene', 'intro-card', 'level-card']) {
    if (await visible(p, id)) fail(`quick start: #${id} is in the way of level 1`);
  }
  const t0 = await p.evaluate(() => window.spaceblast.state.tick);
  await p.waitForTimeout(500);
  if (!((await p.evaluate(() => window.spaceblast.state.tick)) > t0)) fail('quick start: level 1 is not running');
  await p.screenshot({ path: `${OUT}/quick-start.png` });
  // The opening story is still owed, and is shown before the next level.
  await p.evaluate(() => window.spaceblast.story.play(2, true));
  await p.waitForTimeout(700);
  if (!(await visible(p, 'story'))) fail('quick start: the "Earlier today" card does not show before level 2');
  await ctx.close();
}

await browser.close();
stop();
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nAll screens OK');
process.exit(problems.length ? 1 : 0);
