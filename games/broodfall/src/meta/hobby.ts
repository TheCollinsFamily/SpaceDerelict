/**
 * HOBBY MISSIONS — the rules (no DOM; content/hobby.ts is the pages, src/ui/hobby.ts the notebook).
 * DESIGN.md "Hobby missions". Pure: every function takes a state and returns a new one.
 *
 *   spark   a finished deployment met a page's spark (or the desk cleared): the page is in the notebook
 *   pin     he pins one page to the next deployment (unpin, or pin another, any time on the ship)
 *   run     the page's setup goes into the deployment; its steps show on the board's goal list
 *   finish  every step met in that deployment: the page is done, its gene is his, the Office files a notice
 *   splice  two genes at a time go into the organism (every campaign deployment carries them)
 */
import { HOBBIES, HOBBY_NOTICE, HOBBY_SPLICE_SLOTS, type HobbyDef } from '../../content/hobby';
import { evaluate, instance, measure, type GoalInstance, type GoalResult, type RunReport } from './goals';
import type { CampaignState } from './campaign';

export interface HobbyState {
  /** Pages in the notebook (sparked), in the order they occurred to him. */
  ideas: string[];
  /** The page pinned to the next deployment. */
  pinned: string | null;
  done: string[];
  /** Genes he has (from pages, and the Puppet Queen experiment's). */
  genes: string[];
  /** Genes spliced into the organism (at most HOBBY_SPLICE_SLOTS). */
  spliced: string[];
  /** Pages tried and not finished, by id: how many times. */
  tries: Record<string, number>;
}

export interface HobbyResult {
  def: HobbyDef;
  steps: GoalResult[];
  met: boolean;
  gene: string | null;
}

export const hobbyDef = (id: string): HobbyDef | undefined => HOBBIES.find((h) => h.id === id);

export function hobbyOf(s: CampaignState): HobbyState {
  return s.hobby ?? { ideas: [], pinned: null, done: [], genes: [], spliced: [], tries: {} };
}

/** The pinned page's steps for this deployment (none on mission 1). */
export function hobbyGoals(s: CampaignState): { def: HobbyDef; goals: GoalInstance[] } | undefined {
  const h = s.hobby;
  const def = h?.pinned ? hobbyDef(h.pinned) : undefined;
  if (!def || h!.done.includes(def.id)) return undefined;
  return { def, goals: def.steps.map((g) => instance(g, 0)) };
}

/** Pages that occur to him: 'desk' pages when the desk clears; the rest when a deployment meets their spark. */
export function sparked(s: CampaignState, r: RunReport | null, deskJustOpened: boolean): string[] {
  const h = hobbyOf(s);
  return HOBBIES.filter((d) => !h.ideas.includes(d.id)).filter((d) => d.spark === 'desk'
    ? deskJustOpened
    : !!r && d.spark.some((sp) => measure(sp.measure, r) >= sp.target)).map((d) => d.id);
}

/** A finished deployment, applied to the notebook. `open`: the desk is open (pages are only kept from then on). */
export function applyHobby(prev: CampaignState, r: RunReport, opts: { first: boolean; open: boolean; deskJustOpened: boolean }): { state: CampaignState; result?: HobbyResult; sparked: string[] } {
  const s: CampaignState = structuredClone(prev);
  const h = hobbyOf(s);
  let result: HobbyResult | undefined;
  const run = !opts.first ? hobbyGoals(s) : undefined;
  if (run) {
    const steps = evaluate(run.goals, r);
    const met = steps.every((g) => g.met);
    let gene: string | null = null;
    if (met) {
      h.done.push(run.def.id);
      h.pinned = null;
      if (!h.genes.includes(run.def.gene)) {
        h.genes.push(run.def.gene);
        gene = run.def.gene;
        // A free slot takes it at once; otherwise it waits in the jar for him to swap.
        if (h.spliced.length < HOBBY_SPLICE_SLOTS) h.spliced.push(run.def.gene);
      }
      s.log.push(`Personal log. ${run.def.after}`);
      s.log.push(HOBBY_NOTICE);
    } else {
      h.tries[run.def.id] = (h.tries[run.def.id] ?? 0) + 1;
    }
    result = { def: run.def, steps, met, gene };
  }
  const news = opts.open ? sparked({ ...s, hobby: h }, r, opts.deskJustOpened || !prev.hobby) : [];
  for (const id of news) {
    h.ideas.push(id);
    const d = hobbyDef(id)!;
    s.log.push(d.sparkLog);
  }
  if (opts.open || s.hobby) s.hobby = h;
  return { state: s, result, sparked: news };
}

/** Pin a page to the next deployment (the same page again unpins it). */
export function pinHobby(prev: CampaignState, id: string): CampaignState {
  const h = structuredClone(hobbyOf(prev));
  if (!h.ideas.includes(id) || h.done.includes(id)) return prev;
  h.pinned = h.pinned === id ? null : id;
  return { ...prev, hobby: h };
}

/** Splice a gene he has into the organism, or take it out; a full organism swaps out the oldest. */
export function toggleSplice(prev: CampaignState, gene: string): CampaignState {
  const h = structuredClone(hobbyOf(prev));
  if (!h.genes.includes(gene)) return prev;
  if (h.spliced.includes(gene)) h.spliced = h.spliced.filter((g) => g !== gene);
  else { h.spliced.push(gene); while (h.spliced.length > HOBBY_SPLICE_SLOTS) h.spliced.shift(); }
  return { ...prev, hobby: h };
}

/** A gene given by something else (the Puppet Queen experiment's Royal Graft). */
export function giveGene(prev: CampaignState, gene: string): CampaignState {
  const h = structuredClone(hobbyOf(prev));
  if (h.genes.includes(gene)) return prev;
  h.genes.push(gene);
  if (h.spliced.length < HOBBY_SPLICE_SLOTS) h.spliced.push(gene);
  return { ...prev, hobby: h };
}
