/**
 * The page Collins picks portraits and sees the UI on (https://claude.ai/artifact/2U3zdWWQAeVzK7qghScsYE): built from the
 * draws and the screenshots on disk, every picture scaled to 900 px and embedded as JPEG so the page stays well under the
 * artifact's 16 MB. Writes the HTML to the path given (default: notes/partner-page.html); publish it with the Artifact
 * tool to that url.
 *
 *   node tools/art/partner-page.mjs [out.html]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib/manifest.mjs';

const out = process.argv[2] || path.join(ROOT, 'notes', 'partner-page.html');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'partner-page-'));
const at = (...p) => path.join(ROOT, ...p);
function jpeg(file, width = 900) {
  if (!fs.existsSync(file)) return null;
  const o = path.join(tmp, path.basename(file).replace(/\.\w+$/, '') + '.jpg');
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-vf', `scale='min(${width},iw)':-2`, '-q:v', '4', o]);
  return fs.existsSync(o) ? 'data:image/jpeg;base64,' + fs.readFileSync(o).toString('base64') : null;
}
const fig = (file, caption, alt, wide = false) => { const src = jpeg(file); return src ? `<figure${wide ? ' style="grid-column:1/-1"' : ''}><img src="${src}" alt="${alt}"><figcaption>${caption}</figcaption></figure>` : ''; };
const SHOTS = at('notes', 'screens', '2026-10-14');
const html = `<title>Partner Candidate</title><style>:root{--bg:#f6f4ee;--fg:#1f1d1a;--mute:#6b655b;--line:#dcd6c8}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#17161a;--fg:#ece8df;--mute:#a39d91;--line:#35333a;color-scheme:dark}}:root[data-theme="dark"]{--bg:#17161a;--fg:#ece8df;--mute:#a39d91;--line:#35333a;color-scheme:dark}body{background:var(--bg);color:var(--fg);font-family:"IBM Plex Sans","Segoe UI",system-ui,sans-serif;padding-inline:16px;padding-block:18px;max-width:1240px;margin:0 auto}h1{font-size:18px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 6px}p{color:var(--mute);max-width:70ch;margin:0 0 16px;font-size:14px}.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}figure{margin:0;min-width:0}img{max-width:100%;border:1px solid var(--line);border-radius:6px}figcaption{font-size:13px;color:var(--mute);margin-top:6px}figcaption b{color:var(--fg)}</style>
<h1>Atlas Vell, file 7-2290-S</h1>
<h2>Rook Halloran: four options</h2><p>The convert from the rim's gladiatorial rings, part orca; each shows more of the orca than the last. Say a letter and it goes beside her thread.</p>
<div class="row">${['a', 'b', 'c', 'd'].map((o) => fig(at('art-src', 'letters', 'options', `rook-${o}.png`), { a: '<b>A</b> · orca eye patches only, black hair', b: '<b>B</b> · grey-to-charcoal skin, white patches at the eyes and jaw', c: '<b>C</b> · a white streak, dark glossy skin at the neck and hands, a ridge under the hair', d: '<b>D</b> · an orca\'s black and white, white hair' }[o], `Rook option ${o.toUpperCase()}`)).join('')}</div>
<h2>Mirelle: the girl of D, three fur colours</h2><p>As he corrected it: not a selfie, the cabin like the technician's own ship since she is of the same culture, the girl of D with a different fur colour; the pendant and the fuller figure kept. Say a number and it goes beside her thread in the Letters room.</p>
<div class="row">${[['f1', 'ginger tabby'], ['f2', 'black'], ['f3', 'white']].map(([o, c], i) => fig(at('art-src', 'letters', 'options', `mirelle-${o}.png`), `<b>${i + 1}</b> · ${c}`, `Mirelle ${c}`)).join('')}</div>
<h2>Mirelle: the selfies (superseded)</h2><p>The round before: a selfie, which was not what he meant.</p>
<div class="row">${['s1', 's2', 's3'].map((o, i) => fig(at('art-src', 'letters', 'options', `mirelle-${o}.png`), `<b>${i + 1}</b>`, `Mirelle selfie ${i + 1}`)).join('')}</div>
<h2>Mirelle: the first four</h2><p>Each a different answer to how feline a cat girl is. A and D were the ones he liked.</p>
<div class="row">${['a', 'b', 'c', 'd'].map((o) => fig(at('art-src', 'letters', 'options', `mirelle-${o}.png`), { a: '<b>A</b> · near human: ears, tail and slit pupils only; a wink', b: '<b>B</b> · a little more feline: fur along the cheekbones, a small pink nose, whiskers', c: '<b>C</b> · the consul: formal, composed, tabby-marked', d: '<b>D</b> · a message photo she took herself' }[o], `Mirelle option ${o.toUpperCase()}`)).join('')}</div>
<h2>How she appears in the game</h2><p>His quarters with the Board's file up on the data pad (the photograph plays as a loop there), the pad alone, and the Letters room.</p>
<div class="row">${fig(path.join(SHOTS, 'quarters-room.jpg'), '<b>The room</b> · the pad takes most of it; his log in the column beside it', 'His quarters', true)}${fig(path.join(SHOTS, 'quarters-pad.jpg'), '<b>The pad</b> · FORM PL-7, top to bottom', 'The data pad')}${fig(path.join(SHOTS, 'letters-room.jpg'), '<b>Letters: Atlas, through her companion</b> · his letter sent, waiting for the next report; the gate in the header', 'The Letters room', true)}${fig(path.join(SHOTS, 'letters-mirelle.jpg'), "<b>Letters: Mirelle</b> · her proposal, YOKE's note under it, the compose box", "Mirelle's thread", true)}</div>
<h2>Atlas: the draws</h2><p>D redrawn with the hands down, twice, from D as the reference; D2 is on the data pad, with its looping clip made from it. The four first looks follow, then the earlier draws.</p>
<div class="row">${fig(at('art-src', 'intro', 'options', 'partner-d2.png'), '<b>D2, in the game</b>', 'D2')}${fig(at('art-src', 'intro', 'options', 'partner-d1.png'), '<b>D1</b> · the other hands-down draw of D', 'D1')}${['a', 'b', 'c', 'd'].map((o) => fig(at('art-src', 'intro', 'options', `partner-${o}.png`), `<b>${o.toUpperCase()}</b>`, `Option ${o.toUpperCase()}`)).join('')}${fig(at('art-src', 'intro', 'v1', 'partner-v4-bare-arm.png'), '<b>Before the options</b> · the bare arm, the first time', 'v4')}${fig(at('art-src', 'intro', 'v1', 'partner-v3-arm-covered.png'), '<b>Earlier</b> · the arm covered', 'v3')}</div>`;
fs.writeFileSync(out, html);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${out}: ${Math.round(html.length / 1024)} KB`);
