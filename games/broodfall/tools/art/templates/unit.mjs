/**
 * THE UNIT TEMPLATE: one enemy kind from its approved design to a sprite the game loads.
 *
 *   design sheet -> the unit's figure -> five views in ONE picture -> a walking clip and an
 *   attacking clip per view -> keyed, cut to a loop, packed into an atlas -> manifest entry
 *
 * Five views are made (toward, toward-left, left, away-left, away); the three right-hand
 * views are mirror images, which gives the 8 headings. Measured Sep 29 2026: 23,700 tokens
 * ($0.47) a clip, so 125,000 tokens for a unit that walks and 245,000 for one that also attacks.
 */
import fs from 'node:fs';
import path from 'node:path';
import { lock, makeClip, makeStill, pool } from '../rfab.mjs';
import { placeOnSheet, unit } from '../units.mjs';
import { blank, borderColour, crop, paste, readFrames, readImage, resize, writePng } from '../lib/img.mjs';
import { figure, findFigures } from '../lib/sheet.mjs';
import { diffThumb, dropSpecks, fringe, keyClip, keyFrame, keyOf, loopWindow, pick, thumb, unionBox } from '../lib/key.mjs';
import { packAtlas, reviewFrames, reviewSheet } from '../lib/atlas.mjs';
import { ART, REVIEW, ROOT, SRC, putEntry } from '../lib/manifest.mjs';
import { ffmpeg } from '../rfab.mjs';

export const VIEWS = ['S', 'SW', 'W', 'NW', 'N'];
const FPS = 12;
const COLS = 16;
/** Frames kept per animation and view. */
const KEEP = { walk: 14, attack: 12, death: 12, hit: 8, braced: 10, enter: 16, special: 14 };

const EMBLEM =
  'Its one emblem is a small plain gold hexagon, the shape of a honeycomb cell. There are no crosses, no stars ' +
  'and no crescents anywhere';
/** The hive's own creatures carry nothing of the empire's (the broodling came out with a gold hexagon on its back). */
const emblemOf = (u) => u.emblem ?? (u.noEmblem ? 'It carries no emblem, no badge, no metal and no markings of any kind: it is all living flesh' : EMBLEM);
const KEYS = { green: { hex: '00FF00', name: 'green' }, magenta: { hex: 'FF00FF', name: 'magenta' } };

/** Green is the proven background; anything teal, green or royal is cut off magenta instead. */
export function keyFor(u) {
  if (u.key) return KEYS[u.key];
  if (u.caste !== 'war') return KEYS.magenta;
  return /green|teal/.test(u.look) ? KEYS.magenta : KEYS.green;
}

const GAIT = {
  walk: { noun: 'unit', heading: 'walking', caught: 'mid-stride',
    motion: 'The unit marches on the spot as if on a treadmill: its legs step in a steady gait, its arms and kit sway slightly, its body bobs.' },
  scuttle: { noun: 'creature', heading: 'scuttling', caught: 'mid-stride',
    motion: 'The creature scuttles on the spot as if on a treadmill: its legs step quickly in an alternating gait, its body bobs slightly.' },
  crew: { noun: 'unit', heading: 'walking', caught: 'mid-stride',
    motion: 'The big beetle walks on the spot as if on a treadmill, its six legs stepping slowly and heavily, and its small crew march on the spot beside it, keeping their places.' },
  ride: { noun: 'unit', heading: 'walking', caught: 'mid-stride',
    motion: 'The big beetle walks on the spot as if on a treadmill, its six legs stepping slowly and heavily, and its small rider keeps its seat, swaying with each step.' },
  // The townsfolk fleeing the crash (src/sim/civilians.ts): they run in a panic, they never march.
  run: { noun: 'person', heading: 'running', caught: 'mid-stride, running in a panic',
    motion: 'The person runs on the spot in a panic as if on a treadmill: legs pumping fast, the free arm flailing, the bag swinging, the body bobbing and leaning forward.' },
  fly: { noun: 'unit', heading: 'flying', caught: 'mid-wingbeat',
    motion: 'The unit hovers on the spot in the air: its wings beat fast, its body bobs gently up and down, its legs dangle.' },
};
const gaitOf = (u) => GAIT[u.gait ?? (u.body === 'human-like' ? 'walk' : u.body === 'machine' ? 'crew' : 'scuttle')];

const ATTACK = {
  shot: 'The unit stops, raises its weapon and fires three quick shots in the direction it is facing, with small bright muzzle flashes and recoil, then lowers the weapon and returns to exactly its starting pose.',
  blade: 'The unit stops and swings its glowing weapon in one wide arc at something directly in front of it, then returns to exactly its starting pose.',
  bite: 'The creature lunges a short way forward and bites, then pulls back to exactly its starting pose.',
};
function attackOf(u) {
  if (u.attackMotion) return u.attackMotion;
  if (/Fires from one cell away|Fires a dart|Shells|Lobs/.test(u.attack)) return ATTACK.shot;
  if (/Swings|Cuts|Tears|Strikes/.test(u.attack)) return ATTACK.blade;
  if (/Bites/.test(u.attack)) return ATTACK.bite;
  return null;
}

