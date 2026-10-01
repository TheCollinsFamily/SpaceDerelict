/**
 * THE LANDING FILMS (Oct 1 2026). Collins: "for loading into the different biomes, do we have broodfall landing
 * animations to make it seem cohesive that would play at the start of any scenario? if not we should."
 *
 * One film per tile set, from the EMPIRE's side (the opening film is the town's): the ship in orbit lets the asset
 * go (one shot shared by every set), the living meteor tears down through THAT set's sky over THAT set's city, and
 * strikes; the fire and dust clear on the board itself, seen from the board's own camera, the first creep already
 * running out of the crater. The last frame of every film IS the board at minute zero (a picture of the real game,
 * taken by this script), so the game can lay the film's last frame over its own board and let it go.
 *
 *   node tools/art/landing.mjs boards [sets]   the board at minute zero, from the game (dev server, free)
 *   node tools/art/landing.mjs stills [sets]   the stills (SPENDS ~$0.45 each): LOOK at them before the clips
 *   node tools/art/landing.mjs clips [sets]    the clips (SPENDS ~$1.31 each: start-and-end, wan3.0, 5 s 720p)
 *   node tools/art/landing.mjs bake [sets]     cut each film together (free)
 *   node tools/art/landing.mjs [sets]          whatever is missing, in that order (not the boards)
 *   node tools/art/landing.mjs sheet           notes/screens/2026-09-30/landing-00-sheet.jpg (free)
 *
 * Raw (git-ignored, never overwritten: to draw one again MOVE it into art-src/landing/v1/):
 *   art-src/landing/board-<set>.png      the game's canvas at minute zero (1360x1000)
 *   art-src/landing/board-<set>-169.png  its middle, 16:9 (1360x765): the film's last frame
 *   art-src/landing/orbit-a.png, orbit-b.png, orbit-clip.mp4           the release (every set)
 *   art-src/landing/fall-<set>-a.png, fall-<set>-b.png, fall-<set>-clip.mp4   the fall
 *   art-src/landing/hit-<set>.png, land-<set>-clip.mp4                 the strike, ending on the board
 * Baked: public/art/landing/<set>.mp4 (1280x720, 24 fps, H.264, no sound) + <set>-end.webp (its last frame) +
 *   <set>-start.webp (its first) and public/art/landing/landing.json (what the game reads: per set the film, its
 *   length, when it strikes, and where its picture lies on the board's canvas).
 * Review: notes/art-review/landing/<set>.jpg (six frames) + <set>.json.
 *
 * Rules: no lettering in any picture, no real religious symbol (the Temple Cities carry the plain gold hexagon and
 * gold balls; content/lore/insects.md), insects never human. The ship is the Empire's (style bible "The ship").
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync, execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { balance, ffmpeg, makeClip, makeStill, pool, ready, spent } from './rfab.mjs';
import { ART, REVIEW, ROOT, SRC } from './lib/manifest.mjs';

const DIR = path.join(SRC, 'landing');
const OUT = path.join(ART, 'landing');
const REV = path.join(REVIEW, 'landing');
const CONCEPTS = path.join(ROOT, 'notes', 'concepts', '2026-09-29');
const TERR = path.join(SRC, 'ship', 'territories');
/** The board's canvas (src/render/isoRender.ts init) and the 16:9 band of it the film ends on. */
export const CANVAS = { w: 1360, h: 1000 };
export const BAND = { x: 0, y: Math.round((1000 - 765) / 2), w: 1360, h: 765 };
/** The seed the boards are pictured with (any seed: the camera frames the crash district in the middle). */
const SEED = 42;
/** Start-and-end clips: the only model that honoured an end frame (HANDOFF, the data pad). */
const MODEL = 'seegen:wan3.0-video';

const NOTHING = 'No text anywhere: no letters, no words, no numbers, no signs with writing, no logos. No crosses, no stars, ' +
  'no crescents, no religious symbol of any kind. No humans and no human faces.';
