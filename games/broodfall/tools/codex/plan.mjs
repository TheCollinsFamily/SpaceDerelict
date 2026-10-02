/**
 * THE FOOTPRINT PLAN (revised Oct 2 2026), for Collins to decide; nothing here is applied to the game.
 * His words (Oct 1): "the total lack of diversity in footprint ... is kind of a KEY part of tower defence strategy.
 * In tower defence the tower categories are one square (hugely over-represented), two squares (line), four
 * squares (large square, usually for very powerful towers), T-shaped (usually for very powerful area-effect
 * things), L-shaped (like an elbow shape) ... we may need more visuals for towers that, to work, need to look
 * different ... so a reach lasher will likely need sub-variants because it needs that reach to work." And:
 * "look at the problems you identified in the doc for the existing ones and make sure you pre-address this in
 * the redesign." His correction (Oct 1, evening): "simple towers and ones that absolutely must be by the corridor
 * are typically 1 single square, so like the Lasher does not need to change ... also the Maw is already a 2x2,
 * keep that in mind." RULES below are those rules; every limb's `rule` says which one places it.
 *
 * Read by tools/codex/sheet.mjs (the Footprint column, the plan section, "Resolved by" on every old flag) and
 * written out as notes/FOOTPRINT-PLAN.md by the same script. The engine for every shape is built
 * (src/sim/footprint.ts); `?tryShape=bombard:2x2` plays any of it before it is decided. Balance:
 * tools/measure/footprints.measure.ts candidate plan2.
 *
 * to: '1x1' | '1x2' | 'line3' | '2x2' | 'T' | 'L3' | 'L4'.  rule: 1-5 (RULES).  redraw: the base picture is drawn
 * again (with a view from behind) in the same pass as its upgrade looks.  back: a view from behind is added.
 * variants: evolutions that change what it does in SPACE and so need their own drawing ([stage, choice, name, what
 * changes]).  overlays: spatial evolutions the game shows with a drawn ring, strip or lane instead.  resolves: flag
 * text (a substring of the old flag) → how this plan answers it.  open: a question for Collins about this limb.
 */
export const RULES = [
  ['One square', 'Cheap and simple limbs, and the ones that must stand right at the corridor (melee, short reach).'],
  ['Line (2 or 3)', 'Limbs that act along their own axis (pierce, jet, lay creep down a street, buff what touches their length) or wall a street.'],
  ['2x2', 'The very powerful ones (the Maw, the Den, the Bombard).'],
  ['T', 'Area effects that spread from a junction out to three sides.'],
  ['Elbow / L', 'Limbs that sit on a roof corner at a crossing and work along two streets at once.'],
];

/** The principle (Collins, Oct 2: "We need some line of 3, T of 4, elbow of 3, L of 4 ... this should be blindly obvious, it's class zero of tower defence"). */
export const PRINCIPLE = 'The footprint is a GAMEPLAY lever: a placement puzzle of what fits on which roof and what touches what. The art is redrawn to fit the shape (in the upgrade-look pass, which redraws these limbs anyway); a shape is never judged by today\'s picture.';

