/**
 * Scripted autoplayer: drives a Sim with a chokepoint-aware policy. Used by the
 * headless full-run tests and the browser demo mode (?auto=1). Deterministic.
 */
import { Rng } from './rng';
import { Sim, towerSpec, organSpec } from './sim';
import { CellType } from './citymap';
import { BALANCE as B } from '../../content/data';
import type { OrganId } from './types';

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

    if (sim.meat.royal >= 50) sim.issue({ kind: 'royal-surge' });

    if (this.tryOrgan(sim, 'heart', 1)) return;
    if (sim.time > 90 && this.tryOrgan(sim, 'gland', 1)) return;
    if (sim.time > 140 && this.tryOrgan(sim, 'brain', 1)) return;
    if (sim.time > 180 && this.tryOrgan(sim, 'heart', 2)) return;
    if (sim.time > 320 && this.tryOrgan(sim, 'heart', 3)) return;

    const gland = sim.organs.find((o) => o.organ === 'gland');
    if (gland && gland.glandMode === 'calm' && sim.time > 100) {
      sim.issue({ kind: 'cycle-gland', organInstanceId: gland.id });
    }

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
      for (const e of sim.enemies) {
        if (e.kind === 'researcher') continue;
        const dc = Math.hypot(e.pos.x - sim.core.x, e.pos.y - sim.core.y);
        const dl = Math.hypot(e.pos.x - lobber.pos.x, e.pos.y - lobber.pos.y);
        if (dl <= B.lobberRange && dc < bd) { bd = dc; aim = e.pos; }
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
    for (const streetFamily of ['spine', 'pit'] as const) {
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
      if (fam === 'ward' || fam === 'bombard') {
        const have = sim.towers.filter((t) => t.family === fam).length;
        const cap = fam === 'ward' ? Math.floor(guns.length / 4) : Math.min(2, Math.floor(guns.length / 5));
        const cell = have < cap ? (fam === 'ward' ? this.wardCell(sim, guns) : this.bombardCell(sim)) : null;
        if (cell !== null && sim.issue({ kind: 'build', cardIndex: i, cell }).ok) {
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
      if (fam === 'pit') continue;
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

  private tryOrgan(sim: Sim, organ: OrganId, upTo: number): boolean {
    const have = sim.organs.filter((o) => o.organ === organ).length;
    if (have >= upTo) return false;
    if (!sim.canAfford(organSpec(organ).cost)) return false;
    const cell = this.findOrganCell(sim);
    if (cell === null) return false;
    return sim.issue({ kind: 'build-organ', organ, cell }).ok;
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
  private laneRoadCell(sim: Sim, family: 'spine' | 'pit' = 'spine'): number | null {
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

  private findOrganCell(sim: Sim): number | null {
    const options: number[] = [];
    for (let cell = 0; cell < sim.map.cells.length; cell++) {
      if (sim.canBuildOrgan(cell)) options.push(cell);
    }
    if (options.length === 0) return null;
    return options[this.rng.int(0, options.length - 1)];
  }
}
