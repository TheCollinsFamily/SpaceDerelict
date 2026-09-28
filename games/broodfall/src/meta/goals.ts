/**
 * Goals over a run: the Requisition Board, the dares, the experiments' goals.
 * A goal is a MEASURE (content/campaign.ts) compared with a target.
 */
import type { GoalDef } from '../../content/campaign';
import type { RunStats, TowerFamily } from '../sim/types';

/** What a finished run reports to the campaign. */
export interface RunReport {
  won: boolean;
  wavesCleared: number;
  coreEndFrac: number;
  scienceBanked: number;
  stats: RunStats;
}

export interface GoalInstance {
  def: GoalDef;
  target: number;
}

export interface GoalResult extends GoalInstance {
  value: number;
  met: boolean;
}

/** The goal at a territory's tier (targets grow with the tier). */
export function instance(def: GoalDef, tier: number): GoalInstance {
  const scale = def.tierScale ?? 0.25;
  return { def, target: Math.round(def.target * (1 + scale * tier)) };
}

/** The goal's text with its target filled in. */
export function goalText(g: GoalInstance): string {
  return g.def.text.replace('{n}', String(g.target));
}

/** Read a measure off a run. */
export function measure(m: string, r: RunReport): number {
  const [kind, arg] = m.split(':');
  const s = r.stats;
  switch (kind) {
    case 'kills':
      return arg === 'any'
        ? Object.values(s.kills).reduce((a, b) => a + (b ?? 0), 0)
        : s.kills[arg as keyof typeof s.kills] ?? 0;
    case 'family': return s.killsByFamily[arg as TowerFamily] ?? 0;
    case 'cause': return s.killsByCause[arg] ?? 0;
    case 'stat': {
      if (arg === 'scienceBanked') return r.scienceBanked;
      const v = (s as unknown as Record<string, unknown>)[arg];
      return typeof v === 'number' ? v : 0;
    }
    case 'coreEnd': return Math.round(r.coreEndFrac * 100);
    case 'families': return s.families.length;
    case 'only': return s.families.length > 0 && s.families.every((f) => f === arg) ? 1 : 0;
    case 'lastWaveCreepOnly': {
      const kills = Object.entries(s.lastWaveKillsByCause);
      return kills.length > 0 && kills.every(([c]) => c === 'creep') ? 1 : 0;
    }
    case 'won': return r.won ? 1 : 0;
    case 'coreLowWin': return r.won && s.coreMinFrac < 0.1 ? 1 : 0;
    default: return 0;
  }
}

export function evaluate(goals: GoalInstance[], r: RunReport): GoalResult[] {
  return goals.map((g) => {
    const value = measure(g.def.measure, r);
    const hit = (g.def.cmp ?? '>=') === '<=' ? value <= g.target : value >= g.target;
    return { ...g, value, met: hit && (!g.def.needsWin || r.won) };
  });
}