const METEOR = 'a living meteor: a huge round seed-pod of glistening dark red flesh and black chitin plates with pale bone ' +
  'spikes, split along one side with a hot orange glow inside';
const LIFELIKE = 'A lifelike photograph, real materials, natural light, sharp detail, no illustration and no painting.';

/**
 * The ten sets: the sky the asset falls through and the city it falls on (tools/art/biomes.mjs's looks, said as a
 * place seen from the air). `refs`: the territory picture(s) of the set (the globe's), with the board itself.
 */
export const SETS = [
  { id: 'suburb', refs: ['crash-site'], sky: 'a bright pale-blue summer sky with a few small white clouds',
    city: 'an insect suburb in the style of a 1950s American suburb: rounded single-storey houses of pale wasp paper and wax in mint, butter yellow, powder blue and salmon pink, round windows, striped awnings, white picket fences of wax, lawns, curving streets with small beetle-shaped cars' },
  { id: 'megacity', refs: ['glass-spires', 'university'], sky: 'a smoggy violet-grey evening sky, low cloud lit from below by neon',
    city: 'an insect megacity in a cyberpunk style: dense towers of dark smoked resin and black glass laid over honeycomb, hundreds of tiny lit round windows, neon signs of abstract glyphs in magenta and cyan, steam, cables between towers' },
  { id: 'orient', refs: ['pilgrim'], sky: 'a hazy pale-gold late-afternoon sky with long thin clouds',
    city: 'an insect city as a 1950s Western film imagined the Far East (no real country): tiers of upswept eaves of layered paper, lacquer-red columns, jade-green tiled roofs, gold trim, round moon gates, strings of glowing paper lanterns' },
  { id: 'orthodox', refs: ['temple', 'seventh-city'], sky: 'a high pale cream-white overcast sky with a soft warm glow',
    city: 'an insect temple city: pale cream wasp-paper and wax buildings with arcades of round arches, bands of gold mosaic, onion domes of layered paper and gilded onion domes each ending in a plain gold ball (no crosses anywhere), slender paper bell towers' },
  { id: 'industrial', refs: ['harbor', 'foundry'], sky: 'a brown-grey sky thick with chimney smoke, a dull orange sun behind it',
    city: 'an insect port and factory town: soot-darkened blocks of baked resin like brick, riveted iron gantries, tall chimneys, corrugated paper sheds, cranes over a grey harbour, furnace light in windows' },
  { id: 'farmland', refs: [], sky: 'a wide soft grey-blue sky over flat country',
    city: 'an insect farming town in open country: barns of red-stained paper boards with white trim, round silos, a windmill, grain elevators, hedges, wooded slopes and green pasture around a few streets of farmhouses' },
  { id: 'necropolis', refs: ['ossuary'], sky: 'an ash-grey sky with sea fog rolling in off a dark coast',
    city: 'an insect city of the dead on a coast: bone-white walls of chalk and pale wax full of round burial niches, candles by the hundred, dark slender fungus trees, black iron gates, terraces of tombs (no crosses: the tombs carry only a plain gold hexagon)' },
  { id: 'deephive', refs: ['queens-hollow'], sky: 'a dusty amber haze, the light low and golden',
    city: 'an ancient insect hive city grown rather than built: great towers of amber wax comb and dark propolis, brood cells capped with pale wax, honey-gold light in open cells, ribbed tunnels, small electric lamps and cables fitted into it' },
  { id: 'terraces', refs: ['granary'], sky: 'a clear pale sky with high thin cloud over hills',
    city: 'farmed hill country of the insects: terraced fields stepping down the hills behind dry-stone walls laid like honeycomb, banks of ochre earth, field shelters shaped like beehives, a few homes dug into the banks, trees and moss' },
  { id: 'wetland', refs: ['mirewater'], sky: 'a low grey sky over still water, a pale light on the horizon',
    city: 'an insect delta town: houses of woven reed and pale wasp paper on stilts over dark still water, thatch, boardwalks of pale planks, reed beds, flooded paddies, small boats, nets and faded blue and orange floats' },
];
const SET = Object.fromEntries(SETS.map((s) => [s.id, s]));

