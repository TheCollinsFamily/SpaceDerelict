// Prints the city grid as text with the Spine Walls a board would get (1/2/3 = width): . street, B block, p plaza.
// Usage: node tools/walls-ascii.mjs [set] [seed]   (needs a build in dist-walls: node tools/shot-walls.mjs builds it)
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const PORT = 5393;
const NL = String.fromCharCode(10);
const srv = spawn('npx.cmd', ['vite', 'preview', '--outDir', 'dist-walls', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 4000));
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(`http://localhost:${PORT}/?seed=${process.argv[3] || 13}&autostart=1&speed=0&biome=${process.argv[2] || "farmland"}`);
await p.waitForFunction(() => window.broodfall?.sim, null, { timeout: 60000 });
const out = await p.evaluate((NL) => {
  window.broodfall.step(900); const s = window.broodfall.sim;
  Object.defineProperty(s, 'creepRangeCells', { get: () => 99, configurable: true }); window.broodfall.step(60);
  const W = s.cfg.gridW, H = s.cfg.gridH;
  const walls = new Map();
  for (const want of [1, 2, 3]) {
    for (let c = 0; c < s.map.cells.length; c++) {
      if (s.map.cells[c] !== 1) continue;
      const g = s.groundFor(c, 'spine', 'S');
      if (g && g.length === want) { g.forEach((x) => walls.set(x, String(want))); break; }
    }
  }
  const rows = [];
  for (let y = 0; y < H; y++) {
    let r = '';
    for (let x = 0; x < W; x++) {
      const c = y * W + x; const t = s.map.cells[c];
      r += walls.has(c) ? walls.get(c) : c === s.map.coreCell ? 'C' : t === 1 ? '.' : t === 0 ? 'B' : t === 2 ? 'p' : ' ';
    }
    rows.push(r);
  }
  return `map ${W}x${H}  . road  B block  p plaza  1/2/3 = the wall of that width` + NL + rows.join(NL);
}, NL);
console.log(out); await b.close(); srv.kill(); process.exit(0);
