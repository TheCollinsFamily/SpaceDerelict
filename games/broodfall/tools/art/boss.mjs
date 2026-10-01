/**
 * THE BOSS'S MESSAGE (Collins, Sep 30 2026): on the first landing on the ship, a transmission from
 * his superior, an uplifted DOG in the Technopuritan bureaucracy (dogs rise high in it: they like
 * taking orders, are happy, trustworthy and generous; they rarely reach top management, being
 * gullible). Supervisor Steadfast Barnabas, Xenofauna Clearance Office, Sector 9 (content/boss.ts).
 *
 *   node tools/art/boss.mjs            the still, the 4 s talking clip (720p), his voice, then the bake
 *   node tools/art/boss.mjs --still    only the still (LOOK at it before paying for the clip)
 *   node tools/art/boss.mjs --bake     bake again (free)
 *
 * SPENDS RFab tokens: a high still (~$0.50), a 720p clip (~$0.49), his voice (Deepgram Aura via
 * POST /api/audio/synthesize, ~$0.04). Raw files in art-src/boss/ (git-ignored); baked to
 * public/art/intro/boss.mp4, boss.webp, boss.mp3, and the "boss" key of public/art/intro/intro.json.
 * No lettering and no symbol in the picture: his name and rank are set in type by the game.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { API_BASE, ffmpeg, makeClip, makeStill, ready } from './rfab.mjs';
import { ART, REVIEW, ROOT, SRC } from './lib/manifest.mjs';

const DIR = path.join(SRC, 'boss');
const OUT = path.join(ART, 'intro');
const REV = path.join(REVIEW, 'intro');
const flags = new Set(process.argv.slice(2));
/** His voice: a warm, eager male Aura voice, not YOKE's (aura-2-athena-en). */
const VOICE = process.env.BOSS_VOICE || 'aura-2-apollo-en';

const STILL =
  'A lifelike photograph, the look of hard science fiction: a still from a video call. An uplifted dog, a bureaucrat ' +
  'of an austere far-future human empire, sits upright at a bare desk like a man, seen from the chest up, facing the ' +
  'camera, both front paws resting neatly on the desk. He is a golden retriever with a kind, eager, trusting face, ' +
  'ears up, mouth a little open in a happy pant, bright eyes. He wears a crisp, perfectly pressed plain black ' +
  'high-collared uniform jacket with a narrow white inner collar, and nothing else: no badge, no medal, no insignia. ' +
  'Behind him a plain pale ceramic office wall with flush seams, even white light, nothing on the wall. Austere, ' +
  'exact, no decoration. No text anywhere, no letters, no numbers, no logos, no symbols of any kind, no religious symbol.';
const CLIP =
  'He talks warmly and eagerly to the camera, as on a video call: his mouth opens and closes as he speaks, his ears ' +
  'lift, he tilts his head once with a happy look and nods. Small natural movements only. The camera is locked: no ' +
  'zoom, no pan, no cuts. He stays the same dog in the same jacket in every frame; nothing morphs. No text appears.';

/** What he says (content/boss.ts holds the same words for the screen). */
export const MESSAGE = (() => {
  const src = fs.readFileSync(path.join(ROOT, 'content', 'boss.ts'), 'utf8');
  const m = src.match(/lines:\s*\[([\s\S]*?)\]/);
  return m ? [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((x) => x[1].replace(/\\'/g, "'")).join(' ') : '';
})();

async function voice(out) {
  if (fs.existsSync(out)) { console.log('[boss] voice: cached'); return out; }
  const res = await fetch(`${API_BASE}/api/audio/synthesize`, {
    method: 'POST',
    headers: { 'X-API-Key': process.env.RFAB_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: MESSAGE.replace(/—/g, ', '), voice: VOICE, format: 'mp3' }),
  });
  if (!res.ok) throw new Error(`voice: HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`[boss] voice: ${VOICE}, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  return out;
}

function bake() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(REV, { recursive: true });
  const clip = path.join(DIR, 'boss-clip.mp4');
  const still = path.join(DIR, 'boss.png');
  const entry = {};
  if (fs.existsSync(clip)) {
    // Frame 0 is the uploaded still itself: dropped. Played as a loop on his screen while he speaks.
    // Oct 1 2026 (notes/VIDEO-AUDIT.md): the clip does not come back to its start (the loop popped every 4 s, seam 10.9
    // against a median step of 0.8), so its last 0.6 s is crossfaded into its first, as the stills' loops are.
    const plain = path.join(DIR, 'boss-plain.mp4');
    ffmpeg(['-i', clip, '-vf', 'select=gte(n\\,1),setpts=N/24/TB,scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=24',
      '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', plain], 'boss clip');
    const L = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', plain], { encoding: 'utf8' }).stdout.trim());
    const D = 0.6, k = (D - 1 / 24).toFixed(4);
    ffmpeg(['-i', plain, '-filter_complex',
      `[0:v]split=3[t][h][m];[t]trim=start=${(L - D).toFixed(3)},setpts=PTS-STARTPTS[T];` +
      `[h]trim=end=${D},setpts=PTS-STARTPTS[H];[m]trim=start=${D}:end=${(L - D).toFixed(3)},setpts=PTS-STARTPTS[M];` +
      `[T][H]blend=all_expr='A*(1-min(T/${k},1))+B*min(T/${k},1)'[X];[X][M]concat=n=2:v=1,format=yuv420p[v]`,
    '-map', '[v]', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', path.join(OUT, 'boss.mp4')], 'boss loop');
    fs.rmSync(plain, { force: true });
    entry.video = 'intro/boss.mp4';
    ffmpeg(['-ss', '1.5', '-i', clip, '-frames:v', '1', '-vf', 'scale=960:-2', path.join(REV, 'boss-frame.jpg')], 'boss frame');
  }
  if (fs.existsSync(still)) {
    ffmpeg(['-i', still, '-vf', 'scale=960:-2', '-q:v', '78', path.join(OUT, 'boss.webp')], 'boss poster');
    ffmpeg(['-i', still, '-vf', 'scale=960:-2', path.join(REV, 'boss.jpg')], 'boss review');
    entry.poster = 'intro/boss.webp';
  }
  const mp3 = path.join(DIR, 'boss.mp3');
  if (fs.existsSync(mp3)) { fs.copyFileSync(mp3, path.join(OUT, 'boss.mp3')); entry.voice = 'intro/boss.mp3'; }
  const file = path.join(OUT, 'intro.json');
  const json = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { shots: [] };
  json.boss = entry;
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
  console.log('[boss] baked:', entry);
}

fs.mkdirSync(DIR, { recursive: true });
if (!flags.has('--bake')) {
  ready();
  const refs = [path.join(ROOT, 'notes', 'concepts', '2026-09-29', 'r3-ship-operations-white.png')].filter((f) => fs.existsSync(f));
  const still = await makeStill({ slug: 'boss', out: path.join(DIR, 'boss.png'), prompt: STILL, key: null, width: 1536, height: 1024, quality: 'high', refFiles: refs });
  if (!flags.has('--still')) {
    const s169 = path.join(DIR, 'boss-169.png');
    if (!fs.existsSync(s169)) ffmpeg(['-i', still, '-vf', 'crop=1536:864:0:120', s169], 'boss 16:9');
    await makeClip({ slug: 'boss', stillFile: s169, out: path.join(DIR, 'boss-clip.mp4'), prompt: CLIP, loop: false, raw: true, resolution: '720p', aspect: '16:9' });
    await voice(path.join(DIR, 'boss.mp3'));
  }
}
bake();
