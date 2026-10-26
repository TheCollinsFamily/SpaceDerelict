/**
 * THE EXPERIMENTS, IN THE REAL PAGE (Oct 26 2026; Collins: "Are the special building used in the exprimental missions made
 * and tested?"). A campaign save four captures in (the desk open) is put in the page's storage; then:
 *  - the ship's Specimen Locker (every experiment with its sketch and its state) and the Directive Desk's briefing with
 *    the experiments to pick;
 *  - each experiment deployed through ?campaign=run as the game deploys it: its gear is in the first hand (the trap cage,
 *    two lures, two flamethrowers, a maw), the gear is grown on the board by the page's own command, the board is
 *    played on, and a screenshot of each is taken.
 * Needs a build (npm run build). Writes notes/screens/2026-10-26/experiments-*.jpg.
 *   npx vite-node tools/shot-experiments.ts
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { EXPERIMENTS } from '../content/campaign';
import { newCampaign, targets, type CampaignState } from '../src/meta/campaign';

const PORT = Number(process.env.BROODFALL_PORT || 5209);
const root = join(__dirname, '..');
const out = join(root, 'notes', 'screens', '2026-10-26');
mkdirSync(out, { recursive: true });
try {
  const o = execSync('netstat -ano', { encoding: 'utf8' });
  for (const line of o.split('\n')) {
    const m = line.match(new RegExp(`:${PORT}\\s+\\S+\\s+LISTENING\\s+(\\d+)`));
    if (m) { try { execSync(`taskkill /PID ${m[1]} /T /F`, { stdio: 'ignore' }); } catch { /* gone */ } }
  }
} catch { /* no netstat */ }
const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });

