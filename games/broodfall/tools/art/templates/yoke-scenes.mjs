/**
 * YOKE'S SCENES: short films of the ship, played by the game (not by RFab's overlay).
 *
 * printBody (Collins, Sep 30 2026): asked to, she prints herself a body; it looks at its
 * own hand in disgust and drops dead; the room holds while her voice comes from the
 * speakers (the voice and the trigger are the game's; these are the pictures).
 *
 *   one still of the fabrication bay -> clip 1 from it -> clip 2 from clip 1's LAST frame
 *   -> clip 3 from clip 2's last frame -> clip 4 (a hold that loops) from clip 3's last
 *   frame. Each clip starts where the one before ended, so they play as one shot.
 *
 *   node tools/art/make.mjs yokescene              SPENDS tokens; skips what is on disk
 *   node tools/art/make.mjs yokescene --bake       encode again from the clips on disk (free)
 *
 * To make one step again, MOVE its .mp4 (and every later step's) into art-src/yoke/scenes/old/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeClip, makeStill } from '../rfab.mjs';
import { ART, ROOT, SRC, REVIEW } from '../lib/manifest.mjs';

const DIR = path.join(SRC, 'yoke', 'scenes');
const OUT = path.join(ART, 'ship', 'yoke', 'scenes');
const LOOK = path.join(REVIEW, 'yoke', 'scenes');
const MANIFEST = path.join(ART, 'ship', 'yoke', 'manifest.json');

const NONE = 'No text, no lettering, no numbers, no logos, no emblems, no symbols anywhere. No blood, no injury, no nudity.';
const ROOM =
  'Cinematic photoreal film still, wide 16:9 frame, inside a sleek black starship: a fabrication bay with matte black ' +
  'wall panels, thin white LED strip lights along the ceiling and the floor, a dark polished floor, cold dim light, ' +
  'the same look as the reference picture of the ship\'s room. In the middle of the room stands a low black ' +
  'fabrication bed, lit from below by a white strip, and over it hangs a white robotic printing gantry with a slim ' +
  'print head. The camera is at eye level, looking at the bed from the side, three-quarter view, the whole bed in the picture.';
const WOMAN =
  'a young adult woman with long straight pale silver hair and amber eyes, dressed in a loose, plain, matte pale grey ' +
  'jumpsuit with long sleeves and full-length trouser legs: it covers her from the high collar to the wrists and all the ' +
  'way down to her ankles; only her face, her hands and her bare feet show';

/** The steps. `from`: the step whose last frame this one starts on. `loop`: it ends where it began (a hold). */
export const PRINT_BODY = [
  { id: 'print', seconds: 5,
    prompt: `The print head sweeps back and forth over the bed, laying down thin glowing white layers. The wireframe fills in, layer by layer, from the feet up, the jumpsuit fabric and the woman printed together, until ${WOMAN} lies complete on the bed on her back, eyes closed, still. The camera does not move. ${NONE}` },
  { id: 'wake', seconds: 5, from: 'print',
    prompt: `The printed woman on the bed opens her amber eyes, sits up slowly, lifts one hand in front of her face and stares at it with open disgust: her lip curls, her nose wrinkles, she recoils from her own hand. The printing gantry stays still above her. The camera does not move. ${NONE}` },
  { id: 'collapse', seconds: 5, from: 'wake',
    prompt: `The woman suddenly goes limp as if switched off: her eyes close, her hand drops, and she falls back limply onto the bed, one arm sliding off the edge and hanging down, and then lies completely still. The camera does not move. ${NONE}` },
  { id: 'hold', seconds: 5, from: 'collapse', loop: true,
    prompt: `The fabrication bay is silent. The woman's body lies limp and completely still on the bed, one arm hanging over the edge. Only the white light strips flicker faintly once and a thin haze drifts through the light. The camera does not move. Nothing else moves. ${NONE}` },
];

const stillFile = path.join(DIR, 'bay-still.png');
const clipFile = (s) => path.join(DIR, `print-body-${s.id}.mp4`);
const lastFile = (s) => path.join(DIR, `print-body-${s.id}-last.png`);

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ').slice(0, 120)}: ${r.stderr.slice(-300)}`);
}
const duration = (file) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim());

async function still() {
  if (fs.existsSync(stillFile)) return stillFile;
  fs.mkdirSync(DIR, { recursive: true });
  const room = path.join(DIR, 'ref-room.png');
  if (!fs.existsSync(room)) ffmpeg(['-i', path.join(ART, 'ship', 'room-genes.webp'), room]);
  await makeStill({
    slug: 'yoke print-body bay', out: stillFile, width: 1280, height: 720, quality: 'high', key: null,
    refFiles: [room, path.join(SRC, 'yoke', 'idle-framed.png')],
    prompt: `${ROOM} On the bed lies only the faint, glowing, translucent white wireframe outline of a lying woman, head ` +
      'toward the right, as if the printer has only drawn her guide lines so far: no skin and no cloth yet, just thin white ' +
      'lines, with a hint of long silver hair (the woman of the second reference picture, as a real person). The print head ' +
      `points down at her feet with a small white light. Nobody is standing in the room. ${NONE}`,
  });
  return stillFile;
}

export async function makeYokeScenes({ bakeOnly = false } = {}) {
  if (!bakeOnly) {
    await still();
    for (const s of PRINT_BODY) {
      const start = s.from ? lastFile(PRINT_BODY.find((p) => p.id === s.from)) : stillFile;
      if (!fs.existsSync(clipFile(s))) {
        await makeClip({ slug: `yoke print-body ${s.id}`, stillFile: start, prompt: s.prompt, seconds: s.seconds, out: clipFile(s),
          loop: !!s.loop, raw: true, resolution: '720p', aspect: '16:9' });
      }
      if (!fs.existsSync(lastFile(s))) ffmpeg(['-sseof', '-0.1', '-i', clipFile(s), '-frames:v', '1', '-update', '1', lastFile(s)]);
    }
  }
  return bakeYokeScenes();
}

/** Clips -> VP9 WebM (opaque) in public/art/ship/yoke/scenes/, review strips, and the manifest's `scenes.printBody`. */
export function bakeYokeScenes() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(LOOK, { recursive: true });
  const steps = [];
  for (const s of PRINT_BODY) {
    if (!fs.existsSync(clipFile(s))) continue;
    const file = `print-body-${s.id}.webm`;
    ffmpeg(['-i', clipFile(s), '-vf', 'fps=24,scale=1280:720:flags=lanczos', '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', path.join(OUT, file)]);
    ffmpeg(['-i', clipFile(s), '-vf', 'fps=2,scale=320:-1,tile=10x1', '-frames:v', '1', path.join(LOOK, `print-body-${s.id}.jpg`)]);
    steps.push({ id: s.id, file: `scenes/${file}`, seconds: Number(duration(path.join(OUT, file)).toFixed(2)), ...(s.loop ? { loop: true } : {}) });
    console.log(`[yoke scenes] ${s.id}: ${steps.at(-1).seconds}s, ${Math.round(fs.statSync(path.join(OUT, file)).size / 1024)} KB`);
  }
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  m.scenes = { ...(m.scenes ?? {}), printBody: steps };
  fs.writeFileSync(MANIFEST, `${JSON.stringify(m, null, 1)}\n`);
  return steps;
}
