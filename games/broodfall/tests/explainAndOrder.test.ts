import { describe, expect, it } from 'vitest';
import { shouldExplainSacrifice, type ExplainFacts } from '../src/ui/sacrificeExplainer';
import { ORDER_CHOICES, choiceFrom, choiceOf, directiveFor, orderText } from '../src/meta/skirmishOrder';
import { BALANCE } from '../content/data';

const base: ExplainFacts = {
  seen: false, automated: false, forced: false, cardInHand: true, eatable: 1, phase: 'growth',
  wavesCleared: 0, mission1: false, cannibalShown: false, onlyBySacrifice: false,
};

describe('the EAT A LIMB explainer: when it shows', () => {
  it('shows the first time a card is picked up with a limb standing, in the wave setup', () => {
    expect(shouldExplainSacrifice(base)).toBe(true);
  });
  it('never with nothing to eat or no card in hand (the very first click of a game)', () => {
    expect(shouldExplainSacrifice({ ...base, eatable: 0 })).toBe(false);
    expect(shouldExplainSacrifice({ ...base, cardInHand: false })).toBe(false);
  });
  it('once ever, and never under automation, unless forced', () => {
    expect(shouldExplainSacrifice({ ...base, seen: true })).toBe(false);
    expect(shouldExplainSacrifice({ ...base, automated: true })).toBe(false);
    expect(shouldExplainSacrifice({ ...base, seen: true, automated: true, forced: true })).toBe(true);
    expect(shouldExplainSacrifice({ ...base, forced: true, eatable: 0 })).toBe(false);
  });
  it('mid-siege only when the card can only be paid for by eating', () => {
    expect(shouldExplainSacrifice({ ...base, phase: 'siege' })).toBe(false);
    expect(shouldExplainSacrifice({ ...base, phase: 'siege', onlyBySacrifice: true })).toBe(true);
  });
  it('mission 1 waits for its own reveal of cannibalizing (one thing at a time)', () => {
    const m1 = { ...base, mission1: true };
    expect(shouldExplainSacrifice(m1)).toBe(false);
    expect(shouldExplainSacrifice({ ...m1, onlyBySacrifice: true })).toBe(false);
    expect(shouldExplainSacrifice({ ...m1, onlyBySacrifice: true, wavesCleared: 1 })).toBe(true);
    expect(shouldExplainSacrifice({ ...m1, cannibalShown: true, wavesCleared: 2 })).toBe(true);
  });
});

describe('the skirmish order picker', () => {
  it('maps each choice to its directive, from BALANCE', () => {
    expect(directiveFor('hold', BALANCE)).toEqual({ kind: 'hold', waves: BALANCE.holdWaves });
    expect(directiveFor('royal', BALANCE)).toEqual({ kind: 'royal', count: 1 });
    expect(directiveFor('harvest', BALANCE)).toEqual({ kind: 'harvest', science: BALANCE.harvestScience });
    expect(directiveFor('random', BALANCE)).toBeUndefined();
  });
  it('reads a query value or a directive back as a choice', () => {
    expect(choiceFrom('royal')).toBe('royal');
    expect(choiceFrom('nonsense')).toBe('random');
    expect(choiceFrom(null)).toBe('random');
    for (const c of ORDER_CHOICES) expect(choiceOf(directiveFor(c, BALANCE))).toBe(c);
  });
  it('says each order and its length with the numbers in force', () => {
    expect(orderText('hold', BALANCE).length).toContain(String(BALANCE.holdWaves));
    expect(orderText('royal', BALANCE).line).toContain(String(BALANCE.royalGuaranteeWave));
    expect(orderText('harvest', BALANCE).line).toContain(String(BALANCE.harvestScience));
    for (const c of ORDER_CHOICES) expect(orderText(c, BALANCE).name.length).toBeGreaterThan(0);
  });
});