export const PLAN = {
  spitter: {
    to: '1x1', rule: 1, why: 'The basic ranged limb: cheap, many of them by the street.',
    silhouette: 'Keeps the mouth on a stalk (it is the archetype; the Lobber changes instead).',
    variants: [[3, 'B', 'Long Throat', 'double range: a long sniper neck']],
    resolves: { 'Spitter, Seedling and Bile Lobber': 'The Lobber is redrawn as a bile sac on a sling arm; the Spitter keeps the mouth on a stalk.' },
  },
  burster: {
    to: '1x1', rule: 1, redraw: true, why: 'Short reach (85): it bursts on the street beside it. Its splash is modest for its price, so it is not a "very powerful" area limb (rule 4).',
    silhouette: 'Keeps the polyp cluster; a new firing clip that launches one pod.',
    variants: [[3, 'B', 'Skyburst', 'blasts reach the air: pods tilted up']],
    overlays: ['Wide / Dense Burst: the blast is drawn at its true size'],
    resolves: { 'collapses to a stump': 'The new firing clip launches one pod; the body stays standing.' },
  },
  lasher: {
    to: '1x1', rule: 1, why: 'Melee (reach 55): it must stand right at the corridor. Unchanged.',
    variants: [[1, 'A', 'Long Whips', '40% more reach: the whips ARE the reach, so long whips are drawn long (Collins: "a reach lasher ... needs that reach to work")']],
    resolves: { 'Drawn looks no evolution path reaches': 'Its one-cell prototypes stay valid (it keeps one cell); BONE and SWARM are drawn, and VENOM, REACH and Plague Bastion stay as eaten-bonus looks. Add Long Whips variants of BONE and SWARM.' },
  },
  maw: {
    to: '2x2', rule: 3, why: 'Very powerful: it swallows the weak whole. Already 2x2 (Collins: "the Maw is already a 2x2").',
    resolves: {
      'credited with 0 kills': 'Fixed in code (Oct 1): a swallow is credited to the Maw in the run stats. Measured: 154 kills, 3.3 per Maw built.',
      'Its eaten whole kills were not credited': 'Fixed in code (Oct 1): swallows are credited (stats only, no play changed).',
    },
  },
  spine: { to: '1x2', rule: 2, why: 'It walls a street: a line, and since Oct 1 always ACROSS the street (one cell on a one-wide street).' },
  lure: {
    to: '1x1', rule: 1, redraw: true, why: 'Cheap bait that pulses its cloud onto the street beside it: corridor-side.',
    silhouette: 'A pitcher bloom leaking a visible pink-green haze, not a ball on a stalk.',
    overlays: ['Wide Cloud: the cloud is drawn at its size'],
    resolves: {
      'A ball on a long stalk, like the Ocular Stalk': 'Redrawn as a squat pitcher bloom with its haze; the Ocular becomes a tall hooded eyestalk.',
      'cloud kills were not credited': 'Fixed in code (Oct 1): cloud kills are credited (9 in the runs: it is bait, not a killer).',
    },
  },
  tangler: {
    change: 'A web along both street edges of a corner, where columns slow to turn.',
    to: 'L4', rule: 5, redraw: true, why: 'A web laid along both street edges of a corner, where columns slow to turn: the same four cells as today, bent round the corner.',
    silhouette: 'A long web bed bent round a roof corner, strands hanging over both street edges (the Netcaster stays a one-cell launcher).',
    variants: [[2, 'B', 'Grasping', 'reaches the air: tendrils stand up out of the bed']],
    overlays: ['Wide Bed: the mucus is drawn at its size'],

    resolves: {
      'pale pole sticking out': 'New firing clip in the redraw.',
      'Snare Bed and Netcaster are both webs': 'The bed is an L of web round a corner; the Netcaster a one-cell launcher with a folded net.',
    },
  },
  blighter: {
    change: 'A stack whose spore cloud spreads from the junction out to three sides.',
    to: 'T', rule: 4, redraw: true, why: 'A spore stack whose cloud spreads from the junction out to three sides: turn the stem toward the street the column comes down.',
    silhouette: 'A tall fumarole chimney at the junction with three cracked vent pipes along the bar and stem, green spore smoke streaming out; no acid glands (so VENOM adds them).',
    variants: [[2, 'A', 'Airborne Spores', 'reaches the air: a taller stack']],
    resolves: {
      'Same silhouette as the Ember Sac': 'Different shapes now: the Vent a T (a chimney with three vent pipes), the Ember Sac a line of three (a long flame jet).',
      'this limb already has them': 'Its base is drawn without acid glands, so the VENOM look reads as a change.',
      'poison kills were not credited': 'Fixed in code (Oct 1): poison kills are credited. Measured: 88 kills, 3.7 per Vent built.',
    },
  },
  impaler: {
    change: 'Pierces along its axis: a longer rail, so where it lies decides what it skewers.',
    to: 'line3', rule: 2, why: 'A harpoon that pierces along its axis: a three-cell rail laid down a street skewers the column end to end. The most expensive limb; its ground is part of its price.',
    redraw: true, silhouette: 'A long harpoon rail the length of all three cells, the barb at the front.',
    variants: [[3, 'A', 'Railspine', 'double range: a longer rail']],
    resolves: { 'Reads tiny': 'Redrawn as a three-cell rail filling its ground.' },
  },
  choir: {
    change: 'Its fire-rate aura reaches out on three sides from the junction.',
    to: 'T', rule: 4, redraw: true, why: 'Its fire-rate aura reaches out on three sides from the junction: which three neighbours it serves is decided by how it is turned.',
    silhouette: 'Organ pipes on a T manifold: three pipe banks along the bar and stem, the bellows at the junction.',
    overlays: ['Wide Choir, Cathedral: the aura ring is drawn at its size'],
    resolves: { 'tempo aura (+15% rate) but teaches REACH': 'It teaches SWARM, and its donor bonus becomes +8% fire rate (its own job), not +8% reach.' },
  },
  sling: {
    to: '1x1', rule: 1, why: 'A thrower aimed where the player wants: no axis, so one square.',
    variants: [[1, 'A', 'Long Arm', 'throws 50% farther: a longer arm']],
    overlays: ['Big Clots: the patch is drawn at its size'],
  },
  brood: { to: '2x2', rule: 3, why: 'The Broodmother Den: a big protected nest that bears a Broodmother unit. Very powerful; 2x2 as it is.', resolves: { 'The card said': 'Done Oct 1: the card reads the spec (5).' } },
  hatch: { to: '1x1', rule: 1, why: 'The Brood Pit: a cheap spawner by the street.' },
  swamp: {
    to: '1x1', rule: 1, why: 'A pit IN the street: one square plugs it.',
    overlays: ['Wide Bog: the swamp is drawn at its size'],
    resolves: {
      'flat pit in the street': 'Draw only its two reachable looks (VENOM, VENOM+REACH).',
      'digestion': 'Fixed in code (Oct 1): its burn kills are credited too.',
    },
  },
  frond: {
    change: 'Chain lightning arcs out from the junction to three sides.',
    to: 'T', rule: 4, redraw: true, why: 'Chain lightning arcs out from the junction to three sides: the same four cells as today, laid as a T so its turn decides which streets it reaches.',
    silhouette: 'Three galvanic fronds on a T of roots, the coil at the junction.',
    overlays: ['Long Arc, Storm Frond: the arcs are drawn'],
    resolves: { 'Drawn looks no evolution path reaches': 'Keep the drawn BONE, VENOM and Storm Crown for eaten bonuses only; draw nothing more until reach and swarm are checked.' },
  },
  lobber: {
    to: '1x1', rule: 1, redraw: true, why: 'A cheap quick glob, with a NEW verb: it leaves an acid puddle in the street (a short ground zone). The Bombard becomes the one big siege gun.',
    silhouette: 'A bile sac on a sling arm (nothing like the Spitter\'s mouth on a stalk).',
    overlays: ['Big Glob: the blast and puddle are drawn at their size'],
    resolves: {
      'Reads as another Spitter': 'Redrawn as a bile sac on a sling arm.',
      'Overlaps the Spore Bombard': 'Split by footprint and effect: the Lobber a one-cell quick glob that leaves a puddle; the Bombard a 2x2 siege gun, one huge slow shell on its marker.',
    },
  },
  mister: {
    change: 'The cheapest, weakest limb; one nozzle does the work, so the other cells did nothing.', to: '1x1', rule: 1, redraw: true, why: 'SANITY PASS: back to one square. The cheapest limb (12 war) and one of the weakest (0.6 kills per built): a cheap support sprayer from one nozzle, so four cells bought nothing it needs. Its stats go back to those before Sep 29.',
    silhouette: 'A single spray nozzle on a squat tank; no yellow gland on top.',
    overlays: ['Dissolving Mist: the mist is drawn at its size'],
    resolves: { 'A yellow gland on top already': 'The base is drawn without the gland, so VENOM adds it.' },
  },
  ocular: {
    to: '1x1', rule: 1, redraw: true, why: 'A sniper eye that sees the whole board from where it stands: no axis, so one square.',
    silhouette: 'A TALL eyestalk with a bony lens hood, the eye staring out (the Lure becomes a squat pitcher bloom).',
    resolves: { 'A ball on a long stalk, like the Lure Gland': 'Both stay one cell: the Ocular a tall hooded eyestalk, the Lure a squat pitcher bloom leaking haze.' },
  },
  prism: { to: '1x1', rule: 1, why: 'A relay piece: many of them, linked. One cell.', overlays: ['Wide Lens, Grid Prism: the range ring and the beams are drawn'] },
  bombard: {
    change: 'The strongest artillery earns a big shape; a squat mortar fills a square (a T’s stem would point nowhere).', to: '2x2', rule: 3, redraw: true, why: 'SANITY PASS: a 2x2, not a T. The strongest artillery (15 kills per built), so it earns a big shape; but it is one gun that lobs at a marker anywhere, so a T\'s stem would point nowhere. A squat siege mortar fills a square. Measured: as a T it lost a win in ten; as a 2x2 it holds (5 of 10).',
    silhouette: 'A heavy squat siege mortar with a wide bone barrel, readable as artillery from every side.',
    overlays: ['Bigger Shell: the blast is drawn at its size'],
    resolves: {
      'A bone cone': 'Redrawn as a braced siege mortar with a view from behind.',
      'Overlaps the Bile Lobber': 'Split (see the Lobber): the Bombard is the big slow siege gun on a 2x2.',
    },
    risk: 'On Sep 29 2026 a big Bombard cost the scripted player a win in ten whatever it was paid. Measured Oct 1 as a 2x2: holds (5 of 10).',
  },
  ward: { change: 'A cheap support whose shield reaches out from one point; the other cells shielded nothing.', to: '1x1', rule: 1, why: 'SANITY PASS: back to one square. A cheap support (16 war) whose shield reaches out from one point by radius: its other three cells shielded nothing. Its stats go back to those before Sep 29.', overlays: ['Wide Membrane: the cover is drawn at its size'] },
  quill: {
    change: 'On a roof corner at a crossing both arms line two streets, and the fan covers both.',
    to: 'L3', rule: 5, redraw: true, why: 'Laid on a roof corner at a crossing, both arms line two streets and the fan covers both: it still touches the street with every cell.',
    silhouette: 'A bent body hugging the roof corner, quills fanned out along both arms.',
    variants: [[1, 'B', 'Long Fan', '40% more range: longer quills']],
  },
  skipper: {
    to: '1x2', rule: 2, redraw: true, why: 'A mortar that skips shells down the lane it faces: a line along its aim, as it is.',
    silhouette: 'A long barrel along both cells: its facing reads.',
    resolves: { 'Reads tiny, like the Impaler': 'Redrawn to fill its two cells, barrel along its aim, with a view from behind.' },
  },
  net: {
    to: '1x1', rule: 1, redraw: true, why: 'Cheap anti-air. One cell.',
    silhouette: 'A launcher with a folded net (the Snare Bed is a wide flat web).',
    overlays: ['Flak Burst: the burst is drawn at its size'],
  },
  ember: {
    change: 'A flame jet along its long axis: lay it beside a street and it torches the length of it.',
    to: 'line3', rule: 2, redraw: true, why: 'A flame jet along its long axis: laid along a street edge it torches the length of the street. Where it lies is the decision.',
    silhouette: 'A long low fuel sac on three cells with the nozzle at the front and a pilot flame: the fire runs along its length.',
    variants: [[1, 'B', 'Long Flame', '40% more range: a longer nozzle']],
    resolves: {
      'Same silhouette as the Blight Vent': 'Different shapes now: the Ember Sac a line of three (a long jet), the Blight Vent a T (a stack and its cloud vents).',
      'its own look already IS the VENOM look': 'Drawn as fire (orange, black fuel sac), not acid: VENOM adds glands.',
      'burn kills were not credited': 'Fixed in code (Oct 1): burn kills are credited.',
    },
  },
  conduit: {
    change: 'A bent pipe: it gathers at the elbow and feeds along one arm toward its target.',
    to: 'L3', rule: 5, redraw: true, why: 'A bent pipe: it gathers at the elbow and feeds along one arm. Fitting it round a corner to reach its target is the puzzle.',
    silhouette: 'A bent marrow pipe on three cells, the gather bulb at the elbow (no orange slits).',
    overlays: ['Long Lane, Great Conduit: the lane and the gather ring are drawn'],
    resolves: { 'Press, Reliquary and Marrow Conduit': 'Different shapes now: the Conduit an elbow of three (a bent pipe), the Press an L of four (a press with a feed arm), the Reliquary one square (a casket). No orange slits on any.' },
  },
  amp: {
    change: 'Buffs every limb touching its length: adjacency becomes the puzzle.',
    to: 'line3', rule: 2, redraw: true, why: 'A resonance horn that buffs every limb touching its length: which limbs line up along it is the puzzle. (A mechanic change: today it amplifies the one limb it points at.)',
    silhouette: 'A long resonant horn on three cells, ribbed along its length.',
    overlays: ['Long Reach: the lane is drawn'],
  },
  mosaic: { to: '1x1', rule: 1, why: 'An engine piece. One cell.', back: true, overlays: ['Long Lane, Grand Mosaic: the lane is drawn'] },
  twin: { to: '1x1', rule: 1, why: 'An engine piece. One cell.', back: true, overlays: ['Long Reach: the lane is drawn'] },
  tap: {
    to: '1x1', rule: 1, why: 'An engine piece. One cell.', overlays: ['Long Tap: the lane is drawn'],
    resolves: { 'A bonus farm counts as BONE': 'It teaches SWARM (copies: many).' },
  },
  mitosis: { to: '1x1', rule: 1, why: 'An engine piece. One cell.', back: true },
  capacitor: { to: '1x1', rule: 1, why: 'An engine piece. One cell.', back: true },
  boomerang: { to: '1x1', rule: 1, why: 'An engine piece. One cell.', back: true, overlays: ['Far Call, Orbit: the lane is drawn'] },
  press: {
    change: 'A press with a long feed arm: an economy engine that pays in ground.',
    to: 'L4', rule: 5, redraw: true, why: 'A press with a long feed arm: an economy engine that pays in ground, so turning kills into science costs a corner of the city.',
    silhouette: 'A screw press at the elbow with a three-cell feed trough as its arm (no orange slits).',
    overlays: ['Long Press: the lane is drawn'],
    resolves: {
      'Press, Reliquary and Marrow Conduit are all lumpy': 'Redrawn as a screw press with a feed arm on an L of four.',
      'teaches a BONE bonus': 'It teaches VENOM: it renders kills down (digestion), not armour.',
    },
  },
  reliquary: {
    to: '1x1', rule: 1, redraw: true, why: 'An engine piece. One cell, a new silhouette and a view from behind.',
    silhouette: 'A sealed bone casket (an amber jar of marrow), no orange slits and no religious symbol.',
    overlays: ['Long Vigil: the lane is drawn'],
    resolves: {
      'Reads like the Meat Press': 'A one-square casket vs the L-shaped press and the bent elbow pipe.',
      'Death insurance counts as BONE': 'Keep BONE: it holds what it guards (the flag itself called it defensible).',
    },
  },
  lance: {
    change: 'Lances creep down a street: a longer hose laid along its strip.',
    to: 'line3', rule: 2, redraw: true, why: 'It lances creep straight down a street: a three-cell hose laid along the strip it lays.',
    silhouette: 'A long hose body on three cells with the nozzle at its front.',
    overlays: ['Long / Great Runner, Broad Runner, Delta: the strip itself shows its length and width'],
    resolves: { 'Reads tiny; the nozzle looks like a horn': 'Redrawn as a three-cell hose; the strip leaves its nozzle.' },
  },
  cage: { to: '2x2', rule: 3, why: 'The Trap Cage: given, not drawn from the deck; it catches royals. 2x2 as it is.' },
  sprout: { to: '1x1', rule: 1, why: 'Given, not drawn. A small Spitter.' },
};

