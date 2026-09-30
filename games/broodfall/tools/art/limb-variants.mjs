/**
 * UPGRADE LOOKS: the drawn variants of a limb (Collins, Sep 30 2026; DESIGN.md "Upgrade looks",
 * notes/UPGRADE-LOOKS.md, the classes in content/upgradeLooks.ts). A limb shows its CLASS look
 * (bone, swarm, venom, reach) when it carries enough of one class, and a SUPERSTRUCTURE when it
 * carries two. Each variant is its own picture, redrawn from the limb's approved picture
 * (art-src/limbs/<family>/styled.png) by an image edit, then the limb's own idle and firing clips
 * (and its view from behind, when the limb has one), keyed and baked like the limb itself.
 *
 * Raw files: art-src/limbs/<family>-variants/<key>/ (styled.png, idle.mp4, fire.mp4, back.png, ...).
 * Baked: public/art/limbs/<family>--<key>.webp; manifest limbs.<family>.variants.<key>.
 *
 *   node tools/art/make.mjs variant spitter lasher frond --stills   the pictures only, to look at
 *   node tools/art/make.mjs variant spitter                         pictures, clips, bake
 *   node tools/art/make.mjs variant spitter --bake                  bake again (free)
 *   node tools/art/feet.mjs --variants spitter@bone                 mark where it stands
 *   node tools/art/muzzles.mjs --variants spitter@bone              mark where it fires from
 *
 * The marks (`foot`, `backFoot`, `muzzle`, `backMuzzle`) mean what they mean in tools/art/limbs.mjs:
 * shares of the box that holds the variant in the first frame of its idle clip, read off the sheets.
 */
import { limb } from './limbs.mjs';

/**
 * The edit. It keeps what the game relies on (the camera, the base where it stands, the direction
 * it faces, the creep's own flesh) and changes the silhouette, which is what reads at game zoom.
 */
export const EDIT =
  'Edit the organism in the reference picture. It is the SAME organism, grown: the same camera (isometric, from ' +
  '45 degrees above), the same direction it faces (toward the lower left), the same deep maroon and dark crimson ' +
  'veined creep flesh with small glossy highlights, the same plates of dark chitin, and the same low ragged skirt of ' +
  'roots lying flat on the ground, in the same place and at the same size in the picture. What changes: ';
export const EDIT_END =
  ' Its new outline must read clearly different from the original even when seen very small. Realistic, detailed ' +
  'creature design, wet and unglamorous. Soft even light from directly overhead, no cast shadows. No text, no ' +
  'letters, no numbers, no symbols.';

/** A variant whose accent is yellow-green (venom) is drawn on blue, so the key never eats it. */
export const KEYS = { green: { hex: '00FF00', name: 'green' }, blue: { hex: '0000FF', name: 'blue' } };

/**
 * Per limb, per variant: `change` (what the edit says grows), `key` (its background), the marks, and
 * `size` (drawn that much bigger than its ground calls for: a superstructure towers over its block).
 * A superstructure's key is its pair (`swarm+venom`); tools/art/templates/limb-variant.mjs draws it.
 */
