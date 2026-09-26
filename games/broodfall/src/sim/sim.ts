/**
 * Broodfall sim core. Fixed-timestep, seeded, deterministic, zero rendering imports.
 * The renderer and HUD read state; the only way in is issue() and tick().
 */
import { Rng } from './rng';
import {
  BALANCE as B, ENEMIES, ORGANS, TOWERS, WAVE_TABLE,
} from '../../content/data';
import type {
  CardInstance, Caste, Command, Directive, Drop, Enemy, EnemyKind, EnemySpec,
  GlandMode, Organ, OrganId, Outcome, Phase, Projectile, SimConfig, SimEvent,
  Tower, TowerFamily, TowerSpec, Vec,
} from './types';

export const DT = 0.1;

const CONTACT_DIST = 34;
const ENEMY_RADIUS = 8;
const RESEARCH_STANDOFF = 60;

function dist(a: Vec, b: Vec): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
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
  return {
    rate: spec.rate * (1 + B.pipRate * pips('spitter')),
    damage: spec.damage * (1 + B.pipDamage * pips('lasher')),
    aoe: spec.aoe + B.pipAoe * pips('burster'),
    yieldMult: 1 + B.pipYield * pips('maw'),
    maxHp: spec.maxHp + B.pipHp * pips('spine'),
    interest: spec.interest + B.pipInterest * pips('lure') + B.interestPerPip * t.pips.length,
    range: spec.range,
    eatThreshold: spec.eatThreshold,
  };
}

export class Sim {
  readonly cfg: SimConfig;
  readonly worldW: number;
  readonly worldH: number;
  readonly core: Vec;

  private rng: Rng;
  private nextId = 1;
  private events: SimEvent[] = [];

  tickCount = 0;
  time = 0;
  outcome: Outcome = 'playing';

  meat: Record<Caste, number> = { war: 0, science: 0, royal: 0 };
  biomass = 0;
  coreHp = B.coreHp;
  coreMaxHp = B.coreHp;

  phase: Phase = 'growth';
  phaseElapsed = 0;
  waveNumber = 0;
  directive: Directive;
  wavesCleared = 0;
  scienceBanked = 0;
  royalsKilled = 0;
  private spawnQueue: EnemyKind[] = [];
  private spawnTimer = 0;
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

  /** cell index -> structure ('t'|'o') + id */
  private occupied = new Map<number, { kind: 't' | 'o'; id: number }>();

  constructor(cfg: SimConfig) {
    this.cfg = cfg;
    this.worldW = cfg.gridW * cfg.cellPx;
    this.worldH = cfg.gridH * cfg.cellPx;
    this.core = { x: this.worldW / 2, y: this.worldH / 2 };
    this.rng = new Rng(cfg.seed);
    this.directive = cfg.directive ?? this.rng.pick<Directive>([
      { kind: 'hold', waves: B.holdWaves },
      { kind: 'royal', count: 1 },
      { kind: 'harvest', science: B.harvestScience },
    ]);
    this.meat = { ...B.startMeat };
    while (this.hand.length < B.handSize) this.hand.push(this.drawCard());
  }

  // ---------- derived ----------

  get creepRadius(): number {
    const hearts = this.organs.filter((o) => o.organ === 'heart').length;
    return B.creepBase + this.time * B.creepPerSec * (1 + B.creepPerHeartBonus * hearts);
  }

  get bodyRadius(): number {
    return B.bodyBase + this.biomass * B.bodyPerBiomass;
  }

  get interest(): number {
    let n = 0;
    for (const t of this.towers) n += towerStats(t).interest;
    for (const o of this.organs) {
      if (o.organ === 'brain') n += B.brainInterest;
      if (o.organ === 'gland' && o.glandMode === 'lure') n += B.glandLureInterestBonus;
    }
    return n;
  }

  get threat(): number {
    return this.threatKills + this.threatChallenge + this.biomass * B.threatFromBiomass;
  }

