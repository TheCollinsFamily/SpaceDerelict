/**
 * ONE STORY FILM A RETURN (Collins, Oct 5 2026: "the other not coming at the same time as a faction vid"), the Roach
 * King's last stand near the end, the finale after the faction quest, and YOKE not repeating herself while she has
 * something she has not said. Whole campaigns, every faction as the ally (tools/measure/after-mission.measure.ts).
 */
import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../content/campaign';
import { GREETINGS } from '../content/greetings';
import { campaign } from '../tools/measure/after-mission.measure';

describe('after a mission', () => {
  for (const f of FACTIONS) {
    for (const seed of [1234, 77, 9001]) {
      it(`${f.id}, seed ${seed}: never a faction film and a Roach King piece on the same return`, () => {
        const { returns, ended } = campaign(seed, f.id);
        expect(ended).toBe(true);
        expect(returns.filter((r) => r.faction.length && r.roach).map((r) => r.n)).toEqual([]);
        // Every piece of his that waited plays later.
        const played = new Set(returns.map((r) => r.roach).filter(Boolean));
        for (const r of returns) if (r.waits) expect(played.has(r.waits), `${r.waits} waited at ${r.n} and never played`).toBe(true);
        // His last stand comes after the middle of the campaign, and the ally's finale after it.
        const stand = returns.findIndex((r) => r.roach === 'rk-stand');
        const finale = returns.findIndex((r) => r.faction.some((x) => /finale/.test(x)));
        expect(finale).toBeGreaterThan(0);
        if (stand >= 0) { expect(stand).toBeGreaterThan(returns.length / 2 - 1); expect(stand).toBeLessThan(finale); }
        // The end of his broadcast follows the last mission.
        expect(returns[returns.length - 1].roach).toBe('rk-offline');
      });
    }
  }

  it('YOKE says no won-greeting twice while one is left she has not said', () => {
    const won = GREETINGS.filter((g) => g.moment === 'won').length;
    const { returns } = campaign(1234, 'delegation');
    const firstRepeat = returns.findIndex((r) => /^won-/.test(r.greeting) && !r.greetingNew);
    const wonBefore = new Set(returns.slice(0, firstRepeat).map((r) => r.greeting).filter((g) => /^won-/.test(g))).size;
    expect(firstRepeat === -1 || wonBefore === won).toBe(true);
  });
});
