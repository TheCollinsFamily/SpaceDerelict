/**
 * The words for every limb family: its card line, what it teaches when it is EATEN, and what it can
 * shoot. Pure data (no DOM, no Pixi), read by the HUD (src/ui/hud.ts), the Limb Codex (src/ui/codex.ts)
 * and the decision sheet (tools/codex-sheet.mjs).
 */
import type { TowerFamily } from '../src/sim/types';
import { TOWERS } from './data';

export const CARD_DESC: Record<TowerFamily, string> = {
  spitter: 'Ranged acid limb. Cheap, reliable.',
  burster: 'Lobs detonating polyps. Area denial.',
  lasher: 'Melee flail. Shreds crowds up close.',
  maw: 'Eats weakened specimens whole. Mass gain.',
  spine: 'Bone barricade IN the street. Chewers get barbs.',
  lure: 'Bait that bites: toxic clouds that reveal the unseen.',
  tangler: 'Snare mucus. Hit specimens wade, not march.',
  blighter: 'Spore clouds. The blight keeps eating — through armor.',
  impaler: 'Bone harpoon. Skewers a file, ignores shields.',
  choir: 'Resonance organ. Nearby limbs strike faster.',
  sling: 'Hurls creep to chosen ground. Click it to aim.',
  brood: `Keeps ${TOWERS.find((t) => t.family === 'brood')!.broodCount} broodlings fighting in the streets.`,
  swamp: 'Anti-wall: they wade through; the weak dissolve.',
  frond: 'One strike arcs through the whole squad.',
  lobber: 'Aimed bile volley. Click it, click ground.',
  mister: 'Shreds armor — everyone hits deeper.',
  ocular: 'Board-wide eye. Executes drummers and tenders.',
  prism: 'Focus beam that ramps. Idle prisms relay it charge.',
  bombard: 'Long-range shelling. Click it, set its marker.',
  ward: 'Shields the limbs around it. Regrows when quiet.',
  quill: 'Shotgun fan of quills. Brutal up close.',
  skipper: 'Fires ONE way, very far; shells skip on.',
  lance: 'Shoots CREEP in a line ahead — new ground in a strip.',
  cage: 'Catches a weakened ROYAL — grafted, she fights her own.',
  sprout: 'FREE, from a Seeding Gland: a weak little shooter, shot up from below.',
  net: 'Anti-air only. Nets drag fliers to the ground.',
  ember: 'Flamethrower cone. Fire spreads body to body.',
  conduit: 'Funnels every bonus around it into the limb it points at.',
  amp: 'Target\'s bonuses ×1.5 (round down). Stack them!',
  mosaic: 'Gives its target one of EVERY bonus type nearby.',
  twin: 'Its target fires DOUBLE the projectiles.',
  tap: 'Stops its target — sacrifice the tap again and again.',
  mitosis: 'Buds a plain copy of the adjacent limb each wave.',
  capacitor: 'Banks idle shots; fires them at 400% speed.',
  boomerang: 'Its target\'s shots fly BACK to it after a hit.',
  press: 'Its target\'s kills pay SCIENCE instead of war.',
  reliquary: 'If its target dies, keep its bonuses. Comes as a PAIR.',
};

/** What each family's bonus does when it is EATEN (shown on the cannibalize hover). */
export const PIP_DESC: Record<TowerFamily, string> = {
  spitter: '+25% fire rate (or a producer cycles faster)',
  burster: '+12px splash (or a bigger effect radius)',
  lasher: '+20% damage (or a stronger effect)',
  maw: '+30% meat from its kills',
  spine: '+75 hp, and its kills leave caltrops',
  lure: '+2 interest, and its hits leave toxic pheromone clouds',
  tangler: 'its hits slow ×0.9',
  blighter: 'its hits poison +2/s',
  impaler: '+5 armor pierce',
  choir: '+8% reach',
  sling: 'needs no creep to stand on, and seeps creep',
  brood: 'heals 50% every wave (on a Broodmother: +1 broodling)',
  swamp: 'its hits digest anything left under +10 hp',
  frond: 'its hits arc to +1 more',
  lobber: 'its hits knock back 8px',
  mister: 'its hits break armor +3 (and reveal the unseen)',
  ocular: 'detects the unseen, shoots supports first, +25% vs them',
  prism: '+6% damage per shot held on one target',
  bombard: '×2 range',
  ward: '+60 permanent shield',
  quill: 'every shot also hits +1 more target',
  skipper: 'every impact skips on once more',
  lance: 'it seeps creep around itself (+1 cell)',
  cage: 'its hits root the target in place',
  sprout: 'a little faster',
  net: 'can hit AIR, and its hits drag fliers down 1s',
  ember: 'its hits IGNITE +3/s — contagious fire that lights up the unseen',
  conduit: 'EVERYTHING it was channelling (harvested), plus: draws its nearest neighbour\'s bonus',
  amp: 'ALL its bonus counts ×1.5, rounded down (2→3, 4→6)',
  mosaic: 'one of each type it was channelling (harvested), plus: draws one of each type among its neighbours',
  twin: '+1 projectile on every shot',
  tap: 'a copy of the TAPPED limb\'s bonuses — and the tap stays (sacrifice it again)',
  mitosis: 'buds a plain copy of ITSELF next to it every wave',
  capacitor: 'banks its own idle shots and spends them at 400% speed',
  boomerang: 'its projectiles fly back to it after a hit',
  press: 'its war kills pay science instead',
  reliquary: 'if it dies, its bonuses are banked for your next build',
};

/** What a family can shoot, as the card and panel tag. */
export function layerTag(family: TowerFamily): string {
  const spec = TOWERS.find((t) => t.family === family)!;
  if (spec.rate <= 0 && family !== 'lobber' && family !== 'bombard' && family !== 'spine' && family !== 'swamp' && family !== 'lure') return 'SUPPORT';
  const h = spec.hits ?? 'both';
  return h === 'both' ? 'AIR + GROUND' : h === 'air' ? 'AIR ONLY' : 'GROUND';
}
