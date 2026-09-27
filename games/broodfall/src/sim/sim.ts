/**
 * Broodfall sim core. Fixed-timestep, seeded, deterministic, zero rendering imports.
 *
 * The board is a real tower-defense map: streets are the corridors, buildings are
 * solid, enemies follow a flow field along roads toward the core, towers placed on
 * roads BLOCK (the swarm reroutes or chews through), and the creep spreads along
 * the street network, digesting adjacent buildings into buildable rubble.
 */
import { Rng } from './rng';
import {
  CellType, CityMap, DraftOffer, allDistance, computeFlow, createBoard,
  draftOffers, frontierGates, isPassable, slotOfCell, stampPlate,
} from './citymap';
import { GENES, PLATE_FEATURES } from '../../content/plates';
import {
  BALANCE as B, ENEMIES, ORGANS, TOWERS, WAVE_TABLE,
} from '../../content/data';
import type {
  Broodling, CardInstance, Caste, Command, CreepSource, Directive, Drop, Enemy, EnemyKind,
  EnemySpec, GlandMode, ModPip, Organ, OrganId, Outcome, Phase, Projectile, RootDir,
  SimConfig, SimEvent, Tower, TowerFamily, TowerSpec, Vec,
} from './types';

export const DT = 0.1;

const STRUCTURE_CONTACT = 24;    // px: latch-and-chew distance to a structure
const CORE_CONTACT = 46;         // px: latch distance to the core
const ENEMY_RADIUS = 8;
const SEPARATION_DIST = 13;      // px: enemies shoulder each other apart
const STRUCTURE_FLOW_COST = 400; // a tower on a road is a wall worth a 40-cell detour

function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function towerSpec(family: TowerFamily): TowerSpec {
  const s = TOWERS.find((t) => t.family === family);
  if (!s) throw new Error(`no tower spec: ${family}`);
  return s;
}

export function enemySpec(kind: EnemyKind): EnemySpec {
  const s = ENEMIES.find((e) => e.kind === kind);
  if (!s) throw new Error(`no enemy spec: ${kind}`);
  return s;
}

export function organSpec(id: OrganId) {
  const s = ORGANS.find((o) => o.id === id);
  if (!s) throw new Error(`no organ spec: ${id}`);
  return s;
}

/** Derived stats of a tower after its inheritance pips. Deterministic; no RNG. */
export function towerStats(t: Tower) {
  const spec = towerSpec(t.family);
  const pips = (f: TowerFamily) => t.pips.filter((p) => p.family === f).length;
  const tanglerPips = pips('tangler');
  const blighterPips = pips('blighter');
  return {
    rate: spec.rate * (1 + B.pipRate * pips('spitter')),
    damage: spec.damage * (1 + B.pipDamage * pips('lasher')),
    aoe: spec.aoe + B.pipAoe * pips('burster'),
    yieldMult: 1 + B.pipYield * pips('maw'),
    maxHp: spec.maxHp + B.pipHp * pips('spine'),
    interest: spec.interest + B.pipInterest * pips('lure') + B.interestPerPip * t.pips.length,
    range: spec.range * (1 + B.pipRange * pips('choir')),
    eatThreshold: spec.eatThreshold,
    // Hit effects: the tower's own, deepened by inherited pips.
    slowMult: Math.max(0.25, (spec.slowMult ?? 1) - B.pipSlow * tanglerPips),
    slowDur: Math.max(spec.slowDur ?? 0, tanglerPips > 0 ? B.pipSlowDur : 0),
    poisonDps: (spec.poisonDps ?? 0) + B.pipPoisonDps * blighterPips,
    poisonDur: Math.max(spec.poisonDur ?? 0, blighterPips > 0 ? B.pipPoisonDur : 0),
    capBonus: spec.pierce ? Infinity : B.pipPierceCap * pips('impaler'),
    pierce: spec.pierce ?? false,
    // Sling pip: the limb itself seeps creep onto its surroundings.
    seepRadius: B.pipSeep * pips('sling'),
    // Brood pip: living tissue — the limb regrows.
    regen: B.pipRegen * pips('brood'),
    // Pit pip: hits hard-root briefly (vs the tangler's long soft slow).
    rootDur: B.pipRoot * pips('pit'),
    // Frond: arcs off every hit; frond pips teach any limb to arc.
    chains: Math.min(B.maxChains, (spec.chains ?? 0) + B.pipChain * pips('frond')),
    // Lobber pip: hits knock the body back along the shot.
    knock: Math.min(B.maxKnock, B.pipKnock * pips('lobber')),
    // Mister: hits shred armor for everyone; mister pips teach it to any limb.
    shred: Math.min(B.maxShred, (spec.shred ?? 0) + B.pipShred * pips('mister')),
    shredDur: Math.max(spec.shredDur ?? 0, pips('mister') > 0 ? B.pipShredDur : 0),
    // Ocular pip: the limb learns priority targeting (supports first).
    sniper: (spec.sniper ?? false) || pips('ocular') > 0,
    // Focus-fire ramp per consecutive shot on one target: the prism's own
    // nature, and what a prism pip teaches any limb.
    streakRamp: (t.family === 'prism' ? B.prismRampPerHit : 0) + B.pipStreak * pips('prism'),
  };
}

export class Sim {
  readonly cfg: SimConfig;
  readonly worldW: number;
  readonly worldH: number;
  readonly core: Vec;
  readonly map: CityMap;

  private rng: Rng;
  private nextId = 1;
  private events: SimEvent[] = [];

  tickCount = 0;
  time = 0;
  outcome: Outcome = 'playing';

  meat: Record<Caste, number> = { war: 0, science: 0, royal: 0 };
  biomass = 0;
  coreHp: number = B.coreHp;
  coreMaxHp: number = B.coreHp;

  phase: Phase = 'growth';
  phaseElapsed = 0;
  waveNumber = 0;
  directive: Directive;
  /** Starting entrance count — the difficulty wager. More gates, richer meat. */
  entrances = 1;
  wavesCleared = 0;
  scienceBanked = 0;
  royalsKilled = 0;
  /** Total risk of the current/last wave (telegraphed danger number). */
  waveRisk = 0;

  private spawnQueue: EnemyKind[] = [];
  private spawnTimer = 0;
  /** Live frontier gates (ports facing unclaimed districts). */
  gates: number[] = [];
  /** Gates the NEXT assault will pour through — telegraphed during growth. */
  incomingGates: number[] = [];
  /** District draft on offer (phase === 'draft'). */
  pendingDraft: DraftOffer[] | null = null;
  private creepSurgePx = 0;
  private geneMods = {
    weightMult: {} as Partial<Record<TowerFamily, number>>,
    startWar: 0, startScience: 0, spineHpBonus: 0, mawEatBonus: 0, rangeMult: 1,
  };
  private researcherTimer = 20;
  private royalSpawned = false;

  private threatKills = 0;
  private threatChallenge = 0;

