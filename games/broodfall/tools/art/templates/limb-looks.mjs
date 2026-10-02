/**
 * THE UPGRADE LOOKS A LIMB CAN REACH (Oct 2 2026, the limb art pass after the class-zero footprints; the limb
 * decision sheet: "draw only the looks a limb can actually reach"). For every limb, the looks its eight evolution
 * paths reach with no eaten bonus (src/ui/codexData.ts evoLooks; REACHABLE below, held to it by tests/looks.test.ts),
 * each drawn as an EDIT of the limb's own pictures, every view it has (a limb drawn over its ground plate keeps its
 * slab: an elbow's or an L's four views), then its idle and acting clips, baked as the limb is. The class words are
 * notes/UPGRADE-LOOKS.md's: BONE broader and spiky, SWARM multiplied, VENOM swollen with yellow-green glands, REACH
 * taller with guy-ropes; a pair is its superstructure.
 *
 *   node tools/art/make.mjs looks <family> [--only=bone,swarm] [--stills|--bake]
 *
 * Where a look stands is CARRIED from the limb's own picture (the edit keeps the skirt where it was: the limb's own
 * mark, or its plate, moved into the look's box), and so is where it fires from: no mark by eye. A look of a limb
 * drawn for its ground is found on its slab again (fitPlate). Raw: art-src/limbs/<limb's folder>-looks/<key>/.
 * Baked: public/art/limbs/<family>--<key>.webp, manifest limbs.<family>.variants.<key> (with `ground: true`).
 * A look the old prototypes drew (tools/art/limb-variants.mjs) is left as it is, unless the limb was drawn anew.
 * SPENDS: a picture about $0.45, a clip about $0.25: a look of two views about $2, of four about $4.
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeClip, makeStill, pool } from '../rfab.mjs';
import { AWAY, BACK, QUIET, THEMES, limb, rawDirOf } from '../limbs.mjs';
import { variantAtlas } from '../limb-variants.mjs';
import { FRAME, STEADY, bakeView } from './limb.mjs';
import { viewsOf } from './limb-shaped.mjs';
import { packAtlas, reviewSheet } from '../lib/atlas.mjs';
import { blank, borderColour, paste, readImage, resize, writeJpg } from '../lib/img.mjs';
import { keyFrame, keyOf, unionBox } from '../lib/key.mjs';
import { VIEW_FACING, fitPlate } from '../lib/plate.mjs';
import { ART, REVIEW, SRC, putVariant, readManifest } from '../lib/manifest.mjs';

/** The looks each limb's evolution paths reach with no eaten bonus (src/ui/codexData.ts evoLooks, Oct 2 2026). */
export const REACHABLE = {
  spitter: ['reach', 'swarm'], burster: ['bone+reach', 'bone+swarm', 'reach', 'swarm'], lasher: ['bone', 'swarm'],
  maw: ['bone', 'bone+swarm', 'swarm'], spine: ['bone'], lure: ['venom'], tangler: ['reach', 'venom', 'venom+reach'],
  blighter: ['swarm', 'swarm+venom', 'venom'], impaler: ['reach', 'swarm'], choir: ['bone', 'bone+swarm', 'swarm'],
  sling: ['bone', 'bone+reach', 'swarm', 'swarm+reach'], brood: ['bone'], hatch: ['bone', 'swarm'], swamp: ['venom', 'venom+reach'],
  frond: ['reach', 'swarm'], lobber: ['bone', 'bone+reach', 'swarm', 'swarm+reach'], mister: ['venom'], ocular: ['bone', 'swarm'],
  prism: ['bone', 'bone+swarm', 'reach', 'swarm+reach'], bombard: ['reach', 'swarm'], ward: ['bone', 'bone+reach', 'reach'],
  quill: ['bone', 'bone+reach', 'swarm', 'swarm+reach'], skipper: ['swarm'], net: ['bone', 'bone+reach', 'swarm', 'swarm+reach'],
  ember: ['swarm', 'swarm+reach', 'swarm+venom', 'venom', 'venom+reach'], conduit: ['swarm'], amp: ['swarm'], mosaic: ['reach', 'swarm'],
  twin: ['swarm'], tap: ['bone', 'bone+swarm', 'swarm'], mitosis: ['swarm'], capacitor: ['swarm'],
  boomerang: ['bone', 'bone+reach', 'swarm', 'swarm+reach'], press: ['bone'], reliquary: ['bone', 'bone+swarm', 'swarm'],
  lance: ['reach'], cage: ['bone', 'bone+swarm', 'swarm'], sprout: ['bone', 'bone+swarm', 'swarm'],
};

