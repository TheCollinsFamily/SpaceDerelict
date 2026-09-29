/**
 * The folder Collins looks at to SEE the fixes of Sep 29 2026 working in the game:
 * notes/screens/2026-09-29/. Copies the screenshots the browser beats took (tools/screenshots,
 * PNG, not committed) as JPGs with names that say what they show. Other sessions add their
 * own (units-*, board-*, scanner-*, play-*) straight into the folder.
 *
 *   node tools/screens-gallery.mjs     after running the beats
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shots = path.join(here, 'screenshots');
const art = path.join(here, '..', 'notes', 'art-review');
const out = path.join(here, '..', 'notes', 'screens', '2026-09-29');
fs.mkdirSync(out, { recursive: true });

const PICK = [
  ['core-02-AFTER-minute-zero', 'iso-1-minute-zero.png'],
  ['core-03-AFTER-close', 'limbs-feet-check.png'],
  ['core-04-AFTER-turned-half-way', 'iso-6-turn-2.png'],
  ['limbs-02-AFTER-standing-in-their-cells', 'limbs-feet-check.png'],
  ['limbs-03-AFTER-measured-sheet', path.join(art, 'feet', 'check-1.jpg')],
  ['limbs-04-AFTER-measured-sheet', path.join(art, 'feet', 'check-8.jpg')],
  ['camera-01-turn-0', 'iso-5-close.png'],
  ['camera-02-turn-1', 'iso-6-turn-1.png'],
  ['camera-03-turn-2', 'iso-6-turn-2.png'],
  ['camera-04-turn-3', 'iso-6-turn-3.png'],
  ['camera-05-limbs-from-the-front', 'limbs-front.png'],
  ['camera-06-the-same-limbs-from-behind', 'limbs-behind.png'],
  ['big-01-broodmother-2x2-beside-small-limbs', 'limbs-big.png'],
  ['big-02-late-game-with-big-limbs', 'iso-4b-late-close.png'],
  ['plinth-01-before', 'plinth-1-before.png'],
  ['plinth-02-a-limb-and-a-big-limb-raised', 'plinth-2-raised.png'],
  ['plinth-03-seen-from-behind', 'plinth-3-from-behind.png'],
  ['seedling-01-shot-up-in-the-air', 'plinth-4-seedling-in-the-air.png'],
  ['seedling-02-landed', 'plinth-5-seedling-landed.png'],
  ['factions-01-delegation-letter-in-a-field', 'ship-contact-delegation.png'],
  ['factions-02-faithful-broadcast', 'ship-contact-faithful.png'],
  ['factions-03-institute-video-call', 'ship-contact-institute.png'],
  ['yoke-01-ai-core', 'yoke-avatar-1-room.png'],
  ['yoke-02-thinking', 'yoke-avatar-2-thinking.png'],
  ['yoke-03-answered', 'yoke-avatar-3-answered.png'],
  ['yoke-04-no-network-falls-back', 'yoke-avatar-4-fallback.png'],
  ...['terraces', 'farmland', 'wetland', 'suburb', 'megacity', 'orient', 'industrial', 'necropolis', 'deephive', 'orthodox']
    .flatMap((b, i) => [[`tiles-${String(i + 1).padStart(2, '0')}-${b}`, `biome-${b}.png`], [`tiles-${String(i + 1).padStart(2, '0')}-${b}-close`, `biome-${b}-close.png`]]),
];

let n = 0;
for (const [name, from] of PICK) {
  const src = path.isAbsolute(from) ? from : path.join(shots, from);
  if (!fs.existsSync(src)) { console.log(`missing: ${src}`); continue; }
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-q:v', '3', path.join(out, `${name}.jpg`)]);
  if (r.status === 0) n++; else console.log(`could not convert ${src}`);
}
console.log(`${n} screenshots in ${out}`);
