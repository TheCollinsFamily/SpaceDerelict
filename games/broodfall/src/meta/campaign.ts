/**
 * THE CAMPAIGN — rules (no DOM; the ship screens and main.ts call these; the
 * browser keeps the state in localStorage). Design: DESIGN.md "THE CAMPAIGN";
 * inventory: notes/CAMPAIGN-BUILD-PLAN.md.
 *
 * Loop: the ship → pick a territory on the globe → briefing (board goals, dares,
 * an experiment, faction perks) → the deployment → debrief (credits, the territory,
 * faction beats, the colony's pushback) → the ship.
 */
import { Rng } from '../sim/rng';
import type { EnemyKind, OrganId, SimConfig, TowerFamily } from '../sim/types';
import {
  DARES, EXPERIMENTS, FACTIONS, HOME, LICENCE_STANDING, LINEAGES, LOGS_LOST, LOGS_WON, PROFILES,
  REQUISITIONS, TERRITORIES, BOARD_LETTERS,
  type BeatDef, type ExperimentDef, type FactionDef, type FactionId, type PerkId, type Scene, type TerritoryDef,
} from '../../content/campaign';
import { evaluate, instance, type GoalInstance, type GoalResult, type RunReport } from './goals';
import { queueDiscussion, type AiTrigger, type AiTurn } from './shipAi';
import { FIRST_MISSION, FIRST_MISSION_STANDING, deskOpen, isFirstMission, momentAfter, type Onboard } from './onboarding';
import type { GreetMoment } from '../../content/greetings';
import { applyOrders, ordersSetup, type OrdersReport, type OrdersState } from './directives';
import { applyHobby, giveGene, hobbyGoals, type HobbyResult, type HobbyState } from './hobby';
import type { HobbyDef } from '../../content/hobby';

export interface CampaignState {
  version: 1;
  seed: number;
  standing: number;
  notes: number;
  lineages: OrganId[];
  profiles: string[];
  profile: string;
  held: string[];
  revealed: string[];
  captures: number;
  deployments: number;
  /** The colony's telegraphed counter-attack on a territory you hold. */
  underAttack: string | null;
  faction: FactionId | null;
  /** Captures when you allied (beats count from here). */
  factionSince: number;
  contacted: FactionId[];
  beatsSeen: string[];
  choices: Record<string, string>;
  experimentsDone: string[];
  daresDone: string[];
  ended: FactionId | null;
  licence: boolean;
  /** Everything the ally has sent between beats, oldest first (optional: older saves have none). */
  comms?: string[];
  /** Scenes waiting to be shown on the ship (contacts, beats, endings). */
  pendingScenes: Array<{ faction: FactionId; beat?: string; scene: Scene; contact?: boolean; choice?: BeatDef['choice'] }>;
  ai: { queue: AiTrigger[]; seen: AiTrigger[]; transcripts: Array<{ trigger: AiTrigger; turns: AiTurn[] }> };
  log: string[];
  /** How far the campaign has unfolded (src/meta/onboarding.ts); none on saves from before it existed. */
  onboard?: Onboard;
  /** What YOKE greets him with when he next comes aboard (set by a deployment, used once). */
  greet?: GreetMoment | null;
  /** The greeting she said last (she never says the same one twice in a row). */
  lastGreeting?: string;
  /** Greetings said once in a campaign that are not said again (the mate review). */
  said?: string[];
  /** Command's standing orders (src/meta/directives.ts); none until the desk clears. */
  orders?: OrdersState;
  /** His notebook of hobby missions and the genes they paid (src/meta/hobby.ts); none until the desk clears. */
  hobby?: HobbyState;
}

/** `onboarding`: a campaign that unfolds (mission 1 first, the Directive Desk dark until a win); every new one the game starts is. */
export function newCampaign(seed: number, opts: { onboarding?: boolean } = {}): CampaignState {
  const start = (Object.entries(LINEAGES) as Array<[OrganId, { catalogue: string }]>)
    .filter(([, l]) => l.catalogue === 'start').map(([id]) => id);
  return {
    version: 1, seed, standing: 0, notes: 0, lineages: start, profiles: ['standard'], profile: 'standard',
    held: [HOME], revealed: [], captures: 0, deployments: 0, underAttack: null, faction: null, factionSince: 0,
    contacted: [], beatsSeen: [], choices: {}, experimentsDone: [], daresDone: [], ended: null, licence: false,
    pendingScenes: [], ai: { queue: [], seen: [], transcripts: [] },
    log: ['Personal log. Assigned to xenofauna clearance, sector 9. Asset BF-7 is cultured and viable. Here we go!'],
    ...(opts.onboarding ? { onboard: { mission1: 'pending' as const, deskOpen: false } } : {}),
  };
}