export const VARIANTS = {
  spitter: {
    bone: { key: 'green', foot: [0.49, 0.76, 0.8], muzzle: [[0.36, 0.06]], backFoot: [0.51, 0.8, 0.75], backMuzzle: [[0.62, 0.03]],
      change: 'it is armoured and heavier. Thick overlapping plates of ivory bone clad its whole stalk like a cuirass, a crest of short curved ivory bone spikes rings the base of its nozzle and runs down its back, and its mound is broader and more massive. The puckered fleshy nozzle stays at its top, pointing up and forward.' },
    swarm: { key: 'green', foot: [0.5, 0.79, 0.76], muzzle: [[0.04, 0.19], [0.44, 0.03], [0.86, 0.19]], backFoot: [0.5, 0.79, 0.78], backMuzzle: [[0.18, 0.12], [0.48, 0.02], [0.82, 0.14]],
      idle: 'The organism breathes slowly and only slightly: its flesh swells and relaxes a little, its plates shift a little against each other. The three nozzles pucker and loosen one after another.',
      fire: 'The three nozzles clench shut, the stalks tighten, and all three spit a glob of dark fluid forward and up with a snap, then relax back to exactly their starting pose.',
      change: 'it has multiplied. Its single stalk has split into THREE shorter stalks fanning out from the one mound, each topped by its own puckered fleshy nozzle pointing up and forward, and small round fleshy buds cluster around its base.' },
    venom: { key: 'blue', foot: [0.48, 0.8, 0.8], muzzle: [[0.26, 0.07]], backFoot: [0.5, 0.81, 0.79], backMuzzle: [[0.65, 0.03]],
      change: 'it is swollen with venom. Big bulging acid yellow-green glands, glistening and faintly glowing, swell out between its plates and ring the neck under its nozzle, and a thick drop of yellow-green venom hangs from the rim of the puckered nozzle.' },
    reach: { key: 'green', foot: [0.5, 0.86, 0.83], muzzle: [[0.52, 0.03]], backFoot: [0.49, 0.85, 0.83], backMuzzle: [[0.53, 0.01]],
      change: 'it reaches farther. Its stalk is stretched half again as tall into a long upright neck of muscle with the puckered nozzle at its top, and glassy milky-white strands of mucus run from high on the neck down to the ground on both sides like taut guy-ropes, with two small pale eyes on the neck.' },
    'swarm+venom': { key: 'blue', foot: [0.51, 0.84, 0.8], size: 1.25, muzzle: [[0.25, 0.14], [0.47, 0.02], [0.69, 0.14], [0.18, 0.27], [0.53, 0.26]], backFoot: [0.5, 0.85, 0.8], backMuzzle: [[0.26, 0.1], [0.44, 0.01], [0.62, 0.12], [0.73, 0.23]],
      idle: 'The organism breathes slowly and only slightly: its swollen body and its glands swell and relax a little. The five nozzles pucker and loosen one after another.',
      fire: 'The five nozzles clench shut, the hive-like body tightens, and the nozzles spit globs of dark fluid forward and up one after another with a snap, then everything relaxes back to exactly its starting pose.',
      change: 'it has become a SUPERSTRUCTURE, a Spore Hive, half again as tall and much bigger than before: a swollen hive-like body raising FIVE puckered spitting nozzles on short necks in a ring, all pointing up and forward, the body studded all over with big bulging glistening acid yellow-green venom glands that glow faintly and drip.' },
  },
  lasher: {
    bone: { key: 'green', foot: [0.52, 0.83, 0.84],
      change: 'it is armoured and heavier. Its stump is clad in thick overlapping plates of ivory bone, a crest of curved ivory bone spikes runs around its top, and its three whip-like tendrils are thicker, banded with rings of ivory bone and tipped with big hooked bone barbs.' },
    swarm: { key: 'green', foot: [0.52, 0.85, 0.75],
      idle: 'The organism breathes slowly and only slightly: its flesh swells and relaxes a little, its plates shift a little against each other. The six tendrils sway slowly.',
      fire: 'The six tendrils lash outward and down in one fast sweep all the way round, then coil back to exactly their starting pose.',
      change: 'it has multiplied. SIX long whip-like tendrils rise from the stump instead of three, each tipped with a dark chitin barb, and small round fleshy buds cluster around its base.' },
    venom: { key: 'blue', foot: [0.49, 0.85, 0.8],
      change: 'it is swollen with venom. Big bulging acid yellow-green glands, glistening and faintly glowing, swell out of its stump between its plates, and each of its three tendrils is tipped with a swollen yellow-green venom sac beside its barb, dripping.' },
    reach: { key: 'green', foot: [0.5, 0.88, 0.58],
      change: 'it reaches farther. Its three whip-like tendrils are twice as long, rising high and curling out wide to both sides, and glassy milky-white strands of mucus hang between them like a web.' },
    'bone+venom': { key: 'blue', foot: [0.52, 0.86, 0.8], size: 1.25,
      change: 'it has become a SUPERSTRUCTURE, a Plague Bastion, half again as tall and much bigger than before: a massive armoured stump clad in thick overlapping ivory bone plates with a crown of bone spikes, its three whip tendrils thick and banded with bone, and big bulging glistening acid yellow-green venom glands swelling out between the bone plates, glowing faintly and dripping.' },
  },
  frond: {
    bone: { key: 'green', foot: [0.51, 0.84, 0.82], muzzle: [[0.27, 0.1], [0.43, 0.07], [0.68, 0.07], [0.8, 0.12]],
      change: 'it is armoured and heavier. Its mound is clad in thick overlapping plates of ivory bone with a crest of curved bone spikes around the foot of the frond, and the frond\'s main stems are sheathed in ivory bone at their base.' },
    swarm: { key: 'green', foot: [0.5, 0.86, 0.68], muzzle: [[0.07, 0.34], [0.37, 0.05], [0.59, 0.05], [0.9, 0.34]],
      idle: 'The organism breathes slowly and only slightly: its flesh swells and relaxes a little. Faint sparks crawl along the three fronds.',
      fire: 'The three fronds snap rigid and their tips flare bright blue-white for a moment while the stalks shudder, then they relax back to exactly their starting pose.',
      change: 'it has multiplied. The single frond has split into THREE fern-like fronds of pale blue-white nerve cords fanning out from the mound, with twice as many branching tips, faint sparks at every tip, and small round fleshy buds cluster around its base.' },
    venom: { key: 'blue', foot: [0.51, 0.85, 0.8], muzzle: [[0.12, 0.18], [0.33, 0.03], [0.58, 0.02], [0.82, 0.15]],
      change: 'it is swollen with venom. Big bulging acid yellow-green glands, glistening and faintly glowing, swell out of its mound between its plates, and small yellow-green venom beads hang along the nerve fronds.' },
    reach: { key: 'green', foot: [0.5, 0.88, 0.56], muzzle: [[0.33, 0.06], [0.45, 0.02], [0.57, 0.05]],
      change: 'it reaches farther. The fern-like frond of pale blue-white nerve cords is raised high on a tall stalk of muscle, half again as tall as before, and long nerve cords reach out sideways from the stalk to the ground on both sides like taut guy-ropes.' },
    'swarm+reach': { key: 'green', foot: [0.52, 0.88, 0.6], size: 1.25, muzzle: [[0.06, 0.22], [0.3, 0.06], [0.5, 0.02], [0.69, 0.06], [0.95, 0.21]],
      idle: 'The organism breathes slowly and only slightly: its flesh swells and relaxes a little. Faint sparks crawl along the great crown of fronds.',
      fire: 'The crown of fronds snaps rigid and all its tips flare bright blue-white for a moment while the tall stalk shudders, then it relaxes back to exactly its starting pose.',
      change: 'it has become a SUPERSTRUCTURE, a Storm Crown, half again as tall and much bigger than before: a tall stalk of muscle raising a great branching crown of MANY fern-like fronds of pale blue-white nerve cords, with many more sparking tips, and long nerve cords and glassy milky-white strands reaching out sideways from the stalk to the ground on both sides like guy-ropes.' },
  },
};

/** The folder of a variant's raw files, under art-src/limbs/. */
export const variantDir = (family, key) => `${family}-variants/${key.replace('+', '-')}`;
/** Its baked atlas, under public/art/. */
export const variantAtlas = (family, key) => `limbs/${family}--${key.replace('+', '-')}.webp`;

/**
 * A variant as a limb of its own, for the tools that read tools/art/limbs.mjs entries (feet.mjs,
 * muzzles.mjs, the bake): the limb's own entry with the variant's folder and marks. `variant` is its key.
 */
export function variantLimb(family, key) {
  const base = limb(family);
  const v = VARIANTS[family]?.[key];
  if (!base || !v) return null;
  const out = { ...base, srcDir: variantDir(family, key), variant: key, foot: v.foot, backFoot: v.backFoot, muzzle: v.muzzle, backMuzzle: v.backMuzzle };
  for (const k of ['foot', 'backFoot', 'muzzle', 'backMuzzle']) if (out[k] === undefined) delete out[k];
  return out;
}

/** Every variant as a limb (`family@key` is how the tools name them). */
export const VARIANT_LIMBS = Object.entries(VARIANTS).flatMap(([family, vs]) => Object.keys(vs).map((key) => variantLimb(family, key)));
