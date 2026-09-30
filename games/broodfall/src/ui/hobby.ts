/**
 * THE NOTEBOOK — hobby missions on the ship (DESIGN.md "Hobby missions"; rules src/meta/hobby.ts;
 * pages content/hobby.ts). Built to the APPROVED concept notes/concepts/2026-09-29/r4-hobby-interface.png:
 * his own pages projected in the ship's holo blue over the dark room, grid paper, ring holes,
 * a paperclip on the one pinned to the next deployment, doodles, checklists, tally marks,
 * stars and exclamation marks, in his handwriting. It is the one screen aboard that is not the
 * Office's: no form numbers, no procurement voice, except the Office's stamp on a finished page.
 *
 * The campaign screen (src/ui/campaignUi.ts) draws it as the "Notebook" room and hands clicks on
 * [data-hpin] / [data-hsplice] to `hobbyClick`.
 */
import './hobby.css';
import { HOBBIES, HOBBY_SPLICE_SLOTS, type HobbyDef } from '../../content/hobby';
import { geneById } from '../../content/plates';
import { goalText, instance } from '../meta/goals';
import { hobbyOf, pinHobby, toggleSplice, type HobbyResult } from '../meta/hobby';
import type { CampaignState } from '../meta/campaign';

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** His doodles, drawn in single strokes (the concept's sketched beetles and cages, in miniature). */
const DOODLES: Record<HobbyDef['doodle'], string> = {
  flame: '<path d="M40 88c-16-6-20-26-8-40 2 10 8 12 10 8-4-14 4-28 16-34-4 12 4 20 10 28 8 12 4 32-12 38"/><path d="M44 84c-6-4-6-14 0-20 2 6 6 6 8 2 4 6 4 14-2 18"/><path d="M20 30l-6-6M78 26l8-8M84 52l10 0"/>',
  book: '<path d="M14 26c14-6 26-6 36 2v58c-10-8-22-8-36-2z"/><path d="M50 28c10-8 22-8 36-2v58c-14-6-26-6-36 2"/><path d="M22 40h20M22 50h18M58 40h20M58 50h16M24 62c4 4 10 4 14 0"/>',
  kite: '<path d="M50 10l24 30-24 34-24-34z"/><path d="M50 10v64M26 40h48"/><path d="M50 74c-6 8 6 10 0 18M44 86l-6 4M56 80l6 4"/><circle cx="20" cy="84" r="3"/><circle cx="84" cy="74" r="2"/>',
  crown: '<path d="M16 70l6-38 16 18 12-26 12 26 16-18 6 38z"/><path d="M16 78h68"/><circle cx="22" cy="30" r="3"/><circle cx="50" cy="22" r="3"/><circle cx="78" cy="30" r="3"/><path d="M40 60h20"/>',
  jar: '<path d="M30 20h40M34 20v10c-10 6-12 14-12 24v26c0 6 4 8 10 8h36c6 0 10-2 10-8V54c0-10-2-18-12-24V20"/><path d="M36 60c6-8 22-8 28 0M42 70l4-6 4 6 4-6 4 6"/><path d="M74 12l6-6M80 22l8-2"/>',
  cradle: '<path d="M18 50c0 20 14 30 32 30s32-10 32-30z"/><path d="M26 80l-6 10M74 80l6 10M14 90h72"/><path d="M40 50c0-8 4-12 10-12s10 4 10 12"/><path d="M44 30l-4-8M56 30l4-8"/>',
  pockets: '<path d="M22 30h56l-4 50H26z"/><path d="M34 30c2 14 30 14 32 0"/><path d="M40 52c4-2 8-2 12 0M40 60c4-2 8-2 12 0"/><path d="M84 20c-4 4-4 8 0 12M90 16c-6 8-6 14 0 22"/>',
  hearts: '<path d="M30 40c-10-14-26 0-14 12l14 12 14-12c12-12-4-26-14-12z"/><path d="M66 56c-8-12-22 0-12 10l12 10 12-10c10-10-4-22-12-10z"/><path d="M40 20l4-6M84 34l6-4M52 84l0 8"/>',
};

const doodle = (d: HobbyDef['doodle']) =>
  `<svg class="hb-doodle" viewBox="0 0 100 100" aria-hidden="true"><g>${DOODLES[d]}</g></svg>`;

/** A stable little tilt per page, so the spread looks dropped on the desk (never random: it is the same every drawing). */
const tilt = (i: number) => ((i * 37) % 7) - 3;

/** The notebook room. */
export function hobbyHtml(s: CampaignState): string {
  const h = hobbyOf(s);
  const known = HOBBIES.filter((d) => h.ideas.includes(d.id));
  const unknown = HOBBIES.length - known.length;
  const page = (d: HobbyDef, i: number) => {
    const done = h.done.includes(d.id);
    const pinned = h.pinned === d.id;
    const tries = h.tries[d.id] ?? 0;
    const gene = geneById(d.gene);
    const steps = d.steps.map((g) => `<li class="${done ? 'ticked' : ''}"><span class="hb-box">${done ? '✓' : ''}</span>${esc(goalText(instance(g, 0)))}</li>`).join('');
    return `<article class="hb-page${pinned ? ' pinned' : ''}${done ? ' done' : ''}" style="--tilt:${tilt(i)}deg" data-page="${d.id}">
      ${pinned ? '<span class="hb-clip" aria-hidden="true"></span>' : ''}
      <div class="hb-title">${esc(d.title)} ${done ? '<span class="hb-bang">!!</span>' : '<span class="hb-q">?</span>'}</div>
      ${doodle(d.doodle)}
      <p class="hb-pitch">${esc(d.pitch)}</p>
      ${d.setup ? `<p class="hb-setup">★ ${d.setup.matingMusk ? 'the lure glands carry the MATING gas this time' : d.setup.directive?.kind === 'royal' ? 'go where a royal will come out (the run becomes: destroy the royal)' : 'changes the run'}</p>` : ''}
      <ul class="hb-steps">${steps}</ul>
      <div class="hb-gene">→ if it works: <b>${esc(gene?.name ?? d.gene)}</b> <span>${esc(gene?.desc ?? '')}</span></div>
      ${tries ? `<div class="hb-tally" title="tried ${tries} time${tries > 1 ? 's' : ''}">${'<i></i>'.repeat(Math.min(tries, 12))}</div>` : ''}
      ${done
        ? `<p class="hb-after">${esc(d.after)}</p><div class="hb-stamp">FORM 0-U · NOTED · FILED</div>`
        : `<button class="hb-pin" data-hpin="${d.id}">${pinned ? 'unpin it — not this time' : 'pin it to the next drop'}</button>`}
    </article>`;
  };
  const blanks = Array.from({ length: Math.min(unknown, 3) }, (_, i) =>
    `<article class="hb-page blank" style="--tilt:${tilt(i + 11)}deg"><div class="hb-title">?</div><p class="hb-pitch">(something will occur to me down there)</p></article>`).join('');
  const jar = h.genes.length
    ? h.genes.map((g) => {
      const def = geneById(g);
      const on = h.spliced.includes(g);
      return `<button class="hb-gene-chip${on ? ' on' : ''}" data-hsplice="${g}" title="${esc(def?.desc ?? '')}"><span class="hb-box">${on ? '✓' : ''}</span>${esc(def?.name ?? g)}<small>${esc(def?.desc ?? '')}</small></button>`;
    }).join('')
    : '<p class="hb-pitch">Nothing in the jars yet. Finish a page and the organism keeps what it learned.</p>';
  const pinned = h.pinned ? HOBBIES.find((d) => d.id === h.pinned) : null;
  return `<div class="hb-wrap">
    <div class="hb-head"><span class="hb-hand">my notebook — NOT FOR THE BOARD</span>
      <span class="hb-now">${pinned ? `pinned to the next drop: <b>${esc(pinned.title)}</b>` : 'nothing pinned to the next drop'}</span></div>
    <div class="hb-spread">${known.map(page).join('')}${blanks}
      <article class="hb-page jar" style="--tilt:2deg"><div class="hb-title">the jars <span class="hb-q">(${h.spliced.length}/${HOBBY_SPLICE_SLOTS} spliced in)</span></div>
        ${doodle('jar')}
        <p class="hb-pitch">Genes Command never signed for. The organism can carry ${HOBBY_SPLICE_SLOTS} at a time, every drop. Tick to splice.</p>
        <div class="hb-jar">${jar}</div></article>
    </div></div>`;
}

/** A click in the notebook: the new state, or null when it was not the notebook's. */
export function hobbyClick(el: HTMLElement, s: CampaignState): CampaignState | null {
  const d = el.dataset;
  if (d.hpin) return pinHobby(s, d.hpin);
  if (d.hsplice) return toggleSplice(s, d.hsplice);
  return null;
}

/** The report's hobby section: the pinned page's checklist, and what occurred to him. */
export function hobbyDebriefHtml(d: { hobby?: HobbyResult; ideas?: string[] }): string {
  const out: string[] = [];
  if (d.hobby) {
    const r = d.hobby;
    const gene = r.gene ? geneById(r.gene) : null;
    out.push(`<div class="cp-label">HOBBY — ${esc(r.def.title)} (unofficial)</div>`,
      ...r.steps.map((g) => `<div class="cp-goal ${g.met ? 'met' : 'miss'}"><b>${g.met ? '✔' : '✘'}</b> ${esc(goalText(g))} — ${Math.round(g.value)}/${g.target}</div>`),
      r.met ? `<div class="cp-facts">It worked. ${gene ? `New gene: <b>${esc(gene.name)}</b> (${esc(gene.desc)})` : ''}</div>` : '<div class="cp-facts">Not this time. The page stays in the notebook.</div>');
  }
  if (d.ideas?.length) {
    out.push(`<div class="cp-facts">Occurred to him down there: ${d.ideas.map((id) => `<b>${esc(HOBBIES.find((h) => h.id === id)?.title ?? id)}</b>`).join(', ')} (the Notebook)</div>`);
  }
  return out.join('');
}
