/**
 * THE FOOTPRINT PLAN (Oct 1 2026), for Collins to decide; nothing here is applied to the game.
 * His words: "the total lack of diversity in footprint ... is kind of a KEY part of tower defence strategy.
 * In tower defence the tower categories are one square (hugely over-represented), two squares (line), four
 * squares (large square, usually for very powerful towers), T-shaped (usually for very powerful area-effect
 * things), L-shaped (like an elbow shape) ... we may need more visuals for towers that, to work, need to look
 * different ... so a reach lasher will likely need sub-variants because it needs that reach to work." And:
 * "look at the problems you identified in the doc for the existing ones and make sure you pre-address this in
 * the redesign."
 *
 * Read by tools/codex/sheet.mjs (the Footprint column, the plan section, "Resolved by" on every old flag) and
 * written out as notes/FOOTPRINT-PLAN.md by the same script. The engine for every shape is built
 * (src/sim/footprint.ts); `?tryShape=lasher:L3` plays any of these before it is decided. The plan's balance is
 * measured by tools/measure/footprints.measure.ts (candidates plan, planLines, planT, planL, planSquare).
 *
 * to: '1x1' | '1x2' | 'line3' | '2x2' | 'T' | 'L3' | 'L4'.  redraw: the base picture is drawn again (with a
 * view from behind) in the same pass as its upgrade looks.  variants: evolutions that change what it does in
 * SPACE and so need their own drawing ([stage, choice, name, what changes]).  overlays: spatial evolutions the
 * game shows with a drawn ring, strip or lane instead.  resolves: flag text (a substring of the old flag) →
 * how this plan answers it.
 */
