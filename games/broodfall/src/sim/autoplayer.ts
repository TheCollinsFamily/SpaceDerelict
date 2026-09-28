/**
 * Scripted autoplayer: drives a Sim with a chokepoint-aware policy. Used by the
 * headless full-run tests and the browser demo mode (?auto=1). Deterministic.
 */
import { Rng } from './rng';
import { Sim, towerSpec } from './sim';
import { UPGRADE_COST } from '../../content/upgrades';
import { organTurn } from './organPolicy';
import { CellType } from './citymap';
import { BALANCE as B } from '../../content/data';
import type { Tower, UpgradeChoice } from './types';

export class Autoplayer {
  private rng: Rng;
  private actTimer = 0;
  private buildsSinceCannibalize = 0;
  private builds = 0;

  constructor(seed: number) {
    this.rng = new Rng(seed);
  }

  act(sim: Sim, dt: number): void {
    if (sim.outcome !== 'playing') return;
    // District draft: take the first offer (policies stay comparable).
    if (sim.phase === 'draft') {
      sim.issue({ kind: 'choose-plate', index: 0 });
      return;
    }
    this.actTimer -= dt;
    if (this.actTimer > 0) return;
    this.actTimer = 1.5;

    // Science buys evolutions for the limbs doing the killing; royal points go to
    // a third stage first, and only spare points to a surge.
    if (this.tryEvolve(sim)) return;
    if (sim.meat.royal >= B.royalSurgeCost + (this.stage3Ready(sim) ? 1 : 0)) sim.issue({ kind: 'royal-surge' });

    // The organ stage (between waves): unlock themes, then spend what the wave would clear.
    if (sim.cfg.organStage && organTurn(sim)) return;

    // Sling technique: hurl creep toward the telegraphed approach, so forward
    // ground near the incoming lane becomes buildable before the body arrives.
    const sling = sim.towers.find((t) => t.family === 'sling');
    if (sling && sling.cooldown <= 0 && sim.incomingGates.length > 0) {
      const g = sim.cellCenter(sim.incomingGates[0]);
      const dx = g.x - sling.pos.x;
      const dy = g.y - sling.pos.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = Math.min(1, (B.slingRange * 0.9) / d);
      const cell = sim.cellAt(sling.pos.x + dx * f, sling.pos.y + dy * f);
      sim.issue({ kind: 'sling-throw', towerId: sling.id, cell });
    }

    // Aimed bile volley: dump it on the hostile closest to home once a wave is thick.
    const lobber = sim.towers.find((t) => t.family === 'lobber');
    if (lobber && lobber.cooldown <= 0 && sim.enemies.length >= 4) {
      let aim: { x: number; y: number } | null = null;
      let bd = Infinity;
      const reach = sim.statsOf(lobber).range;
      for (const e of sim.enemies) {
        if (e.kind === 'researcher' || sim.isAirborne(e)) continue;
        const dc = Math.hypot(e.pos.x - sim.core.x, e.pos.y - sim.core.y);
        const dl = Math.hypot(e.pos.x - lobber.pos.x, e.pos.y - lobber.pos.y);
        if (dl <= reach && dc < bd) { bd = dc; aim = e.pos; }
      }
      if (aim) sim.issue({ kind: 'bile-throw', towerId: lobber.id, cell: sim.cellAt(aim.x, aim.y) });
    }

    // Bombard technique. COUNTER-BATTERY first: an emplaced siege cannon in
    // reach gets the marker (it outranges the guns — this is what answers it).
    // Otherwise the densest switchback on the telegraphed lanes, as far OUT as
    // reach allows, so the shelling starts early instead of at the front door.
    const bombards = sim.towers.filter((t) => t.family === 'bombard');
    if (bombards.length > 0) {
      const lane = this.lanePathCells(sim);
      for (const b of bombards) {
        const reach = sim.statsOf(b).range;
        const aoe = sim.statsOf(b).aoe;
        let best = -1;
        let bestKey = -Infinity;
        for (const e of sim.enemies) {
          if (!e.deployed || e.kind !== 'cannon') continue;
          const d = Math.hypot(e.pos.x - b.pos.x, e.pos.y - b.pos.y);
          if (d <= reach && -d > bestKey) { bestKey = -d; best = sim.cellAt(e.pos.x, e.pos.y); }
        }
        if (best < 0) {
          for (const [cell] of lane) {
            const p = sim.cellCenter(cell);
            if (Math.hypot(p.x - b.pos.x, p.y - b.pos.y) > reach) continue;
            let density = 0;
            for (const [other, n] of lane) {
              const q = sim.cellCenter(other);
              if (Math.hypot(q.x - p.x, q.y - p.y) <= aoe) density += n;
            }
            const key = density * 1000 + sim.flowDistOf(cell);
            if (key > bestKey) { bestKey = key; best = cell; }
          }
        }
        if (best >= 0 && b.marker !== best) sim.issue({ kind: 'set-marker', towerId: b.id, cell: best });
      }
    }

    // Technique: a spine card plugs the telegraphed lane itself; a pit card sits
    // IN that lane and digests the column that walks over it.
    for (const streetFamily of ['spine', 'swamp'] as const) {
      const idx = sim.hand.findIndex((c) => c.family === streetFamily);
      if (idx < 0 || !sim.canAfford(towerSpec(streetFamily).cost)) continue;
      const laneRoad = this.laneRoadCell(sim, streetFamily);
      if (laneRoad !== null) {
        if (sim.issue({ kind: 'build', cardIndex: idx, cell: laneRoad }).ok) {
          this.builds += 1;
          return;
        }
      }
    }

    // Build in hand order. Everything feeds the attraction economy (advanced
    // towers and pips raise interest, interest brings the science that pays for
    // the next advanced card) — an earlier damage-first "discipline" starved
    // science to 4 and lost runs it used to win. Measured, not vibes.
    const SURPLUS_CAP: Partial<Record<string, number>> = { sling: 1, lobber: 1 };
    const UNMEASURED_ENGINES = new Set<string>(['mitosis', 'capacitor', 'boomerang', 'press', 'reliquary']);

    const tryBuild = (i: number): boolean => {
      const fam = sim.hand[i].family;
      const spec = towerSpec(fam);
      const wantsBlocker = fam === 'spine';
      // High tiers bring tunnelers (surface INSIDE) and massed fliers: keep a
      // couple of guns on the body itself, not everything on the frontier.
      const interiorGuns = sim.towers.filter(
        (t) => towerSpec(t.family).rate > 0 && sim.creepDistOf(t.cell) >= 0 && sim.creepDistOf(t.cell) <= 5,
      ).length;
      const wantsInterior = !wantsBlocker && spec.rate > 0 && interiorGuns < 2
        && sim.threat >= B.tier6Threat - 60; // tunnelers imminent: cover the inside
      const cell = this.findTowerCell(sim, wantsBlocker, wantsInterior);
      if (cell === null) return false;
      let cannibalizeTowerId: number | undefined;
      this.buildsSinceCannibalize += 1;
      if (this.buildsSinceCannibalize >= 4 && sim.towers.length > 7) {
        const donor = sim.towers.find((t) => t.family === 'spitter' || t.family === 'spine');
        if (donor) {
          cannibalizeTowerId = donor.id;
          this.buildsSinceCannibalize = 0;
        }
      }
      if (sim.issue({ kind: 'build', cardIndex: i, cell, cannibalizeTowerId }).ok) {
        this.builds += 1;
        return true;
      }
      return false;
    };

    const guns = sim.towers.filter((t) => {
      const sp = towerSpec(t.family);
      return sp.rate > 0 && sp.damage > 0 && !sp.markerFire;
    });
    for (let i = 0; i < sim.hand.length; i++) {
      const fam = sim.hand[i].family;
      if (!sim.canAfford(towerSpec(fam).cost)) continue;
      // Support limbs are placed by their OWN logic, never on a gun's perch:
      // the ward behind the guns it shields, the bombard deep in the body.
      const isEngine = !!towerSpec(fam).engine;
      // Engines whose payoff is not a static dps gain (buds, banked shots,
      // science, returns, relics) are human depth tools: the bot sheds them.
      if (UNMEASURED_ENGINES.has(fam)) {
        if (sim.meat.war >= B.discardCost + 10) { sim.issue({ kind: 'discard', cardIndex: i }); return; }
        continue;
      }
      if (fam === 'ward' || fam === 'bombard' || isEngine) {
        const have = sim.towers.filter((t) => t.family === fam).length;
        const cap = fam === 'ward' ? Math.floor(guns.length / 4)
          : isEngine ? Math.floor(guns.length / 3)
            : Math.min(2, Math.floor(guns.length / 5));
        let cell = have < cap
          ? (fam === 'bombard' ? this.bombardCell(sim) : this.wardCell(sim, guns))
          : null;
        // A combo engine is only worth its science if it actually multiplies
        // something from here: trial-place it, measure, build only on a real gain.
        let plan = isEngine && cell !== null ? this.engineGain(sim, fam, cell) : null;
        // Amplifiers go where the CARRY is: try spots around the limb the other
        // engines already feed and keep the best measured gain.
        if (fam === 'amp' && have < cap) {
          const best = this.ampSpot(sim);
          if (best && (!plan || best.gain > plan.gain)) { cell = best.cell; plan = best; }
        }
        const worthIt = !isEngine || (plan !== null && plan.gain >= 0.15);
        if (cell !== null && worthIt && sim.issue({
          kind: 'build', cardIndex: i, cell, facing: plan?.facing,
        }).ok) {
          this.builds += 1;
          return;
        }
        if (sim.meat.war >= B.discardCost + 10) {
          sim.issue({ kind: 'discard', cardIndex: i });
          return;
        }
        continue;
      }
      // A second sling or lobber sits idle — shed the surplus cheaply.
      const cap = SURPLUS_CAP[fam];
      if (cap !== undefined && sim.towers.filter((t) => t.family === fam).length >= cap) {
        if (sim.meat.war >= B.discardCost + 10) sim.issue({ kind: 'discard', cardIndex: i });
        return;
      }
      // A pit that found no lane road this act waits its turn rather than block the hand.
      if (fam === 'swamp') continue;
      if (tryBuild(i)) return;
      return;
    }

    // Hand clogged with cards we cannot pay for while meat piles up: discard one.
    if (sim.meat.war >= 25) {
      for (let i = 0; i < sim.hand.length; i++) {
        if (!sim.canAfford(towerSpec(sim.hand[i].family).cost)) {
          sim.issue({ kind: 'discard', cardIndex: i });
          return;
        }
      }
    }
  }

