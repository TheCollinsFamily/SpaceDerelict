/**
 * Scripted autoplayer: drives a Sim with a chokepoint-aware policy. Used by the
 * headless full-run tests and the browser demo mode (?auto=1). Deterministic.
 */
import { Rng } from './rng';
import { Sim, towerSpec, organSpec } from './sim';
import { CellType } from './citymap';
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

    // Technique: a spine card in hand plugs the telegraphed lane itself,
    // holding the swarm inside the shooters' kill zone.
    const spineIdx = sim.hand.findIndex((c) => c.family === 'spine');
    if (spineIdx >= 0 && sim.canAfford(towerSpec('spine').cost)) {
      const laneRoad = this.laneRoadCell(sim);
      if (laneRoad !== null) {
        if (sim.issue({ kind: 'build', cardIndex: spineIdx, cell: laneRoad }).ok) {
          this.builds += 1;
          return;
        }
      }
    }

    for (let i = 0; i < sim.hand.length; i++) {
      const spec = towerSpec(sim.hand[i].family);
      if (!sim.canAfford(spec.cost)) continue;
      const wantsBlocker = sim.hand[i].family === 'spine';
      const cell = this.findTowerCell(sim, wantsBlocker);
      if (cell === null) return;
      let cannibalizeTowerId: number | undefined;
      this.buildsSinceCannibalize += 1;
      if (this.buildsSinceCannibalize >= 4 && sim.towers.length > 7) {
        const donor = sim.towers.find((t) => t.family === 'spitter' || t.family === 'spine');
        if (donor) {
          cannibalizeTowerId = donor.id;
          this.buildsSinceCannibalize = 0;
        }
      }
      if (sim.issue({ kind: 'build', cardIndex: i, cell, cannibalizeTowerId }).ok) this.builds += 1;
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
  /** Cells on the marching route from the telegraphed gates to the core. */
  private lanePathCells(sim: Sim): Set<number> {
    const path = new Set<number>();
    for (const gate of sim.incomingGates) {
      let c = gate;
      let guard = 0;
      while (c >= 0 && guard++ < 500) {
        path.add(c);
        c = sim.flowNextOf(c);
      }
    }
    return path;
  }

  /** A buildable STREET cell on the telegraphed march, as far out as the creep reaches. */
  private laneRoadCell(sim: Sim): number | null {
    let best: number | null = null;
    let bestCd = -1;
    for (const gate of sim.incomingGates) {
      let c = gate;
      let guard = 0;
      while (c >= 0 && guard++ < 500) {
        if (sim.map.cells[c] === CellType.Road && sim.canBuildTower(c, 'spine')) {
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
  private findTowerCell(sim: Sim, asBlocker: boolean): number | null {
    const w = sim.cfg.gridW;
    const lane = this.lanePathCells(sim);
    const rangeCells = 3; // ~95px on 32px cells
    const candidates: Array<{ cell: number; score: number }> = [];
    for (let cell = 0; cell < sim.map.cells.length; cell++) {
      if (!sim.canBuildTower(cell, asBlocker ? 'spine' : undefined)) continue;
      if (asBlocker) {
        if (sim.map.cells[cell] !== CellType.Road) continue;
      } else if (sim.map.cells[cell] === CellType.Road) continue;
      const cx = cell % w;
      const cy = Math.floor(cell / w);
      let coverage = 0;
      let laneCoverage = 0;
      for (let dy = -rangeCells; dy <= rangeCells; dy++) {
        for (let dx = -rangeCells; dx <= rangeCells; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= sim.cfg.gridH) continue;
          if (dx * dx + dy * dy > rangeCells * rangeCells) continue;
          const nb = ny * w + nx;
          if (sim.map.cells[nb] === CellType.Road) {
            coverage += 1;
            if (lane.has(nb)) laneCoverage += 1;
          }
        }
      }
      if (coverage === 0) continue;
      // Verticality: a taller perch shoots further — worth real points.
      const height = sim.map.heights[cell] || 1;
      const score = coverage + laneCoverage * 2 + (height - 1) * 2 + this.rng.float(0, 1.2);
      candidates.push({ cell, score });
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score || a.cell - b.cell);
    return candidates[0].cell;
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
