import { spawn, execSync } from 'node:child_process';
import { chromium } from '@playwright/test';
const root = 'C:/Users/Merry/dev/space-derelict/games/broodfall';
const env = { ...process.env, BROODFALL_NO_HMR: '1', RFAB_API_BASE: 'http://localhost:3011' }; delete env.RFAB_API_KEY;
const child = spawn('npx.cmd', ['vite', '--port', '5249', '--strictPort'], { cwd: root, stdio: 'pipe', shell: true, env });
await new Promise((r) => child.stdout.on('data', (d) => { if (String(d).includes('localhost')) r(); }));
const b = await chromium.launch(); const p = await b.newPage(); p.setDefaultNavigationTimeout(180000);
p.on('console', (m) => console.log('PAGE', m.text()));
await p.goto('http://localhost:5249/?seed=3');
const out = await p.evaluate(async () => {
  const m = await import('/src/meta/yokePlayer.ts');
  const store = { v: null, load() { return this.v; }, save(t) { this.v = t; }, clear() { this.v = null; } };
  const link = new m.PlayerLink({ base: '/rfab-api', store });
  const code = await link.startConnect();
  let r; try { r = await link.pollConnect(code.deviceCode); } catch (e) { r = { err: String(e), status: e.status, code: e.code }; }
  return { code, r };
});
console.log(JSON.stringify(out));
await b.close(); execSync(`taskkill /PID ${child.pid} /T /F`);
