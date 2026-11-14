// Records real gameplay for the portal listing (docs/LISTING.md), frame by frame.
// The game's frame clock (requestAnimationFrame + performance.now) is stepped by
// hand, so the footage is smooth and at true game speed even on a slow machine:
// every recorded frame advances the game by exactly 1/30 s (two 60 Hz ticks).
// A bot plays Bosco (the same bot as Battle vs Bot). Needs ffmpeg for the videos.
//   node scripts/listing_capture.mjs <out-dir> [landscape|portrait] [seconds-per-clip]
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? 'listing/frames';
const SHAPE = process.argv[3] === 'portrait' ? { name: 'portrait', w: 1080, h: 1620 } : { name: 'landscape', w: 1920, h: 1080 };
const SECONDS = Number(process.argv[4] ?? 9.5);
const FPS = 30;
const PORT = 5193;

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => { try { server.kill(); } catch { /* gone */ } });
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 500));
}

const local = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  ...(existsSync(local) ? { executablePath: local } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: SHAPE.w, height: SHAPE.h }, hasTouch: false });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('script error:', e.message));
// Manual frame clock: off until __manual() is called, then frames only run in __step().
await p.addInitScript(() => {
  const realNow = performance.now.bind(performance);
  const realRaf = window.requestAnimationFrame.bind(window);
  let manual = false;
  let vt = 0;
  let queue = [];
  // While a screenshot is taken (`shooting`) the browser's own frame requests pass through;
  // the game's next frame was queued during __step and stays put.
  let shooting = false;
  window.requestAnimationFrame = (cb) => { if (!manual || shooting) return realRaf(cb); queue.push(cb); return queue.length; };
  performance.now = () => (manual ? vt : realNow());
  window.__manual = () => { vt = realNow(); manual = true; };
  window.__step = (ms) => { shooting = false; vt += ms; const run = queue; queue = []; for (const cb of run) cb(vt); shooting = true; };
});
// A returning player: no tutorial prompts or first-time cards in the footage.
await p.addInitScript(() => {
  localStorage.setItem('spaceblast.story', JSON.stringify({
    unlocked: 20, stars: { 1: 3, 2: 3 }, tutorialSeen: true,
    seenBeats: ['move', 'pillars', 'charge', 'escape', 'rocks', 'powerup', 'martian', 'gate', 'sniffer'],
    seenEnemies: ['goopling', 'chaser', 'sniffer', 'phaser', 'builder'],
    seenPowerups: ['beam_range', 'extra_charge', 'speed_boost', 'freeze_pulse', 'oxygen_vest', 'star_dot'],
  }));
});
await p.goto(`http://localhost:${PORT}/`);
await p.waitForTimeout(1500);
await p.click('#start-screen');
await p.waitForTimeout(1000);

/** Puts the Battle bot in Bosco's seat: its decisions become key presses. */
await p.evaluate(async () => {
  const { Bot } = await import('/src/input/bot.ts');
  const codes = { 1: 'ArrowUp', 2: 'ArrowDown', 3: 'ArrowLeft', 4: 'ArrowRight' };
  let held = null;
  let placing = false;
  const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  window.__pilot = {
    bot: null,
    seat(seed) { this.bot = new Bot(0, seed, 'hard'); },
    /** Story takes: Bosco can't be knocked out, so the take keeps going. */
    shielded: false,
    drive() {
      const s = window.spaceblast.state;
      if (this.shielded && s.players[0]) s.players[0].shield = 1_000_000_000;
      if (!this.bot || s.status !== 'playing') return;
      const c = this.bot.think(s);
      const want = codes[c.dir] ?? null;
      if (want !== held) { if (held) key('keyup', held); if (want) key('keydown', want); held = want; }
      if (c.place !== placing) { key(c.place ? 'keydown' : 'keyup', 'Space'); placing = c.place; }
    },
    release() { if (held) key('keyup', held); if (placing) key('keyup', 'Space'); held = null; placing = false; },
  };
});

const tapCards = () => p.evaluate(() => { for (const id of ['cutscene', 'intro-card', 'level-card']) { const e = document.getElementById(id); if (e && !e.hidden) e.click(); } });
/** Runs the game for `seconds` without recording (cards, countdown, the first quiet moments). */
async function settle(seconds) {
  for (let i = 0; i < seconds * FPS; i++) {
    if (i % 6 === 0) await tapCards();
    await frame();
    await p.waitForTimeout(25); // real time too: card fades and the 3-2-1 count run on timers
  }
}
/** One recorded frame: the pilot decides, then the game runs 1/30 s (two ticks, drawn once). */
const frame = () => p.evaluate(() => { window.__pilot.drive(); window.__step(1000 / 30); });
async function record(clip, seconds) {
  const t0 = Date.now();
  mkdirSync(`${OUT}/${SHAPE.name}-${clip}`, { recursive: true });
  for (let i = 0; i < seconds * FPS; i++) {
    await frame();
    await p.screenshot({ path: `${OUT}/${SHAPE.name}-${clip}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 95 });
  }
  console.log(`${SHAPE.name} ${clip}: ${seconds * FPS} frames in ${Math.round((Date.now() - t0) / 1000)} s, tick ${await p.evaluate(() => window.spaceblast.state.tick)}, status ${await p.evaluate(() => window.spaceblast.state.status)}`);
}

// The footage shows the portal build's screen: no full screen button of our own.
await p.evaluate(() => { document.body.classList.add('portal'); window.__manual(); });
await p.waitForTimeout(200);

// Clip 1: Story, sector 1 (Gooplings and Hungry Gooplings).
await p.evaluate(() => { window.__pilot.shielded = true; window.__pilot.seat(7); window.spaceblast.startLevel(3); });
await settle(8);
await record('story', SECONDS);

// Clip 2: Battle vs Bot (Hard), the bot against itself.
await p.evaluate(() => { window.__pilot.release(); window.__pilot.shielded = false; window.__pilot.seat(21); });
await p.keyboard.press('Escape');
await settle(0.5);
await p.evaluate(() => { document.getElementById('pause-quit')?.click(); });
await settle(0.5);
await p.evaluate(() => { for (const b of document.querySelectorAll('#pause-card button')) if (!b.hidden && /quit|yes|leave/i.test(b.id + b.textContent)) b.click(); });
await settle(1);
await p.evaluate(() => { document.getElementById('menu-versus').click(); });
await settle(0.5);
await p.evaluate(() => { document.getElementById('mode-battle').click(); });
await settle(0.5);
await p.evaluate(() => { document.querySelector('#menu-bot [data-level="hard"]').click(); });
await settle(6);
console.log('battle: mode', await p.evaluate(() => window.spaceblast.state.mode), 'players', await p.evaluate(() => window.spaceblast.state.players.length));
await record('battle', SECONDS);

await browser.close();
process.exit(0);
