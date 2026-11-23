/**
 * THE SKIRMISH ORDER (Collins, Nov 23 2026: the player picks the deployment directive at deploy, with how
 * long each runs). Before this a skirmish drew its order at random (src/sim/sim.ts, cfg.directive unset).
 * The numbers are read from BALANCE (content/data.ts), never written here: they are being retuned so that
 * every order lasts a similar ~8-10 waves.
 */
import type { Directive } from '../sim/types';

export type OrderChoice = 'random' | 'hold' | 'royal' | 'harvest';
export const ORDER_CHOICES: OrderChoice[] = ['hold', 'royal', 'harvest', 'random'];

/** The directive numbers the choices read. */
export interface OrderNumbers { holdWaves: number; harvestScience: number; royalGuaranteeWave: number }

/** The directive a choice deploys with; `random` leaves it to the run's own dice (undefined). */
export function directiveFor(choice: OrderChoice, b: OrderNumbers): Directive | undefined {
  switch (choice) {
    case 'hold': return { kind: 'hold', waves: b.holdWaves };
    case 'royal': return { kind: 'royal', count: 1 };
    case 'harvest': return { kind: 'harvest', science: b.harvestScience };
    default: return undefined;
  }
}

/** The button's name, its one line, and roughly how long it runs. */
export function orderText(choice: OrderChoice, b: OrderNumbers): { name: string; line: string; length: string } {
  switch (choice) {
    case 'hold': return { name: 'HOLD', line: `Survive ${b.holdWaves} waves of the local response.`, length: `${b.holdWaves} waves` };
    case 'royal': return {
      name: 'KILL THE ROYAL',
      line: `Their royal takes the field by wave ${b.royalGuaranteeWave}: kill it.`,
      length: `about ${b.royalGuaranteeWave}–${b.royalGuaranteeWave + 2} waves`,
    };
    case 'harvest': return {
      name: 'BANK SCIENCE',
      line: `Eat their scientists and bank ${b.harvestScience} science meat.`,
      // The quota is a sum, not a wave count: its length is however fast the researchers are eaten. The
      // ~8-10 is the tuning target Collins set for the three orders (Nov 23 2026), not a measured figure.
      length: 'about 8–10 waves, faster if you hunt them',
    };
    default: return { name: 'RANDOM', line: 'Command picks one of the three when you land.', length: 'varies' };
  }
}

/** A query value (?directive=) as a choice; anything else is `random`. */
export function choiceFrom(v: string | null | undefined): OrderChoice {
  return v === 'hold' || v === 'royal' || v === 'harvest' ? v : 'random';
}

/** The choice as the page holds it: a directive's kind. */
export function choiceOf(d: Directive | undefined): OrderChoice {
  return d ? d.kind : 'random';
}

const KEY = 'broodfall-skirmish-order';

export function loadOrderChoice(): OrderChoice {
  try { return choiceFrom(localStorage.getItem(KEY)); } catch { return 'random'; }
}

export function saveOrderChoice(c: OrderChoice): void {
  try { localStorage.setItem(KEY, c); } catch { /* private mode: asked again next time */ }
}
