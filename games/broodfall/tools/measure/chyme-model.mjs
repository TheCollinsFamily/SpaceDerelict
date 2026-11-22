/**
 * THE CHYME MODEL, BEFORE THE CODE (Nov 22 2026; DESIGN.md "Chyme"). The bodies the naive scripted player's creep digests
 * per wave (measured on seeds 1, 2, 4, 6, 9, hold-12, by caste) through the per-body rule and the clear's ration, and a
 * greedy buyer spending it in the scripted player's own order (tools/measure/organ-economy.measure.ts then measures the
 * real thing). Also the rejected first rule (a share of the MEAT digested): it grows with meat, 40-fold over a run.
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
