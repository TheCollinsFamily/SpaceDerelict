/**
 * The scripted players' organ-stage policy (shared by the autoplayer and the
 * placement guardrail's random player, so both play the same economy).
 * Early in each between-waves window: unlock the next theme, then a heart.
 * Just before the wave starts: spend what would be lost on theme levels.
 */
import { BALANCE as B } from '../../content/data';
import { DEPOSITS, ORGAN_BY_ID } from '../../content/underground';
import { Sim, organSpec, themeOf } from './sim';
import type { Rng } from './rng';
import type { OrganId } from './types';

export const THEME_ORDER: OrganId[] = ['gut', 'forge', 'lattice', 'venom', 'nerve', 'womb', 'marrow', 'resonance'];

/** Every legal (cell, rot) for an organ right now. */
function legalSpots(sim: Sim, organ: OrganId): Array<{ cell: number; rot: number; cells: number[] }> {
  const out: Array<{ cell: number; rot: number; cells: number[] }> = [];
  for (let cell = 0; cell < sim.under.cells.length; cell++) {
    for (let rot = 0; rot < 4; rot++) {
      if (!sim.canBuildOrgan(organ, cell, rot)) continue;
      out.push({ cell, rot, cells: sim.organFootprint(organ, cell, rot)! });
    }
  }
  return out;
}

/** Where an organ does the most: themes it touches (or zones), features, deposits. */
export function bestOrganSpot(sim: Sim, organ: OrganId, random?: Rng): { cell: number; rot: number } | null {
  const spots = legalSpots(sim, organ);
  if (spots.length === 0) return null;
  if (random) return spots[random.int(0, spots.length - 1)];
  const u = sim.under;
  const nodes = sim.themeNodes();
  const kind = ORGAN_BY_ID[organ].kind;
  const near = (cells: number[], other: number[], ring: number) => cells.some((c) => other.some((o) =>
    Math.max(Math.abs((c % u.w) - (o % u.w)), Math.abs(Math.floor(c / u.w) - Math.floor(o / u.w))) <= ring));
  let best = spots[0];
  let bestScore = -Infinity;
  for (const s of spots) {
    let score = 0;
    for (const n of nodes) {
      if (kind === 'zone' ? near(s.cells, n.cells, 2) : near(s.cells, n.cells, 1)) score += 10;
    }
    for (const c of s.cells) {
      for (const nb of [c - 1, c + 1, c - u.w, c + u.w]) {
        if (nb >= 0 && nb < u.cells.length && u.cells[nb].kind === 'feature') score += 8;
      }
      const d = u.cells[c];
      if (d.kind === 'deposit' && d.deposit && !d.claimed) {
        const p = DEPOSITS[d.deposit].now;
        score += (p.war ?? 0) / 5 + (p.science ?? 0) / 2 + (p.royal ?? 0) * 10 + (p.biomass ?? 0) / 30 + (p.pips ?? 0) * 4;
      }
      score -= Math.floor(c / u.w) * 0.1; // keep room below for later organs
    }
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return { cell: best.cell, rot: best.rot };
}

/** One organ-stage decision; true if it acted. */
export function organTurn(sim: Sim, random?: Rng): boolean {
  if (sim.phase !== 'growth') return false;
  const late = sim.phaseElapsed >= B.growthSeconds - 4;
  const have = (id: OrganId) => sim.organs.some((o) => o.organ === id);
  if (!late) {
    const next = THEME_ORDER.find((id) => !have(id));
    if (next && sim.canAfford(organSpec(next).cost)) {
      const spot = bestOrganSpot(sim, next, random);
      if (spot && sim.issue({ kind: 'build-organ', organ: next, ...spot }).ok) return true;
    }
    const themes = sim.organs.filter((o) => ORGAN_BY_ID[o.organ].kind === 'theme').length;
    const hearts = sim.organs.filter((o) => o.organ === 'heart').length;
    if (themes >= 2 && hearts < Math.floor(themes / 2) && sim.canAfford(organSpec('heart').cost)) {
      const spot = bestOrganSpot(sim, 'heart', random);
      if (spot && sim.issue({ kind: 'build-organ', organ: 'heart', ...spot }).ok) return true;
    }
    return false;
  }
  // Late: the wave is about to take whatever is left — level the theme with the most limbs.
  const count = new Map<string, number>();
  for (const t of sim.towers) count.set(themeOf(t.family), (count.get(themeOf(t.family)) ?? 0) + 1);
  const order = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([th]) => th);
  let acted = false;
  for (let guard = 0; guard < 12; guard++) {
    let did = false;
    for (const th of order) {
      const id = th === 'core' ? -1 : sim.organs.find((o) => o.organ === th)?.id;
      if (id === undefined) continue;
      if (sim.issue({ kind: 'upgrade-organ', organInstanceId: id }).ok) { did = true; acted = true; break; }
    }
    if (!did) break;
  }
  return acted;
}
