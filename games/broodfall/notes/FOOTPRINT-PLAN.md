# Broodfall footprint plan (revised Oct 2 2026): proposed, not applied

Collins (Oct 1 2026): "the total lack of diversity in footprint ... is kind of a KEY part of tower defence strategy. In tower defence the tower categories are one square (hugely over-represented), two squares (line), four squares (large square, usually for very powerful towers), T-shaped (usually for very powerful area-effect things), L-shaped (like an elbow shape) ... we may need more visuals for towers that, to work, need to look different ... so a reach lasher will likely need sub-variants because it needs that reach to work." And: "look at the problems you identified in the doc for the existing ones and make sure you pre-address this in the redesign."

The engine for every shape is built and on main (`src/sim/footprint.ts`; HANDOFF.md "Footprints"). This file says which limb takes which shape; nothing in it is applied. Try any of it in game first: `?tryShape=bombard:2x2` (any limb, any of `1x1 1x2 2x2 line3 T L3 L4 S4`). The same plan is on the limb decision sheet (https://claude.ai/artifact/G1XVCeZcLdEPx1QfQ2ny7g), section "Footprint plan", with a Footprint column. Made by `node tools/codex/sheet.mjs` from `tools/codex/plan.mjs`.

Revised Oct 2 after Collins: "simple towers and ones that absolutely must be by the corridor are typically 1 single square, so like the Lasher does not need to change ... also the Maw is already a 2x2, keep that in mind." The first draft (Oct 1, 14 changes) is superseded; the sanity pass below changed three more.

## The rules this plan follows

1. **One square.** Simple and basic limbs, and every limb that must sit right at the corridor to work: melee and short reach, anything whose job is to touch the street edge.
2. **Line.** Limbs that fire or act along an axis (long range down a street), or wall something.
3. **2x2.** The very powerful ones. The Maw is already 2x2.
4. **T.** The very powerful AREA-EFFECT limbs only.
5. **L (elbow).** Only where a bend genuinely does the job better and the limb does not need to hug the corridor with every cell. If nothing fits, fewer Ls rather than forced ones.

## Sanity pass (Collins, Oct 2: "also think through if they are sane")

- **Spore Bombard: T → 2x2**: One gun that lobs at a marker anywhere: a T's stem would point nowhere, and nobody would guess a T from a mortar. A squat 2x2 mortar is what it is. Measured: as a T it lost a win in ten (4/10); as a 2x2 it holds.
- **Caustic Mister: 2x2 → one square**: The cheapest limb (12 war) and one of the weakest; one nozzle sprays the mist, so three of its four cells did nothing. Cheap early limbs stay small.
- **Ward Membrane: 2x2 → one square**: A cheap support (16 war) whose shield reaches out by radius from one point; the extra cells shielded nothing.
- **Kept after the checks**: Maw (a huge mouth, very strong), Snare Bed (a wide bed, strong control), Broodmother Den (a nest that bears a unit), Galvanic Frond (a big tesla frond; watch its kills), Trap Cage (given). Lines: Spine Wall (walls a street, across it), Impaler (a long rail, the priciest limb), Skipping Mortar and Creep Lance (they act along the line they lie on). Everything else one square: simple, cheap, or must touch the street.
- **Evolutions that change reach**: No shape changes mid-run. Lasher Long Whips, Quill Long Fan, Ember Long Flame, Spitter Long Throat, Impaler Railspine, Sling Long Arm, Blight Vent Airborne Spores and Snare Bed Grasping get variant art instead (see "Visual variants").

## Distribution

| Footprint | Now | Proposed |
|---|---|---|
| One cell | 27 | 28 |
| Line | 4 | 4 |
| Square | 7 | 6 |
| T | 0 | 0 |
| L (elbow) | 0 | 0 |

One cell goes from 27 of 38 to 28: by rule 1 it stays the most common. No limb is a T or an L. No limb's body or job is shaped like one: the strongest area limb (the Bombard) is one gun firing at a marker, so a T's stem would point nowhere; every L candidate either hugs the corridor (Lasher, Quill Fan) or would not work better bent (Conduit, Snare Bed). The engine supports both for a limb designed around one.

## Every limb

| Limb | Now | Proposed | Rule | Why | New look |
|---|---|---|---|---|---|
| Spitter | 1 cell | kept | 1 | The basic ranged limb: cheap, many of them by the street. | Keeps the mouth on a stalk (it is the archetype; the Lobber changes instead). |
| Burster | 1 cell | kept | 1 | Short reach (85): it bursts on the street beside it. Its splash is modest for its price, so it is not a "very powerful" area limb (rule 4). | Keeps the polyp cluster; a new firing clip that launches one pod. |
| Lasher | 1 cell | kept | 1 | Melee (reach 55): it must stand right at the corridor. Unchanged. |  |
| Maw | 2x2 square | kept | 3 | Very powerful: it swallows the weak whole. Already 2x2 (Collins: "the Maw is already a 2x2"). |  |
| Spine Wall | line of 2 | kept | 2 | It walls a street: a line, and since Oct 1 always ACROSS the street (one cell on a one-wide street). |  |
| Lure Gland | 1 cell | kept | 1 | Cheap bait that pulses its cloud onto the street beside it: corridor-side. | A pitcher bloom leaking a visible pink-green haze, not a ball on a stalk. |
| Snare Bed | 2x2 square | kept | 3 | A BED: the picture is a wide dome of web, and its mucus slows a whole junction. Strong control (6.3 kills per bed built, the most of any slow), so its four cells are paid in hp and a wider bed. Kept 2x2. | A wide flat web bed (the Netcaster stays a one-cell launcher). |
| Blight Vent | 1 cell | kept | 1 | A cheap poison vent by the street; many of them. | A tall cracked fumarole chimney streaming green spore smoke upward; no ring of yellow bulbs, no acid glands (so the VENOM look adds something). |
| Impaler | line of 2 | kept | 2 | A long harpoon rail shooting far (165): a line, as it is. The most expensive limb (36 war) and one of the strongest, so its second cell is paid in reach and hp. It shares "artillery" with the Mortar but not the verb: it pierces one target in any direction; the Mortar skips shells down the lane it lies along. | A long harpoon rail lying the length of both cells, drawn at the size of its ground. |
| Choir Node | 1 cell | kept | 1 | A support organ among the limbs it speeds; not a powerful area limb. One cell. |  |
| Spore Sling | 1 cell | kept | 1 | A thrower aimed where the player wants: no axis, so one square. |  |
| Broodmother Den | 2x2 square | kept | 3 | The Broodmother Den: a big protected nest that bears a Broodmother unit. Very powerful; 2x2 as it is. |  |
| Brood Pit | 1 cell | kept | 1 | The Brood Pit: a cheap spawner by the street. |  |
| Digestive Swamp | 1 cell | kept | 1 | A pit IN the street: one square plugs it. |  |
| Galvanic Frond | 2x2 square | kept | 3 | A big tesla frond whose storm arcs chain through crowds: 2x2 as it is, its cells paid in hp and reach. Watch it: only 2.9 kills per built in the scripted runs, low for a big shape. |  |
| Bile Lobber | 1 cell | kept | 1 | A cheap quick glob, with a NEW verb: it leaves an acid puddle in the street (a short ground zone). The Bombard becomes the one big siege gun. | A bile sac on a sling arm (nothing like the Spitter's mouth on a stalk). |
| Caustic Mister | 2x2 square | **1 cell** | 1 | SANITY PASS: back to one square. The cheapest limb (12 war) and one of the weakest (0.6 kills per built): a cheap support sprayer from one nozzle, so four cells bought nothing it needs. Its stats go back to those before Sep 29. | A single spray nozzle on a squat tank; no yellow gland on top. |
| Ocular Stalk | 1 cell | kept | 1 | A sniper eye that sees the whole board from where it stands: no axis, so one square. | A TALL eyestalk with a bony lens hood, the eye staring out (the Lure becomes a squat pitcher bloom). |
| Arc Prism | 1 cell | kept | 1 | A relay piece: many of them, linked. One cell. |  |
| Spore Bombard | 1 cell | **2x2 square** | 3 | SANITY PASS: a 2x2, not a T. The strongest artillery (15 kills per built), so it earns a big shape; but it is one gun that lobs at a marker anywhere, so a T's stem would point nowhere. A squat siege mortar fills a square. Measured: as a T it lost a win in ten; as a 2x2 it holds (5 of 10). RISK: On Sep 29 2026 a big Bombard cost the scripted player a win in ten whatever it was paid. Measured Oct 1 as a 2x2: holds (5 of 10). | A heavy squat siege mortar with a wide bone barrel, readable as artillery from every side. |
| Ward Membrane | 2x2 square | **1 cell** | 1 | SANITY PASS: back to one square. A cheap support (16 war) whose shield reaches out from one point by radius: its other three cells shielded nothing. Its stats go back to those before Sep 29. |  |
| Quill Fan | 1 cell | kept | 1 | A short fan (reach 72): it must stand at the corridor. One cell. |  |
| Skipping Mortar | line of 2 | kept | 2 | A mortar that skips shells down the lane it faces: a line along its aim, as it is. | A long barrel along both cells: its facing reads. |
| Netcaster | 1 cell | kept | 1 | Cheap anti-air. One cell. | A launcher with a folded net (the Snare Bed is a wide flat web). |
| Ember Sac | 1 cell | kept | 1 | A flamethrower with a short cone (reach 70): it must stand at the corridor. One cell. | A LOW horizontal nozzle on a black fuel sac, a pilot flame at the tip: fire is in the picture, and it lies low where the Blight Vent stands tall. |
| Marrow Conduit | 1 cell | kept | 1 | An engine piece: one cell. (A bend would not make it do its job better: rule 5.) | A bent marrow pipe on one cell (no orange slits). |
| Resonance Amplifier | 1 cell | kept | 1 | An engine piece. One cell. |  |
| Mosaic Node | 1 cell | kept | 1 | An engine piece. One cell. |  |
| Twinning Gland | 1 cell | kept | 1 | An engine piece. One cell. |  |
| Marrow Tap | 1 cell | kept | 1 | An engine piece. One cell. |  |
| Mitosis Node | 1 cell | kept | 1 | An engine piece. One cell. |  |
| Capacitor Sac | 1 cell | kept | 1 | An engine piece. One cell. |  |
| Boomerang Node | 1 cell | kept | 1 | An engine piece. One cell. |  |
| Meat Press | 1 cell | kept | 1 | An engine piece. One cell. | A screw press on a short bed (no orange slits). |
| Reliquary | 1 cell | kept | 1 | An engine piece. One cell, a new silhouette and a view from behind. | A sealed bone casket (an amber jar of marrow), no orange slits and no religious symbol. |
| Creep Lance | line of 2 | kept | 2 | It lays a strip of creep straight ahead: a line along that strip, as it is. | A hose body along both cells with the nozzle at its front. |
| Trap Cage | 2x2 square | kept | 3 | The Trap Cage: given, not drawn from the deck; it catches royals. 2x2 as it is. |  |
| Seedling | 1 cell | kept | 1 | Given, not drawn. A small Spitter. |  |

A reshaped limb is paid for its ground the way the BIG limbs were on Sep 29 (same price; hp x1.6 / x2.0 / x2.4 on 2 / 3 / 4 cells, hits x1.25 / x1.38 / x1.5, reach x1.1 / x1.12 / x1.15, blast x1.1 / x1.18 / x1.25; a limb already big is paid the difference; the Mister and the Ward going back to one square get their stats from before Sep 29).

## How each shape fits the city

Share of roof cells where pointing can build the shape (`tools/measure/shapefit.measure.ts`, `notes/limb-codex/shapefit.json`):

| Shape | Crash sites (4) | Mid-run boards (10) |
|---|---|---|
| 1 cell | 100% | 100% |
| line of 2 | 87% | 88% |
| line of 3 | 82% | 85% |
| 2x2 square | 62% | 66% |
| T of 4 | 84% | 85% |
| elbow of 3 | 86% | 87% |
| L of 4 | 84% | 86% |
| zigzag of 4 | 72% | 74% |

The 2x2 is the hardest to fit (kept for the strongest limbs); T and L fit about as well as a line of three; the zigzag fits badly and is not used.

## Measured balance

`MEASURE=c0,plan3 npx vitest run --config tools/measure/vitest.config.ts tools/measure/footprints.measure.ts`: the scripted player over ten seeds (at least 3 must be won) and the placement guardrail over eight.

- TODAY (no limb reshaped; walls across streets since Oct 1): HOLDS · naive 5/10 · guardrail 4:0 (83866 to 46000)
- REVISED PLAN (Bombard 2x2, Caustic Mister and Ward Membrane one square at their pre-Sep-29 stats): HOLDS · naive 5/10 · guardrail 4:0 (81184 to 46000)
- The Bombard on a T instead (before the sanity pass): HOLDS but weaker · naive 4/10 · guardrail 3:0 (77132 to 46000)
- The Oct 1 first draft (14 changes, superseded): 10/10 at full pay, 6/10 with the elbows and T paid as two cells

## Visual variants (Collins: "a reach lasher will likely need sub-variants")

A variant needs its own drawing when the reach or shape is in the BODY. Where a look is always reached WITH the variant, that look is simply drawn as the variant (no extra drawing).

| Limb | Evolution | What changes | Drawing | Extra |
|---|---|---|---|---|
| Spitter | Long Throat (3B) | double range: a long sniper neck | shared: REACH drawn as the variant | $0 |
| Burster | Skyburst (3B) | blasts reach the air: pods tilted up | shared: BONE+REACH, REACH drawn as the variant | $0 |
| Lasher | Long Whips (1A) | 40% more reach: the whips ARE the reach, so long whips are drawn long (Collins: "a reach lasher ... needs that reach to work") | +3 own drawings | $4.35 |
| Snare Bed | Grasping (2B) | reaches the air: tendrils stand up out of the bed | +1 own drawings | $2.90 |
| Blight Vent | Airborne Spores (2A) | reaches the air: a taller stack | +2 own drawings | $5.80 |
| Impaler | Railspine (3A) | double range: a longer rail | shared: REACH drawn as the variant | $0 |
| Spore Sling | Long Arm (1A) | throws 50% farther: a longer arm | +1 own drawings | $1.45 |
| Quill Fan | Long Fan (1B) | 40% more range: longer quills | +3 own drawings | $4.35 |
| Ember Sac | Long Flame (1B) | 40% more range: a longer nozzle | +3 own drawings | $8.70 |

Shown by an overlay instead (the game draws the ring, lane, strip or blast): Burster (Wide / Dense Burst: the blast is drawn at its true size); Lure Gland (Wide Cloud: the cloud is drawn at its size); Snare Bed (Wide Bed: the mucus is drawn at its size); Choir Node (Wide Choir, Cathedral: the aura ring is drawn at its size); Spore Sling (Big Clots: the patch is drawn at its size); Digestive Swamp (Wide Bog: the swamp is drawn at its size); Galvanic Frond (Long Arc, Storm Frond: the arcs are drawn); Bile Lobber (Big Glob: the blast and puddle are drawn at their size); Caustic Mister (Dissolving Mist: the mist is drawn at its size); Arc Prism (Wide Lens, Grid Prism: the range ring and the beams are drawn); Spore Bombard (Bigger Shell: the blast is drawn at its size); Ward Membrane (Wide Membrane: the cover is drawn at its size); Netcaster (Flak Burst: the burst is drawn at its size); Marrow Conduit (Long Lane, Great Conduit: the lane and the gather ring are drawn); Resonance Amplifier (Long Reach: the lane is drawn); Mosaic Node (Long Lane, Grand Mosaic: the lane is drawn); Twinning Gland (Long Reach: the lane is drawn); Marrow Tap (Long Tap: the lane is drawn); Boomerang Node (Far Call, Orbit: the lane is drawn); Meat Press (Long Press: the lane is drawn); Reliquary (Long Vigil: the lane is drawn); Creep Lance (Long / Great Runner, Broad Runner, Delta: the strip itself shows its length and width).

## What the art costs (one pass, with the upgrade looks)

- Bases redrawn with a view from behind: 16, $46
- Views from behind for engines that point: 5, $7
- Upgrade looks, only the reachable ones, at the new footprints: 97 drawings, $225 (of which spatial variants needing their own drawing: 13, $28)
- **Total ~$278, ~$330 with re-rolls** (UPGRADE-LOOKS.md rollout A was ~$350-400 on the old footprints).

## Flags → fixes (the old sheet's problems, pre-addressed)

- **Look-alikes: Blight Vent and Ember Sac**: Both stay one cell, so the silhouettes separate them: the Vent a tall vertical chimney streaming spores, the Ember Sac a low horizontal nozzle on a black fuel sac with a pilot flame. Neither carries acid glands, so VENOM adds them.
- **Look-alikes: Spitter and Bile Lobber**: Spitter keeps the mouth on a stalk. Lobber: a bile sac on a sling arm, with a new puddle verb.
- **Look-alikes: Lure Gland and Ocular Stalk**: Both stay one cell: the Lure a squat pitcher bloom leaking haze, the Ocular a tall eyestalk under a bony lens hood.
- **Look-alikes: Meat Press, Reliquary, Marrow Conduit**: All stay one cell: a screw press on a bed, a sealed casket, a bent pipe. No orange slits on any.
- **Two-cell limbs drawn tiny (Impaler, Mortar, Lance)**: Redrawn to fill their two cells, with a view from behind.
- **Directional limbs with no back view**: Every redrawn limb gets a view from behind in the same pass, and Mosaic, Twinning, Mitosis, Capacitor and Boomerang get one added.
- **Lobber vs Bombard: one aimed-artillery verb too many**: Split by footprint and effect: the Lobber a cheap one-cell glob that leaves an acid puddle; the Bombard the one 2x2 siege gun, a huge slow shell on its marker.
- **Looks no evolution path reaches (the prototypes)**: Draw only the reachable looks, with the spatial variants, in one pass. The Lasher keeps one cell, so its prototypes stay; the Spitter's, Lasher's and Frond's unreachable looks stay as eaten-bonus looks.
- **Odd bonus classes (Press, Tap, Reliquary, Choir)**: Choir teaches SWARM (+8% fire rate, its own job); Press teaches VENOM (renders kills down); Tap teaches SWARM (copies); Reliquary keeps BONE (it holds).
- **Kills by poison, fire, clouds and swallows went uncredited**: FIXED in code (Oct 1, stats only): Maw 0 → 154 kills, Blight Vent 21 → 88, Lure 0 → 9. The numbers on this sheet are re-measured with it.

## For Collins to decide

1. The three footprint changes: the Spore Bombard onto a 2x2; the Caustic Mister and the Ward Membrane back to one square (with the stats they had before Sep 29).
2. The Lobber/Bombard split: the Lobber a cheap glob that leaves an acid puddle (a new verb), the Bombard the 2x2 siege gun.
3. The bonus classes: Choir → SWARM (and its donor bonus +8% fire rate), Press → VENOM, Tap → SWARM, Reliquary stays BONE.
4. No T and no L: none of today's limbs is shaped like one. If you want them in the game, they should be NEW limbs designed around the shape (a T-shaped spore pump that floods a crossing, an L-shaped thorn hedge that walls a corner), not reshaped old ones.