/** A flinch when struck (Sep 30 2026): short, and back to the pose it started from. */
const HIT = {
  walk: 'The unit is struck hard by something in front of it: it flinches, jerking back and hunching its shoulders, rocks half a step on the spot, then straightens up and returns to exactly its starting pose, and stays still.',
  scuttle: 'The creature is struck hard from in front: it recoils sharply, its body jolting back and its legs splaying, then it steadies and returns to exactly its starting pose, and stays still.',
  crew: 'The big beetle is struck hard from in front: it rocks back on its legs with a jolt and its crew flinch and duck, then everything settles back to exactly its starting pose, and stays still.',
  ride: 'The big beetle is struck hard from in front: it rocks back on its legs with a jolt and its rider flinches, then everything settles back to exactly its starting pose, and stays still.',
  fly: 'The unit is struck hard in the air: its body jerks and twists sharply, its wings faltering for a moment, then it recovers and hovers in exactly its starting pose. It stays in the middle of the picture the whole time and does not drop or fall.',
};
const hitOf = (u) => u.hitMotion ?? HIT[u.gait ?? (u.body === 'human-like' ? 'walk' : u.body === 'machine' ? 'crew' : 'scuttle')];

const frameSize = (u) => (u.r <= 9 ? 128 : u.r <= 13 ? 192 : 256);

const turnaroundPrompt = (u, g) =>
  `A turnaround sheet of the ONE game ${g.noun} in the reference picture, drawn five times in a single horizontal ` +
  'row, evenly spaced and not overlapping, all five at exactly the same size, in exactly the same drawing ' +
  'style as the reference: a chunky, slightly cartoonish unit sprite for a strategy game. It is the identical ' +
  `${g.noun} every time: ${u.one ?? u.look}. The same clothes, colours and kit, held the same way, the same ` +
  'proportions. ' + TOP_CAMERA + ' Every one of the five is seen by that SAME camera, the camera of the SECOND ' +
  'reference picture, which shows the board it walks on as the game sees it. ' + READABLE + ' ' +
  `From left to right the ${g.noun} is: ` +
  `(1) ${g.heading} straight toward the viewer, seen from the front; ` +
  `(2) ${g.heading} toward the lower left, seen from the front-left; ` +
  `(3) ${g.heading} to the left, seen from its left side; ` +
  `(4) ${g.heading} away toward the upper left, seen from behind and to the left; ` +
  `(5) ${g.heading} straight away from the viewer, seen from behind. Each is caught ${g.caught}. Even light ` +
  `from directly overhead. ${emblemOf(u)}. No ground, no cast shadows, no labels, no numbers, no text.`;

/** The camera and the readability every unit is drawn for (probed: tools/art/probe-unit-camera.mjs). */
const TOP_CAMERA =
  'THE CAMERA: high above and looking steeply DOWN at the unit, about 50 degrees below the horizon, as the ' +
  'camera of StarCraft, Warcraft III and Red Alert 2 looks at its units. So: the TOP of the head or helmet and ' +
  'the tops of the shoulders face the viewer and are the biggest, clearest part of it; the body is short and ' +
  'foreshortened beneath them; the legs and feet are small and tucked under; we see down onto the weapon and ' +
  'the pack from above. It is NOT seen from the side and NOT at eye level: no horizon, the face is seen from ' +
  'above, never straight on.';
const READABLE =
  'It reads at a glance when it is small: a bold, simple silhouette seen from above; its head, helmet or crest ' +
  'and its weapon exaggerated in size; its caste colour in large flat areas on the top of the helmet and the ' +
  'shoulders, where the camera sees it.';

const STEADY = ' It never travels across the frame and never turns. It only walks: it does not fire, and there is no smoke, no sparks and no flash. The drawing style stays exactly the same in every frame.';

/** Steps 1 and 2: the unit's figure off its sheet, then five views of it. */
async function makeViews(u, dir, key) {
  const done = VIEWS.every((v) => fs.existsSync(path.join(dir, `view-${v}.png`)));
  if (done) return;
  const ref = path.join(dir, 'ref.png');
  if (u.design) {
    // No concept sheet: its figure is drawn first, from its references. Look at ref.png before the views are paid for.
    await makeStill({
      slug: `${u.kind} design`, out: ref, refFiles: u.design.refs.map((r) => path.join(SRC, r)),
      prompt: `${u.design.prompt} ${emblemOf(u)}. Even light from directly overhead, no cast shadows, no text.`, key: key.hex, keyName: key.name, quality: 'high',
    });
  } else {
    const place = placeOnSheet(u.kind);
    if (!place) throw new Error(`${u.kind}: not on any approved sheet`);
    const sheetFile = path.join(ROOT, 'notes', 'concepts', '2026-09-29', `${place.sheet}.png`);
    const sheet = readImage(sheetFile);
    const found = findFigures(sheet, { expect: place.count });
    if (found.boxes.length !== place.count) throw new Error(`${u.kind}: ${found.boxes.length} figures on ${place.sheet}, ${place.count} expected`);
    writePng(ref, resize(figure(sheet, found.boxes[place.index], found), 1024, 1024));
  }

  const g = gaitOf(u);
  const turn = await makeStill({
    // The second reference is the board as the game's camera sees it: without it the model draws units at eye
    // level, as the concept sheet is drawn (Collins, Sep 29 2026: 'in profile and not from above with an angle').
    slug: `${u.kind} views`, out: path.join(dir, 'turnaround.png'), refFiles: [ref, path.join(SRC, 'refs', 'board-camera.png'), ...(u.steep ? [path.join(SRC, 'refs', 'camera-example.png')] : [])],
    // A unit that still came out upright (u.steep) also gets a unit drawn at the right angle as a third reference.
    prompt: turnaroundPrompt(u, g) + (u.steep ? ' The THIRD reference picture is another unit seen by exactly the right camera: see the top of the head and shoulders as much as it does. ' + (typeof u.steep === 'string' ? u.steep : '') : ''), key: key.hex, keyName: key.name, width: 1536, height: 1024,
  });
  const img = readImage(turn);
  const five = findFigures(img, { expect: 5 });
  if (five.boxes.length !== 5) {
    throw new Error(`${u.kind}: ${five.boxes.length} figures on the turnaround, 5 expected. Look at ${turn}; delete it to draw again.`);
  }
  // One square size for all five, so their sizes relative to each other are kept.
  const side = Math.ceil(Math.max(...five.boxes.map((b) => Math.max(b.x1 - b.x0, b.y1 - b.y0))) * 1.5);
  const bg = five.bg;
  five.boxes.forEach((b, i) => writePng(path.join(dir, `view-${VIEWS[i]}.png`), resize(figure(img, b, five, 0, side), 1024, 1024)));
  // All five side by side, to look at before any clip is paid for.
  const strip = blank(5 * 256, 256, [bg[0], bg[1], bg[2], 255]);
  five.boxes.forEach((b, i) => paste(strip, resize(figure(img, b, five, 0, side), 256, 256), i * 256, 0));
  writePng(path.join(dir, 'views.png'), strip);
}

