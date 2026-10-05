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
  REQUISITIONS, TERRITORIES, BOARD_LETTERS, MIDPOINT_CAPTURES, SWITCH_HEAD_START, LAST_MISSION,
  type BeatDef, type ExperimentDef, type FactionDef, type FactionId, type PerkId, type Scene, type TerritoryDef,
} from '../../content/campaign';
import { evaluate, instance, type GoalInstance, type GoalResult, type RunReport } from './goals';
import { queueDiscussion, type AiTrigger, type AiTurn } from './shipAi';
import { FIRST_MISSION, FIRST_MISSION_STANDING, deskOpen, isFirstMission, momentAfter, type Onboard } from './onboarding';
import type { GreetMoment } from '../../content/greetings';
import { applyOrders, ordersSetup, type OrdersReport, type OrdersState } from './directives';
import { applyHobby, giveGene, hobbyGoals, type HobbyResult, type HobbyState } from './hobby';
import type { HobbyDef } from '../../content/hobby';
import {
  clearAttack, defenceConfig, defenceMeat, forgetBoard, rememberBoard, resolveStaging, stageCounterAttack,
  type CounterAttack,
} from './defence';
import type { BoardSnapshot } from '../sim/boardSnapshot';
import { DEFENCE } from '../../content/defence';
import { ENEMIES, WAVE_TABLE } from '../../content/data';

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
  /** The colony's launched counter-attack on a territory you hold: defend it now, or lose it (src/meta/defence.ts). */
  underAttack: string | null;
  /** The colony massing for a counter-attack, drawn one deployment ahead (src/meta/defence.ts; none on older saves). */
  staging?: CounterAttack | null;
  /** Where the launched counter-attack came from (the globe's arrow). */
  attackFrom?: string | null;
  /** The boards remembered from wins, by territory: a defence is fought on its own (src/sim/boardSnapshot.ts). */
  boards?: Record<string, BoardSnapshot>;
  faction: FactionId | null;
  /** Captures when you allied (beats count from here). */
  factionSince: number;
  contacted: FactionId[];
  /**
   * The factions whose FIRST INTERACTION he has played (Collins, Oct 3 2026: "you can play through the first interaction
   * with any of the groups, after which you choose which one you want to publicly side with"). None on older saves.
   */
  met?: FactionId[];
  beatsSeen: string[];
  choices: Record<string, string>;
  experimentsDone: string[];
  daresDone: string[];
  /**
   * The ally whose FINALE has been played (its last landing taken, the creep reaching them, the archive): from then on
   * the only landing left is the last mission, against the Roach King (content/campaign.ts LAST_MISSION). None on saves
   * from before Oct 4 2026; one of those that had `ended` at the finale is given the last mission (`migrateFinale`).
   */
  finale?: FactionId | null;
  /** The campaign is over: the last mission is won (the route it was won on). */
  ended: FactionId | null;
  licence: boolean;
  /** Everything the ally has sent between beats, oldest first (optional: older saves have none). */
  comms?: string[];
  /**
   * The midpoint (content/campaign.ts MIDPOINT_CAPTURES): offered once, then stayed or switched.
   * Optional: older saves have none, and are offered it at their next return if they are past it.
   */
  midpoint?: { status: 'offered' | 'stayed' | 'switched'; at: number; from?: FactionId; to?: FactionId };
  /**
   * Scenes waiting to be shown on the ship (beats, finales; `offer`: a rival's offer at the midpoint; `meeting`: a first
   * interaction played from its signal before he has sided with anyone; `pledge`: his broadcast to the planet;
   * `contact`: only on saves from before Oct 3 2026, when the three called one after the other: dropped when read).
   */
  pendingScenes: Array<{ faction: FactionId; beat?: string; scene: Scene; contact?: boolean; offer?: boolean; meeting?: boolean; pledge?: boolean; choice?: BeatDef['choice'] }>;
  ai: { queue: AiTrigger[]; seen: AiTrigger[]; transcripts: Array<{ trigger: AiTrigger; turns: AiTurn[] }> };
  log: string[];
  /** How far the campaign has unfolded (src/meta/onboarding.ts); none on saves from before it existed. */
  onboard?: Onboard;
  /** What YOKE greets him with when he next comes aboard (set by a deployment, used once). */
  greet?: GreetMoment | null;
  /** The greeting she said last (she never says the same one twice in a row). */
  lastGreeting?: string;
  /** Every greeting YOKE has said this campaign: none is said again while she has one she has not (src/meta/onboarding.ts). */
  greetingsSaid?: string[];
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
    held: [HOME], revealed: [], captures: 0, deployments: 0, underAttack: null, staging: null, attackFrom: null, faction: null, factionSince: 0,
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
  // A choice made at a beat adds the chosen option's perks (no beat has a choice since Oct 3 2026; the rule stays).
  const chosen = beats.flatMap((b) => b.choice?.options.find((o) => o.id === s.choices[b.id])?.perks ?? []);
  // Staying loyal at the midpoint adds the ally's loyalty perk.
  const loyal = s.midpoint?.status === 'stayed' ? [faction(s.faction).midpoint.loyalPerk] : [];
  return [...beats.flatMap((b) => b.perks ?? []), ...chosen, ...loyal];
}

