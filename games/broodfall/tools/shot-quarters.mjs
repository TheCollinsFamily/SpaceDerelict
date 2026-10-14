/**
 * HIS QUARTERS, WITH THE PARTNER'S FILE UP (Collins, Oct 14 2026: "show me how she appears in the ui when done"). The real
 * page: a campaign past the mate review, the Quarters room, the data pad with the candidate's file and her looping
 * photograph, the inbox under it. Screenshots to notes/screens/2026-10-14/ (the whole room and the pad alone).
 *
 *   node tools/shot-quarters.mjs   (the game's own dev server, as `npm start` runs it, on BROODFALL_PORT, default 5244)
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'notes', 'screens', '2026-10-14');
mkdirSync(out, { recursive: true });
const PORT = Number(process.env.BROODFALL_PORT || 5244);
const URL0 = `http://localhost:${PORT}/`;
let failed = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const GO = { waitUntil: 'domcontentloaded', timeout: 180000 };

function freePort() {
  try {
    for (const line of execSync('netstat -ano', { encoding: 'utf8' }).split(String.fromCharCode(10))) {
      const m = line.match(new RegExp(':' + PORT + '\\s+\\S+\\s+LISTENING\\s+(\\d+)'));
      if (m) { try { execSync('taskkill /PID ' + m[1] + ' /T /F', { stdio: 'ignore' }); } catch {} }
    }
  } catch {}
}
function startDev() {
  freePort();
  const child = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', env: { ...process.env } });
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('the dev server did not start')), 60000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(t); res(child); } });
  });
}

const dev = await startDev();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(`${URL0}?campaign=ship&open=1`, GO);
  await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('broodfall-campaign'));
    Object.assign(s, { onboard: { mission1: 'won', deskOpen: true }, said: ['mate-review', 'catgirl'], greet: null, staging: null, underAttack: null, standing: 31 });
    localStorage.setItem('broodfall-campaign', JSON.stringify(s));
    localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' }));
    localStorage.setItem('broodfall-alive', 'on'); // the loops are off under webdriver unless asked for (src/ui/alive.ts)
  });
  await page.goto(`${URL0}?campaign=ship`, GO);
  await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.click('button.cp-room[data-room="quarters"]');
  await page.waitForSelector('.cp-pad', { timeout: 30000 });
  await page.waitForTimeout(2500); // the still swaps for its loop (src/ui/alive.ts wake)
  const pad = await page.evaluate(() => document.querySelector('.cp-pad')?.textContent ?? '');
  check(pad.includes('Atlas'), `the pad shows the candidate's file (${pad.replace(/\s+/g, ' ').slice(0, 70)}...)`);
  check(pad.includes('Companion'), 'the Companion line is on the file');
  const alive = await page.evaluate(() => { const v = document.querySelector('.cp-pad video, .cp-pad img.cp-pad-pic'); return v ? `${v.tagName} ${v.getAttribute('src') ?? v.currentSrc ?? ''}` : 'none'; });
  check(alive.startsWith('VIDEO') || alive.includes('alive'), `her photograph is the loop (${alive})`);
  await page.screenshot({ path: join(out, 'quarters-room.jpg'), type: 'jpeg', quality: 85 });
  const el = await page.$('.cp-pad');
  if (el) await el.screenshot({ path: join(out, 'quarters-pad.jpg'), type: 'jpeg', quality: 88 });
  console.log(`  shots: ${join(out, 'quarters-room.jpg')} and ${join(out, 'quarters-pad.jpg')}`);
} finally {
  await browser.close();
  dev.kill();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
