/**
 * THE RUMEN, the chyme-making organ (Collins, Nov 22 2026: "oh I like the idea of a chyme generating organ think through
 * its agency bonus etc."). DESIGN.md "THE RUMEN". What these hold:
 *  - FEED: only bodies killed by limbs of the themes it touches (edge, root chain, the meteor) render its +1; a Pheromone
 *    Gland's zone adds +1 a body;
 *  - FERMENT: +1 per 10 chyme KEPT at a clear, capped at 3 x its level; a heart zone raises its level;
 *  - the bound: over a whole run it never makes more than (bodies its limbs killed x its per-body) + (clears x its cap);
 *  - the tally names its share; an old-economy run has no Rumen effect.
 */
import { describe, expect, it } from 'vitest';
import { DT, Sim } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';
import { RUMEN_POLICY } from '../src/sim/organPolicy';
import { RUMEN_FEED_CAP, RUMEN_FERMENT_CAP, RUMEN_PER_BODY } from '../content/underground';
import type { Enemy, OrganId, SimConfig, Tower, TowerFamily } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 5150, organStage: true };
type Priv = { spawnEnemy(kind: string): Enemy; killEnemy(id: number, y: number, eaten: boolean, src?: number): void; enemies: Enemy[]; spawnQueue: unknown[] };
const priv = (s: Sim) => s as unknown as Priv;

function grow(s: Sim, organ: OrganId, pick?: (cells: number[]) => boolean): void {
  for (let c = 0; c < s.under.cells.length; c++) for (let r = 0; r < 4; r++) {
    if (!s.canBuildOrgan(organ, c, r)) continue;
    if (pick && !pick(s.organFootprint(organ, c, r)!)) continue;
    expect(s.issue({ kind: 'build-organ', organ, cell: c, rot: r }).ok).toBe(true);
    return;
  }
  throw new Error(`no spot for ${organ}`);
}
let towerId = 90000;
function limb(s: Sim, family: TowerFamily): Tower {
  const t = { id: towerId++, family, pos: { x: 300, y: 300 }, cell: s.cellAt(300, 300), hp: 50, maxHp: 50, pips: [], cooldown: 9, kills: 0 } as Tower;
  s.towers.push(t);
  return t;
}
function killBy(s: Sim, t: Tower, kind = 'soldier') {
  const e = priv(s).spawnEnemy(kind);
  priv(s).killEnemy(e.id, 1, false, t.id);
  return s.corpses[s.corpses.length - 1];
}

describe('the Rumen FEEDS on what the limbs of the themes it touches kill', () => {
  it('touching the meteor: a Spitter\'s kill renders +1 more; a Bone Forge limb\'s kill does not (the forge is not touched)', () => {
    const s = new Sim(CFG);
    s.chyme = 9999;
    grow(s, 'rumen');
    grow(s, 'forge', (cells) => !s.rumenFor(s.organs[0].cells).feeds.includes('forge') && !cells.some((c) => s.organs[0].cells.some((r) => Math.abs((r % 13) - (c % 13)) + Math.abs(Math.floor(r / 13) - Math.floor(c / 13)) === 1)));
    const r = s.rumen()!;
    expect(r.feeds).toContain('core');
    expect(r.feeds).not.toContain('forge');
    expect(killBy(s, limb(s, 'spitter')).rumen).toBe(RUMEN_PER_BODY);
    expect(killBy(s, limb(s, 'impaler')).rumen).toBeUndefined();
  });

  it('a Pheromone Gland whose zone holds the Rumen: +1 a body more', () => {
    const s = new Sim(CFG);
    s.chyme = 9999;
    grow(s, 'rumen');
    const before = s.rumen()!.perBody;
    grow(s, 'gland', (cells) => { const z = new Set<number>(); for (const c of cells) for (const d of [-14, -13, -12, -1, 1, 12, 13, 14]) z.add(c + d); return s.organs[0].cells.some((c) => z.has(c)); });
    expect(s.rumen()!.perBody).toBe(before + 1);
  });
});

