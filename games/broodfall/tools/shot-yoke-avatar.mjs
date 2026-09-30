/**
 * YOKE as her Living Avatar, in the real page, with rfab.ai MOCKED (nothing is spent).
 *
 * The beat: the player opens the ship and the AI CORE; her clip is on stage; he types a
 * line; her sentences appear one by one, her clip changes with each sentence's emotion, a
 * gesture plays, her voice is fetched once a sentence (a tiny silent mp3 here); the ship
 * log sent with his line is never on the screen. Then rfab.ai answers 402 (out of tokens):
 * the next rung answers (the scripted YOKE here), nothing about the machinery is on screen.
 *
 * Usage (its own port and build, so it never touches another session's server):
 *   BROODFALL_PORT=5221 BROODFALL_DIST=dist-yoke npm run build
 *   BROODFALL_PORT=5221 BROODFALL_DIST=dist-yoke node tools/shot-yoke-avatar.mjs
 * Artifacts: tools/screenshots/yoke-avatar-*.png
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
mkdirSync(shots, { recursive: true });
/** The port the built game is served on: its own for every session that runs beats at the same time. */
const PORT = Number(process.env.BROODFALL_PORT || 5199);
const failures = [];
const check = (ok, name, detail = '') => {
  if (!ok) failures.push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};

const ids = JSON.parse(readFileSync(join(root, 'content', 'lore', 'yoke-avatar.json'), 'utf8'));
if (!ids.avatarId) { console.log('content/lore/yoke-avatar.json names no avatar: nothing to check'); process.exit(1); }

// A quarter second of silence, as mp3: what /speak answers here.
const silent = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '0.25', '-c:a', 'libmp3lame', '-b:a', '32k', '-f', 'mp3', '-'], { maxBuffer: 1 << 20 }).stdout;

function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split(String.fromCharCode(10))) {
      if (!line.includes(`:${PORT} `) || !line.includes('LISTENING')) continue;
      const pid = line.trim().split(' ').filter(Boolean).pop();
      try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch {}
    }
  } catch {}
}
function startPreview() {
  freePort();
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite preview did not start in 30s')), 30000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(child); } });
    child.on('exit', (code) => reject(new Error(`vite preview exited early (${code})`)));
  });
}

/**
 * rfab.ai, as the game's proxy would reach it. Her events come on a stream that stays open;
 * a line sent to her is answered on it a moment later.
 */
function mockRfab(page, state) {
  const base = `**/rfab-api/api/avatars/${ids.avatarId}`;
  return Promise.all([
    // No player route here (an RFab before its deploy): the game talks to her the old way, and nothing
    // reaches rfab.ai. The player route has its own beat: tools/shot-yoke-connect.mjs.
    page.route('**/rfab-api/api/broodfall/**', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' })),
    page.route(`${base}/history`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ turns: [] }) })),
    page.route(`${base}/message`, async (r) => {
      state.sent.push(JSON.parse(r.request().postData() ?? '{}').message ?? '');
      if (state.broke) return r.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ error: 'Insufficient tokens', code: 'INSUFFICIENT_TOKENS' }) });
      state.pending = true;
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, queued: true }) });
    }),
    page.route(`${base}/speak`, (r) => { state.spoken++; return r.fulfill({ status: 200, contentType: 'audio/mpeg', body: silent }); }),
    // The stream: Playwright answers a request whole, so her events are written into the page's
    // fetch by a small stand-in that the page's own code reads exactly as it reads rfab.ai.
    page.route(`${base}/events`, (r) => r.fulfill({ status: 200, contentType: 'text/event-stream', body: ': open\n\n' })),
  ]);
}

