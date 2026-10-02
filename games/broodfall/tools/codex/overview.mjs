/**
 * The top of the limb decision sheet (Collins, Oct 2 2026: "send me a list of limb types and the footprint, with
 * a note on which ones are changing"): the counts by shape (now vs proposed), then one compact row a limb (name,
 * thumbnail, footprint as a tiny cell diagram and a word, and a CHANGES cell that is empty unless the plan changes
 * it), changing limbs first, with a "changes only" toggle. Data: tools/codex/plan.mjs via planSection.mjs.
 */
import { PLAN, SANITY } from './plan.mjs';
import { cellsSvg } from './planSection.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WORD = { '1x1': '1 square', '1x2': 'line of 2', line3: 'line of 3', '2x2': '2x2', T: 'T of 4', L3: 'elbow of 3', L4: 'L of 4', S4: 'zigzag' };
const KIND = { '1x1': '1 square', '1x2': 'Line', line3: 'Line', '2x2': '2x2', T: 'T', L3: 'L', L4: 'L' };
const ORDER = ['1 square', 'Line', '2x2', 'T', 'L'];
/** The plan's one-line reason, without its "SANITY PASS:" tag. */
const reason = (p) => String(p.why ?? '').replace(/^SANITY PASS:\s*/, '').split(/(?<=\.)\s/)[0];

export function overviewHtml(entries, P, names, thumbs) {
  const rows = entries.filter((e) => PLAN[e.family]).map((e) => {
    const p = PLAN[e.family];
    const now = P.nowId(e.family);
    return { e, p, now, changed: now !== p.to };
  });
  const count = (key) => Object.fromEntries(ORDER.map((k) => [k, rows.filter((r) => KIND[r[key]] === k).length]));
  const before = count('now');
  const after = Object.fromEntries(ORDER.map((k) => [k, rows.filter((r) => KIND[r.p.to] === k).length]));
  const changed = rows.filter((r) => r.changed);
  rows.sort((a, b) => Number(b.changed) - Number(a.changed) || names[a.e.family].localeCompare(names[b.e.family]));
  const counts = ORDER.map((k) => `<div class="oc"><span>${esc(k)}</span><b>${before[k]}</b><i>→</i><b class="${before[k] !== after[k] ? 'chg' : ''}">${after[k]}</b></div>`).join('');
  const body = rows.map(({ e, p, now, changed: c }) => `<tr class="${c ? 'chg' : 'same'}">
    <td class="ot"><img src="${thumbs[e.family]?.front ?? ''}" alt="" width="40" height="40" loading="lazy"></td>
    <td class="on"><a href="#${e.family}">${esc(names[e.family])}</a></td>
    <td class="of">${cellsSvg(P.dump[e.family].next, c ? 'next' : '')}<span>${esc(WORD[p.to])}</span></td>
    <td class="ox">${c ? `<b>${esc(WORD[now])} → ${esc(WORD[p.to])}</b> ${esc(p.change ?? reason(p))}${p.silhouette ? `<span class="oa"><em>Art</em> ${esc(p.silhouette)}</span>` : ''}` : ''}</td>
  </tr>`).join('');
  return `
<section class="over" id="footprints">
<h2>Limbs and their footprints (revised plan, not applied)</h2>
<div class="obar"><div class="ocounts" aria-label="Limbs by footprint, now and proposed">${counts}</div>
<button type="button" id="only-changes" aria-pressed="false">Changes only <i>${changed.length}</i></button></div>
<div class="otable"><table class="ov"><thead><tr><th></th><th>Limb</th><th>Footprint (proposed)</th><th>Changes</th></tr></thead><tbody>${body}</tbody></table></div>
<details class="san" open><summary>Sanity pass: what changed and why</summary><table class="fixes"><tbody>${SANITY.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</tbody></table></details>
</section>
<script>
(() => {
  const b = document.getElementById('only-changes');
  const t = document.querySelector('.ov');
  let on = false;
  try { on = localStorage.getItem('bf-only-changes') === '1'; } catch {}
  const apply = () => { b.setAttribute('aria-pressed', String(on)); for (const r of t.querySelectorAll('tbody tr.same')) r.hidden = on; };
  b.addEventListener('click', () => { on = !on; try { localStorage.setItem('bf-only-changes', on ? '1' : '0'); } catch {} apply(); });
  apply();
})();
</script>`;
}

export const OVERVIEW_CSS = `
.over { margin-top: 22px; }
.obar { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; margin-bottom: 8px; }
.ocounts { display: flex; flex-wrap: wrap; gap: 6px; }
.oc { display: flex; align-items: baseline; gap: 6px; border: 1px solid var(--line); padding: 4px 10px; font-variant-numeric: tabular-nums; }
.oc span { font: 500 11px var(--display); letter-spacing: 1.6px; text-transform: uppercase; color: var(--dim); }
.oc b { font: 400 18px var(--display); }
.oc b.chg { color: var(--amber); }
.oc i { color: var(--dim); font-style: normal; }
#only-changes { font: 500 12px var(--display); letter-spacing: 1.5px; text-transform: uppercase; background: transparent; color: var(--fg); border: 1px solid var(--line-hi); padding: 5px 12px; cursor: pointer; }
#only-changes i { font-style: normal; color: var(--amber); margin-left: 4px; }
#only-changes[aria-pressed="true"] { background: var(--amber); color: var(--bg); border-color: var(--amber); }
#only-changes[aria-pressed="true"] i { color: var(--bg); }
#only-changes:focus-visible { outline: 1px solid var(--cyan); outline-offset: 2px; }
.otable { overflow-x: auto; border: 1px solid var(--line); }
table.ov { min-width: 0; width: 100%; }
.ov td { padding: 4px 10px; vertical-align: middle; }
.ov thead th { position: static; }
.ov .ot img { width: 40px; height: 40px; display: block; }
.ov .on a { color: var(--fg); text-decoration: none; font: 500 15px var(--display); letter-spacing: 0.5px; }
.ov .on a:hover, .ov .on a:focus-visible { color: var(--cyan); }
.ov .of { white-space: nowrap; }
.ov .of span { margin-left: 8px; font: 500 12px var(--display); letter-spacing: 1px; text-transform: uppercase; color: var(--dim); vertical-align: middle; }
.ov .of svg { vertical-align: middle; }
.ov .ox { font-size: 12.5px; color: #c8d1d5; }
.ov .ox .oa { display: block; margin-top: 2px; color: var(--dim); }
.ov .ox .oa em { font: 600 9.5px var(--display); font-style: normal; letter-spacing: 1.6px; text-transform: uppercase; margin-right: 4px; }
.ov .ox b { color: var(--amber); font-weight: 600; margin-right: 6px; white-space: nowrap; }
.ov tr.chg td { background: rgba(240, 198, 106, 0.07); }
.ov tr.chg td:first-child { box-shadow: inset 3px 0 0 var(--amber); }
.san { margin-top: 10px; }
.san summary { cursor: pointer; font: 500 14px var(--display); letter-spacing: 0.5px; }
.san table { margin-top: 6px; }
`;
