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

## Royal decrees (the royal special-upgrade sinks)

Built: `content/royal.ts`, `Sim` `case 'decree'`, the box `src/ui/decrees.ts`, the crown in the limb
panel (`src/ui/hud.ts`). Proof: `gap-royal-decrees.jpg`, `gap-royal-commission.jpg`,
`gap-royal-crown.jpg` (`node tools/shot-gaps.mjs royal`); tests `tests/gaps.test.ts`.

- **Newcomer.** The bar's royal button used to say "1R → +120 MASS", a number that meant nothing.
  Now it opens a list of six things a royal point does, each in one plain sentence with its price,
  and the one that is bought on a limb says where ("click one of your limbs: CROWN is in its
  panel"). Royal points arrive late (the court is the jackpot), so the box is mostly dim until
  then: that reads as "something to earn", which is the point. PASS. Note: the box does not say
  how far away the court is; the THREAT dial does, but nothing connects the two.
- **Genre veteran.** These are the genre's "relic / boss reward" tier (Balatro's vouchers, Slay
  the Spire's boss relics, Kingdom Rush's hero upgrades): few, rule-bending, not stat creep. The
  crown and the favour are the royal caste's OWN powers (presence aura, promotion) turned to your
  side, which makes killing the court feel like taking something from it. Retinue (hand size) and
  Larder (breaks use-it-or-lose-it) are the two a veteran will fight over. PASS.
- **Breaker.** Tried to stack one thing to absurdity: crowns add without a cap (NO CAPS rule), so
  five crowns in one cluster make its limbs take 0.17 harm and hit +125% — busted on purpose, and
  paid for with five court kills. Tried the Commission for a free 42-science amplifier for one
  point: allowed, and its price climbs a point each time. Tried to buy decrees with no points,
  commission a locked limb, a seedling or the cage: refused. The scripted player spends every point
  it earns (5-6 a run that reaches the court) and its win rate stayed inside the guard (see
  `notes/GAPS-2026-09-30.md`). No degenerate line found that skips the court.

## Surgery under fire

Built: `Sim` `case 'build'` (the graft), `harmMultOf`, `woundNear`; hints in `src/main.ts`, the raw
ring in `src/render/render.ts`. Proof: `gap-surgery-warning.jpg`, `gap-surgery-graft.jpg`.

- **Newcomer.** The hover over a limb with a card held, mid-siege, now ends with "SURGERY UNDER
  FIRE: the new limb will graft ~4s — no fire, double harm, the climbers smell it": the risk is
  read before the click, never discovered after. The grafting limb pulses red and its panel counts
  down. PASS.
- **Genre veteran.** It restores the design's rhythm (big surgery between waves) without banning
  mid-fight play: eating a gun in a siege is now a gamble you can see. The grafting delay is short
  (3 s + 0.5 s a bonus) so a desperate swap still works. PASS.
- **Breaker.** Tried to dodge it by eating between waves and placing mid-siege: the graft is on the
  PLACEMENT (the banked bonuses are grafted then), so it still grafts. Tried many small eats: each
  bonus adds half a second, a ten-bonus graft is 8 s. It never destroys anything by chance: a limb
  that dies grafting died to the hive while you chose to operate. The naive bot, which cannibalizes
  every fourth build whenever it happens, did 1-22 surgeries a run and stayed inside the guard.

## Burrowing (the interior can seal itself)

Built: `Sim.burrowSiteAt`, `digBurrow`, `sealedIn`, `legalDrafts`; hover/click in `src/main.ts`.
Proof: `gap-burrow-hover.jpg`, `gap-burrow-done.jpg`.

- **Newcomer.** Hovering the smoke next to your district lights the cells it would dig and says the
  price and what it does ("the district beyond can be drafted again, and the hive gets a new way
  in"). A walled-in body gets a banner saying exactly what to do. PASS.
- **Genre veteran.** Nordhold/Tower Dominion let you pick where the map grows; this adds the
  inverse — open a new front on purpose. It is power AND exposure (a new gate), true to the plate
  algebra. PASS.
- **Breaker.** Tried to burrow mid-siege (refused), through a limb (refused), into the board's
  own edge (nothing offered), with no meat (refused). Tried to farm gates for the entrance wager's
  meat bonus: burrowing does not change the insertion profile (the bonus is fixed at deploy), so
  more gates are only more danger. The scripted player never burrows; its runs are unchanged.

## Lance strips carry their verbs

Proof: `gap-lance-burning.jpg`. A lance that ate two ember sacs (and two bursters to widen it) laid
across the street: the column walking over the strip catches fire and the fire spreads between
them. Before, those four eaten bonuses did nothing at all (a payload-rule violation). Breaker: it
cannot hit fliers or burrowed tunnelers (ground medium, like the swamp); it pulses on the lance's
tempo, so a spitter pip speeds it.
