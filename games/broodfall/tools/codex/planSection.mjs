/**
 * The footprint plan on the limb decision sheet (tools/codex/sheet.mjs) and in notes/FOOTPRINT-PLAN.md: the
 * Footprint column (now → proposed, as small cell diagrams), "Resolved by" under every old flag, and the plan
 * section at the top (distribution, how each shape fits the city, the variant art, the cost, the measured
 * balance, flags → fixes). Data: tools/codex/plan.mjs; counts: tools/codex/planDump.ts,
 * notes/limb-codex/shapefit.json (tools/measure/shapefit.measure.ts), notes/limb-codex/footprint-measure.txt
 * (tools/measure/footprints.measure.ts candidates plan*).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXES, PLAN, PRICE } from './plan.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KIND = { '1x1': 'one', '1x2': 'line', line3: 'line', '2x2': 'square', T: 'T', L3: 'L', L4: 'L', S4: 'zigzag' };
const KIND_NAME = { one: 'One cell', line: 'Line', square: 'Square', T: 'T', L: 'L (elbow)' };
const KIND_ORDER = ['one', 'line', 'square', 'T', 'L'];
const SHAPE_NAME = { '1x1': '1 cell', '1x2': 'line of 2', line3: 'line of 3', '2x2': '2x2 square', T: 'T of 4', L3: 'elbow of 3', L4: 'L of 4', S4: 'zigzag of 4' };

export function loadPlan(root, entries, manifest) {
  const dump = JSON.parse(execFileSync(process.execPath, [join(root, 'node_modules', 'vite-node', 'vite-node.mjs'), 'tools/codex/planDump.ts'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 24 }));
  const fitFile = join(root, 'notes', 'limb-codex', 'shapefit.json');
  const fit = existsSync(fitFile) ? JSON.parse(readFileSync(fitFile, 'utf8')) : null;
  const mFile = join(root, 'notes', 'limb-codex', 'footprint-measure.txt');
  const measured = existsSync(mFile) ? readFileSync(mFile, 'utf8').split(/\r?\n/).filter(Boolean) : [];
  const byFam = Object.fromEntries(entries.map((e) => [e.family, e]));
  /** The current footprint id of a limb. */
  const nowId = (f) => {
    const c = dump[f].now;
    if (c.length === 1) return '1x1';
    if (c.length === 4) return '2x2';
    return '1x2';
  };
  // What each limb costs to draw in the plan's one pass: its base (when redrawn), then its reachable looks with
  // their spatial variants (a look always reached WITH its variant is drawn as that variant: no extra drawing).
  const art = {};
  for (const e of entries) {
    const f = e.family;
    const p = PLAN[f];
    if (!p) continue;
    const d = dump[f];
    const turns = !['1x1', '2x2'].includes(p.to) || e.directional || p.redraw || p.back;
    const unit = turns ? PRICE.both : PRICE.side;
    const base = p.redraw ? PRICE.both : p.back ? PRICE.side : 0;
    const plain = new Set(d.combos.filter((c) => !c.includes('~')));
    const keys = new Set(d.combos.map((c) => c.split('~')[0]).filter((k) => k !== 'own'));
    const extra = d.combos.filter((c) => c.includes('~') && plain.has(c.split('~')[0])).length + d.variantBases.length;
    const drawn = Object.keys(manifest.limbs[f]?.variants ?? {});
    // A prototype that is not redrawn keeps its drawn looks; only what it lacks is new.
    const needKeys = p.redraw ? [...keys] : [...keys].filter((k) => !drawn.includes(k));
    const drawings = needKeys.length + extra;
    const shared = d.combos.filter((c) => c.includes('~') && !plain.has(c.split('~')[0]));
    art[f] = { unit, base, drawings, looksCost: drawings * unit, extra, shared, needKeys, turns };
  }
  return { dump, fit, measured, byFam, nowId, art };
}

