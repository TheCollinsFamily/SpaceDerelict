/**
 * PLACING A DRAFTED DISTRICT, played in the real page (Nov 22 2026; src/ui/districtPlace.ts). Real clicks and keys:
 *   1. a draft's three cards (each says how many places it fits);
 *   2. a card clicked: the district in hand over its own place (green);
 *   3. hovered over a slot where it does not fit as it is turned (red, the reason, the clashing mouth);
 *   4. R: turned, and over a slot it fits turned that way (green);
 *   5. clicked: put down; the board as it is after;
 *   6-8. three more drafts on the growing city, each placed by hand somewhere other than the offer's own place.
 * Usage: node tools/shot-place.mjs   (starts its own dev server on 5388; BROODFALL_PORT to change)
 * Artifacts: notes/screens/2026-11-22/place-*.jpg
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'notes', 'screens', '2026-11-22');
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5388);
const SEED = Number(process.env.SEED || 7);
const ENT = Number(process.env.ENTRANCES || 1);
const TAG = process.env.TAG ? `${process.env.TAG}-` : '';
const failures = [];
const check = (ok, name, detail = '') => {
  if (ok) console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  else { failures.push(name); console.log(`  FAIL  ${name} — ${detail}`); }
};

const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite did not start')), 60000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('  page error:', e.message));
const shot = (name) => page.screenshot({ path: join(out, `place-${TAG}${name}.jpg`), type: 'jpeg', quality: 86 });

/** The client point of the middle of a slot (where the pointer goes to hover it). */
const slotPoint = (slot) => page.evaluate((slot) => {
  const b = window.broodfall;
  const s = b.sim;
  const P = 10;
  const x = ((slot % s.map.slotsX) * P + 5) * s.cfg.cellPx;
  const y = (Math.floor(slot / s.map.slotsX) * P + 5) * s.cfg.cellPx;
  return b.renderer.clientOf(s, x, y);
}, slot);
const hover = async (slot) => { const p = await slotPoint(slot); await page.mouse.move(p.x, p.y, { steps: 6 }); await page.waitForTimeout(250); return p; };
const state = () => page.evaluate(() => window.broodfall.placer()?.state() ?? null);
/** Open a real draft on the board as it stands (its own dice), as a wave's clear does. */
const openDraft = (n) => page.evaluate((n) => {
  const b = window.broodfall;
  const s = b.sim;
  const offers = b.draftOffersFor(1000 + n);
  s.markShelterOffer(offers);
  s.phase = 'draft';
  s.pendingDraft = offers;
  return offers.map((o) => ({ id: o.pattern.id, slot: o.slot, feature: o.feature, shelter: !!o.shelter }));
}, n);
/** Frame the claimed city and the ring of slots round it. */
const frame = async () => {
  await page.evaluate(() => { const b = window.broodfall; b.renderer.resetView(); b.renderer.zoomAt?.(700, 450, 0.8); b.step(1); });
  await page.waitForTimeout(900);
};

