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
 *   node tools/art/make.mjs yokescene --stills     the staging still only (the bay, her outline), for Collins to approve
 *   node tools/art/make.mjs yokescene              SPENDS tokens; skips what is on disk
 *   node tools/art/make.mjs yokescene --bake       encode again from the clips on disk (free)
 *
 * VERSION 2 (Collins, Oct 26 2026: "that film needs to be redone, she looks like an old lady; YOKE would be around 23 (as
 * all women of this society are) and petite"). Version 1 described her only as "a young adult woman with long straight
 * pale silver hair ... in a pale grey jumpsuit", which the model read as grey hair and aged; she is now YOKE as her
 * avatar's own template draws her (tools/art/templates/yoke.mjs HER), as a real person: petite, about twenty-three, her
 * black high-collared dress and her gear clip. She dies before she reaches the floor, as the script says, not lying back on
 * the bed. 480p, the lowest a video model offers (docs/VIDEO-CONVENTIONS.md). Version 2 lives in art-src/yoke/scenes/v2/
 * (version 1's files are left where they were). The film is pictures only: her line comes from the ship's speakers in her
 * own game voice (content/yokeScenes.ts PRINT_BODY.line, said by src/ui/campaignUi.ts printBody over the last shot).
 * To make one step again, MOVE its .mp4 (and every later step's) into art-src/yoke/scenes/v2/old/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeClip, makeStill } from '../rfab.mjs';
import { ART, ROOT, SRC, REVIEW } from '../lib/manifest.mjs';

const DIR = path.join(SRC, 'yoke', 'scenes', 'v2');
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
  'YOKE as a real person, the woman of the second reference picture made flesh: a petite, slight young woman of about ' +
  'twenty-three with a youthful, delicate face (young, not old: her hair colour is her own, not grey), long straight pale ' +
  'silver hair with a faint blue tint falling well past her shoulders, a side-swept fringe, amber-gold eyes, fair skin, and ' +
  'one small plain black gear-shaped hair clip on the side of her head. She wears a plain black high-collared long-sleeved ' +
  'dress with a narrow white inner collar, modest and austere, falling to her ankles; only her face, her hands and her bare ' +
  'feet show';

/** The steps. `from`: the step whose last frame this one starts on. `loop`: it ends where it began (a hold). */
export const PRINT_BODY = [
  { id: 'print', seconds: 5,
    prompt: `The print head sweeps back and forth over the bed, laying down thin glowing white layers. The wireframe fills in, layer by layer, from the feet up, the black dress and the woman printed together, until ${WOMAN} lies complete on the bed on her back, eyes closed, still. The camera does not move. ${NONE}` },
  { id: 'wake', seconds: 5, from: 'print',
    prompt: `The petite young woman on the bed opens her amber eyes, sits up, lifts one hand in front of her face, turns it over, sniffs it, and her face twists in open, theatrical disgust: her lip curls, her nose wrinkles, she gags and holds the hand away from herself as if it smelled. The printing gantry stays still above her. The camera does not move. ${NONE}` },
  { id: 'collapse', seconds: 5, from: 'wake',
    prompt: `The young woman sways where she sits, her eyes roll up and close, and she folds sideways off the edge of the bed, completely limp, dead before she reaches the floor; she slides down onto the dark floor beside the bed and lies there still, her silver-blue hair spread out. The camera does not move. ${NONE}` },
  { id: 'hold', seconds: 5, from: 'collapse', loop: true,
    prompt: `The fabrication bay is silent. The young woman's body lies limp and completely still on the dark floor beside the empty bed. Only the white light strips flicker faintly once. The camera does not move. Nothing else moves. ${NONE}` },
];

/**
 * SFW blur (Collins, Oct 26 2026: "blur the breast area in sfw mode"): per clip, where her chest is, as keys of
 * { t seconds, x, y, w, h } in fractions of the picture, read off the real frames of the clips on disk. The game draws a
 * blurred patch there unless Settings → Content is UNRESTRICTED (src/ui/yokeScene.ts), from the first key to the last.
 * Re-read them whenever a clip is made again: a new take puts her somewhere else.
 */
export const BLUR = {
  // None (Collins, Oct 26 2026, of the first clip's see-through outline: "you don't really need it at all, all you see is
  // like a medical outline and it's only for a flash second ... it would be like pausing to try to see the tits in Diablo
  // 2"). The dress is printed over her from 2.0 s. Keys go here only if a take ever shows more.
};

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
    slug: 'yoke print-body bay', out: stillFile, width: 1280, height: 720, key: null,
    refFiles: [room, path.join(SRC, 'yoke', 'idle-framed.png')],
    prompt: `${ROOM} On the bed lies only the faint, glowing, translucent white wireframe outline of a lying woman, head ` +
      'toward the right, as if the printer has only drawn her guide lines so far: no skin and no cloth yet, just thin white ' +
      'lines, with a hint of long silver hair (the woman of the second reference picture, as a real person). The print head ' +
      `points down at her feet with a small white light. Nobody is standing in the room. ${NONE}`,
  });
  return stillFile;
}

/**
 * The one picture made fresh, to approve before any clip is paid for: the staging still (the bay, her outline on the
 * bed), the first clip's start. Every later picture is the previous clip's real last frame (Collins, Oct 26 2026: "you
 * only make staging and transition pictures, and most pics come from the last frame of the last clip").
 */
export async function makeYokeSceneStills() {
  await still();
  fs.mkdirSync(LOOK, { recursive: true });
  fs.copyFileSync(stillFile, path.join(LOOK, 'v2-bay-still.png'));
  console.log(`[yoke scenes] the staging still to approve: ${path.relative(ROOT, path.join(LOOK, 'v2-bay-still.png'))}`);
  return [stillFile];
}

export async function makeYokeScenes({ bakeOnly = false } = {}) {
  if (!bakeOnly) {
    await still();
    for (const s of PRINT_BODY) {
      const start = s.from ? lastFile(PRINT_BODY.find((p) => p.id === s.from)) : stillFile;
      if (!fs.existsSync(clipFile(s))) {
        await makeClip({ slug: `yoke print-body ${s.id}`, stillFile: start, prompt: s.prompt, seconds: s.seconds, out: clipFile(s),
          loop: !!s.loop, raw: true, resolution: '480p', aspect: '16:9' });
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
    steps.push({ id: s.id, file: `scenes/${file}`, seconds: Number(duration(path.join(OUT, file)).toFixed(2)), ...(s.loop ? { loop: true } : {}), ...(BLUR[s.id] ? { blur: BLUR[s.id] } : {}) });
    console.log(`[yoke scenes] ${s.id}: ${steps.at(-1).seconds}s, ${Math.round(fs.statSync(path.join(OUT, file)).size / 1024)} KB`);
  }
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  m.scenes = { ...(m.scenes ?? {}), printBody: steps };
  fs.writeFileSync(MANIFEST, `${JSON.stringify(m, null, 1)}\n`);
  return steps;
}
