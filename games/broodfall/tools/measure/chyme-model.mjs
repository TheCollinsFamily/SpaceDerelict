/**
 * THE CHYME MODEL, BEFORE THE CODE (Nov 22 2026; DESIGN.md "Chyme"). The bodies the naive scripted player's creep digests
 * per wave (measured on seeds 1, 2, 4, 6, 9, hold-12, by caste) through the per-body rule and the clear's ration, and a
 * greedy buyer spending it in the scripted player's own order (tools/measure/organ-economy.measure.ts then measures the
 * real thing). Also the rejected first rule (a share of the MEAT digested): it grows with meat, 40-fold over a run.
 *
 * THE RUMEN (Nov 22 2026, DESIGN.md "THE RUMEN"), modelled the same way: it feeds on the bodies the limbs of the themes it
 * touches kill (SHARE of all bodies: about 45% for the scripted player's placement, beside the meteor and a theme, read off
 * the uncapped measure), +1 a body up to FEED_CAP a wave, and ferments 1-3 a clear for a player who spends. Grown after wave
 * 2 (early: the first theme waits for it), 4 (mid), 8 (late) or never; what each run then has.
 *
 *   node tools/measure/chyme-model.mjs
 */
const bodies = { // after clear n (index n-1): war, science, royal bodies digested in that wave
  war: [6, 8, 10, 30, 21, 44, 59, 96, 94, 99, 101],
  sci: [0, 0, 1.4, 1.4, 1.6, 6.4, 6.6, 11.4, 7.8, 11.8, 10.5],
  royal: [0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0],
};
const meat = [12, 23, 51, 97, 82, 223, 335, 558, 526, 582, 575]; // war + science meat digested, same waves
// The scripted player's wants, in its order, at their chyme prices (content/underground.ts).
const LIST = [['gut', 35], ['forge', 40], ['bladder', 25], ['pacemaker', 20], ['heart', 30], ['lattice', 30], ['cyst', 15],
  ['venom', 40], ['mire', 25], ['heart', 30], ['scaffold', 20], ['seeder', 25], ['nerve', 45], ['catapult', 30], ['runner', 30],
  ['womb', 40], ['heart', 30], ['acid', 30], ['budder', 30], ['marrow', 45], ['swell', 25], ['resonance', 55], ['heart', 30]];

function model(name, perWave) {
  let bank = 0, i = 0, levels = 0, lvl = 30, total = 0;
  const rows = [];
  for (let n = 1; n <= 11; n++) {
    const got = perWave(n);
    total += got; bank += got;
    const bought = [];
    while (i < LIST.length && bank >= LIST[i][1]) { bank -= LIST[i][1]; bought.push(LIST[i][0]); i++; }
    if (i >= LIST.length) while (bank >= lvl) { bank -= lvl; levels++; lvl += 30; bought.push('LV'); }
    rows.push(`  after wave ${String(n).padStart(2)}: +${got.toFixed(0).padStart(3)} chyme, bank ${bank.toFixed(0).padStart(3)}, buys ${bought.join(' ') || '-'}`);
  }
  console.log(`${name}: ${total.toFixed(0)} a run, ${i}/${LIST.length} organs, ${levels} levels\n${rows.join('\n')}`);
}
model('BUILT: per body (war 1, science 2, court 4) + 38 a clear', (n) => bodies.war[n - 1] + 2 * bodies.sci[n - 1] + 4 * bodies.royal[n - 1] + 38);
model('rejected: 15% of the meat digested + 36 + 3/wave', (n) => 0.15 * meat[n - 1] + 36 + 3 * n);

const SHARE = 0.45;
const PRICE = 60;
function rumenRun(name, at, feedCap) {
  const per = (n) => bodies.war[n - 1] + 2 * bodies.sci[n - 1] + 4 * bodies.royal[n - 1] + 38;
  let bank = 0, i = 0, levels = 0, lvl = 30, total = 0, made = 0, grown = false;
  const list = [...LIST];
  for (let n = 1; n <= 11; n++) {
    let got = per(n);
    if (grown) { const feed = Math.min(feedCap, Math.round(SHARE * (bodies.war[n - 1] + bodies.sci[n - 1]))); made += feed + 2; got += feed + 2; }
    total += got; bank += got;
    if (!grown && at !== null && n >= at && bank >= PRICE) { bank -= PRICE; grown = true; }
    while (i < list.length && bank >= list[i][1] && (grown || at === null || n < at)) { bank -= list[i][1]; i++; }
    if (i >= list.length) while (bank >= lvl) { bank -= lvl; levels++; lvl += 30; }
  }
  console.log(`  ${name.padEnd(28)} chyme ${total.toFixed(0)} (the Rumen ${made}), ${i}/${list.length} organs, ${levels} levels`);
}
console.log('\nTHE RUMEN (60 chyme): uncapped vs capped at 12 a wave');
for (const cap of [Infinity, 12]) {
  console.log(cap === Infinity ? ' uncapped' : ' capped 12 a wave (built)');
  rumenRun('early (after wave 2)', 2, cap);
  rumenRun('mid (after wave 4)', 4, cap);
  rumenRun('late (after wave 8)', 8, cap);
  rumenRun('never', null, cap);
}