  /** A rough damage-per-second read of a limb (for choosing between evolutions). */
  private dpsOf(sim: Sim, t: Tower): number {
    const s = sim.statsOf(t);
    const hit = s.damage * s.volley * (1 + s.extraTargets) * (1 + 0.5 * s.chains) * (1 + s.aoe / 40) * (1 + 0.3 * s.skips);
    const dots = s.poisonDps * s.poisonDur + s.burnDps * s.burnDur;
    const control = (1 - s.slowMult) * 10 + s.shred + s.execute * 0.3 + s.grounding * 3;
    return s.rate * (hit + dots + control) * (1 + s.reach) * (s.hitsAir ? 1.2 : 1) * (s.hitsGround ? 1 : 0.6);
  }

  private stage3Ready(sim: Sim): boolean {
    return sim.towers.some((t) => (t.upgrades?.length ?? 0) === 2);
  }

  /** Evolve the best-killing limb that can afford its next stage, taking the option that reads stronger. */
  private tryEvolve(sim: Sim): boolean {
    const guns = sim.towers
      .filter((t) => towerSpec(t.family).rate > 0 && !towerSpec(t.family).engine && (t.upgrades?.length ?? 0) < 3)
      .sort((a, b) => b.kills - a.kills || a.id - b.id);
    for (const t of guns.slice(0, 4)) {
      const stage = t.upgrades?.length ?? 0;
      if (!sim.canAfford(UPGRADE_COST[stage])) continue;
      const before = t.upgrades;
      let best: UpgradeChoice = 'A';
      let bestScore = -Infinity;
      for (const c of ['A', 'B'] as UpgradeChoice[]) {
        t.upgrades = [...(before ?? []), c];
        const score = this.dpsOf(sim, t);
        if (score > bestScore) { bestScore = score; best = c; }
      }
      t.upgrades = before;
      if (sim.issue({ kind: 'evolve', towerId: t.id, choice: best }).ok) return true;
    }
    return false;
  }

