/**
 * EMPIRE DIRECTIVES — the ship's room for Command's standing orders (content/directives.ts; rules
 * src/meta/directives.ts). The Office's own page: form numbers, the order, a progress rule, what
 * it pays, the line for expected contribution; the orders fulfilled and their acknowledgements;
 * every deployment's own directive on file; the irregularities the Office has noted (his
 * finished hobby pages). It opens with the Directive Desk (src/meta/onboarding.ts deskOpen).
 */
import './directives.css';
import { directiveStatus } from './defenceUi';
import { ORDERS, ORDERS_FOOT, ORDERS_HEAD } from '../../content/directives';
import { TERRITORIES } from '../../content/campaign';
import { ORGAN_BY_ID } from '../../content/underground';
import { orderDef, ordersOf, type OrdersReport } from '../meta/directives';
import { hobbyOf } from '../meta/hobby';
import { targets, type CampaignState } from '../meta/campaign';

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const fill = (t: string, n: number) => t.replace('{n}', n.toLocaleString('en-GB'));
const KIND: Record<string, string> = { hold: 'HOLD', royal: 'DESTROY THE ROYAL', harvest: 'SAMPLE QUOTA' };

export function directivesHtml(s: CampaignState): string {
  const o = ordersOf(s);
  const open = o.open.map((x) => {
    const def = orderDef(x.id);
    const pct = Math.min(100, (x.progress / def.target) * 100);
    const extra = [
      def.equip?.trapCage ? 'ISSUED: one trap cage per deployment while open.' : '',
      x.trial ? `ISSUED FOR TRIAL: the ${esc(ORGAN_BY_ID[x.trial]?.name ?? x.trial)} lineage, in every deployment's organ pool while open; kept on fulfilment.` : '',
    ].filter(Boolean).map((t) => `<div class="dr-issued">${t}</div>`).join('');
    return `<div class="dr-order" data-order="${x.id}">
      <div class="dr-form">${esc(def.form)} · ${esc(def.title.toUpperCase())}</div>
      <div class="dr-text">${esc(fill(def.text, def.target))}</div>
      ${extra}
      <div class="dr-prog"><div class="dr-bar"><div style="width:${pct.toFixed(1)}%"></div></div><span>${x.progress.toLocaleString('en-GB')} / ${def.target.toLocaleString('en-GB')}</span></div>
      <div class="dr-meta"><span>REMUNERATION: <b>+${def.pays} STANDING</b>${x.trial ? ' · THE LINEAGE' : ''}</span><span>ISSUED AT DEPLOYMENT ${x.since}</span></div>
      <div class="dr-contrib">Expected contribution: ${esc(def.contribution)}</div>
    </div>`;
  }).join('') || '<p class="cp-note">No standing orders are open. The Office has nothing further for you at this time.</p>';
  const done = o.done.slice().reverse().map((id) => {
    const def = orderDef(id);
    return `<div class="dr-done"><b>${esc(def.form)} · ${esc(def.title)}</b> <i>FULFILLED · +${def.pays}</i><div>${esc(def.ack)}</div></div>`;
  }).join('') || '<p class="cp-note">None yet.</p>';
  const queued = ORDERS.length - o.done.length - o.open.length;

  // Every deployment's own directive: the ground he holds and can reach, and his record.
  const open2 = new Set(targets(s).map((t) => t.id));
  const onFile = TERRITORIES.filter((t) => (!t.hidden || s.revealed.includes(t.id)) && (s.held.includes(t.id) || open2.has(t.id)));
  const rows = onFile.map((t) => {
    const d = t.directive;
    const what = !d ? '' : d.kind === 'hold' ? `Hold ${d.waves} waves` : d.kind === 'royal' ? 'Destroy the royal' : `Bank ${d.science} science`;
    const st = directiveStatus(s, t.id) ?? (s.underAttack === t.id ? 'UNDER ATTACK — DEFEND' : s.held.includes(t.id) ? 'FULFILLED · HELD' : 'OPEN');
    return `<tr class="${s.held.includes(t.id) ? 'held' : ''}${s.underAttack === t.id ? ' attack' : ''}"><td>${esc(t.name)}</td><td>${t.tier}</td><td>${d ? KIND[d.kind] : ''}</td><td>${esc(what)}</td><td>${st}</td></tr>`;
  }).join('');
  const rec = o.record;
  const tally = (['hold', 'royal', 'harvest'] as const).map((k) => {
    const all = rec.filter((r) => r.kind === k);
    return `<span>${KIND[k]} <b>${all.filter((r) => r.won).length}</b>/${all.length}</span>`;
  }).join('');
  const noted = hobbyOf(s).done.length;
  return `<div class="dr-wrap">
    <div class="dr-letterhead">${esc(ORDERS_HEAD)}</div>
    <div class="cp-cols dr-cols">
      <div>
        <div class="cp-label">STANDING ORDERS — OPEN (${o.open.length})</div>${open}
        ${queued > 0 ? `<p class="cp-note">${queued} further order${queued > 1 ? 's' : ''} will be issued as these are fulfilled.</p>` : ''}
      </div>
      <div>
        <div class="cp-label">DEPLOYMENT DIRECTIVES ON FILE</div>
        <table class="dr-table"><thead><tr><th>SITE</th><th>TIER</th><th>DIRECTIVE</th><th>TERMS</th><th>STATUS</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="dr-tally">FULFILLED TO DATE: ${tally}</div>
        <div class="cp-label">FULFILLED — ACKNOWLEDGEMENTS</div><div class="dr-dones">${done}</div>
        <div class="cp-label">IRREGULARITIES NOTED</div>
        <p class="cp-note">${noted ? `The Office has noted ${noted} irregular use${noted > 1 ? 's' : ''} of Navy property (Form 0-U). No action has been taken.` : 'None. The Office thanks you for your regularity.'}</p>
      </div>
    </div>
    <div class="dr-foot">${ORDERS_FOOT.map((l) => `<div>${esc(l)}</div>`).join('')}</div>
  </div>`;
}

/** The report's standing-orders section. */
export function ordersDebriefHtml(r?: OrdersReport): string {
  if (!r || (!r.moved.length && !r.fulfilled.length && !r.issued.length)) return '';
  const moved = r.moved.map((m) => {
    const def = orderDef(m.id);
    const full = r.fulfilled.includes(m.id);
    return `<div class="cp-goal ${full ? 'met' : 'miss'}"><b>${full ? '✔' : '·'} ${esc(def.form)} · ${esc(def.title)}</b> ${m.before.toLocaleString('en-GB')} → ${m.after.toLocaleString('en-GB')} / ${m.target.toLocaleString('en-GB')}${full ? ` <i>+${def.pays} standing</i>` : ''}</div>`;
  }).join('');
  const issued = r.issued.length ? `<div class="cp-facts">New standing order${r.issued.length > 1 ? 's' : ''} issued: ${r.issued.map((id) => `<b>${esc(orderDef(id).form)} ${esc(orderDef(id).title)}</b>`).join(', ')} (Empire Directives)</div>` : '';
  const lin = r.lineages.length ? `<div class="cp-facts">Lineage kept: <b>${r.lineages.map((l) => esc(ORGAN_BY_ID[l]?.name ?? l)).join(', ')}</b></div>` : '';
  return `<div class="cp-label">STANDING ORDERS${r.standing ? ` — +${r.standing} standing` : ''}</div>${moved}${lin}${issued}`;
}