const server = await startPreview();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errors = [];
  const consoleLines = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // The browser logs the 402 this beat asks for itself; that is not the game's error.
  page.on('console', (m) => { consoleLines.push(m.text()); if (m.type() === 'error' && !/status of 402/.test(m.text())) errors.push(m.text()); });
  const state = { sent: [], spoken: 0, pending: false, broke: false };

  // Her events: the page's fetch of /events is given a stream the test writes into.
  await page.addInitScript(() => {
    const real = window.fetch.bind(window);
    const enc = new TextEncoder();
    window.__yoke = { ctl: null, say(e) { this.ctl?.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); } };
    window.fetch = (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (/\/rfab-api\/api\/avatars\/[^/]+\/events$/.test(url)) {
        const body = new ReadableStream({ start(c) { window.__yoke.ctl = c; c.enqueue(enc.encode(': open\n\n')); } });
        return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
      }
      return real(input, init);
    };
  });
  await mockRfab(page, state);

  // A fresh campaign with her in avatar mode, set before the page's own code runs (once per tab).
  // It used to be set from a first visit to the board, but the board keeps the page busy after
  // it loads, and the navigation away from it then waited for ever (Sep 30 2026).
  await page.addInitScript(() => {
    if (sessionStorage.getItem('shot-yoke-init')) return;
    sessionStorage.setItem('shot-yoke-init', '1');
    localStorage.removeItem('broodfall-campaign');
    localStorage.removeItem('broodfall-campaign-pending');
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'avatar', v: 2 }));
  });
  // A campaign whose Directive Desk is already open (the unfolding before it: tools/shot-onboarding.mjs).
  await page.goto(`http://localhost:${PORT}/?campaign=ship&open=1`, { waitUntil: 'load' });
  await page.waitForSelector('#campaign:not(.hidden) .globe');
  // She greets him as he comes aboard (content/greetings.ts, spoken): let it play out; this beat is about his talk with her.
  await page.waitForSelector('.cp-icom:not(.greeting)', { timeout: 60000 });
  state.spoken = 0;
  await page.locator('[data-room="ai"]').click();
  await page.waitForSelector('.cp-yoke-live');
  // What her stage wears, every change of it.
  await page.evaluate(() => {
    window.__worn = [];
    const stage = document.querySelector('.cp-yoke-live');
    new MutationObserver(() => { const s = stage.dataset.state; if (s && window.__worn[window.__worn.length - 1] !== s) window.__worn.push(s); })
      .observe(stage, { attributes: true, attributeFilter: ['data-state'] });
  });
  await page.waitForFunction(() => document.querySelector('.cp-yoke-live')?.dataset.state, null, { timeout: 15000 });
  const rest = await page.evaluate(() => document.querySelector('.cp-yoke-live').dataset.state);
  check(!!rest, 'her clip is on stage in the AI Core', rest);
  await page.waitForFunction(() => [...document.querySelectorAll('.cp-yoke-live video')].some((v) => v.classList.contains('on') && v.readyState >= 2), null, { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: join(shots, 'yoke-avatar-1-room.png') });

  // He speaks.
  const input = page.locator('#ai-input');
  check(await input.count() === 1, 'there is a line to type to her');
  await input.fill('How is the harbour?');
  await page.locator('[data-act="ai-send"]').click();
  for (let i = 0; i < 40 && !state.pending; i++) await page.waitForTimeout(100);
  check(state.sent.length === 1, 'his line is sent to her avatar');
  check(/<<SHIP LOG\./.test(state.sent[0] ?? '') && /How is the harbour\?$/.test(state.sent[0] ?? ''), 'with the ship log in front of it');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shots, 'yoke-avatar-2-thinking.png') });

  // She answers: three sentences, three faces, a nod; and, once, a quoted log.
  const sentences = [
    { type: 'speech', text: 'The harbour is quiet, Technician.', emotion: 'sad' },
    { type: 'speech', text: 'I have the count. <<SHIP LOG. Standing 0. >> I will keep it until you ask.', emotion: 'sad', motion: 'nod' },
    { type: 'speech', text: 'You named the last dare Love Gas. I filed it as a pheromone study.', emotion: 'happy' },
  ];
  for (const e of sentences) {
    await page.evaluate((ev) => window.__yoke.say(ev), e);
    await page.waitForTimeout(1600);
  }
  await page.waitForTimeout(3500);
  const talk = await page.locator('.cp-talk').innerText();
  check(/The harbour is quiet, Technician\./.test(talk), 'her first sentence appears', talk.split('\n').slice(-3).join(' / ').slice(0, 120));
  check(/I will keep it until you ask\./.test(talk) && /pheromone study/.test(talk), 'every sentence of hers appears');
  check(!/SHIP LOG|Standing 0/.test(talk), 'the ship log is never on the screen, even when she quotes it');
  const worn = await page.evaluate(() => window.__worn);
  check(worn.includes('speaking') || worn.includes('sad'), 'her clip changes while she speaks', worn.join(' > '));
  check(worn.includes('nod'), 'the gesture she named plays', worn.join(' > '));
  check(state.spoken >= 1 && state.spoken <= 3, 'her voice is asked for once a sentence at most', `${state.spoken} /speak calls`);
  await page.screenshot({ path: join(shots, 'yoke-avatar-3-answered.png') });

  // Muted, she wears the emotion itself while she speaks.
  await page.locator('[data-act="yoke-mute"]').click();
  const spokenBefore = state.spoken;
  state.pending = false;
  await page.locator('#ai-input').fill('Are you all right?');
  await page.locator('[data-act="ai-send"]').click();
  for (let i = 0; i < 40 && !state.pending; i++) await page.waitForTimeout(100);
  await page.evaluate(() => { window.__worn = []; });
  await page.evaluate(() => window.__yoke.say({ type: 'speech', text: 'That is outside tolerance. I will log it as a calibration error.', emotion: 'stern' }));
  // She moves her mouth while her words appear, and then holds the face of what she said.
  await page.waitForTimeout(6500);
  const wornMuted = await page.evaluate(() => window.__worn);
  check(wornMuted[wornMuted.length - 1] === 'angry', 'after the sentence she holds the face of her emotion (stern is her angry clip)', wornMuted.join(' > '));
  check(state.spoken === spokenBefore, 'muted, her voice is not asked for');
  await page.waitForTimeout(3500);

  // rfab.ai answers 402: the next rung answers, and nothing is said of the machinery.
  state.broke = true;
  const before = await page.locator('.cp-talk .yoke').count();
  await page.locator('#ai-input').fill('Hello?');
  await page.locator('[data-act="ai-send"]').click();
  await page.waitForFunction((n) => document.querySelectorAll('.cp-talk .yoke:not(.thinking)').length > n, before, { timeout: 20000 }).catch(() => {});
  const after = await page.locator('.cp-talk').innerText();
  const last = (await page.locator('.cp-talk .yoke:not(.thinking)').last().innerText().catch(() => '')) ?? '';
  const answered = (await page.locator('.cp-talk .yoke:not(.thinking)').count()) > before;
  check(answered, 'on a 402 the next rung answers', after.split('\n').slice(-1)[0]?.slice(0, 100));
  check(!/402|token|rfab|error|avatar|insufficient/i.test(last), 'and the player is told nothing of why', last.slice(0, 100));
  check(consoleLines.some((l) => /\[YOKE\] the avatar did not answer.*out of tokens/.test(l)), 'the reason goes to the console');
  await page.screenshot({ path: join(shots, 'yoke-avatar-4-fallback.png') });
  check(errors.length === 0, 'no errors in the page', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `\nYOKE AVATAR BEAT: ${failures.length} failure(s): ${failures.join('; ')}` : '\nYOKE AVATAR BEAT: all verified.');
process.exit(failures.length ? 1 : 0);
