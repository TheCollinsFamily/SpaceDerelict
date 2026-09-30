/**
 * Screenshot beats of THE SHIP with its art, and its checks: every room has its picture,
 * the planet is a projection with zones, YOKE is there, the notebook has its sketches,
 * and every scene of every faction has its own picture, which its card shows.
 *
 * Usage: npm run build && node tools/shot-ship.mjs
 * Artifacts: tools/screenshots/ship-*.png (ship-contact-<faction>.png: each faction's first contact)
 */
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'screenshots');
mkdirSync(shots, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5199);
const failures = [];
const check = (ok, name, detail = '') => {
  if (ok) console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  else { failures.push(name); console.log(`  FAIL  ${name} — ${detail}`); }
};

function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split(String.fromCharCode(10))) {
      const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
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

/** The folder the game was built into (each session that runs beats has its own). */
const DIST = process.env.BROODFALL_DIST || 'dist';

/**
 * The factions as the game has them. content/campaign.ts is data with types on it: the
 * types are taken off and what is left is loaded, so that the check reads the very scenes
 * the game shows and not a list of its own that could go stale.
 */
async function loadFactions() {
  const { code } = await transform(readFileSync(join(root, 'content', 'campaign.ts'), 'utf8'), { loader: 'ts', format: 'esm' });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  return mod.FACTIONS;
}
/** Every scene of a faction, in the order it plays. Only the first is a contact (it is answered, not continued). */
const scenesOf = (f) => [
  { faction: f.id, scene: f.contact, contact: true },
  ...f.beats.map((b) => ({ faction: f.id, scene: b.scene })),
  { faction: f.id, scene: f.ending },
  ...Object.values(f.endingByChoice?.scenes ?? {}).map((scene) => ({ faction: f.id, scene })),
];

/** The address inside a style value like url("..."). */
const addressIn = (v) => (v.includes('"') ? v.slice(v.indexOf('"') + 1, v.lastIndexOf('"')) : '');

const server = await startPreview();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
  });
  // A returning player: the ship's console menu (the first launch is tools/shot-onboarding.mjs).
  await page.addInitScript(() => localStorage.setItem('broodfall-intro-seen', '1'));
  await page.goto(`http://localhost:${PORT}/?seed=7`);
  await page.waitForSelector('#menu-deploy');
  await page.screenshot({ path: join(shots, 'ship-0-menu.png') });
  // A campaign whose Directive Desk is already open (the unfolding before it is its own beat).
  await page.goto(`http://localhost:${PORT}/?campaign=ship&open=1`);
  await page.waitForSelector('#campaign:not(.hidden) .cp-card', { timeout: 10000 });
  await page.waitForFunction(() => document.getElementById('campaign').classList.contains('ship-art'), null, { timeout: 10000 }).catch(() => {});
  check(await page.evaluate(() => document.getElementById('campaign').classList.contains('ship-art')), 'the ship has its art');

  const bg = () => page.evaluate(() => getComputedStyle(document.getElementById('campaign')).backgroundImage);
  const rooms = ['desk', 'genes', 'locker', 'board', 'comms', 'ai'];
  for (const r of rooms) {
    await page.locator(`[data-room="${r}"]`).click();
    await page.waitForTimeout(350);
    const image = await bg();
    // The picture has to be THERE, not only named: it is fetched and measured.
    const url = addressIn(image);
    const size = url ? await page.evaluate(async (u) => { try { const i = new Image(); i.src = u; await i.decode(); return i.naturalWidth; } catch { return 0; } }, url) : 0;
    check(image.includes(`room-${r}`) && size >= 1024, `the ${r} room has its picture`, `${size} px wide`);
    await page.screenshot({ path: join(shots, `ship-${rooms.indexOf(r) + 1}-${r}.png`) });
  }

  // The planet: a projection, divided into zones, that turns under the hand.
  await page.locator('[data-room="desk"]').click();
  await page.waitForSelector('canvas.globe-map');
  const lit = (sel) => page.evaluate((s) => {
    const c = document.querySelector(s);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let red = 0, any = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 40) any++;
      if (d[i] > 120 && d[i] > d[i + 1] * 1.6 && d[i] > d[i + 2] * 1.6) red++;
      sum += d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7 + i % 97;
    }
    return { red, any, sum };
  }, sel);
  const before = await lit('canvas.globe-map');
  check(before.any > 100000, 'the planet is drawn', `${before.any} lit pixels`);
  check(before.red > 800, 'ground that is held is red on the planet', `${before.red} red pixels`);
  const sites = await page.locator('.globe .site').count();
  check(sites >= 4, 'landing sites are marked on it', String(sites));
  const box = await page.locator('.globe-box').boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.85);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.85, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await lit('canvas.globe-map');
  check(after.sum !== before.sum, 'the planet turns under the hand');
  await page.locator('.globe .site.open').first().click();
  await page.waitForTimeout(300);
  const sketches = await page.locator('.cp-brief .cp-sketch').count();
  const sketchPx = await page.evaluate(async () => {
    const v = getComputedStyle(document.getElementById('campaign')).getPropertyValue('--sketches');
    const u = v.slice(v.indexOf('"') + 1, v.lastIndexOf('"'));
    try { const i = new Image(); i.src = u; await i.decode(); return i.naturalWidth; } catch { return 0; }
  });
  check(sketches >= 9 && sketchPx > 0, 'the dares in a briefing carry his sketches', `${sketches} sketches, sheet ${sketchPx} px wide`);
  await page.screenshot({ path: join(shots, 'ship-7-briefing.png') });

  await page.locator('[data-room="ai"]').click();
  await page.waitForTimeout(300);
  const yokePx = await page.evaluate(async () => {
    const v = getComputedStyle(document.getElementById('campaign')).getPropertyValue('--yoke');
    const u = v.slice(v.indexOf('"') + 1, v.lastIndexOf('"'));
    try { const i = new Image(); i.src = u; await i.decode(); return i.naturalWidth; } catch { return 0; }
  });
  check(await page.locator('.cp-yoke').count() === 1 && yokePx > 0, 'YOKE is in the AI core', `her sheet is ${yokePx} px wide`);
  if (await page.locator('[data-engage]').count()) {
    await page.locator('[data-engage]').first().click();
    await page.waitForSelector('.cp-talk');
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(shots, 'ship-8-yoke-talk.png') });
  }
  // ---- The factions' scenes: each has its own picture, and its card shows it.
  const FACTIONS = await loadFactions();
  const listed = JSON.parse(readFileSync(join(root, 'public', 'art', 'manifest.json'), 'utf8')).ship?.ship?.scenes ?? {};
  for (const f of FACTIONS) {
    const all = scenesOf(f);
    const missing = all.filter(({ scene }) => {
      const file = scene.picture && listed[scene.picture];
      // On disk where it is kept, and in the build that is being served.
      return !file || !existsSync(join(root, 'public', 'art', file)) || !existsSync(join(root, DIST, 'art', file));
    });
    check(missing.length === 0, `every scene of ${f.name} has its picture in the manifest and on disk`,
      missing.length ? `missing: ${missing.map((m) => m.scene.picture ?? `"${m.scene.title}" names none`).join(', ')}` : `${all.length} scenes`);
  }
  check(FACTIONS.map((f) => f.contact.title).join(' | ') === 'A Letter, Spelled Out in a Field | A Broadcast on Every Frequency | A Video Call, Mid-Game',
    'each faction reaches the ship in its own way', FACTIONS.map((f) => f.contact.title).join(' | '));

  // The card in the page: the picture is fetched and measured, as the rooms' are. Every scene
  // of the faction is put in the queue of a saved game, and the cards are gone through by hand.
  for (const f of FACTIONS) {
    const queue = scenesOf(f);
    await page.evaluate((q) => {
      const state = JSON.parse(localStorage.getItem('broodfall-campaign'));
      state.pendingScenes = q;
      state.faction = null;
      state.contacted = [q[0].faction];
      localStorage.setItem('broodfall-campaign', JSON.stringify(state));
    }, queue);
    await page.goto(`http://localhost:${PORT}/?campaign=ship`);
    await page.waitForSelector('#campaign.ship-art .cp-scene-card', { timeout: 10000 });
    const bad = [];
    for (const [i, q] of queue.entries()) {
      const want = q.scene.picture;
      await page.waitForSelector(`.cp-scene-card img[data-picture="${want}"]`, { timeout: 5000 }).catch(() => {});
      const got = await page.evaluate(async () => {
        const img = document.querySelector('.cp-scene-card img');
        const title = document.querySelector('.cp-scene-card .cp-sub')?.textContent ?? '';
        if (!img) return { title, cls: '', src: '', w: 0, shown: 0 };
        let w = 0;
        try { const i = new Image(); i.src = img.src; await i.decode(); w = i.naturalWidth; } catch { /* not there */ }
        return { title, cls: img.className, src: img.src, w, shown: Math.round(img.getBoundingClientRect().width) };
      });
      const ok = got.cls.includes('cp-scene-pic') && got.src.endsWith(`scenes/${want}.webp`) && got.w === 640 && got.shown >= 280
        && got.title === q.scene.title.toUpperCase();
      if (i === 0) {
        check(ok, `the contact card of ${f.name} shows its own picture`, `"${got.title}", ${got.src.split('/').pop()}, ${got.w} px wide, shown ${got.shown} px wide`);
        const lines = await page.locator('.cp-scene-card').innerText();
        check(!/hand-delivered/i.test(lines), `nobody hands him anything (${f.name})`, lines.split(String.fromCharCode(10))[1] ?? '');
        await page.screenshot({ path: join(shots, `ship-contact-${f.id}.png`) });
      } else if (!ok) bad.push(`${want}: "${got.title}" ${got.src.split('/').pop()} ${got.w} px`);
      await page.locator('.cp-scene-card').screenshot({ path: join(shots, `ship-scene-${want}.png`) });
      if (i === 1 && await page.locator('.cp-scene-pic').count()) {
        // Clicked, a picture is as wide as the card; clicked again, it is small again.
        await page.locator('.cp-scene-pic').click();
        const big = await page.evaluate(() => Math.round(document.querySelector('.cp-scene-pic').getBoundingClientRect().width));
        await page.locator('.cp-scene-pic').click();
        const small = await page.evaluate(() => Math.round(document.querySelector('.cp-scene-pic').getBoundingClientRect().width));
        check(big >= 600 && small === got.shown, `a scene's picture enlarges when it is clicked (${f.name})`, `${small} px, ${big} px`);
      }
      await page.locator(i === 0 ? '.cp-scene [data-act="scene-later"]' : '.cp-scene [data-act="scene-ok"]').click();
      await page.waitForTimeout(120);
    }
    check(bad.length === 0, `every later scene of ${f.name} shows its own picture`, bad.length ? bad.join('; ') : `${queue.length - 1} scenes`);
    check(await page.locator('.cp-scene').count() === 0, `the scenes of ${f.name} are gone through`);
  }
  // Comms keeps the leaders' portraits.
  await page.locator('[data-room="comms"]').click();
  await page.waitForTimeout(200);
  check(await page.locator('.cp-voice img.cp-leader').count() >= 1, 'Comms keeps the portrait of a faction that made contact');
  check(errors.length === 0, 'no errors in the page', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.kill();
  freePort();
}
console.log(failures.length ? `\nSHIP CHECK: ${failures.length} failure(s): ${failures.join('; ')}` : '\nSHIP CHECK: all passed.');
process.exit(failures.length ? 1 : 0);
