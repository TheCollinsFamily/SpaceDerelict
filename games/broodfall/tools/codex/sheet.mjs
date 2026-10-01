/**
 * THE LIMB DECISION SHEET (Oct 1 2026): one self-contained page, every limb family with its pictures and
 * flags, made for Collins to decide what changes before the upgrade looks are drawn.
 *   node tools/codex/sheet.mjs            -> notes/limb-codex/limb-codex-sheet.html
 * Its numbers come from the same place the in-game Limb Codex reads (src/ui/codexData.ts, via
 * tools/codex/dump.ts), the scripted runs from notes/limb-codex/balance.json (tools/measure/limbs.measure.ts),
 * the pictures from public/art/ (tools/codex/thumbs.mjs), Claude's read of each limb from tools/codex/audit.mjs.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cutThumbs } from './thumbs.mjs';
import { AUDIT, DECISIONS } from './audit.mjs';
import { footprintCell, loadPlan, planMarkdown, planSectionHtml, resolvedBy } from './planSection.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const entries = JSON.parse(execFileSync(process.execPath, [join(root, 'node_modules', 'vite-node', 'vite-node.mjs'), 'tools/codex/dump.ts'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 }));
const manifest = JSON.parse(readFileSync(join(root, 'public', 'art', 'manifest.json'), 'utf8'));
const bal = JSON.parse(readFileSync(join(root, 'notes', 'limb-codex', 'balance.json'), 'utf8'));
const thumbs = await cutThumbs(manifest.limbs);
// The footprint plan (Oct 1 2026; tools/codex/plan.mjs): proposed, not applied.
const PLANNED = loadPlan(root, entries, manifest);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CLASS = { bone: 'Bone', swarm: 'Swarm', venom: 'Venom', reach: 'Reach' };
const SUPER = { 'bone+swarm': 'Bone Hydra', 'bone+venom': 'Plague Bastion', 'bone+reach': 'Siege Spire', 'swarm+venom': 'Spore Hive', 'swarm+reach': 'Storm Crown', 'venom+reach': 'Weeping Snare' };
const ROLE = { damage: 'Damage', artillery: 'Artillery', control: 'Control', support: 'Support', ground: 'Ground', engine: 'Engine' };
const lookName = (k) => SUPER[k] ?? CLASS[k] ?? k;
const lookChip = (k, extra = '') => k.includes('+')
  ? `<span class="lk sup ${extra}" title="${esc(k)}"><i class="${k.split('+')[0]}"></i><i class="${k.split('+')[1]}"></i>${esc(lookName(k))}</span>`
  : `<span class="lk ${k} ${extra}">${esc(lookName(k))}</span>`;

// Damage per meat, among the limbs that hit something on their own: the high and low tails are flagged.
const hitters = entries.filter((e) => e.dps > 0 && e.price > 0 && e.drawn);
const perMeat = (e) => e.dps / e.price;
const sorted = [...hitters].sort((a, b) => perMeat(b) - perMeat(a));
const topDpm = new Set(sorted.slice(0, 2).map((e) => e.family));
const lowDpm = new Set(sorted.slice(-2).map((e) => e.family));
const UNCREDITED = { blighter: 'poison', ember: 'burn', lure: 'cloud', swamp: 'its own digestion is credited, its burn is not', maw: 'eaten whole' };

function flagsOf(e) {
  const a = manifest.limbs[e.family];
  const f = [];
  const facing = a?.facing || e.directional;
  if (!a?.back) f.push(['art', facing ? 'No view from behind, and it FACES one way: after a camera turn its direction cannot be read.' : 'No view from behind (the same picture from every side).', facing ? 'hi' : 'lo']);
  if (a?.anims.idle.breathe) f.push(['art', 'Its idle barely moves (baked as a breathing loop).', 'lo']);
  if (a && !a.anims.fire) f.push(['art', 'No firing or acting clip.', 'lo']);
  if (a && a.anims.idle.count < 40) f.push(['art', `Short idle: ${a.anims.idle.count} frames where most have 46.`, 'lo']);
  // The looks.
  const drawn = Object.keys(a?.variants ?? {});
  const unreached = drawn.filter((k) => !e.evoLooks.includes(k));
  if (drawn.length && unreached.length) f.push(['looks', `Drawn looks no evolution path reaches without eaten bonuses: ${unreached.map(lookName).join(', ')}.`, 'hi']);
  if (e.evoLooks.length <= 1) f.push(['looks', `Its eight evolution paths reach ${e.evoLooks.length ? `one look only (${lookName(e.evoLooks[0])})` : 'no look'}: one drawing covers what most players will see.`, 'lo']);
  if (!e.evoLooks.some((k) => k.includes('+'))) f.push(['looks', 'No superstructure is reachable by evolutions alone.', 'lo']);
  // The scripted runs.
  const built = bal.built[e.family] ?? 0;
  const kills = bal.kills[e.family] ?? 0;
  const kpb = built ? kills / built : 0;
  if (e.role === 'engine' || !e.drawn) {
    if (!built) f.push(['balance', 'Never built by the scripted player: unmeasured.', 'lo']);
  } else if (built >= 8 && kpb >= 11) f.push(['balance', `High: ${kpb.toFixed(1)} kills per limb built in the scripted runs (the median is about 3).`, 'hi']);
  else if (built >= 10 && kpb < 1 && e.dps > 0 && !UNCREDITED[e.family]) f.push(['balance', `Low: ${kpb.toFixed(1)} kills per limb built over ${built} built.`, 'hi']);
  if (UNCREDITED[e.family] && e.role !== 'engine') f.push(['balance', `Its ${UNCREDITED[e.family]} kills were not credited to it in the run stats before Oct 1, so its kill count read low.`, 'lo']);
  if (topDpm.has(e.family)) f.push(['balance', `Most damage per meat of any shooter: ${perMeat(e).toFixed(2)} a second per meat.`, 'hi']);
  if (lowDpm.has(e.family)) f.push(['balance', `Least damage per meat of any shooter: ${perMeat(e).toFixed(2)} a second per meat${e.dot ? ' (before its damage over time)' : ''}.`, 'lo']);
  for (const [kind, text] of AUDIT[e.family] ?? []) f.push([kind, text, 'hi', true]);
  return f;
}

const KINDS = { art: 'Art', looks: 'Looks', role: 'Role', balance: 'Balance', words: 'Words', design: 'Design' };
const rows = entries.map((e) => ({ e, flags: flagsOf(e), t: thumbs[e.family] ?? { looks: {} } }));
const flagCount = Object.fromEntries(Object.keys(KINDS).map((k) => [k, rows.filter((r) => r.flags.some((f) => f[0] === k)).length]));
const prototyped = rows.filter((r) => Object.keys(r.t.looks).length).map((r) => r.e.name);
const singleLook = rows.filter((r) => r.e.evoLooks.length === 1).length;
const evoTotal = rows.filter((r) => !Object.keys(r.t.looks).length).reduce((n, r) => n + r.e.evoLooks.length, 0);
const names = Object.fromEntries(entries.map((e) => [e.family, e.name]));

const rowHtml = ({ e, flags, t }) => {
  const built = bal.built[e.family] ?? 0;
  const kills = bal.kills[e.family] ?? 0;
  const drawn = Object.keys(t.looks);
  const cost = [e.cost.war ? `<b class="war">${e.cost.war}</b><small>war</small>` : '', e.cost.science ? `<b class="sci">${e.cost.science}</b><small>sci</small>` : ''].join(' ') || '<b class="free">free</b>';
  const kinds = [...new Set(flags.map((f) => f[0]))].join(' ');
  return `<tr id="${e.family}" data-role="${e.role}" data-flags="${kinds}" data-n="${flags.length}">
    <td class="pics"><div class="pic"><img src="${t.front ?? ''}" alt="${esc(e.name)} from in front" width="84" height="84" loading="lazy"></div>${t.back ? `<div class="pic back"><img src="${t.back}" alt="from behind" width="84" height="84" loading="lazy"><span>behind</span></div>` : '<div class="pic none"><span>no back</span></div>'}</td>
    <td class="who"><div class="nm">${esc(e.name)}</div><div class="sub">${ROLE[e.role]} · ${esc(e.layer.toLowerCase())}${e.size !== 'one' ? ` · <b>${e.size.toUpperCase()}</b>` : ''}${e.drawn ? '' : ' · given, not drawn'}</div><div class="desc">${esc(e.desc)}</div></td>
    <td class="num">${cost}</td>
    <td class="num stats"><span>hp <b>${e.maxHp}</b></span><span>dps <b>${e.dps || (e.fires ? 'aimed' : '–')}</b></span>${e.dot ? `<span>dot <b>${e.dot}</b></span>` : ''}<span>rng <b>${e.range >= 9999 ? 'board' : e.range || '–'}</b></span></td>
    <td class="teach"><span class="lk ${e.pipClass}">${CLASS[e.pipClass]}</span><div class="donor">${esc(e.donor)}</div></td>
    <td class="looks"><div class="evo">${e.evoLooks.map((k) => lookChip(k, drawn.includes(k) ? 'have' : '')).join('')}</div>${drawn.length ? `<div class="drawn">${drawn.map((k) => `<figure class="${e.evoLooks.includes(k) ? '' : 'off'}"><img src="${t.looks[k]}" alt="${esc(lookName(k))}" width="52" height="52" loading="lazy"><figcaption>${esc(lookName(k))}</figcaption></figure>`).join('')}</div>` : ''}</td>
    ${footprintCell(e.family, PLANNED)}
    <td class="num runs">${e.role === 'engine' || !e.drawn ? (built ? `built <b>${built}</b>` : '<span class="mute">not built</span>') : `<span>built <b>${built}</b></span><span>kills <b>${kills}</b></span><span>per <b>${built ? (kills / built).toFixed(1) : '–'}</b></span>`}</td>
    <td class="flags">${flags.length ? `<ul>${flags.map(([k, text, lvl, mine]) => { const fix = resolvedBy(e.family, text); return `<li class="${k} ${lvl}"><em>${KINDS[k]}${mine ? ' · seen' : ''}</em>${esc(text)}${fix ? `<span class="res ${/^Open/.test(fix) ? 'open' : ''}"><b>Resolved by</b> ${esc(fix)}</span>` : ''}</li>`; }).join('')}</ul>` : '<span class="mute">nothing flagged</span>'}</td>
  </tr>`;
};

const html = `<title>Broodfall Limb Sheet</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@300;400;500;600&family=Barlow:wght@400;500;600&display=swap">
<style>
/* Layout: the ship's console (the game's own look: black glass, hairline white rules), a decision list on top, then one long sortable ledger of limbs. Deliberately one dark world, like the game. */
:root {
  color-scheme: dark;
  --bg: #07090b; --panel: #0d1114; --line: rgba(233, 238, 240, 0.16); --line-hi: rgba(233, 238, 240, 0.38);
  --fg: #e9eef0; --dim: #93a0a6; --cyan: #9fe8f5; --amber: #f0c66a;
  --war: #ff8a3d; --sci: #5fd0ff;
  --bone: #eadfc6; --swarm: #8fd6ff; --venom: #b9e35c; --reach: #d4a2ff;
  --display: "Barlow Semi Condensed", Bahnschrift, "DIN Alternate", "Arial Narrow", sans-serif;
  --body: Barlow, Bahnschrift, "Segoe UI", Arial, sans-serif;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font: 14px/1.45 var(--body); }