  /**
   * Chokepoint-aware placement: shooters go on buildable cells ADJACENT to a
   * street (covering traffic without blocking it); spine walls go ON a street
   * to force detours. Prefers cells the flow actually crosses near the core.
   */
  /** Cells on the marching routes to the core, with multiplicity: EVERY frontier
   *  gate's route counts (the telegraph alternates — chasing only the current one
   *  leaves last wave's guns pointing the wrong way), telegraphed lanes count
   *  extra, and MERGE points where routes share a street shine brightest. */
  private lanePathCells(sim: Sim): Map<number, number> {
    const path = new Map<number, number>();
    const walk = (gate: number, w: number) => {
      let c = gate;
      let guard = 0;
      while (c >= 0 && guard++ < 500) {
        path.set(c, (path.get(c) ?? 0) + w);
        c = sim.flowNextOf(c);
      }
    };
    for (const gate of sim.incomingGates) walk(gate, 1);
    return path;
  }

  /** A buildable STREET cell on the telegraphed march, as far out as the creep reaches. */
  private laneRoadCell(sim: Sim, family: 'spine' | 'swamp' = 'spine'): number | null {
    let best: number | null = null;
    let bestCd = -1;
    for (const gate of sim.incomingGates) {
      let c = gate;
      let guard = 0;
      while (c >= 0 && guard++ < 500) {
        if (sim.map.cells[c] === CellType.Road && sim.canBuildTower(c, family)) {
          const cd = sim.creepDistOf(c);
          if (cd > bestCd) { bestCd = cd; best = c; }
        }
        c = sim.flowNextOf(c);
      }
    }
    return best;
  }