/**
 * STATES: what a unit looks like while the sim holds it in a state (src/sim/types.ts Enemy:
 * groundedUntil, deployed, hitShield, burrowed, carrying, stole). One still each, redrawn from
 * its view toward the lower left, seen by the same camera; the game mirrors it by heading.
 * id: the name in the manifest (anims.states.<id>); the renderer knows which sim field each is.
 */
export const STATES = {
  flier: [{ id: 'grounded', prompt: 'The same winged trooper, brought down: sprawled on the ground tangled in a sticky white web net, its wings folded and stuck, struggling.' }],
  shadewing: [{ id: 'grounded', prompt: 'The same moth-like unit, brought down: sprawled on the ground tangled in a sticky white web net, its wings folded and stuck, struggling.' }],
  // Braced (Sep 30 2026): the first braced pictures read as the walking ones at game size. These change the
  // SILHOUETTE: legs splayed flat like a star on spades, the belly down on a round base plate, the gun raised steeply.
  cannon: [{ id: 'deployed', prompt: 'The same cannon beetle, dug in and set up to fire, so that its shape is completely different from when it walks: its six legs splayed out wide and flat like a star, each ending in a big steel spade dug into the ground; its belly lowered right down onto a wide round steel base plate; its long barrel raised steeply, pointing up at about sixty degrees; a low ring of sandbags around the base plate; the two crewmen crouched behind it with their hands over their ears.' }],
  dartgun: [{ id: 'deployed', prompt: 'The same dart battery beetle, dug in and set up to fire, so that its shape is completely different from when it walks: its legs splayed out wide and flat like a star, each ending in a steel spade dug into the ground; its belly lowered right down onto a wide round base plate; its rack of glass dart tubes raised steeply and fanned open, pointing up at the sky; the crewman kneeling beside it at a small control box.' }],
  carapace: [{ id: 'stripped', prompt: 'The same beetle with its whole copper dome shell torn off and gone: no dome, no plates, no ribs. What is left is its soft pale pinkish-grey insect body, bare and wrinkled, with its thin dark legs and the small cannon strapped on its bare back, a few broken copper bolts where the shell was. It looks flat, small and vulnerable, nothing like a dome.' }],
  tunneler: [{ id: 'burrowed', prompt: 'Only a travelling mound of broken street where the unit tunnels just under the surface: a low hump of cracked pale paving slabs and loose earth heaving up, a little dust. The unit itself cannot be seen at all.' }],
  researcher: [{ id: 'carrying', prompt: 'The same researcher carrying off a stolen specimen: a small wet dark-maroon lump of living flesh with little roots, strapped in a glass-fronted container on its back, glowing faintly.' }],
  infiltrator: [{ id: 'carrying', prompt: 'The same infiltrator carrying off a stolen specimen: a small wet dark-maroon lump of living flesh with little roots, bundled in a net on its back.' }],
  thief: [{ id: 'carrying', prompt: 'The same thief running off with its sack bulging full of dark red meat, dripping a little, slung over its back.' }],
};

/**
 * THE BOSSES (Sep 30 2026): the royal and the consort are baked from bigger frames and have an
 * arrival (played once when they come on the board) and a special attack, in all five views.
 * The royal's special is her command (the game shows her aura pulsing out with it); the consort's
 * is his promotion salute, played each time the sim promotes a war body near him.
 */
export const BOSS = {
  royal: { frame: 320,
    enter: 'The queen makes her entrance: she draws herself up to her full height, spreads both arms wide and high in a grand commanding gesture, her robe and her long abdomen swaying, holds the pose proudly for a moment, then lowers her arms and returns to exactly her starting pose.',
    special: 'The queen gives a command: she throws her head back and flings one arm high above her crown and the other forward, as if calling her whole army on, her body swelling with effort, then she lowers her arms and returns to exactly her starting pose.' },
  consort: { frame: 256,
    enter: 'The officer makes his entrance: he snaps to attention, sweeps his cap off in a grand bow, straightens and puts it back on, then returns to exactly his starting pose.',
    special: 'The officer gives a promotion: he raises his free hand high in a crisp salute, then points forward sharply with it as if giving an order, then returns to exactly his starting pose.' },
};

