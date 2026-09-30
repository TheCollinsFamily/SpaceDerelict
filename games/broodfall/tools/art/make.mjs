/**
 * Makes game art from the templates. SPENDS RFab tokens; every step skips what already
 * exists, so running it again costs nothing and only bakes.
 *
 *   node tools/art/make.mjs unit soldier militia          one or more units, walking (5 clips each)
 *   node tools/art/make.mjs unit soldier --attack         and attacking (5 more clips)
 *   node tools/art/make.mjs unit soldier --bake           bake again from the clips on disk (free)
 *   node tools/art/make.mjs unit soldier --views          stop after the five views (one picture)
 *   node tools/art/make.mjs limb spitter lasher
 *   node tools/art/make.mjs terrain
 *   node tools/art/make.mjs fx [sheets|parts [families]]  effects in flight, bursts, clouds; the donor parts
 *   node tools/art/make.mjs biome megacity orient         tile sets (none named: every one)
 *   node tools/art/make.mjs ship
 *   node tools/art/make.mjs yoke idle happy --stills      the ship AI's body (tools/art/templates/yoke.mjs)
 *   node tools/art/make.mjs screens                       the title emblem + key art, the report pictures
 *
 * Raw pictures and clips: art-src/ (not committed). Baked: public/art/. To look at:
 * notes/art-review/.
 */
import { balance, pool, ready, spent } from './rfab.mjs';

/** A few assets at a time (each makes several clips at once itself). */
const settle = async (list, size, worker) => (await pool(list, size, worker))
  .map((r) => (r.ok ? { status: 'fulfilled', value: r.value } : { status: 'rejected', reason: r.error }));

const [what, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith('--')));
const ids = rest.filter((a) => !a.startsWith('--'));
const TEMPLATES = {
  unit: async () => {
    const { makeUnit } = await import('./templates/unit.mjs');
    // ART_POOL set: one unit at a time, so no more clips are made at once than ART_POOL.
    return settle(ids, flags.has('--views') || flags.has('--bake') ? 5 : process.env.ART_POOL ? 1 : 3, (id) => makeUnit(id, {
      bakeOnly: flags.has('--bake'), viewsOnly: flags.has('--views'), clipsOnly: flags.has('--no-bake'),
      // --hit: flinches (5 views); --boss: arrival and special attack (royal, consort); --braced: the braced
      // picture and its firing clip (cannon, dartgun); --skins: walking sets of a unit's other looks (carapace).
      anims: ['walk', ...['attack', 'death', 'states', 'hit', 'boss', 'braced', 'skins'].filter((a) => flags.has(`--${a}`))],
    }));
  },
  limb: async () => {
    const { makeLimb } = await import('./templates/limb.mjs');
    return settle(ids, 4, (id) => makeLimb(id, { bakeOnly: flags.has('--bake'), stillsOnly: flags.has('--stills') }));
  },
  // What flies, bursts and hangs in the air, and the donor parts (tools/art/templates/fx.mjs): fx [sheets|parts [families]].
  fx: async () => {
    const { makeFx } = await import('./templates/fx.mjs');
    return Promise.allSettled([makeFx({ bakeOnly: flags.has('--bake'), only: ids })]);
  },
  terrain: async () => {
    const { makeTerrain } = await import('./templates/terrain.mjs');
    return Promise.allSettled([makeTerrain({ bakeOnly: flags.has('--bake'), only: ids })]);
  },
  biome: async () => {
    const { ALL_BIOMES, makeBiome } = await import('./templates/biome.mjs');
    const parts = ids.filter((id) => !ALL_BIOMES.includes(id));
    const sets = ids.filter((id) => ALL_BIOMES.includes(id));
    // --backs: draw the backs of the props (the sheets turned half a turn), then bake.
    if (flags.has('--backs')) {
      const { generateBacks, bakeBiome } = await import('./templates/biome.mjs');
      return settle(sets.length ? sets : ALL_BIOMES, 3, async (id) => { await generateBacks(id); return bakeBiome(id); });
    }
    return settle(sets.length ? sets : ALL_BIOMES, 3, (id) => makeBiome(id, { bakeOnly: flags.has('--bake'), only: parts }));
  },
  // The organ stage as the ship's ground scan (tools/art/templates/under.mjs): one tile per organ, soil, deposit.
  under: async () => {
    const { makeUnder } = await import('./templates/under.mjs');
    return Promise.allSettled([makeUnder({ bakeOnly: flags.has('--bake'), only: ids })]);
  },
  ship: async () => {
    const { makeShip } = await import('./templates/ship.mjs');
    return Promise.allSettled([makeShip({ bakeOnly: flags.has('--bake'), only: ids })]);
  },
  // The title's emblem and key art, and the end-of-run report's pictures (tools/art/templates/screens.mjs).
  screens: async () => {
    const { makeScreens } = await import('./templates/screens.mjs');
    return Promise.allSettled([makeScreens({ bakeOnly: flags.has('--bake'), only: ids })]);
  },
  // The ship AI's body for RFab's Living Avatars: --stills to look before paying for clips, --publish to save her on RFab.
  yoke: async () => {
    const { makeYoke } = await import('./templates/yoke.mjs');
    const opt = (name) => [...flags].find((f) => f.startsWith(`--${name}=`))?.slice(name.length + 3);
    return Promise.allSettled([makeYoke({
      bakeOnly: flags.has('--bake'), stillsOnly: flags.has('--stills'), publish: flags.has('--publish'),
      only: ids, voiceId: opt('voice'), model: opt('model'),
    })]);
  },
};
if (!TEMPLATES[what]) {
  console.error(`usage: node tools/art/make.mjs <${Object.keys(TEMPLATES).join('|')}> [ids...] [--bake]`);
  process.exit(1);
}
ready();
const before = flags.has('--bake') ? null : await balance().catch(() => null);
const results = await TEMPLATES[what]();
results.forEach((r, i) => { if (r.status === 'rejected') console.log(`FAILED ${ids[i] ?? what}: ${r.reason.message}`); });
if (before !== null) {
  const after = await balance().catch(() => null);
  if (after !== null) console.log(`spent ${before - after} tokens ($${((before - after) * 0.00002).toFixed(2)}) on ${spent.stills} picture(s) and ${spent.clips} clip(s); ${after} tokens left`);
}
process.exit(results.some((r) => r.status === 'rejected') ? 1 : 0);