try {
  await page.goto(`http://localhost:${PORT}/?autostart=1&seed=${SEED}&speed=0&biome=suburb&landing=0&entrances=${ENT}`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.broodfall !== undefined && window.broodfall.biome() !== '', null, { timeout: 90000 });
  await page.evaluate(() => { const b = window.broodfall; b.surface(); b.step(2); });
  await page.waitForTimeout(1500);

  // 1. The cards.
  const offers = await openDraft(0);
  await page.waitForSelector('.draft-option', { timeout: 10000 });
  await page.waitForTimeout(1500);
  const where = await page.evaluate(() => [...document.querySelectorAll('.draft-option .df-where')].map((e) => e.textContent));
  check(where.length === 3 && where.every((w) => /FITS \d+ PLACE/.test(w)), 'every card says how many places it fits', where.join(' | '));
  await shot('1-cards');

  // 2. Take one in hand: the ghost over its own place, green.
  await page.locator('.draft-option').nth(0).click();
  await page.waitForTimeout(400);
  let st = await state();
  check(st !== null && st.slot === offers[0].slot && st.problem === null, 'in hand, over its own place, and it fits', JSON.stringify(st));
  check(await page.locator('#draft').evaluate((e) => e.classList.contains('hidden')), 'the cards step aside');
  await frame();
  await hover(offers[0].slot);
  st = await state();
  check(st.problem === null, 'hovered on its own place: green', JSON.stringify(st));
  await shot('2-ghost-legal');

  // 3. A slot where it does not fit as it is turned (prefer one it fits turned: the clash shows on a mouth).
  // ...else a free slot beside the city where it does not fit.
  const bad = st.fitsTurned[0] ?? await page.evaluate(() => {
    const s = window.broodfall.sim;
    const X = s.map.slotsX;
    const held = (x, y) => x >= 0 && y >= 0 && x < X && y < s.map.slotsY && !!s.map.slots[y * X + x];
    const fits = window.broodfall.placer().state().fits;
    return s.map.slots.findIndex((v, i) => v === null && !fits.includes(i) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => held((i % X) + dx, Math.floor(i / X) + dy)));
  });
  await hover(bad);
  st = await state();
  const why = await page.locator('#place-district .pd-why').textContent();
  check(st.slot === bad && st.problem !== null, 'hovered where it does not fit: red, with the reason', why);
  await shot('3-ghost-illegal');
  // A click there is refused, the draft stays open.
  const p3 = await slotPoint(bad);
  await page.mouse.click(p3.x, p3.y);
  await page.waitForTimeout(300);
  check(await page.evaluate(() => window.broodfall.sim.phase === 'draft'), 'a click on a red slot puts nothing down');

  // 4. R until it fits there (if it fits there some way round).
  let turns = 0;
  for (; turns < 4; turns++) {
    st = await state();
    if (st.problem === null) break;
    await page.keyboard.press('r');
    await page.waitForTimeout(250);
  }
  st = await state();
  check(st.problem === null || st.fits.length > 0, `R turns it (${turns} turns)`, JSON.stringify({ rot: st.rot, problem: st.problem }));
  if (st.problem !== null) await hover(st.fits[0]);
  await page.waitForTimeout(300);
  await shot('4-rotated');
  // The camera turned (E): the ghost turns with the board, the same slot still fits.
  const before = await state();
  await page.keyboard.press('e');
  await frame();
  await hover(before.slot);
  const after = await state();
  check(after.slot === before.slot && after.problem === before.problem, 'with the camera turned, the same slot answers the same', JSON.stringify({ before: before.slot, after: after.slot }));
  await shot('4b-camera-turned');
  await page.keyboard.press('q');
  await frame();
  // Shift+R and back, the panel's buttons: the turn goes both ways.
  const r0 = (await state()).rot;
  await page.keyboard.press('Shift+R');
  check((await state()).rot === (r0 + 3) % 4, 'Shift+R turns it back');
  await page.locator('#place-district .pd-cw').click();
  check((await state()).rot === r0, 'the TURN button turns it');
  // Esc: back to the cards, and in hand again.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => !window.broodfall.placer().active() && !document.getElementById('draft').classList.contains('hidden')), 'Esc: back to the cards');
  await page.locator('.draft-option').nth(0).click();
  await page.waitForTimeout(300);
  for (let k = 0; k < r0; k++) await page.keyboard.press('r');
  st = await state();
  const target = st.fits.includes(bad) ? bad : st.fits[0];

  // 5. Click: put down.
  const p5 = await hover(target);
  await page.mouse.click(p5.x, p5.y);
  await page.waitForTimeout(600);
  const placed = await page.evaluate((target) => { const s = window.broodfall.sim; return { phase: s.phase, at: s.map.slots[target]?.pattern.id ?? null }; }, target);
  check(placed.phase !== 'draft' && placed.at !== null, 'a click on a green slot puts it down, turned', JSON.stringify(placed));
  await frame();
  await page.mouse.move(5, 5);
  await shot('5-placed');

  // 6-8. More drafts on the growing city, each placed by hand away from the offer's own place where it can be.
  for (let n = 1; n <= 3; n++) {
    const o = await openDraft(n);
    await page.waitForSelector('#draft:not(.hidden) .draft-option', { timeout: 10000 });
    await page.waitForTimeout(800);
    await page.locator('.draft-option').nth(n % o.length).click();
    await page.waitForTimeout(300);
    await frame();
    // Turn it until some slot other than its own place fits, then hover that.
    let pickSlot = null;
    for (let k = 0; k < 4 && pickSlot === null; k++) {
      st = await state();
      pickSlot = st.fits.find((sl) => sl !== o[n % o.length].slot) ?? null;
      if (pickSlot === null) await page.keyboard.press('r');
    }
    st = await state();
    pickSlot = pickSlot ?? st.fits[0];
    const p = await hover(pickSlot);
    await shot(`${5 + n}a-draft${n}-hover`);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(500);
    const ok = await page.evaluate((sl) => window.broodfall.sim.map.slots[sl] !== null && window.broodfall.sim.phase !== 'draft', pickSlot);
    check(ok, `draft ${n}: placed by hand on slot ${pickSlot} (turned ${st.rot})`);
    await frame();
    await page.mouse.move(5, 5);
    await shot(`${5 + n}b-draft${n}-placed`);
  }
  const sum = await page.evaluate(() => window.broodfall.summary());
  check(sum.gates > 0, 'the hive still has a way in', `${sum.districts} districts, ${sum.gates} gates`);
} catch (e) {
  failures.push(String(e));
  console.log('  ERROR', e);
} finally {
  await browser.close();
  server.kill();
}
console.log(failures.length ? `\n${failures.length} FAILED` : '\nall passed');
process.exit(failures.length ? 1 : 0);
