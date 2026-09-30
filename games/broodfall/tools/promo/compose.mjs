/**
 * THE PROMO SET, COMPOSED (Sep 30 2026): store covers, posters and banners, each laid out in HTML
 * at its exact size and photographed with headless Chromium. The pictures come from
 * tools/promo/gen.mjs (art-src/promo/, git-ignored); the title is the GAME'S OWN LOGO (the emblem
 * picture public/art/screens/emblem.webp + the word set in type exactly as src/screens.css
 * .logo-word sets it), so no lettering is ever asked of the image model. Free to run.
 *
 *   node tools/promo/compose.mjs              everything
 *   node tools/promo/compose.mjs covers       one group (key-art | covers | posters)
 *
 * Output: promo/<group>/*.jpg (quality 90) and promo/covers/library-logo.png (transparent).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'art-src', 'promo');
const BUILD = path.join(ROOT, 'art-src', 'promo-build');
const OUT = path.join(ROOT, 'promo');
const url = (f) => pathToFileURL(f).href;
const pic = (id) => url(path.join(SRC, `${id}.png`));
const EMBLEM = url(path.join(ROOT, 'public', 'art', 'screens', 'emblem.webp'));

// ---- the taglines (the game's voice: procurement-speak, 1950s newsreel, B-movie barker) ----
export const TAGLINES = {
  store: 'EVERY LIMB A TOWER. EVERY STREET A MEAL.',
  monster: 'THIS TIME, YOU ARE THE INFESTATION.',
  bmovie: 'IT CAME FROM ORBIT. ON PURPOSE.',
  asset: "THE EMPIRE'S NEWEST PEST-CONTROL ASSET.",
  waste: 'WASTE NOTHING. NOT EVEN THE ENEMY.',
  yoke: "YOUR SHIP'S AI HAS NOTES.",
};

const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@500;700&family=Special+Elite&family=Bungee&display=block">';

/** The logo exactly as the game sets it (src/screens.css), sized by the word's font size. */
function logo({ word = 110, emblem = 200, stack = false, id = 'logo', fit = 0 } = {}) {
  const rough = (3.5 * word / 104).toFixed(2);
  return `
  <svg width="0" height="0" style="position:absolute"><filter id="rough-${id}"><feTurbulence type="fractalNoise" baseFrequency="${(0.045 * 104 / word).toFixed(4)}" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="${rough}"/></filter></svg>
  <div class="logo ${stack ? 'stack' : ''}" data-fit="${fit}" style="--e:${emblem}px;--w:${word}px">
    ${emblem ? '<div class="emb"></div>' : ''}
    <div class="word" style="filter:url(#rough-${id}) drop-shadow(${word * 0.03}px ${word * 0.04}px 0 #1a0604) drop-shadow(0 0 ${word * 0.2}px rgba(255,90,30,.35))">BROODFALL</div>
  </div>`;
}

