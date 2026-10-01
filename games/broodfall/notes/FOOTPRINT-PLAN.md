# Broodfall footprint plan (Oct 1 2026): proposed, not applied

Collins (Oct 1 2026): "the total lack of diversity in footprint ... is kind of a KEY part of tower defence strategy. In tower defence the tower categories are one square (hugely over-represented), two squares (line), four squares (large square, usually for very powerful towers), T-shaped (usually for very powerful area-effect things), L-shaped (like an elbow shape) ... we may need more visuals for towers that, to work, need to look different ... so a reach lasher will likely need sub-variants because it needs that reach to work." And: "look at the problems you identified in the doc for the existing ones and make sure you pre-address this in the redesign."

The engine for every shape is built and on main (`src/sim/footprint.ts`; HANDOFF.md "Footprints"). This file says which limb takes which shape; nothing in it is applied. Try any of it in game first: `?tryShape=lasher:L3,quill:L3` (any limb, any of `1x1 1x2 2x2 line3 T L3 L4 S4`). The same plan is on the limb decision sheet (https://claude.ai/artifact/G1XVCeZcLdEPx1QfQ2ny7g), section "Footprint plan", with a Footprint column. Made by `node tools/codex/sheet.mjs` from `tools/codex/plan.mjs`.

## Distribution

| Footprint | Now | Proposed |
|---|---|---|
| One cell | 27 | 16 |
| Line | 4 | 9 |
| Square | 7 | 6 |
| T | 0 | 3 |
| L (elbow) | 0 | 4 |

One cell goes from 27 of 38 to 16 (under half).

## Every limb

| Limb | Now | Proposed | Why | New look |
|---|---|---|---|---|
| Spitter | 1 cell | kept | The cheap staple: the many-small-limbs layer every tower defence keeps. One cell stays its strength. | Keeps the mouth on a stalk (it is the archetype; the Lobber changes instead). |
| Burster | 1 cell | **T of 4** | Its whole job is area. A T is the "very powerful area-effect" shape: three polyp pods on a bar, launched from the junction. | Three polyp pods along a bar, a launcher stem: no single round body. |
| Lasher | 1 cell | **elbow of 3** | Melee sweep. On an elbow at a street corner it sweeps BOTH streets from the bend (Collins: "a lasher that sweeps two lanes"). | A root mass bent round a corner, the whips rising from the elbow. |
| Maw | 2x2 square | kept | The heavy eater stays a big square. |  |
| Spine Wall | line of 2 | kept | The street wall: a line across a lane. Unchanged. |  |
| Lure Gland | 1 cell | kept | Cheap bait, any roof by a street. | A pitcher bloom leaking a visible pink-green haze, not a ball on a stalk. |
| Snare Bed | 2x2 square | **L of 4** | A snare bed along a street that turns the corner holds a column where it slows to turn; an L covers more street edge than a square on the same four cells. | A long web bed bent at the corner (the Netcaster stays a launcher). |
| Blight Vent | 1 cell | kept | A cheap poison vent, many of them; one cell keeps it a spreading layer. | A cracked fumarole chimney streaming green spore smoke upward; no ring of yellow bulbs, no acid glands (so the VENOM look adds something). |
| Impaler | line of 2 | kept | A harpoon gun lies along its two cells. Unchanged footprint; its picture was the problem. | A long harpoon rail lying the length of both cells, drawn at the size of its ground. |
| Choir Node | 1 cell | **T of 4** | An aura over its neighbours is an area effect: three organ pipes on a bar, a bellows stem; the aura comes from the junction. | Three organ pipes on a bar and a bellows stem. |
| Spore Sling | 1 cell | **line of 2** | A catapult arm lies along two cells and throws the way it lies. | A sling arm the length of its two cells. |
| Broodmother Den | 2x2 square | kept | The Broodmother Den (Oct 1: it bears a Broodmother UNIT that broods or fights): a big, protected nest stays a big square; its unit spawns on the street beside any of its cells. |  |
| Brood Pit | 1 cell | kept | The Brood Pit (new Oct 1): a cheap spawner of three warriors. One cell keeps it cheap to place anywhere by a street. |  |
| Digestive Swamp | 1 cell | kept | A pit in the street; one cell keeps it a plug. |  |
| Galvanic Frond | 2x2 square | kept | A big tesla frond. Unchanged. |  |
| Bile Lobber | 1 cell | kept | Kept small and cheap, with a NEW verb: a quick aimed glob that leaves an acid puddle in the street (a short ground zone). The Bombard becomes the one big siege gun. | A bile sac on a sling arm (nothing like the Spitter's mouth on a stalk). |
| Caustic Mister | 2x2 square | **T of 4** | Its mist is a big area effect: three spray nozzles on a bar, mist from the junction. The same four cells as today, reshaped. | Three nozzles on a bar; no yellow gland on top. |
| Ocular Stalk | 1 cell | **line of 2** | A board-wide eye on a long neck lying along the roof, the eye at the front: it reads as a sight line. | A periscope neck lying along two cells, the eye at its tip. |
| Arc Prism | 1 cell | kept | A relay piece: many of them, linked. One cell. |  |
| Spore Bombard | 1 cell | **2x2 square** | Heavy siege artillery is the classic big-square tower: one huge shell on its marker, slow. RISK: On Sep 29 2026 a big Bombard cost the scripted player a win in ten whatever it was paid. Measured Oct 1: made 2x2 alone it holds (5 of 10, guardrail 5:0). | A squat mortar mound with a wide bone barrel, readable as artillery from every side. |
| Ward Membrane | 2x2 square | kept | A big membrane. Unchanged. |  |
| Quill Fan | 1 cell | **elbow of 3** | A fan of quills at an elbow covers both streets of a corner; the most damage of any limb, so it pays in ground. | A fan of quills on a bent body, the fan at the elbow. |
| Skipping Mortar | line of 2 | kept | A mortar lying along its aim. Unchanged footprint. | A long barrel along both cells: its facing reads. |
| Netcaster | 1 cell | kept | Cheap anti-air, one cell. | A launcher with a folded net (the Snare Bed becomes an L strip). |
| Ember Sac | 1 cell | **line of 2** | A flamethrower is a nozzle with a fuel sac behind it: two cells along its cone. (Its cone then fires along the way it lies, like the Mortar: a mechanic change to measure.) | A horizontal nozzle on a fuel sac, a pilot flame at the tip: fire is in the picture. |
| Marrow Conduit | 1 cell | **elbow of 3** | An elbow pipe: it gathers at the bend and feeds down one arm toward its target. | A bent marrow pipe (no orange slits). |
| Resonance Amplifier | 1 cell | **line of 2** | A horn lying along what it amplifies: its aim reads from the shape. | A resonant horn along two cells. |
| Mosaic Node | 1 cell | kept | An engine piece. One cell. |  |
| Twinning Gland | 1 cell | kept | An engine piece. One cell. |  |
| Marrow Tap | 1 cell | kept | An engine piece. One cell. |  |
| Mitosis Node | 1 cell | kept | An engine piece. One cell. |  |
| Capacitor Sac | 1 cell | kept | An engine piece. One cell. |  |
| Boomerang Node | 1 cell | kept | An engine piece. One cell. |  |
| Meat Press | 1 cell | **line of 2** | A press bed with rollers lies along its two cells: the economy engine reads as machinery, not as another lump. | A long press bed with a screw on top (no orange slits). |
| Reliquary | 1 cell | kept | An engine piece. One cell, a new silhouette and a view from behind. | A sealed bone casket (an amber jar of marrow), no orange slits and no religious symbol. |
| Creep Lance | line of 2 | **line of 3** | Its whole point is the strip of creep it lays straight ahead: a three-cell hose lying along that strip. | A long hose body with the nozzle at its front, along three cells. |
| Trap Cage | 2x2 square | kept | Given, not drawn from the deck. Unchanged. |  |
| Seedling | 1 cell | kept | Given, not drawn. A small Spitter. |  |

A reshaped limb is paid for its ground the way the BIG limbs were on Sep 29 (same price; hp x1.6 / x2.0 / x2.4 on 2 / 3 / 4 cells, hits x1.25 / x1.38 / x1.5, reach x1.1 / x1.12 / x1.15, blast x1.1 / x1.18 / x1.25; a limb already big is paid the difference). **Recommended (measured):** the three-cell elbows (Lasher, Quill, Conduit) and the Burster's and Choir's T are paid as if they took TWO cells: paid in full, the whole plan made the scripted player win 10 of 10; paid this way, 6 of 10 (today 5).

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

`MEASURE=plan npx vitest run --config tools/measure/vitest.config.ts tools/measure/footprints.measure.ts` (and planLines, planT, planL, planSquare): the scripted player over ten seeds (at least 3 must be won) and the placement guardrail over eight.

- TODAY (no limb reshaped): HOLDS · naive 5/10 · guardrail 5:0 (86981 to 45000) · big limbs built by the scripted player over ten runs: 259 · as the game is
- the new lines only: HOLDS · naive 5/10 · guardrail 5:0 (87697 to 45000) · big limbs built by the scripted player over ten runs: 302 · ember, ocular, sling, amp, press, lance
- the Bombard 2x2 only: HOLDS · naive 5/10 · guardrail 5:0 (86481 to 45000) · big limbs built by the scripted player over ten runs: 264 · bombard
- the three T limbs only (full pay): HOLDS · naive 7/10 · guardrail 6:0 (93056 to 47000) · big limbs built by the scripted player over ten runs: 375 · mister, choir, burster
- the four L limbs only (full pay): HOLDS · naive 8/10 · guardrail 7:0 (100403 to 51000) · big limbs built by the scripted player over ten runs: 509 · lasher, quill, conduit, tangler
- the four L limbs, the elbows paid as two cells: HOLDS · naive 7/10 · guardrail 6:0 (93908 to 47000) · big limbs built by the scripted player over ten runs: 434 · lasher, quill, conduit, tangler
- THE WHOLE PLAN, full pay (too easy): HOLDS · naive 10/10 · guardrail 8:0 (104333 to 52000) · big limbs built by the scripted player over ten runs: 760 · ember, ocular, sling, amp, press, lance, bombard, mister, choir, burster, lasher, quill, conduit, tangler
- THE WHOLE PLAN, RECOMMENDED pay (elbows and the Burster/Choir T paid as two cells): HOLDS · naive 6/10 · guardrail 5:0 (90501 to 48000) · big limbs built by the scripted player over ten runs: 568 · ember, ocular, sling, amp, press, lance, bombard, mister, choir, burster, lasher, quill, conduit, tangler

## Visual variants (Collins: "a reach lasher will likely need sub-variants")

A variant needs its own drawing when the reach or shape is in the BODY. Where a look is always reached WITH the variant, that look is simply drawn as the variant (no extra drawing).

| Limb | Evolution | What changes | Drawing | Extra |
|---|---|---|---|---|
| Spitter | Long Throat (3B) | double range: a long sniper neck | shared: REACH drawn as the variant | $0 |
| Burster | Skyburst (3B) | blasts reach the air: pods tilted up | shared: BONE+REACH, REACH drawn as the variant | $0 |
| Lasher | Long Whips (1A) | 40% more reach: the whips ARE the reach, so long whips are drawn long (Collins: "a reach lasher ... needs that reach to work") | +3 own drawings | $8.70 |
| Snare Bed | Grasping (2B) | reaches the air: tendrils stand up out of the bed | +1 own drawings | $2.90 |
| Blight Vent | Airborne Spores (2A) | reaches the air: a taller stack | +2 own drawings | $5.80 |
| Impaler | Railspine (3A) | double range: a longer rail | shared: REACH drawn as the variant | $0 |
| Spore Sling | Long Arm (1A) | throws 50% farther: a longer arm | +1 own drawings | $2.90 |
| Quill Fan | Long Fan (1B) | 40% more range: longer quills | +3 own drawings | $8.70 |
| Ember Sac | Long Flame (1B) | 40% more range: a longer nozzle | +3 own drawings | $8.70 |

Shown by an overlay instead (the game draws the ring, lane, strip or blast): Burster (Wide / Dense Burst: the blast is drawn at its true size); Lure Gland (Wide Cloud: the cloud is drawn at its size); Snare Bed (Wide Bed: the mucus is drawn at its size); Choir Node (Wide Choir, Cathedral: the aura ring is drawn at its size); Spore Sling (Big Clots: the patch is drawn at its size); Digestive Swamp (Wide Bog: the swamp is drawn at its size); Galvanic Frond (Long Arc, Storm Frond: the arcs are drawn); Bile Lobber (Big Glob: the blast and puddle are drawn at their size); Caustic Mister (Dissolving Mist: the mist is drawn at its size); Arc Prism (Wide Lens, Grid Prism: the range ring and the beams are drawn); Spore Bombard (Bigger Shell: the blast is drawn at its size); Ward Membrane (Wide Membrane: the cover is drawn at its size); Netcaster (Flak Burst: the burst is drawn at its size); Marrow Conduit (Long Lane, Great Conduit: the lane and the gather ring are drawn); Resonance Amplifier (Long Reach: the lane is drawn); Mosaic Node (Long Lane, Grand Mosaic: the lane is drawn); Twinning Gland (Long Reach: the lane is drawn); Marrow Tap (Long Tap: the lane is drawn); Boomerang Node (Far Call, Orbit: the lane is drawn); Meat Press (Long Press: the lane is drawn); Reliquary (Long Vigil: the lane is drawn); Creep Lance (Long / Great Runner, Broad Runner, Delta: the strip itself shows its length and width).

## What the art costs (one pass, with the upgrade looks)

- Bases redrawn with a view from behind: 21, $61
- Views from behind for engines that point: 5, $7
- Upgrade looks, only the reachable ones, at the new footprints: 99 drawings, $257 (of which spatial variants needing their own drawing: 13, $38)
- **Total ~$325, ~$390 with re-rolls** (UPGRADE-LOOKS.md rollout A was ~$350-400 on the old footprints).

## Flags → fixes (the old sheet's problems, pre-addressed)

- **Look-alikes: Blight Vent and Ember Sac**: Vent: a vertical fumarole chimney, one cell. Ember: a horizontal flamethrower nozzle on a fuel sac, two cells. Neither carries acid glands, so VENOM adds them.
- **Look-alikes: Spitter and Bile Lobber**: Spitter keeps the mouth on a stalk. Lobber: a bile sac on a sling arm, with a new puddle verb.
- **Look-alikes: Lure Gland and Ocular Stalk**: Lure: a pitcher bloom leaking its haze, one cell. Ocular: a periscope neck lying along two cells, the eye at the tip.
- **Look-alikes: Meat Press, Reliquary, Marrow Conduit**: Press: a long press bed (1x2). Conduit: a bent pipe (L). Reliquary: a sealed casket (1x1). No orange slits on any.
- **Two-cell limbs drawn tiny (Impaler, Mortar, Lance)**: Redrawn to fill their footprints (the Lance on three cells); new art is sized to its ground by the footprint, as the placeholder already is.
- **Directional limbs with no back view**: Every limb that faces a way or lies on a turned footprint gets a view from behind in the same pass: the 21 redrawn limbs plus Mosaic, Twinning, Mitosis, Capacitor and Boomerang.
- **Lobber vs Bombard: one aimed-artillery verb too many**: Split by footprint and effect shape: Lobber a cheap one-cell glob that leaves an acid puddle; Bombard a 2x2 siege gun, one huge slow shell on its marker.
- **Looks no evolution path reaches (the prototypes)**: Draw only the reachable looks, at the new footprint, with the spatial variants in the same pass. The Lasher's 1-cell prototypes are retired (it becomes an L); the Spitter's and Frond's unreachable looks stay as eaten-bonus looks.
- **Odd bonus classes (Press, Tap, Reliquary, Choir)**: Choir teaches SWARM (+8% fire rate, its own job); Press teaches VENOM (renders kills down); Tap teaches SWARM (copies); Reliquary keeps BONE (it holds).
- **Kills by poison, fire, clouds and swallows went uncredited**: FIXED in code (Oct 1, stats only): Maw 0 → 154 kills, Blight Vent 21 → 88, Lure 0 → 9. The numbers on this sheet are re-measured with it.

## For Collins to decide

1. The 14 footprint changes (try them with `?tryShape=`).
2. The Lobber/Bombard split (Lobber a cheap glob that leaves an acid puddle; Bombard the one 2x2 siege gun).
3. The Ember Sac on two cells fires its cone the way it lies (a mechanic change).
4. The bonus classes: Choir → SWARM (+8% fire rate as its donor bonus), Press → VENOM, Tap → SWARM, Reliquary stays BONE.
5. Retire the Lasher's one-cell prototypes and the unreachable prototype looks, or keep them for eaten bonuses.
