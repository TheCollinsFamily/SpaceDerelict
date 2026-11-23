/**
 * THE WORLD UNFOLDS, PLAYED IN THE REAL PAGE (Nov 23 2026; DESIGN.md "The world unfolds"). A hold-12 skirmish on a seed:
 * limbs put down near the telegraphed gate, waves started with the START button and stepped (window.broodfall.step); at
 * every organ stage up to two organs grown from the shelf as it stands. Silent: headless, --mute-audio.
 *
 * Screens (in the output folder):
 *   unfold-organs-wN.png   the organ stage as it opens after wave N (the head row: the tally, NEW ON THE SHELF, the knit count)
 *   unfold-banner-*.png    each new layer's banner on the board as it is told (the science caste, the court)
 *   unfold-feed-wN.png     the feed as wave N starts (leftover science rendered into chyme)
 * Prints a line a wave. The script hands the body extra war meat before each wave (EXTRA_WAR) and keeps the core at 80%
 * (HOLD_CORE) so a scripted, naive placement lives to see wave 8; the numbers that matter are measured in tools/measure.
 * Usage: node tools/shot-unfold.mjs <base url of a running dev server> <output folder> [seed] [waves]
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const base = process.argv[2] || 'http://localhost:5321';
const out = process.argv[3] || 'tools/screenshots';
const seed = Number(process.argv[4] || 7);
const WAVES = Number(process.argv[5] || 8);
const EXTRA_WAR = 80;
// The core is topped up while the waves are stepped: this walk is for SEEING each layer open by wave 8, not for balance.
const HOLD_CORE = true;
const ORGANS_AT = new Set([1, 2, 3, 4, 5, 6, 8]);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const shot = (name) => page.screenshot({ path: join(out, `unfold-${name}.png`) });
const told = new Set();
const log = [];

async function placeLimbs() {
  return page.evaluate((extra) => {
    const b = window.broodfall;
    const s = b.sim;
    s.meat.war += extra;
    let n = 0;
    for (let guard = 0; guard < 14; guard++) {
      let placed = false;
      for (let k = 0; k < s.hand.length && !placed; k++) {
        const g = s.cellCenter(s.incomingGates[0] ?? s.gates[0]);
        const cells = b.buildableCells(3000).sort((a, c) => { const pa = s.cellCenter(a), pc = s.cellCenter(c); return Math.hypot(pa.x - g.x, pa.y - g.y) - Math.hypot(pc.x - g.x, pc.y - g.y); });
        for (const cell of cells) { if (b.play({ kind: 'build', cardIndex: k, cell }).ok) { placed = true; n++; break; } }
      }
      if (!placed) break;
    }
    return n;
  }, EXTRA_WAR);
}

/** The banner as it stands: its text if it is showing. */
const bannerText = () => page.evaluate(() => { const b = document.getElementById('banner'); return b && !b.classList.contains('hidden') ? b.textContent : ''; });

/** Shoot a layer's banner the first time it is up. */
async function catchBanner() {
  const t = await bannerText();
  const key = /SCIENCE CASTE/.test(t) ? 'science' : /THE COURT/.test(t) ? 'court' : /ROYAL TAKES/.test(t) ? 'royal' : '';
  if (key && !told.has(key)) { told.add(key); await page.waitForTimeout(500); await shot(`banner-${key}`); log.push(`  banner (${key}): ${t.replace(/\n/g, ' / ')}`); }
}

async function wave(n) {
  await placeLimbs();
  await page.locator('#call-early').click();
  await page.waitForTimeout(700);
  await catchBanner();
  const feed = await page.evaluate(() => [...document.querySelectorAll('#feed .feed-item')].map((e) => e.textContent).filter((t) => /rendered into/.test(t)));
  if (feed.length) { await shot(`feed-w${n}`); log.push(`  feed: ${feed[0]}`); }
  for (let i = 0; i < 1600; i++) {
    await page.evaluate((hold) => { const s = window.broodfall.sim; window.broodfall.step(5); if (hold && s.coreHp > 0 && s.coreHp < s.coreMaxHp * 0.8) s.coreHp = s.coreMaxHp * 0.8; }, HOLD_CORE);
    await catchBanner();
    const s = await page.evaluate(() => ({ p: window.broodfall.sim.phase, o: window.broodfall.sim.outcome }));
    if (s.p !== 'siege' || s.o !== 'playing') break;
  }
  await page.evaluate(() => { const s = window.broodfall.sim; while (s.phase === 'draft') s.issue({ kind: 'choose-plate', index: 0, ...(s.defaultPlacement(0) ?? {}) }); });
  const st = await page.evaluate(() => { const s = window.broodfall.sim; return { o: s.outcome, core: Math.round(Math.max(0, s.coreHp) / s.coreMaxHp * 100), tally: s.lastChymeTally, chyme: Math.floor(s.chyme), royal: s.meat.royal, organs: s.organs.length, onShelf: window.broodfall.sim.under ? null : null }; });
  log.push(`wave ${n}: ${st.o} · core ${st.core}% · tally ${JSON.stringify(st.tally)} · bank ${st.chyme} · royal ${st.royal} · organs ${st.organs}`);
  if (st.o !== 'playing') return false;
  await page.waitForSelector('#under:not(.hidden)', { timeout: 10000 });
  await page.waitForTimeout(2600);
  if (ORGANS_AT.has(n)) await shot(`organs-w${n}`);
  const head = await page.evaluate(() => document.getElementById('under-meat')?.innerText.replace(/\s+/g, ' '));
  log.push(`  organ stage head: ${head}`);
  // Grow up to two organs from the shelf as it stands (themes first), then a third try to show the knit refusal.
  const grown = await page.evaluate(() => {
    const s = window.broodfall.sim;
    const order = ['gut', 'forge', 'lattice', 'venom', 'nerve', 'womb', 'bladder', 'cyst', 'rumen', 'marrow', 'resonance', 'heart', 'brain', 'pacemaker', 'mire', 'scaffold', 'seeder', 'catapult', 'infestor', 'harrier'];
    const out = [];
    for (const id of order) {
      if (s.organs.some((o) => o.organ === id) && id !== 'heart') continue;
      let done = false;
      for (let c = 0; c < s.under.cells.length && !done; c++) for (let r = 0; r < 4 && !done; r++) {
        if (s.canBuildOrgan(id, c, r) && window.broodfall.play({ kind: 'build-organ', organ: id, cell: c, rot: r }).ok) { out.push(id); done = true; }
      }
      if (s.organsLeftThisStage <= 0) break;
    }
    return out;
  });
  log.push(`  grew ${grown.join(', ') || 'nothing'}`);
  await page.waitForTimeout(400);
  if (n === 4) await shot('organs-w4-knit-full');
  await page.locator('#under-done').click();
  await page.waitForTimeout(400);
  return true;
}

try {
  await page.goto(`${base}/?seed=${seed}&autostart=1&speed=0&directive=hold`, { waitUntil: 'load' });
  await page.waitForSelector('#stage canvas', { timeout: 60000 });
  await page.waitForTimeout(2500);
  await shot('start');
  for (let n = 1; n <= WAVES; n++) if (!(await wave(n))) break;
} finally {
  // eslint-disable-next-line no-console
  console.log(log.join('\n'));
  // eslint-disable-next-line no-console
  if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
  await browser.close();
}
