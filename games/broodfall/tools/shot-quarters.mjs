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
    Object.assign(s, { onboard: { mission1: 'won', deskOpen: true }, said: ['mate-review', 'catgirl'], greetingsSaid: ['intro-board'], greet: null, staging: null, underAttack: null, standing: 31 });
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

  // The Letters room (Oct 14 2026): the two threads, their first letters waiting, a letter of his sent and waiting.
  check(await page.$('button.cp-room[data-room="letters"]') !== null, 'the Letters room is in the bar once the mate review has played');
  await page.click('button.cp-room[data-room="letters"]');
  await page.waitForSelector('.cp-letters', { timeout: 30000 });
  const threads = await page.$$eval('.cp-thread b', (bs) => bs.map((b) => b.textContent));
  check(threads.join('|') === 'Atlas Vell|Mirelle|Rook Halloran', `the people: ${threads.join(', ')}`);
  const first = await page.evaluate(() => document.querySelector('.cp-letters-thread .cp-letter')?.textContent ?? '');
  check(first.includes('I am writing for Atlas Vell'), 'her companion\'s first letter waits in the open thread');
  check(await page.evaluate(() => [...document.querySelectorAll('.cp-letters .cp-label')].some((l) => l.textContent?.includes('regard: 0 of 3'))), 'the gate is shown: regard 0 of 3');
  await page.fill('#letter-text', 'Hello. I read the file. Tell her the glasses are a good choice.');
  await page.click('[data-act="letter-send"]');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => !!document.querySelector('.cp-letter-wait')), 'the letter is sent and the thread waits for the next report');
  check(await page.evaluate(() => document.querySelectorAll('.cp-letter.you').length === 1), 'his letter is in the thread');
  await page.screenshot({ path: join(out, 'letters-room.jpg'), type: 'jpeg', quality: 85 });
  await page.click('.cp-thread[data-thread="mirelle"]');
  await page.waitForTimeout(200);
  check(await page.evaluate(() => (document.querySelector('.cp-letters-thread')?.textContent ?? '').includes('pound sand')), 'Mirelle\'s thread opens on her proposal, with YOKE\'s note under it');
  await page.waitForTimeout(1500);
  check(await page.evaluate(() => { const v = document.querySelector('.cp-letters-thread video.cp-letter-pic'); return !!v && (v.currentSrc || v.src).includes('letters-mirelle.mp4'); }), 'her picture beside the thread plays its loop');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, 'letters-mirelle.jpg'), type: 'jpeg', quality: 85 });
  console.log(`  shots: ${join(out, 'letters-room.jpg')} and ${join(out, 'letters-mirelle.jpg')}`);

  // A reply, end to end in the real page (scripted mind): he asks Rook about her skin, a deployment passes, he comes
  // aboard; her letter arrives with the orca, the thread is marked, and on the next return YOKE says it before the briefing.
  await page.click('.cp-thread[data-thread="rook"]');
  await page.waitForTimeout(200);
  await page.waitForTimeout(1500);
  check(await page.evaluate(() => { const v = document.querySelector('.cp-letters-thread video.cp-letter-pic'); return !!v && (v.currentSrc || v.src).includes('letters-rook.mp4'); }), 'Rook\'s picture beside her thread plays its loop');
  await page.fill('#letter-text', 'Straight question. What is with the black and white skin?');
  await page.click('[data-act="letter-send"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('broodfall-campaign'));
    s.deployments += 1; s.greet = 'won'; s.lastGreeting = 'won-1';
    s.greetingsSaid = [...new Set([...(s.greetingsSaid ?? []), 'letter-rook'])];
    localStorage.setItem('broodfall-campaign', JSON.stringify(s));
  });
  await page.goto(`${URL0}?campaign=ship`, GO);
  await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
  await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem('broodfall-campaign')); const t = s.letters?.threads?.rook; return t && t.turns[t.turns.length - 1].who === 'them'; }, null, { timeout: 30000 }).catch(() => {});
  const rook = await page.evaluate(() => JSON.parse(localStorage.getItem('broodfall-campaign')).letters.threads.rook);
  const reply = rook.turns[rook.turns.length - 1];
  check(reply.who === 'them' && /orca/i.test(reply.text.join(' ')), `her reply came with the return: "${reply.text[0]}"`);
  check((rook.revealed ?? []).includes('orca') && rook.regard >= 1, `the thread is marked revealed (regard ${rook.regard})`);
  check(rook.unread >= 1 && await page.evaluate(() => !!document.querySelector('button.cp-room[data-room="letters"] .cp-count')), `her letter is unread (${rook.unread}) and the Letters button shows a count`);
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('broodfall-campaign')); s.greet = 'won'; s.deployments += 1; localStorage.setItem('broodfall-campaign', JSON.stringify(s)); });
  await page.goto(`${URL0}?campaign=ship`, GO);
  await page.waitForSelector('#campaign:not(.hidden)', { timeout: 180000 });
  await page.waitForTimeout(1500);
  const g = await page.evaluate(() => document.getElementById('campaign').dataset.greeting);
  check(g === 'letter-rook-orca', `YOKE's greeting on the next return: ${g}`);
  await page.screenshot({ path: join(out, 'letters-yoke-orca.jpg'), type: 'jpeg', quality: 85 });
} finally {
  await browser.close();
  dev.kill();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
