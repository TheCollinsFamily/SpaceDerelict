/**
 * THE CORE EVOLVES (Collins, Sep 30 2026: "the central node should 'evolve' after certain numbers
 * of towers are built"). Purely a look: the sim is not touched, nothing plays differently.
 *
 * A stage is reached by limbs GROWN this run (sim.stats.limbsGrown), not limbs standing, so a stage
 * is never lost when limbs die or are cannibalized. Every run starts at stage 1. Measured over the
 * scripted player's 10 seeds (Sep 30 2026): 6 grown by about wave 2-3, 18 by wave 5-6, 40 by wave 8;
 * a won 12-wave run grows 90-126. The art (tools/art/templates/core-evo.mjs STAGES) carries the same
 * numbers; tests/core-evo.test.ts holds the two together.
 */
export const CORE_STAGE_GROWN = [0, 6, 18, 40] as const;
export const CORE_STAGE_NAMES = ['the landing', 'rooted', 'chambered', 'the citadel'] as const;

/**
 * The stage (1-4) of a core whose body has grown this many limbs. `floor`: a run that opens with its
 * core already grown (a defence deployment opens at stage 3, `SimConfig.coreStage`; src/meta/defence.ts).
 */
export function coreStageOf(grown: number, floor = 1): number {
  let stage = Math.max(1, Math.min(CORE_STAGE_GROWN.length, floor));
  CORE_STAGE_GROWN.forEach((g, i) => { if (grown >= g) stage = Math.max(stage, i + 1); });
  return stage;
}
