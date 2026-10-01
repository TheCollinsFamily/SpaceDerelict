/**
 * The hand-written half of the limb decision sheet (tools/codex/sheet.mjs): what Claude saw LOOKING at
 * every limb's pictures (notes/screens/2026-10-01/codex-*.jpg and the sheet's own thumbnails) and reading
 * its role against the others, on Oct 1 2026. Opinions, marked as such on the sheet. Everything that can
 * be counted (missing views, idles, clips, looks reached, kills in the scripted runs) is computed by the
 * sheet itself and is not repeated here.
 *
 * kind: art (the picture), role (what it is for, beside the others), looks (the upgrade-look rule),
 * words (the text), balance (the numbers).
 */
export const AUDIT = {
  impaler: [
    ['art', 'Reads tiny: at card and board size the harpoon is a few pixels and the limb is a lump with a stick. A LONG limb drawn smaller than most one-cell limbs.'],
  ],
  skipper: [
    ['art', 'Reads tiny, like the Impaler: the mortar is a small barrel on a skirt. Its one-way facing is hard to see.'],
  ],
  lance: [
    ['art', 'Reads tiny; the nozzle looks like a horn. The strip of creep it lays is its whole point and the body does not suggest a line.'],
  ],
  blighter: [
    ['art', 'Same silhouette as the Ember Sac: a round body ringed with yellow bulbs. Hard to tell apart at 64 px.'],
    ['looks', 'The VENOM look adds "bulging acid yellow-green glands": this limb already has them, so a venom Blight Vent barely changes.'],
  ],
  ember: [
    ['art', 'Same silhouette as the Blight Vent (yellow bulbs ringing a round body). Fire is not in the picture: no flame, no oil.'],
    ['looks', 'Like the Blight Vent, its own look already IS the VENOM look.'],
  ],
  mister: [
    ['looks', 'A yellow gland on top already; the VENOM look will read as more of the same.'],
  ],
  spitter: [
    ['art', 'Spitter, Seedling and Bile Lobber are all a mouth on a stalk over the skirt; at 32-64 px the Lobber and the Spitter are hard to tell apart. (The Seedling is meant to be a small Spitter.)'],
  ],
  lobber: [
    ['art', 'Reads as another Spitter. Nothing says "a bile glob you aim": no sac, no sling arm.'],
    ['role', 'Overlaps the Spore Bombard: both are player-aimed long-range splash on the ground. The Lobber is a click-and-fire volley, the Bombard shells a marker. Worth one of them changing verb.'],
  ],
  bombard: [
    ['art', 'A bone cone. Does not read as long-range artillery; from behind it is a closed bud.'],
    ['role', 'Overlaps the Bile Lobber (aimed artillery). See there.'],
  ],
  lure: [
    ['art', 'A ball on a long stalk, like the Ocular Stalk. The lure reads; the poison cloud it pulses does not show on the limb.'],
  ],
  ocular: [
    ['art', 'A ball on a long stalk, like the Lure Gland; the eye reads well up close only.'],
  ],
  press: [
    ['art', 'Press, Reliquary and Marrow Conduit are all lumpy bodies with glowing orange slits: the engines read as one family (fine) but not as three different jobs.'],
    ['looks', 'An economy engine (kills pay science) teaches a BONE bonus, so it puts armour plates on whatever eats it. Odd for a meat press.'],
  ],
  reliquary: [
    ['art', 'Reads like the Meat Press (orange slits in a lump).'],
    ['looks', 'Death insurance counts as BONE. Defensible (it "holds"), but nothing about it is armour.'],
  ],
  tap: [
    ['looks', 'A bonus farm counts as BONE when eaten, like the Press and the Reliquary.'],
  ],
  tangler: [
    ['art', 'Its firing clip has a pale pole sticking out of the bottom of the frame (look at the FIRING view).'],
    ['art', 'Snare Bed and Netcaster are both webs; the bed is a dome, the netcaster a fan. They read apart up close, less at far zoom.'],
  ],
  burster: [
    ['art', 'In its firing clip the body collapses to a stump. If that is the polyp leaving, it reads as the limb dying.'],
  ],
  swamp: [
    ['looks', 'A flat pit in the street: what do BONE (taller, armoured) or REACH (a longer stalk, guy-ropes) look like on a hole in the road? Its evolutions reach only VENOM and VENOM+REACH, so two looks may be all it needs.'],
  ],
  choir: [
    ['looks', 'It is a tempo aura (+15% rate) but teaches REACH when eaten (+8% reach). Its look in an eater says REACH, its own job says SWARM.'],
  ],
  brood: [
    ['words', 'The card said "Keeps 3 broodlings"; the content comment says six; the spec says 5. The card now reads the spec (5) and the comment says five.'],
  ],
  maw: [
    ['balance', 'Built 45 times in the scripted runs and credited with 0 kills: bodies it eats whole are not credited to any limb (111 eaten in the runs). A counting gap, not proof it is weak.'],
  ],
};

/** The things to decide first, in order, with the families they touch. Shown at the top of the sheet. */
export const DECISIONS = [
  ['Draw only the looks a limb can reach?', 'With no eaten bonus, the eight evolution paths of most limbs reach only one to three looks (the stage 3 pick usually decides it). Spine, Mister, Lure, Skipper, Lance and six engines reach ONE. The prototypes even drew looks no evolution path reaches: Spitter BONE, VENOM and Spore Hive; Lasher VENOM, REACH and Plague Bastion; Frond BONE, VENOM and Storm Crown. Eaten bonuses can still reach any class. Drawing the reachable looks first would cost far less than 4 classes and a superstructure for each of the 34.', ['spitter', 'lasher', 'frond', 'spine', 'mister', 'lure', 'skipper', 'lance']],
  ['Fix the look-alikes before drawing their upgrades', 'Blight Vent and Ember Sac share a silhouette, and both already carry the VENOM look. Spitter and Bile Lobber read alike. Lure Gland and Ocular Stalk are both a ball on a stalk. Press, Reliquary and Conduit share orange slits. An upgrade drawn on top of a confusing base makes the confusion permanent.', ['blighter', 'ember', 'lobber', 'spitter', 'lure', 'ocular', 'press', 'reliquary', 'conduit']],
  ['Make the small LONG limbs bigger', 'Impaler, Skipping Mortar and Creep Lance take two cells but are drawn smaller than one-cell limbs. Their upgrade looks would inherit the problem.', ['impaler', 'skipper', 'lance']],
  ['Directional limbs need a view from behind', 'Six engines point at a target but have no view from behind (Boomerang, Capacitor, Mosaic, Mitosis, Reliquary, Twinning): after a camera turn you cannot see which way they point. Twenty-two of the 37 have no view from behind.', ['boomerang', 'capacitor', 'mosaic', 'mitosis', 'reliquary', 'twin']],
  ['Lobber or Bombard: one aimed artillery verb too many', 'Both are player-aimed, ground-only, long-range splash. They also top the kills per limb built in the scripted runs (with the Impaler).', ['lobber', 'bombard']],
  ['Which class do the economy engines teach?', 'Press, Tap and Reliquary teach BONE (armour plates on an eater), Choir teaches REACH though it is a tempo aura. Settle the mapping before eaters show it.', ['press', 'tap', 'reliquary', 'choir']],
];