/** A footprint as a little grid of cells. */
export function cellsSvg(cells, cls = '') {
  const w = Math.max(...cells.map((c) => c[0])) + 1;
  const h = Math.max(...cells.map((c) => c[1])) + 1;
  const s = 9;
  return `<svg class="fp ${cls}" viewBox="0 0 ${w * s + 1} ${h * s + 1}" width="${w * s + 1}" height="${h * s + 1}" aria-hidden="true">${cells.map(([x, y]) => `<rect x="${x * s + 0.5}" y="${y * s + 0.5}" width="${s - 1}" height="${s - 1}"/>`).join('')}</svg>`;
}

export function footprintCell(f, P) {
  const p = PLAN[f];
  if (!p) return '<td class="fpc"></td>';
  const now = P.nowId(f);
  const changed = now !== p.to;
  return `<td class="fpc ${changed ? 'chg' : ''}"><div class="fprow">${cellsSvg(P.dump[f].now, 'now')}${changed ? `<span class="arr">→</span>${cellsSvg(P.dump[f].next, 'next')}` : ''}</div><div class="fpn">${changed ? `${esc(SHAPE_NAME[now])} → <b>${esc(SHAPE_NAME[p.to])}</b>` : `${esc(SHAPE_NAME[now])} · kept`}</div>${p.why ? `<div class="fpw">${esc(p.why)}</div>` : ''}${p.silhouette ? `<div class="fps"><em>Look</em> ${esc(p.silhouette)}</div>` : ''}${(p.variants ?? []).length ? `<div class="fps"><em>Variant art</em> ${p.variants.map((v) => `${esc(v[2])} (stage ${v[0]}${v[1]}): ${esc(v[3])}`).join('; ')}</div>` : ''}${p.risk ? `<div class="fps risk"><em>Risk</em> ${esc(p.risk)}</div>` : ''}</td>`;
}

/** How the plan answers one old flag: its own line, or the general rule for that kind of flag, or null. */
export function resolvedBy(f, text) {
  const p = PLAN[f];
  if (!p) return null;
  for (const [k, v] of Object.entries(p.resolves ?? {})) if (text.includes(k)) return v;
  if (/No view from behind/.test(text)) {
    if (p.redraw) return 'Drawn with a view from behind in the redraw.';
    if (p.back) return 'A view from behind is drawn in the same pass (it points at a target).';
    if (/FACES one way/.test(text)) return 'A view from behind is drawn in the same pass.';
    return 'Left: it does not face a way. Optional ($1.45).';
  }
  if (/one look only/.test(text)) return 'One drawing covers it: the cheapest limb in the looks pass.';
  if (/No superstructure is reachable/.test(text)) return 'Only reachable looks are drawn; nothing to add.';
  if (/Drawn looks no evolution path reaches/.test(text)) return 'Only reachable looks are drawn from now on; these stay for eaten bonuses.';
  if (/Short idle|idle barely moves|No firing or acting clip/.test(text)) return p.redraw ? 'Made again in the redraw.' : 'Open: not part of this plan.';
  if (/^High: /.test(text) || /Most damage per meat/.test(text)) return p.to !== '1x1' && PLAN[f].to !== undefined ? `It now takes ${SHAPE_NAME[p.to]}: the plan measure decides whether it is paid right.` : 'Open: the plan does not change it; watch it in the plan measure.';
  if (/Least damage per meat|^Low: /.test(text)) return 'Open: a number to tune after the footprints are decided.';
  if (/Never built by the scripted player/.test(text)) return 'Open: the scripted player does not use engines much.';
  return null;
}

function distribution(entries, P) {
  const now = Object.fromEntries(KIND_ORDER.map((k) => [k, 0]));
  const next = Object.fromEntries(KIND_ORDER.map((k) => [k, 0]));
  for (const e of entries) {
    if (!PLAN[e.family]) continue;
    now[KIND[P.nowId(e.family)]]++;
    next[KIND[PLAN[e.family].to]]++;
  }
  return { now, next };
}

