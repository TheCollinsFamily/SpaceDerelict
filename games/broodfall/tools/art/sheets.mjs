/**
 * Draws the limb design sheets (one per theme), so every limb's look can be seen before
 * any clip is paid for. SPENDS about 6,150 tokens a sheet.
 *
 *   node tools/art/sheets.mjs                all ten themes
 *   node tools/art/sheets.mjs core forge
 */
import { THEMES } from './limbs.mjs';
import { balance, pool, ready, spent } from './rfab.mjs';
import { makeLimbSheet } from './templates/limb.mjs';

ready();
const want = process.argv.slice(2);
const themes = want.length ? want : Object.keys(THEMES);
const before = await balance().catch(() => null);
const results = await pool(themes, 5, (t) => makeLimbSheet(t));
results.forEach((r, i) => console.log(r.ok ? `OK   ${themes[i]}: ${r.value}` : `FAIL ${themes[i]}: ${r.error.message}`));
const after = await balance().catch(() => null);
if (before !== null && after !== null) console.log(`spent ${before - after} tokens ($${((before - after) * 0.00002).toFixed(2)}) on ${spent.stills} picture(s)`);
process.exit(results.some((r) => !r.ok) ? 1 : 0);
