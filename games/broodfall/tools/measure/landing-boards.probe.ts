/**
 * Which board seeds the landing films are made from (Nov 22 2026): one per crash site (content/plates.ts START_PLATES),
 * the first seed from 1 up whose crash site is that one. Run: npx vite-node tools/measure/landing-boards.probe.ts
 */
import { Rng } from '../../src/sim/rng';
import { START_PLATES } from '../../content/plates';

const found: number[] = [];
for (let bs = 1; found.filter((x) => x !== undefined).length < START_PLATES.length && bs < 10000; bs++) {
  const crash = new Rng((bs ^ 0x5eed) >>> 0).int(0, 999) % START_PLATES.length;
  if (found[crash] === undefined) found[crash] = bs;
}
console.log(JSON.stringify(found.map((bs, i) => ({ crash: START_PLATES[i].id, boardSeed: bs }))));
