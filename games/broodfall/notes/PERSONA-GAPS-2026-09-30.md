# Persona notes on the gameplay gaps (Sep 30 2026)

## Civilians fleeing the crash

Built: `src/sim/civilians.ts` (the crowd, its own seeded Rng, reads the sim only), drawn by
`drawTownsfolk` in `src/render/isoRender.ts` and `drawCivilians` in `src/render/render.ts`
(`?view=top`); the townsperson's pictures are `civilian` in `ALLIES` (`tools/art/units.mjs`).
Proof: `notes/screens/2026-09-30/gap-civilians-1.jpg`, `gap-civilians-2.jpg`
(`node tools/shot-civilians.mjs`); tests `tests/civilians.test.ts`.

- **Newcomer.** The first thing on the board that moves is people: little ant commuters with
  shopping bags standing about, then bolting. It says "you just landed in somebody's town"
  before a word of tutorial. They run toward the glowing gate, which quietly teaches where the
  enemy will come from. Risk: they could be mistaken for the first wave; the pale-blue coats and
  bags (no orange, no guns) and the fact they run AWAY keep them apart.
- **Genre veteran.** Pure flavour, and it stays out of the way: no hit boxes, no targeting, no
  effect on the waves or the economy (a test runs the sim with and without them and compares).
  They are gone in well under a minute, so the siege board is clean. Would want: a sound for the
  panic (a distant crowd murmur) and later a reason to care (a directive that pays for sparing them).
- **Breaker.** Tried: fast-forward (the crowd is stepped from the sim's tick, catches up, never
  more than one step per tick), pausing (they freeze with the sim), a new run (a new crowd), the
  top-down view, drafting plates mid-run (a smaller crowd, capped at 60 in all), creep nodes
  thrown on them (the ones that stand on creep 1.5 s are taken, the rest run). No way found to
  make them change a number the game keeps.