/** Shown with the distribution. */
export const NO_L = 'Every shape a tower defence uses is here: one square, lines of two and three, 2x2, T, elbow of three and L of four.';

/** How this plan was reached (Oct 2): the drafts it replaces, and the checks every shape passed. */
export const SANITY = [
  ['Why the 3-change draft was wrong', 'It judged shapes by TODAY\'S pictures (a mortar is not a T, a nozzle is one cell). In tower defence the footprint is a placement puzzle and the art is redrawn to fit it. Collins: "We need some line of 3, T of 4, elbow of 3, L of 4 ... it\'s class zero of tower defence."'],
  ['Every cell does something', 'Lines act along their length (pierce, jet, lay creep, buff what touches them); a T spreads from its junction to three sides (arcs, aura, cloud); an elbow or L works along two streets from a corner (fan, web, feed arm). Corridor huggers stay one square except the Quill Fan, whose elbow keeps every cell on the street edge.'],
  ['Power vs ground', 'The 2x2s are the strongest limbs (Maw, Den, Bombard, Cage). Shapes are paid for their ground as the BIG limbs were; the measure below sets how much.'],
  ['Earlier sanity notes, kept', 'The rest of this list is from the first sanity pass; the Bombard\'s 2x2 and the Mister and Ward going back to one square still stand.'],
  ['Spore Bombard: T → 2x2', 'One gun that lobs at a marker anywhere: a T\'s stem would point nowhere, and nobody would guess a T from a mortar. A squat 2x2 mortar is what it is. Measured: as a T it lost a win in ten (4/10); as a 2x2 it holds.'],
  ['Caustic Mister: 2x2 → one square', 'The cheapest limb (12 war) and one of the weakest; one nozzle sprays the mist, so three of its four cells did nothing. Cheap early limbs stay small.'],
  ['Ward Membrane: 2x2 → one square', 'A cheap support (16 war) whose shield reaches out by radius from one point; the extra cells shielded nothing.'],

  ['Evolutions that change reach', 'No shape changes mid-run. Lasher Long Whips, Quill Long Fan, Ember Long Flame, Spitter Long Throat, Impaler Railspine, Sling Long Arm, Blight Vent Airborne Spores and Snare Bed Grasping get variant art instead (see "Visual variants").'],
  ['Kept after the checks (updated)', 'One square: Spitter, Lasher, Netcaster, Lure Gland, Ocular Stalk, Brood Pit, Caustic Mister, Ward Membrane and the small engines (simple, cheap or corridor). Lines of two: Spine Wall (across the street) and Skipping Mortar. 2x2: Maw, Broodmother Den, Trap Cage, Spore Bombard.'],
];