.wrap { max-width: 1680px; margin: 0 auto; padding-inline: 20px; padding-block: 28px 60px; }
header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px 32px; align-items: end; border-bottom: 1px solid var(--line-hi); padding-bottom: 16px; }
.kicker { font: 500 11px var(--display); letter-spacing: 3.5px; color: var(--dim); text-transform: uppercase; }
h1 { font: 300 40px/1.05 var(--display); letter-spacing: 7px; margin: 4px 0 6px; text-transform: uppercase; text-wrap: balance; }
.lede { max-width: 72ch; color: #c8d1d5; margin: 0; }
.tally { display: flex; gap: 0; border: 1px solid var(--line); }
.tally div { padding: 8px 16px; border-left: 1px solid var(--line); min-width: 92px; }
.tally div:first-child { border-left: 0; }
.tally b { display: block; font: 300 28px/1 var(--display); font-variant-numeric: tabular-nums; }
.tally span { font: 500 10px var(--display); letter-spacing: 2px; color: var(--dim); text-transform: uppercase; }
h2 { font: 500 12px var(--display); letter-spacing: 3.5px; color: var(--dim); text-transform: uppercase; margin: 30px 0 10px; }
.decide { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); gap: 10px; counter-reset: d; }
.decide article { border: 1px solid var(--line); background: var(--panel); padding: 12px 14px 12px; counter-increment: d; min-width: 0; }
.decide h3 { font: 500 17px/1.2 var(--display); letter-spacing: 0.5px; margin: 0 0 6px; text-wrap: balance; }
.decide h3::before { content: counter(d); display: inline-block; width: 22px; color: var(--amber); font-variant-numeric: tabular-nums; }
.decide p { margin: 0 0 8px; color: #c8d1d5; font-size: 13.5px; }
.decide nav { display: flex; flex-wrap: wrap; gap: 4px; }
.decide nav a { color: var(--cyan); font-size: 12px; text-decoration: none; border: 1px solid rgba(159, 232, 245, 0.3); padding: 1px 7px; }
.decide nav a:hover, .decide nav a:focus-visible { background: rgba(159, 232, 245, 0.12); outline: none; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 18px; color: var(--dim); font-size: 12.5px; margin-top: 8px; }
.legend .lk { margin-right: 4px; }
.bar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 4px 0 10px; }
.bar label { font: 500 10px var(--display); letter-spacing: 2.5px; color: var(--dim); margin-right: 2px; text-transform: uppercase; }
.bar button { font: 500 12px var(--display); letter-spacing: 1.5px; text-transform: uppercase; background: transparent; color: var(--fg); border: 1px solid var(--line); padding: 4px 10px; cursor: pointer; }
.bar button i { font-style: normal; color: var(--dim); margin-left: 6px; font-variant-numeric: tabular-nums; }
.bar button[aria-pressed="true"] { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.bar button[aria-pressed="true"] i { color: #5b666b; }
.bar button:focus-visible { outline: 1px solid var(--cyan); outline-offset: 2px; }
.bar .gap { width: 14px; }
.table { overflow-x: auto; border: 1px solid var(--line); }
table { border-collapse: collapse; width: 100%; min-width: 1560px; }
thead th { position: sticky; top: 0; background: #0b0e10; font: 500 10.5px var(--display); letter-spacing: 2.5px; text-transform: uppercase; color: var(--dim); text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line-hi); white-space: nowrap; }
td { vertical-align: top; padding: 10px; border-bottom: 1px solid var(--line); }
tr:target td { background: rgba(240, 198, 106, 0.07); }
tr:target td:first-child { box-shadow: inset 3px 0 0 var(--amber); }
.pics { white-space: nowrap; width: 180px; }
.pic { display: inline-block; position: relative; width: 84px; height: 84px; background: radial-gradient(ellipse at 50% 70%, rgba(130, 150, 160, 0.2), transparent 70%); vertical-align: top; }
.pic img { display: block; width: 84px; height: 84px; }
.pic span { position: absolute; left: 0; right: 0; bottom: 2px; text-align: center; font: 500 9px var(--display); letter-spacing: 1.5px; color: var(--dim); text-transform: uppercase; }
.pic.none { border: 1px dashed var(--line); }
.pic.none span { bottom: 36px; color: #6e7a80; }
.who { width: 220px; }
.nm { font: 500 18px/1.1 var(--display); letter-spacing: 1px; }
.sub { font: 500 11px var(--display); letter-spacing: 1.2px; color: var(--dim); text-transform: uppercase; margin: 2px 0 4px; }
.sub b { color: var(--fg); font-weight: 500; }
.desc { font-size: 12.5px; color: #c8d1d5; }
.num { white-space: nowrap; font-variant-numeric: tabular-nums; }
.num b { font: 400 17px var(--display); }
.num b.war { color: var(--war); } .num b.sci { color: var(--sci); } .num b.free { color: var(--amber); }
.num small { color: var(--dim); margin-left: 2px; }
.stats span, .runs span { display: block; color: var(--dim); font-size: 12px; }
.stats b, .runs b { color: var(--fg); font-size: 15px; }
.teach { width: 170px; }
.donor { font-size: 12px; color: #c8d1d5; margin-top: 4px; }
.lk { display: inline-flex; align-items: center; gap: 3px; font: 600 10px var(--display); letter-spacing: 1.4px; text-transform: uppercase; color: #07090b; padding: 1px 6px; margin: 0 3px 3px 0; white-space: nowrap; }
.lk.bone { background: var(--bone); } .lk.swarm { background: var(--swarm); } .lk.venom { background: var(--venom); } .lk.reach { background: var(--reach); }
.lk.sup { background: transparent; color: var(--fg); border: 1px solid var(--line-hi); }
.lk.sup i { width: 7px; height: 7px; display: inline-block; }
.lk.sup i.bone { background: var(--bone); } .lk.sup i.swarm { background: var(--swarm); } .lk.sup i.venom { background: var(--venom); } .lk.sup i.reach { background: var(--reach); }
.lk.have { box-shadow: 0 0 0 1px var(--cyan); }
.looks { width: 250px; }
.drawn { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.drawn figure { margin: 0; width: 56px; text-align: center; }
.drawn img { width: 52px; height: 52px; display: block; margin: 0 auto; border: 1px solid rgba(159, 232, 245, 0.45); }
.drawn figure.off img { border: 1px dashed var(--amber); opacity: 0.85; }
.drawn figcaption { font: 500 9px/1.1 var(--display); letter-spacing: 0.5px; color: var(--dim); text-transform: uppercase; }
.flags { min-width: 360px; }
.flags ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.flags li { font-size: 12.5px; line-height: 1.38; padding-left: 9px; border-left: 2px solid var(--line-hi); color: #c8d1d5; }
.flags li.hi { color: var(--fg); }
.flags li.art { border-color: #e39a7b; } .flags li.looks { border-color: var(--cyan); } .flags li.balance { border-color: var(--amber); } .flags li.role { border-color: var(--reach); } .flags li.words { border-color: #9aa4a8; } .flags li.design { border-color: #a8e6b4; }
.flags li.lo { opacity: 0.78; }
.flags em { display: block; font: 600 9.5px var(--display); font-style: normal; letter-spacing: 2px; text-transform: uppercase; color: var(--dim); }
.mute { color: #6e7a80; font-size: 12px; }
tr[hidden] { display: none; }
footer { margin-top: 18px; color: var(--dim); font-size: 12.5px; max-width: 110ch; display: grid; gap: 6px; }
footer code { font-size: 12px; color: #c8d1d5; word-break: break-all; }
.fpc { width: 230px; font-size: 12px; color: #c8d1d5; }
.fprow { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.fp rect { fill: rgba(233, 238, 240, 0.18); stroke: rgba(233, 238, 240, 0.55); stroke-width: 1; }
.fp.next rect { fill: rgba(240, 198, 106, 0.55); stroke: var(--amber); }
.fpc .arr { color: var(--amber); }
.fpn { font: 500 11px var(--display); letter-spacing: 1.2px; text-transform: uppercase; color: var(--dim); }
.fpn b { color: var(--amber); font-weight: 600; }
.fpw { margin-top: 4px; }
.fps { margin-top: 4px; }
.fps em, .res b { font: 600 9.5px var(--display); font-style: normal; letter-spacing: 1.6px; text-transform: uppercase; color: var(--dim); margin-right: 4px; }
.fps.risk { color: #ffb08a; }
.res { display: block; margin-top: 3px; color: #a8e6b4; }
.res.open { color: var(--dim); }
.plan { border: 1px solid rgba(240, 198, 106, 0.4); background: linear-gradient(180deg, rgba(240, 198, 106, 0.05), transparent 240px); padding: 4px 16px 16px; margin-top: 22px; }
.plan h2 { color: var(--amber); }
.plan .lede2 { color: #c8d1d5; max-width: 110ch; margin: 0 0 12px; }
.plan code { color: var(--cyan); font-size: 12.5px; }
.pgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 10px; }
.pgrid article { border: 1px solid var(--line); background: var(--panel); padding: 12px 14px; min-width: 0; }
.pgrid h3, .plan .sub3 { font: 500 16px/1.2 var(--display); letter-spacing: 0.5px; margin: 0 0 8px; }
.plan .sub3 { margin: 18px 0 6px; }
.note { color: var(--dim); font-size: 12.5px; margin: 6px 0; }
.dist { display: grid; gap: 4px; }
.dk { display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; }
.dk.hd span { font: 500 10px var(--display); letter-spacing: 2px; text-transform: uppercase; color: var(--dim); }
.dn { font: 500 13px var(--display); }
.db { position: relative; height: 18px; background: rgba(233, 238, 240, 0.05); }
.db i { position: absolute; inset: 0 auto 0 0; display: block; }
.db .bnow { background: rgba(233, 238, 240, 0.28); }
.db .bnext { background: rgba(240, 198, 106, 0.7); }
.db b { position: absolute; left: 6px; top: 0; font: 500 13px/18px var(--display); font-variant-numeric: tabular-nums; }
.pgrid table, .vtab, .fixes { border-collapse: collapse; width: 100%; min-width: 0; font-size: 12.5px; }
.pgrid td, .pgrid th, .vtab td, .vtab th, .fixes td, .fixes th { padding: 5px 6px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; position: static; background: none; }
.pgrid th, .vtab th { font: 500 10px var(--display); letter-spacing: 1.6px; text-transform: uppercase; color: var(--dim); }
.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.cost .tot td { color: var(--amber); font-weight: 600; }
.meas { list-style: none; padding: 0; margin: 6px 0 0; display: grid; gap: 4px; font-size: 12px; }
.meas li { padding-left: 8px; border-left: 2px solid var(--line-hi); }
.meas li.ok { border-color: #8fd18f; } .meas li.bad { border-color: #ff8a6a; }
.meas li.rec { color: var(--amber); font-weight: 600; }
.vtab a, .ovl a { color: var(--cyan); text-decoration: none; }
.fixes th { width: 300px; font: 500 13px var(--display); color: var(--fg); }
.ovl { margin-top: 8px; color: var(--dim); font-size: 12.5px; }
.ovl summary { cursor: pointer; }
.qs { color: #c8d1d5; font-size: 13.5px; }
.mute { color: #6e7a80; }
@media (max-width: 760px) { header { grid-template-columns: 1fr; } h1 { font-size: 30px; letter-spacing: 4px; } .tally { flex-wrap: wrap; } }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
</style>
<div class="wrap">
<header>
  <div><div class="kicker">Broodfall · the hive's limbs · before the upgrade looks</div>
    <h1>Limb decision sheet</h1>
    <p class="lede">Every limb family, its pictures, numbers and what it teaches an eater, with what looks wrong or unclear about it. Numbers are read from the game; the scripted runs are the naive player on hold-12 over ten seeds (${bal.wins}/10 won, ${esc(bal.measured)}). Flags marked <b>seen</b> are Claude's read of the pictures and roles; the rest are counted.</p></div>
  <div class="tally"><div><b>${entries.length}</b><span>families</span></div><div><b>${prototyped.length}</b><span>looks drawn</span></div><div><b>${singleLook}</b><span>reach 1 look</span></div><div><b>${evoTotal}</b><span>looks to draw*</span></div></div>
</header>

${planSectionHtml(entries, PLANNED, names)}

<h2>Decide first (the first read of the limbs; each is answered in "Flags → fixes" above)</h2>
<section class="decide">${DECISIONS.map(([h, p, fams]) => `<article><h3>${esc(h)}</h3><p>${esc(p)}</p><nav>${fams.map((f) => `<a href="#${f}">${esc(names[f] ?? f)}</a>`).join('')}</nav></article>`).join('')}</section>

<h2>The limbs</h2>
<div class="legend"><span><span class="lk bone">Bone</span>heavy, armoured</span><span><span class="lk swarm">Swarm</span>fast, many</span><span><span class="lk venom">Venom</span>caustic</span><span><span class="lk reach">Reach</span>grasp, range</span><span><span class="lk sup"><i class="bone"></i><i class="venom"></i>Superstructure</span>two classes</span><span><span class="lk swarm have">Outlined</span>already drawn</span><span>Dashed amber picture: drawn, but no evolution path reaches it</span></div>
<div class="bar" role="toolbar" aria-label="Filter the limbs">
  <label>Role</label>
  <button type="button" id="r-all" data-role="" aria-pressed="true">All<i>${entries.length}</i></button>
  ${Object.entries(ROLE).map(([k, v]) => `<button type="button" id="r-${k}" data-role="${k}" aria-pressed="false">${v}<i>${entries.filter((e) => e.role === k).length}</i></button>`).join('')}
  <span class="gap"></span><label>Flag</label>
  <button type="button" id="f-all" data-flag="" aria-pressed="true">Any</button>
  ${Object.entries(KINDS).map(([k, v]) => `<button type="button" id="f-${k}" data-flag="${k}" aria-pressed="false">${v}<i>${flagCount[k]}</i></button>`).join('')}
</div>
<div class="table"><table>
  <thead><tr><th>Front · behind</th><th>Limb</th><th>Price</th><th>Numbers</th><th>Teaches when eaten</th><th>Looks its evolutions reach</th><th>Footprint: now → proposed</th><th>Scripted runs</th><th>Flags</th></tr></thead>
  <tbody>${rows.map(rowHtml).join('')}</tbody>
</table></div>
<footer>
  <p>* Looks to draw: the class looks and superstructures the evolution paths of the ${entries.length - prototyped.length} limbs without drawn looks reach with no eaten bonus. Eaten bonuses can push any limb into any class, so these are the looks most players will see, not every look possible.</p>
  <p>The same data in the game: the Limb Codex (main menu LIMB CODEX, the ▤ button on the ship and on the board, C, or CODEX on a limb's panel). Remade by <code>node C:\\Users\\Merry\\dev\\space-derelict\\games\\broodfall\\tools\\codex\\sheet.mjs</code>.</p>
</footer>
</div>
<script>
(() => {
  const rows = [...document.querySelectorAll('tbody tr')];
  const state = { role: '', flag: '' };
  const apply = () => {
    for (const r of rows) r.hidden = (state.role && r.dataset.role !== state.role) || (state.flag && !r.dataset.flags.split(' ').includes(state.flag));
    for (const b of document.querySelectorAll('.bar button')) {
      const key = 'role' in b.dataset ? 'role' : 'flag';
      b.setAttribute('aria-pressed', String((b.dataset[key] ?? '') === state[key]));
    }
  };
  document.querySelector('.bar').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if ('role' in b.dataset) state.role = b.dataset.role; else state.flag = b.dataset.flag;
    apply();
  });
  // A link from "Decide first" shows its row even under a filter.
  addEventListener('hashchange', () => { state.role = ''; state.flag = ''; apply(); });
})();
</script>
`;
mkdirSync(join(root, 'notes', 'limb-codex'), { recursive: true });
const out = join(root, 'notes', 'limb-codex', 'limb-codex-sheet.html');
writeFileSync(out, html);
writeFileSync(join(root, 'notes', 'FOOTPRINT-PLAN.md'), planMarkdown(entries, PLANNED, names));
console.log(`${out}  ${(html.length / 1024).toFixed(0)} KB, ${entries.length} limbs, flags: ${JSON.stringify(flagCount)}`);