/**
 * SKINS: a unit that looks different in a state it WALKS in gets its own walking clips in that
 * look (five views), not a frozen picture. One still per view, redrawn from that view.
 * The carapace lord (Sep 30 2026): its ablative shell (hitShield 6) cracked from half down, then gone.
 */
export const SKINS = {
  carapace: [
    { id: 'cracked', prompt: 'The same beetle with its copper dome shell badly battered: split by deep cracks, dented, two of its plates torn off showing the pale soft body underneath, bolts sprung and plates hanging loose. The dome is still on but clearly breaking.' },
    { id: 'stripped', prompt: STATES.carapace[0].prompt },
  ],
};

/** A braced unit's shot: played once from its braced picture each time the sim fires a shell (Sep 30 2026). */
const BRACED = {
  cannon: { state: 'deployed', motion: 'The dug-in cannon fires once: the whole gun jolts down hard into its base plate with the recoil, the barrel kicks back, a small puff of smoke leaves the muzzle and the crewmen flinch; then everything settles back to exactly its starting pose and stays still.' },
  dartgun: { state: 'deployed', motion: 'The dug-in dart battery fires once: one glass tube in the raised rack kicks with a small puff, the whole machine jolts down into its base plate and the crewman flinches; then everything settles back to exactly its starting pose and stays still.' },
};

async function makeStates(u, dir, key) {
  const list = STATES[u.kind] ?? [];
  const results = await pool(list, 4, (st) => makeStill({
    slug: `${u.kind} ${st.id}`, out: path.join(dir, `state-${st.id}.png`), refFiles: [path.join(dir, 'view-SW.png'), path.join(SRC, 'refs', 'board-camera.png')],
    prompt: `${st.prompt} The same unit as the first reference picture, the same clothes, colours and drawing style, the same size in the frame, seen by exactly the same camera: from high above looking steeply down, as the second reference picture sees the board. It faces the lower left. ${EMBLEM}. Even light from directly overhead, no cast shadows, no text.`,
    key: key.hex, keyName: key.name, quality: 'medium',
  }));
  results.forEach((r, i) => { if (!r.ok) console.warn(`[unit] ${u.kind} state ${list[i].id} failed: ${r.error.message.slice(0, 160)}`); });
}

/** The stills of a unit's skins: one per view, each redrawn from that view. */
export async function makeSkins(u, dir, key) {
  const list = (SKINS[u.kind] ?? []).flatMap((sk) => VIEWS.map((v) => ({ sk, v })));
  const results = await pool(list, 5, ({ sk, v }) => makeStill({
    slug: `${u.kind} ${sk.id} ${v}`, out: path.join(dir, `skin-${sk.id}-${v}.png`), refFiles: [path.join(dir, `view-${v}.png`)],
    prompt: `${sk.prompt} The same unit as the reference picture, in exactly the same pose, heading and place in the frame, the same size, the same drawing style, seen by exactly the same camera from high above. ${EMBLEM}. Even light from directly overhead, no cast shadows, no text.`,
    key: key.hex, keyName: key.name, quality: 'medium',
  }));
  results.forEach((r, i) => { if (!r.ok) console.warn(`[unit] ${u.kind} skin ${list[i].sk.id} ${list[i].v} failed: ${r.error.message.slice(0, 160)}`); });
}

/** Step 3: the clips. */
async function makeClips(u, dir, key, anims) {
  const g = gaitOf(u);
  const jobs = [];
  for (const v of VIEWS) {
    const still = path.join(dir, `view-${v}.png`);
    jobs.push({ v, anim: 'walk', still, prompt: g.motion + STEADY });
    const a = attackOf(u);
    if (a && anims.includes('attack')) jobs.push({ v, anim: 'attack', still, prompt: `${a} It does not walk and does not turn. The drawing style stays exactly the same in every frame.` });
    if (anims.includes('hit')) jobs.push({ v, anim: 'hit', still, prompt: `${hitOf(u)} It does not walk, does not travel, does not turn, and does not fire or attack. No sparks, no blood, no flash, no smoke, no projectiles. The drawing style stays exactly the same in every frame.` });
    const boss = BOSS[u.kind];
    if (boss && anims.includes('boss')) {
      for (const anim of ['enter', 'special']) jobs.push({ v, anim, still, prompt: `${boss[anim]} It does not walk, does not travel and does not turn. No sparks, no flash, no smoke, no glow. The drawing style stays exactly the same in every frame.` });
    }
    // A skin walks in its own look, from its own still of this view.
    if (anims.includes('skins')) {
      for (const sk of SKINS[u.kind] ?? []) {
        const skin = path.join(dir, `skin-${sk.id}-${v}.png`);
        if (fs.existsSync(skin)) jobs.push({ v, anim: `walk-${sk.id}`, still: skin, prompt: g.motion + STEADY });
      }
    }
  }
  // Braced: the dug-in picture firing once (toward the lower left; mirrored by heading, as the states are).
  const braced = BRACED[u.kind];
  if (braced && anims.includes('braced')) {
    const still = path.join(dir, `state-${braced.state}.png`);
    if (!fs.existsSync(still)) throw new Error(`${u.kind}: make the braced picture first (--states): ${still}`);
    jobs.push({ v: 'SW', anim: 'braced', still, prompt: `${braced.motion} It does not move from its spot and does not turn. The drawing style stays exactly the same in every frame.` });
  }
  if (anims.includes('death')) {
    jobs.push({ v: 'SW', anim: 'death', still: path.join(dir, 'view-SW.png'), loop: false,
      prompt: `The ${g.noun} is struck, staggers, and collapses onto the ground where it stands, then lies completely still for the rest of the clip: it does not get up and does not move again. It falls on the spot and does not travel across the frame. Seen from above by the same camera as the picture, all the time. The camera is completely locked: no zoom, no pan, no cuts. The solid pure ${key.name} #${key.hex} background stays flat and empty. No blood spray, no text.`, raw: true });
  }
  // ART_POOL: how many clips are made at once (several sessions share the video service).
  const results = await pool(jobs, Number(process.env.ART_POOL || 5), (j) => makeClip({
    slug: `${u.kind} ${j.anim} ${j.v}`, out: path.join(dir, `${j.anim}-${j.v}.mp4`), stillFile: j.still,
    prompt: j.prompt, key: key.hex, keyName: key.name, loop: j.loop !== false, raw: j.raw,
  }));
  const failed = results.map((r, i) => (r.ok ? null : `${jobs[i].anim} ${jobs[i].v}: ${r.error.message.slice(0, 160)}`)).filter(Boolean);
  if (failed.length) console.warn(`[unit] ${u.kind}: ${failed.length} clip(s) failed:\n  ${failed.join('\n  ')}`);
}

