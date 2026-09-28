/**
 * Screenshot beat for the five utility engines: a mitosis node that has budded
 * copies, a capacitor charging a limb, a boomerang node far down a lane, a meat
 * press and a reliquary (with its FREE twin card in hand). Selects each engine so
 * its panel text shows. Writes tools/screenshots/beat-engines-*.png.
 */
import { spawn, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function freePort() {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split(String.fromCharCode(10))) {
      const m = line.match(/:5199\s+\S+\s+LISTENING\s+(\d+)/);
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
    }
  } catch {}
}

freePort();
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview'], {
  cwd: root, stdio: 'pipe', shell: process.platform === 'win32',
});
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('preview did not start')), 30000);
  server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
});
const browser = await chromium.launch();
const errors = [];
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:5199/?seed=7&autostart=1', { waitUntil: 'load' });
  await page.waitForSelector('#stage canvas');
  const setup = await page.evaluate(() => {
    const s = window.broodfall.sim;
    s.meat.war = 9000; s.meat.science = 9000; s.meat.royal = 9000;
    // Organ stage: the engines live behind the Marrow Vault and Resonance Chamber (and the burster behind the Gut).
    for (const id of ['gut', 'marrow', 'resonance']) {
      let done = false;
      for (let c = 0; c < s.under.cells.length && !done; c++) {
        for (let r = 0; r < 4 && !done; r++) if (s.canBuildOrgan(id, c, r)) done = s.issue({ kind: 'build-organ', organ: id, cell: c, rot: r }).ok;
      }
    }
    const w = s.map.w ?? s.cfg.gridW;
    const draw = (fam) => {
      for (let g = 0; g < 600; g++) {
        const i = s.hand.findIndex((h) => h.family === fam && !h.free);
        if (i >= 0) return i;
        s.issue({ kind: 'discard', cardIndex: 0 });
      }
      return -1;
    };
    // Runs of 3 buildable cells in a row: [engine][limb][spare].
    const runs = [];
    for (let c = 0; c < s.map.cells.length && runs.length < 6; c++) {
      if ((c % w) > w - 4) continue;
      if ([0, 1, 2].every((k) => s.canBuildTower(c + k)) && !runs.some((r) => Math.abs(r - c) < 2 * w + 4)) runs.push(c);
    }
    const out = {};
    out.runs = runs.length;
    const pair = (engine, limb, at) => {
      const a = s.issue({ kind: 'build', cardIndex: draw(limb), cell: at + 1 });
      const r = s.issue({ kind: 'build', cardIndex: draw(engine), cell: at, facing: 'E' });
      out[engine] = r.ok ? s.towers[s.towers.length - 1].id : null;
      if (!r.ok || !a.ok) out[engine + 'Err'] = `${a.err ?? ''}/${r.err ?? ''}`;
    };
    pair('mitosis', 'spitter', runs[0]);
    pair('capacitor', 'spitter', runs[1]);
    pair('press', 'burster', runs[2]);
    // Boomerang: several cells down a lane from the mitosis parent, pointed at it.
    const parent = runs[0] + 1;
    for (const dir of [1, -1]) {
      if (out.boomerang) break;
      for (let k = 12; k >= 3; k--) {
        const c = parent + dir * k;
        if (Math.floor(c / w) !== Math.floor(parent / w) || !s.canBuildTower(c)) continue;
        const r = s.issue({ kind: 'build', cardIndex: draw('boomerang'), cell: c, facing: dir > 0 ? 'W' : 'E' });
        if (r.ok) {
          const b = s.towers[s.towers.length - 1];
          if (s.conduitTarget(b)?.cell === parent) { out.boomerang = b.id; out.boomerangCells = k; break; }
          s.issue({ kind: 'butcher', towerId: b.id });
        }
      }
    }
    // Reliquary on the capacitor limb's far side, facing back at it.
    {
      const r = s.issue({ kind: 'build', cardIndex: draw('reliquary'), cell: runs[1] + 2, facing: 'W' });
      out.reliquary = r.ok ? s.towers[s.towers.length - 1].id : null;
      if (!r.ok) out.reliquaryErr = r.err;
    }
    out.freeCard = s.hand.findIndex((h) => h.free);
    // Two waves' worth of mitosis.
    s.events.length = 0; s.budMitosis(); s.budMitosis();
    out.budded = s.events.filter((e) => e.kind === 'budded').length;
    out.spitters = s.towers.filter((t) => t.family === 'spitter').length;
    return out;
  });
  check(setup.mitosis && setup.capacitor && setup.press && setup.reliquary && setup.boomerang, `all five engines built (${JSON.stringify(setup)})`);
  check(setup.freeCard >= 0, 'reliquary pick-up put a FREE twin card in hand');
  check(setup.budded >= 2 && setup.spitters >= 4, `mitosis budded copies (${setup.budded} buds, ${setup.spitters} spitters on the board)`);
  await page.evaluate(() => window.broodfall.step(3));
  const freeText = await page.locator('#hand .card').nth(setup.freeCard).innerText();
  check(/FREE/.test(freeText), `free card shows FREE ("${freeText.replace(/\s+/g, ' ').slice(0, 80)}")`);
  const box = await page.locator('#stage canvas').boundingBox();
  const clickTower = async (id) => {
    const pos = await page.evaluate((i) => window.broodfall.sim.towers.find((t) => t.id === i).pos, id);
    const ss = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), [pos.x, pos.y]);
    await page.mouse.click(box.x + (ss.x / ss.vw) * box.width, box.y + (ss.y / ss.vh) * box.height);
    await page.waitForTimeout(250);
  };
  const want = {
    mitosis: /BUDDING SPITTER/i, capacitor: /CHARGING SPITTER/i, press: /PRESSING BURSTER/i,
    reliquary: /GUARDING SPITTER/i, boomerang: /CALLING BACK SPITTER/i,
  };
  for (const [fam, re] of Object.entries(want)) {
    await page.keyboard.press('Escape');
    await clickTower(setup[fam]);
    const txt = await page.evaluate(() => document.body.innerText);
    check(re.test(txt), `${fam} panel says what it affects`);
    await page.screenshot({ path: join(here, 'screenshots', `beat-engines-${fam}.png`) });
  }
  // Let a wave come in so shots fly (boomerang returns, capacitor spends).
  await page.keyboard.press('Escape');
  const played = await page.evaluate(() => {
    const s = window.broodfall.sim;
    let returned = 0; let bankedMax = 0;
    for (let i = 0; i < 1500; i++) {
      window.broodfall.step(1);
      returned = Math.max(returned, s.projectiles.filter((p) => p.returned).length);
      for (const t of s.towers) bankedMax = Math.max(bankedMax, t.bank ?? 0);
      if (returned > 0 && i > 400) break;
    }
    return { returned, bankedMax };
  });
  check(played.bankedMax >= 1, `capacitor banked shots while idle (peak ${played.bankedMax.toFixed(1)})`);
  check(played.returned > 0, 'boomeranged shots seen flying home');
  await page.screenshot({ path: join(here, 'screenshots', 'beat-engines-wave.png') });
  check(errors.length === 0, errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
  console.log(failed ? `ENGINE BEAT: ${failed} failed` : 'ENGINE BEAT: all verified.');
} finally {
  await browser.close();
  try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
}
process.exit(failed ? 1 : 0);


