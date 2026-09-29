/**
 * REDRAW A LIMB MORE UPRIGHT (Sep 29 2026): three limbs leaned their heads out over the cell in
 * front of theirs (the check "it stands in its cell" failed: 14-19% of each lay in front). The
 * redraw keeps the limb and brings everything it has over its own skirt.
 *
 *   node tools/art/redraw-upright.mjs amp lure        their front views
 *   node tools/art/redraw-upright.mjs conduit:back    its view from behind
 *
 * The pictures and clips it replaces are MOVED into v1-leaning/ (never deleted). Then
 * `node tools/art/make.mjs limb <family>` makes the clips again from the new picture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeStill, ready } from './rfab.mjs';
import { THEMES, limb } from './limbs.mjs';
import { SRC } from './lib/manifest.mjs';

const KEYS = { green: ['00FF00', 'green'], blue: ['0000FF', 'blue'] };
const HOW = {
  amp: 'Its horn no longer reaches out forward: the horn curves UP from its base like a lily, its bell open to the sky, straight above the base.',
  lure: 'Its stalk stands straight up and its glowing bulb is straight above the base, not leaning forward.',
  conduit: 'The pipe lies straight above the middle of its base, short, not reaching out beyond the edge of the skirt at either end.',
};

ready();
for (const arg of process.argv.slice(2)) {
  const [family, view] = arg.split(':');
  const l = limb(family);
  const dir = path.join(SRC, 'limbs', family);
  const old = path.join(dir, 'v1-leaning');
  fs.mkdirSync(old, { recursive: true });
  const back = view === 'back';
  const picture = back ? 'back.png' : 'styled.png';
  const moved = fs.readdirSync(dir).filter((f) => (back ? /^back[.-]/.test(f) : /^(styled\.png|idle\.|fire\.|back[.-])/.test(f)));
  for (const f of moved) fs.renameSync(path.join(dir, f), path.join(old, f));
  const [hex, name] = KEYS[THEMES[l.theme].key];
  await makeStill({
    slug: `${family}${back ? ' from behind' : ''}, upright`, out: path.join(dir, picture), quality: 'high',
    refFiles: [path.join(old, picture), path.join(SRC, 'terrain', 'creep.png')],
    key: hex, keyName: name,
    prompt: 'Redraw the organism of the FIRST picture, the same organism in every way (the same tissue, plates, accent, ' +
      `colours and size), but COMPACT and UPRIGHT: everything it has stands straight above its own low skirt of roots, and ` +
      `nothing of it overhangs the edge of that skirt. ${HOW[family]} ${back ? 'It is seen from BEHIND, as in the first picture. ' : ''}` +
      'The same view: isometric, from 45 degrees above. Soft even light from directly overhead, no cast shadows, no text.',
  });
  console.log(`${family}${back ? ' (back)' : ''}: redrawn; moved ${moved.length} files into ${old}`);
}