export const territory = (id: string): TerritoryDef => {
  const t = TERRITORIES.find((x) => x.id === id);
  if (!t) throw new Error(`no territory ${id}`);
  return t;
};
export const faction = (id: FactionId): FactionDef => FACTIONS.find((f) => f.id === id)!;

/** Perks from the beats of your faction you have reached. */
export function perksOf(s: CampaignState): PerkId[] {
  if (!s.faction) return [];
  const beats = faction(s.faction).beats.filter((b) => s.beatsSeen.includes(b.id));
  // A choice made at a beat adds the chosen option's perks (the Institute's ultimatum).
  const chosen = beats.flatMap((b) => b.choice?.options.find((o) => o.id === s.choices[b.id])?.perks ?? []);
  return [...beats.flatMap((b) => b.perks ?? []), ...chosen];
}

/** Highest evolution stage per theme: 1 everywhere, raised by the territories you hold. */
export function evolutionCaps(s: CampaignState): Record<string, number> {
  const caps: Record<string, number> = {};
  for (const th of ['core', 'forge', 'venom', 'gut', 'nerve', 'lattice', 'womb', 'marrow', 'resonance', 'catapult', 'runner', 'cage']) caps[th] = 1;
  for (const id of s.held) {
    for (const u of territory(id).unlocks) caps[u.theme] = Math.max(caps[u.theme] ?? 1, u.stage);
  }
  return caps;
}

/** Where you can land now: next to what you hold (anywhere with Seed Labs), your faction's finale at the end of its route. */
export function targets(s: CampaignState): TerritoryDef[] {
  if (s.ended) return [];
  const seed = perksOf(s).includes('seedlabs');
  return TERRITORIES.filter((t) => {
    if (s.held.includes(t.id)) return false;
    if (t.hidden && !s.revealed.includes(t.id)) return false;
    if (t.finaleOf) {
      if (t.finaleOf !== s.faction) return false;
      if (!faction(t.finaleOf).beats.every((b) => s.beatsSeen.includes(b.id))) return false;
    }
    return seed || t.neighbours.some((n) => s.held.includes(n));
  });
}

export function experimentsAvailable(s: CampaignState): ExperimentDef[] {
  return EXPERIMENTS.filter((e) => !s.experimentsDone.includes(e.id)
    && (e.requires?.captures ?? 0) <= s.captures
    && (!e.requires?.territory || s.held.includes(e.requires.territory)));
}

export interface DeploymentPlan {
  territory: string;
  defence: boolean;
  /** Mission 1 (src/meta/onboarding.ts): a plain tower-defence game, no board goals, no campaign on its screen. */
  first?: boolean;
  config: Partial<SimConfig>;
  board: GoalInstance[];
  dares: GoalInstance[];
  experiment?: { def: ExperimentDef; goal: GoalInstance };
  /** The hobby page pinned to this deployment (src/meta/hobby.ts): its checklist. */
  hobby?: { def: HobbyDef; goals: GoalInstance[] };
}

/** The three board goals for this deployment (seeded — the same briefing if you back out and return). */
export function boardFor(s: CampaignState, territoryId: string): GoalInstance[] {
  const t = territory(territoryId);
  const rng = new Rng(hash(`${s.seed}|${s.deployments}|${territoryId}`));
  const pool = [...REQUISITIONS];
  const out: GoalInstance[] = [];
  while (out.length < 3 && pool.length) out.push(instance(pool.splice(rng.int(0, pool.length - 1), 1)[0], t.tier));
  return out;
}