  towers: Tower[] = [];
  organs: Organ[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  drops: Drop[] = [];
  hand: CardInstance[] = [];
  /** Traits banked by butchering limbs; the NEXT build inherits and clears them. */
  pendingPips: ModPip[] = [];
  /** Creep origins besides the core: hurled patches, root lobes, seeping limbs. */
  creepSources: CreepSource[] = [];
  /** Per-source hop-distance maps (id -> BFS from its cell). */
  private sourceDist = new Map<number, Int32Array>();
  /** Creep clots in flight from a spore sling. */
  clotFlights: Array<{ id: number; from: Vec; to: Vec; cell: number; ttl: number }> = [];
  /** Bile globs in flight from an aimed lobber volley. */
  bileFlights: Array<{ id: number; from: Vec; to: Vec; cell: number; ttl: number }> = [];
  /** The mothers' spawn, fighting on your side in the streets. */
  broodlings: Broodling[] = [];
  /** Recent lightning arcs / sniper beams, for the renderer (fade fast). */
  arcs: Array<{ from: Vec; to: Vec; ttl: number }> = [];

  /** cell index -> structure ('t'|'o') + id */
  private occupied = new Map<number, { kind: 't' | 'o'; id: number }>();

  /** Flow field toward the core (enemy routing). Recomputed on map/structure change. */
  private flow: { dist: Float64Array; next: Int32Array };
  /** Hop-distance from the core over passable terrain (creep spread topology). */
  private creepDist: Int32Array;

  constructor(cfg: SimConfig) {
    this.cfg = cfg;
    this.worldW = cfg.gridW * cfg.cellPx;
    this.worldH = cfg.gridH * cfg.cellPx;
    this.rng = new Rng(cfg.seed);
    const slotsX = Math.floor(cfg.gridW / 10);
    const slotsY = Math.floor(cfg.gridH / 10);
    const startSlot = Math.floor((slotsY - 1) / 2) * slotsX + Math.floor(slotsX / 2);
    this.entrances = Math.max(1, Math.min(3, cfg.entrances ?? 1));
    this.map = createBoard(slotsX, slotsY, startSlot, this.rng, this.entrances);
    this.core = this.cellCenter(this.map.coreCell);
    this.gates = frontierGates(this.map);
    for (const id of cfg.genes ?? []) {
      const g = GENES.find((x) => x.id === id);
      if (!g) continue;
      for (const [fam, m] of Object.entries(g.weightMult ?? {})) {
        this.geneMods.weightMult[fam as TowerFamily] = (this.geneMods.weightMult[fam as TowerFamily] ?? 1) * (m as number);
      }
      this.geneMods.startWar += g.startWar ?? 0;
      this.geneMods.startScience += g.startScience ?? 0;
      this.geneMods.spineHpBonus += g.spineHpBonus ?? 0;
      this.geneMods.mawEatBonus += g.mawEatBonus ?? 0;
      this.geneMods.rangeMult *= g.rangeMult ?? 1;
    }
    this.directive = cfg.directive ?? this.rng.pick<Directive>([
      { kind: 'hold', waves: B.holdWaves },
      { kind: 'royal', count: 1 },
      { kind: 'harvest', science: B.harvestScience },
    ]);
    this.meat = { ...B.startMeat };
    this.meat.war += this.geneMods.startWar;
    this.meat.science += this.geneMods.startScience;
    this.creepDist = allDistance(this.map, this.map.coreCell);
    this.flow = this.computeFlowField();
    this.pickIncomingGates();
    while (this.hand.length < B.handSize) this.hand.push(this.drawCard());
  }

  // ---------- derived ----------

  /** Creep reach in px (grows over time; hearts accelerate it). */
  get creepRadius(): number {
    const hearts = this.organs.filter((o) => o.organ === 'heart').length;
    return B.creepBase + this.creepSurgePx
      + this.time * B.creepPerSec * (1 + B.creepPerHeartBonus * hearts);
  }

  get bodyRadius(): number {
    return B.bodyBase + this.biomass * B.bodyPerBiomass;
  }

  /** Creep reach in street-hops from the core. */
  get creepRangeCells(): number {
    return Math.floor(this.creepRadius / this.cfg.cellPx);
  }

  get bodyRangeCells(): number {
    return Math.max(1, Math.floor(this.bodyRadius / this.cfg.cellPx));
  }

  isCreeped(cell: number): boolean {
    const d = this.creepDist[cell];
    if (d >= 0 && d <= this.creepRangeCells) return true;
    for (const s of this.creepSources) {
      if (this.sourceCovers(s, cell)) return true;
    }
    return false;
  }

  /** Does one non-core creep source reach this cell right now? */
  private sourceCovers(s: CreepSource, cell: number): boolean {
    const dm = this.sourceDist.get(s.id);
    if (!dm) return false;
    const d = dm[cell];
    if (d < 0) return false;
    if (s.kind === 'patch') {
      const r = Math.min(B.slingPatchMax, s.radius + (this.time - s.bornAt) * B.slingPatchGrow);
      return d <= r;
    }
    if (s.kind === 'seep') return d <= s.radius;
    // Root: a small pad all around, plus a lobe that lengthens in its direction.
    if (d <= s.radius) return true;
    const len = Math.min(B.rootMaxLen, (this.time - s.bornAt) * B.rootGrowPerSec);
    if (len <= 0) return false;
    const w = this.cfg.gridW;
    const dx = (cell % w) - (s.cell % w);
    const dy = Math.floor(cell / w) - Math.floor(s.cell / w);
    const dir = s.dir ?? 'N';
    const inCone = dir === 'N' ? (dy < 0 && Math.abs(dx) <= -dy)
      : dir === 'S' ? (dy > 0 && Math.abs(dx) <= dy)
        : dir === 'E' ? (dx > 0 && Math.abs(dy) <= dx)
          : (dx < 0 && Math.abs(dy) <= -dx);
    return inCone && d <= s.radius + len;
  }

  private addCreepSource(kind: CreepSource['kind'], cell: number, radius: number, dir?: RootDir, ownerId?: number): CreepSource {
    const s: CreepSource = { id: this.nextId++, kind, cell, bornAt: this.time, radius, dir, ownerId };
    this.creepSources.push(s);
    this.sourceDist.set(s.id, allDistance(this.map, cell));
    return s;
  }

  private removeCreepSourcesOf(ownerId: number): void {
    this.creepSources = this.creepSources.filter((s) => {
      if (s.ownerId !== ownerId) return true;
      this.sourceDist.delete(s.id);
      return false;
    });
  }

  isBody(cell: number): boolean {
    const d = this.creepDist[cell];
    return d >= 0 && d <= this.bodyRangeCells;
  }

  flowDistOf(cell: number): number {
    return this.flow.dist[cell];
  }

  creepDistOf(cell: number): number {
    return this.creepDist[cell];
  }

  flowNextOf(cell: number): number {
    return this.flow.next[cell];
  }

  get interest(): number {
    let n = B.baseInterest;
    for (const s of this.map.slots) if (s && s.feature === 'science') n += 3;
    for (const t of this.towers) n += towerStats(t).interest;
    for (const o of this.organs) {
      if (o.organ === 'brain') n += B.brainInterest;
      if (o.organ === 'gland' && o.glandMode === 'lure') n += B.glandLureInterestBonus;
    }
    return n;
  }

  get threat(): number {
    return this.threatKills + this.threatChallenge
      + this.wavesCleared * B.threatPerWaveCleared
      + this.biomass * B.threatFromBiomass;
  }

  /** The wager payoff: +25% meat per extra starting entrance. */
  get entranceMeatMult(): number {
    return 1 + 0.25 * (this.entrances - 1);
  }

  get tier(): number {
    const t = Math.floor(this.threat / B.threatPerTier);
    // The last row is the hive's desperation — gated behind real escalation,
    // not something a standard hold order walks into by wave 11.
    if (t >= WAVE_TABLE.length - 1 && this.threat < B.tier6Threat) return WAVE_TABLE.length - 2;
    return Math.min(WAVE_TABLE.length - 1, t);
  }

  /** towerStats plus genes plus high-ground reach plus choir auras for THIS sim's board. */
  statsOf(t: Tower) {
    const s = towerStats(t);
    const h = this.map.heights[t.cell] || 1;
    s.range = s.range * this.geneMods.rangeMult * (1 + B.heightRangeBonus * (h - 1));
    s.maxHp += t.family === 'spine' ? this.geneMods.spineHpBonus : 0;
    s.eatThreshold += t.family === 'maw' ? this.geneMods.mawEatBonus : 0;
    if (s.rate > 0) {
      let choirs = 0;
      for (const c of this.towers) {
        if (c.family !== 'choir' || c.id === t.id) continue;
        const spec = towerSpec('choir');
        if (dist(c.pos, t.pos) <= (spec.auraRadius ?? 0)) choirs++;
      }
      // Two voices at most: stacking a whole chapel on one limb is not a build.
      s.rate *= 1 + (towerSpec('choir').rateAura ?? 0) * Math.min(choirs, 2);
    }
    return s;
  }

  private glandMode(): GlandMode {
    const g = this.organs.find((o) => o.organ === 'gland');
    return g ? g.glandMode : 'calm';
  }

  /** Directive progress as { done, goal } for the HUD bar and tests. */
  directiveProgress(): { done: number; goal: number } {
    const d = this.directive;
    if (d.kind === 'hold') return { done: this.wavesCleared, goal: d.waves };
    if (d.kind === 'royal') return { done: this.royalsKilled, goal: d.count };
    return { done: Math.min(this.scienceBanked, d.science), goal: d.science };
  }

  private checkDirective(): void {
    if (this.outcome !== 'playing') return;
    const p = this.directiveProgress();
    if (p.done >= p.goal) {
      this.outcome = 'won';
      this.events.push({ kind: 'won' });
    }
  }

  takeEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---------- grid ----------

  cellIndex(cx: number, cy: number): number {
    return cy * this.cfg.gridW + cx;
  }

  cellCenter(cell: number): Vec {
    const cx = cell % this.cfg.gridW;
    const cy = Math.floor(cell / this.cfg.gridW);
    return { x: (cx + 0.5) * this.cfg.cellPx, y: (cy + 0.5) * this.cfg.cellPx };
  }

  cellAt(x: number, y: number): number {
    const cx = Math.max(0, Math.min(this.cfg.gridW - 1, Math.floor(x / this.cfg.cellPx)));
    const cy = Math.max(0, Math.min(this.cfg.gridH - 1, Math.floor(y / this.cfg.cellPx)));
    return this.cellIndex(cx, cy);
  }

  isOccupied(cell: number): boolean {
    return this.occupied.has(cell);
  }

  /**
   * Towers perch on creeped CITY BLOCKS, out of the enemy channels — reading
   * which block covers the most path legs is the game. The one exception is
   * the spine wall, which is placed IN a street to be chewed through.
   */
  canBuildTower(cell: number, family?: TowerFamily): boolean {
    if (this.isOccupied(cell) || cell === this.map.coreCell || !this.isCreeped(cell)) return false;
    const t = this.map.cells[cell];
    if (family === 'spine') return t === CellType.Road || t === CellType.Block;
    if (family === 'pit') return t === CellType.Road; // a pit only makes sense IN the traffic
    return t === CellType.Block;
  }

  /** Organs grow on the open plaza ground inside the body — in harm's way. */
  canBuildOrgan(cell: number): boolean {
    return this.map.cells[cell] === CellType.Plaza
      && this.isBody(cell)
      && !this.isOccupied(cell)
      && cell !== this.map.coreCell;
  }

  canAfford(cost: Partial<Record<Caste, number>>): boolean {
    return (['war', 'science', 'royal'] as Caste[]).every(
      (c) => this.meat[c] >= (cost[c] ?? 0),
    );
  }

  private pay(cost: Partial<Record<Caste, number>>): void {
    for (const c of ['war', 'science', 'royal'] as Caste[]) {
      this.meat[c] -= cost[c] ?? 0;
    }
  }

  private computeFlowField() {
    return computeFlow(this.map, this.map.coreCell, (cell) => {
      const s = this.occupied.get(cell);
      if (!s) return 0;
      // A digestive pit is a floor, not a wall: the column walks straight onto it.
      if (s.kind === 't' && this.towers.find((t) => t.id === s.id)?.family === 'pit') return 0;
      return STRUCTURE_FLOW_COST;
    });
  }

  private refreshRouting(): void {
    this.routeCache.clear();
    this.dangerMap = null;
    this.flow = this.computeFlowField();
    this.creepDist = allDistance(this.map, this.map.coreCell);
    // The map may have grown: recompute every source's reach over the new terrain,
    // and rebuild the seep sources from limbs carrying sling pips.
    this.creepSources = this.creepSources.filter((s) => {
      if (s.kind === 'seep') { this.sourceDist.delete(s.id); return false; }
      return true;
    });
    for (const s of this.creepSources) this.sourceDist.set(s.id, allDistance(this.map, s.cell));
    for (const t of this.towers) {
      const seep = towerStats(t).seepRadius;
      if (seep > 0) this.addCreepSource('seep', t.cell, seep, undefined, t.id);
    }
  }

  // ---------- cards ----------

  private drawCard(): CardInstance {
    const brains = this.organs.filter((o) => o.organ === 'brain').length;
    const spec = this.rng.weighted(TOWERS, (t) =>
      t.weight
      * (this.geneMods.weightMult[t.family] ?? 1)
      * (t.advanced && brains > 0 ? B.brainAdvancedWeightMult ** Math.min(brains, 2) : 1),
    );
    return { id: this.nextId++, family: spec.family };
  }

  /** Current draw weight per family (for the HUD odds inspector and tests). */
  drawWeights(): Record<TowerFamily, number> {
    const brains = this.organs.filter((o) => o.organ === 'brain').length;
    const out = {} as Record<TowerFamily, number>;
    for (const t of TOWERS) {
      out[t.family] = t.weight
        * (this.geneMods.weightMult[t.family] ?? 1)
        * (t.advanced && brains > 0 ? B.brainAdvancedWeightMult ** Math.min(brains, 2) : 1);
    }
    return out;
  }

  // ---------- commands ----------

  issue(cmd: Command): { ok: boolean; err?: string } {
    if (this.outcome !== 'playing') return { ok: false, err: 'game over' };
    switch (cmd.kind) {
      case 'build': {
        const card = this.hand[cmd.cardIndex];
        if (!card) return { ok: false, err: 'no such card' };
        const spec = towerSpec(card.family);
        if (!this.canBuildTower(cmd.cell, card.family)) return { ok: false, err: 'cell not buildable' };
        if (cmd.cannibalizeTowerId !== undefined) {
          // Legacy atomic path (autoplayer/tests): butcher-then-build in one command.
          const donor = this.towers.find((t) => t.id === cmd.cannibalizeTowerId);
          if (!donor) return { ok: false, err: 'no such donor' };
          const salv = this.salvageOf(donor.family);
          const affordable = (['war', 'science', 'royal'] as Caste[]).every(
            (c) => this.meat[c] + (salv[c] ?? 0) >= (spec.cost[c] ?? 0),
          );
          if (!affordable) return { ok: false, err: 'cannot afford' };
          this.butcherTower(donor);
        }
        if (!this.canAfford(spec.cost)) return { ok: false, err: 'cannot afford' };
        const pips = this.pendingPips;
        this.pendingPips = [];
        if (pips.length > 0) {
          this.events.push({ kind: 'cannibalized', donor: pips[pips.length - 1].family, into: card.family });
        }
        this.pay(spec.cost);
        const pos = this.cellCenter(cmd.cell);
        const tower: Tower = {
          id: this.nextId++, family: card.family, pos, cell: cmd.cell,
          hp: spec.maxHp, maxHp: spec.maxHp, pips, cooldown: 0, kills: 0,
        };
        tower.maxHp = this.statsOf(tower).maxHp;
        tower.hp = tower.maxHp;
        this.towers.push(tower);
        this.occupied.set(cmd.cell, { kind: 't', id: tower.id });
        this.refreshRouting();
        this.hand.splice(cmd.cardIndex, 1);
        this.hand.push(this.drawCard());
        this.events.push({ kind: 'built', family: card.family, pips: pips.length });
        return { ok: true };
      }
      case 'butcher': {
        const donor = this.towers.find((t) => t.id === cmd.towerId);
        if (!donor) return { ok: false, err: 'no such tower' };
        this.butcherTower(donor);
        return { ok: true };
      }
      case 'set-priority': {
        const t = this.towers.find((x) => x.id === cmd.towerId);
        if (!t) return { ok: false, err: 'no such tower' };
        if (cmd.mode) t.priority = cmd.mode;
        if (cmd.caste) t.casteFocus = cmd.caste;
        t.lastTargetId = undefined;
        t.streak = 0;
        return { ok: true };
      }
      case 'build-organ': {
        const spec = organSpec(cmd.organ);
        if (!this.canBuildOrgan(cmd.cell)) return { ok: false, err: 'cell not in body' };
        if (!this.canAfford(spec.cost)) return { ok: false, err: 'cannot afford' };
        this.pay(spec.cost);
        const pos = this.cellCenter(cmd.cell);
        const organ: Organ = {
          id: this.nextId++, organ: cmd.organ, pos, cell: cmd.cell,
          hp: spec.maxHp, maxHp: spec.maxHp, glandMode: 'calm',
        };
        this.organs.push(organ);
        this.occupied.set(cmd.cell, { kind: 'o', id: organ.id });
        if (cmd.organ === 'root') {
          // Default the lobe toward the nearest frontier gate; click to re-aim.
          let dir: RootDir = 'N';
          let best = Infinity;
          for (const gate of this.gates) {
            const g = this.cellCenter(gate);
            const d = dist(pos, g);
            if (d < best) {
              best = d;
              const dx = g.x - pos.x;
              const dy = g.y - pos.y;
              dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
            }
          }
          organ.rootDir = dir;
          this.addCreepSource('root', cmd.cell, B.rootBaseRadius, dir, organ.id);
        }
        this.refreshRouting();
        this.events.push({ kind: 'organ-built', organ: cmd.organ });
        return { ok: true };
      }
      case 'cycle-gland': {
        const g = this.organs.find((o) => o.id === cmd.organInstanceId && o.organ === 'gland');
        if (!g) return { ok: false, err: 'no such gland' };
        g.glandMode = g.glandMode === 'calm' ? 'lure' : g.glandMode === 'lure' ? 'challenge' : 'calm';
        return { ok: true };
      }
      case 'cycle-root': {
        const o = this.organs.find((x) => x.id === cmd.organInstanceId && x.organ === 'root');
        if (!o) return { ok: false, err: 'no such root' };
        const order: RootDir[] = ['N', 'E', 'S', 'W'];
        o.rootDir = order[(order.indexOf(o.rootDir ?? 'N') + 1) % 4];
        const src = this.creepSources.find((s) => s.kind === 'root' && s.ownerId === o.id);
        if (src) src.dir = o.rootDir;
        return { ok: true };
      }
      case 'sling-throw': {
        const t = this.towers.find((x) => x.id === cmd.towerId && x.family === 'sling');
        if (!t) return { ok: false, err: 'no such sling' };
        if (t.cooldown > 0) return { ok: false, err: 'sling recharging' };
        if (this.map.cells[cmd.cell] === CellType.Void) return { ok: false, err: 'unclaimed city' };
        const to = this.cellCenter(cmd.cell);
        if (dist(t.pos, to) > B.slingRange) return { ok: false, err: 'out of range' };
        t.cooldown = B.slingCooldown;
        this.clotFlights.push({
          id: this.nextId++, from: { ...t.pos }, to, cell: cmd.cell, ttl: B.clotFlightSeconds,
        });
        this.events.push({ kind: 'clot-hurled', cell: cmd.cell });
        return { ok: true };
      }
      case 'bile-throw': {
        const t = this.towers.find((x) => x.id === cmd.towerId && x.family === 'lobber');
        if (!t) return { ok: false, err: 'no such lobber' };
        if (t.cooldown > 0) return { ok: false, err: 'lobber recharging' };
        if (this.map.cells[cmd.cell] === CellType.Void) return { ok: false, err: 'unclaimed city' };
        const to = this.cellCenter(cmd.cell);
        if (dist(t.pos, to) > B.lobberRange) return { ok: false, err: 'out of range' };
        t.cooldown = B.lobberCooldown;
        this.bileFlights.push({
          id: this.nextId++, from: { ...t.pos }, to, cell: cmd.cell, ttl: B.bileFlightSeconds,
        });
        return { ok: true };
      }
      case 'royal-surge': {
        if (this.meat.royal < B.royalSurgeCost) return { ok: false, err: 'cannot afford' };
        this.meat.royal -= B.royalSurgeCost;
        this.biomass += B.royalSurgeBiomass;
        return { ok: true };
      }
      case 'choose-plate': {
        if (this.phase !== 'draft' || !this.pendingDraft) return { ok: false, err: 'no draft open' };
        const offer = this.pendingDraft[cmd.index];
        if (!offer) return { ok: false, err: 'no such offer' };
        stampPlate(this.map, offer.pattern, offer.slot, offer.feature, this.rng);
        this.pendingDraft = null;
        this.creepSurgePx += B.draftCreepSurge;
        this.gates = frontierGates(this.map);
        this.refreshRouting();
        this.phase = 'growth';
        this.phaseElapsed = 0;
        this.pickIncomingGates();
        this.events.push({
          kind: 'plate-drafted',
          name: PLATE_FEATURES[offer.feature].name,
          feature: offer.feature,
        });
        return { ok: true };
      }
      case 'call-early': {
        if (this.phase !== 'growth') return { ok: false, err: 'no wave to call' };
        const bonus = Math.floor((B.growthSeconds - this.phaseElapsed) * B.callEarlyRate);
        if (bonus > 0) this.meat.war += bonus;
        this.startSiege();
        return { ok: true };
      }
      case 'discard': {
        const card = this.hand[cmd.cardIndex];
        if (!card) return { ok: false, err: 'no such card' };
        if (this.meat.war < B.discardCost) return { ok: false, err: 'cannot afford' };
        this.meat.war -= B.discardCost;
        this.hand.splice(cmd.cardIndex, 1);
        this.hand.push(this.drawCard());
        this.events.push({ kind: 'discarded', family: card.family });
        return { ok: true };
      }
    }
  }

  /** What eating a limb of this family pays back toward the next build. */
  salvageOf(family: TowerFamily): Partial<Record<Caste, number>> {
    const cost = towerSpec(family).cost;
    const out: Partial<Record<Caste, number>> = {};
    for (const c of ['war', 'science', 'royal'] as Caste[]) {
      if (cost[c]) out[c] = Math.floor((cost[c] ?? 0) * B.salvageRate);
    }
    return out;
  }

  /**
   * Eat a limb on the spot: its salvage is credited immediately and its whole
   * trait history (plus itself) is banked for the next build. Butchering twice
   * before building stacks the traits — a two-course meal.
   */
  private butcherTower(donor: Tower): void {
    const salv = this.salvageOf(donor.family);
    let refund = 0;
    for (const c of ['war', 'science', 'royal'] as Caste[]) {
      this.meat[c] += salv[c] ?? 0;
      refund += salv[c] ?? 0;
    }
    this.pendingPips = [...this.pendingPips, ...donor.pips, { family: donor.family }];
    this.removeTower(donor.id, false);
    this.events.push({ kind: 'butchered', family: donor.family, refund });
  }

  private removeTower(id: number, emit: boolean): void {
    const i = this.towers.findIndex((t) => t.id === id);
    if (i < 0) return;
    const t = this.towers[i];
    this.occupied.delete(t.cell);
    this.towers.splice(i, 1);
    if (t.family === 'brood') {
      // The brood does not outlive its mother.
      this.broodlings = this.broodlings.filter((b) => b.motherId !== id);
    }
    this.refreshRouting();
    for (const e of this.enemies) {
      if (!e.targetIsOrgan && e.targetId === id) e.targetId = null;
    }
    if (emit) this.events.push({ kind: 'structure-lost', what: towerSpec(t.family).name });
  }

  private removeOrgan(id: number): void {
    const i = this.organs.findIndex((o) => o.id === id);
    if (i < 0) return;
    const o = this.organs[i];
    this.occupied.delete(o.cell);
    this.organs.splice(i, 1);
    this.removeCreepSourcesOf(id); // a dead root's lobe withers
    this.refreshRouting();
    for (const e of this.enemies) {
      if (e.targetIsOrgan && e.targetId === id) e.targetId = null;
    }
    this.events.push({ kind: 'structure-lost', what: organSpec(o.organ).name });
  }

  // ---------- spawning ----------

  gateSide(gate: number): 'N' | 'S' | 'E' | 'W' {
    const c = this.cellCenter(gate);
    const dx = c.x - this.core.x;
    const dy = c.y - this.core.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'E' : 'W';
    return dy > 0 ? 'S' : 'N';
  }

  /** The hive masses its response on specific approaches; the player sees it coming. */
  private pickIncomingGates(): void {
    const lanes = this.tier >= 4 ? 3 : this.tier >= 2 ? 2 : 1;
    const picked: number[] = [];
    const sides = new Set<string>();
    let guard = 0;
    while (picked.length < Math.min(lanes, this.gates.length) && guard++ < 60) {
      const g = this.gates[this.rng.int(0, this.gates.length - 1)];
      const side = this.gateSide(g);
      if (picked.includes(g)) continue;
      if (sides.has(side) && guard < 30) continue; // spread lanes across sides first
      picked.push(g);
      sides.add(side);
    }
    this.incomingGates = picked;
  }

  private spawnEnemy(kind: EnemyKind, atGate?: number): Enemy {
    const spec = enemySpec(kind);
    const gate = atGate ?? this.gates[this.rng.int(0, this.gates.length - 1)];
    const c = this.cellCenter(gate);
    const e: Enemy = {
      id: this.nextId++, kind,
      pos: { x: c.x + this.rng.float(-6, 6), y: c.y + this.rng.float(-6, 6) },
      hp: spec.hp, maxHp: spec.hp, targetId: null, targetIsOrgan: false,
      attackCooldown: 0, studyLeft: kind === 'researcher' ? B.studySeconds : 0,
      leaving: false,
    };
    if (spec.tunneler) {
      // Dives underground at the gate; resurfaces PAST the outer gun line.
      e.burrowed = true;
      const d = this.flow.dist[gate];
      e.surfaceFlowDist = Number.isFinite(d) ? d * B.tunnelerSurfaceFrac : 12;
    }
    if (spec.hitShield) e.hitShield = spec.hitShield;
    this.enemies.push(e);
    return e;
  }

  /** Spawn a minion at an exact spot (a consort's retinue growing mid-march). */
  private spawnMinion(kind: EnemyKind, at: Vec): Enemy {
    const spec = enemySpec(kind);
    const e: Enemy = {
      id: this.nextId++, kind,
      pos: { x: at.x + this.rng.float(-8, 8), y: at.y + this.rng.float(-8, 8) },
      hp: spec.hp, maxHp: spec.hp, targetId: null, targetIsOrgan: false,
      attackCooldown: 0, studyLeft: 0, leaving: false,
    };
    if (spec.hitShield) e.hitShield = spec.hitShield;
    this.enemies.push(e);
    return e;
  }

  private startSiege(): void {
    this.phase = 'siege';
    this.phaseElapsed = 0;
    this.waveNumber += 1;
    const comp = WAVE_TABLE[this.tier];
    const scale = 1 + this.wavesCleared * B.waveCountScale;
    this.spawnQueue = [];
    const counts: Partial<Record<EnemyKind, number>> = {};
    let waveRisk = 0;
    for (const [kind, n] of Object.entries(comp)) {
      // THE RISK LAW: the clock multiplies cheap ranks at full rate, risky
      // specialists slowly (riskBaseline/risk of it). Escalation stays "more
      // bodies + higher types" without ever becoming eight sappers eating the
      // player's board — the rejected investment-destruction in uniform.
      const spec = enemySpec(kind as EnemyKind);
      const growth = 1 + (scale - 1) * (B.riskBaseline / spec.risk);
      const scaled = Math.round((n ?? 0) * growth);
      counts[kind as EnemyKind] = scaled;
      waveRisk += scaled * spec.risk;
      for (let i = 0; i < scaled; i++) this.spawnQueue.push(kind as EnemyKind);
    }
    this.waveRisk = waveRisk;
    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
    }
    this.spawnTimer = 0;
    const sides = [...new Set(this.incomingGates.map((g) => this.gateSide(g)))].join('+');
    this.events.push({ kind: 'wave-start', tier: this.tier, wave: this.waveNumber, counts, sides, risk: waveRisk });
  }