  /**
   * The real TD skill, made explicit: score a block by how many DISTINCT
   * street cells sit within tower range — switchback pockets score double —
   * with a bonus when those street cells are on the telegraphed lanes.
   */
  /** Cells under the straight gate->core lines — where the FLIERS come. */
  private airLaneCells(sim: Sim): Set<number> {
    const air = new Set<number>();
    for (const gate of sim.incomingGates) {
      const a = sim.cellCenter(gate);
      const steps = Math.ceil(Math.hypot(sim.core.x - a.x, sim.core.y - a.y) / sim.cfg.cellPx);
      for (let i = 0; i <= steps; i++) {
        const x = a.x + ((sim.core.x - a.x) * i) / steps;
        const y = a.y + ((sim.core.y - a.y) * i) / steps;
        air.add(sim.cellAt(x, y));
      }
    }
    return air;
  }

  private findTowerCell(sim: Sim, asBlocker: boolean, interiorOnly = false): number | null {
    const w = sim.cfg.gridW;
    const lane = this.lanePathCells(sim);
    const air = this.airLaneCells(sim);
    const rangeCells = 3; // ~95px on 32px cells
    const candidates: Array<{ cell: number; score: number }> = [];
    for (let cell = 0; cell < sim.map.cells.length; cell++) {
      if (!sim.canBuildTower(cell, asBlocker ? 'spine' : undefined)) continue;
      if (interiorOnly && (sim.creepDistOf(cell) < 0 || sim.creepDistOf(cell) > 5)) continue;
      if (asBlocker) {
        if (sim.map.cells[cell] !== CellType.Road) continue;
      } else if (sim.map.cells[cell] === CellType.Road) continue;
      const cx = cell % w;
      const cy = Math.floor(cell / w);
      let coverage = 0;
      let laneCoverage = 0;
      let airCoverage = 0;
      for (let dy = -rangeCells; dy <= rangeCells; dy++) {
        for (let dx = -rangeCells; dx <= rangeCells; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= sim.cfg.gridH) continue;
          if (dx * dx + dy * dy > rangeCells * rangeCells) continue;
          const nb = ny * w + nx;
          if (sim.map.cells[nb] === CellType.Road) {
            coverage += 1;
            laneCoverage += lane.get(nb) ?? 0; // merge points count double+
          }
          if (air.has(nb)) airCoverage += 1; // fliers cross HERE, blocks or not
        }
      }
      if (coverage === 0 && airCoverage === 0) continue;
      // Verticality: a taller perch shoots further — worth real points.
      const height = sim.map.heights[cell] || 1;
      const score = coverage + laneCoverage * 2 + Math.min(airCoverage, 4) * 1.5
        + (height - 1) * 2 + this.rng.float(0, 1.2);
      candidates.push({ cell, score });
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score || a.cell - b.cell);
    return candidates[0].cell;
  }

  /** Ward: the block that shields the most unwarded guns, preferring cells OFF the lanes (don't take a gun's perch). */
  private wardCell(sim: Sim, guns: Array<{ id: number; pos: { x: number; y: number }; shieldMax?: number }>): number | null {
    const radius = towerSpec('ward').auraRadius ?? 0;
    const lane = this.lanePathCells(sim);
    let best: number | null = null;
    let bestScore = 0;
    for (let cell = 0; cell < sim.map.cells.length; cell++) {
      if (!sim.canBuildTower(cell) || sim.map.cells[cell] === CellType.Road) continue;
      const p = sim.cellCenter(cell);
      let covered = 0;
      for (const g of guns) {
        if ((g.shieldMax ?? 0) > 0) continue; // already under a ward
        if (Math.hypot(g.pos.x - p.x, g.pos.y - p.y) <= radius) covered++;
      }
      if (covered < 2) continue;
      let laneNear = 0;
      const w = sim.cfg.gridW;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nb = cell + dy * w + dx;
          if (nb >= 0 && nb < sim.map.cells.length && lane.has(nb)) laneNear++;
        }
      }
      const score = covered * 10 - laneNear;
      if (score > bestScore) { bestScore = score; best = cell; }
    }
    return best;
  }

  /**
   * Trial-place a combo engine at `cell` (a ghost limb, removed afterwards) and
   * measure, over the four headings, the best relative dps gain on its target.
   */
  private engineGain(sim: Sim, family: string, cell: number): { gain: number; facing: 'N' | 'E' | 'S' | 'W' } | null {
    const ghost = {
      id: -999, family: family as never, pos: sim.cellCenter(cell), cell,
      hp: 1, maxHp: 1, pips: [], cooldown: 0, kills: 0, facing: 'N' as 'N' | 'E' | 'S' | 'W',
    };
    let best: { gain: number; facing: 'N' | 'E' | 'S' | 'W' } | null = null;
    for (const dir of ['N', 'E', 'S', 'W'] as const) {
      ghost.facing = dir;
      const target = sim.conduitTarget(ghost);
      if (!target) continue;
      const before = sim.statsOf(target);
      sim.towers.push(ghost);
      const after = sim.statsOf(target);
      sim.towers.pop();
      const dpsB = before.damage * before.rate;
      const dpsA = after.damage * after.rate;
      const gain = dpsB > 0 ? dpsA / dpsB - 1 : 0;
      if (!best || gain > best.gain) best = { gain, facing: dir };
    }
    return best;
  }

  /** The best spot for an amplifier: around the carry (the limb with the most engines on it). */
  private ampSpot(sim: Sim): { cell: number; gain: number; facing: 'N' | 'E' | 'S' | 'W' } | null {
    let carry: { pos: { x: number; y: number } } | null = null;
    let most = 0;
    for (const t of sim.towers) {
      if (towerSpec(t.family).engine) continue;
      const fed = sim.towers.filter((c) => towerSpec(c.family).engine && sim.conduitTarget(c) === t).length;
      if (fed > most) { most = fed; carry = t; }
    }
    if (!carry) return null;
    const near: number[] = [];
    for (let cell = 0; cell < sim.map.cells.length; cell++) {
      if (!sim.canBuildTower(cell) || sim.map.cells[cell] === CellType.Road) continue;
      const p = sim.cellCenter(cell);
      if (Math.hypot(p.x - carry.pos.x, p.y - carry.pos.y) <= 150) near.push(cell);
    }
    near.sort((a, b) => {
      const pa = sim.cellCenter(a);
      const pb = sim.cellCenter(b);
      return Math.hypot(pa.x - carry!.pos.x, pa.y - carry!.pos.y) - Math.hypot(pb.x - carry!.pos.x, pb.y - carry!.pos.y);
    });
    let best: { cell: number; gain: number; facing: 'N' | 'E' | 'S' | 'W' } | null = null;
    for (const cell of near.slice(0, 24)) {
      const g = this.engineGain(sim, 'amp', cell);
      if (g && (!best || g.gain > best.gain)) best = { cell, ...g };
    }
    return best;
  }

  /**
   * The combo line: pick ONE carry and point every engine at it. Among the
   * four headings, prefer a limb other engines already feed (concentration is
   * what makes amplifiers pay: they only grow stacks of 2+), then raw dps.
   */
  private aimConduit(sim: Sim, c: { id: number; family: string }): void {
    let best: 'N' | 'E' | 'S' | 'W' | null = null;
    let bestKey = -1;
    for (const dir of ['N', 'E', 'S', 'W'] as const) {
      sim.issue({ kind: 'set-facing', towerId: c.id, dir });
      const t = sim.conduitTarget(sim.towers.find((x) => x.id === c.id)!);
      if (!t) continue;
      const st = sim.statsOf(t);
      const fedBy = sim.towers.filter((o) => o.id !== c.id && towerSpec(o.family).engine && sim.conduitTarget(o) === t).length;
      const key = fedBy * 1e6 + st.damage * st.rate;
      if (key > bestKey) { bestKey = key; best = dir; }
    }
    if (best) sim.issue({ kind: 'set-facing', towerId: c.id, dir: best });
  }

  /** Bombard: deep and high — its reach covers the lanes from the safety of the body. */
  private bombardCell(sim: Sim): number | null {
    let best: number | null = null;
    let bestScore = -Infinity;
    for (let cell = 0; cell < sim.map.cells.length; cell++) {
      if (!sim.canBuildTower(cell) || sim.map.cells[cell] === CellType.Road) continue;
      const cd = sim.creepDistOf(cell);
      if (cd < 0) continue;
      const score = -cd + (sim.map.heights[cell] || 1) * 3;
      if (score > bestScore) { bestScore = score; best = cell; }
    }
    return best;
  }

}