describe('the Rumen holds only so much a wave', () => {
  it('its feed stops at RUMEN_FEED_CAP x its level in one wave, and starts again the next', () => {
    const s = new Sim(CFG);
    s.chyme = 9999;
    grow(s, 'rumen');
    const cap = RUMEN_FEED_CAP * s.rumen()!.level;
    const sp = limb(s, 'spitter');
    let fed = 0;
    for (let k = 0; k < cap + 5; k++) fed += killBy(s, sp).rumen ?? 0;
    expect(fed).toBe(cap);
    s.issue({ kind: 'call-early' }); // a new wave
    expect(killBy(s, sp).rumen).toBe(RUMEN_PER_BODY);
  });
});

describe('the Rumen FERMENTS what you keep', () => {
  it('+1 per 10 banked, capped at 3 x its level; an Auxiliary Heart zone raises its level (and its cap)', () => {
    const s = new Sim(CFG);
    s.chyme = 9999;
    expect(s.rumenFerment(500)).toBe(0); // none grown
    grow(s, 'rumen');
    const lv = s.rumen()!.level;
    expect(s.rumenFerment(19)).toBe(1);
    expect(s.rumenFerment(10000)).toBe(RUMEN_FERMENT_CAP * lv);
    grow(s, 'heart', (cells) => { const z = new Set<number>(); for (const c of cells) for (const d of [-14, -13, -12, -1, 1, 12, 13, 14]) z.add(c + d); return s.organs[0].cells.some((c) => z.has(c)); });
    expect(s.rumen()!.level).toBe(lv + 1);
    expect(s.rumenFerment(10000)).toBe(RUMEN_FERMENT_CAP * (lv + 1));
  });

  it('the clear pays the ferment on what was kept, and the tally names the Rumen\'s share', () => {
    const s = new Sim(CFG);
    s.chyme = 1000;
    grow(s, 'rumen');
    s.chyme = 40; // kept through the wave
    s.issue({ kind: 'call-early' });
    priv(s).enemies.length = 0; priv(s).spawnQueue.length = 0;
    s.takeEvents();
    for (let i = 0; i < 60 && s.phase === 'siege'; i++) s.tick();
    const t = s.takeEvents().find((e) => e.kind === 'chyme-tally');
    if (t?.kind !== 'chyme-tally') throw new Error('no tally');
    expect(t.rumen).toBe(Math.min(4, RUMEN_FERMENT_CAP * s.rumen()!.level));
    expect(t.earned).toBe(t.digested + (t.rumen ?? 0) + t.ration);
  });

  it('a run saved before chyme has no Rumen effect', () => {
    const s = new Sim({ ...CFG, organEconomy: 'meat' });
    s.meat.war = 999;
    grow(s, 'rumen');
    expect(s.rumen()).toBeNull();
    expect(killBy(s, limb(s, 'spitter')).rumen).toBeUndefined();
  });
});

describe('the bound: the Rumen cannot run away', () => {
  it('over a whole run it makes at most (bodies its themes\' limbs killed x per body) + (clears x its cap), and its caps', () => {
    RUMEN_POLICY.when = 'mid';
    const s = new Sim({ ...CFG, seed: 3, directive: { kind: 'hold', waves: 8 } });
    const bot = new Autoplayer(4);
    for (let i = 0; i < 20000 && s.outcome === 'playing'; i++) { bot.act(s, DT); s.tick(); s.takeEvents(); }
    const r = s.rumen();
    expect(r).not.toBeNull();
    const kills = Object.values(s.stats.kills).reduce((a, b) => a + b, 0);
    expect(s.rumenEarned).toBeGreaterThan(0);
    expect(s.rumenEarned).toBeLessThanOrEqual(kills * r!.perBody + s.wavesCleared * r!.fermentCap);
    // ...and by its caps: (waves x feed cap) + (clears x ferment cap).
    expect(s.rumenEarned).toBeLessThanOrEqual(s.waveNumber * r!.feedCap + s.wavesCleared * r!.fermentCap);
  }, 120000);
});
