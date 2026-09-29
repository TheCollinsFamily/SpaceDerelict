/**
 * Graphics probe: limbs and the core REDRAWN in the material of the creep.
 * Collins, Sep 29 2026: "the towers … don't really fit the style of the city and creep, it
 * looks like two different art styles imposed … same with the central body of the creature
 * … maybe they could be modified to fit that style."
 *
 * Each still is redrawn from two pictures: itself (its shape) and the creep (its material).
 * The result is put on the baked terrain at game size beside the old one. No clips are
 * made: this only decides the look. PAID: about $0.12 a picture.
 *
 *   node tools/art/probe-restyle.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeStill, pool, ready } from './rfab.mjs';
import { LIMBS, MATERIAL, THEMES } from './limbs.mjs';
import { bbox, blank, borderColour, crop, over, paste, readImage, resize, writeJpg } from './lib/img.mjs';
import { keyFrame, keyOf } from './lib/key.mjs';
import { REVIEW, SRC } from './lib/manifest.mjs';

const PICK = ['spitter', 'maw', 'impaler', 'frond'];
const KEYS = { green: ['00FF00', 'green'], blue: ['0000FF', 'blue'] };

ready();
const creep = path.join(SRC, 'terrain', 'creep.png');
const out = path.join(SRC, 'restyle');
fs.mkdirSync(out, { recursive: true });

const jobs = PICK.map((family) => {
  const l = LIMBS.find((x) => x.family === family);
  const theme = THEMES[l.theme];
  const [hex, name] = KEYS[theme.key];
  return {
    id: family, old: path.join(SRC, 'limbs', family, 'still.png'), hex, name,
    prompt: `${MATERIAL} Its one accent stays as it is: ${theme.accent}.`,
  };
});
jobs.push({
  id: 'core', old: path.join(SRC, 'terrain', 'core.png'), hex: '00FF00', name: 'green',
  prompt:
    'Redraw the landing site of the FIRST picture so that the creature in it is made of exactly the living tissue ' +
    'shown in the SECOND picture: the same deep maroon and dark crimson flesh, lumpy and wet, crossed by the same ' +
    'net of darker raised veins, with the same small glossy highlights. Keep the split dark meteor and the ' +
    'glowing crimson heart inside it. The grey rubble is gone: around the meteor the ground is a thick mound of ' +
    'that tissue, from which heavy roots of the same flesh spread outward and melt into a low ragged skirt of it ' +
    'lying flat on the ground. Keep its size in the frame. The same view as the first picture: isometric, from ' +
    '45 degrees above. Soft even light from directly overhead, no cast shadows, no text.',
});

const results = await pool(jobs, 5, (j) => makeStill({
  slug: `restyle ${j.id}`, out: path.join(out, `${j.id}.png`), refFiles: [j.old, creep],
  prompt: j.prompt, key: j.hex, keyName: j.name, quality: 'high',
}));
results.forEach((r, i) => { if (!r.ok) console.log(`FAILED ${jobs[i].id}: ${r.error.message.slice(0, 200)}`); });

/** A still cut off its background and brought to `w` pixels wide. */
function cut(file, w) {
  const img = readImage(file);
  keyFrame(img, keyOf(borderColour(img)));
  const b = bbox(img, 128);
  const c = crop(img, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  return resize(c, w, Math.round((c.h / c.w) * w));
}

// Old above, new below, standing on the creep itself, at three sizes.
const tex = readImage(creep, { w: 512, h: 512 });
const W = jobs.length * 300;
const sheet = blank(W, 640, [0, 0, 0, 255]);
for (let y = 0; y < 640; y += 512) for (let x = 0; x < W; x += 512) paste(sheet, tex, x, y);
jobs.forEach((j, i) => {
  [j.old, path.join(out, `${j.id}.png`)].forEach((file, row) => {
    if (!fs.existsSync(file)) return;
    [[150, 20], [76, 180], [40, 250]].forEach(([w, dx]) => {
      const s = cut(file, j.id === 'core' ? Math.round(w * 1.5) : w);
      over(sheet, s, i * 300 + dx - (j.id === 'core' ? 10 : 0), row * 320 + 300 - s.h);
    });
  });
});
fs.mkdirSync(path.join(REVIEW, 'restyle'), { recursive: true });
const file = path.join(REVIEW, 'restyle', 'old-above-new-below.jpg');
writeJpg(file, sheet, 3);
console.log(`written: ${file}`);
