/**
 * DEFENCE DEPLOYMENTS — the numbers (pure data; the rules are src/meta/defence.ts; DESIGN.md
 * "Defence deployments"). Collins, Oct 1 2026: "think through the defense missions ... they usually
 * suck to do so we should always visually warn the player one 'turn' ahead ... you can choose to just
 * attack that territory to cancel having to play one ... a type three core already at the center and a
 * bunch of currency already and only last one turn (to make them different from other missions)".
 *
 * Measured with the scripted player over ten seeds: tools/measure/defence.measure.ts.
 */
export const DEFENCE = {
  /** The core opens at this stage of its four (src/render/coreStage.ts: 'chambered'). */
  coreStage: 3,
  /** And the meteor at this level (a body that has been here a while). */
  coreLevel: 2,
  /** What the body has banked when the alarm sounds, on top of any faction perks. */
  meat: { war: 200, science: 70, royal: 2 },
  /** ONE siege, sized like this wave of a full deployment (about 70 bodies)... */
  asWave: 11,
  /** ...and at least this tier of the response ladder (content/data.ts WAVE_TABLE: 5, the shield wall marches tended). */
  minTier: 5,
  /** Streets it comes down at once (a normal siege: 1-3 by tier; never more than the board has gates). */
  lanes: 4,
  /** Seconds to re-arm before it comes (a normal turn is BALANCE.growthSeconds; he can call it early). */
  armSeconds: 45,
  /** With no remembered board: a large city, grown before the run (src/sim/boardSnapshot.ts pregrow). */
  large: { gridW: 70, gridH: 50, districts: 14 },
  /** The siege, as the briefing names it. */
  brief: 'one all-out siege',
} as const;