/** The old sheet's "Decide first" list and the flags the sheet counts, each with how the plan answers it. */
export const FIXES = [
  ['Look-alikes: Blight Vent and Ember Sac', 'Different shapes: the Vent a T (a chimney with three vent pipes), the Ember Sac a line of three (a long flame jet). Neither carries acid glands, so VENOM adds them.'],
  ['Look-alikes: Spitter and Bile Lobber', 'Spitter keeps the mouth on a stalk. Lobber: a bile sac on a sling arm, with a new puddle verb.'],
  ['Look-alikes: Lure Gland and Ocular Stalk', 'Both stay one cell: the Lure a squat pitcher bloom leaking haze, the Ocular a tall eyestalk under a bony lens hood.'],
  ['Look-alikes: Meat Press, Reliquary, Marrow Conduit', 'Different shapes: the Press an L of four (a press with a feed arm), the Conduit an elbow of three (a bent pipe), the Reliquary one square (a casket). No orange slits on any.'],
  ['Two-cell limbs drawn tiny (Impaler, Mortar, Lance)', 'Redrawn to fill their ground (the Impaler and the Lance on three cells now, the Mortar on two), with a view from behind.'],
  ['Directional limbs with no back view', 'Every redrawn limb gets a view from behind in the same pass, and Mosaic, Twinning, Mitosis, Capacitor and Boomerang get one added.'],
  ['Lobber vs Bombard: one aimed-artillery verb too many', 'Split by footprint and effect: the Lobber a cheap one-cell glob that leaves an acid puddle; the Bombard the one 2x2 siege gun, a huge slow shell on its marker.'],
  ['Looks no evolution path reaches (the prototypes)', 'Draw only the reachable looks, with the spatial variants, in one pass. The Lasher keeps one cell, so its prototypes stay; the Spitter\'s, Lasher\'s and Frond\'s unreachable looks stay as eaten-bonus looks.'],
  ['Odd bonus classes (Press, Tap, Reliquary, Choir)', 'Choir teaches SWARM (+8% fire rate, its own job); Press teaches VENOM (renders kills down); Tap teaches SWARM (copies); Reliquary keeps BONE (it holds).'],
  ['Kills by poison, fire, clouds and swallows went uncredited', 'FIXED in code (Oct 1, stats only): Maw 0 → 154 kills, Blight Vent 21 → 88, Lure 0 → 9. The numbers on this sheet are re-measured with it.'],
];

/** For Collins to decide (shown at the end of the plan). */
export const QUESTIONS = [
  'The mapping: four lines of three, three Ts, two elbows of three, two Ls of four, the Bombard onto a 2x2, the Mister and the Ward back to one square (try any of it with ?tryShape=, e.g. ?tryShape=choir:T,quill:L3).',
  'The Resonance Amplifier as a line of three buffs every limb touching its length: a mechanic change from "amplifies the one limb it points at".',
  'The Lobber/Bombard split: the Lobber a cheap glob that leaves an acid puddle (a new verb), the Bombard the 2x2 siege gun.',
  'The bonus classes: Choir → SWARM (and its donor bonus +8% fire rate), Press → VENOM, Tap → SWARM, Reliquary stays BONE.',

];

/** The look-art price per drawing (notes/UPGRADE-LOOKS.md): one side $1.45 (a picture and two clips), with a view from behind $2.90. */
export const PRICE = { side: 1.45, both: 2.9 };