/** What grows, by class (notes/UPGRADE-LOOKS.md). `part`: the limb's working part (limbs.mjs `part`, else "its upper body"). */
const CLASS = {
  bone: (p) => `it is armoured and heavier: thick overlapping plates of ivory bone clad ${p} and its base like a cuirass, a crest of short curved ivory bone spikes runs along it, and its base is broader and more massive.`,
  swarm: (p) => `it has multiplied: three smaller copies of ${p} grow from the same base where there was one, and small round fleshy buds cluster along its base.`,
  venom: (p) => `it is swollen with venom: big bulging glistening acid yellow-green glands, faintly glowing, swell out between its plates and along ${p}, and drops of yellow-green venom drip from them.`,
  reach: (p) => `it reaches farther, with ${p} stretched half again as tall, and glassy milky-white strands of mucus run from high on it down to the ground on both sides like taut guy-ropes, with two small pale eyes high on it.`,
};
/** The superstructures (one per pair of classes). */
const SUPER = {
  'bone+swarm': (p) => `it has become a SUPERSTRUCTURE, a Bone Hydra, much bigger than before: an armoured mass of five copies of ${p}, every copy clad in thick ivory bone plates and crowned with bone spikes.`,
  'bone+venom': (p) => `it has become a SUPERSTRUCTURE, a Plague Bastion, much bigger than before: a massive armoured bastion of ivory bone plates round ${p}, glowing acid yellow-green venom glands bulging and dripping between the plates.`,
  'bone+reach': (p) => `it has become a SUPERSTRUCTURE, a Siege Spire, much bigger than before: ${p} raised high on a tall column of ivory bone, armoured in bone plates, anchored to the ground by thick tendon guy-ropes on every side.`,
  'swarm+venom': (p) => `it has become a SUPERSTRUCTURE, a Spore Hive, much bigger than before: a swollen hive-like body raising five copies of ${p} in a ring, studded all over with big bulging glistening acid yellow-green venom glands that glow faintly and drip.`,
  'swarm+reach': (p) => `it has become a SUPERSTRUCTURE, a Storm Crown, much bigger than before: a tall crown of many branching copies of ${p} on a raised stalk, glassy mucus strands reaching out from it to the ground on both sides.`,
  'venom+reach': (p) => `it has become a SUPERSTRUCTURE, a Weeping Snare, much bigger than before: ${p} raised into a tall dripping canopy, yellow-green venom weeping down glassy mucus strands spread wide to the ground.`,
};
export const isSuper = (key) => key.includes('+');
export function lookChange(l, key) {
  const part = l.part ?? 'its upper body';
  return (isSuper(key) ? SUPER[key] : CLASS[key])(part);
}

const KEYS = { green: { hex: '00FF00', name: 'green' }, blue: { hex: '0000FF', name: 'blue' } };
const keyFor = (l, key) => KEYS[key.includes('venom') || THEMES[l.theme].key === 'blue' ? 'blue' : 'green'];
const FACES = {
  front: 'the same direction it faces (toward the lower left)',
  back: 'the same direction it faces (away from the camera, toward the upper right: we see its back)',
  side: 'the same direction it faces (toward the lower right)',
  backside: 'the same direction it faces (away from the camera, toward the upper left: we see its back)',
};
function editWords(l, view, key) {
  const ground = l.plate
    ? ' Its base on the ground keeps EXACTLY its outline, place and size: the same shape of ground under it (its arms and corners where they are).'
    : '';
  return 'Edit the organism in the reference picture. It is the SAME organism, grown: the same camera (isometric, from ' +
    `45 degrees above), ${FACES[view]}, the same deep maroon and dark crimson veined creep flesh with small glossy ` +
    'highlights, the same plates of dark chitin, and the same low ragged skirt of roots lying flat on the ground, in the same ' +
    `place and at the same size in the picture.${ground} What changes: ${lookChange(l, key)} ` +
    `Its one accent stays as it is: ${l.accent ?? THEMES[l.theme].accent}. Its new outline must read clearly different from ` +
    'the original even when seen very small. Realistic, detailed creature design, wet and unglamorous. Soft even light from ' +
    'directly overhead, no cast shadows. No text, no letters, no numbers, no symbols.';
}

