/**
 * Every film not yet baked, made by the film system one after another (`cutscenes.ts make <film>`), at 480p. Before
 * each film the RFab balance is checked, and when it would not cover the film with a fifth to spare, Collins's own
 * account is topped up by $100 (the global rule; every grant emails him). A film that fails its gates is left, and the
 * next is made; the summary at the end says which.
 *
 *   node tools/media/make-all.mjs [film ...]       (SPENDS)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const COLLINS = 'f00afa59-f1d7-410d-875b-0be48d968c8a';
const TOKENS_PER_SEC = 10310 * 1.6; // Seedance 2.5 at 480p, with room for a retry
const man = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'media', 'scenes', 'scenes.json'), 'utf8')).films;
const run = (args) => spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite-node', 'tools/media/cutscenes.ts', '--', ...args], { cwd: ROOT, encoding: 'utf8', shell: true, maxBuffer: 1 << 26, env: { ...process.env, CUTSCENE_TALK_RES: '480p' } });
/** The balance, asked again after a dropped connection (one stopped the first run). */
async function balance() {
  for (let i = 0; ; i++) {
    try { return (await (await fetch('https://api.rfab.ai/api/tokens/balance', { headers: { 'X-API-Key': process.env.RFAB_API_KEY } })).json()).tokenBalance; }
    catch (e) { if (i >= 5) throw e; await new Promise((r) => setTimeout(r, 5000 * (i + 1))); }
  }
}

const list = run(['list']).stdout.split('\n').map((l) => l.trim().split(/\s+/)).filter((p) => p[0] && /^[a-z]/.test(p[0]));
const want = process.argv.slice(2);
const todo = list.filter((p) => !man()[p[0]] && (!want.length || want.includes(p[0]))).map((p) => ({ id: p[0], secs: Number((p.find((x) => /^~\d+$/.test(x)) ?? '~60').slice(1)) }));
console.log(`[all] ${todo.length} films to make: ${todo.map((f) => f.id).join(' ')}`);
let granted = 0;
const done = [], failed = [];
for (const f of todo) {
  const need = Math.round(f.secs * 0.8 * TOKENS_PER_SEC);
  let bal = await balance();
  while (bal < need * 1.2) {
    const ref = `broodfall-films-oct5-${granted}`;
    const g = spawnSync('node', ['C:/Users/Merry/agent-tools/rfab-grant.js', COLLINS, '--usd', '100', '--ref', ref, '--reason', 'Broodfall: the cut scene films at 480p (the film system)', '--apply'], { encoding: 'utf8' });
    console.log(`[all] top-up $100 (${ref}): ${(g.stdout.match(/RESULT.*/) ?? [g.stderr.slice(0, 200)])[0]}`);
    granted++;
    if (granted > 6) { console.error('[all] stopping: more than $600 granted in this run'); process.exit(1); }
    bal = await balance();
  }
  console.log(`[all] ${f.id} (~${f.secs} s of shots), balance ${bal}`);
  const r = run(['make', f.id]);
  const out = (r.stdout + r.stderr).split('\n').filter((l) => /^\[make\]|^\[talk\] t\d|FAILS|passes|stops at|Error/.test(l));
  for (const l of out) console.log('   ' + l.slice(0, 220));
  (man()[f.id] && !/the film FAILS/.test(r.stdout) ? done : failed).push(f.id);
}
console.log(`[all] made: ${done.join(' ') || 'none'}`);
console.log(`[all] not made or failed a gate: ${failed.join(' ') || 'none'}`);
console.log(`[all] topped up: $${granted * 100}`);
