/**
 * Evolutions (three stages, A or B each — Tower Dominion style) and the
 * DOUBLING RULE: a second copy of any bonus must change something.
 */
import { describe, expect, it } from 'vitest';
import { Sim, towerSpec, towerStats, upgradeOptions } from '../src/sim/sim';
import type { Enemy, Tower, TowerFamily, UpgradeChoice } from '../src/sim/types';
import { BALANCE as B, TOWERS } from '../content/data';
import { UPGRADES, UPGRADE_COST } from '../content/upgrades';

const CFG = { gridW: 50, gridH: 40, cellPx: 26 };
const fresh = (seed = 2000) => new Sim({ ...CFG, seed });
const mk = (s: Sim, id: number, family: TowerFamily, x: number, y: number, pips: Tower['pips'] = [], upgrades: UpgradeChoice[] = []): Tower => ({
  id, family, pos: { x, y }, cell: s.cellAt(x, y), hp: 100, maxHp: 100, pips, cooldown: 1e9, kills: 0, upgrades,
});
type Priv = {
  spawnEnemy(kind: string, atGate?: number): Enemy;
  budMitosis(): void;
  killEnemy(id: number, yieldMult: number, eaten: boolean, srcId?: number): void;
  removeTower(id: number, emit: boolean): void;
};
const FAMILIES = TOWERS.map((t) => t.family);