/** Everything the run needs: territory, board, dares, experiment, faction perks, profile, unlocks. */
export function plan(s: CampaignState, territoryId: string, opts: { dares?: string[]; experiment?: string; objectors?: EnemyKind[] } = {}): DeploymentPlan {
  const t = territory(territoryId);
  const first = isFirstMission(s) && territoryId === FIRST_MISSION;
  const defence = !first && s.held.includes(territoryId) && s.underAttack === territoryId;
  const perks = perksOf(s);
  const profile = PROFILES.find((p) => p.id === s.profile) ?? PROFILES[0];
  const objectorsAllowed = perks.includes('objectors2') ? 2 : perks.includes('objectors1') ? 1 : 0;
  const bonus: Partial<Record<'war' | 'science' | 'royal', number>> = {};
  if (perks.includes('volunteers1')) bonus.science = 30;
  if (perks.includes('volunteers2')) { bonus.war = 40; bonus.royal = 1; }
  if (perks.includes('kingdom')) bonus.royal = (bonus.royal ?? 0) + 1;
  const exp = !first && opts.experiment ? EXPERIMENTS.find((e) => e.id === opts.experiment) : undefined;
  // Command's equipment and trial lineage for the open standing orders; his pinned hobby page and spliced genes.
  const orders = first ? { config: {}, trial: [] } : ordersSetup(s);
  const hobby = first ? undefined : hobbyGoals(s);
  const config: Partial<SimConfig> = {
    seed: hash(`${s.seed}|${s.deployments}|${territoryId}|run`),
    organStage: true,
    organPool: [...s.lineages, ...orders.trial.filter((l) => !s.lineages.includes(l))],
    startOrgans: profile.organs,
    evolutionCap: evolutionCaps(s),
    // Mission 1 shows where the assault comes from, as any tower-defence game does; the campaign hides it (the Translator's perk).
    waveIntel: first || perks.includes('translator') ? 'full' : 'hidden',
    sleepers: perks.includes('sleepers2') ? 0.15 : perks.includes('sleepers1') ? 0.08 : 0,
    startBonus: bonus,
    bannedEnemies: (opts.objectors ?? []).slice(0, objectorsAllowed),
    waveScale: perks.includes('pacified') ? 0.9 : 1,
    entrances: t.entrances,
    directive: defence ? { kind: 'hold', waves: 5 } : t.directive,
    ...orders.config,
    ...(exp ? exp.setup : {}),
    ...(hobby?.def.setup ?? {}),
    ...(!first && s.hobby?.spliced.length ? { genes: [...s.hobby.spliced] } : {}),
    // Mission 1's first hand is the plain limbs a new player reads at a glance: shoot, or flail (Sep 30 2026).
    ...(first ? { firstHand: ['spitter', 'lasher'] as TowerFamily[] } : {}),
  };
  const dares = (opts.dares ?? []).slice(0, 2).map((id) => DARES.find((d) => d.id === id)!).filter(Boolean).map((d) => instance(d, t.tier));
  // Mission 1 carries no forms, no dares and no experiment: it is only a game of tower defence.
  if (first) return { territory: territoryId, defence: false, first: true, config, board: [], dares: [] };
  return {
    territory: territoryId, defence, config, board: boardFor(s, territoryId), dares,
    experiment: exp ? { def: exp, goal: instance(exp.goal, t.tier) } : undefined,
    hobby,
  };
}

export interface Debrief {
  board: GoalResult[];
  dares: GoalResult[];
  experiment?: GoalResult;
  standing: number;
  notes: number;
  captured: string | null;
  lost: string | null;
  repelled: string | null;
  unlocked: string[];
  log: string;
  /** The ally's letter / broadcast / call after this deployment. */
  aside?: string;
  /** It was mission 1. */
  first?: boolean;
  /** This deployment cleared the Directive Desk (and the three factions called). */
  deskOpened?: boolean;
  /** What this deployment did to Command's standing orders. */
  orders?: OrdersReport;
  /** The pinned hobby page's result. */
  hobby?: HobbyResult;
  /** Hobby pages that occurred to him this deployment. */
  ideas?: string[];
}

/** A faction's ending, as the choices made along its route shaped it. */
export function endingOf(f: FactionDef, s: CampaignState): Scene {
  const by = f.endingByChoice;
  return (by && by.scenes[s.choices[by.beat]]) || f.ending;
}

