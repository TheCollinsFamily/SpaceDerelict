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
 *   node tools/art/make.mjs biome megacity orient         tile sets (none named: every one)
 *   node tools/art/make.mjs ship
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
    return settle(ids, flags.has('--views') || flags.has('--bake') ? 5 : 3, (id) => makeUnit(id, {
      bakeOnly: flags.has('--bake'), viewsOnly: flags.has('--views'),
      anims: ['walk', ...(flags.has('--attack') ? ['attack'] : []), ...(flags.has('--death') ? ['death'] : [])],
    }));
  },
  limb: async () => {
    const { makeLimb } = await import('./templates/limb.mjs');
    return settle(ids, 4, (id) => makeLimb(id, { bakeOnly: flags.has('--bake') }));
  },
  terrain: async () => {
    const { makeTerrain } = await import('./templates/terrain.mjs');
    return Promise.allSettled([makeTerrain({ bakeOnly: flags.has('--bake'), only: ids })]);
  },
  biome: async () => {
    const { ALL_BIOMES, makeBiome } = await import('./templates/biome.mjs');
    const parts = ids.filter((id) => !ALL_BIOMES.includes(id));
    const sets = ids.filter((id) => ALL_BIOMES.includes(id));
    return settle(sets.length ? sets : ALL_BIOMES, 3, (id) => makeBiome(id, { bakeOnly: flags.has('--bake'), only: parts }));
  },
  ship: async () => {
    const { makeShip } = await import('./templates/ship.mjs');
    return Promise.allSettled([makeShip({ bakeOnly: flags.has('--bake'), only: ids })]);
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