describe('evolutions: three stages, choose A or B', () => {
  it('stage prices: 1 and 2 are all science, 3 is science + one royal point; no fourth stage', () => {
    expect(UPGRADE_COST[0]).toEqual({ science: 10 });
    expect(UPGRADE_COST[1]).toEqual({ science: 20 });
    expect(UPGRADE_COST[2]).toEqual({ science: 30, royal: 1 });
    const s = fresh();
    const gun = mk(s, 1, 'spitter', 400, 300);
    s.towers.push(gun);
    s.meat.science = 60; s.meat.royal = 0;
    expect(s.issue({ kind: 'evolve', towerId: gun.id, choice: 'A' }).ok).toBe(true);
    expect(s.issue({ kind: 'evolve', towerId: gun.id, choice: 'B' }).ok).toBe(true);
    expect(s.meat.science).toBe(30);
    expect(s.issue({ kind: 'evolve', towerId: gun.id, choice: 'A' }).err).toBe('cannot afford'); // no royal point
    s.meat.royal = 1;
    expect(s.issue({ kind: 'evolve', towerId: gun.id, choice: 'A' }).ok).toBe(true);
    expect(s.meat.royal).toBe(0);
    expect(gun.upgrades).toEqual(['A', 'B', 'A']);
    s.meat.science = 999; s.meat.royal = 9;
    expect(s.issue({ kind: 'evolve', towerId: gun.id, choice: 'A' }).err).toBe('fully evolved');
  });

  it('every family has a full tree, and EVERY option changes its limb (or pushes verbs into its target)', () => {
    for (const fam of FAMILIES) {
      const tree = UPGRADES[fam];
      expect(tree, fam).toBeDefined();
      for (const prefix of [[], ['A'], ['B'], ['A', 'A'], ['B', 'B']] as UpgradeChoice[][]) {
        const stage = prefix.length;
        const s = fresh();
        const before = JSON.stringify(towerStats(mk(s, 1, fam, 400, 300, [], prefix)));
        for (const c of ['A', 'B'] as UpgradeChoice[]) {
          const t = mk(s, 1, fam, 400, 300, [], [...prefix, c]);
          const opt = upgradeOptions(t)[stage];
          const changed = JSON.stringify(towerStats(t)) !== before || (opt.targetPips?.length ?? 0) > 0;
          expect(changed, `${fam} ${prefix.join('')}${c} ${opt.name}`).toBe(true);
        }
      }
    }
  });

  it('the two options at a stage are different builds', () => {
    for (const fam of FAMILIES) {
      for (let i = 0; i < 3; i++) {
        const [a, b] = UPGRADES[fam][i];
        expect(a.name, fam).not.toBe(b.name);
      }
    }
  });

  it('Hydra Throat: an evolved spitter fires three gobs a shot', () => {
    const s = fresh(2001);
    const gun = mk(s, 1, 'spitter', 400, 300, [], ['A', 'A', 'A']);
    gun.cooldown = 0;
    s.towers.push(gun);
    const e = (s as unknown as Priv).spawnEnemy('elite', s.gates[0]);
    e.pos = { x: 440, y: 300 }; e.hp = 1e9;
    s.tick();
    expect(s.projectiles.filter((p) => p.fromFamily === 'spitter').length).toBe(3);
  });

  it('evolved verbs are the limb\'s own: amplified, broadcast by a choir, NOT banked when eaten', () => {
    const s = fresh(2002);
    const choir = mk(s, 1, 'choir', 400, 300, [], ['A', 'B']); // Chorus of Venom: +2 blight, broadcast
    const g = mk(s, 2, 'spitter', 430, 300);
    s.towers.push(choir, g);
    expect(s.statsOf(g).poisonDps).toBeGreaterThan(0);
    const eater = mk(s, 3, 'spitter', 700, 300, [], ['B', 'A']); // +2 mister
    s.towers.push(eater);
    s.pendingPips = [];
    s.issue({ kind: 'butcher', towerId: eater.id });
    expect(s.pendingPips.map((p) => p.family)).toEqual(['spitter']);
  });

  it('Round Up amplifier: a single bonus becomes two', () => {
    const s = fresh(2003);
    const target = mk(s, 1, 'spitter', 400, 300, [{ family: 'lasher' }]);
    const amp = mk(s, 2, 'amp', 300, 300, [], ['A', 'B']); amp.facing = 'E';
    s.towers.push(target, amp);
    expect(s.statsOf(target).damage).toBeCloseTo(towerSpec('spitter').damage * (1 + B.pipDamage * 2));
  });

  it('Gentle Tap: its target keeps working at half speed instead of stasis', () => {
    const s = fresh(2004);
    const gun = mk(s, 1, 'spitter', 400, 300);
    const tap = mk(s, 2, 'tap', 300, 300, [], ['B']); tap.facing = 'E';
    s.towers.push(gun, tap);
    expect(s.isTapped(gun)).toBe(false);
    expect(s.statsOf(gun).rate).toBeCloseTo(towerSpec('spitter').rate * 0.5);
  });

  it('Royal Press: every 12th pressed kill pays a royal point', () => {
    const s = fresh(2005);
    const gun = mk(s, 1, 'spitter', 400, 300);
    const press = mk(s, 2, 'press', 300, 300, [], ['A', 'A', 'B']); press.facing = 'E';
    s.towers.push(gun, press);
    const p = s as unknown as Priv;
    s.drops.length = 0;
    for (let i = 0; i < 12; i++) p.killEnemy(p.spawnEnemy('soldier', s.gates[0]).id, 1, false, gun.id);
    expect(s.drops.filter((d) => d.caste === 'royal').length).toBe(1);
    expect(s.drops.filter((d) => d.caste === 'science').length).toBe(12);
  });

  it('Phoenix reliquary: its limb is reborn with bonuses and evolutions, once per wave', () => {
    const s = fresh(2006);
    let cell = -1;
    for (let c = 0; c < s.map.cells.length && cell < 0; c++) if (s.canBuildTower(c)) cell = c;
    const pos = s.cellCenter(cell);
    const gun = mk(s, 1, 'spitter', pos.x, pos.y, [{ family: 'frond' }], ['A', 'A']);
    const rel = mk(s, 2, 'reliquary', pos.x - 60, pos.y, [], ['A', 'A', 'A']); rel.facing = 'E';
    s.towers.push(gun, rel);
    (s as unknown as Priv).removeTower(gun.id, true);
    const again = s.towers.find((t) => t.family === 'spitter');
    expect(again).toBeDefined();
    expect(again!.pips.map((x) => x.family)).toEqual(['frond']);
    expect(again!.upgrades).toEqual(['A', 'A']);
    (s as unknown as Priv).removeTower(again!.id, true);
    expect(s.towers.some((t) => t.family === 'spitter')).toBe(false); // once per wave
  });
});