  // ---------- tick ----------

  tick(): void {
    if (this.outcome !== 'playing') return;
    if (this.phase === 'draft') return; // the world holds its breath while you choose
    this.tickCount += 1;
    this.time += DT;
    this.phaseElapsed += DT;

    const hearts = this.organs.filter((o) => o.organ === 'heart').length;
    this.biomass += (B.biomassBase + hearts * B.biomassPerHeart) * DT;

    if (this.glandMode() === 'challenge') this.threatChallenge += B.glandChallengeThreatPerSec * DT;

    // Phase machine.
    if (this.phase === 'growth') {
      if (this.phaseElapsed >= B.growthSeconds) this.startSiege();
    } else {
      if (this.spawnQueue.length > 0) {
        this.spawnTimer -= DT;
        if (this.spawnTimer <= 0) {
          // Squads: a column of several at once per lane, then a beat of quiet.
          this.spawnTimer = B.squadInterval;
          const lane = this.incomingGates[this.rng.int(0, this.incomingGates.length - 1)];
          for (let k = 0; k < B.squadSize && this.spawnQueue.length > 0; k++) {
            this.spawnEnemy(this.spawnQueue.pop()!, lane);
          }
        }
      }
      const hostiles = this.enemies.some((e) => e.kind !== 'researcher');
      if ((this.spawnQueue.length === 0 && !hostiles) || this.phaseElapsed > B.siegeMaxSeconds) {
        this.phaseElapsed = 0;
        this.wavesCleared += 1;
        const bonus = Math.round((B.waveBonusBase + this.waveNumber * B.waveBonusPerWave) * this.entranceMeatMult);
        this.meat.war += bonus;
        this.events.push({ kind: 'wave-cleared', wave: this.waveNumber, bonus });
        this.checkDirective();
        if (this.outcome !== 'playing') return;
        // Every few cleared waves: the body is ready to grow into a new district.
        if (this.wavesCleared % B.draftEveryWaves === 0) {
          const offers = draftOffers(this.map, this.rng, 3);
          if (offers.length > 0) {
            this.phase = 'draft';
            this.pendingDraft = offers;
            this.events.push({ kind: 'draft-open' });
            return;
          }
        }
        this.phase = 'growth';
        this.pickIncomingGates();
      }
    }

    // Researchers, drawn by interest — only while the streets are quiet,
    // so sieges stay discrete, legible events.
    if (this.phase === 'growth') this.researcherTimer -= DT;
    if (this.researcherTimer <= 0) {
      const interval = Math.max(
        B.researcherMinInterval,
        B.researcherBaseInterval / (1 + this.interest / 10),
      );
      this.researcherTimer = interval;
      if (this.interest > 0) {
        const n = this.rng.int(2, 4);
        for (let i = 0; i < n; i++) this.spawnEnemy('researcher');
        // A famous specimen attracts the unscrupulous too: past a fame
        // threshold, a thief slips in with every study party.
        if (this.interest >= B.thiefInterestMin) this.spawnEnemy('thief');
        this.events.push({ kind: 'researchers-arrive', count: n });
      }
    }

    // Royal event.
    const royalDue = this.threat >= B.royalThreat
      || (this.directive.kind === 'royal' && this.waveNumber >= B.royalGuaranteeWave);
    if (this.phase === 'siege' && !this.royalSpawned && royalDue) {
      this.royalSpawned = true;
      const lane = this.incomingGates[0] ?? this.gates[0];
      this.spawnEnemy('royal', lane);
      this.spawnEnemy('consort', lane); // the retinue breeds as it marches
      for (let i = 0; i < B.royalEscort; i++) this.spawnEnemy('elite', lane);
      this.events.push({ kind: 'royal-incoming' });
    }

    this.updateCoreAttack();
    this.updateEnemies();
    this.updateBroodlings();
    this.updateTowers();
    this.updateProjectiles();
    this.updateDrops();
    this.updateClots();
    this.updateBiles();
    for (const a of this.arcs) a.ttl -= DT;
    this.arcs = this.arcs.filter((a) => a.ttl > 0);

    if (this.coreHp <= 0) {
      this.outcome = 'lost';
      this.events.push({ kind: 'lost' });
    }
  }

