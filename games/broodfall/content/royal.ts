/**
 * ROYAL DECREES: what royal points buy (DESIGN.md rule 10, "royalty is for special upgrades";
 * "Royal meat buys SPECIAL upgrades — rare, run-defining purchases no amount of war/science meat
 * can substitute for"). Built Sep 30 2026 to replace the biomass surge, which was a placeholder.
 *
 * Every decree bends a RULE of the run rather than adding a stat: the hand's size, the organ
 * stage's use-it-or-lose-it, the court's presence turned to your side, the consort's promotions
 * turned to your side, a card of your choosing, the core itself. Each is bought where it acts: the
 * run-wide ones on their card in the ROYAL DECREES box (the bar's royal button opens it), the
 * crown on the limb itself (its panel). Every second copy changes something (the doubling rule).
 * Royal points are earned by killing the court (a consort or matron pays 1, the royal 3), the
 * dig's royal tombs and ossuaries, and the campaign's perks.
 */
export type DecreeId = 'crown' | 'favour' | 'retinue' | 'larder' | 'commission' | 'heart';

export interface DecreeDef {
  id: DecreeId;
  name: string;
  /** Royal points for the first purchase. */
  cost: number;
  /** Added to the price by every earlier purchase of the same decree. */
  costStep: number;
  /** One line: what it does (shown on its card). */
  text: string;
  /** What a second copy does (the doubling rule; shown on the card once one is owned). */
  again: string;
  /** Bought on a limb (its panel), not in the decree box. */
  onLimb?: boolean;
}

export const DECREES: readonly DecreeDef[] = [
  {
    id: 'crown', name: 'Crown a Limb', cost: 1, costStep: 0, onLimb: true,
    text: 'The court\'s presence, turned to your side: every OTHER limb within 120px takes 30% less harm and hits 25% harder.',
    again: 'Crowns add: a limb inside two crowns takes 0.7 × 0.7 of the harm and hits +50%.',
  },
  {
    id: 'favour', name: 'Consort\'s Favour', cost: 2, costStep: 1,
    text: 'The consort\'s promotions, turned to your side: at every cleared wave, the limb that killed most in it is PROMOTED — one more bonus of its own family, for life.',
    again: 'Each copy promotes one more limb (the next best killer) every wave.',
  },
  {
    id: 'retinue', name: 'Royal Retinue', cost: 2, costStep: 1,
    text: 'One more card in the hand, drawn now and kept for the rest of the run.',
    again: 'One more card again.',
  },
  {
    id: 'larder', name: 'Royal Larder', cost: 2, costStep: 2,
    text: 'The organ stage\'s rule bent: half of the war and science you have not spent is KEPT when a wave starts.',
    again: 'Each copy keeps half of what the last one lost (½ → ¾ → ⅞).',
  },
  {
    id: 'commission', name: 'Royal Commission', cost: 1, costStep: 1,
    text: 'Choose any limb your organs unlock: a FREE card of it goes into the hand now.',
    again: 'Another commission (each costs one point more).',
  },
  {
    id: 'heart', name: 'Queen\'s Heart', cost: 1, costStep: 0,
    text: 'The core grows a second heart: +300 max hp, and 300 hp healed now.',
    again: '+300 again.',
  },
];

export const DECREE_BY_ID: Record<DecreeId, DecreeDef> = Object.fromEntries(DECREES.map((d) => [d.id, d])) as Record<DecreeId, DecreeDef>;

/** The numbers the sim reads (kept beside the words that promise them). */
export const ROYAL = {
  crownRadius: 120,
  crownHarm: 0.7,
  crownDamage: 0.25,
  heartHp: 300,
  larderKeep: 0.5,
} as const;
