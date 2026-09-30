/**
 * THE END OF A RUN, IN PICTURES (Sep 30 2026). Every debrief — the skirmish's and the
 * campaign's — opens with what happened instead of a card of numbers:
 *
 *   - the newsreel still of the outcome (the town overrun, the growth burned, a counter-attack
 *     thrown back; tools/art/templates/screens.mjs), with the verdict set over it in type;
 *   - a photograph of the board itself, taken by the game the moment the run ended;
 *   - the limbs the body grew, each with its picture, how many stand at the end and what it killed;
 *   - what the colony sent, each kind with its picture and how many of it died.
 *
 * Every picture is optional: without the art, the same report is drawn with names and numbers.
 */
import { artUrl, loadManifest, type LimbArt, type UnitArt } from '../render/art';
import { loadScreenArt } from './screens';
import { towerSpec } from '../sim/sim';
import type { EnemyKind, RunStats, TowerFamily } from '../sim/types';

export type Outcome = 'won' | 'lost' | 'held';

export interface RunPictures {
  outcome: Outcome;
  /** The verdict set over the lead picture ("DIRECTIVE FULFILLED"). */
  verdict: string;
  /** One line under it: where, what. */
  caption: string;
  /** The board as it was when the run ended (a data URL), or null. */
  snapshot: string | null;
  stats: RunStats;
  /** The limbs standing at the end, by family. */
  standing: Partial<Record<TowerFamily, number>>;
  /** The four numbers of the run: [label, value]. */
  figures: Array<[string, string]>;
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const title = (kind: string) => kind.charAt(0).toUpperCase() + kind.slice(1);

/** One frame of an atlas as a CSS background `size` px square. */
function frameCss(atlas: string, frame: number, cols: number, i: number, size: number): string {
  const url = new URL(artUrl(atlas), document.baseURI).href;
  const k = size / frame;
  return `background-image:url('${url}');background-size:${cols * frame * k}px auto;background-position:-${(i % cols) * size}px -${Math.floor(i / cols) * size}px`;
}

function limbCss(a: LimbArt | undefined, size: number): string {
  return a ? frameCss(a.atlas, a.frame, a.cols, a.anims.idle.start, size) : '';
}

/** A unit seen from the front (walking toward the camera), its first frame. */
function unitCss(a: UnitArt | undefined, size: number): string {
  const clip = a?.anims.walk.S ?? (a ? Object.values(a.anims.walk)[0] : undefined);
  return a && clip ? frameCss(a.atlas, a.frame, a.cols, clip.start, size) : '';
}

/** The report's pictures, as one element to put at the head of either debrief. */
export async function debriefPictures(r: RunPictures): Promise<HTMLElement> {
  const [m, screens] = await Promise.all([loadManifest(), loadScreenArt()]);
  const el = document.createElement('div');
  el.className = `dbf dbf-${r.outcome}`;
  const lead = screens[r.outcome] ?? (r.outcome === 'held' ? screens.won : undefined);

  // The limbs: every family grown in this run, the ones that killed most first.
  const fams = [...new Set<TowerFamily>([...r.stats.families, ...(Object.keys(r.standing) as TowerFamily[])])]
    .sort((x, y) => (r.stats.killsByFamily[y] ?? 0) - (r.stats.killsByFamily[x] ?? 0));
  const limbs = fams.map((f) => {
    const kills = r.stats.killsByFamily[f] ?? 0;
    const stand = r.standing[f] ?? 0;
    return `<div class="dbf-tile${stand ? '' : ' gone'}" title="${esc(towerSpec(f).name)}: ${stand} standing at the end, ${kills} killed">
      <div class="dbf-pic" style="${limbCss(m?.limbs?.[f], 64)}"></div>
      <div class="dbf-name">${esc(towerSpec(f).name)}</div>
      <div class="dbf-num">${stand ? `${stand} standing` : 'none left'}${kills ? ` · <b>${kills}</b> kills` : ''}</div></div>`;
  }).join('');

  // What came: every kind that died, the most first.
  const kinds = (Object.entries(r.stats.kills) as Array<[EnemyKind, number]>).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]);
  const units = kinds.map(([k, n]) => `<div class="dbf-tile unit" title="${esc(title(k))}: ${n} killed">
      <div class="dbf-pic" style="${unitCss(m?.units?.[k], 64)}"></div>
      <div class="dbf-name">${esc(title(k))}</div>
      <div class="dbf-num"><b>${n}</b> dead</div></div>`).join('');
  const dead = kinds.reduce((s, [, n]) => s + n, 0);

  el.innerHTML = `
    <div class="dbf-lead${lead ? ' has-pic' : ''}"${lead ? ` style="--lead:url('${lead}')"` : ''}>
      <div class="dbf-verdict">${esc(r.verdict)}</div>
      <div class="dbf-caption">${esc(r.caption)}</div>
    </div>
    <div class="dbf-row">
      ${r.snapshot ? `<figure class="dbf-photo"><img src="${r.snapshot}" alt="The board when the run ended"><figcaption>THE FIELD AT THE END</figcaption></figure>` : ''}
      <div class="dbf-side">
        <div class="dbf-figures">${r.figures.map(([k, v]) => `<div><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>
        ${limbs ? `<div class="dbf-label">WHAT THE BODY GREW</div><div class="dbf-tiles">${limbs}</div>` : '<div class="dbf-label">THE BODY GREW NO LIMBS</div>'}
        ${units ? `<div class="dbf-label">WHAT THE COLONY SENT — ${dead} DEAD</div><div class="dbf-tiles">${units}</div>` : '<div class="dbf-label">NOTHING OF THE COLONY DIED</div>'}
      </div>
    </div>`;
  return el;
}