const BASE_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:var(--W);height:var(--H);overflow:hidden;background:transparent}
  .stage{position:relative;width:var(--W);height:var(--H);overflow:hidden;background:#050607}
  .bg{position:absolute;inset:0;background-repeat:no-repeat}
  .shade{position:absolute;inset:0;pointer-events:none}
  .abs{position:absolute}
  .logo{display:flex;align-items:center}
  .logo .emb{flex:0 0 auto;width:var(--e);height:var(--e);background:url(${EMBLEM}) center/contain no-repeat;filter:drop-shadow(0 6px 18px rgba(0,0,0,.65))}
  .logo .word{font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif;font-size:var(--w);line-height:.92;letter-spacing:.04em;white-space:nowrap;
    background:linear-gradient(180deg,#ffb347 0%,#ff6a2a 30%,#d22a18 62%,#8e1410 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
    transform:skewY(-4deg);padding:.06em .04em .1em}
  .logo .emb + .word{margin-left:calc(var(--e) * -0.24);margin-top:calc(var(--e) * 0.12)}
  .logo.stack{flex-direction:column}
  .logo.stack .emb + .word{margin-left:0;margin-top:calc(var(--e) * -0.22)}
  .tag{font-family:Oswald,"Arial Narrow",sans-serif;font-weight:700;letter-spacing:.08em;color:#f4e8c8;text-shadow:0 2px 0 #1a0604,0 0 14px rgba(0,0,0,.9)}
`;

function page(W, H, body, css = '') {
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>:root{--W:${W}px;--H:${H}px}${BASE_CSS}${css}</style></head><body>${body}</body></html>`;
}

// ---- the layouts ----
const cover = (bg, pos = 'center', extra = '') => `<div class="bg" style="background-image:url(${pic(bg)});background-size:cover;background-position:${pos}"></div>${extra}`;
const leftShade = (a = 0.7, to = 55) => `<div class="shade" style="background:linear-gradient(90deg,rgba(4,6,12,${a}) 0%,rgba(4,6,12,${a * 0.45}) ${to * 0.7}%,rgba(4,6,12,0) ${to}%)"></div>`;
const bottomShade = (a = 0.8, from = 60) => `<div class="shade" style="background:linear-gradient(0deg,rgba(4,4,8,${a}) 0%,rgba(4,4,8,0) ${100 - from}%)"></div>`;

export const JOBS = {
  // ---------- key art: the pictures alone, full size ----------
  'key-art/broodfall-keyart-meteor-2048x1152': { W: 2048, H: 1152, html: () => `<div class="stage">${cover('fall-wide')}</div>` },
  'key-art/broodfall-keyart-siege-2048x1152': { W: 2048, H: 1152, html: () => `<div class="stage">${cover('siege')}</div>` },
  'key-art/broodfall-keyart-orbit-yoke-2048x1152': { W: 2048, H: 1152, html: () => `<div class="stage">${cover('orbit')}</div>` },
  'key-art/broodfall-keyart-crater-2048x1152': { W: 2048, H: 1152, html: () => `<div class="stage">${cover('crater')}</div>` },
  'key-art/broodfall-keyart-panorama-3072x1024': { W: 3072, H: 1024, html: () => `<div class="stage">${cover('cover-hero')}</div>` },
  'key-art/broodfall-keyart-meteor-titled-1920x1080': {
    W: 1920, H: 1080, html: () => `<div class="stage">${cover('fall-wide', '70% center')}${leftShade(0.72, 60)}
      <div class="abs" style="left:90px;top:330px">${logo({ word: 180, emblem: 320, fit: 1150 })}
      <div class="tag" style="font-size:40px;margin:30px 0 0 40px">${TAGLINES.monster}</div></div></div>`,
  },

  // ---------- store covers ----------
  'covers/steam-header-capsule-920x430': {
    W: 920, H: 430, html: () => `<div class="stage">${cover('fall-wide', '80% 40%')}${leftShade(0.75, 62)}
      <div class="abs" style="left:22px;top:118px">${logo({ word: 96, emblem: 176, fit: 600 })}</div></div>`,
  },
  'covers/steam-small-capsule-462x174': {
    W: 462, H: 174, html: () => `<div class="stage">${cover('cover-hero', '92% 30%')}${leftShade(0.8, 75)}
      <div class="abs" style="left:6px;top:14px">${logo({ word: 76, emblem: 140, fit: 448 })}</div></div>`,
  },
  'covers/steam-main-capsule-1232x706': {
    W: 1232, H: 706, html: () => `<div class="stage">${cover('fall-wide', '75% center')}${leftShade(0.72, 60)}
      <div class="abs" style="left:40px;top:215px">${logo({ word: 124, emblem: 230, fit: 760 })}
      <div class="tag" style="font-size:30px;margin:26px 0 0 30px">${TAGLINES.store}</div></div></div>`,
  },
  'covers/steam-vertical-capsule-600x900': {
    W: 600, H: 900, html: () => `<div class="stage">${cover('cover-tall', 'center top')}
      <div class="shade" style="background:linear-gradient(180deg,rgba(4,6,12,0) 46%,rgba(4,6,12,.6) 54%,rgba(4,6,12,.75) 70%,rgba(4,6,12,0) 80%)"></div>
      <div class="abs" style="left:0;right:0;top:468px;display:flex;flex-direction:column;align-items:center">${logo({ word: 92, emblem: 150, fit: 560 })}
      <div class="tag" style="font-size:19px;margin-top:14px">${TAGLINES.monster}</div></div></div>`,
  },
  'covers/steam-library-hero-3840x1240': { W: 3840, H: 1240, html: () => `<div class="stage">${cover('cover-hero', 'center 40%')}</div>` },
  'covers/steam-library-logo-1280x720': {
    W: 1280, H: 720, png: true,
    html: () => `<div style="width:1280px;height:720px;display:flex;align-items:center;justify-content:center">${logo({ word: 200, emblem: 340, fit: 1220 })}</div>`,
  },
  'covers/itch-cover-630x500': {
    W: 630, H: 500, html: () => `<div class="stage">${cover('cover-square', 'center 30%')}${bottomShade(0.92, 55)}
      <div class="abs" style="left:0;right:0;bottom:14px;display:flex;flex-direction:column;align-items:center">${logo({ word: 84, emblem: 150, fit: 560 })}
      <div class="tag" style="font-size:19px;margin-top:6px">${TAGLINES.store}</div></div></div>`,
  },
  'covers/social-square-1080x1080': {
    W: 1080, H: 1080, html: () => `<div class="stage">${cover('cover-square')}${leftShade(0.55, 70)}${bottomShade(0.75, 75)}
      <div class="abs" style="left:24px;top:210px">${logo({ word: 140, emblem: 250, fit: 640 })}</div>
      <div class="abs tag" style="left:0;right:0;bottom:44px;text-align:center;font-size:40px">${TAGLINES.monster}</div>
      <div class="abs tag" style="left:0;right:0;bottom:10px;text-align:center;font-size:20px;font-weight:500;opacity:.8">A TOWER DEFENCE ROGUELITE WHERE THE TOWERS ARE YOUR LIMBS</div></div>`,
  },

  // ---------- posters ----------
  'posters/bmovie-poster-1200x1800': {
    W: 1200, H: 1800, html: () => `<div class="stage">${cover('bmovie')}
      <div class="abs" style="left:0;right:0;top:40px;display:flex;flex-direction:column;align-items:center">
        <div style="font-family:Oswald;font-weight:700;font-size:34px;letter-spacing:.3em;color:#f0dfb0;text-shadow:0 3px 0 #1a0604">THE EMPIRE PRESENTS</div>
        ${logo({ word: 250, emblem: 0, fit: 1120 })}
        <div style="font-family:Bungee,Impact;font-size:52px;color:#ffd24a;transform:rotate(-4deg);margin-top:4px;text-shadow:4px 4px 0 #1a0604,0 0 20px rgba(0,0,0,.7)">${TAGLINES.bmovie}</div>
      </div>
      <div class="abs" style="left:60px;right:60px;bottom:26px;text-align:center;font-family:Oswald;color:#e9dcc0;text-shadow:0 2px 0 #000">
        <div style="font-weight:700;font-size:34px;letter-spacing:.06em;color:#ffd24a">SEE A WHOLE TOWN SWALLOWED! &nbsp;SEE GUNS GROW FROM ROOFTOPS!</div>
        <div style="font-weight:700;font-size:30px;letter-spacing:.06em;margin-top:4px">SEE THE EMPIRE FILE THE PAPERWORK!</div>
        <div style="font-weight:500;font-size:19px;letter-spacing:.14em;margin-top:12px;opacity:.85">IN SPORE-O-VISION &nbsp;&middot;&nbsp; A XENOFAUNA CLEARANCE PICTURE &nbsp;&middot;&nbsp; NOT SUITABLE FOR INSECTS</div>
      </div></div>`,
  },
  'posters/procurement-notice-1200x1800': {
    // The picture's own cream top and black foot hold the type; nothing is laid over the drawing.
    W: 1200, H: 1800, html: () => `<div class="stage">${cover('procurement')}
      <div class="abs" style="left:70px;right:70px;top:52px;color:#111">
        <div style="font-family:'Special Elite',monospace;font-size:24px;letter-spacing:.12em;display:flex;justify-content:space-between;border-bottom:4px solid #111;padding-bottom:8px">
          <span>IMPERIAL PROCUREMENT OFFICE</span><span>FORM XC-7 &middot; PUBLIC NOTICE</span></div>
        <div style="font-family:Anton,Impact;font-size:104px;line-height:1;margin-top:14px;white-space:nowrap">NOTICE OF PROCUREMENT</div>
        <div style="font-family:Anton,Impact;font-size:50px;color:#b3140f;margin-top:8px;line-height:1.05">${TAGLINES.asset}</div>
      </div>
      <div class="abs" style="left:0;right:0;bottom:0;height:282px;background:#0b0f12;padding:30px 70px 0;color:#f1e7ce">
        <div style="font-family:'Special Elite',monospace;font-size:23px;line-height:1.45;opacity:.92">Grows its own weapons. Requires no wages, no rest and no luxury. Deploys by falling. Feeds on the problem it was sent to solve. Reports to your console between waves.</div>
        <div style="display:flex;align-items:center;gap:26px;margin-top:22px">
          <svg width="112" height="112" viewBox="-60 -60 120 120"><g fill="#f1e7ce">${gear()}</g><circle r="17" fill="#0b0f12"/></svg>
          <div><div style="font-family:Anton,Impact;font-size:52px;line-height:1">${TAGLINES.waste}</div>
          <div style="font-family:'Special Elite',monospace;font-size:20px;letter-spacing:.1em;margin-top:10px;opacity:.85">ASSET CLASS: XENOFAUNA CLEARANCE &middot; DESIGNATION: BROODFALL</div></div>
        </div>
      </div></div>`,
  },
  'posters/yoke-character-1200x1800': {
    W: 1200, H: 1800, html: () => `<div class="stage">${cover('yoke-v2')}
      <div class="shade" style="background:linear-gradient(180deg,rgba(0,0,0,.75) 0%,rgba(0,0,0,0) 16%,rgba(0,0,0,0) 76%,rgba(0,0,0,.9) 92%)"></div>
      <div class="abs" style="left:0;right:0;top:50px;text-align:center">
        <div style="font-family:Oswald;font-weight:700;font-size:150px;letter-spacing:.3em;line-height:1;color:#cfe3ff;text-shadow:0 0 30px rgba(90,160,255,.8),0 0 4px #9cc4ff;padding-left:.3em">YOKE</div>
        <div style="font-family:Oswald;font-weight:500;font-size:28px;letter-spacing:.3em;color:#9fbde6;margin-top:6px">THE SHIP'S INTELLIGENCE</div>
      </div>
      <div class="abs" style="left:0;right:0;bottom:44px;display:flex;flex-direction:column;align-items:center">
        <div style="font-family:Anton,Impact;font-size:74px;color:#eef4ff;letter-spacing:.02em;text-shadow:0 0 22px rgba(90,160,255,.6)">${TAGLINES.yoke}</div>
        <div style="font-family:Oswald;font-weight:500;font-size:25px;letter-spacing:.08em;color:#b8cbe6;margin:6px 0 20px">She runs the ship. She reads your reports. She is not impressed.</div>
        ${logo({ word: 80, emblem: 130, id: 'y' })}
      </div></div>`,
  },
  'posters/social-banner-1500x500': {
    W: 1500, H: 500, html: () => `<div class="stage">${cover('cover-hero', '85% 38%')}${leftShade(0.78, 62)}
      <div class="abs" style="left:40px;top:92px">${logo({ word: 120, emblem: 220, fit: 760 })}
      <div class="tag" style="font-size:28px;margin:18px 0 0 36px">${TAGLINES.store}</div></div></div>`,
  },
};

/** The Technopuritan emblem: a plain black gear (style bible rule 6), drawn, not generated. */
function gear() {
  const teeth = 10, r1 = 44, r2 = 58, parts = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, w = Math.PI / teeth * 0.9;
    const p = (r, t) => `${(Math.cos(t) * r).toFixed(1)},${(Math.sin(t) * r).toFixed(1)}`;
    parts.push(`<polygon points="${p(r1, a - w)} ${p(r2, a - w * 0.7)} ${p(r2, a + w * 0.7)} ${p(r1, a + w)}"/>`);
  }
  return `<circle r="${r1 + 1}"/>${parts.join('')}`;
}

const want = process.argv.slice(2);
const ids = Object.keys(JOBS).filter((id) => !want.length || want.some((w) => id.startsWith(w) || id.includes(w)));
fs.mkdirSync(BUILD, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
for (const id of ids) {
  const j = JOBS[id];
  const html = path.join(BUILD, `${id.replace(/\//g, '__')}.html`);
  fs.writeFileSync(html, page(j.W, j.H, j.html(), j.png ? 'html,body{background:transparent}' : ''));
  const p = await browser.newPage({ viewport: { width: j.W, height: j.H } });
  await p.goto(url(html), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  // A logo wider than the room it has is scaled down whole (the small capsule must never cut the word).
  await p.evaluate(() => document.querySelectorAll('[data-fit]').forEach((el) => {
    const max = Number(el.dataset.fit); if (!max) return;
    const w = el.scrollWidth; if (w > max) { el.style.zoom = String(max / w); }
  }));
  await p.waitForTimeout(300);
  const out = path.join(OUT, `${id}.${j.png ? 'png' : 'jpg'}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await p.screenshot({ path: out, ...(j.png ? { type: 'png', omitBackground: true } : { type: 'jpeg', quality: 90 }) });
  await p.close();
  console.log(`[compose] ${path.relative(ROOT, out)}`);
}
await browser.close();
