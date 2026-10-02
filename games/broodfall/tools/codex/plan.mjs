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
  ['One square', 'Simple and basic limbs, and every limb that must sit right at the corridor to work: melee and short reach, anything whose job is to touch the street edge.'],
  ['Line', 'Limbs that fire or act along an axis (long range down a street), or wall something.'],
  ['2x2', 'The very powerful ones. The Maw is already 2x2.'],
  ['T', 'The very powerful AREA-EFFECT limbs only.'],
  ['L (elbow)', 'Only where a bend genuinely does the job better and the limb does not need to hug the corridor with every cell. If nothing fits, fewer Ls rather than forced ones.'],
];

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
    to: '2x2', rule: 3, redraw: true, why: 'A BED: the picture is a wide dome of web, and its mucus slows a whole junction. Strong control (6.3 kills per bed built, the most of any slow), so its four cells are paid in hp and a wider bed. Kept 2x2.',
    silhouette: 'A wide flat web bed (the Netcaster stays a one-cell launcher).',
    variants: [[2, 'B', 'Grasping', 'reaches the air: tendrils stand up out of the bed']],
    overlays: ['Wide Bed: the mucus is drawn at its size'],

    resolves: {
      'pale pole sticking out': 'New firing clip in the redraw.',
      'Snare Bed and Netcaster are both webs': 'The bed is a wide flat web on four cells; the Netcaster a one-cell launcher with a folded net.',
    },
  },
  blighter: {
    to: '1x1', rule: 1, redraw: true, why: 'A cheap poison vent by the street; many of them.',
    silhouette: 'A tall cracked fumarole chimney streaming green spore smoke upward; no ring of yellow bulbs, no acid glands (so the VENOM look adds something).',
    variants: [[2, 'A', 'Airborne Spores', 'reaches the air: a taller stack']],
    resolves: {
      'Same silhouette as the Ember Sac': 'Both stay one cell, so the silhouettes do it: the Vent a TALL vertical chimney, the Ember Sac a LOW horizontal nozzle on a black fuel sac with a pilot flame.',
      'this limb already has them': 'Its base is drawn without acid glands, so the VENOM look reads as a change.',
      'poison kills were not credited': 'Fixed in code (Oct 1): poison kills are credited. Measured: 88 kills, 3.7 per Vent built.',
    },
  },
  impaler: {
    to: '1x2', rule: 2, redraw: true, why: 'A long harpoon rail shooting far (165): a line, as it is. The most expensive limb (36 war) and one of the strongest, so its second cell is paid in reach and hp. It shares "artillery" with the Mortar but not the verb: it pierces one target in any direction; the Mortar skips shells down the lane it lies along.',
    silhouette: 'A long harpoon rail lying the length of both cells, drawn at the size of its ground.',
    variants: [[3, 'A', 'Railspine', 'double range: a longer rail']],
    resolves: { 'Reads tiny': 'Redrawn to fill its two cells.' },
  },
  choir: {
    to: '1x1', rule: 1, why: 'A support organ among the limbs it speeds; not a powerful area limb. One cell.',
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
    to: '2x2', rule: 3, why: 'A big tesla frond whose storm arcs chain through crowds: 2x2 as it is, its cells paid in hp and reach. Watch it: only 2.9 kills per built in the scripted runs, low for a big shape.',
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
    to: '1x1', rule: 1, why: 'A short fan (reach 72): it must stand at the corridor. One cell.',
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
    to: '1x1', rule: 1, redraw: true, why: 'A flamethrower with a short cone (reach 70): it must stand at the corridor. One cell.',
    silhouette: 'A LOW horizontal nozzle on a black fuel sac, a pilot flame at the tip: fire is in the picture, and it lies low where the Blight Vent stands tall.',
    variants: [[1, 'B', 'Long Flame', '40% more range: a longer nozzle']],
    resolves: {
      'Same silhouette as the Blight Vent': 'A low horizontal nozzle on a fuel sac vs the Vent\'s tall chimney.',
      'its own look already IS the VENOM look': 'Drawn as fire (orange, black fuel sac), not acid: VENOM adds glands.',
      'burn kills were not credited': 'Fixed in code (Oct 1): burn kills are credited.',
    },
  },
  conduit: {
    to: '1x1', rule: 1, redraw: true, why: 'An engine piece: one cell. (A bend would not make it do its job better: rule 5.)',
    silhouette: 'A bent marrow pipe on one cell (no orange slits).',
    overlays: ['Long Lane, Great Conduit: the lane and the gather ring are drawn'],
    resolves: { 'Press, Reliquary and Marrow Conduit': 'All stay one cell, so the silhouettes do it: the Conduit a bent pipe, the Press a screw press on a bed, the Reliquary a sealed casket. No orange slits on any.' },
  },
  amp: { to: '1x1', rule: 1, why: 'An engine piece. One cell.', overlays: ['Long Reach: the lane is drawn'] },
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
    to: '1x1', rule: 1, redraw: true, why: 'An engine piece. One cell.',
    silhouette: 'A screw press on a short bed (no orange slits).',
    overlays: ['Long Press: the lane is drawn'],
    resolves: {
      'Press, Reliquary and Marrow Conduit are all lumpy': 'Redrawn as a screw press on a bed.',
      'teaches a BONE bonus': 'It teaches VENOM: it renders kills down (digestion), not armour.',
    },
  },
  reliquary: {
    to: '1x1', rule: 1, redraw: true, why: 'An engine piece. One cell, a new silhouette and a view from behind.',
    silhouette: 'A sealed bone casket (an amber jar of marrow), no orange slits and no religious symbol.',
    overlays: ['Long Vigil: the lane is drawn'],
    resolves: {
      'Reads like the Meat Press': 'A sealed casket vs the screw press and the bent pipe.',
      'Death insurance counts as BONE': 'Keep BONE: it holds what it guards (the flag itself called it defensible).',
    },
  },
  lance: {
    to: '1x2', rule: 2, redraw: true, why: 'It lays a strip of creep straight ahead: a line along that strip, as it is.',
    silhouette: 'A hose body along both cells with the nozzle at its front.',
    overlays: ['Long / Great Runner, Broad Runner, Delta: the strip itself shows its length and width'],
    resolves: { 'Reads tiny; the nozzle looks like a horn': 'Redrawn as a two-cell hose; the strip leaves its nozzle.' },
  },
  cage: { to: '2x2', rule: 3, why: 'The Trap Cage: given, not drawn from the deck; it catches royals. 2x2 as it is.' },
  sprout: { to: '1x1', rule: 1, why: 'Given, not drawn. A small Spitter.' },
};