/**
 * Where the motion of a one-off clip is (a flinch, a shot, a gesture): the frames that differ from
 * the first by more than a quarter of the most any frame does, with a frame either side. A clip
 * made with its end frame = its start frame moves in the middle and stands still around it.
 */
function motionWindow(frames) {
  const t = frames.map((f) => thumb(f));
  const d = t.map((x) => diffThumb(x, t[0]));
  const peak = Math.max(...d);
  const thr = Math.max(0.8, peak * 0.25);
  let first = d.findIndex((x) => x > thr);
  let last = d.length - 1 - [...d].reverse().findIndex((x) => x > thr);
  if (first < 0) { first = 0; last = frames.length - 1; }
  return { start: Math.max(0, first - 1), end: Math.min(frames.length, last + 2), peak };
}

/** Animations, in the order they are packed (the walk first: it is on the first page). */
const ANIMS = ['walk', 'attack', 'death', 'hit', 'braced', 'enter', 'special'];
/** Those played once from their start, not looped: cut to where they move. */
const ONCE = new Set(['hit', 'braced', 'enter', 'special']);
/** An atlas page is kept under this; a unit with more frames is packed on several pages. */
const PAGE_BYTES = 860 * 1024;

/**
 * The frames on atlas pages: as few pages as keep every page under PAGE_BYTES, whole clips on
 * one page each, in order. Sets each clip's `start` (on its page) and `page` (when not the first).
 * Returns the pages' files (relative to public/art) and sizes.
 */
function packPages(groups, F, kind, sub) {
  const total = groups.reduce((a, g) => a + g.frames.length, 0);
  let out = null;
  for (let n = 1; n <= 8 && !out; n++) {
    const per = Math.ceil(total / n);
    const pages = [[]];
    let count = 0;
    for (const g of groups) {
      if (pages[pages.length - 1].length && count + g.frames.length > per && pages.length < n) { pages.push([]); count = 0; }
      pages[pages.length - 1].push(g);
      count += g.frames.length;
    }
    const packed = pages.map((p, i) => {
      const rel = `${sub}/${kind}${i ? `-${i + 1}` : ''}.webp`;
      return { p, rel, ...packAtlas(p.flatMap((g) => g.frames), F, COLS, path.join(ART, rel)) };
    });
    if (packed.every((x) => x.bytes < PAGE_BYTES) || n === 8) out = packed;
  }
  out.forEach((pg, i) => {
    let at = 0;
    for (const g of pg.p) {
      g.rec.start = at;
      if (i) g.rec.page = i; else delete g.rec.page;
      at += g.frames.length;
    }
  });
  // Pages left from an earlier bake with more of them.
  for (let i = out.length; i < 8; i++) fs.rmSync(path.join(ART, `${sub}/${kind}-${i + 1}.webp`), { force: true });
  return out;
}