  get tier(): number {
    return Math.min(WAVE_TABLE.length - 1, Math.floor(this.threat / B.threatPerTier));
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

  /** Towers build anywhere on creep, clear of the core mouth. */
  canBuildTower(cell: number): boolean {
    const c = this.cellCenter(cell);
    const d = dist(c, this.core);
    return !this.isOccupied(cell) && d <= this.creepRadius && d > 44;
  }

  /** Organs grow only inside the body mass. */
  canBuildOrgan(cell: number): boolean {
    const c = this.cellCenter(cell);
    const d = dist(c, this.core);
    return !this.isOccupied(cell) && d <= this.bodyRadius && d > 44;
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

  // ---------- cards ----------

  private drawCard(): CardInstance {
    const brains = this.organs.filter((o) => o.organ === 'brain').length;
    const spec = this.rng.weighted(TOWERS, (t) =>
      t.weight * (t.advanced && brains > 0 ? B.brainAdvancedWeightMult ** Math.min(brains, 2) : 1),
    );
    return { id: this.nextId++, family: spec.family };
  }

  /** Current draw weight per family (for the HUD odds inspector and tests). */
  drawWeights(): Record<TowerFamily, number> {
    const brains = this.organs.filter((o) => o.organ === 'brain').length;
    const out = {} as Record<TowerFamily, number>;
    for (const t of TOWERS) {
      out[t.family] = t.weight
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
        if (!this.canBuildTower(cmd.cell)) return { ok: false, err: 'cell not buildable' };
        if (!this.canAfford(spec.cost)) return { ok: false, err: 'cannot afford' };
        let pips = [] as Tower['pips'];
        if (cmd.cannibalizeTowerId !== undefined) {
          const donor = this.towers.find((t) => t.id === cmd.cannibalizeTowerId);
          if (!donor) return { ok: false, err: 'no such donor' };
          pips = [...donor.pips, { family: donor.family }];
          this.removeTower(donor.id, false);
          this.events.push({ kind: 'cannibalized', donor: donor.family, into: card.family });
        }
        this.pay(spec.cost);
        const pos = this.cellCenter(cmd.cell);
        const tower: Tower = {
          id: this.nextId++, family: card.family, pos, cell: cmd.cell,
          hp: spec.maxHp, maxHp: spec.maxHp, pips, cooldown: 0, kills: 0,
        };
        tower.maxHp = towerStats(tower).maxHp;
        tower.hp = tower.maxHp;
        this.towers.push(tower);
        this.occupied.set(cmd.cell, { kind: 't', id: tower.id });
        this.hand.splice(cmd.cardIndex, 1);
        this.hand.push(this.drawCard());
        this.events.push({ kind: 'built', family: card.family, pips: pips.length });
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
        this.events.push({ kind: 'organ-built', organ: cmd.organ });
        return { ok: true };
      }
      case 'cycle-gland': {
        const g = this.organs.find((o) => o.id === cmd.organInstanceId && o.organ === 'gland');
        if (!g) return { ok: false, err: 'no such gland' };
        g.glandMode = g.glandMode === 'calm' ? 'lure' : g.glandMode === 'lure' ? 'challenge' : 'calm';
        return { ok: true };
      }
      case 'royal-surge': {
        if (this.meat.royal < B.royalSurgeCost) return { ok: false, err: 'cannot afford' };
        this.meat.royal -= B.royalSurgeCost;
        this.biomass += B.royalSurgeBiomass;
        return { ok: true };
      }
    }
  }

  private removeTower(id: number, emit: boolean): void {
    const i = this.towers.findIndex((t) => t.id === id);
    if (i < 0) return;
    const t = this.towers[i];
    this.occupied.delete(t.cell);
    this.towers.splice(i, 1);
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
    for (const e of this.enemies) {
      if (e.targetIsOrgan && e.targetId === id) e.targetId = null;
    }
    this.events.push({ kind: 'structure-lost', what: organSpec(o.organ).name });
  }

  // ---------- spawning ----------

  private edgeSpawnPos(): Vec {
    const side = this.rng.int(0, 3);
    const m = 6;
    if (side === 0) return { x: this.rng.float(0, this.worldW), y: m };
    if (side === 1) return { x: this.rng.float(0, this.worldW), y: this.worldH - m };
    if (side === 2) return { x: m, y: this.rng.float(0, this.worldH) };
    return { x: this.worldW - m, y: this.rng.float(0, this.worldH) };
  }

  private spawnEnemy(kind: EnemyKind): Enemy {
    const spec = enemySpec(kind);
    const e: Enemy = {
      id: this.nextId++, kind, pos: this.edgeSpawnPos(),
      hp: spec.hp, maxHp: spec.hp, targetId: null, targetIsOrgan: false,
      attackCooldown: 0, studyLeft: kind === 'researcher' ? B.studySeconds : 0,
      leaving: false,
    };
    this.enemies.push(e);
    return e;
  }

  private startSiege(): void {
    this.phase = 'siege';
    this.phaseElapsed = 0;
    this.waveNumber += 1;
    const comp = WAVE_TABLE[this.tier];
    this.spawnQueue = [];
    const counts: Partial<Record<EnemyKind, number>> = {};
    for (const [kind, n] of Object.entries(comp)) {
      counts[kind as EnemyKind] = n;
      for (let i = 0; i < (n ?? 0); i++) this.spawnQueue.push(kind as EnemyKind);
    }
    // Shuffle spawn order deterministically.
    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
    }
    this.spawnTimer = 0;
    this.events.push({ kind: 'wave-start', tier: this.tier, wave: this.waveNumber, counts });
  }

