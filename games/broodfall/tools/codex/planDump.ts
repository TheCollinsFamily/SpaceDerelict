/**
 * The drawings the footprint plan (tools/codex/plan.mjs) asks for, counted from the game's own rules: for
 * every limb, each of its eight evolution paths ends in a look (content/upgradeLooks.ts lookOf) and, when the
 * path takes an evolution that changes what it does in space (plan.variants), in that look's VARIANT. Prints
 * JSON for tools/codex/sheet.mjs: { family: { looks: [...final looks], combos: ['bone', 'bone~Long Whips', ...] } }.
 *   node node_modules/vite-node/vite-node.mjs tools/codex/planDump.ts
 */
import { lookOf } from '../../content/upgradeLooks';
import { UPGRADES } from '../../content/upgrades';
import type { TowerFamily, UpgradeChoice } from '../../src/sim/types';
import { towerSpec } from '../../src/sim/sim';
import { footprintOf, type ShapeId } from '../../src/sim/footprint';
// @ts-expect-error plain JS data module
import { PLAN } from './plan.mjs';

const PATHS = ['AAA', 'AAB', 'ABA', 'ABB', 'BAA', 'BAB', 'BBA', 'BBB'] as const;
const out: Record<string, { looks: string[]; combos: string[]; variantBases: string[]; now: Array<[number, number]>; next: Array<[number, number]> }> = {};
/** A plan footprint id as the cells it takes facing south. */
const cellsOfPlan = (to: string): Array<[number, number]> => {
  const rect = to.match(/^(\d)x(\d)$/);
  return footprintOf(rect ? { span: [Number(rect[1]), Number(rect[2])] } : { shape: to as ShapeId }, 'S').cells;
};
for (const family of Object.keys(UPGRADES) as TowerFamily[]) {
  const variants: Array<[number, string, string]> = (PLAN[family]?.variants ?? []).map((v: [number, string, string]) => [v[0], v[1], v[2]]);
  const looks = new Set<string>();
  const combos = new Set<string>();
  const variantBases = new Set<string>();
  for (const path of PATHS) {
    const ups = [...path] as UpgradeChoice[];
    const key = lookOf({ family, upgrades: ups, pips: [] }).key ?? 'own';
    looks.add(key);
    const taken = variants.filter(([stage, choice]) => path[stage - 1] === choice).map((v) => v[2]);
    combos.add(taken.length ? `${key}~${taken.join('+')}` : key);
    // A variant taken at stage 1 or 2 is on the board before the path's look is earned: its look at that
    // stage is drawn too (the look its first one or two evolutions give).
    for (const [stage, choice, name] of variants) {
      if (stage >= 3 || path[stage - 1] !== choice) continue;
      const early = lookOf({ family, upgrades: ups.slice(0, stage), pips: [] }).key ?? 'own';
      variantBases.add(`${early}~${name}`);
    }
  }
  out[family] = {
    looks: [...looks].sort(), combos: [...combos].sort(), variantBases: [...variantBases].filter((v) => !combos.has(v)).sort(),
    now: footprintOf(towerSpec(family), 'S').cells,
    next: cellsOfPlan(PLAN[family]?.to ?? '1x1'),
  };
}
console.log(JSON.stringify(out));