/** Apply a finished run to the campaign (returns the new state and what to show in the debrief). */
export function finish(prev: CampaignState, p: DeploymentPlan, r: RunReport): { state: CampaignState; debrief: Debrief } {
  const s: CampaignState = structuredClone(prev);
  const rng = new Rng(hash(`${s.seed}|${s.deployments}|after`));
  s.deployments += 1;
  const board = evaluate(p.board, r);
  const dares = evaluate(p.dares, r);
  const exp = p.experiment ? evaluate([p.experiment.goal], r)[0] : undefined;
  const standing = board.filter((g) => g.met).reduce((a, g) => a + g.def.pays, 0);
  let notes = dares.filter((g) => g.met).reduce((a, g) => a + g.def.pays, 0);
  const unlocked: string[] = [];
  let aside: string | undefined;
  for (const d of dares) if (d.met && !s.daresDone.includes(d.def.id)) s.daresDone.push(d.def.id);
  if (exp?.met && p.experiment) {
    notes += exp.def.pays;
    const e = p.experiment.def;
    if (!s.experimentsDone.includes(e.id)) s.experimentsDone.push(e.id);
    if (e.unlocks.lineage && !s.lineages.includes(e.unlocks.lineage)) { s.lineages.push(e.unlocks.lineage); unlocked.push(`lineage:${e.unlocks.lineage}`); }
    if (e.unlocks.territory && !s.revealed.includes(e.unlocks.territory)) { s.revealed.push(e.unlocks.territory); unlocked.push(`territory:${e.unlocks.territory}`); }
    if (e.unlocks.profile && !s.profiles.includes(e.unlocks.profile)) { s.profiles.push(e.unlocks.profile); unlocked.push(`profile:${e.unlocks.profile}`); }
    if (e.unlocks.gene && !(s.hobby?.genes ?? []).includes(e.unlocks.gene)) { Object.assign(s, giveGene(s, e.unlocks.gene)); unlocked.push(`gene:${e.unlocks.gene}`); }
  }
  // Feats that unlock profiles.
  if (s.daresDone.includes('everything-burns') && !s.profiles.includes('venom')) { s.profiles.push('venom'); unlocked.push('profile:venom'); }
  s.standing += standing;
  s.notes += notes;

  // Mission 1 (src/meta/onboarding.ts): the landing at the crash site. It takes no ground (the
  // crash site is the beachhead either way), queues no counter-attack and no faction; its data
  // pays a little standing, win or lose, and the ship is seen for the first time after it.
  if (p.first && s.onboard) {
    s.onboard.mission1 = r.won ? 'won' : 'lost';
    s.standing += FIRST_MISSION_STANDING;
    s.log.push(r.won ? 'First drop: the asset took the crash site and held it. The telemetry is extraordinary.' : 'First drop: the asset was lost at the crash site. The telemetry is still extraordinary.');
    if (s.deployments === 1) s.ai.queue = queueDiscussion(s.ai.queue, 'first-deployment', s.ai.seen);
    const debrief: Debrief = {
      board: [], dares: [], standing: FIRST_MISSION_STANDING, notes: 0, captured: null, lost: null, repelled: null,
      unlocked, log: s.log[s.log.length - 1], first: true,
    };
    s.greet = momentAfter(prev, s, debrief, true);
    return { state: s, debrief };
  }

  // The territory.
  let captured: string | null = null;
  let lost: string | null = null;
  let repelled: string | null = null;
  const t = territory(p.territory);
  if (p.defence) {
    if (r.won) repelled = p.territory;
    else { s.held = s.held.filter((h) => h !== p.territory); lost = p.territory; }
    s.underAttack = null;
  } else {
    // Deploying elsewhere while a territory was under attack: it falls.
    if (s.underAttack && s.underAttack !== p.territory) {
      s.held = s.held.filter((h) => h !== s.underAttack);
      lost = s.underAttack;
      s.underAttack = null;
    }
    if (r.won) {
      s.held.push(p.territory);
      s.captures += 1;
      captured = p.territory;
    }
  }
  // The first win that is not mission 1 clears the Directive Desk: from now on he picks his targets.
  let deskOpened = false;
  if (s.onboard && !s.onboard.deskOpen && r.won) {
    s.onboard.deskOpen = true;
    deskOpened = true;
    s.log.push('Command has cleared the Directive Desk. Targets are now at the discretion of the technician.');
  }
  s.log.push(`${(r.won ? LOGS_WON : LOGS_LOST)[rng.int(0, (r.won ? LOGS_WON : LOGS_LOST).length - 1)]} (${t.name})`);

  // The colony pushes back after you take new ground: a telegraphed counter-attack
  // on one of your territories (defend it next, or lose it).
  if (captured && !s.underAttack && s.captures >= 2 && !s.ended) {
    const exposed = s.held.filter((h) => h !== HOME && h !== captured && !territory(h).finaleOf);
    if (exposed.length) {
      const target = exposed[rng.int(0, exposed.length - 1)];
      if (perksOf(s).includes('garrison')) s.log.push(`The Faithful's militants held ${territory(target).name} against a counter-attack.`);
      else s.underAttack = target;
    }
  }

  // The factions: contacts, beats, the finale.
  // All three call at once, when the desk opens (Collins, Sep 30 2026: "that's also when you first
  // hear from each of the three factions"); a save from before the unfolding, at its first capture.
  if (!s.faction) {
    for (const f of FACTIONS) {
      if (deskOpen(s) && s.captures >= 1 && !s.contacted.includes(f.id)) {
        s.contacted.push(f.id);
        s.pendingScenes.push({ faction: f.id, scene: f.contact, contact: true });
      }
    }
  } else {
    const f = faction(s.faction);
    for (const b of f.beats) {
      if (s.beatsSeen.includes(b.id) || s.captures - s.factionSince < b.afterCaptures) continue;
      s.beatsSeen.push(b.id);
      s.pendingScenes.push({ faction: f.id, beat: b.id, scene: b.scene, choice: b.choice });
      if (b.id === 'reveal' || b.id === 'ultimatum' || b.id === 'prepare') s.ai.queue = queueDiscussion(s.ai.queue, 'midpoint', s.ai.seen);
    }
    // Between beats the ally keeps in touch: a letter, a broadcast, a call.
    if (!s.ended && f.asides.length) {
      s.comms = s.comms ?? [];
      aside = f.asides[asideIndex(s.seed, f.id, s.comms.length, f.asides.length)];
      s.comms.push(aside);
    }
    if (captured && t.finaleOf === f.id) {
      s.ended = f.id;
      s.pendingScenes.push({ faction: f.id, scene: endingOf(f, s) });
      // The reveal (DESIGN.md "The reveal"): the card after the ending.
      if (f.reveal) s.pendingScenes.push({ faction: f.id, scene: f.reveal });
      // and any card after it (the Director calls back: empire.md 12b)
      for (const scene of f.afterReveal ?? []) s.pendingScenes.push({ faction: f.id, scene });
      s.ai.queue = queueDiscussion(s.ai.queue, 'ending', s.ai.seen);
    }
  }

  // Command's standing orders and his own notebook (src/meta/directives.ts, src/meta/hobby.ts).
  let ordersReport: OrdersReport | undefined;
  let hobbyResult: HobbyResult | undefined;
  let ideas: string[] = [];
  if (deskOpen(s)) {
    const o = applyOrders(s, r, { territory: p.territory, directive: p.config.directive, captured, repelled, countable: deskOpen(prev) });
    Object.assign(s, o.state);
    ordersReport = o.report;
    const h = applyHobby(s, r, { first: false, open: true, deskJustOpened: deskOpened });
    Object.assign(s, h.state);
    hobbyResult = h.result;
    ideas = h.sparked;
  }

  // The licence and the Board.
  if (!s.licence && s.standing >= LICENCE_STANDING) {
    s.licence = true;
    s.log.push('The Board is pleased to APPROVE your procreation licence. Please collect it in person. The office is closed.');
    s.ai.queue = queueDiscussion(s.ai.queue, 'licence', s.ai.seen);
  } else if (standing > 0) {
    s.log.push(BOARD_LETTERS[rng.int(0, BOARD_LETTERS.length - 1)]);
  }
  if (s.deployments === 1) s.ai.queue = queueDiscussion(s.ai.queue, 'first-deployment', s.ai.seen);

  const debrief: Debrief = {
    board, dares, experiment: exp, standing, notes, captured, lost, repelled, unlocked, log: s.log[s.log.length - 1], aside, deskOpened,
    orders: ordersReport, hobby: hobbyResult, ideas,
  };
  s.greet = momentAfter(prev, s, debrief, false);
  return { state: s, debrief };
}