/** The limb's own pictures, by view: the file, and where it stands and fires from in it (absolute, at 1024). */
function basesOf(l) {
  const dir = path.join(SRC, 'limbs', rawDirOf(l));
  const out = {};
  if (l.plate) {
    const feet = JSON.parse(fs.readFileSync(path.join(dir, 'feet.json'), 'utf8'));
    for (const view of viewsOf(l)) out[view] = { file: path.join(dir, `${view}.png`), share: feet[view], muzzle: muzzleOf(l, view) };
  } else {
    // (A flat limb, a pool in the street, stands on all of itself: footingOf ignores its mark.)
    out.front = { file: path.join(dir, 'styled.png'), share: l.foot ?? (l.flat ? [0.5, 0.5, 1] : undefined), muzzle: l.muzzle };
    if (l.back && fs.existsSync(path.join(dir, 'back.png'))) out.back = { file: path.join(dir, 'back.png'), share: l.backFoot, muzzle: l.backMuzzle };
  }
  for (const [view, b] of Object.entries(out)) {
    if (!fs.existsSync(b.file) || !b.share) { delete out[view]; continue; }
    const box = keyedBox(b.file);
    const w = box.x1 - box.x0, h = box.y1 - box.y0;
    b.abs = { x: box.x0 + b.share[0] * w, y: box.y0 + b.share[1] * h, a: (b.share[2] * w) / 2 };
    b.absMuzzle = b.muzzle?.map(([mx, my]) => [box.x0 + mx * w, box.y0 + my * h]);
  }
  return out;
}
const muzzleOf = (l, view) => ({ front: l.muzzle, back: l.backMuzzle, side: l.sideMuzzle, backside: l.backSideMuzzle }[view]);

function keyed(file) {
  const img = readImage(file, { w: 1024, h: 1024 });
  keyFrame(img, keyOf(borderColour(img)), { spill: 'edge' });
  return img;
}
function keyedBox(file) { return unionBox([keyed(file)]); }

const lookDir = (l, key) => path.join(SRC, 'limbs', `${rawDirOf(l)}-looks`, key.replace('+', '-'));

/** The look's marks, carried from the limb's own picture into the look's box (or its slab found again). */
function carry(l, view, base, still) {
  const img = keyed(still);
  const box = unionBox([img]);
  const w = box.x1 - box.x0, h = box.y1 - box.y0;
  let foot;
  if (l.plate) {
    const fit = fitPlate(img, l.plate, VIEW_FACING[view]);
    foot = [(fit.x - box.x0) / w, (fit.y - box.y0) / h, fit.w / w];
  } else foot = [(base.abs.x - box.x0) / w, (base.abs.y - box.y0) / h, (2 * base.abs.a) / w];
  const muzzle = base.absMuzzle?.map(([x, y]) => [Number(((x - box.x0) / w).toFixed(3)), Number(((y - box.y0) / h).toFixed(3))]);
  return { foot: foot.map((v) => Number(v.toFixed(4))), muzzle };
}

/** Which looks to draw: the reachable ones, less those the prototypes drew for a limb that was not drawn anew. */
export function looksToDraw(family, only = []) {
  const l = limb(family);
  const drawn = readManifest().limbs?.[family]?.variants ?? {};
  return (REACHABLE[family] ?? []).filter((k) => (!only.length || only.includes(k)) && (l.plate || !drawn[k] || drawn[k].ground));
}