  // ---------- tick ----------

  tick(): void {
    if (this.outcome !== 'playing') return;
    this.tickCount += 1;
    this.time += DT;
    this.phaseElapsed += DT;

    // Biomass and win.
    const hearts = this.organs.filter((o) => o.organ === 'heart').length;
    this.biomass += (B.biomassBase + hearts * B.biomassPerHeart) * DT;

    // Gland challenge mode feeds threat.
    if (this.glandMode() === 'challenge') this.threatChallenge += B.glandChallengeThreatPerSec * DT;

    // Phase machine.
    if (this.phase === 'growth') {
      if (this.phaseElapsed >= B.growthSeconds) this.startSiege();
    } else {
      if (this.spawnQueue.length > 0) {
        this.spawnTimer -= DT;
        if (this.spawnTimer <= 0) {
          this.spawnTimer = B.siegeSpawnSeconds / Math.max(1, this.spawnQueue.length + 4);
          this.spawnEnemy(this.spawnQueue.pop()!);
        }
      }
      const hostiles = this.enemies.some((e) => e.kind !== 'researcher');
      if ((this.spawnQueue.length === 0 && !hostiles) || this.phaseElapsed > B.siegeMaxSeconds) {
        this.phase = 'growth';
        this.phaseElapsed = 0;
        this.wavesCleared += 1;
        this.checkDirective();
        if (this.outcome !== 'playing') return;
      }
    }

    // Researchers, drawn by interest, in any phase.
    this.researcherTimer -= DT;
    if (this.researcherTimer <= 0) {
      const interval = Math.max(
        B.researcherMinInterval,
        B.researcherBaseInterval / (1 + this.interest / 10),
      );
      this.researcherTimer = interval;
      if (this.interest > 0) {
        const n = this.rng.int(2, 4);
        for (let i = 0; i < n; i++) this.spawnEnemy('researcher');
        this.events.push({ kind: 'researchers-arrive', count: n });
      }
    }

    // Royal event.
    const royalDue = this.threat >= B.royalThreat
      || (this.directive.kind === 'royal' && this.waveNumber >= B.royalGuaranteeWave);
    if (!this.royalSpawned && royalDue) {
      this.royalSpawned = true;
      this.spawnEnemy('royal');
      for (let i = 0; i < B.royalEscort; i++) this.spawnEnemy('elite');
      this.events.push({ kind: 'royal-incoming' });
    }

    this.updateCoreAttack();
    this.updateEnemies();
    this.updateTowers();
    this.updateProjectiles();
    this.updateDrops();

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
      if (e.kind === 'researcher') continue;
      const d = dist(e.pos, this.core);
      if (d <= bestD) { bestD = d; target = e; }
    }
    if (target) this.damageEnemy(target, B.coreDps * DT, 1);
  }

  private structureById(kind: 't' | 'o', id: number): Tower | Organ | undefined {
    return kind === 't'
      ? this.towers.find((t) => t.id === id)
      : this.organs.find((o) => o.id === id);
  }

  private updateEnemies(): void {
    const dead: number[] = [];
    for (const e of this.enemies) {
      const spec = enemySpec(e.kind);

      if (e.kind === 'researcher') {
        this.updateResearcher(e, spec);
        continue;
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
            s.hp -= spec.damage;
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
          this.coreHp -= spec.damage;
        }
        continue;
      }

      // Advance toward the core; latch onto anything close enough on the way.
      const near = this.nearestStructure(e.pos, CONTACT_DIST);
      if (near) {
        e.targetId = near.id;
        e.targetIsOrgan = near.kind === 'o';
        e.attackCooldown = 0;
        continue;
      }
      if (dist(e.pos, this.core) <= this.bodyRadius * 0.55) {
        e.targetId = -1;
        e.attackCooldown = 0;
        continue;
      }
      this.moveToward(e, this.core, spec.speed);
    }
    for (const id of dead) this.killEnemy(id, 1, false);
  }

  private updateResearcher(e: Enemy, spec: EnemySpec): void {
    if (e.leaving) {
      // Walk off the nearest edge, despawn outside.
      const exits: Vec[] = [
        { x: e.pos.x, y: -20 }, { x: e.pos.x, y: this.worldH + 20 },
        { x: -20, y: e.pos.y }, { x: this.worldW + 20, y: e.pos.y },
      ];
      let exit = exits[0];
      for (const c of exits) if (dist(e.pos, c) < dist(e.pos, exit)) exit = c;
      this.moveToward(e, exit, spec.speed);
      if (e.pos.x < -10 || e.pos.y < -10 || e.pos.x > this.worldW + 10 || e.pos.y > this.worldH + 10) {
        e.hp = -1; // silently gone; no meat, no threat
        const i = this.enemies.indexOf(e);
        if (i >= 0) this.enemies.splice(i, 1);
      }
      return;
    }
    // Approach the body perimeter and study.
    const standoff = this.creepRadius + RESEARCH_STANDOFF * 0.4;
    const d = dist(e.pos, this.core);
    if (d > standoff) {
      this.moveToward(e, this.core, spec.speed);
      return;
    }
    e.studyLeft -= DT;
    if (e.studyLeft <= 0) e.leaving = true;
  }

  private moveToward(e: Enemy, target: Vec, speed: number): void {
    const d = dist(e.pos, target);
    if (d < 1) return;
    e.pos.x += ((target.x - e.pos.x) / d) * speed * DT;
    e.pos.y += ((target.y - e.pos.y) / d) * speed * DT;
  }

  private nearestStructure(p: Vec, within: number): { kind: 't' | 'o'; id: number } | null {
    let best: { kind: 't' | 'o'; id: number } | null = null;
    let bestD = within;
    for (const t of this.towers) {
      const d = dist(p, t.pos) - ENEMY_RADIUS;
      if (d < bestD) { bestD = d; best = { kind: 't', id: t.id }; }
    }
    for (const o of this.organs) {
      const d = dist(p, o.pos) - ENEMY_RADIUS;
      if (d < bestD) { bestD = d; best = { kind: 'o', id: o.id }; }
    }
    return best;
  }

  private updateTowers(): void {
    for (const t of this.towers) {
      const stats = towerStats(t);
      if (stats.rate <= 0) continue;
      t.cooldown -= DT;
      if (t.cooldown > 0) continue;
      // Nearest enemy in range.
      let target: Enemy | null = null;
      let bestD = stats.range;
      for (const e of this.enemies) {
        const d = dist(t.pos, e.pos);
        if (d <= bestD) { bestD = d; target = e; }
      }
      if (!target) continue;
      t.cooldown = 1 / stats.rate;
      if (t.family === 'lasher' || t.family === 'maw') {
        // Melee: instant hit.
        if (t.family === 'maw' && target.hp <= stats.eatThreshold) {
          this.eatEnemy(target);
          continue;
        }
        this.damageEnemy(target, stats.damage, stats.yieldMult);
        if (t.family === 'lasher' && stats.aoe > 0) {
          for (const e of [...this.enemies]) {
            if (e !== target && dist(t.pos, e.pos) <= stats.aoe + 20) {
              this.damageEnemy(e, stats.damage * 0.5, stats.yieldMult);
            }
          }
        }
      } else {
        // Projectile.
        const d = dist(t.pos, target.pos);
        const speed = B.projectileSpeed;
        this.projectiles.push({
          id: this.nextId++,
          pos: { ...t.pos },
          vel: { x: ((target.pos.x - t.pos.x) / d) * speed, y: ((target.pos.y - t.pos.y) / d) * speed },
          damage: stats.damage,
          aoe: stats.aoe,
          ttl: (d / speed) + 0.4,
          fromFamily: t.family,
          yieldMult: stats.yieldMult,
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
        if (dist(p.pos, e.pos) <= ENEMY_RADIUS + 4) { hit = e; break; }
      }
      if (hit || p.ttl <= 0) {
        const ym = p.yieldMult;
        if (hit) {
          if (p.aoe > 0) {
            for (const e of [...this.enemies]) {
              if (dist(p.pos, e.pos) <= p.aoe) this.damageEnemy(e, p.damage, ym);
            }
          } else {
            this.damageEnemy(hit, p.damage, ym);
          }
        }
        gone.push(p.id);
      }
    }
    this.projectiles = this.projectiles.filter((p) => !gone.includes(p.id));
  }

  private damageEnemy(e: Enemy, dmg: number, yieldMult: number): void {
    e.hp -= dmg;
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
    this.threatKills += spec.threatOnKill * calmScale;
    this.biomass += B.biomassPerKill;
    this.events.push({ kind: 'kill', enemy: e.kind, caste: spec.caste });
    if (!eaten && yieldMult > 0) {
      this.drops.push({
        id: this.nextId++, pos: { ...e.pos }, caste: spec.caste,
        amount: Math.round(spec.meat * yieldMult), ttl: B.dropFlySeconds,
      });
    }
  }

  private updateDrops(): void {
    const banked: number[] = [];
    for (const d of this.drops) {
      d.ttl -= DT;
      // Fly toward the core (cosmetic in sim terms; banked on ttl).
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