  /** The body defends itself: focused damage to the nearest intruder inside reach. */
  private updateCoreAttack(): void {
    let target: Enemy | null = null;
    let bestD = this.bodyRadius * B.coreReachScale;
    for (const e of this.enemies) {
      // Science-caste visitors are not combatants; the body saves its venom.
      if (enemySpec(e.kind).caste === 'science' || e.burrowed) continue;
      const d = dist(e.pos, this.core);
      if (d <= bestD) { bestD = d; target = e; }
    }
    if (target) this.damageEnemy(target, B.coreDps * DT, 1);
  }

  // ---------- movement ----------

  private structureOn(cell: number): { kind: 't' | 'o'; id: number } | undefined {
    return this.occupied.get(cell);
  }

  /** Center of a passable cell adjacent to this one (where a broodling can stand). */
  private passableNear(cell: number): Vec | null {
    const w = this.cfg.gridW;
    for (const nb of [cell + w, cell - w, cell - 1, cell + 1]) {
      if (nb < 0 || nb >= this.map.cells.length) continue;
      if (isPassable(this.map.cells[nb])) return this.cellCenter(nb);
    }
    return null;
  }

  /** Nearest limb or organ within a radius (sappers hunt these across blocks). */
  private nearestStructure(p: Vec, within: number): { kind: 't' | 'o'; id: number } | null {
    let best: { kind: 't' | 'o'; id: number } | null = null;
    let bestD = within;
    for (const t of this.towers) {
      const d = dist(p, t.pos);
      if (d < bestD) { bestD = d; best = { kind: 't', id: t.id }; }
    }
    for (const o of this.organs) {
      const d = dist(p, o.pos);
      if (d < bestD) { bestD = d; best = { kind: 'o', id: o.id }; }
    }
    return best;
  }

  private structurePos(s: { kind: 't' | 'o'; id: number }): Vec | null {
    const obj = s.kind === 't'
      ? this.towers.find((t) => t.id === s.id)
      : this.organs.find((o) => o.id === s.id);
    return obj ? obj.pos : null;
  }

  /** Straight-line movement for climbers and fliers: terrain does not apply. */
  private stepUnconstrained(e: Enemy, target: Vec, speed: number): void {
    const d = dist(e.pos, target);
    if (d < 0.5) return;
    e.pos.x += ((target.x - e.pos.x) / d) * speed * DT;
    e.pos.y += ((target.y - e.pos.y) / d) * speed * DT;
  }

  /** Fliers keep loose formation on their own (no ground separation for them). */
  private aheadCheckSeparationless(_e: Enemy): void { /* intentionally nothing */ }

  /** Move a body toward a point, clamped so it never enters a building cell. */
  private stepConstrained(e: { pos: Vec }, target: Vec, speed: number): void {
    const d = dist(e.pos, target);
    if (d < 0.5) return;
    const nx = e.pos.x + ((target.x - e.pos.x) / d) * speed * DT;
    const ny = e.pos.y + ((target.y - e.pos.y) / d) * speed * DT;
    const inBounds = (x: number, y: number) =>
      x >= 2 && y >= 2 && x <= this.worldW - 2 && y <= this.worldH - 2;
    const passAt = (x: number, y: number) =>
      inBounds(x, y) && isPassable(this.map.cells[this.cellAt(x, y)]);
    if (passAt(nx, ny)) {
      e.pos.x = nx; e.pos.y = ny;
    } else if (passAt(nx, e.pos.y)) {
      e.pos.x = nx; // slide along the wall
    } else if (passAt(e.pos.x, ny)) {
      e.pos.y = ny;
    }
    // else: fully cornered; stand (the flow field will route them next tick)
  }