export function planSectionHtml(entries, P, names) {
  const { now, next } = distribution(entries, P);
  const total = entries.length;
  const max = Math.max(...Object.values(now), ...Object.values(next));
  const bars = KIND_ORDER.map((k) => `<div class="dk"><span class="dn">${esc(KIND_NAME[k])}</span><div class="db"><i class="bnow" style="width:${(now[k] / max) * 100}%"></i><b>${now[k]}</b></div><div class="db"><i class="bnext" style="width:${(next[k] / max) * 100}%"></i><b>${next[k]}</b></div></div>`).join('');
  const changes = entries.filter((e) => PLAN[e.family] && P.nowId(e.family) !== PLAN[e.family].to);
  const fitRows = P.fit ? Object.entries(P.fit.crashSites.shapes).map(([k, v]) => {
    const m = P.fit.midRun.shapes[k];
    return `<tr><td>${cellsSvg(fpCells(k))}</td><td>${esc(SHAPE_NAME[k])}</td><td class="n">${Math.round(v.cover * 100)}%</td><td class="n">${Math.round(m.cover * 100)}%</td><td class="n">${v.placements}</td><td class="n">${m.placements}</td></tr>`;
  }).join('') : '';
  const variantRows = entries.filter((e) => (PLAN[e.family]?.variants ?? []).length).map((e) => {
    const a = P.art[e.family];
    const v = PLAN[e.family].variants;
    const how = a.extra ? `own drawings: +${a.extra} (the look is also reached without it)` : `shares its look: ${a.shared.map((s) => s.split('~')[0].toUpperCase()).join(', ')} is always the ${v.map((x) => x[2]).join('/')} variant, drawn once`;
    return `<tr><td><a href="#${e.family}">${esc(names[e.family])}</a></td><td>${v.map((x) => `${esc(x[2])} <small>(${x[0]}${x[1]})</small>`).join(', ')}</td><td>${esc(v.map((x) => x[3]).join('; '))}</td><td>${esc(how)}</td><td class="n">${a.extra ? `$${(a.extra * a.unit).toFixed(2)}` : '$0'}</td></tr>`;
  }).join('');
  const overlayList = entries.filter((e) => (PLAN[e.family]?.overlays ?? []).length).map((e) => `<li><a href="#${e.family}">${esc(names[e.family])}</a>: ${esc(PLAN[e.family].overlays.join('; '))}</li>`).join('');
  const sums = sumCost(entries, P);
  const measuredHtml = P.measured.length ? `<ul class="meas">${P.measured.map((l) => `<li class="${/^HOLDS/.test(l) ? 'ok' : 'bad'}">${esc(l)}</li>`).join('')}</ul>` : '<p class="mute">Not measured yet.</p>';
  return `
<section class="plan" id="footprint-plan">
<h2>Footprint plan (proposed, not applied)</h2>
<p class="lede2">Collins: "the total lack of diversity in footprint ... is kind of a KEY part of tower defence strategy ... one square (hugely over-represented), two squares (line), four squares (large square, usually for very powerful towers), T-shaped (usually for very powerful area-effect things), L-shaped (like an elbow shape)." The engine for every shape is BUILT and on main (any shape, four turns, R / right-click / Shift + wheel / the TURN button while placing; its ground outlined on the board). This plan says which limb takes which shape. Nothing below is applied; any of it can be tried in game first: <code>?tryShape=lasher:L3,quill:L3</code>.</p>
<div class="pgrid">
  <article><h3>Distribution</h3><div class="dist"><div class="dk hd"><span></span><span>now</span><span>proposed</span></div>${bars}</div><p class="note">${total} limbs. One cell: ${now.one} → ${next.one} (${Math.round((next.one / total) * 100)}%, under half). ${changes.length} limbs change footprint.</p></article>
  <article><h3>How each shape fits the city</h3><p class="note">Share of roof cells where pointing can build it (any of four turns; one block, one height), on the four crash sites and on ten mid-run boards. A shape that rarely fits is a bad shape: the 2x2 is the hardest to fit (it is kept for the strongest limbs); the zigzag fits badly and is not used.</p>${fitRows ? `<table class="fit"><thead><tr><th></th><th>Shape</th><th>Crash site</th><th>Mid-run</th><th>Placements, crash</th><th>Mid-run</th></tr></thead><tbody>${fitRows}</tbody></table>` : '<p class="mute">Not measured.</p>'}</article>
  <article><h3>Measured (scripted player, ten seeds; guardrail eight)</h3><p class="note">Each candidate pays a reshaped limb for its ground as the BIG limbs were (hp ×1.6 / ×2.0 / ×2.4 on 2 / 3 / 4 cells, hits ×1.25 / ×1.38 / ×1.5, reach ×1.1 / ×1.12 / ×1.15), same price. It must win at least 3 of 10 and keep placing well ahead of placing blind. Nothing is changed in the game; the candidate is put back after it is measured.</p>${measuredHtml}</article>
  <article><h3>What the art costs (one pass with the upgrade looks)</h3><p class="note">Footprint, new silhouettes, views from behind, the reachable looks and the spatial variants, drawn together so nothing is drawn twice. One side $1.45 (a picture and two clips), with a view from behind $2.90 (a limb on a turned footprint, or one that faces a way, needs both).</p><table class="cost"><tbody>
    <tr><td>Bases redrawn (new footprint or silhouette) with a view from behind</td><td class="n">${sums.redraws}</td><td class="n">$${sums.baseRedraw.toFixed(0)}</td></tr>
    <tr><td>Views from behind added to engines that point</td><td class="n">${sums.backs}</td><td class="n">$${sums.baseBack.toFixed(0)}</td></tr>
    <tr><td>Upgrade looks: only the looks evolution paths reach, at the new footprint</td><td class="n">${sums.looks}</td><td class="n">$${sums.looksCost.toFixed(0)}</td></tr>
    <tr><td>of which: spatial variants needing their own drawing</td><td class="n">${sums.extra}</td><td class="n">$${sums.extraCost.toFixed(0)}</td></tr>
    <tr class="tot"><td>Total, before re-rolls</td><td></td><td class="n">$${sums.total.toFixed(0)}</td></tr>
    <tr><td>With re-rolls (about a fifth)</td><td></td><td class="n">~$${Math.round((sums.total * 1.2) / 10) * 10}</td></tr>
  </tbody></table><p class="note">Compare: notes/UPGRADE-LOOKS.md's rollout A was ~$350-400 for 5 looks a limb on the old footprints, rollout B ~$800.</p></article>
</div>
<h3 class="sub3">Visual variants: evolutions that change what a limb does in space</h3>
<p class="note">Collins: "a reach lasher will likely need sub-variants because it needs that reach to work." A variant needs its own drawing when the reach or shape is in the BODY (whips, a neck, a nozzle, a rail, an arm, tendrils standing up for the air). Where the game can draw the reach itself (a ring, a lane, a strip, a blast) an overlay is enough.</p>
<table class="vtab"><thead><tr><th>Limb</th><th>Evolution</th><th>What changes</th><th>Drawing</th><th>Extra</th></tr></thead><tbody>${variantRows}</tbody></table>
<details class="ovl"><summary>Spatial evolutions shown by an overlay (no drawing): ${entries.filter((e) => (PLAN[e.family]?.overlays ?? []).length).length} limbs</summary><ul>${overlayList}</ul></details>
<h3 class="sub3">Flags → fixes</h3>
<table class="fixes"><tbody>${FIXES.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</tbody></table>
<p class="note">Every flag in the ledger below also says how the plan answers it ("Resolved by").</p>
<h3 class="sub3">For Collins to decide</h3>
<ol class="qs">
<li>The footprints themselves: the 14 changes in the Footprint column (try them in game with <code>?tryShape=</code>).</li>
<li>The Lobber/Bombard split: Lobber a cheap glob that leaves an acid puddle; Bombard the one 2x2 siege gun. (A big Bombard cost a win in ten on Sep 29.)</li>
<li>The Ember Sac on two cells fires its cone the way it lies (like the Mortar): a mechanic change.</li>
<li>The bonus classes: Choir → SWARM (and its donor bonus +8% fire rate), Press → VENOM, Tap → SWARM, Reliquary stays BONE.</li>
<li>Whether to retire the Lasher's one-cell prototypes and the unreachable prototype looks, or keep them for eaten bonuses.</li>
</ol>
</section>`;
}

