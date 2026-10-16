// One-off (Oct 2 2026): the redrawn limbs, placed on a real board and photographed close (for Collins).
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = 'C:/Users/Merry/AppData/Local/Temp/claude/C--Windows-System32/00b2a796-a985-4d58-92b1-a26ae0b02722/scratchpad/towers';
mkdirSync(OUT, { recursive: true });
const PORT = 5399;
const srv = spawn('npx.cmd', ['vite', 'preview', '--outDir', 'dist-state', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 12000));
const b = await chromium.launch();
const FAMS = ['choir', 'impaler', 'frond', 'ember', 'tangler', 'conduit', 'blighter', 'lance', 'amp', 'bombard', 'quill', 'press'];
try {
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(`http://localhost:${PORT}/?seed=31&autostart=1&speed=0&biome=suburb`);
  await page.waitForFunction(() => window.broodfall?.sim, null, { timeout: 60000 });
  const placed = await page.evaluate((fams) => {
    window.broodfall.step(900);
    const s = window.broodfall.sim;
    Object.defineProperty(s, 'creepRangeCells', { get: () => 99, configurable: true });
    window.broodfall.step(80);
    s.meat.war = 99999; s.meat.science = 99999; s.meat.royal = 99;
    const W = s.cfg.gridW;
    const d = (c) => Math.hypot((c % W) - (s.map.coreCell % W), Math.floor(c / W) - Math.floor(s.map.coreCell / W));
    const out = [];
    for (const fam of fams) {
      const cells = [];
      for (let c = 0; c < s.map.cells.length; c++) if (s.groundFor(c, fam)) cells.push(c);
      cells.sort((a, b) => d(a) - d(b));
      let ok = false;
      for (const c of cells.slice(0, 60)) {
        s.hand[0] = { id: 950000 + out.length, family: fam, free: true };
        const r = s.issue({ kind: 'build', cardIndex: 0, cell: c });
        if (r.ok) { const t = s.towers[s.towers.length - 1]; out.push({ fam, x: t.pos.x, y: t.pos.y }); ok = true; break; }
      }
      if (!ok) out.push({ fam, x: null });
    }
    window.broodfall.step(30);
    return out;
  }, FAMS);
  console.log(JSON.stringify(placed.map((p) => `${p.fam}:${p.x !== null ? 'ok' : 'NO ROOM'}`)));
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  // A board overview with all of them, then each close.
  await page.keyboard.press('Home');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/00-all-overview.png` });
  for (const p of placed.filter((q) => q.x !== null)) {
    await page.keyboard.press('Home');
    await page.waitForTimeout(300);
    for (let i = 0; i < 5; i++) {
      const raw = await page.evaluate(([x, y]) => window.broodfall.worldToScreen(x, y), [p.x, p.y]);
      const at = { x: box.x + (raw.x / raw.vw) * box.width, y: box.y + (raw.y / raw.vh) * box.height };
      await page.mouse.move(at.x, at.y);
      await page.mouse.wheel(0, -320);
      await page.waitForTimeout(160);
    }
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${p.fam}.png`, clip: { x: box.x + box.width * 0.2, y: box.y + box.height * 0.15, width: box.width * 0.6, height: box.height * 0.7 } });
  }
} finally {
  await b.close();
  srv.kill();
  spawn('cmd', ['/c', 'for /f "tokens=5" %a in (\'netstat -ano ^| findstr :' + PORT + '\') do taskkill /F /PID %a'], { shell: true });
}
process.exit(0);
