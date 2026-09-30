/**
 * UPGRADE LOOKS, drawn (DESIGN.md "Upgrade looks", notes/UPGRADE-LOOKS.md): a limb's class looks and
 * its superstructure, each from the limb's approved picture by an image edit (tools/art/limb-variants.mjs),
 * then the limb's own idle and firing clips from that picture (and from behind, for a limb with a view
 * from behind), keyed, cut and baked exactly as the limb is (templates/limb.mjs bakeView).
 *
 * No death clip: a variant that dies withers with the game's own slump (src/render/limbFx.ts).
 * About 22,000 tokens a picture and 12,300 a clip at 480p: a variant of a limb with one view is
 * about 47,000 tokens ($0.94), of one with a view from behind about 94,000 ($1.88).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ffmpeg, makeClip, makeStill, pool } from '../rfab.mjs';
import { AWAY, BACK, QUIET, THEMES, limb, rawDirOf } from '../limbs.mjs';
import { EDIT, EDIT_END, KEYS, VARIANTS, variantAtlas, variantLimb } from '../limb-variants.mjs';
import { FRAME, STEADY, bakeView } from './limb.mjs';
import { packAtlas, reviewFrames, reviewSheet } from '../lib/atlas.mjs';
import { writeJpg, blank, paste, resize, readImage } from '../lib/img.mjs';
import { ART, REVIEW, SRC, putVariant } from '../lib/manifest.mjs';

const keysOf = (family, only) => Object.keys(VARIANTS[family] ?? {}).filter((k) => !only?.length || only.includes(k));

/** The variant's picture: the limb's own approved picture, edited. */
async function stillOf(family, key) {
  const l = limb(family);
  const v = VARIANTS[family][key];
  const vl = variantLimb(family, key);
  const dir = path.join(SRC, 'limbs', vl.srcDir);
  fs.mkdirSync(dir, { recursive: true });
  const k = KEYS[v.key];
  return makeStill({
    slug: `${family} ${key} look`, out: path.join(dir, 'styled.png'),
    refFiles: [path.join(SRC, 'limbs', rawDirOf(l), 'styled.png')],
    prompt: `${EDIT}${v.change} Its one accent stays as it is: ${THEMES[l.theme].accent}.${EDIT_END}`,
    key: k.hex, keyName: k.name, quality: 'high',
  });
}

/** Its view from behind (a limb that has one): drawn from the variant's own picture. */
async function backOf(family, key) {
  const l = limb(family);
  if (!l.back) return null;
  const v = VARIANTS[family][key];
  const dir = path.join(SRC, 'limbs', variantLimb(family, key).srcDir);
  const k = KEYS[v.key];
  return makeStill({
    slug: `${family} ${key} look from behind`, out: path.join(dir, 'back.png'), refFiles: [path.join(dir, 'styled.png')],
    prompt: `${BACK} ${l.back} It keeps every part it has in the reference picture, now seen from behind. Its one accent stays as it is: ${THEMES[l.theme].accent}.`,
    key: k.hex, keyName: k.name, quality: 'high',
  });
}

/** Its idle and firing clips, from the front and (a limb with a view from behind) from behind. */
async function clipsOf(family, key) {
  const l = limb(family);
  const v = VARIANTS[family][key];
  const dir = path.join(SRC, 'limbs', variantLimb(family, key).srcDir);
  const k = KEYS[v.key];
  const idle = v.idle ?? l.idle;
  const fire = v.fire ?? l.fire;
  const jobs = [{ anim: 'idle', still: 'styled.png', prompt: idle + STEADY }];
  if (fire) jobs.push({ anim: 'fire', still: 'styled.png', prompt: fire + (l.quiet ? QUIET : '') + STEADY });
  if (l.back && fs.existsSync(path.join(dir, 'back.png'))) {
    jobs.push({ anim: 'back-idle', still: 'back.png', prompt: idle + AWAY + STEADY });
    if (fire) jobs.push({ anim: 'back-fire', still: 'back.png', prompt: fire + AWAY + (l.quiet ? QUIET : '') + STEADY });
  }
  const results = await pool(jobs, 4, (j) => makeClip({
    slug: `${family} ${key} ${j.anim}`, out: path.join(dir, `${j.anim}.mp4`), stillFile: path.join(dir, j.still),
    prompt: j.prompt, key: k.hex, keyName: k.name,
  }));
  results.forEach((r, i) => { if (!r.ok) console.warn(`[variant] ${family} ${key} ${jobs[i].anim} failed: ${r.error.message.slice(0, 160)}`); });
}