export const PLAN = {
  spitter: {
    to: '1x1', why: 'The cheap staple: the many-small-limbs layer every tower defence keeps. One cell stays its strength.',
    silhouette: 'Keeps the mouth on a stalk (it is the archetype; the Lobber changes instead).',
    variants: [[3, 'B', 'Long Throat', 'double range: a long sniper neck']],
    resolves: { 'Spitter, Seedling and Bile Lobber': 'The Lobber is redrawn as a bile sac on a sling arm; the Spitter keeps the mouth on a stalk.' },
  },
  burster: {
    to: 'T', redraw: true, why: 'Its whole job is area. A T is the "very powerful area-effect" shape: three polyp pods on a bar, launched from the junction.',
    silhouette: 'Three polyp pods along a bar, a launcher stem: no single round body.',
    variants: [[3, 'B', 'Skyburst', 'blasts reach the air: pods tilted up']],
    overlays: ['Wide / Dense Burst: the blast is drawn at its true size'],
    resolves: { 'collapses to a stump': 'The new firing clip launches one pod; the bar stays standing.' },
  },
  lasher: {
    to: 'L3', redraw: true, why: 'Melee sweep. On an elbow at a street corner it sweeps BOTH streets from the bend (Collins: "a lasher that sweeps two lanes").',
    silhouette: 'A root mass bent round a corner, the whips rising from the elbow.',
    variants: [[1, 'A', 'Long Whips', '40% more reach: the whips ARE the reach, so long whips are drawn long (Collins: "a reach lasher ... needs that reach to work")']],
    resolves: { 'Drawn looks no evolution path reaches': 'Redraw only its reachable looks (bone, swarm), each at both whip lengths, for the L footprint; the 1-cell prototypes are retired.' },
  },
  maw: {
    to: '2x2', why: 'The heavy eater stays a big square.',
    resolves: {
      'credited with 0 kills': 'Fixed in code (Oct 1): a swallow is credited to the Maw in the run stats. Measured: 154 kills, 3.3 per Maw built.',
      'Its eaten whole kills were not credited': 'Fixed in code (Oct 1): swallows are credited (stats only, no play changed).',
    },
  },
  spine: { to: '1x2', why: 'The street wall: a line across a lane. Unchanged.' },
  lure: {
    to: '1x1', redraw: true, why: 'Cheap bait, any roof by a street.',
    silhouette: 'A pitcher bloom leaking a visible pink-green haze, not a ball on a stalk.',
    overlays: ['Wide Cloud: the cloud is drawn at its size'],
    resolves: {
      'A ball on a long stalk, like the Ocular Stalk': 'Redrawn as a pitcher bloom with its haze; the Ocular lies down as a two-cell periscope.',
      'cloud kills were not credited': 'Fixed in code (Oct 1): cloud kills are credited (9 in the runs: it is bait, not a killer).',
    },
  },
  tangler: {
    to: 'L4', redraw: true, why: 'A snare bed along a street that turns the corner holds a column where it slows to turn; an L covers more street edge than a square on the same four cells.',
    silhouette: 'A long web bed bent at the corner (the Netcaster stays a launcher).',
    variants: [[2, 'B', 'Grasping', 'reaches the air: tendrils stand up out of the bed']],
    overlays: ['Wide Bed: the mucus is drawn at its size'],
    resolves: {
      'pale pole sticking out': 'New firing clip in the redraw.',
      'Snare Bed and Netcaster are both webs': 'The bed becomes an L-shaped strip of web; the Netcaster is a one-cell launcher with a folded net.',
    },
  },
  blighter: {
    to: '1x1', redraw: true, why: 'A cheap poison vent, many of them; one cell keeps it a spreading layer.',
    silhouette: 'A cracked fumarole chimney streaming green spore smoke upward; no ring of yellow bulbs, no acid glands (so the VENOM look adds something).',
    variants: [[2, 'A', 'Airborne Spores', 'reaches the air: a taller stack']],
    resolves: {
      'Same silhouette as the Ember Sac': 'The Vent is a vertical chimney; the Ember Sac becomes a two-cell horizontal nozzle with a pilot flame.',
      'this limb already has them': 'Its base is drawn without acid glands, so the VENOM look reads as a change.',
      'poison kills were not credited': 'Fixed in code (Oct 1): poison kills are credited. Measured: 88 kills, 3.7 per Vent built.',
    },
  },
  impaler: {
    to: '1x2', redraw: true, why: 'A harpoon gun lies along its two cells. Unchanged footprint; its picture was the problem.',
    silhouette: 'A long harpoon rail lying the length of both cells, drawn at the size of its ground.',
    variants: [[3, 'A', 'Railspine', 'double range: a longer rail']],
    resolves: { 'Reads tiny': 'Redrawn to fill its two cells (the placeholder rule sizes art to the footprint).' },
  },
  choir: {
    to: 'T', redraw: true, why: 'An aura over its neighbours is an area effect: three organ pipes on a bar, a bellows stem; the aura comes from the junction.',
    silhouette: 'Three organ pipes on a bar and a bellows stem.',
    overlays: ['Wide Choir, Cathedral: the aura ring is drawn at its size'],
    resolves: { 'tempo aura (+15% rate) but teaches REACH': 'It teaches SWARM, and its donor bonus becomes +8% fire rate (its own job), not +8% reach.' },
  },
  sling: {
    to: '1x2', redraw: true, why: 'A catapult arm lies along two cells and throws the way it lies.',
    silhouette: 'A sling arm the length of its two cells.',
    variants: [[1, 'A', 'Long Arm', 'throws 50% farther: a longer arm']],
    overlays: ['Big Clots: the patch is drawn at its size'],
  },
  brood: { to: '2x2', why: 'The Broodmother Den (Oct 1: it bears a Broodmother UNIT that broods or fights): a big, protected nest stays a big square; its unit spawns on the street beside any of its cells.', resolves: { 'The card said': 'Done Oct 1: the card reads the spec (5).' } },
  hatch: { to: '1x1', why: 'The Brood Pit (new Oct 1): a cheap spawner of three warriors. One cell keeps it cheap to place anywhere by a street.' },
  swamp: {
    to: '1x1', why: 'A pit in the street; one cell keeps it a plug.',
    overlays: ['Wide Bog: the swamp is drawn at its size'],
    resolves: {
      'flat pit in the street': 'Draw only its two reachable looks (VENOM, VENOM+REACH).',
      'digestion': 'Fixed in code (Oct 1): its burn kills are credited too.',
    },
  },
  frond: {
    to: '2x2', why: 'A big tesla frond. Unchanged.',
    overlays: ['Long Arc, Storm Frond: the arcs are drawn'],
    resolves: { 'Drawn looks no evolution path reaches': 'Keep the drawn BONE, VENOM and Storm Crown for eaten bonuses only; draw nothing more until reach and swarm are checked.' },
  },
  lobber: {
    to: '1x1', redraw: true, why: 'Kept small and cheap, with a NEW verb: a quick aimed glob that leaves an acid puddle in the street (a short ground zone). The Bombard becomes the one big siege gun.',
    silhouette: 'A bile sac on a sling arm (nothing like the Spitter\'s mouth on a stalk).',
    overlays: ['Big Glob: the blast and puddle are drawn at their size'],
    resolves: {
      'Reads as another Spitter': 'Redrawn as a bile sac on a sling arm.',
      'Overlaps the Spore Bombard': 'Split by footprint and effect shape: the Lobber is a one-cell quick glob that leaves a puddle; the Bombard is a 2x2 siege gun with one huge slow shell on its marker.',
    },
  },
  mister: {
    to: 'T', redraw: true, why: 'Its mist is a big area effect: three spray nozzles on a bar, mist from the junction. The same four cells as today, reshaped.',
    silhouette: 'Three nozzles on a bar; no yellow gland on top.',
    overlays: ['Dissolving Mist: the mist is drawn at its size'],
    resolves: { 'A yellow gland on top already': 'The base is drawn without the gland, so VENOM adds it.' },
  },
  ocular: {
    to: '1x2', redraw: true, why: 'A board-wide eye on a long neck lying along the roof, the eye at the front: it reads as a sight line.',
    silhouette: 'A periscope neck lying along two cells, the eye at its tip.',
    resolves: { 'A ball on a long stalk, like the Lure Gland': 'It lies down along two cells as a periscope; the Lure becomes a pitcher bloom.' },
  },
  prism: { to: '1x1', why: 'A relay piece: many of them, linked. One cell.', overlays: ['Wide Lens, Grid Prism: the range ring and the beams are drawn'] },
  bombard: {
    to: '2x2', redraw: true, why: 'Heavy siege artillery is the classic big-square tower: one huge shell on its marker, slow.',
    silhouette: 'A squat mortar mound with a wide bone barrel, readable as artillery from every side.',
    overlays: ['Bigger Shell: the blast is drawn at its size'],
    resolves: {
      'A bone cone': 'Redrawn as a squat siege mortar with a view from behind.',
      'Overlaps the Bile Lobber': 'Split (see the Lobber): the Bombard is the big slow siege gun.',
    },
    risk: 'On Sep 29 2026 a big Bombard cost the scripted player a win in ten whatever it was paid. Measured Oct 1: made 2x2 alone it holds (5 of 10, guardrail 5:0).',
  },
  ward: { to: '2x2', why: 'A big membrane. Unchanged.', overlays: ['Wide Membrane: the cover is drawn at its size'] },
  quill: {
    to: 'L3', redraw: true, why: 'A fan of quills at an elbow covers both streets of a corner; the most damage of any limb, so it pays in ground.',
    silhouette: 'A fan of quills on a bent body, the fan at the elbow.',
    variants: [[1, 'B', 'Long Fan', '40% more range: longer quills']],
  },
  skipper: {
    to: '1x2', redraw: true, why: 'A mortar lying along its aim. Unchanged footprint.',
    silhouette: 'A long barrel along both cells: its facing reads.',
    resolves: { 'Reads tiny, like the Impaler': 'Redrawn to fill its two cells, barrel along its aim, with a view from behind.' },
  },
  net: {
    to: '1x1', redraw: true, why: 'Cheap anti-air, one cell.',
    silhouette: 'A launcher with a folded net (the Snare Bed becomes an L strip).',
    overlays: ['Flak Burst: the burst is drawn at its size'],
  },
  ember: {
    to: '1x2', redraw: true, why: 'A flamethrower is a nozzle with a fuel sac behind it: two cells along its cone. (Its cone then fires along the way it lies, like the Mortar: a mechanic change to measure.)',
    silhouette: 'A horizontal nozzle on a fuel sac, a pilot flame at the tip: fire is in the picture.',
    variants: [[1, 'B', 'Long Flame', '40% more range: a longer nozzle']],
    resolves: {
      'Same silhouette as the Blight Vent': 'A horizontal two-cell flamethrower vs the Vent\'s vertical chimney.',
      'its own look already IS the VENOM look': 'Drawn as fire (orange, black fuel sac), not acid: VENOM adds glands.',
      'burn kills were not credited': 'Fixed in code (Oct 1): burn kills are credited.',
    },
  },
  conduit: {
    to: 'L3', redraw: true, why: 'An elbow pipe: it gathers at the bend and feeds down one arm toward its target.',
    silhouette: 'A bent marrow pipe (no orange slits).',
    overlays: ['Long Lane, Great Conduit: the lane and the gather ring are drawn'],
    resolves: { 'Press, Reliquary and Marrow Conduit': 'Three new silhouettes: Conduit a bent pipe (L), Press a long press bed (line), Reliquary a sealed casket (one cell).' },
  },
  amp: { to: '1x2', redraw: true, why: 'A horn lying along what it amplifies: its aim reads from the shape.', silhouette: 'A resonant horn along two cells.', overlays: ['Long Reach: the lane is drawn'] },
  mosaic: { to: '1x1', why: 'An engine piece. One cell.', back: true, overlays: ['Long Lane, Grand Mosaic: the lane is drawn'] },
  twin: { to: '1x1', why: 'An engine piece. One cell.', back: true, overlays: ['Long Reach: the lane is drawn'] },
  tap: {
    to: '1x1', why: 'An engine piece. One cell.', overlays: ['Long Tap: the lane is drawn'],
    resolves: { 'A bonus farm counts as BONE': 'It teaches SWARM (copies: many).' },
  },
  mitosis: { to: '1x1', why: 'An engine piece. One cell.', back: true },
  capacitor: { to: '1x1', why: 'An engine piece. One cell.', back: true },
  boomerang: { to: '1x1', why: 'An engine piece. One cell.', back: true, overlays: ['Far Call, Orbit: the lane is drawn'] },
  press: {
    to: '1x2', redraw: true, why: 'A press bed with rollers lies along its two cells: the economy engine reads as machinery, not as another lump.',
    silhouette: 'A long press bed with a screw on top (no orange slits).',
    overlays: ['Long Press: the lane is drawn'],
    resolves: {
      'Press, Reliquary and Marrow Conduit are all lumpy': 'Redrawn as a long press bed on two cells.',
      'teaches a BONE bonus': 'It teaches VENOM: it renders kills down (digestion), not armour.',
    },
  },
  reliquary: {
    to: '1x1', redraw: true, why: 'An engine piece. One cell, a new silhouette and a view from behind.',
    silhouette: 'A sealed bone casket (an amber jar of marrow), no orange slits and no religious symbol.',
    overlays: ['Long Vigil: the lane is drawn'],
    resolves: {
      'Reads like the Meat Press': 'A sealed casket vs the Press bed and the Conduit pipe.',
      'Death insurance counts as BONE': 'Keep BONE: it holds what it guards (the flag itself called it defensible).',
    },
  },
  lance: {
    to: 'line3', redraw: true, why: 'Its whole point is the strip of creep it lays straight ahead: a three-cell hose lying along that strip.',
    silhouette: 'A long hose body with the nozzle at its front, along three cells.',
    overlays: ['Long / Great Runner, Broad Runner, Delta: the strip itself shows its length and width'],
    resolves: { 'Reads tiny; the nozzle looks like a horn': 'Redrawn as a three-cell hose; the strip leaves its nozzle.' },
  },
  cage: { to: '2x2', why: 'Given, not drawn from the deck. Unchanged.' },
  sprout: { to: '1x1', why: 'Given, not drawn. A small Spitter.' },
};