/** Step 4: clips to atlas pages, a manifest entry, the checks and the review pictures. Free. */
export function bakeUnit(kind) {
  const u = unit(kind);
  const dir = path.join(SRC, 'units', kind);
  const F = BOSS[kind]?.frame ?? frameSize(u);
  const skins = (SKINS[kind] ?? []).map((s) => `walk-${s.id}`);
  const clips = [];
  for (const anim of [...ANIMS, ...skins]) {
    for (const v of VIEWS) {
      const file = path.join(dir, `${anim}-${v}.mp4`);
      if (!fs.existsSync(file)) continue;
      const keyed = keyClip(readFrames(file, FPS));
      let frames = keyed.frames;
      let loop = null;
      let moved = null;
      if (anim.startsWith('walk')) { loop = loopWindow(frames); frames = frames.slice(loop.start, loop.end); }
      if (ONCE.has(anim) && anim !== 'braced') {
        // A frame where the unit touches the edge of the video is cut off by it (a flier jolted out of
        // the picture): it is left out, and the flinch plays on without it.
        const whole = frames.filter((f) => { const q = unionBox([f]); return !q || (q.x0 > 2 && q.y0 > 2 && q.x1 < f.w - 3 && q.y1 < f.h - 3); });
        if (whole.length >= frames.length * 0.6) frames = whole;
      }
      if (ONCE.has(anim)) {
        // The video starts and ends on the still, which the model draws a little smaller than the moving
        // frames it zooms to at once: those few frames would make the unit shrink as a flinch begins.
        const hs = frames.map((f) => { const b = unionBox([f]); return b ? b.y1 - b.y0 : 0; });
        const med = [...hs].sort((a, b) => a - b)[hs.length >> 1];
        const off = (h) => Math.abs(h - med) > med * 0.08;
        // The first and last few frames always go (the model's zoom settles in them), then any more that are off.
        let a = Math.min(3, frames.length >> 3);
        let z = frames.length - a;
        while (a < Math.min(7, z - 2) && off(hs[a])) a++;
        while (z > Math.max(frames.length - 7, a + 2) && off(hs[z - 1])) z--;
        frames = frames.slice(a, z);
        moved = motionWindow(frames);
        frames = frames.slice(moved.start, moved.end);
      }
      // A flinch or a gesture throws nothing: a casing or a dart the model let fly is not part of it.
      if (anim === 'hit' || anim === 'enter' || anim === 'special') for (const f of frames) dropSpecks(f);
      clips.push({ anim, v, frames, box: unionBox(frames), loop, moved, key: keyed.key, w: keyed.w, h: keyed.h, seconds: frames.length / FPS });
    }
  }
  const walks = clips.filter((c) => c.anim === 'walk');
  if (!walks.length) throw new Error(`${kind}: no walking clips to bake in ${dir}`);

  // Every animation of a view shares that view's centre line and feet line, taken from its
  // walk, so the unit does not jump when it stops walking to attack.
  const base = Object.fromEntries(walks.map((c) => [c.v, { cx: (c.box.x0 + c.box.x1) / 2, feet: c.box.y1 }]));
  const BELOW = 0.06;
  // The frame is sized by the WALK, with room to raise a weapon.
  let side = 0;
  for (const c of walks) {
    const b = base[c.v];
    const halfW = Math.max(b.cx - c.box.x0, c.box.x1 - b.cx);
    side = Math.max(side, 2 * halfW, (b.feet - c.box.y0) / (1 - BELOW));
  }
  side = Math.ceil(side * 1.3);

  /**
   * The window a clip is cut with. The walk's window, grown (never moved) to hold all of what a
   * clip that is not a walk does: a fall that drops below a flier's feet (the shadewing's was cut
   * off, Sep 30 2026), a braced gun with its legs splayed. A grown window is drawn at the same
   * scale as the walk: its clip carries the anchor (where the walk's feet are in it) and `scale`.
   */
  const windowOf = (b, box) => {
    const w0 = { x0: b.cx - side / 2, y0: b.feet + BELOW * side - side };
    if (!box) return { ...w0, s: side };
    const m = side * 0.02;
    let ex0 = Math.min(w0.x0, box.x0 - m);
    let ex1 = Math.max(w0.x0 + side, box.x1 + m);
    let ey0 = Math.min(w0.y0, box.y0 - m);
    let ey1 = Math.max(w0.y0 + side, box.y1 + m);
    const s = Math.ceil(Math.max(ex1 - ex0, ey1 - ey0));
    if (s <= side + 1) return { ...w0, s: side };
    ex0 -= (s - (ex1 - ex0)) / 2; ex1 = ex0 + s;
    ey0 -= (s - (ey1 - ey0)) / 2; ey1 = ey0 + s;
    return { x0: ex0, y0: ey0, s };
  };
  const record = (win, b, count, fps) => {
    const rec = { start: 0, count, fps };
    if (win.s > side + 1) {
      rec.anchor = [Number(((b.cx - win.x0) / win.s).toFixed(4)), Number(((b.feet - win.y0) / win.s).toFixed(4))];
      rec.scale = Number((win.s / side).toFixed(4));
    }
    return rec;
  };

  const checks = [];
  const check = (name, ok, value) => checks.push({ name, ok, value });
  const groups = [];
  const anims = {};
  const rows = [];
  for (const c of clips) {
    const b = base[c.v] ?? base.SW;
    // The video model zooms in its own way on each clip: a flinch or a gesture came out up to a fifth
    // bigger than the walk of the same view (the unit swelled as it was struck). It is brought to the
    // walk's size, and its middle and feet put where the walk's are.
    const twin = walks.find((w) => w.v === c.v);
    if (twin && ['hit', 'enter', 'special'].includes(c.anim)) {
      const med = (a) => [...a].sort((p, q) => p - q)[a.length >> 1];
      const boxes = (fr) => fr.map((f) => unionBox([f])).filter(Boolean);
      const wb = boxes(twin.frames);
      const cb = boxes(c.frames);
      if (wb.length && cb.length) {
        const k = med(wb.map((q) => Math.max(q.x1 - q.x0, q.y1 - q.y0))) / med(cb.map((q) => Math.max(q.x1 - q.x0, q.y1 - q.y0)));
        const cx = med(cb.map((q) => (q.x0 + q.x1) / 2));
        const feet = med(cb.map((q) => q.y1));
        c.frames = c.frames.map((f) => {
          const r = Math.abs(k - 1) > 0.03 ? resize(f, Math.round(f.w * k), Math.round(f.h * k)) : f;
          const kk = r === f ? 1 : k;
          return crop(r, Math.round(cx * kk - b.cx), Math.round(feet * kk - b.feet), f.w, f.h);
        });
        c.box = unionBox(c.frames);
        check(`${c.anim} ${c.v}: brought to the walk's size`, k > 0.6 && k < 1.5, `x${k.toFixed(2)}`);
      }
    }
    // A flinch stays about where the unit walks: what reaches far outside that (the pole the model
    // drew striking it, Sep 30 2026) is not the unit, and is cut away.
    if (c.anim === 'hit') {
      const wb = walks.find((w) => w.v === c.v)?.box;
      if (wb) {
        const m = side * 0.2;
        for (const f of c.frames) {
          for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
            if (x >= wb.x0 - m && x <= wb.x1 + m && y >= wb.y0 - m && y <= wb.y1 + m) continue;
            f.data[(y * f.w + x) * 4 + 3] = 0;
          }
        }
        c.box = unionBox(c.frames);
      }
    }
    const win = c.anim.startsWith('walk') && c.anim !== 'walk' ? windowOf(b, null) : windowOf(b, c.anim === 'walk' ? null : c.box);
    const kept = pick(c.frames, KEEP[c.anim] ?? KEEP.walk).map((f) => resize(crop(f, Math.round(win.x0), Math.round(win.y0), win.s, win.s), F, F));
    const rec = record(win, b, kept.length, Number((kept.length / c.seconds).toFixed(2)));
    (anims[c.anim] ??= {})[c.v] = rec;
    groups.push({ rec, frames: kept });
    c.kept = kept;

    const tag = `${c.anim} ${c.v}`;
    if (c.loop) {
      check(`${tag}: loop closes`, c.loop.seam < 4, Number(c.loop.seam.toFixed(2)));
      check(`${tag}: it moves`, c.loop.motion > 0.6, Number(c.loop.motion.toFixed(2)));
      check(`${tag}: loop is long enough`, c.loop.end - c.loop.start >= 10, c.loop.end - c.loop.start);
    }
    if (c.moved) check(`${tag}: it moves`, c.moved.peak > 1.5, Number(c.moved.peak.toFixed(2)));
    if (c.anim === 'walk') check(`${tag}: inside the frame`, c.box.x0 > 2 && c.box.y0 > 2 && c.box.x1 < c.w - 2 && c.box.y1 < c.h - 2, `${c.box.x0},${c.box.y0}-${c.box.x1},${c.box.y1}`);
    // Nothing a clip does is cut off by its window (the clip's own picture may still cut it: the edge of the video).
    if (c.anim !== 'walk' && c.box) {
      const inside = c.box.x0 >= win.x0 && c.box.y0 >= win.y0 && c.box.x1 <= win.x0 + win.s && c.box.y1 <= win.y0 + win.s;
      check(`${tag}: nothing cut off`, inside, win.s > side + 1 ? `window grown ${(win.s / side).toFixed(2)}x` : 'in the walk frame');
    }
    const fr = fringe(c.frames[0], keyOf(c.key));
    check(`${tag}: no background tint on the outline`, fr < 0.05, `${(fr * 100).toFixed(1)}%`);
    // It must stay on the spot: the first and the last frame of a loop share a centre.
    const first = unionBox([c.frames[0]]);
    const last = unionBox([c.frames[c.frames.length - 1]]);
    if (c.anim !== 'death' && !ONCE.has(c.anim) && first && last) {
      const drift = Math.abs((first.x0 + first.x1) / 2 - (last.x0 + last.x1) / 2) / side;
      check(`${tag}: stays on the spot`, drift < 0.06, `${(drift * 100).toFixed(1)}% of the frame`);
    }
  }
  for (const v of VIEWS) if (!anims.walk?.[v]) check(`walk ${v}: exists`, false, 'missing');
  // A fall (or a braced shot) is drawn once, toward the lower left: every view plays it, mirrored by heading.
  for (const one of ['death', 'braced']) {
    if (!anims[one]) continue;
    const clip = anims[one].SW ?? Object.values(anims[one])[0];
    for (const v of VIEWS) anims[one][v] ??= clip;
  }
  // The states: one frame each, cut with the lower-left view's centre and feet (the window grown to hold them).
  const walkClip = walks.find((c) => c.v === 'SW') ?? walks[0];
  for (const st of STATES[kind] ?? []) {
    const file = path.join(dir, `state-${st.id}.png`);
    if (!fs.existsSync(file)) { check(`state ${st.id}: exists`, false, 'missing'); continue; }
    // The still is the size of the view it was drawn from; the clips are smaller: brought to the clip's size.
    let img = readImage(file, { w: walkClip.w, h: walkClip.h });
    keyFrame(img, keyOf(borderColour(img)));
    dropSpecks(img);
    let b = base.SW ?? base[walkClip.v];
    // The model draws a still at its own size: one drawn much smaller than the unit walks (the braced
    // dart battery, Sep 30 2026) is brought up to the walk's size, by how much of the picture each covers.
    const cover = (f) => { let n = 0; for (let i = 3; i < f.data.length; i += 4) if (f.data[i] > 128) n++; return n; };
    const k = st.id === 'burrowed' ? 1 : Math.sqrt(cover(walkClip.frames[0]) / Math.max(1, cover(img)));
    if (k > 1.15) {
      img = resize(img, Math.round(img.w * k), Math.round(img.h * k));
      // It is drawn where the walk stands in the picture: that point, grown with it.
      b = { cx: b.cx * k, feet: b.feet * k };
      check(`state ${st.id}: brought to the walk's size`, true, `x${k.toFixed(2)}`);
    }
    const win = windowOf(b, unionBox([img]));
    const f = resize(crop(img, Math.round(win.x0), Math.round(win.y0), win.s, win.s), F, F);
    const rec = record(win, b, 1, 1);
    (anims.states ??= {})[st.id] = rec;
    groups.push({ rec, frames: [f] });
    check(`state ${st.id}: made`, true, win.s > side + 1 ? `window grown ${(win.s / side).toFixed(2)}x` : 'yes');
  }
  // Views of one unit must be one size: compare how much of the frame each one fills.
  const fill = walks.map((c) => Math.max(c.box.x1 - c.box.x0, c.box.y1 - c.box.y0) / side);
  check('views are one size', Math.max(...fill) / Math.min(...fill) < 1.6, fill.map((f) => f.toFixed(2)).join(' '));

  const pages = packPages(groups, F, kind, 'units');
  const bytes = pages.reduce((a, p) => a + p.bytes, 0);

  // How big to draw it: the game gives the unit a radius; the frame is that much wider than the body.
  const bodyW = walks.map((c) => (c.box.x1 - c.box.x0) / side).sort((a, b) => a - b)[walks.length >> 1];
  const entry = {
    atlas: pages[0].rel, ...(pages.length > 1 ? { pages: pages.slice(1).map((p) => p.rel) } : {}), frame: F, cols: COLS,
    anchor: [0.5, Number((1 - BELOW).toFixed(3))],
    /** The body's width as a share of the frame's: the game scales the frame so the body matches the unit's radius. */
    body: Number(bodyW.toFixed(3)),
    flies: u.gait === 'fly' || /drawn in the air/.test(u.look),
    anims,
  };
  putEntry(u.ally ? 'allies' : 'units', kind, entry);

  const shown = [...ANIMS, ...skins];
  for (const v of VIEWS) {
    const a = shown.map((n) => clips.find((c) => c.anim === n && c.v === v)?.kept).filter(Boolean);
    if (a.length) rows.push({ label: v, anims: a });
  }
  fs.mkdirSync(path.join(REVIEW, 'units'), { recursive: true });
  const sheet = reviewSheet(rows, F, path.join(REVIEW, 'units', `${kind}.jpg`));
  // A film of all eight headings walking, over street and over creep.
  const eight = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'].map((h) => {
    const src = { NE: 'NW', E: 'W', SE: 'SW' }[h];
    const kept = clips.find((c) => c.anim === 'walk' && c.v === (src ?? h))?.kept ?? [];
    return src ? kept.map((f) => { const m = blank(F, F); for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) f.data.copy(m.data, (y * F + (F - 1 - x)) * 4, (y * F + x) * 4, (y * F + x + 1) * 4); return m; }) : kept;
  }).filter((k) => k.length);
  const tmp = path.join(dir, 'review-frames');
  fs.rmSync(tmp, { recursive: true, force: true });
  reviewFrames(eight, F, tmp, 'f');
  const film = path.join(REVIEW, 'units', `${kind}.mp4`);
  ffmpeg(['-framerate', '12', '-i', path.join(tmp, 'f-%04d.png'), '-vf', 'crop=trunc(iw/2)*2:trunc(ih/2)*2:0:0', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '30', film], `${kind} review film`);
  fs.rmSync(tmp, { recursive: true, force: true });

  const frameCount = groups.reduce((a, g) => a + g.frames.length, 0);
  const bad = checks.filter((c) => !c.ok);
  fs.writeFileSync(path.join(REVIEW, 'units', `${kind}.json`), `${JSON.stringify({ kind, frames: frameCount, atlasKB: Math.round(bytes / 1024), pages: pages.length, failed: bad.length, checks }, null, 1)}\n`);
  console.log(`[unit] ${kind}: ${frameCount} frames, ${pages.length} page(s), ${Math.round(bytes / 1024)} KB, ${checks.length - bad.length}/${checks.length} checks passed`);
  for (const c of bad) console.log(`       FAILED ${c.name}: ${c.value}`);
  return { kind, entry, checks, sheet, film };
}

export async function makeUnit(kind, { anims = ['walk'], bakeOnly = false, viewsOnly = false, clipsOnly = false } = {}) {
  const u = unit(kind);
  if (!u) throw new Error(`no unit called "${kind}" in tools/art/units.mjs`);
  const dir = path.join(SRC, 'units', kind);
  fs.mkdirSync(dir, { recursive: true });
  if (!bakeOnly) {
    const key = keyFor(u);
    await makeViews(u, dir, key);
    if (viewsOnly) return { kind, views: path.join(dir, 'turnaround.png') };
    if (anims.includes('skins')) await makeSkins(u, dir, key);
    await makeClips(u, dir, key, anims);
    if (anims.includes('states')) await makeStates(u, dir, key);
  }
  if (clipsOnly) return { kind };
  return bakeUnit(kind);
}

export { lock };