/** How many enemy kinds he may turn away before a deployment (the Delegation's Objectors, and its Pickets). */
export function objectorsAllowed(perks: PerkId[]): number {
  return (perks.includes('objectors2') ? 2 : perks.includes('objectors1') ? 1 : 0) + (perks.includes('pickets') ? 1 : 0);
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
  // After the ally's finale there is one landing left: the last mission (Collins: "each of their finales takes place
  // before the last mission against the roach king").
  if (s.finale) return TERRITORIES.filter((t) => t.last && !s.held.includes(t.id));
  const seed = perksOf(s).includes('seedlabs');
  return TERRITORIES.filter((t) => {
    if (s.held.includes(t.id) || t.last) return false;
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
export function boardFor(s: CampaignState, territoryId: string, only?: readonly string[]): GoalInstance[] {
  const t = territory(territoryId);
  const rng = new Rng(hash(`${s.seed}|${s.deployments}|${territoryId}`));
  // A defence offers only the forms one siege can meet (content/defence.ts).
  const pool = REQUISITIONS.filter((r) => !only || only.includes(r.id));
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
  const objectors = objectorsAllowed(perks);
  const bonus: Partial<Record<'war' | 'science' | 'royal', number>> = {};
  if (perks.includes('volunteers1')) bonus.science = 30;
  if (perks.includes('volunteers2')) { bonus.war = 40; bonus.royal = 1; }
  if (perks.includes('tithe')) bonus.war = (bonus.war ?? 0) + 40;
  if (perks.includes('retainer')) bonus.science = (bonus.science ?? 0) + 25;
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
    bannedEnemies: (opts.objectors ?? []).slice(0, objectors),
    waveScale: 1,
    entrances: t.entrances,
    directive: t.directive,
    ...orders.config,
    ...(exp ? exp.setup : {}),
    ...(hobby?.def.setup ?? {}),
    ...(!first && s.hobby?.spliced.length ? { genes: [...s.hobby.spliced] } : {}),
    // Mission 1's first hand is the plain limbs a new player reads at a glance: shoot, or flail (Sep 30 2026).
    ...(first ? { firstHand: ['spitter', 'lasher'] as TowerFamily[] } : {}),
    // A defence (src/meta/defence.ts): one all-out siege, a grown core, a full larder, the board won there.
    ...(defence ? { ...defenceConfig(s, territoryId), startBonus: defenceMeat(bonus) } : {}),
    // The last mission (content/campaign.ts LAST_MISSION): the Host is late, and a shelter by the body is his from the start.
    ...(t.last && !defence ? {
      lateHost: { turns: LAST_MISSION.turns, minTier: LAST_MISSION.minTier },
      startShelter: 'infested' as const,
      shelterRation: LAST_MISSION.ration,
    } : {}),
  };
  const dares = (opts.dares ?? []).slice(0, 2).map((id) => DARES.find((d) => d.id === id)!).filter(Boolean).map((d) => instance(d, t.tier));
  // Mission 1 carries no forms, no dares and no experiment: it is only a game of tower defence.
  if (first) return { territory: territoryId, defence: false, first: true, config, board: [], dares: [] };
  return {
    territory: territoryId, defence, config, board: boardFor(s, territoryId, defence ? DEFENCE.board : undefined), dares,
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
  /** The colony began massing for a counter-attack this deployment (drawn on the globe). */
  staged?: CounterAttack | null;
  /** He took the staging ground first: the counter-attack was called off. */
  preempted?: CounterAttack | null;
  /** The staged counter-attack was launched: defend it next, or lose it. */
  launched?: CounterAttack | null;
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

/**
 * THE POOL THE OBJECTORS PICK FROM (Collins, Oct 3 2026: the pick "shows at start of each mission and only shows a pool
 * of units that would have come on that mission"): the war kinds of the wave table's rows up to the one this landing
 * site's directive reaches. The sim's row follows its threat (kills, waves cleared, the body's growth), so the top row is
 * an estimate from the directive, one row above what the scripted player reached on three seeds of every landing site
 * (tools/measure/objector-pool.measure.ts, Oct 3 2026: a hold of 5 waves reached row 2, of 6 row 4, of 7 row 5, of 9 or
 * more row 6; a royal hunt row 6; a harvest anything from 2 to 6): it must never leave out a kind that came. So the pick is
 * short on the first missions (10 kinds of 21 on a 5-wave hold) and close to everything on the long ones, which is what
 * those missions really bring.
 */
export function objectorPool(territoryId: string, defence = false): EnemyKind[] {
  const dir = territory(territoryId).directive;
  const waves = defence ? 12 : !dir ? 12 : dir.kind === 'hold' ? dir.waves : 12;
  const top = Math.min(WAVE_TABLE.length - 1, POOL_TOP_ROW(waves));
  const war = new Set(ENEMIES.filter((e) => e.caste === 'war').map((e) => e.kind as string));
  const out: EnemyKind[] = [];
  for (let row = 0; row <= top; row++) for (const k of Object.keys(WAVE_TABLE[row])) if (war.has(k) && !out.includes(k as EnemyKind)) out.push(k as EnemyKind);
  return out;
}
/** The highest wave-table row a mission of this many waves reaches (measured; see objectorPool). */
const POOL_TOP_ROW = (waves: number): number => (waves <= 5 ? 3 : waves <= 6 ? 5 : 6);

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
    clearAttack(s);
  } else {
    // Deploying elsewhere while a territory was under attack: it falls.
    if (s.underAttack && s.underAttack !== p.territory) {
      s.held = s.held.filter((h) => h !== s.underAttack);
      lost = s.underAttack;
      clearAttack(s);
    }
    if (r.won) {
      s.held.push(p.territory);
      s.captures += 1;
      captured = p.territory;
    }
  }
  // The board he won on is remembered (a defence there is fought on it); ground lost is forgotten.
  if (r.won) rememberBoard(s, p.territory, r.board);
  if (lost) forgetBoard(s, lost);
  // A counter-attack staged last time: struck first, or launched now (src/meta/defence.ts).
  const { preempted, launched } = resolveStaging(s, captured);
  // The first win that is not mission 1 clears the Directive Desk: from now on he picks his targets.
  let deskOpened = false;
  if (s.onboard && !s.onboard.deskOpen && r.won) {
    s.onboard.deskOpen = true;
    deskOpened = true;
    s.log.push('Command has cleared the Directive Desk. Targets are now at the discretion of the technician.');
  }
  s.log.push(`${(r.won ? LOGS_WON : LOGS_LOST)[rng.int(0, (r.won ? LOGS_WON : LOGS_LOST).length - 1)]} (${t.name})`);

  // The colony pushes back after you take new ground: it MASSES first, on ground next to one of your
  // territories, drawn on the globe a whole deployment ahead (src/meta/defence.ts; Collins, Oct 1 2026).
  let staged: CounterAttack | null = null;
  if (captured && !s.underAttack && !s.staging && !preempted && s.captures >= 2 && !s.ended && !s.finale && !t.finaleOf) {
    const next = stageCounterAttack(s, captured, rng);
    if (next) {
      if (perksOf(s).includes('garrison')) s.log.push(`The Faithful's militants held ${territory(next.target).name} against a counter-attack.`);
      else {
        s.staging = next;
        staged = next;
        s.log.push(`The colony is massing at ${territory(next.from).name} to retake ${territory(next.target).name}. Strike ${territory(next.from).name} first to call it off.`);
      }
    }
  }

  // The factions: contacts, beats, the finale.
  // All three call at once, when the desk opens (Collins, Sep 30 2026: "that's also when you first
  // hear from each of the three factions"); a save from before the unfolding, at its first capture.
  // Since Oct 3 2026 they do not call one after the other: YOKE announces them (content/greetings.ts `unlock`), and each
  // is a signal on the planet at the Directive Desk, where its first interaction can be played (`meet`).
  if (!s.faction) {
    for (const f of FACTIONS) {
      if (deskOpen(s) && s.captures >= 1 && !s.contacted.includes(f.id)) s.contacted.push(f.id);
    }
  } else {
    const f = faction(s.faction);
    for (const b of f.beats) {
      if (s.beatsSeen.includes(b.id) || s.captures - s.factionSince < b.afterCaptures) continue;
      s.beatsSeen.push(b.id);
      s.pendingScenes.push({ faction: f.id, beat: b.id, scene: b.scene, choice: b.choice });
      if (b.id === 'reveal' || b.id === 'ultimatum' || b.id === 'prepare') s.ai.queue = queueDiscussion(s.ai.queue, 'midpoint', s.ai.seen);
    }
    // Between beats the ally keeps in touch: a letter, a broadcast, a call (until its finale: it is in the archive then).
    if (!s.ended && !s.finale && !(captured && t.finaleOf === f.id) && f.asides.length) {
      s.comms = s.comms ?? [];
      aside = f.asides[asideIndex(s.seed, f.id, s.comms.length, f.asides.length)];
      s.comms.push(aside);
    }
    if (captured && t.finaleOf === f.id) {
      // The finale (Collins, Oct 3 2026): the creep reaches them, they wake in the archive, and he tells them what a
      // broodfall is. It is the ally's ending and the reveal (DESIGN.md "The reveal") in one scene, and it comes BEFORE
      // the last mission against the Roach King, which is the only landing left from here.
      s.finale = f.id;
      s.pendingScenes.push({ faction: f.id, scene: f.ending });
      s.log.push('One landing is left: the Hive House. The President is giving a speech there.');
      // The ally he left at the midpoint writes once more.
      if (s.midpoint?.status === 'switched' && s.midpoint.from) {
        s.pendingScenes.push({ faction: s.midpoint.from, scene: faction(s.midpoint.from).midpoint.coda });
      }
      s.ai.queue = queueDiscussion(s.ai.queue, 'ending', s.ai.seen);
    }
    // The midpoint: the two other factions make their offers (once a campaign).
    if (!s.ended && !s.finale && !s.midpoint && s.captures - s.factionSince >= MIDPOINT_CAPTURES) {
      s.midpoint = { status: 'offered', at: s.captures };
      for (const rival of FACTIONS.filter((x) => x.id !== f.id)) {
        const scene = rival.midpoint.offers[f.id];
        if (!scene) continue;
        if (!s.contacted.includes(rival.id)) s.contacted.push(rival.id);
        s.pendingScenes.push({ faction: rival.id, scene, offer: true });
      }
      s.log.push(`The other two factions have made offers. ${f.name} does not know yet.`);
    }
  }

  // The last mission won: the campaign is over, on the route whose finale came before it.
  if (captured && t.last) {
    s.ended = s.finale ?? s.faction;
    s.log.push('The Hive House is quiet. So is the planet.');
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
    board, dares, experiment: exp, standing, notes, captured, lost, repelled, staged, preempted: preempted ?? null, launched: launched ?? null,
    unlocked, log: s.log[s.log.length - 1], aside, deskOpened,
    orders: ordersReport, hobby: hobbyResult, ideas,
  };
  s.greet = momentAfter(prev, s, debrief, false);
  return { state: s, debrief };
}

/**
 * A save from before the last mission existed (Oct 4 2026) ended at its ally's finale: it is given the last mission
 * instead of the end (nothing it had is lost: the finale stays seen). The browser's loader calls this.
 */
export function migrateFinale(s: CampaignState): CampaignState {
  if (s.ended && s.finale === undefined && !s.held.some((h) => TERRITORIES.find((t) => t.id === h)?.last)) {
    s.finale = s.ended;
    s.ended = null;
  }
  return s;
}

/** A faction's first interaction: the beat that plays before any territory is taken for it. */
export const firstBeat = (id: FactionId): BeatDef | undefined => faction(id).beats.find((b) => b.afterCaptures === 0);

/**
 * PLAY A FACTION'S FIRST INTERACTION from its signal on the planet, without siding with it (Collins, Oct 3 2026). It can
 * be played for any of the three, and again; it gives no perk until he sides with them (`ally`).
 */
export function meet(prev: CampaignState, id: FactionId): CampaignState {
  const s: CampaignState = structuredClone(prev);
  if (s.faction || s.ended || !s.contacted.includes(id)) return s;
  const first = firstBeat(id);
  if (!first) return s;
  s.pendingScenes = s.pendingScenes.filter((p) => !p.contact && !p.meeting);
  s.pendingScenes.unshift({ faction: id, beat: first.id, scene: first.scene, meeting: true });
  if (!(s.met ?? []).includes(id)) s.met = [...(s.met ?? []), id];
  return s;
}

/**
 * SIDE WITH A FACTION, PUBLICLY (exclusive). His broadcast to the planet plays (its `pledge`); its first interaction
 * plays before it if he has not played it yet; and that beat's perk starts.
 */
export function ally(prev: CampaignState, id: FactionId): CampaignState {
  const s: CampaignState = structuredClone(prev);
  if (s.faction) return s;
  s.faction = id;
  s.factionSince = s.captures;
  s.pendingScenes = s.pendingScenes.filter((p) => !p.contact && !p.meeting);
  if (!s.contacted.includes(id)) s.contacted.push(id);
  const first = firstBeat(id);
  if (first) {
    s.beatsSeen.push(first.id);
    if (!(s.met ?? []).includes(id)) s.pendingScenes.push({ faction: id, beat: first.id, scene: first.scene, choice: first.choice });
  }
  if (!(s.met ?? []).includes(id)) s.met = [...(s.met ?? []), id];
  s.pendingScenes.push({ faction: id, scene: faction(id).pledge, pledge: true });
  s.log.push(`Sided with ${faction(id).name}, publicly: a broadcast to the whole planet.`);
  s.ai.queue = queueDiscussion(s.ai.queue, 'faction-allied', s.ai.seen);
  return s;
}

/**
 * Go over to a rival at the midpoint. The old ally's perks go with it and its finale closes (the beats
 * he saw stay seen); it says goodbye in character. The new route starts SWITCH_HEAD_START captures in,
 * so the beats that are due play at once.
 */
export function switchAlly(prev: CampaignState, to: FactionId): CampaignState {
  const s: CampaignState = structuredClone(prev);
  const from = s.faction;
  if (!from || from === to || s.ended || s.midpoint?.status !== 'offered') return s;
  s.pendingScenes = s.pendingScenes.filter((p) => !p.offer);
  s.midpoint = { status: 'switched', at: s.midpoint.at, from, to };
  s.faction = to;
  s.factionSince = s.captures - SWITCH_HEAD_START;
  const bye = faction(from).midpoint.farewell[to];
  if (bye) s.pendingScenes.push({ faction: from, scene: bye });
  // Going over is public too: his broadcast for the new ally.
  s.pendingScenes.push({ faction: to, scene: faction(to).pledge, pledge: true });
  if (!(s.met ?? []).includes(to)) s.met = [...(s.met ?? []), to];
  for (const b of faction(to).beats) {
    if (s.beatsSeen.includes(b.id) || s.captures - s.factionSince < b.afterCaptures) continue;
    s.beatsSeen.push(b.id);
    s.pendingScenes.push({ faction: to, beat: b.id, scene: b.scene, choice: b.choice });
  }
  s.log.push(`Went over to ${faction(to).name}. ${faction(from).name} took it well. They always do.`);
  return s;
}

/** Turn both offers down at the midpoint: the ally hears of it, and adds its loyalty perk. */
export function stayLoyal(prev: CampaignState): CampaignState {
  const s: CampaignState = structuredClone(prev);
  if (!s.faction || s.midpoint?.status !== 'offered') return s;
  s.pendingScenes = s.pendingScenes.filter((p) => !p.offer);
  s.midpoint = { ...s.midpoint, status: 'stayed' };
  s.pendingScenes.push({ faction: s.faction, scene: faction(s.faction).midpoint.loyal });
  s.log.push(`Turned down both offers. Stayed with ${faction(s.faction).name}.`);
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
    ...(s.midpoint?.status === 'switched' && s.midpoint.from ? [`At the midpoint he left ${faction(s.midpoint.from).name} for ${faction(s.midpoint.to!).name}.`] : []),
    ...(s.midpoint?.status === 'stayed' ? ['At the midpoint the other two factions made him offers; he stayed with his ally.'] : []),
    ...(s.midpoint?.status === 'offered' ? ['The other two factions have just made him offers; he has not answered yet.'] : []),
    ...(s.underAttack ? [`Under attack: ${territory(s.underAttack).name}.`] : []),
    ...(s.finale && !s.ended ? [`${faction(s.finale).name} has had its finale: it is in the archive now. One landing is left, the Hive House, against the Roach King.`] : []),
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