export async function makeLooks(family, { only = [], stillsOnly = false, bakeOnly = false } = {}) {
  const l = limb(family);
  if (!l) throw new Error(`no limb "${family}"`);
  const keys = looksToDraw(family, only);
  const bases = basesOf(l);
  // A limb seen from behind whose own picture from behind was not recovered (Oct 1 2026, the lost art-src): its
  // looks are drawn from behind as a half-turn of each look's own front (the BACK edit), placed by its backFoot mark.
  const backFromFront = !l.plate && l.back && !bases.back && l.backFoot && fs.existsSync(path.join(SRC, 'limbs', rawDirOf(l), 'styled.png'));
  const views = [...Object.keys(bases), ...(backFromFront ? ['back'] : [])];
  if (!views.length) throw new Error(`${family}: no picture of the limb to edit (draw the limb first)`);
  if (!bakeOnly) {
    const drawn = new Set(Object.keys(bases));
    const pic = async ({ key, view }) => {
      const dir = lookDir(l, key);
      fs.mkdirSync(dir, { recursive: true });
      const k = keyFor(l, key);
      const half = !drawn.has(view);
      const still = await makeStill({
        slug: `${family} ${key} look, ${view}`, out: path.join(dir, `${view}.png`),
        refFiles: [half ? path.join(dir, 'front.png') : bases[view].file],
        prompt: half
          ? `${BACK} ${l.back} It keeps every part it has in the reference picture, now seen from behind. Its one accent stays as it is: ${l.accent ?? THEMES[l.theme].accent}.`
          : editWords(l, view, key),
        key: k.hex, keyName: k.name, quality: 'high',
      });
      const all = fs.existsSync(path.join(dir, 'marks.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'marks.json'), 'utf8')) : {};
      all[view] = half ? { foot: l.backFoot, muzzle: l.backMuzzle } : carry(l, view, bases[view], still);
      fs.writeFileSync(path.join(dir, 'marks.json'), `${JSON.stringify(all, null, 1)}\n`);
    };
    // The views drawn from the limb's own pictures first; a back drawn from a look's front after it.
    const first = await pool(keys.flatMap((key) => [...drawn].map((view) => ({ key, view }))), 3, pic);
    const then = await pool(keys.flatMap((key) => views.filter((v) => !drawn.has(v)).map((view) => ({ key, view }))), 3, pic);
    const pics = [...first, ...then];
    pics.forEach((r) => { if (!r.ok) console.warn(`[looks] ${family}: a picture failed: ${r.error.message.slice(0, 200)}`); });
    stillSheet(l, keys, [...drawn], bases);
    if (stillsOnly) return { family, checks: [] };
    const jobs = [];
    for (const key of keys) for (const view of views) {
      const pre = view === 'front' ? '' : `${view}-`;
      const away = view === 'back' || view === 'backside' ? AWAY : '';
      jobs.push({ key, view, anim: 'idle', out: `${pre}idle.mp4`, prompt: l.idle + away + STEADY });
      if (l.fire) jobs.push({ key, view, anim: 'fire', out: `${pre}fire.mp4`, prompt: l.fire + away + (l.quiet ? QUIET : '') + STEADY });
    }
    const clips = await pool(jobs, 3, (j) => {
      const dir = lookDir(l, j.key);
      const k = keyFor(l, j.key);
      if (!fs.existsSync(path.join(dir, `${j.view}.png`))) return null;
      return makeClip({ slug: `${family} ${j.key} ${j.view} ${j.anim}`, out: path.join(dir, j.out), stillFile: path.join(dir, `${j.view}.png`), prompt: j.prompt, key: k.hex, keyName: k.name });
    });
    clips.forEach((r, i) => { if (!r.ok) console.warn(`[looks] ${family} ${jobs[i].key} ${jobs[i].view} ${jobs[i].anim} failed: ${r.error.message.slice(0, 160)}`); });
  }
  const done = [];
  for (const key of keys) {
    try { done.push(bakeLook(l, key, views)); } catch (e) { console.warn(`[looks] ${family} ${key}: not baked: ${e.message.slice(0, 200)}`); }
  }
  // One sheet per frame size (a superstructure is baked in bigger frames than a class look).
  for (const F of [...new Set(done.map((d) => d.F))]) {
    const rows = done.filter((d) => d.F === F).flatMap((d) => d.rows);
    reviewSheet(rows, F, path.join(REVIEW, 'limbs', 'looks', `${family}-looks${F === done[0].F ? '' : `-${F}`}.jpg`));
  }
  return { family, checks: done.flatMap((d) => d.checks) };
}

/** One look baked into its atlas and its manifest entry. Free. */
export function bakeLook(l, key, views) {
  const dir = lookDir(l, key);
  const marks = JSON.parse(fs.readFileSync(path.join(dir, 'marks.json'), 'utf8'));
  const vl = {
    ...l, srcDir: path.relative(path.join(SRC, 'limbs'), dir), variant: key,
    plateFeet: Object.fromEntries(Object.entries(marks).map(([v, m]) => [v, m.foot])),
    muzzle: marks.front?.muzzle, backMuzzle: marks.back?.muzzle, sideMuzzle: marks.side?.muzzle, backSideMuzzle: marks.backside?.muzzle,
    // Its marks are carried, not by eye; it stands where its limb stands.
    plate: l.plate ?? 'carried',
  };
  const checks = [];
  const check = (name, ok, value) => checks.push({ name, ok, value });
  const big = !!l.big || isSuper(key);
  const [F, COLS] = big ? FRAME.big : FRAME.small;
  const baked = {};
  for (const view of views) baked[view] = bakeView(vl, dir, view, check, F);
  if (!baked.front) throw new Error(`no front idle clip in ${dir}`);
  const order = views.filter((v) => baked[v]);
  const frames = order.flatMap((v) => baked[v].frames);
  const shift = (anims, by) => Object.fromEntries(Object.entries(anims).map(([k, c]) => [k, { ...c, start: c.start + by }]));
  let at = 0;
  const part = {};
  for (const v of order) { part[v] = { anchor: baked[v].anchor, body: baked[v].body, anims: shift(baked[v].anims, at), grafts: baked[v].grafts, ...(baked[v].muzzle ? { muzzle: baked[v].muzzle } : {}) }; at += baked[v].frames.length; }
  const atlas = variantAtlas(l.family, key);
  packAtlas(frames, F, COLS, path.join(ART, atlas), 86);
  const entry = {
    atlas, frame: F, cols: COLS, ground: true, ...(isSuper(key) ? { size: 1.2 } : {}), ...part.front,
    ...(part.back ? { back: part.back } : {}), ...(part.side ? { side: part.side } : {}), ...(part.backside ? { backSide: part.backside } : {}),
  };
  putVariant(l.family, key, entry);
  const bad = checks.filter((c) => !c.ok);
  console.log(`[looks] ${l.family} ${key}: ${frames.length} frames, ${order.length} view(s), ${checks.length - bad.length}/${checks.length} checks passed`);
  for (const c of bad) console.log(`       FAILED ${c.name}: ${c.value}`);
  return { key, checks, F, rows: order.map((v) => ({ label: `${l.family} ${key} ${v}`, anims: baked[v].kept })) };
}

/** A contact sheet of the pictures (the limb's own first, a row per view), to look at before paying for clips. */
function stillSheet(l, keys, views, bases) {
  const S = 256;
  const sheet = blank((keys.length + 1) * S, views.length * S, [24, 24, 24, 255]);
  views.forEach((view, r) => {
    const files = [bases[view].file, ...keys.map((k) => path.join(lookDir(l, k), `${view}.png`))];
    files.forEach((f, i) => { if (fs.existsSync(f)) paste(sheet, resize(readImage(f), S, S), i * S, r * S); });
  });
  fs.mkdirSync(path.join(REVIEW, 'limbs', 'looks'), { recursive: true });
  const out = path.join(REVIEW, 'limbs', 'looks', `${l.family}-stills.jpg`);
  writeJpg(out, sheet, 3);
  console.log(`[looks] ${l.family}: pictures in ${out} (the limb, then ${keys.join(', ')}; rows: ${views.join(', ')})`);
}