function fpCells(k) {
  const m = { '1x1': [[0, 0]], '1x2': [[0, 0], [0, 1]], line3: [[0, 0], [0, 1], [0, 2]], '2x2': [[0, 0], [1, 0], [0, 1], [1, 1]], T: [[0, 0], [1, 0], [2, 0], [1, 1]], L3: [[0, 0], [0, 1], [1, 1]], L4: [[0, 0], [0, 1], [0, 2], [1, 2]], S4: [[0, 0], [0, 1], [1, 1], [1, 2]] };
  return m[k];
}

export function sumCost(entries, P) {
  let redraws = 0, backs = 0, baseRedraw = 0, baseBack = 0, looks = 0, looksCost = 0, extra = 0, extraCost = 0;
  for (const e of entries) {
    const a = P.art[e.family];
    const p = PLAN[e.family];
    if (!a || !p) continue;
    if (p.redraw) { redraws++; baseRedraw += a.base; } else if (p.back) { backs++; baseBack += a.base; }
    looks += a.drawings; looksCost += a.looksCost;
    extra += a.extra; extraCost += a.extra * a.unit;
  }
  return { redraws, backs, baseRedraw, baseBack, looks, looksCost, extra, extraCost, total: baseRedraw + baseBack + looksCost };
}

/** The same plan as markdown: notes/FOOTPRINT-PLAN.md. */
export function planMarkdown(entries, P, names) {
  const { now, next } = distribution(entries, P);
  const sums = sumCost(entries, P);
  const L = [];
  L.push('# Broodfall footprint plan (Oct 1 2026): proposed, not applied');
  L.push('');
  L.push('Collins (Oct 1 2026): "the total lack of diversity in footprint ... is kind of a KEY part of tower defence strategy. In tower defence the tower categories are one square (hugely over-represented), two squares (line), four squares (large square, usually for very powerful towers), T-shaped (usually for very powerful area-effect things), L-shaped (like an elbow shape) ... we may need more visuals for towers that, to work, need to look different ... so a reach lasher will likely need sub-variants because it needs that reach to work." And: "look at the problems you identified in the doc for the existing ones and make sure you pre-address this in the redesign."');
  L.push('');
  L.push('The engine for every shape is built and on main (`src/sim/footprint.ts`; HANDOFF.md "Footprints"). This file says which limb takes which shape; nothing in it is applied. Try any of it in game first: `?tryShape=lasher:L3,quill:L3` (any limb, any of `1x1 1x2 2x2 line3 T L3 L4 S4`). The same plan is on the limb decision sheet (https://claude.ai/artifact/G1XVCeZcLdEPx1QfQ2ny7g), section "Footprint plan", with a Footprint column. Made by `node tools/codex/sheet.mjs` from `tools/codex/plan.mjs`.');
  L.push('');
  L.push('## Distribution');
  L.push('');
  L.push('| Footprint | Now | Proposed |');
  L.push('|---|---|---|');
  for (const k of KIND_ORDER) L.push(`| ${KIND_NAME[k]} | ${now[k]} | ${next[k]} |`);
  L.push('');
  L.push(`One cell goes from ${now.one} of ${entries.length} to ${next.one} (under half).`);
  L.push('');
  L.push('## Every limb');
  L.push('');
  L.push('| Limb | Now | Proposed | Why | New look |');
  L.push('|---|---|---|---|---|');
  for (const e of entries) {
    const p = PLAN[e.family];
    if (!p) continue;
    const n = P.nowId(e.family);
    L.push(`| ${names[e.family]} | ${SHAPE_NAME[n]} | ${n === p.to ? 'kept' : `**${SHAPE_NAME[p.to]}**`} | ${p.why ?? ''}${p.risk ? ` RISK: ${p.risk}` : ''} | ${p.silhouette ?? ''} |`);
  }
  L.push('');
  L.push('A reshaped limb is paid for its ground the way the BIG limbs were on Sep 29 (same price; hp x1.6 / x2.0 / x2.4 on 2 / 3 / 4 cells, hits x1.25 / x1.38 / x1.5, reach x1.1 / x1.12 / x1.15, blast x1.1 / x1.18 / x1.25; a limb already big is paid the difference).');
  L.push('');
  L.push('## How each shape fits the city');
  L.push('');
  if (P.fit) {
    L.push('Share of roof cells where pointing can build the shape (`tools/measure/shapefit.measure.ts`, `notes/limb-codex/shapefit.json`):');
    L.push('');
    L.push('| Shape | Crash sites (4) | Mid-run boards (10) |');
    L.push('|---|---|---|');
    for (const [k, v] of Object.entries(P.fit.crashSites.shapes)) L.push(`| ${SHAPE_NAME[k]} | ${Math.round(v.cover * 100)}% | ${Math.round(P.fit.midRun.shapes[k].cover * 100)}% |`);
    L.push('');
    L.push('The 2x2 is the hardest to fit (kept for the strongest limbs); T and L fit about as well as a line of three; the zigzag fits badly and is not used.');
  }
  L.push('');
  L.push('## Measured balance');
  L.push('');
  L.push('`MEASURE=plan npx vitest run --config tools/measure/vitest.config.ts tools/measure/footprints.measure.ts` (and planLines, planT, planL, planSquare): the scripted player over ten seeds (at least 3 must be won) and the placement guardrail over eight.');
  L.push('');
  for (const l of P.measured) L.push(`- ${l}`);
  if (!P.measured.length) L.push('- not measured yet');
  L.push('');
  L.push('## Visual variants (Collins: "a reach lasher will likely need sub-variants")');
  L.push('');
  L.push('A variant needs its own drawing when the reach or shape is in the BODY. Where a look is always reached WITH the variant, that look is simply drawn as the variant (no extra drawing).');
  L.push('');
  L.push('| Limb | Evolution | What changes | Drawing | Extra |');
  L.push('|---|---|---|---|---|');
  for (const e of entries) {
    const v = PLAN[e.family]?.variants ?? [];
    if (!v.length) continue;
    const a = P.art[e.family];
    L.push(`| ${names[e.family]} | ${v.map((x) => `${x[2]} (${x[0]}${x[1]})`).join(', ')} | ${v.map((x) => x[3]).join('; ')} | ${a.extra ? `+${a.extra} own drawings` : `shared: ${a.shared.map((s) => s.split('~')[0].toUpperCase()).join(', ')} drawn as the variant`} | ${a.extra ? `$${(a.extra * a.unit).toFixed(2)}` : '$0'} |`);
  }
  L.push('');
  L.push('Shown by an overlay instead (the game draws the ring, lane, strip or blast): ' + entries.filter((e) => (PLAN[e.family]?.overlays ?? []).length).map((e) => `${names[e.family]} (${PLAN[e.family].overlays.join('; ')})`).join('; ') + '.');
  L.push('');
  L.push('## What the art costs (one pass, with the upgrade looks)');
  L.push('');
  L.push(`- Bases redrawn with a view from behind: ${sums.redraws}, $${sums.baseRedraw.toFixed(0)}`);
  L.push(`- Views from behind for engines that point: ${sums.backs}, $${sums.baseBack.toFixed(0)}`);
  L.push(`- Upgrade looks, only the reachable ones, at the new footprints: ${sums.looks} drawings, $${sums.looksCost.toFixed(0)} (of which spatial variants needing their own drawing: ${sums.extra}, $${sums.extraCost.toFixed(0)})`);
  L.push(`- **Total ~$${sums.total.toFixed(0)}, ~$${Math.round((sums.total * 1.2) / 10) * 10} with re-rolls** (UPGRADE-LOOKS.md rollout A was ~$350-400 on the old footprints).`);
  L.push('');
  L.push('## Flags → fixes (the old sheet\'s problems, pre-addressed)');
  L.push('');
  for (const [a, b] of FIXES) L.push(`- **${a}**: ${b}`);
  L.push('');
  L.push('## For Collins to decide');
  L.push('');
  L.push('1. The 14 footprint changes (try them with `?tryShape=`).');
  L.push('2. The Lobber/Bombard split (Lobber a cheap glob that leaves an acid puddle; Bombard the one 2x2 siege gun).');
  L.push('3. The Ember Sac on two cells fires its cone the way it lies (a mechanic change).');
  L.push('4. The bonus classes: Choir → SWARM (+8% fire rate as its donor bonus), Press → VENOM, Tap → SWARM, Reliquary stays BONE.');
  L.push('5. Retire the Lasher\'s one-cell prototypes and the unreachable prototype looks, or keep them for eaten bonuses.');
  L.push('');
  return L.join('\n');
}