/** Why there is no T or L in the plan (rules 4 and 5), shown with the distribution. */
export const NO_L = 'No limb is a T or an L. No limb\'s body or job is shaped like one: the strongest area limb (the Bombard) is one gun firing at a marker, so a T\'s stem would point nowhere; every L candidate either hugs the corridor (Lasher, Quill Fan) or would not work better bent (Conduit, Snare Bed). The engine supports both for a limb designed around one.';

/** What the sanity pass (Collins, Oct 2: "also think through if they are sane") changed, and why. */
export const SANITY = [
  ['Spore Bombard: T → 2x2', 'One gun that lobs at a marker anywhere: a T\'s stem would point nowhere, and nobody would guess a T from a mortar. A squat 2x2 mortar is what it is. Measured: as a T it lost a win in ten (4/10); as a 2x2 it holds.'],
  ['Caustic Mister: 2x2 → one square', 'The cheapest limb (12 war) and one of the weakest; one nozzle sprays the mist, so three of its four cells did nothing. Cheap early limbs stay small.'],
  ['Ward Membrane: 2x2 → one square', 'A cheap support (16 war) whose shield reaches out by radius from one point; the extra cells shielded nothing.'],
  ['Kept after the checks', 'Maw (a huge mouth, very strong), Snare Bed (a wide bed, strong control), Broodmother Den (a nest that bears a unit), Galvanic Frond (a big tesla frond; watch its kills), Trap Cage (given). Lines: Spine Wall (walls a street, across it), Impaler (a long rail, the priciest limb), Skipping Mortar and Creep Lance (they act along the line they lie on). Everything else one square: simple, cheap, or must touch the street.'],
  ['Evolutions that change reach', 'No shape changes mid-run. Lasher Long Whips, Quill Long Fan, Ember Long Flame, Spitter Long Throat, Impaler Railspine, Sling Long Arm, Blight Vent Airborne Spores and Snare Bed Grasping get variant art instead (see "Visual variants").'],
];

