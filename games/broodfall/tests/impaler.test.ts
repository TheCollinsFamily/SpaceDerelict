/**
 * THE IMPALER FIRES DOWN ITS RAIL (Nov 22 2026, Collins: "the impaler should be more directional in its shot given
 * its design"). It is a harpoon rail lying along three cells (DESIGN.md: "pierces a file"; notes/FOOTPRINT-PLAN.md:
 * "a three-cell rail laid down a street skewers the column end to end"): it fires only off either END of its length,
 * within TowerSpec.lineOfFire of its axis (Sim.inLineOfFire), never out of its side.
 */
import { describe, expect, it } from 'vitest';
import { Sim, towerSpec } from '../src/sim/sim';
import { Autoplayer } from '../src/sim/autoplayer';
import type { RootDir, SimConfig } from '../src/sim/types';

const CFG: SimConfig = { gridW: 50, gridH: 40, cellPx: 26, seed: 1234, organStage: true };

function grown(): Sim {
  const s = new Sim(CFG);
  for (let i = 0; i < 600; i++) s.tick();
  s.meat.war = 9999;
  return s;
}

/** An Impaler built lying `facing`'s way (its rail along that axis). */
function impaler(s: Sim, facing: RootDir) {
  for (let c = 0; c < s.map.cells.length; c++) {
    if (!s.groundFor(c, 'impaler', facing)) continue;
    s.hand.push({ id: 710000 + c, family: 'impaler', free: true });
    if (!s.issue({ kind: 'build', cardIndex: s.hand.length - 1, cell: c, facing }).ok) continue;
    return s.towers[s.towers.length - 1];
  }
  throw new Error('no ground for an impaler');
}

/** Does it loose a harpoon at one soldier, held `deg` degrees round from east and 120 px out? */
function firesAt(s: Sim, t: ReturnType<typeof impaler>, deg: number): boolean {
  s.enemies.length = 0;
  s.projectiles.length = 0;
  t.cooldown = 0;
  t.lastTargetId = undefined;
  const e = s.spawnEnemy('soldier', s.gates[0]);
  const a = (deg * Math.PI) / 180;
  const at = { x: t.pos.x + Math.cos(a) * 120, y: t.pos.y + Math.sin(a) * 120 };
  e.revealedUntil = s.time + 999;
  for (let i = 0; i < 3; i++) {
    e.pos.x = at.x; e.pos.y = at.y;
    s.tick();
    if (s.projectiles.some((p) => p.fromFamily === 'impaler')) return true;
  }
  return false;
}

describe('the Impaler: a line of fire down its rail', () => {
  it('has one, narrower than a half-turn each way', () => {
    const half = towerSpec('impaler').lineOfFire!;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(Math.PI / 2);
    expect(towerSpec('spitter').lineOfFire).toBeUndefined();
  });

  it('Sim.inLineOfFire: off either end within its half-angle, never out of its side', () => {
    const s = grown();
    const half = towerSpec('impaler').lineOfFire!;
    for (const facing of ['N', 'E', 'S', 'W'] as const) {
      const f = Sim.facingVec(facing);
      const t = { family: 'impaler' as const, facing, pos: { x: 500, y: 500 } };
      const at = (rad: number) => ({ x: 500 + Math.cos(rad) * 100, y: 500 + Math.sin(rad) * 100 });
      const axis = Math.atan2(f.y, f.x);
      expect(s.inLineOfFire(t, at(axis)), `${facing}: ahead`).toBe(true);
      expect(s.inLineOfFire(t, at(axis + Math.PI)), `${facing}: behind (it turns end for end)`).toBe(true);
      expect(s.inLineOfFire(t, at(axis + half * 0.8)), `${facing}: just inside`).toBe(true);
      expect(s.inLineOfFire(t, at(axis + Math.PI - half * 0.8)), `${facing}: just inside, behind`).toBe(true);
      expect(s.inLineOfFire(t, at(axis + half * 1.2)), `${facing}: just outside`).toBe(false);
      expect(s.inLineOfFire(t, at(axis + Math.PI / 2)), `${facing}: its side`).toBe(false);
      expect(s.inLineOfFire(t, at(axis - Math.PI / 2)), `${facing}: its other side`).toBe(false);
    }
    // A limb without one fires all round.
    expect(s.inLineOfFire({ family: 'spitter', facing: 'S', pos: { x: 0, y: 0 } }, { x: 100, y: 0 })).toBe(true);
  });

  it('in play: a rail lying north-south fires north and south, not east or west; lying east-west, the other way', () => {
    const s = grown();
    const ns = impaler(s, 'S');
    expect(firesAt(s, ns, 90), 'N-S rail, soldier south').toBe(true);
    expect(firesAt(s, ns, 270), 'N-S rail, soldier north').toBe(true);
    expect(firesAt(s, ns, 0), 'N-S rail, soldier east').toBe(false);
    expect(firesAt(s, ns, 180), 'N-S rail, soldier west').toBe(false);
    expect(firesAt(s, ns, 45), 'N-S rail, soldier south-east').toBe(false);

    const s2 = grown();
    const ew = impaler(s2, 'E');
    expect(firesAt(s2, ew, 0), 'E-W rail, soldier east').toBe(true);
    expect(firesAt(s2, ew, 180), 'E-W rail, soldier west').toBe(true);
    expect(firesAt(s2, ew, 90), 'E-W rail, soldier south').toBe(false);
    expect(firesAt(s2, ew, 270), 'E-W rail, soldier north').toBe(false);
  });

  it('the scripted player lays it along the streets it can rake', () => {
    const s = grown();
    const bot = new Autoplayer(5) as unknown as { railFacing(sim: Sim, f: 'impaler', c: number): RootDir | undefined };
    let tried = 0;
    for (let c = 0; c < s.map.cells.length && tried < 6; c++) {
      if (!s.groundFor(c, 'impaler', 'S') && !s.groundFor(c, 'impaler', 'E')) continue;
      const dir = bot.railFacing(s, 'impaler', c);
      expect(dir, `cell ${c}`).toBeDefined();
      expect(s.groundFor(c, 'impaler', dir!), `cell ${c}: it fits that way`).not.toBeNull();
      tried++;
    }
    expect(tried).toBeGreaterThan(0);
  });
});