/** One variant baked: its atlas and its manifest entry (limbs.<family>.variants.<key>). Free. */
export function bakeVariant(family, key) {
  const l = variantLimb(family, key);
  const dir = path.join(SRC, 'limbs', l.srcDir);
  const checks = [];
  const check = (name, ok, value) => checks.push({ name, ok, value });
  const [F, COLS] = l.big ? FRAME.big : FRAME.small;
  const front = bakeView(l, dir, 'front', check, F);
  if (!front) throw new Error(`${family} ${key}: no idle clip to bake in ${dir}`);
  const back = l.back ? bakeView(l, dir, 'back', check, F) : null;
  if (l.back) check('from behind: it has a view', !!back, back ? 'drawn' : `missing: node tools/art/make.mjs variant ${family}`);
  if (l.fire && !front.anims.fire) check('fire: exists', false, 'missing');
  const frames = [...front.frames, ...(back ? back.frames : [])];
  const shift = (anims, by) => Object.fromEntries(Object.entries(anims).map(([k, c]) => [k, { ...c, start: c.start + by }]));
  const atlas = variantAtlas(family, key);
  const packed = packAtlas(frames, F, COLS, path.join(ART, atlas), 86);
  const entry = {
    atlas, frame: F, cols: COLS, anchor: front.anchor, body: front.body, anims: front.anims, grafts: front.grafts,
    ...(front.muzzle ? { muzzle: front.muzzle } : {}),
    ...(back ? { back: { anchor: back.anchor, body: back.body, anims: shift(back.anims, front.frames.length), grafts: back.grafts, ...(back.muzzle ? { muzzle: back.muzzle } : {}) } } : {}),
  };
  const bad = checks.filter((c) => !c.ok);
  console.log(`[variant] ${family} ${key}: ${frames.length} frames${back ? ' (two views)' : ''}, atlas ${Math.round(packed.bytes / 1024)} KB, ${checks.length - bad.length}/${checks.length} checks passed`);
  for (const c of bad) console.log(`       FAILED ${c.name}: ${c.value}`);
  // A variant with no mark of where it stands is not placed in the game (it would stand in the wrong place).
  if (checks.some((c) => !c.ok && /where it stands is marked/.test(c.name))) {
    console.log(`       NOT written to the manifest: mark it first (node tools/art/feet.mjs --variants ${family}@${key})`);
  } else putVariant(family, key, entry);
  return { key, entry, checks, front, back, F };
}

/** Every variant of a limb baked, and one review sheet of them: notes/art-review/limbs/<family>-variants.jpg. */
export function bakeVariants(family, only) {
  const done = [];
  for (const key of keysOf(family, only)) {
    const dir = path.join(SRC, 'limbs', variantLimb(family, key).srcDir);
    if (!fs.existsSync(path.join(dir, 'idle.mp4'))) { console.log(`[variant] ${family} ${key}: no idle clip yet`); continue; }
    done.push(bakeVariant(family, key));
  }
  if (!done.length) return done;
  const F = done[0].F;
  const rows = [];
  for (const d of done) {
    rows.push({ label: `${family} ${d.key}`, anims: d.front.kept });
    if (d.back) rows.push({ label: `${family} ${d.key} from behind`, anims: d.back.kept });
  }
  fs.mkdirSync(path.join(REVIEW, 'limbs'), { recursive: true });
  reviewSheet(rows, F, path.join(REVIEW, 'limbs', `${family}-variants.jpg`));
  fs.writeFileSync(path.join(REVIEW, 'limbs', `${family}-variants.json`), `${JSON.stringify(done.map((d) => ({ key: d.key, failed: d.checks.filter((c) => !c.ok).length, checks: d.checks })), null, 1)}\n`);
  const tmp = path.join(SRC, 'limbs', `${family}-variants`, 'review-frames');
  fs.rmSync(tmp, { recursive: true, force: true });
  reviewFrames(done.flatMap((d) => [...d.front.kept, ...(d.back ? d.back.kept : [])]), F, tmp, 'f');
  ffmpeg(['-framerate', '12', '-i', path.join(tmp, 'f-%04d.png'), '-vf', 'crop=trunc(iw/2)*2:trunc(ih/2)*2:0:0', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '30',
    path.join(REVIEW, 'limbs', `${family}-variants.mp4`)], `${family} variants review film`);
  fs.rmSync(tmp, { recursive: true, force: true });
  return done;
}

/** A contact sheet of the pictures (the limb's own first), to look at before paying for clips. */
function stillSheet(family) {
  const l = limb(family);
  const files = [path.join(SRC, 'limbs', rawDirOf(l), 'styled.png'), ...keysOf(family).map((k) => path.join(SRC, 'limbs', variantLimb(family, k).srcDir, 'styled.png'))];
  const backs = l.back ? [path.join(SRC, 'limbs', rawDirOf(l), 'back.png'), ...keysOf(family).map((k) => path.join(SRC, 'limbs', variantLimb(family, k).srcDir, 'back.png'))] : [];
  const S = 320;
  const rows = backs.length ? 2 : 1;
  const sheet = blank(files.length * S, rows * S, [24, 24, 24, 255]);
  [files, backs].forEach((list, r) => list.forEach((f, i) => { if (fs.existsSync(f)) paste(sheet, resize(readImage(f), S, S), i * S, r * S); }));
  fs.mkdirSync(path.join(REVIEW, 'limbs'), { recursive: true });
  const out = path.join(REVIEW, 'limbs', `${family}-variants-stills.jpg`);
  writeJpg(out, sheet, 3);
  console.log(`[variant] ${family}: pictures in ${out} (base, then ${keysOf(family).join(', ')})`);
}

export async function makeLimbVariants(family, { stillsOnly = false, bakeOnly = false, only = [] } = {}) {
  if (!VARIANTS[family]) throw new Error(`no variants of "${family}" in tools/art/limb-variants.mjs`);
  const keys = keysOf(family, only);
  if (!bakeOnly) {
    const stills = await pool(keys, 3, async (key) => { await stillOf(family, key); await backOf(family, key); });
    stills.forEach((r, i) => { if (!r.ok) console.warn(`[variant] ${family} ${keys[i]} picture failed: ${r.error.message.slice(0, 200)}`); });
    stillSheet(family);
    if (stillsOnly) return { family, checks: [] };
    const clips = await pool(keys, 2, (key) => clipsOf(family, key));
    clips.forEach((r, i) => { if (!r.ok) console.warn(`[variant] ${family} ${keys[i]} clips failed: ${r.error.message.slice(0, 200)}`); });
  }
  const done = bakeVariants(family, only);
  return { family, checks: done.flatMap((d) => d.checks) };
}
