/**
 * The organ stage's summary said "BONE FORGE LV2" while the forge's card said LV 1 (bug hunt, Nov 22 2026): the summary
 * counts the levels a heart's zone and the ground's features add, the card the level bought. The summary now says where
 * the rest comes from; Sim.organEffects names it (base, why).
 */
import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { liftText } from '../src/ui/underground';
import { neighbours4 } from '../src/sim/underground';
import type { SimConfig } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 1234, organStage: true };

describe('an organ above the level bought says why', () => {
  it('a forge touching a Sewer Main: LV2 = LV1 bought + 1 from the Sewer Main', () => {
    const s = new Sim(CFG);
    s.chyme = 9999; s.meat.war = 9999; s.meat.science = 9999;
    const u = s.under;
    for (const c of u.cells) if (c.kind !== 'meteor') { c.kind = 'soil'; delete (c as { deposit?: unknown }).deposit; delete (c as { feature?: unknown }).feature; }
    let at = -1;
    for (let c = 0; c < u.cells.length && at < 0; c++) if (s.canBuildOrgan('forge', c, 0)) at = c;
    expect(at).toBeGreaterThanOrEqual(0);
    expect(s.issue({ kind: 'build-organ', organ: 'forge', cell: at, rot: 0 }).ok).toBe(true);
    const forge = s.organs.find((o) => o.organ === 'forge')!;
    const free = forge.cells.flatMap((c) => neighbours4(u, c)).find((n) => u.cells[n].kind === 'soil')!;
    expect(free).toBeDefined();
    Object.assign(u.cells[free], { kind: 'feature', feature: 'sewer' });
    (s as unknown as { organCache: unknown }).organCache = null;
    const e = s.organEffects().get('forge')!;
    expect(e.base).toBe(1);
    expect(e.level).toBeGreaterThanOrEqual(2);
    expect(e.why.join(' ')).toMatch(/Sewer Main/);
    expect(liftText(e.why)).toBe(`+${e.level - e.base} from the Sewer Main`);
  });
  it('the same feature touched on two sides is said once, summed', () => {
    expect(liftText(['+1 from the Sewer Main', '+1 from the Sewer Main', '+1 from a heart'])).toBe('+2 from the Sewer Main and +1 from a heart');
  });
});