  /** Enemies shoulder each other apart so columns read as columns, not a stack. */
  private applySeparation(): void {
    const n = this.enemies.length;
    for (let i = 0; i < n; i++) {
      const a = this.enemies[i];
      if (enemySpec(a.kind).flies || a.burrowed) continue;
      for (let j = i + 1; j < n; j++) {
        const b = this.enemies[j];
        if (enemySpec(b.kind).flies || b.burrowed) continue;
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.001 && d < SEPARATION_DIST) {
          const push = ((SEPARATION_DIST - d) / d) * 0.5;
          const tryShift = (e: Enemy, sx: number, sy: number) => {
            const x = e.pos.x + sx;
            const y = e.pos.y + sy;
            if (x >= 2 && y >= 2 && x <= this.worldW - 2 && y <= this.worldH - 2
              && isPassable(this.map.cells[this.cellAt(x, y)])) {
              e.pos.x = x; e.pos.y = y;
            }
          };
          tryShift(a, -dx * push, -dy * push);
          tryShift(b, dx * push, dy * push);
        }
      }
    }
  }

  /** Effective speed: base, times an active snare slow, times a war-drummer's beat. */
  moveSpeedOf(e: Enemy): number {
    const spec = enemySpec(e.kind);
    let s = spec.speed;
    if (e.slowUntil !== undefined && e.slowUntil > this.time && e.slowMult !== undefined) {
      s *= e.slowMult;
    }
    if (e.kind !== 'researcher') {
      for (const d of this.enemies) {
        if (d === e || d.burrowed || !enemySpec(d.kind).speedAura) continue;
        if (dist(d.pos, e.pos) <= B.drummerRadius) { s *= B.drummerSpeedMult; break; }
      }
    }
    return s;
  }

  /**
   * Statuses landing on a hit. Stacking rules (the combination algebra):
   * slows keep the STRONGEST and the longest clock; poison ADDS and refreshes,
   * capped; shred keeps the DEEPEST cut and refreshes; a root is just a very
   * strong slow, so it composes through the same rule.
   */
  private applyHitEffects(
    e: Enemy,
    fx: {
      slowMult: number; slowDur: number; poisonDps: number; poisonDur: number;
      shred?: number; shredDur?: number; rootDur?: number;
    },
  ): void {
    let slowMult = fx.slowMult;
    let slowDur = fx.slowDur;
    if (fx.rootDur && fx.rootDur > 0) {
      // Hard root: ~zero speed beats any soft slow via the strongest-wins rule.
      slowMult = Math.min(slowMult, 0.05);
      slowDur = Math.max(slowDur, fx.rootDur);
    }
    if (slowMult < 1 && slowDur > 0) {
      const active = e.slowUntil !== undefined && e.slowUntil > this.time;
      e.slowMult = active && e.slowMult !== undefined ? Math.min(e.slowMult, slowMult) : slowMult;
      e.slowUntil = Math.max(active ? e.slowUntil ?? 0 : 0, this.time + slowDur);
    }
    if (fx.poisonDps > 0 && fx.poisonDur > 0) {
      const active = e.poisonUntil !== undefined && e.poisonUntil > this.time;
      e.poisonDps = Math.min(B.maxPoisonDps, (active ? e.poisonDps ?? 0 : 0) + fx.poisonDps);
      e.poisonUntil = this.time + fx.poisonDur;
    }
    if (fx.shred && fx.shred > 0 && fx.shredDur && fx.shredDur > 0) {
      const active = e.shredUntil !== undefined && e.shredUntil > this.time;
      e.shredAmount = Math.min(B.maxShred, Math.max(active ? e.shredAmount ?? 0 : 0, fx.shred));
      e.shredUntil = this.time + fx.shredDur;
    }
  }

  /** The bomber's whole job: area damage to STRUCTURES, then it is gone. */
  private detonateBomber(e: Enemy): void {
    for (const t of [...this.towers]) {
      if (dist(e.pos, t.pos) <= B.bomberBlastRadius) {
        t.hp -= B.bomberBlastDamage;
        if (t.hp <= 0) this.removeTower(t.id, true);
      }
    }
    for (const o of [...this.organs]) {
      if (dist(e.pos, o.pos) <= B.bomberBlastRadius) {
        o.hp -= B.bomberBlastDamage;
        if (o.hp <= 0) this.removeOrgan(o.id);
      }
    }
    if (dist(e.pos, this.core) <= B.bomberBlastRadius + 30) this.coreHp -= B.bomberBlastDamage;
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
  }

  /** Living royal-presence sources this tick (royal, consort). */
  private auraSources: Enemy[] = [];
  /** Route fields toward specific cells (collectors walking to a limb), keyed by cell. */
  private routeCache = new Map<number, { dist: Float64Array; next: Int32Array }>();

  /** War bodies near a living royal hit harder. Royals themselves are simply strong. */
  empowerOf(e: Enemy): number {
    if (this.auraSources.length === 0 || enemySpec(e.kind).caste !== 'war') return 1;
    for (const r of this.auraSources) {
      if (r !== e && dist(r.pos, e.pos) <= B.royalAuraRadius) return B.royalAuraDamageMult;
    }
    return 1;
  }

  private inRoyalAura(e: Enemy): boolean {
    return this.empowerOf(e) > 1;
  }

  /** A passable cell a walker can stand on to reach this limb (or the limb's own street cell). */
  private standCellFor(cell: number): number {
    if (isPassable(this.map.cells[cell])) return cell;
    const w = this.cfg.gridW;
    for (const nb of [cell + w, cell - w, cell - 1, cell + 1]) {
      if (nb >= 0 && nb < this.map.cells.length && isPassable(this.map.cells[nb])) return nb;
    }
    return -1;
  }

  /** Gun coverage per cell: summed dps of every armed limb that can reach it. */
  private dangerMap: Float64Array | null = null;

  dangerAt(cell: number): number {
    if (!this.dangerMap) {
      const n = this.map.cells.length;
      const m = new Float64Array(n);
      const w = this.cfg.gridW;
      const cp = this.cfg.cellPx;
      for (const t of this.towers) {
        const st = this.statsOf(t);
        if (st.rate <= 0 || st.damage <= 0) continue;
        const dps = st.damage * st.rate;
        const reach = Math.min(st.range, 160); // a board-wide eye still only "watches" nearby
        const rc = Math.ceil(reach / cp);
        const tx = t.cell % w;
        const ty = Math.floor(t.cell / w);
        for (let dy = -rc; dy <= rc; dy++) {
          for (let dx = -rc; dx <= rc; dx++) {
            const x = tx + dx;
            const y = ty + dy;
            if (x < 0 || y < 0 || x >= w || y >= this.cfg.gridH) continue;
            if (Math.hypot(dx, dy) * cp > reach) continue;
            m[y * w + x] += dps;
          }
        }
      }
      this.dangerMap = m;
    }
    return this.dangerMap[cell];
  }

  /**
   * The science caste's read of your defense: the reachable limb whose
   * approach is least covered by your guns. Ties go to the periphery.
   */
  vulnerableTower(): Tower | null {
    let best: Tower | null = null;
    let bestKey = Infinity;
    for (const t of this.towers) {
      const stand = this.standCellFor(t.cell);
      if (stand < 0) continue;
      const key = this.dangerAt(stand) * 1000 - this.creepDist[t.cell];
      if (key < bestKey || (key === bestKey && best !== null && t.id < best.id)) { bestKey = key; best = t; }
    }
    return best;
  }

  /** Smart route to a cell: streets under fire cost more, so they walk the gaps. */
  private routeTo(cell: number): { dist: Float64Array; next: Int32Array } {
    let r = this.routeCache.get(cell);
    if (!r) {
      r = computeFlow(this.map, cell, (c) =>
        (this.occupied.has(c) && c !== cell ? STRUCTURE_FLOW_COST : 0) + this.dangerAt(c) * B.dangerWeight);
      this.routeCache.set(cell, r);
    }
    return r;
  }

  /** Step along the smart route toward a cell. */
  private walkSmart(e: Enemy, goal: number, fallback: Vec, speed: number): void {
    const here = this.cellAt(e.pos.x, e.pos.y);
    const next = this.routeTo(goal).next[here];
    if (here === goal || next < 0) this.stepConstrained(e, fallback, speed);
    else this.stepConstrained(e, this.cellCenter(next), speed);
  }

  /**
   * Science caste default: probe for the weakest point, route around the guns,
   * sedate that limb and carry it off. With nothing worth taking they fall back
   * to studying the creep edge and leaving.
   */
  private updateScience(e: Enemy, spec: EnemySpec): void {
    const speed = this.moveSpeedOf(e);
    if (e.leaving) {
      this.leaveField(e, speed);
      return;
    }
    let prey = e.extractId !== undefined ? this.towers.find((t) => t.id === e.extractId) : undefined;
    if (!prey) {
      prey = this.vulnerableTower() ?? undefined;
      e.extractId = prey?.id;
    }
    if (!prey) {
      this.updateResearcher(e, spec);
      return;
    }
    if (dist(e.pos, prey.pos) <= B.scienceReach) {
      prey.hp -= B.scienceExtractDps * DT;
      if (prey.hp <= 0) {
        e.carrying = {
          family: prey.family, pips: [...prey.pips], cell: prey.cell,
          priority: prey.priority, casteFocus: prey.casteFocus,
        };
        this.removeTower(prey.id, false);
        e.extractId = undefined;
        e.leaving = true;
        this.events.push({ kind: 'tower-stolen', family: e.carrying.family });
      }
      return;
    }
    this.walkSmart(e, this.standCellFor(prey.cell), prey.pos, speed);
  }

  /** Consort promotion ladder: the nearest war body steps up one rank. */
  private static readonly PROMOTION: Partial<Record<EnemyKind, EnemyKind>> = {
    skitterling: 'militia', responder: 'militia', militia: 'soldier', soldier: 'elite',
  };

  private promoteNear(c: Enemy): void {
    let best: Enemy | null = null;
    let bestD: number = B.royalAuraRadius;
    for (const o of this.enemies) {
      if (o === c || o.burrowed || !Sim.PROMOTION[o.kind]) continue;
      const d = dist(o.pos, c.pos);
      if (d <= bestD) { bestD = d; best = o; }
    }
    if (!best) return;
    const from = best.kind;
    const to = Sim.PROMOTION[from]!;
    const frac = best.hp / best.maxHp;
    best.kind = to;
    best.maxHp = enemySpec(to).hp;
    best.hp = Math.max(1, frac * best.maxHp);
    this.events.push({ kind: 'promoted', from, to });
  }

  private updateEnemies(): void {
    this.auraSources = this.enemies.filter((x) => enemySpec(x.kind).royalAura && !x.burrowed);
    for (const e of [...this.enemies]) {
      const spec = enemySpec(e.kind);

      // Blight keeps eating whoever carries it (and slips under armor plates).
      if (e.poisonUntil !== undefined && e.poisonUntil > this.time && e.poisonDps) {
        e.hp -= e.poisonDps * DT;
        if (e.hp <= 0) { this.killEnemy(e.id, 1, false); continue; }
      }

      if (spec.stealsLimbs) {
        this.updateScience(e, spec);
        continue;
      }

      // Science-caste thief: sneaks to the creep, grabs banked war meat, flees.
      // Kill it before it slips off the field and the meat comes home.
      if (spec.thief) {
        const tSpeed = this.moveSpeedOf(e);
        if (e.leaving) {
          this.leaveField(e, tSpeed);
          continue;
        }
        const cell = this.cellAt(e.pos.x, e.pos.y);
        if (this.isCreeped(cell)) {
          const amt = Math.min(Math.floor(this.meat.war), B.thiefSteal);
          if (amt > 0) {
            this.meat.war -= amt;
            e.stole = amt;
            this.events.push({ kind: 'meat-stolen', amount: amt });
          }
          e.leaving = true;
          continue;
        }
        // Smart like the rest of its caste: slip in where your guns aren't.
        const weak = this.vulnerableTower();
        const goal = weak ? this.standCellFor(weak.cell) : -1;
        if (goal >= 0) {
          this.walkSmart(e, goal, weak!.pos, tSpeed);
        } else {
          const nxt = this.flow.next[cell];
          if (nxt >= 0) this.stepConstrained(e, this.cellCenter(nxt), tSpeed);
          else this.stepConstrained(e, this.core, tSpeed);
        }
        continue;
      }

      const speed = this.moveSpeedOf(e);

      // Royal consort: promotes the nearest war body one rank on a pulse.
      if (spec.promotes) {
        e.auxCooldown = (e.auxCooldown ?? 0) - DT;
        if (e.auxCooldown <= 0) {
          e.auxCooldown = spec.promotes.interval;
          this.promoteNear(e);
        }
      }

      // Tunnelers travel under the streets, untargetable, and surface past the outer guns.
      if (e.burrowed) {
        const cell = this.cellAt(e.pos.x, e.pos.y);
        const d = this.flow.dist[cell];
        if (Number.isFinite(d) && d <= (e.surfaceFlowDist ?? 0)) {
          e.burrowed = false;
        } else {
          const nxt = this.flow.next[cell];
          if (nxt >= 0) this.stepConstrained(e, this.cellCenter(nxt), speed);
          else this.stepConstrained(e, this.core, speed);
          continue;
        }
      }

      // Tenders drum out a heal pulse as they march.
      if (spec.healer) {
        e.auxCooldown = (e.auxCooldown ?? 0) - DT;
        if (e.auxCooldown <= 0 && spec.rate > 0) {
          e.auxCooldown = 1 / spec.rate;
          for (const o of this.enemies) {
            if (o === e || o.kind === 'researcher' || o.hp >= o.maxHp) continue;
            if (dist(e.pos, o.pos) <= B.tenderRadius) {
              o.hp = Math.min(o.maxHp, o.hp + B.tenderHeal);
            }
          }
        }
      }

      // Bombers never latch: contact with anything of yours IS the attack.
      // They CHARGE the nearest wall or organ (anything standing on walkable
      // ground); perched guns they only catch in passing. The counterplay is
      // killing the runner before it arrives.
      if (spec.bomber) {
        const near = this.nearestStructure(e.pos, STRUCTURE_CONTACT + ENEMY_RADIUS);
        if (near || dist(e.pos, this.core) <= CORE_CONTACT) {
          this.detonateBomber(e);
          continue;
        }
        const prey = this.nearestStructure(e.pos, 4 * this.cfg.cellPx);
        if (prey) {
          const pp = this.structurePos(prey);
          const preyCell = pp ? this.cellAt(pp.x, pp.y) : -1;
          if (pp && preyCell >= 0 && isPassable(this.map.cells[preyCell])) {
            this.stepConstrained(e, pp, speed);
            continue;
          }
        }
      }

      // Latched onto a structure?
      if (e.targetId !== null && e.targetId !== -1) {
        const s = e.targetIsOrgan
          ? this.organs.find((o) => o.id === e.targetId)
          : this.towers.find((t) => t.id === e.targetId);
        if (!s) {
          e.targetId = null;
        } else {
          e.attackCooldown -= DT;
          if (e.attackCooldown <= 0) {
            e.attackCooldown = 1 / spec.rate;
            s.hp -= spec.damage * this.empowerOf(e);
            if (s.hp <= 0) {
              if (e.targetIsOrgan) this.removeOrgan(s.id);
              else this.removeTower(s.id, true);
            }
          }
          continue;
        }
      }

      // Attacking the core?
      if (e.targetId === -1) {
        e.attackCooldown -= DT;
        if (e.attackCooldown <= 0) {
          e.attackCooldown = 1 / spec.rate;
          this.coreHp -= spec.damage * this.empowerOf(e);
        }
        continue;
      }

      // March the streets: follow the flow field toward the core.
      if (dist(e.pos, this.core) <= CORE_CONTACT) {
        e.targetId = -1;
        e.attackCooldown = 0;
        continue;
      }

      // Fliers ignore the city plan entirely: straight over blocks and walls.
      if (spec.flies) {
        this.stepUnconstrained(e, this.core, speed);
        this.aheadCheckSeparationless(e);
        continue;
      }

      // Sappers climb: any limb or organ nearby is a target, blocks be damned —
      // but CLIMBING IS SLOW. On the street they sprint; scaling a block face
      // they crawl, and that crawl is the defender's window to shoot them off
      // the wall. (Without it, covering the lane just fed the sappers.)
      if (spec.sapper) {
        const prey = this.nearestStructure(e.pos, 3 * this.cfg.cellPx);
        if (prey) {
          const pp = this.structurePos(prey);
          if (pp) {
            if (dist(e.pos, pp) <= STRUCTURE_CONTACT + ENEMY_RADIUS) {
              e.targetId = prey.id;
              e.targetIsOrgan = prey.kind === 'o';
              e.attackCooldown = 0;
            } else {
              const onStreet = isPassable(this.map.cells[this.cellAt(e.pos.x, e.pos.y)]);
              this.stepUnconstrained(e, pp, speed * (onStreet ? 1 : B.sapperClimbFactor));
            }
            continue;
          }
        }
      }

      // A broodling underfoot gets fought, not walked past — blocking is its job.
      if (spec.rate > 0 && !spec.bomber && this.broodlings.length > 0) {
        let bl: Broodling | null = null;
        let bd = B.broodEngageDist + ENEMY_RADIUS;
        for (const b of this.broodlings) {
          const d = dist(e.pos, b.pos);
          if (d < bd) { bd = d; bl = b; }
        }
        if (bl) {
          e.attackCooldown -= DT;
          if (e.attackCooldown <= 0) {
            e.attackCooldown = 1 / spec.rate;
            bl.hp -= spec.damage * this.empowerOf(e);
            if (bl.hp <= 0) {
              this.broodlings = this.broodlings.filter((b) => b !== bl);
              this.events.push({ kind: 'broodling-lost', motherId: bl.motherId });
            }
          }
          continue;
        }
      }

      // Standoff bombardier: besieges the nearest structure from OUTSIDE melee.
      // Short-armed limbs cannot answer it; long guns and broodlings can.
      if (spec.standoff) {
        const prey = this.nearestStructure(e.pos, B.mortarStandoff);
        if (prey) {
          e.attackCooldown -= DT;
          if (e.attackCooldown <= 0 && spec.rate > 0) {
            e.attackCooldown = 1 / spec.rate;
            const s = prey.kind === 't'
              ? this.towers.find((t) => t.id === prey.id)
              : this.organs.find((o) => o.id === prey.id);
            if (s) {
              this.arcs.push({ from: { ...e.pos }, to: { ...s.pos }, ttl: 0.12 });
              s.hp -= spec.damage * this.empowerOf(e);
              if (s.hp <= 0) {
                if (prey.kind === 'o') this.removeOrgan(prey.id);
                else this.removeTower(prey.id, true);
              }
            }
          }
          continue;
        }
      }

      const cell = this.cellAt(e.pos.x, e.pos.y);
      const nextCell = this.flow.next[cell];

      // A structure on my cell or the next cell is a wall in my way: chew through
      // it — unless it is a digestive pit, which is a floor and WANTS the traffic.
      const rawWall = this.structureOn(cell) ?? (nextCell >= 0 ? this.structureOn(nextCell) : undefined);
      const wall = rawWall && rawWall.kind === 't'
        && this.towers.find((x) => x.id === rawWall.id)?.family === 'pit' ? undefined : rawWall;
      if (wall) {
        const wp = this.structurePos(wall);
        if (wp && dist(e.pos, wp) <= STRUCTURE_CONTACT + ENEMY_RADIUS) {
          e.targetId = wall.id;
          e.targetIsOrgan = wall.kind === 'o';
          e.attackCooldown = 0;
          continue;
        }
        if (wp) {
          this.stepConstrained(e, wp, speed);
          continue;
        }
      }

      if (nextCell >= 0) {
        this.stepConstrained(e, this.cellCenter(nextCell), speed);
      } else {
        // Unreachable pocket (shouldn't happen): press toward the core anyway.
        this.stepConstrained(e, this.core, speed);
      }
    }
    this.applySeparation();
  }

  /** Walk back up the flow field (away from the core) and slip out at the edge. */
  private leaveField(e: Enemy, speed: number): void {
    const cell = this.cellAt(e.pos.x, e.pos.y);
    const cx = cell % this.cfg.gridW;
    const cy = Math.floor(cell / this.cfg.gridW);
    if (cx <= 1 || cy <= 1 || cx >= this.cfg.gridW - 2 || cy >= this.cfg.gridH - 2) {
      const i = this.enemies.indexOf(e);
      if (i >= 0) this.enemies.splice(i, 1);
      return;
    }
    let best = -1;
    let bestD = this.flow.dist[cell];
    let nearVoid = false;
    const neighbors = [cell - 1, cell + 1, cell - this.cfg.gridW, cell + this.cfg.gridW];
    for (const nb of neighbors) {
      if (nb < 0 || nb >= this.map.cells.length) continue;
      if (this.map.cells[nb] === CellType.Void) nearVoid = true;
      if (!isPassable(this.map.cells[nb])) continue;
      if (Number.isFinite(this.flow.dist[nb]) && this.flow.dist[nb] > bestD) {
        bestD = this.flow.dist[nb];
        best = nb;
      }
    }
    if (best >= 0) {
      this.stepConstrained(e, this.cellCenter(best), speed);
    } else if (nearVoid) {
      // Top of the flow field at the frontier: slip out into the unclaimed city.
      const i = this.enemies.indexOf(e);
      if (i >= 0) this.enemies.splice(i, 1);
    } else {
      this.stepConstrained(e, { x: e.pos.x < this.worldW / 2 ? 0 : this.worldW, y: e.pos.y }, speed);
    }
  }

  private updateResearcher(e: Enemy, _spec: EnemySpec): void {
    const cell = this.cellAt(e.pos.x, e.pos.y);
    const speed = this.moveSpeedOf(e); // a snared researcher is a caught researcher
    if (e.leaving) {
      this.leaveField(e, speed);
      return;
    }
    // Approach along the streets; step ONTO the creep edge to take samples.
    // Standing on the mass is what science pays for — and what makes them huntable.
    const nextCell = this.flow.next[cell];
    if (this.isCreeped(cell)) {
      e.studyLeft -= DT;
      if (e.studyLeft <= 0) e.leaving = true;
      return;
    }
    if (nextCell >= 0) this.stepConstrained(e, this.cellCenter(nextCell), speed);
  }

  // ---------- combat ----------

  /** Broodlings hunt the nearest hive body inside the mother's leash. */
  private updateBroodlings(): void {
    for (const b of [...this.broodlings]) {
      const mother = this.towers.find((t) => t.id === b.motherId);
      if (!mother) continue; // dies with the mother in removeTower
      b.cooldown -= DT;
      let prey: Enemy | null = null;
      let bestD = Infinity;
      for (const e of this.enemies) {
        if (e.burrowed || e.kind === 'researcher' || enemySpec(e.kind).flies) continue;
        if (dist(mother.pos, e.pos) > B.broodLeash) continue; // stays near home
        const d = dist(b.pos, e.pos);
        if (d < bestD) { bestD = d; prey = e; }
      }
      if (prey) {
        if (bestD <= B.broodEngageDist + ENEMY_RADIUS) {
          if (b.cooldown <= 0) {
            b.cooldown = 1 / B.broodRate;
            this.damageEnemy(prey, B.broodDamage, 1);
          }
        } else {
          this.stepConstrained(b, prey.pos, B.broodSpeed);
        }
      } else if (dist(b.pos, mother.pos) > 40) {
        // Nothing to fight: drift back to mother's skirts.
        this.stepConstrained(b, mother.pos, B.broodSpeed * 0.7);
      }
    }
  }

  /** Aimed bile globs land and detonate on whatever stands there. */
  private updateBiles(): void {
    const landed: number[] = [];
    for (const g of this.bileFlights) {
      g.ttl -= DT;
      if (g.ttl <= 0) {
        let hits = 0;
        for (const e of [...this.enemies]) {
          if (e.burrowed || dist(g.to, e.pos) > B.lobberAoe) continue;
          hits++;
          this.damageEnemy(e, B.lobberDamage, 1);
        }
        this.events.push({ kind: 'bile-landed', cell: g.cell, hits });
        landed.push(g.id);
      }
    }
    if (landed.length) this.bileFlights = this.bileFlights.filter((g) => !landed.includes(g.id));
  }

  /** Creep clots in flight land and take root as new creep patches. */
  private updateClots(): void {
    const landed: number[] = [];
    for (const c of this.clotFlights) {
      c.ttl -= DT;
      if (c.ttl <= 0) {
        this.addCreepSource('patch', c.cell, B.slingPatchRadius);
        this.events.push({ kind: 'clot-landed', cell: c.cell });
        landed.push(c.id);
      }
    }
    if (landed.length) this.clotFlights = this.clotFlights.filter((c) => !landed.includes(c.id));
  }

  /** Arcs jump from a hit body to nearby bodies, damage falling per hop. */
  private chainArcs(from: Enemy, chains: number, damage: number, yieldMult: number, capBonus: number): void {
    let src = from;
    const struck = new Set<number>([from.id]);
    let dmg = damage * B.chainFalloff;
    for (let i = 0; i < chains; i++) {
      let best: Enemy | null = null;
      let bestD: number = B.chainRadius;
      for (const e of this.enemies) {
        if (struck.has(e.id) || e.burrowed) continue;
        const d = dist(src.pos, e.pos);
        if (d <= bestD) { bestD = d; best = e; }
      }
      if (!best) break;
      this.arcs.push({ from: { ...src.pos }, to: { ...best.pos }, ttl: 0.22 });
      this.damageEnemy(best, dmg, yieldMult, capBonus);
      struck.add(best.id);
      src = best;
      dmg *= B.chainFalloff;
    }
  }

  /** Shove a body along a direction, never into a building. */
  private knockBack(e: Enemy, dirX: number, dirY: number, px: number): void {
    const m = Math.hypot(dirX, dirY) || 1;
    const nx = e.pos.x + (dirX / m) * px;
    const ny = e.pos.y + (dirY / m) * px;
    if (enemySpec(e.kind).flies
      || (nx >= 2 && ny >= 2 && nx <= this.worldW - 2 && ny <= this.worldH - 2
        && isPassable(this.map.cells[this.cellAt(nx, ny)]))) {
      e.pos.x = nx;
      e.pos.y = ny;
    }
  }

  /**
   * Target priority. Every limb's reflex: a sapper CLIMBING a block face is
   * exposed and about to eat someone — shoot it off the wall first. (This is
   * what makes limbs cover each other; a lone tower still dies to sappers.)
   * Snipers additionally prefer support castes (drummer/tender/bomber) over
   * everything the reflex doesn't claim.
   */
  private pickTarget(t: Tower, range: number, sniper: boolean): Enemy | null {
    const mode = t.priority ?? 'auto';
    const caste = t.casteFocus ?? 'any';
    // FOCUS: hold the last target while it lives and stays in reach.
    if (mode === 'focus' && t.lastTargetId !== undefined) {
      const held = this.enemies.find((e) => e.id === t.lastTargetId);
      if (held && !held.burrowed && dist(t.pos, held.pos) <= range) return held;
    }
    let target: Enemy | null = null;
    let bestKey = -Infinity;
    for (const e of this.enemies) {
      if (e.burrowed) continue; // underground: nothing to shoot at
      const es = enemySpec(e.kind);
      const d = dist(t.pos, e.pos);
      if (d > range) continue;
      let sub: number;
      if (mode === 'first') {
        sub = -this.progressOf(e);             // furthest along the march
      } else if (mode === 'strongest') {
        sub = e.hp;                             // most health left
      } else if (mode === 'weakest') {
        sub = -e.hp;                            // finish the wounded
      } else {
        // AUTO (and focus acquiring a new lock): threats first, then nearest.
        // A sapper CLIMBING a block face is every limb's reflex target; snipers
        // then prefer support castes.
        const climbing = !!es.sapper && !isPassable(this.map.cells[this.cellAt(e.pos.x, e.pos.y)]);
        const support = !!(es.speedAura || es.healer || es.bomber);
        const tier = climbing ? 2 : sniper && support ? 1 : 0;
        sub = tier * 1e6 - d;
      }
      // A chosen caste outranks every other ordering.
      const key = (caste !== 'any' && es.caste === caste ? 1e9 : 0) + sub;
      if (key >= bestKey) { bestKey = key; target = e; }
    }
    return target;
  }

  /** How far a body still has to go (flow units; fliers by straight line). Lower = further along. */
  private progressOf(e: Enemy): number {
    const cell = this.cellAt(e.pos.x, e.pos.y);
    const d = this.flow.dist[cell];
    if (isPassable(this.map.cells[cell]) && Number.isFinite(d)) return d;
    return (dist(e.pos, this.core) / this.cfg.cellPx) * 10;
  }

  /** Is anything in this limb's own reach? (Idle prisms relay their charge.) */
  private hasTargetInRange(t: Tower, range: number): boolean {
    for (const e of this.enemies) {
      if (!e.burrowed && dist(t.pos, e.pos) <= range) return true;
    }
    return false;
  }

  /**
   * Prism relay: idle, charged prisms chained within link range of a firing
   * prism (directly or through each other) pour their charge into its beam and
   * spend their own shot doing it. Breadth-first, so the network routes itself.
   */
  private gatherPrismRelays(firing: Tower, claimed: Set<number>): number {
    const link = towerSpec('prism').prismLink ?? 0;
    const frontier: Tower[] = [firing];
    let relays = 0;
    while (frontier.length > 0 && relays < B.prismMaxRelays) {
      const cur = frontier.shift()!;
      for (const p of this.towers) {
        if (relays >= B.prismMaxRelays) break;
        if (p.family !== 'prism' || p === firing || claimed.has(p.id) || p.cooldown > 0) continue;
        if (dist(cur.pos, p.pos) > link) continue;
        if (this.hasTargetInRange(p, this.statsOf(p).range)) continue; // busy prisms fire their own
        claimed.add(p.id);
        p.cooldown = 1 / towerSpec('prism').rate;
        this.arcs.push({ from: { ...p.pos }, to: { ...cur.pos }, ttl: 0.25 });
        relays++;
        frontier.push(p);
      }
    }
    return relays;
  }

  private updateTowers(): void {
    const relayClaimed = new Set<number>();
    for (const t of this.towers) {
      // Cooldown ticks for every limb — sling and lobber recharges live here too.
      t.cooldown -= DT;
      const stats = this.statsOf(t);
      // Brood pip: living tissue regrows.
      if (stats.regen > 0 && t.hp < t.maxHp) t.hp = Math.min(t.maxHp, t.hp + stats.regen * DT);

      // The broodmother tends her brood instead of attacking.
      if (t.family === 'brood') {
        const mine = this.broodlings.filter((b) => b.motherId === t.id).length;
        if (mine < (towerSpec('brood').broodCount ?? 0) && t.cooldown <= 0) {
          t.cooldown = B.broodRespawn;
          const spawn = this.passableNear(t.cell) ?? t.pos;
          this.broodlings.push({
            id: this.nextId++, motherId: t.id, pos: { x: spawn.x, y: spawn.y },
            hp: B.broodHp, maxHp: B.broodHp, cooldown: 0,
          });
        }
        continue;
      }

      // The pit holds and digests whatever stands on it; the meal chews back.
      if (t.family === 'pit') {
        let held = 0;
        for (const e of this.enemies) {
          if (held >= B.pitMaxHeld) break;
          if (e.burrowed || enemySpec(e.kind).flies) continue;
          if (dist(t.pos, e.pos) > (towerSpec('pit').range || 26)) continue;
          held++;
          this.applyHitEffects(e, { ...stats, slowMult: 0.05, slowDur: 0.3 });
          this.damageEnemy(e, B.pitDps * DT, stats.yieldMult, stats.capBonus);
          if (e.hp <= 0) this.biomass += B.pitBiomassPerKill;
          const es = enemySpec(e.kind);
          t.hp -= es.damage * es.rate * DT; // digestion is not free
        }
        if (t.hp <= 0) this.removeTower(t.id, true);
        continue;
      }

      if (stats.rate <= 0) continue;
      if (t.cooldown > 0) continue;
      if (relayClaimed.has(t.id)) continue; // spent this beat feeding a sibling prism
      const target = this.pickTarget(t, stats.range, stats.sniper);
      if (!target) continue;
      t.cooldown = 1 / stats.rate;

      // Focus fire: consecutive shots on one body ramp (prisms natively, any
      // limb through prism pips). Switching targets resets the streak.
      t.streak = target.id === t.lastTargetId ? (t.streak ?? 0) + 1 : 0;
      t.lastTargetId = target.id;
      let dmg = stats.damage * (1 + stats.streakRamp * Math.min(t.streak, B.prismRampMax));

      // Hitscan strikers: the frond's arc chain, the ocular's board-wide beam,
      // and the prism's focus beam (fed by relays from idle prisms).
      if (t.family === 'frond' || t.family === 'ocular' || t.family === 'prism') {
        if (t.family === 'prism') {
          relayClaimed.add(t.id);
          dmg *= 1 + B.prismRelayBonus * this.gatherPrismRelays(t, relayClaimed);
        }
        this.arcs.push({ from: { ...t.pos }, to: { ...target.pos }, ttl: t.family === 'ocular' ? 0.3 : 0.22 });
        this.applyHitEffects(target, stats);
        this.damageEnemy(target, dmg, stats.yieldMult, stats.capBonus);
        if (stats.chains > 0) this.chainArcs(target, stats.chains, dmg, stats.yieldMult, stats.capBonus);
        if (stats.knock > 0) this.knockBack(target, target.pos.x - t.pos.x, target.pos.y - t.pos.y, stats.knock);
        continue;
      }

      if (t.family === 'lasher' || t.family === 'maw') {
        if (t.family === 'maw' && target.hp <= stats.eatThreshold) {
          this.eatEnemy(target);
          continue;
        }
        this.applyHitEffects(target, stats);
        this.damageEnemy(target, dmg, stats.yieldMult, stats.capBonus);
        if (stats.chains > 0) this.chainArcs(target, stats.chains, dmg, stats.yieldMult, stats.capBonus);
        if (stats.knock > 0) this.knockBack(target, target.pos.x - t.pos.x, target.pos.y - t.pos.y, stats.knock);
        if (t.family === 'lasher' && stats.aoe > 0) {
          for (const e of [...this.enemies]) {
            if (e !== target && !e.burrowed && dist(t.pos, e.pos) <= stats.aoe + 20) {
              this.damageEnemy(e, dmg * 0.5, stats.yieldMult, stats.capBonus);
            }
          }
        }
      } else {
        const d = dist(t.pos, target.pos);
        const speed = B.projectileSpeed;
        this.projectiles.push({
          id: this.nextId++,
          pos: { ...t.pos },
          vel: { x: ((target.pos.x - t.pos.x) / d) * speed, y: ((target.pos.y - t.pos.y) / d) * speed },
          damage: dmg,
          aoe: stats.aoe,
          // Piercing shots fly the whole range; ordinary ones die at the target.
          ttl: stats.pierce ? (stats.range * 1.25) / speed : (d / speed) + 0.4,
          fromFamily: t.family,
          yieldMult: stats.yieldMult,
          slowMult: stats.slowMult < 1 ? stats.slowMult : undefined,
          slowDur: stats.slowMult < 1 ? stats.slowDur : undefined,
          poisonDps: stats.poisonDps > 0 ? stats.poisonDps : undefined,
          poisonDur: stats.poisonDps > 0 ? stats.poisonDur : undefined,
          pierceLeft: stats.pierce ? 3 : undefined,
          hitIds: stats.pierce ? [] : undefined,
          capBonus: stats.capBonus,
          chains: stats.chains > 0 ? stats.chains : undefined,
          shred: stats.shred > 0 ? stats.shred : undefined,
          shredDur: stats.shred > 0 ? stats.shredDur : undefined,
          knock: stats.knock > 0 ? stats.knock : undefined,
          rootDur: stats.rootDur > 0 ? stats.rootDur : undefined,
        });
      }
    }
  }

  private updateProjectiles(): void {
    const gone: number[] = [];
    for (const p of this.projectiles) {
      p.ttl -= DT;
      p.pos.x += p.vel.x * DT;
      p.pos.y += p.vel.y * DT;
      let hit: Enemy | null = null;
      for (const e of this.enemies) {
        if (e.burrowed) continue;
        if (p.hitIds && p.hitIds.includes(e.id)) continue; // a skewer hits each body once
        if (dist(p.pos, e.pos) <= ENEMY_RADIUS + 4) { hit = e; break; }
      }
      if (hit) {
        const fx = {
          slowMult: p.slowMult ?? 1, slowDur: p.slowDur ?? 0,
          poisonDps: p.poisonDps ?? 0, poisonDur: p.poisonDur ?? 0,
          shred: p.shred, shredDur: p.shredDur, rootDur: p.rootDur,
        };
        if (p.aoe > 0) {
          for (const e of [...this.enemies]) {
            if (e.burrowed || dist(p.pos, e.pos) > p.aoe) continue;
            this.applyHitEffects(e, fx);
            this.damageEnemy(e, p.damage, p.yieldMult, p.capBonus ?? 0);
          }
        } else {
          this.applyHitEffects(hit, fx);
          this.damageEnemy(hit, p.damage, p.yieldMult, p.capBonus ?? 0);
        }
        // Inherited verbs ride the shot: arcs jump off the struck body,
        // knockback shoves it on along the shot's own direction.
        if (p.chains && p.chains > 0) {
          this.chainArcs(hit, p.chains, p.damage, p.yieldMult, p.capBonus ?? 0);
        }
        if (p.knock && p.knock > 0) this.knockBack(hit, p.vel.x, p.vel.y, p.knock);
        if (p.pierceLeft !== undefined && p.pierceLeft > 0) {
          p.pierceLeft -= 1;
          p.hitIds?.push(hit.id);
        } else {
          gone.push(p.id);
        }
      } else if (p.ttl <= 0) {
        gone.push(p.id);
      }
    }
    this.projectiles = this.projectiles.filter((p) => !gone.includes(p.id));
  }

  private damageEnemy(e: Enemy, dmg: number, yieldMult: number, capBonus = 0): void {
    // Ablative carapace: the shell eats whole HITS — few big blows strip it
    // fastest (the phalanx's mirror). Poison seeps through, it is not a hit.
    if (e.hitShield !== undefined && e.hitShield > 0) {
      e.hitShield -= 1;
      return;
    }
    // Royal presence steels the war bodies around it.
    if (this.inRoyalAura(e)) dmg *= B.royalAuraArmor;
    const cap = enemySpec(e.kind).armorCap;
    // Shredded armor raises the cap for EVERY source — the mister's whole job.
    const shred = e.shredUntil !== undefined && e.shredUntil > this.time ? e.shredAmount ?? 0 : 0;
    const effCap = cap !== undefined ? cap + capBonus + shred : undefined;
    e.hp -= effCap !== undefined && Number.isFinite(effCap) ? Math.min(dmg, effCap) : dmg;
    if (e.hp <= 0) this.killEnemy(e.id, yieldMult, false);
  }

  private eatEnemy(e: Enemy): void {
    this.biomass += B.biomassPerEat;
    this.events.push({ kind: 'eaten', enemy: e.kind });
    this.killEnemy(e.id, 0, true);
  }

  private killEnemy(id: number, yieldMult: number, eaten: boolean): void {
    const i = this.enemies.findIndex((e) => e.id === id);
    if (i < 0) return;
    const e = this.enemies[i];
    const spec = enemySpec(e.kind);
    this.enemies.splice(i, 1);
    if (e.kind === 'royal') {
      this.royalsKilled += 1;
      this.checkDirective();
    }
    const calmScale = this.glandMode() === 'calm' ? B.glandCalmThreatScale : 1;
    this.threatKills += spec.threatOnKill * calmScale * B.killThreatScale;
    this.biomass += B.biomassPerKill;
    // A splitter killed by damage bursts into its children; eaten whole, it doesn't.
    if (spec.splitInto && !eaten) {
      for (let i = 0; i < spec.splitInto.count; i++) this.spawnMinion(spec.splitInto.kind, e.pos);
    }
    // A dead thief drops what it stole.
    if (e.stole !== undefined && e.stole > 0) {
      this.meat.war += e.stole;
      this.events.push({ kind: 'meat-recovered', amount: e.stole });
    }
    // A dead collector drops the limb: it re-roots where it stood, traits and
    // targeting intact — or, if that ground is taken now, its cost comes back.
    if (e.carrying) {
      const c = e.carrying;
      if (!this.occupied.has(c.cell) && c.cell !== this.map.coreCell) {
        const spec = towerSpec(c.family);
        const tower: Tower = {
          id: this.nextId++, family: c.family, pos: this.cellCenter(c.cell), cell: c.cell,
          hp: spec.maxHp, maxHp: spec.maxHp, pips: c.pips, cooldown: 0, kills: 0,
          priority: c.priority, casteFocus: c.casteFocus,
        };
        tower.maxHp = this.statsOf(tower).maxHp;
        tower.hp = tower.maxHp;
        this.towers.push(tower);
        this.occupied.set(c.cell, { kind: 't', id: tower.id });
        this.refreshRouting();
        this.events.push({ kind: 'tower-recovered', family: c.family, refunded: false });
      } else {
        const cost = towerSpec(c.family).cost;
        for (const k of ['war', 'science', 'royal'] as Caste[]) this.meat[k] += cost[k] ?? 0;
        this.events.push({ kind: 'tower-recovered', family: c.family, refunded: true });
      }
    }
    this.events.push({ kind: 'kill', enemy: e.kind, caste: spec.caste });
    if (!eaten && yieldMult > 0) {
      const slot = this.map.slots[slotOfCell(this.map, this.cellAt(e.pos.x, e.pos.y))];
      const district = slot && slot.feature === 'meat' && spec.caste === 'war' ? 1.25 : 1;
      this.drops.push({
        id: this.nextId++, pos: { ...e.pos }, caste: spec.caste,
        amount: Math.round(spec.meat * yieldMult * district * this.entranceMeatMult), ttl: B.dropFlySeconds,
      });
    }
  }

  private updateDrops(): void {
    const banked: number[] = [];
    for (const d of this.drops) {
      d.ttl -= DT;
      const dd = dist(d.pos, this.core);
      if (dd > 4) {
        const sp = dd / Math.max(0.05, d.ttl);
        d.pos.x += ((this.core.x - d.pos.x) / dd) * sp * DT;
        d.pos.y += ((this.core.y - d.pos.y) / dd) * sp * DT;
      }
      if (d.ttl <= 0) {
        this.meat[d.caste] += d.amount;
        if (d.caste === 'science') {
          this.scienceBanked += d.amount;
          this.checkDirective();
        }
        this.events.push({ kind: 'banked', caste: d.caste, amount: d.amount });
        banked.push(d.id);
      }
    }
    this.drops = this.drops.filter((d) => !banked.includes(d.id));
  }
}