describe('THE DOUBLING RULE: a second copy of any bonus always changes something', () => {
  // Bonuses whose second copy acts in the sim (not in the stat block): each has a
  // check that one copy and two copies behave differently.
  const SIM_LEVEL: Partial<Record<TowerFamily, (n: number) => number>> = {
    mitosis: (n) => {
      const s = fresh(2100);
      let cell = -1;
      for (let c = 0; c < s.map.cells.length && cell < 0; c++) if (s.canBuildTower(c)) cell = c;
      const pos = s.cellCenter(cell);
      const t = mk(s, 1, 'spitter', pos.x, pos.y, Array.from({ length: n }, () => ({ family: 'mitosis' as const })));
      s.towers.push(t);
      (s as unknown as Priv).budMitosis();
      return s.towers.length;
    },
    capacitor: (n) => {
      const s = fresh(2101);
      const t = mk(s, 1, 'spitter', 400, 300, Array.from({ length: n }, () => ({ family: 'capacitor' as const })));
      s.towers.push(t);
      return s.capacitorOf(t)!.charge;
    },
    boomerang: (n) => {
      const s = fresh(2102);
      const t = mk(s, 1, 'spitter', 400, 300, Array.from({ length: n }, () => ({ family: 'boomerang' as const })));
      t.cooldown = 0;
      s.towers.push(t);
      const e = (s as unknown as Priv).spawnEnemy('elite', s.gates[0]);
      e.pos = { x: 440, y: 300 }; e.hp = 1e9;
      s.tick();
      return s.projectiles[0]?.legsLeft ?? -1;
    },
    press: (n) => {
      const s = fresh(2103);
      const t = mk(s, 1, 'spitter', 400, 300, Array.from({ length: n }, () => ({ family: 'press' as const })));
      s.towers.push(t);
      const p = s as unknown as Priv;
      s.drops.length = 0;
      p.killEnemy(p.spawnEnemy('phalanx', s.gates[0]).id, 1, false, t.id);
      return s.drops[0].amount;
    },
    reliquary: (n) => {
      const s = fresh(2104);
      const t = mk(s, 1, 'spitter', 400, 300, [{ family: 'lasher' }, ...Array.from({ length: n }, () => ({ family: 'reliquary' as const }))]);
      s.towers.push(t);
      s.pendingPips = [];
      (s as unknown as Priv).removeTower(t.id, true);
      return s.pendingPips.length;
    },
  };
  // A Marrow Tap is never consumed, so its family bonus can never be carried.
  const UNOBTAINABLE = new Set<TowerFamily>(['tap']);

  for (const fam of FAMILIES) {
    if (UNOBTAINABLE.has(fam)) continue;
    it(`${fam} x2 differs from ${fam} x1`, () => {
      const sim = SIM_LEVEL[fam];
      if (sim) {
        expect(sim(2)).not.toEqual(sim(1));
        return;
      }
      const read = (n: number) => {
        const s = fresh(2200);
        // A host with a 2-stack (so amplification has something to multiply) and
        // two neighbours (so conduit and mosaic pips have something to draw).
        const host = mk(s, 1, 'spitter', 400, 300, [{ family: 'lasher' }, { family: 'lasher' },
          ...Array.from({ length: n }, () => ({ family: fam }))]);
        s.towers.push(host, mk(s, 2, 'tangler', 430, 300), mk(s, 3, 'blighter', 370, 300));
        // Interest rises with every pip of any kind — that alone is not the bonus doing something.
        const { interest: _ignored, ...st } = s.statsOf(host);
        return JSON.stringify(st);
      };
      expect(read(2)).not.toBe(read(1));
    });
  }

  it('brood past full GROWS the limb (a third brood pip is not wasted)', () => {
    const s = fresh(2300);
    const t = mk(s, 1, 'spitter', 400, 300, [{ family: 'brood' }, { family: 'brood' }, { family: 'brood' }]);
    s.towers.push(t);
    t.maxHp = s.statsOf(t).maxHp;
    t.hp = t.maxHp;
    const before = t.maxHp;
    // Clear a wave the quick way: the wave-clear heal runs at the end of a siege.
    const priv = s as unknown as { phase: string; waveNumber: number; enemies: Enemy[]; spawnQueue: unknown[] };
    priv.phase = 'siege';
    priv.enemies.length = 0;
    priv.spawnQueue.length = 0;
    for (let i = 0; i < 20 && priv.phase === 'siege'; i++) s.tick();
    expect(t.maxHp).toBeGreaterThan(before);
  });
});
