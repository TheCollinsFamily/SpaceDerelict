/**
 * DEFENCE DEPLOYMENTS on the ship's screens (the rules: src/meta/defence.ts; DESIGN.md "Defence
 * deployments"): the colony's pushing arrow on the globe, the staging ground's tag on the landing-site
 * picker, the desk's line, the report's lines, the Directives table's status.
 */
import './defence.css';
import { DEFENCE } from '../../content/defence';
import { TERRITORIES } from '../../content/campaign';
import type { CampaignState, Debrief } from '../meta/campaign';
import { pushArc } from './globe';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const T = (id: string) => TERRITORIES.find((t) => t.id === id);
const name = (id: string) => esc(T(id)?.name ?? id);

/** The push the globe draws now: massing (a deployment ahead) or launched (defend it now). */
export function pushOf(s: CampaignState): { from: string; to: string; kind: 'staging' | 'launched' } | null {
  if (s.underAttack && s.attackFrom) return { from: s.attackFrom, to: s.underAttack, kind: 'launched' };
  if (s.staging) return { from: s.staging.from, to: s.staging.target, kind: 'staging' };
  return null;
}

/**
 * The arrow, as SVG for the globe: a glow, a line of chevrons that flow from where the colony masses to
 * what it means to take back, and a head. The 3D planet re-draws it every frame from data-from / data-to.
 */
export function pushSvg(s: CampaignState, proj: (lat: number, lon: number) => { x: number; y: number; front: boolean }): string {
  const p = pushOf(s);
  const a = p && T(p.from);
  const b = p && T(p.to);
  if (!p || !a || !b) return '';
  const arc = pushArc(proj, a, b);
  return `<g class="push ${p.kind}" data-from="${a.lat},${a.lon}" data-to="${b.lat},${b.lon}" data-push-from="${p.from}" data-push-to="${p.to}">
    <path class="push-glow" d="${arc.line}"/><path class="push-line" d="${arc.line}"/><path class="push-head" d="${arc.head}"/></g>`;
}

/** Extra classes for a landing site's marker: where the colony masses, what it threatens. */
export function siteClasses(s: CampaignState, id: string): string {
  const p = pushOf(s);
  if (!p) return '';
  if (p.from === id) return ` massing ${p.kind}`;
  if (p.to === id && p.kind === 'staging') return ' threat';
  return '';
}

/** The small word under the staging ground's marker. */
export function siteTag(s: CampaignState, id: string): string {
  const p = pushOf(s);
  return p && p.from === id ? `<text class="push-tag" y="24">${p.kind === 'staging' ? 'MASSING' : 'ATTACKING'}</text>` : '';
}

/** What a defence is, for the briefing. */
export function defenceFacts(s: CampaignState, id: string): string {
  const where = s.boards?.[id] ? 'on the city you took it on, your organs where you grew them' : 'on a large city';
  return `<b>DEFENCE</b> — ${esc(DEFENCE.brief)}, ${where}; the core already chambered (stage ${DEFENCE.coreStage}), the larder full`;
}

/** The banner at the top of a briefing: the staging ground (strike first), or the ground it threatens. */
export function briefBanner(s: CampaignState, id: string): string {
  const p = pushOf(s);
  if (!p) return '';
  if (p.kind === 'staging' && p.from === id) {
    return `<div class="cp-push staging"><b>STAGING GROUND</b> — strike first to cancel the attack on <b>${name(p.to)}</b>.
      <span>The colony is massing here. Take it on this deployment and the counter-attack is called off.</span></div>`;
  }
  if (p.kind === 'staging' && p.to === id) {
    return `<div class="cp-push threat"><b>THREATENED</b> — the colony is massing at <b>${name(p.from)}</b> to retake this.
      <span>Strike ${name(p.from)} on your next deployment to call it off. Otherwise it marches, and the deployment after you defend it here or lose it.</span></div>`;
  }
  if (p.kind === 'launched' && p.to === id) {
    return `<div class="cp-push launched"><b>UNDER ATTACK</b> — the colony has marched from <b>${name(p.from)}</b>.
      <span>Defend it on this deployment, or deploy elsewhere and lose it.</span></div>`;
  }
  return '';
}

/** The desk's line when nothing is picked. */
export function deskLine(s: CampaignState): string {
  const p = pushOf(s);
  if (!p) return '';
  return p.kind === 'staging'
    ? ` <b>The colony is massing at ${name(p.from)} to retake ${name(p.to)}.</b> Strike ${name(p.from)} first to call it off, or it marches after your next deployment.`
    : ` <b>${name(p.to)} is under attack</b> from ${name(p.from)}: defend it now (${esc(DEFENCE.brief)}), or lose it.`;
}

/** The report's lines about the colony's counter-attacks. */
export function debriefLines(d: Debrief): string {
  const out: string[] = [];
  if (d.preempted) out.push(`<p class="cp-push-line good">The colony was massing at ${name(d.preempted.from)} to retake ${name(d.preempted.target)}. You got there first: <b>counter-attack cancelled</b>.</p>`);
  if (d.launched) out.push(`<p class="cp-push-line bad">The colony has marched from ${name(d.launched.from)} on <b>${name(d.launched.target)}</b>. Defend it on your next deployment, or lose it.</p>`);
  if (d.staged) out.push(`<p class="cp-push-line warn">The colony is massing at <b>${name(d.staged.from)}</b> to retake ${name(d.staged.target)}. Strike ${name(d.staged.from)} next to call it off.</p>`);
  return out.join('');
}

/** The Directives table's status for a territory. */
export function directiveStatus(s: CampaignState, id: string): string | null {
  const p = pushOf(s);
  if (!p || p.to !== id) return null;
  return p.kind === 'launched' ? `UNDER ATTACK — DEFEND (${DEFENCE.brief})` : `THREATENED — strike ${T(p.from)?.name ?? p.from} first`;
}
