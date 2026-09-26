/**
 * Scripted autoplayer: drives a Sim with a simple policy. Used by the headless
 * full-run tests and by the browser demo mode (?auto=1). Deterministic given its seed.
 */
import { Rng } from './rng';
import { Sim, towerSpec, organSpec } from './sim';
import type { OrganId } from './types';

export class Autoplayer {
  private rng: Rng;
  private actTimer = 0;
  private buildsSinceCannibalize = 0;

  constructor(seed: number) {
    this.rng = new Rng(seed);
  }

  /** Call once per sim tick; acts every ~1.5 sim seconds. */
  act(sim: Sim, dt: number): void {
    if (sim.outcome !== 'playing') return;
    this.actTimer -= dt;
    if (this.actTimer > 0) return;
    this.actTimer = 1.5;

    // Royal surge whenever affordable.
    if (sim.meat.royal >= 50) sim.issue({ kind: 'royal-surge' });

    // Organs in priority order.
    if (this.tryOrgan(sim, 'heart', 1)) return;
    if (sim.time > 90 && this.tryOrgan(sim, 'gland', 1)) return;
    if (sim.time > 140 && this.tryOrgan(sim, 'brain', 1)) return;
    if (sim.time > 180 && this.tryOrgan(sim, 'heart', 2)) return;
    if (sim.time > 320 && this.tryOrgan(sim, 'heart', 3)) return;

    // Keep the gland on lure once built (cycle calm -> lure).
    const gland = sim.organs.find((o) => o.organ === 'gland');
    if (gland && gland.glandMode === 'calm' && sim.time > 100) {
      sim.issue({ kind: 'cycle-gland', organInstanceId: gland.id });
    }

    // Towers: play the first affordable card onto the frontier ring.
    for (let i = 0; i < sim.hand.length; i++) {
      const spec = towerSpec(sim.hand[i].family);
      if (!sim.canAfford(spec.cost)) continue;
      const cell = this.findTowerCell(sim);
      if (cell === null) return;
      let cannibalizeTowerId: number | undefined;
      this.buildsSinceCannibalize += 1;
      if (this.buildsSinceCannibalize >= 4 && sim.towers.length > 7) {
        // Feed the oldest basic tower into this build.
        const donor = sim.towers.find((t) => t.family === 'spitter' || t.family === 'spine');
        if (donor) {
          cannibalizeTowerId = donor.id;
          this.buildsSinceCannibalize = 0;
        }
      }
      sim.issue({ kind: 'build', cardIndex: i, cell, cannibalizeTowerId });
      return;
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

  private findTowerCell(sim: Sim): number | null {
    for (let tries = 0; tries < 40; tries++) {
      const angle = this.rng.float(0, Math.PI * 2);
      const rMax = Math.min(sim.creepRadius - 10, sim.bodyRadius + 130);
      const r = this.rng.float(sim.bodyRadius + 15, Math.max(sim.bodyRadius + 25, rMax));
      const x = sim.core.x + Math.cos(angle) * r;
      const y = sim.core.y + Math.sin(angle) * r;
      if (x < 0 || y < 0 || x >= sim.worldW || y >= sim.worldH) continue;
      const cell = sim.cellAt(x, y);
      if (sim.canBuildTower(cell)) return cell;
    }
    return null;
  }

  private findOrganCell(sim: Sim): number | null {
    for (let tries = 0; tries < 40; tries++) {
      const angle = this.rng.float(0, Math.PI * 2);
      const r = this.rng.float(50, Math.max(52, sim.bodyRadius - 8));
      const x = sim.core.x + Math.cos(angle) * r;
      const y = sim.core.y + Math.sin(angle) * r;
      const cell = sim.cellAt(x, y);
      if (sim.canBuildOrgan(cell)) return cell;
    }
    return null;
  }
}