/** The old sheet's "Decide first" list and the flags the sheet counts, each with how the plan answers it. */
export const FIXES = [
  ['Look-alikes: Blight Vent and Ember Sac', 'Both stay one cell, so the silhouettes separate them: the Vent a tall vertical chimney streaming spores, the Ember Sac a low horizontal nozzle on a black fuel sac with a pilot flame. Neither carries acid glands, so VENOM adds them.'],
  ['Look-alikes: Spitter and Bile Lobber', 'Spitter keeps the mouth on a stalk. Lobber: a bile sac on a sling arm, with a new puddle verb.'],
  ['Look-alikes: Lure Gland and Ocular Stalk', 'Both stay one cell: the Lure a squat pitcher bloom leaking haze, the Ocular a tall eyestalk under a bony lens hood.'],
  ['Look-alikes: Meat Press, Reliquary, Marrow Conduit', 'All stay one cell: a screw press on a bed, a sealed casket, a bent pipe. No orange slits on any.'],
  ['Two-cell limbs drawn tiny (Impaler, Mortar, Lance)', 'Redrawn to fill their two cells, with a view from behind.'],
  ['Directional limbs with no back view', 'Every redrawn limb gets a view from behind in the same pass, and Mosaic, Twinning, Mitosis, Capacitor and Boomerang get one added.'],
  ['Lobber vs Bombard: one aimed-artillery verb too many', 'Split by footprint and effect: the Lobber a cheap one-cell glob that leaves an acid puddle; the Bombard the one 2x2 siege gun, a huge slow shell on its marker.'],
  ['Looks no evolution path reaches (the prototypes)', 'Draw only the reachable looks, with the spatial variants, in one pass. The Lasher keeps one cell, so its prototypes stay; the Spitter\'s, Lasher\'s and Frond\'s unreachable looks stay as eaten-bonus looks.'],
  ['Odd bonus classes (Press, Tap, Reliquary, Choir)', 'Choir teaches SWARM (+8% fire rate, its own job); Press teaches VENOM (renders kills down); Tap teaches SWARM (copies); Reliquary keeps BONE (it holds).'],
  ['Kills by poison, fire, clouds and swallows went uncredited', 'FIXED in code (Oct 1, stats only): Maw 0 → 154 kills, Blight Vent 21 → 88, Lure 0 → 9. The numbers on this sheet are re-measured with it.'],
];

/** For Collins to decide (shown at the end of the plan). */
export const QUESTIONS = [
  'The three footprint changes: the Spore Bombard onto a 2x2; the Caustic Mister and the Ward Membrane back to one square (with the stats they had before Sep 29).',
  'The Lobber/Bombard split: the Lobber a cheap glob that leaves an acid puddle (a new verb), the Bombard the 2x2 siege gun.',
  'The bonus classes: Choir → SWARM (and its donor bonus +8% fire rate), Press → VENOM, Tap → SWARM, Reliquary stays BONE.',
  'No T and no L: none of today\'s limbs is shaped like one. If you want them in the game, they should be NEW limbs designed around the shape (a T-shaped spore pump that floods a crossing, an L-shaped thorn hedge that walls a corner), not reshaped old ones.',
];

/** The look-art price per drawing (notes/UPGRADE-LOOKS.md): one side $1.45 (a picture and two clips), with a view from behind $2.90. */
export const PRICE = { side: 1.45, both: 2.9 };