const raw = (name) => path.join(DIR, name);

// ------------------------------------------------------------------ boards (the game, minute zero)

function freePort(port) {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split('\n')) {
      if (!line.includes(`:${port} `) || !line.includes('LISTENING')) continue;
      const pid = line.trim().split(/\s+/).pop();
      try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch { /* gone */ }
    }
  } catch { /* no netstat */ }
}

/** The game's own dev server on a port of this script's, and a GPU browser. */
async function startGame(port) {
  freePort(port);
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(port), '--strictPort'],
    { cwd: ROOT, stdio: 'pipe', shell: process.platform === 'win32', env: { ...process.env, BROODFALL_NO_HMR: '1' } });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the dev server did not start in 40s')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('localhost')) { clearTimeout(timer); resolve(); } });
    child.on('exit', (code) => reject(new Error(`the dev server exited early (${code})`)));
  });
  return { child, stop: () => { try { execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' }); } catch { /* gone */ } freePort(port); } };
}

async function boards(ids) {
  const want = ids.filter((id) => !fs.existsSync(raw(`board-${id}.png`)));
  if (!want.length) { console.log('[landing] boards: all on disk'); return; }
  const { chromium } = await import('@playwright/test');
  const port = Number(process.env.LANDING_PORT || 5317);
  const game = await startGame(port);
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
  try {
    for (const id of want) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
      await page.addInitScript(() => { try { localStorage.setItem('broodfall-intro-seen', '1'); } catch { /* ok */ } });
      await page.goto(`http://localhost:${port}/?seed=${SEED}&speed=0&autostart=1&biome=${id}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.broodfall !== undefined && window.__bfBooted, null, { timeout: 120000 });
      await page.waitForTimeout(3500);
      const drawn = await page.evaluate(() => window.broodfall.biome());
      if (drawn !== id) throw new Error(`board ${id}: the game drew ${drawn}`);
      const { url, core } = await page.evaluate(() => {
        const b = window.broodfall;
        const r = b.renderer;
        r.app.render();
        const p = b.worldToScreen(b.sim.core.x, b.sim.core.y);
        return { url: r.app.canvas.toDataURL('image/png'), core: { x: Math.round(p.x), y: Math.round(p.y) } };
      });
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(raw(`board-${id}.png`), Buffer.from(url.split(',')[1], 'base64'));
      // Where the meteor stands on the canvas: the game lays the film's last frame so that its crater is on the live one.
      fs.writeFileSync(raw(`board-${id}.json`), JSON.stringify({ seed: SEED, canvas: CANVAS, core }) + '\n');
      console.log(`[landing] board ${id}: pictured`);
      await page.close();
    }
  } finally {
    await browser.close();
    game.stop();
  }
}

/** The film's last frame: the middle of the board's canvas, 16:9. */
function band(id) {
  const out = raw(`board-${id}-169.png`);
  if (!fs.existsSync(out)) ffmpeg(['-i', raw(`board-${id}.png`), '-vf', `crop=${BAND.w}:${BAND.h}:${BAND.x}:${BAND.y}`, out], `${id} band`);
  return out;
}

// ------------------------------------------------------------------ stills

const W = 1280, H = 720;
const territoryRefs = (s) => s.refs.map((t) => path.join(TERR, `${t}.png`)).filter((f) => fs.existsSync(f));

const ORBIT_A = `${LIFELIKE} High orbit above the day side of an alien planet with invented continents (green and ochre land, white ` +
  'cloud, blue sea, a thin blue line of atmosphere along its curve, black space above). In the upper middle of the picture ' +
  'an austere white cylindrical spacecraft with one ring around it and two dark flat panels, a plain black gear mark on ' +
  `its hull, seen from a little below. Just under its open round lower hatch, ${METEOR}, has just been let go and hangs a ` +
  `short way below the ship, dark and cold, falling toward the planet. Hard white sunlight, deep black shadows. ${NOTHING}`;
const ORBIT_B = 'Keep this photograph exactly as it is: the same spacecraft, the same planet, the same light and framing. ' +
  'Change ONE thing: the dark red living meteor is no longer under the ship: it is now FAR below it, a small glowing ' +
  'orange-white ember with a long bright trail of fire, entering the planet\'s atmosphere over the clouds in the lower ' +
  `middle of the picture. ${NOTHING}`;

const fallA = (s) => `${LIFELIKE} A wide aerial view from high above ${s.city}, seen at a steep angle from about a kilometre up, ` +
  `the city filling the lower two thirds of the picture, under ${s.sky}. High in the sky in the upper part of the picture, a ` +
  'small blinding orange-white fireball with a long trail of fire and smoke streaks down at a steep diagonal toward the city: ' +
  `a meteor falling. The insects' city goes on below as on any day. ${NOTHING}`;
const fallB = 'Keep this photograph exactly as it is: the same city, the same sky, the same angle and framing. Change ONE ' +
  `thing: the falling meteor is now huge and close, just above the rooftops in the middle of the city: ${METEOR}, ` +
  'wrapped in fire and trailing smoke and loose red tendrils, its fiery glow lighting the roofs below it orange, dust ' +
  `already lifting from the streets under it. ${NOTHING}`;
const HIT = 'Keep this picture exactly as it is: the same city blocks, the same streets, the same camera angle, the same ' +
  'framing and scale, the same dark smoke-covered city around it. Change ONE thing: it is the instant a meteor strikes the ' +
  'place where the dark red meteor stands: a huge blinding orange-white fireball bursts out of that spot, a ring of grey-brown ' +
  'dust and debris rolling out along the streets around it and over the nearest roofs, burning fragments flying. The fireball ' +
  `and dust hide the meteor and the red ground around it completely. ${NOTHING}`;

async function stills(sets, withOrbit) {
  if (withOrbit && !fs.existsSync(raw('orbit-a.png'))) {
    await makeStill({ slug: 'landing orbit-a', out: raw('orbit-a.png'), prompt: ORBIT_A, key: null, width: W, height: H, quality: 'high',
      refFiles: [path.join(CONCEPTS, 'r4-ship-exterior-ring-drop.png'), path.join(SRC, 'ship', 'exterior.png')].filter((f) => fs.existsSync(f)) });
  }
  if (withOrbit && fs.existsSync(raw('orbit-a.png'))) {
    await makeStill({ slug: 'landing orbit-b', out: raw('orbit-b.png'), prompt: ORBIT_B, key: null, width: W, height: H, quality: 'high', refFiles: [raw('orbit-a.png')] });
  }
  const res = await pool(sets, 4, async (s) => {
    await makeStill({ slug: `landing fall-${s.id}-a`, out: raw(`fall-${s.id}-a.png`), prompt: fallA(s), key: null, width: W, height: H, quality: 'high',
      refFiles: [...territoryRefs(s), raw(`board-${s.id}.png`)] });
    await makeStill({ slug: `landing fall-${s.id}-b`, out: raw(`fall-${s.id}-b.png`), prompt: fallB, key: null, width: W, height: H, quality: 'high',
      refFiles: [raw(`fall-${s.id}-a.png`)] });
    await makeStill({ slug: `landing hit-${s.id}`, out: raw(`hit-${s.id}.png`), prompt: HIT, key: null, width: W, height: H, quality: 'high',
      refFiles: [band(s.id)] });
  });
  res.forEach((r, i) => { if (!r.ok) console.warn(`[landing] ${sets[i].id} stills failed: ${r.error.message.slice(0, 200)}`); });
}

// ------------------------------------------------------------------ clips

const CLIP_TAIL = 'One continuous shot, no cuts, no text. Lifelike, real physics.';
const ORBIT_CLIP = 'The dark living meteor drops away from the spacecraft and falls toward the planet, shrinking with distance, ' +
  'then catches fire as it enters the atmosphere and becomes a bright streak over the clouds. The spacecraft stays where it ' +
  `is, its ring turning slowly. The camera holds still. ${CLIP_TAIL}`;
const FALL_CLIP = 'The meteor plunges down out of the sky toward the city, growing huge as it comes, wrapped in fire and smoke, ' +
  'its glow lighting the rooftops orange; dust lifts from the streets beneath it. The camera holds, shaking slightly. ' +
  'The buildings stay the same buildings. ' + CLIP_TAIL;
const LAND_CLIP = 'The fireball of the meteor strike rolls outward and up and fades, the dust ring spreads and settles and ' +
  'thins away, and the smoke clears to show the dark red living meteor standing in its crater, the wet dark red living ' +
  'skin creeping out from it across the streets and roofs around it. The camera is completely locked: no zoom, no pan, ' +
  'no tilt. The city blocks stay exactly the same blocks. ' + CLIP_TAIL;

async function clips(sets, withOrbit) {
  const jobs = [];
  if (withOrbit && fs.existsSync(raw('orbit-b.png'))) jobs.push({ slug: 'landing-orbit', stillFile: raw('orbit-a.png'), endFile: raw('orbit-b.png'), prompt: ORBIT_CLIP, out: raw('orbit-clip.mp4') });
  for (const s of sets) {
    if (fs.existsSync(raw(`fall-${s.id}-b.png`))) jobs.push({ slug: `landing-fall-${s.id}`, stillFile: raw(`fall-${s.id}-a.png`), endFile: raw(`fall-${s.id}-b.png`), prompt: FALL_CLIP, out: raw(`fall-${s.id}-clip.mp4`) });
    if (fs.existsSync(raw(`hit-${s.id}.png`))) jobs.push({ slug: `landing-land-${s.id}`, stillFile: raw(`hit-${s.id}.png`), endFile: band(s.id), prompt: LAND_CLIP, out: raw(`land-${s.id}-clip.mp4`) });
  }
  const res = await pool(jobs, 4, (j) => makeClip({ ...j, models: [MODEL], seconds: 5, raw: true, resolution: '720p', aspect: '16:9' }));
  res.forEach((r, i) => { if (!r.ok) console.warn(`[landing] ${jobs[i].slug} failed: ${r.error.message.slice(0, 200)}`); });
}

// ------------------------------------------------------------------ bake

/**
 * The cut (seconds of each raw clip, and how fast it plays). The orbit: the asset let go until it is a streak in the
 * atmosphere. The fall: the streak until the meteor is over the roofs (played 1.2x). The strike: all of it (1.2x),
 * ending on the board. Orbit → fall is a 0.3 s dissolve; fall → strike a hard cut under the game's white flash.
 */
export const CUT = { orbit: { from: 0.6, to: 2.4 }, fall: { from: 0, to: 2.9, speed: 1.2 }, land: { speed: 1.2 }, dissolve: 0.3 };
const FPS = 24;
const ENC = ['-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];

function duration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return Math.round(Number(r.stdout.trim()) * 1000) / 1000;
}
const frameAt = (file, t, out, w = 640) => ffmpeg(['-ss', Math.max(0, t).toFixed(3), '-i', file, '-frames:v', '1', '-vf', `scale=${w}:-2`, '-q:v', '3', out], `frame ${out}`);
/** The last frame of a film (seeking to its end is not exact: decode the last half second, keep the last). */
const lastFrame = (file, out, args = []) => ffmpeg(['-sseof', '-0.5', '-i', file, '-update', '1', ...args, out], `last ${out}`);

/** Mean absolute difference of two pictures, grey 64x36 (how far the film's end is from the board). */
function picDiff(a, b) {
  const grey = (f) => spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', f, '-vf', 'scale=64:36,format=gray', '-frames:v', '1', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 24 }).stdout;
  const x = grey(a), y = grey(b);
  let d = 0;
  for (let i = 0; i < Math.min(x.length, y.length); i++) d += Math.abs(x[i] - y[i]);
  return +(d / Math.max(1, Math.min(x.length, y.length))).toFixed(2);
}

function bakeFilm(id) {
  const orbit = raw('orbit-clip.mp4'), fall = raw(`fall-${id}-clip.mp4`), land = raw(`land-${id}-clip.mp4`);
  if (![orbit, fall, land].every((f) => fs.existsSync(f))) { console.warn(`[landing] ${id}: clips missing, not baked`); return null; }
  fs.mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, `${id}.mp4`);
  const S = `scale=1280:720:flags=lanczos,fps=${FPS},format=yuv420p`;
  const o = CUT.orbit, f = CUT.fall, l = CUT.land, D = CUT.dissolve;
  const oLen = o.to - o.from;
  const fLen = (f.to - f.from) / f.speed;
  const lLen = (duration(land) - 1 / 30) / l.speed;
  // The model comes NEAR its end frame but not always onto it (the Deep Hive's creep came out as tendrils): the board's
  // own picture is faded in over the strike's last `settle` seconds, so every film ends exactly on the board.
  const settle = 0.6;
  ffmpeg(['-i', orbit, '-i', fall, '-i', land, '-loop', '1', '-i', band(id), '-filter_complex',
    `[0:v]trim=start=${o.from}:end=${o.to},setpts=PTS-STARTPTS,${S}[o];` +
    `[1:v]trim=start=${f.from}:end=${f.to},setpts=(PTS-STARTPTS)/${f.speed},${S}[f];` +
    // The strike's first frame is the uploaded still (it can flash): the game's own flash covers the cut.
    `[2:v]trim=start_frame=1,setpts=(PTS-STARTPTS)/${l.speed},${S}[l0];` +
    `[3:v]trim=end=${lLen.toFixed(3)},setpts=PTS-STARTPTS,${S},format=yuva420p,fade=t=in:st=${(lLen - settle).toFixed(3)}:d=${settle}:alpha=1[b];` +
    `[l0][b]overlay=shortest=1,format=yuv420p[l];` +
    `[o][f]xfade=transition=fade:duration=${D}:offset=${(oLen - D).toFixed(3)}[of];[of][l]concat=n=2:v=1[v]`,
  '-map', '[v]', ...ENC, out], `${id} film`);
  const seconds = duration(out);
  const strikeAt = +(oLen - D + fLen).toFixed(3);
  const WEBP = ['-c:v', 'libwebp', '-lossless', '0', '-q:v', '88'];
  ffmpeg(['-i', out, '-frames:v', '1', ...WEBP, path.join(OUT, `${id}-start.webp`)], `${id} start`);
  const endPng = raw(`tmp-${id}-end.png`);
  lastFrame(out, endPng);
  ffmpeg(['-i', endPng, ...WEBP, path.join(OUT, `${id}-end.webp`)], `${id} end`);
  // Review: six frames, and how near the last frame is to the board it must become.
  fs.mkdirSync(REV, { recursive: true });
  const tmp = path.join(DIR, 'tmp');
  fs.mkdirSync(tmp, { recursive: true });
  const at = [0.3, oLen - 0.1, oLen + fLen * 0.5, strikeAt - 0.05, strikeAt + 0.6, null];
  const tiles = at.map((t, i) => {
    const p = path.join(tmp, `${id}-${i}.jpg`);
    if (t === null) lastFrame(out, p, ['-vf', 'scale=640:-2', '-q:v', '3']); else frameAt(out, t, p);
    return p;
  });
  ffmpeg([...tiles.flatMap((t) => ['-i', t]), '-filter_complex', '[0][1][2]hstack=3[a];[3][4][5]hstack=3[b];[a][b]vstack=2[v]', '-map', '[v]', '-q:v', '4', path.join(REV, `${id}.jpg`)], `${id} review`);
  const endVsBoard = picDiff(endPng, band(id));
  const core = JSON.parse(fs.readFileSync(raw(`board-${id}.json`), 'utf8')).core;
  const report = { id, seconds, fallAt: +Math.max(0.3, strikeAt - 3.2).toFixed(3), strikeAt, endVsBoard, core, models: MODEL, cut: CUT };
  fs.writeFileSync(path.join(REV, `${id}.json`), JSON.stringify(report, null, 2) + '\n');
  console.log(`[landing] baked ${id}: ${seconds}s, strike at ${strikeAt}s, last frame vs board ${endVsBoard}`);
  return report;
}

function bake(sets) {
  for (const s of sets) bakeFilm(s.id);
  // landing.json lists every film on disk (a set without one starts with no film).
  const films = {};
  for (const s of SETS) {
    const rev = path.join(REV, `${s.id}.json`);
    if (!fs.existsSync(path.join(OUT, `${s.id}.mp4`)) || !fs.existsSync(rev)) continue;
    const r = JSON.parse(fs.readFileSync(rev, 'utf8'));
    films[s.id] = { video: `landing/${s.id}.mp4`, start: `landing/${s.id}-start.webp`, end: `landing/${s.id}-end.webp`,
      seconds: r.seconds, fallAt: r.fallAt, strikeAt: r.strikeAt, core: r.core };
  }
  fs.writeFileSync(path.join(OUT, 'landing.json'), JSON.stringify({ canvas: CANVAS, band: { ...BAND, left: BAND.x, top: BAND.y, width: BAND.w, height: BAND.h }, films }, null, 2) + '\n');
  console.log(`[landing] landing.json: ${Object.keys(films).length} films`);
}

/** All ten films side by side: one row each, five frames (release, fall, over the roofs, strike, the board). */
function sheet() {
  const dir = path.join(ROOT, 'notes', 'screens', '2026-09-30');
  const tmp = path.join(DIR, 'tmp');
  fs.mkdirSync(tmp, { recursive: true });
  const rows = [];
  for (const s of SETS) {
    const film = path.join(OUT, `${s.id}.mp4`);
    if (!fs.existsSync(film)) continue;
    const r = JSON.parse(fs.readFileSync(path.join(REV, `${s.id}.json`), 'utf8'));
    const ts = [0.5, r.strikeAt - 1.6, r.strikeAt - 0.1, r.strikeAt + 0.5, null];
    const tiles = ts.map((t, i) => {
      const p = path.join(tmp, `sheet-${s.id}-${i}.jpg`);
      if (t === null) lastFrame(film, p, ['-vf', 'scale=384:-2', '-q:v', '3']); else frameAt(film, t, p, 384);
      return p;
    });
    const row = path.join(tmp, `sheet-${s.id}.jpg`);
    ffmpeg([...tiles.flatMap((t) => ['-i', t]), '-filter_complex', 'hstack=5', '-q:v', '3', row], `${s.id} row`);
    rows.push(row);
  }
  const out = path.join(dir, 'landing-00-sheet.jpg');
  ffmpeg([...rows.flatMap((t) => ['-i', t]), '-filter_complex', `vstack=${rows.length}`, '-q:v', '4', out], 'sheet');
  console.log(`[landing] ${out}: ${rows.length} films`);
}

const args = process.argv.slice(2);
const steps = new Set(['boards', 'stills', 'clips', 'bake', 'sheet']);
const step = steps.has(args[0]) ? args[0] : null;
const only = args.filter((a) => !steps.has(a) && !a.startsWith('--'));
const ids = SETS.map((s) => s.id).filter((id) => !only.length || only.includes(id));

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  fs.mkdirSync(DIR, { recursive: true });
  if (step === 'boards') { await boards(ids); process.exit(0); }
  const sets = ids.map((id) => SET[id]);
  const withOrbit = !only.length || only.includes('orbit');
  if (!step || step === 'stills' || step === 'clips') {
    ready();
    const before = await balance();
    if (step !== 'clips') await stills(sets, withOrbit);
    if (step !== 'stills') await clips(sets, withOrbit);
    const after = await balance();
    console.log(`[landing] asked for ${spent.stills} stills, ${spent.clips} clips; balance ${before} -> ${after} (${before - after} tokens)`);
  }
  if (!step || step === 'bake') bake(sets);
  if (!step || step === 'sheet') sheet();
}