let failed = 0;
const check = (ok: boolean, what: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const shot = (page: Page, name: string) => page.screenshot({ path: join(out, `experiments-${name}.jpg`), type: 'jpeg', quality: 82 });

// Four captures in, the desk open, every experiment on offer (Royal Diet needs four).
const save: CampaignState = { ...newCampaign(4242), onboard: { mission1: 'won', deskOpen: true }, captures: 4, deployments: 5 };
const site = targets(save)[0].id;
const GEAR: Record<string, string[]> = {
  'puppet-queen': ['cage'], 'love-gas': ['lure', 'lure'], nursery: ['ember', 'ember'], 'royal-diet': ['maw'], 'follow-courier': [],
};

try {
  await new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('preview did not start')), 30000);
    server.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(); } });
  });
  const base = `http://localhost:${PORT}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base);
  await page.evaluate((s) => { localStorage.setItem('broodfall-campaign', JSON.stringify(s)); localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' })); }, save);

  console.log('THE SHIP');
  await page.goto(`${base}?campaign=ship`);
  await page.waitForSelector('#campaign:not(.hidden)', { timeout: 45000 });
  await page.waitForTimeout(1500);
  const close = page.locator('.cp-icom [data-act="icom-close"]');
  if (await close.count()) await close.first().click();
  const locker = page.locator(".cp-rooms [data-room=\"locker\"]");
  if (await locker.count()) await locker.first().click();
  await page.waitForTimeout(800);
  const lockerText = await page.locator('#campaign').innerText();
  for (const e of EXPERIMENTS) check(lockerText.includes(e.name), `the Locker lists ${e.name}`);
  check(lockerText.includes('packed two lures') && lockerText.includes('packed two flamethrowers') && lockerText.includes('tag the first one'), 'the Locker tells what each experiment issues');
  const sketches = await page.locator('#campaign .cp-sketch').count();
  check(sketches >= EXPERIMENTS.length, `the experiments' sketches are drawn (${sketches})`);
  await shot(page, 'locker');
  // The Gene Bay: where standing and field notes are spent. Every lineage for sale carries its organ's picture.
  await page.locator('.cp-rooms [data-room="genes"]').first().click();
  await page.waitForTimeout(1500);
  const lineages = await page.locator('#campaign .cp-lin [data-buy]').count();
  const pics = await page.locator('#campaign .cp-lin:has([data-buy]) .cp-organ-pic').count();
  check(lineages > 0 && pics === lineages, `every lineage for sale has its organ's picture (${pics} of ${lineages})`);
  const broken = await page.evaluate(() => [...document.querySelectorAll<HTMLImageElement>('#campaign img.cp-organ-pic')].filter((i) => i.complete && i.naturalWidth === 0).length);
  check(broken === 0, `no organ picture fails to load (${broken} broken)`);
  await shot(page, 'genebay');

  for (const e of EXPERIMENTS) {
    console.log(e.name.toUpperCase());
    await page.evaluate(([s, p]) => {
      localStorage.setItem('broodfall-campaign', JSON.stringify(s));
      localStorage.setItem('broodfall-campaign-pending', JSON.stringify(p));
    }, [save, { territory: site, dares: [], experiment: e.id, objectors: [] }] as const);
    await page.goto(`${base}?campaign=run&landing=0`);
    await page.waitForSelector('#stage canvas', { timeout: 60000 });
    await page.waitForFunction(() => !!(window as unknown as { broodfall?: { sim?: unknown } }).broodfall?.sim, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    const hand = await page.evaluate(() => (window as unknown as { broodfall: { sim: { hand: Array<{ family: string; free?: boolean }> } } }).broodfall.sim.hand.map((c) => `${c.family}${c.free ? '*' : ''}`));
    const free = hand.filter((h) => h.endsWith('*')).map((h) => h.slice(0, -1)).sort();
    check(JSON.stringify(free) === JSON.stringify([...GEAR[e.id]].sort()), `its gear is in the first hand: ${free.join(', ') || 'none'} (hand ${hand.join(' ')})`);
    const cfg = await page.evaluate(() => { const c = (window as unknown as { broodfall: { sim: { cfg: Record<string, unknown> } } }).broodfall.sim.cfg; return { matingMusk: c.matingMusk, trapCage: c.trapCage, followCourier: c.followCourier, royalDiet: c.royalDiet, directive: c.directive }; });
    console.log(`    run config: ${JSON.stringify(cfg)}`);
    // Grow every piece of gear where the board allows, by the page's own command, then let the run play a while.
    const grown = await page.evaluate(() => {
      const bf = (window as unknown as { broodfall: { sim: { hand: Array<{ family: string; free?: boolean }>; canBuildTower(c: number, f?: string): boolean; map: { cells: unknown[] }; issue(c: unknown): { ok: boolean }; towers: Array<{ family: string }> }; step(n: number): void } }).broodfall;
      const s = bf.sim;
      const done: string[] = [];
      for (let guard = 0; guard < 6; guard++) {
        const i = s.hand.findIndex((c) => c.free);
        if (i < 0) break;
        const fam = s.hand[i].family;
        let ok = false;
        for (let c = 0; c < s.map.cells.length && !ok; c++) if (s.canBuildTower(c, fam)) ok = s.issue({ kind: 'build', cardIndex: i, cell: c }).ok;
        if (!ok) break;
        done.push(fam);
      }
      bf.step(600);
      return { done, onBoard: s.towers.map((t) => t.family) };
    });
    check(grown.done.length === GEAR[e.id].length && GEAR[e.id].every((f) => grown.onBoard.includes(f)), `the gear grew on the board: ${grown.done.join(', ') || 'nothing to grow'}`);
    await page.waitForTimeout(1200);
    const missing = await page.evaluate(() => (window as unknown as { broodfall: { artMissing(): string[] } }).broodfall.artMissing());
    check(!missing.some((m) => GEAR[e.id].some((g) => m.includes(g))), `its gear's pictures are loaded${missing.length ? ` (missing elsewhere: ${missing.slice(0, 4).join(', ')})` : ''}`);
    await shot(page, e.id);
  }
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await browser.close();
} finally {
  server.kill();
}
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