/** Ally with a faction (exclusive): its first beat plays at once. */
export function ally(prev: CampaignState, id: FactionId): CampaignState {
  const s: CampaignState = structuredClone(prev);
  if (s.faction) return s;
  s.faction = id;
  s.factionSince = s.captures;
  s.pendingScenes = s.pendingScenes.filter((p) => !p.contact);
  const first = faction(id).beats.find((b) => b.afterCaptures === 0);
  if (first) {
    s.beatsSeen.push(first.id);
    s.pendingScenes.push({ faction: id, beat: first.id, scene: first.scene, choice: first.choice });
  }
  s.ai.queue = queueDiscussion(s.ai.queue, 'faction-allied', s.ai.seen);
  return s;
}

/** Dismiss a contact without allying (it can be taken up later from Comms while you have no faction). */
export function dismissScene(prev: CampaignState): CampaignState {
  const s: CampaignState = structuredClone(prev);
  s.pendingScenes.shift();
  return s;
}

export function choose(prev: CampaignState, beatId: string, option: string): CampaignState {
  const s: CampaignState = structuredClone(prev);
  s.choices[beatId] = option;
  s.pendingScenes = s.pendingScenes.filter((p) => p.beat !== beatId);
  return s;
}

/** Buy a lineage with standing (sanctioned) or field notes (unsanctioned). */
export function buyLineage(prev: CampaignState, id: OrganId): { state: CampaignState; ok: boolean; err?: string } {
  const l = LINEAGES[id];
  if (!l || l.catalogue === 'start') return { state: prev, ok: false, err: 'not for sale' };
  if (prev.lineages.includes(id)) return { state: prev, ok: false, err: 'already yours' };
  const wallet = l.catalogue === 'sanctioned' ? prev.standing : prev.notes;
  if (wallet < l.price) return { state: prev, ok: false, err: l.catalogue === 'sanctioned' ? 'not enough standing' : 'not enough field notes' };
  const s: CampaignState = structuredClone(prev);
  if (l.catalogue === 'sanctioned') s.standing -= l.price; else s.notes -= l.price;
  s.lineages.push(id);
  return { state: s, ok: true };
}