/** The old sheet's "Decide first" list and the flags the sheet counts, each with how the plan answers it. */
export const FIXES = [
  ['Look-alikes: Blight Vent and Ember Sac', 'Vent: a vertical fumarole chimney, one cell. Ember: a horizontal flamethrower nozzle on a fuel sac, two cells. Neither carries acid glands, so VENOM adds them.'],
  ['Look-alikes: Spitter and Bile Lobber', 'Spitter keeps the mouth on a stalk. Lobber: a bile sac on a sling arm, with a new puddle verb.'],
  ['Look-alikes: Lure Gland and Ocular Stalk', 'Lure: a pitcher bloom leaking its haze, one cell. Ocular: a periscope neck lying along two cells, the eye at the tip.'],
  ['Look-alikes: Meat Press, Reliquary, Marrow Conduit', 'Press: a long press bed (1x2). Conduit: a bent pipe (L). Reliquary: a sealed casket (1x1). No orange slits on any.'],
  ['Two-cell limbs drawn tiny (Impaler, Mortar, Lance)', 'Redrawn to fill their footprints (the Lance on three cells); new art is sized to its ground by the footprint, as the placeholder already is.'],
  ['Directional limbs with no back view', 'Every limb that faces a way or lies on a turned footprint gets a view from behind in the same pass: the 21 redrawn limbs plus Mosaic, Twinning, Mitosis, Capacitor and Boomerang.'],
  ['Lobber vs Bombard: one aimed-artillery verb too many', 'Split by footprint and effect shape: Lobber a cheap one-cell glob that leaves an acid puddle; Bombard a 2x2 siege gun, one huge slow shell on its marker.'],
  ['Looks no evolution path reaches (the prototypes)', 'Draw only the reachable looks, at the new footprint, with the spatial variants in the same pass. The Lasher\'s 1-cell prototypes are retired (it becomes an L); the Spitter\'s and Frond\'s unreachable looks stay as eaten-bonus looks.'],
  ['Odd bonus classes (Press, Tap, Reliquary, Choir)', 'Choir teaches SWARM (+8% fire rate, its own job); Press teaches VENOM (renders kills down); Tap teaches SWARM (copies); Reliquary keeps BONE (it holds).'],
  ['Kills by poison, fire, clouds and swallows went uncredited', 'FIXED in code (Oct 1, stats only): Maw 0 → 154 kills, Blight Vent 21 → 88, Lure 0 → 9. The numbers on this sheet are re-measured with it.'],
];

/** The look-art price per drawing (notes/UPGRADE-LOOKS.md): one side $1.45 (a picture and two clips), with a view from behind $2.90. */
export const PRICE = { side: 1.45, both: 2.9 };