export function selectProfile(prev: CampaignState, id: string): CampaignState {
  if (!prev.profiles.includes(id)) return prev;
  return { ...prev, profile: id };
}

/** A plain-language summary for the ship's AI. */
export function summaryFor(s: CampaignState): string {
  return [
    `Deployments: ${s.deployments}. Territories held: ${s.held.map((h) => territory(h).name).join(', ')}.`,
    `Faction: ${s.faction ? faction(s.faction).name : 'none'}. Standing ${s.standing}, field notes ${s.notes}.`,
    `Licence: ${s.licence ? 'approved' : 'pending'}. Experiments done: ${s.experimentsDone.join(', ') || 'none'}.`,
    // What a live YOKE (Kimi) needs to talk about the story so far; the scripted one ignores it.
    ...(s.faction ? [`Route so far: ${faction(s.faction).beats.filter((b) => s.beatsSeen.includes(b.id)).map((b) => b.title).join(' → ') || 'just allied'}.`] : []),
    ...(Object.keys(s.choices).length ? [`Choices made: ${Object.entries(s.choices).map(([b, o]) => `${b}=${o}`).join(', ')}.`] : []),
    ...(s.underAttack ? [`Under attack: ${territory(s.underAttack).name}.`] : []),
    ...(s.ended ? [`The campaign has ended on the ${faction(s.ended).name} route.`] : []),
    ...(s.comms?.length ? [`Latest from the ally: ${s.comms[s.comms.length - 1]}`] : []),
    ...(s.log.length ? [`Last log: ${s.log[s.log.length - 1]}`] : []),
  ].join(' ');
}

/**
 * Which of an ally's asides is the n-th one heard: a seeded order per pass through the list, so
 * every aside is heard once before any is heard twice, the order differs from campaign to campaign,
 * and a new pass never opens with the one that closed the last. Deterministic (the save replays).
 */
export function asideIndex(seed: number, factionId: string, n: number, len: number): number {
  if (len <= 1) return 0;
  const order = (round: number): number[] => {
    const rng = new Rng(hash(`${seed}|${factionId}|asides|${round}`));
    const o = Array.from({ length: len }, (_, i) => i);
    for (let i = len - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [o[i], o[j]] = [o[j], o[i]];
    }
    if (round > 0) {
      const last = order(round - 1)[len - 1];
      if (o[0] === last) [o[0], o[1]] = [o[1], o[0]];
    }
    return o;
  };
  return order(Math.floor(n / len))[n % len];
}

export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
