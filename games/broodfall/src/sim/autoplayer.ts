/**
 * Scripted autoplayer: drives a Sim with a chokepoint-aware policy. Used by the
 * headless full-run tests and the browser demo mode (?auto=1). Deterministic.
 */
import { Rng } from './rng';
import { Sim, enemySpec, towerSpec } from './sim';
import { isMultiCell } from './footprint';
import { UPGRADE_COST } from '../../content/upgrades';
import { bestOrganSpot, organTurn, placeNode, placePlinth } from './organPolicy';
import { ORGAN_BY_ID } from '../../content/underground';
import { CellType } from './citymap';
import { BALANCE as B } from '../../content/data';
import type { Tower, TowerFamily, UpgradeChoice } from './types';

const isPassableCell = (sim: Sim, c: number): boolean => sim.map.cells[c] === CellType.Road || sim.map.cells[c] === CellType.Plaza;

export class Autoplayer {
  private rng: Rng;
  private actTimer = 0;
  private buildsSinceCannibalize = 0;
  private builds = 0;
  /**
   * THE BROODMOTHER STACK (Collins, Oct 1 2026: "keep enemies away from some region of the map, build up
   * a Broodmother there and accumulate soldiers"): off by default (the naive player never commands its
   * units). On: she is walked to the quietest street near the body and parked brooding; once her stack is
   * full, a siege that reaches the body is met by the whole stack, which then goes back to her side.
   */
  stack = false;
  /**
   * SPORE MULES (Collins, Oct 2 2026): off by default (the naive player stays comparable). On: it grows one Mule
   * Sac once it has two themes, and walks each mule to where creep pays most: under a Broodmother parked off the
   * creep (so she can brood), else the heaviest pile of bodies lying past the creep, else the street just past the
   * creep's edge nearest the hive's lanes. It roots the mule when it gets there.
   */
  mules = false;
  /**
   * EXPANSION (Collins, Oct 2 2026): off by default. On: it drafts the district with a SHELTER when one is offered,
   * grows an Infestor Cyst (after three themes) and walks each Infestor to the nearest intact shelter, a Harrier
   * Gland after two (its Harriers hunt the science caste by themselves), and sends its Broodmothers, if it has any, to
   * stand beside an infested shelter.
   */
  expansion = false;
  /**
   * ROSTER ONLY (Collins, Oct 2 2026: "keeping RTS very, very low"): off by default. On: the player never selects a
   * unit; a stack is released with ONE group order (ALL, at the siege's head: a sortie, so they come home by
   * themselves) and alerts are left to the kinds set to AUTO. The clicks field counts what a person would click either way:
   * selecting units and ordering them (2 per individual order), a group order (2: the portrait, the board), a SEND (1).
   */
  roster = false;
  clicks = 0;
  private muleGoal = new Map<number, number>();
  private parked = new Set<number>();
  private released = false;

  constructor(seed: number) {
    this.rng = new Rng(seed);
  }

  /** The quietest street near the body: as far from the hive's marching lanes as it can be, within reach of the core. */
  private quietStreet(sim: Sim): { x: number; y: number } | null {
    const lanes = [...this.lanePathCells(sim).keys()].map((c) => sim.cellCenter(c));
    const core = sim.core;
    let best: { x: number; y: number } | null = null;
    let bestScore = -Infinity;
    for (let c = 0; c < sim.map.cells.length; c++) {
      if (sim.map.cells[c] !== CellType.Road && sim.map.cells[c] !== CellType.Plaza) continue;
      const p = sim.cellCenter(c);
      const fromCore = Math.hypot(p.x - core.x, p.y - core.y);
      if (fromCore > 8 * sim.cfg.cellPx) continue;
      let near = Infinity;
      for (const l of lanes) near = Math.min(near, Math.hypot(p.x - l.x, p.y - l.y));
      const score = Math.min(near, 6 * sim.cfg.cellPx) - fromCore * 0.25;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best;
  }

  /** Where a Spore Mule should root (a cell), or null: see `mules`. */
  // (isPassableCell: a street or square the mule can stand on.)
  private muleTarget(sim: Sim): number | null {
    const W = sim.cfg.gridW;
    const core = sim.map.coreCell;
    const md = (a: number, b: number) => Math.abs((a % W) - (b % W)) + Math.abs(Math.floor(a / W) - Math.floor(b / W));
    const taken = new Set(this.muleGoal.values());
    const free = (c: number) => !taken.has(c) && sim.map.cells[c] !== CellType.Void && md(c, core) <= 16;
    // A Broodmother parked off the creep: creep under her lets her brood.
    for (const m of sim.mothers) {
      const c = sim.cellAt(m.pos.x, m.pos.y);
      if (!sim.isCreeped(c) && free(c)) return c;
    }
    // The heaviest pile of bodies past the creep.
    const piles = new Map<number, number>();
    for (const b of sim.corpses) {
      if (sim.isCreeped(b.cell)) continue;
      const meat = (b.meat.war ?? 0) + 2 * (b.meat.science ?? 0) + 4 * (b.meat.royal ?? 0);
      piles.set(b.cell, (piles.get(b.cell) ?? 0) + meat);
    }
    let best: number | null = null;
    let bestMeat = 0;
    for (const [c, meat] of piles) {
      const street = sim.nearestStreet(c);
      const sc = street ? sim.cellAt(street.x, street.y) : c;
      if (meat > bestMeat && free(sc)) { bestMeat = meat; best = sc; }
    }
    if (best !== null) return best;
    // The street just past the creep's edge, nearest the hive's lanes.
    const lanes = this.lanePathCells(sim);
    let edge: number | null = null;
    let edgeScore = -Infinity;
    for (let c = 0; c < sim.map.cells.length; c++) {
      if (sim.map.cells[c] !== CellType.Road || sim.isCreeped(c) || !free(c)) continue;
      const nbs = [c - 1, c + 1, c - W, c + W].filter((n) => n >= 0 && n < sim.map.cells.length);
      if (!nbs.some((n) => sim.isCreeped(n))) continue;
      const score = (lanes.get(c) ?? 0) * 3 - md(c, core) * 0.2;
      if (score > edgeScore) { edgeScore = score; edge = c; }
    }
    if (edge !== null) return edge;
    // Every street held already: the street with the most bare claimed ground round it (new roof for limbs).
    const R = 3;
    let open: number | null = null;
    let openBare = 2; // not worth a mule for less
    for (let c = 0; c < sim.map.cells.length; c++) {
      if (!isPassableCell(sim, c) || !free(c)) continue;
      let bare = 0;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const x = (c % W) + dx;
          const y = Math.floor(c / W) + dy;
          if (x < 0 || y < 0 || x >= W || y >= sim.cfg.gridH || Math.abs(dx) + Math.abs(dy) > R) continue;
          const n = y * W + x;
          if (sim.map.cells[n] === CellType.Block && !sim.isCreeped(n)) bare++;
        }
      }
      if (bare > openBare) { openBare = bare; open = c; }
    }
    return open;
  }

  /** EXPANSION: grow the Harrier Gland and the Infestor Cyst (once each), send Infestors to shelters. */
  private manageExpansion(sim: Sim): boolean {
    if (sim.cfg.organStage && sim.phase === 'growth') {
      const themes = sim.organs.filter((o) => ORGAN_BY_ID[o.organ].kind === 'theme').length;
      // The cyst only once a shelter stands to be taken (an Infestor with nowhere to go is 110 war wasted).
      const shelterWaiting = sim.shelters.some((sh) => sh.state === 'intact');
      for (const [organ, at] of [['harrier', 3], ['infestor', 2]] as const) {
        if (organ === 'infestor' && !shelterWaiting) continue;
        if (themes < at || sim.organs.some((o) => o.organ === organ) || !sim.canAfford(ORGAN_BY_ID[organ].cost)) continue;
        const spot = bestOrganSpot(sim, organ);
        if (spot && sim.issue({ kind: 'build-organ', organ, ...spot }).ok) return true;
      }
    }
    for (const u of sim.infestors) {
      if (u.infest !== undefined) continue;
      let best: { id: number; d: number } | null = null;
      for (const sh of sim.shelters) {
        if (sh.state !== 'intact') continue;
        const door = sim.cellCenter(sh.door);
        const d = Math.hypot(door.x - u.pos.x, door.y - u.pos.y);
        if (!best || d < best.d) best = { id: sh.id, d };
      }
      if (best) this.click(2) && sim.issue({ kind: 'infest', unitId: u.id, shelterId: best.id });
    }
    return false;
  }

  /** Grow a Mule Sac (once), and walk each mule to its spot, rooting it there. */
  private manageMules(sim: Sim): boolean {
    if (sim.cfg.organStage && sim.phase === 'growth' && !sim.organs.some((o) => o.organ === 'mule')) {
      const themes = sim.organs.filter((o) => ORGAN_BY_ID[o.organ].kind === 'theme').length;
      // After the fourth theme, like the free-thing organs: bought at two themes it starved the guns (measured 4/10).
      if (themes >= 4 && sim.canAfford(ORGAN_BY_ID.mule.cost)) {
        const spot = bestOrganSpot(sim, 'mule');
        if (spot && sim.issue({ kind: 'build-organ', organ: 'mule', ...spot }).ok) return true;
      }
    }
    for (const id of [...this.muleGoal.keys()]) if (!sim.mules.some((m) => m.id === id)) this.muleGoal.delete(id);
    for (const m of sim.mules) {
      const goal = this.muleGoal.get(m.id);
      if (goal === undefined) {
        const target = this.muleTarget(sim);
        if (target === null) continue;
        this.muleGoal.set(m.id, target);
        this.click(2) && sim.issue({ kind: 'unit-order', ids: [m.id], order: { kind: 'move', to: sim.cellCenter(target) } });
        continue;
      }
      if (m.orders.length === 0) this.click(2) && sim.issue({ kind: 'mule-deploy', muleId: m.id });
    }
    return false;
  }

  /** The strike force currently sent at a science station (its target id), if any. */
  private striking: number | null = null;

  /**
   * SCIENCE FORWARD BASES (Oct 2 2026): mount an attack. When a field station or an engineer stands and you have a
   * strike force (B.strikeForce or more walking units not parked brooding), send them at it (attack-move: they fight
   * what they meet on the way); when it is gone, call them back to guard. A station still being built is the cheapest
   * to take, so it goes first; then the youngest standing station.
   */
  private strikeStations(sim: Sim): void {
    const targets = sim.enemies
      .filter((e) => e.kind === 'fieldstation' || (e.kind === 'engineer' && e.engState !== 'flee'))
      .sort((a, b) => ((a.buildProgress ?? 1) - (b.buildProgress ?? 1)) || ((a.stationAge ?? 0) - (b.stationAge ?? 0)));
    const units = [...sim.broodlings.filter((b) => !b.puppet).map((b) => b.id), ...sim.harriers.map((h) => h.id)];
    const target = targets[0];
    if (!target) {
      if (this.striking !== null && units.length) sim.issue({ kind: 'unit-order', ids: units, order: { kind: 'guard' } });
      this.striking = null;
      return;
    }
    if (units.length < B.strikeForce) return;
    if (this.striking === target.id) return;
    sim.issue({ kind: 'unit-order', ids: units, order: { kind: 'attack', to: { ...target.pos } } });
    this.striking = target.id;
  }

  /** The stack: park, brood, release into a siege at the body, call back. */
  private manageStack(sim: Sim): void {
    for (const m of sim.mothers) {
      if (this.parked.has(m.id)) continue;
      const spot = this.quietStreet(sim);
      if (spot) this.click(2) && sim.issue({ kind: 'unit-order', ids: [m.id], order: { kind: 'move', to: spot } });
      this.click(2) && sim.issue({ kind: 'mother-mode', motherId: m.id, mode: 'brood' });
      this.parked.add(m.id);
    }
    const stackIds = sim.broodlings.filter((b) => b.motherUnit !== undefined).map((b) => b.id);
    const core = sim.core;
    // A full stack meets the siege at its head (the hive body nearest the core that it fights: ground, not science);
    // a stack still brooding only answers a siege that has come within 12 cells of the body.
    const full = sim.mothers.some((m) => sim.broodlings.filter((b) => b.motherUnit === m.id).length >= sim.motherBroodCap(m));
    const reach = full || this.released ? Infinity : 12 * sim.cfg.cellPx;
    const threat = sim.enemies
      .filter((e) => !e.burrowed && !sim.isAirborne(e) && enemySpec(e.kind).caste !== 'science'
        && Math.hypot(e.pos.x - core.x, e.pos.y - core.y) < reach)
      .sort((a, b) => Math.hypot(a.pos.x - core.x, a.pos.y - core.y) - Math.hypot(b.pos.x - core.x, b.pos.y - core.y))[0];
    if (this.roster) {
      // One group order at the siege's head when the stack is full: a sortie (they come home once it is quiet).
      if (threat && full && !this.released && stackIds.length > 0) {
        this.click(2);
        sim.issue({ kind: 'group-order', who: 'all', at: { ...threat.pos } });
        this.released = true;
      } else if (!threat) this.released = false;
      return;
    }
    if (threat && (full || this.released) && stackIds.length > 0) {
      this.click(2) && sim.issue({ kind: 'unit-order', ids: stackIds, order: { kind: 'attack', to: { ...threat.pos } } });
      this.released = true;
    } else if (!threat && this.released) {
      this.click(2) && sim.issue({ kind: 'unit-order', ids: stackIds, order: { kind: 'guard' } });
      this.released = false;
    }
  }

  /** A click a person would make (counted for the low-micro measure); always true, so it chains before a command. */
  private click(n: number): boolean {
    this.clicks += n;
    return true;
  }

  act(sim: Sim, dt: number): void {
    if (sim.outcome !== 'playing') return;
    // District draft: take the first offer (policies stay comparable).
    if (sim.phase === 'draft') {
      const withShelter = this.expansion ? (sim.pendingDraft ?? []).findIndex((o) => o.shelter) : -1;
      sim.issue({ kind: 'choose-plate', index: withShelter >= 0 ? withShelter : 0 });
      return;
    }
    this.actTimer -= dt;
    if (this.actTimer > 0) return;
    this.actTimer = 1.5;
    this.strikeStations(sim);
    if (this.stack) this.manageStack(sim);
    if (this.mules && this.manageMules(sim)) return;
    if (this.expansion && this.manageExpansion(sim)) return;

    // Science buys evolutions for the limbs doing the killing; royal points go to
    // a third stage first, and only spare points to a surge.
    if (this.tryEvolve(sim)) return;
    if (sim.meat.royal >= 1 + (this.stage3Ready(sim) ? 1 : 0)) this.spendRoyal(sim);

    // The organ stage (between waves): unlock themes, then spend what the wave would clear.
    if (sim.cfg.organStage && organTurn(sim)) return;
    if (placeNode(sim)) return;
    if (placePlinth(sim)) return;

    // Sling technique: hurl creep toward the telegraphed approach, so forward
    // ground near the incoming lane becomes buildable before the body arrives.
    const sling = sim.towers.find((t) => t.family === 'sling');
    if (sling && sling.cooldown <= 0 && sim.incomingGates.length > 0) {
      const g = sim.cellCenter(sim.incomingGates[0]);
      const dx = g.x - sling.pos.x;
      const dy = g.y - sling.pos.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = Math.min(1, (B.slingRange * 0.9) / d);
      const cell = sim.cellAt(sling.pos.x + dx * f, sling.pos.y + dy * f);
      sim.issue({ kind: 'sling-throw', towerId: sling.id, cell });
    }

    // Aimed bile volley: dump it on the hostile closest to home once a wave is thick.
    const lobber = sim.towers.find((t) => t.family === 'lobber');
    if (lobber && lobber.cooldown <= 0 && sim.enemies.length >= 4) {
      let aim: { x: number; y: number } | null = null;
      let bd = Infinity;
      const reach = sim.statsOf(lobber).range;
      for (const e of sim.enemies) {
        if (e.kind === 'researcher' || sim.isAirborne(e)) continue;
        const dc = Math.hypot(e.pos.x - sim.core.x, e.pos.y - sim.core.y);
        const dl = Math.hypot(e.pos.x - lobber.pos.x, e.pos.y - lobber.pos.y);
        if (dl <= reach && dc < bd) { bd = dc; aim = e.pos; }
      }
      if (aim) sim.issue({ kind: 'bile-throw', towerId: lobber.id, cell: sim.cellAt(aim.x, aim.y) });
    }

    // Bombard technique. COUNTER-BATTERY first: an emplaced siege cannon in
    // reach gets the marker (it outranges the guns — this is what answers it).
    // Otherwise the densest switchback on the telegraphed lanes, as far OUT as
    // reach allows, so the shelling starts early instead of at the front door.
    const bombards = sim.towers.filter((t) => t.family === 'bombard');
    if (bombards.length > 0) {
      const lane = this.lanePathCells(sim);
      for (const b of bombards) {
        const reach = sim.statsOf(b).range;
        const aoe = sim.statsOf(b).aoe;
        let best = -1;
        let bestKey = -Infinity;
        for (const e of sim.enemies) {
          if (!e.deployed || e.kind !== 'cannon') continue;
          const d = Math.hypot(e.pos.x - b.pos.x, e.pos.y - b.pos.y);
          if (d <= reach && -d > bestKey) { bestKey = -d; best = sim.cellAt(e.pos.x, e.pos.y); }
        }
        if (best < 0) {
          for (const [cell] of lane) {
            const p = sim.cellCenter(cell);
            if (Math.hypot(p.x - b.pos.x, p.y - b.pos.y) > reach) continue;
            let density = 0;
            for (const [other, n] of lane) {
              const q = sim.cellCenter(other);
              if (Math.hypot(q.x - p.x, q.y - p.y) <= aoe) density += n;
            }
            const key = density * 1000 + sim.flowDistOf(cell);
            if (key > bestKey) { bestKey = key; best = cell; }
          }
        }
        if (best >= 0 && b.marker !== best) sim.issue({ kind: 'set-marker', towerId: b.id, cell: best });
      }
    }

    // Technique: a spine card plugs the telegraphed lane itself; a pit card sits
    // IN that lane and digests the column that walks over it.
    for (const streetFamily of ['spine', 'swamp'] as const) {
      const idx = sim.hand.findIndex((c) => c.family === streetFamily);
      if (idx < 0 || !sim.canAfford(towerSpec(streetFamily).cost)) continue;
      const laneRoad = this.laneRoadCell(sim, streetFamily);
      if (laneRoad !== null) {
        if (sim.issue({ kind: 'build', cardIndex: idx, cell: laneRoad }).ok) {
          this.builds += 1;
          return;
        }
      }
    }

    // Build in hand order. Everything feeds the attraction economy (advanced
    // towers and pips raise interest, interest brings the science that pays for
    // the next advanced card) — an earlier damage-first "discipline" starved
    // science to 4 and lost runs it used to win. Measured, not vibes.
    const SURPLUS_CAP: Partial<Record<string, number>> = { sling: 1, lobber: 1 };
    const UNMEASURED_ENGINES = new Set<string>(['mitosis', 'capacitor', 'boomerang', 'press', 'reliquary']);

    const tryBuild = (i: number): boolean => {
      const fam = sim.hand[i].family;
      const spec = towerSpec(fam);
      const wantsBlocker = fam === 'spine';
      // High tiers bring tunnelers (surface INSIDE) and massed fliers: keep a
      // couple of guns on the body itself, not everything on the frontier.
      const interiorGuns = sim.towers.filter(
        (t) => towerSpec(t.family).rate > 0 && sim.creepDistOf(t.cell) >= 0 && sim.creepDistOf(t.cell) <= 5,
      ).length;
      const wantsInterior = !wantsBlocker && spec.rate > 0 && interiorGuns < 2
        && sim.threat >= B.tier6Threat - 60; // tunnelers imminent: cover the inside
      // A big limb is looked for where all of it fits.
      const cell = this.findTowerCell(sim, wantsBlocker, wantsInterior, isMultiCell(spec) ? fam : undefined);
      if (cell === null) return false;
      let cannibalizeTowerId: number | undefined;
      this.buildsSinceCannibalize += 1;
      if (this.buildsSinceCannibalize >= 4 && sim.towers.length > 7) {
        const donor = sim.towers.find((t) => t.family === 'spitter' || t.family === 'spine');
        if (donor) {
          cannibalizeTowerId = donor.id;
          this.buildsSinceCannibalize = 0;
        }
      }
      if (sim.issue({ kind: 'build', cardIndex: i, cell, cannibalizeTowerId }).ok) {
        this.builds += 1;
        return true;
      }
      return false;
    };

    const guns = sim.towers.filter((t) => {
      const sp = towerSpec(t.family);
      return sp.rate > 0 && sp.damage > 0 && !sp.markerFire;
    });
    for (let i = 0; i < sim.hand.length; i++) {
      const fam = sim.hand[i].family;
      if (!sim.canAfford(towerSpec(fam).cost)) continue;
      // Support limbs are placed by their OWN logic, never on a gun's perch:
      // the ward behind the guns it shields, the bombard deep in the body.
      const isEngine = !!towerSpec(fam).engine;
      // Engines whose payoff is not a static dps gain (buds, banked shots,
      // science, returns, relics) are human depth tools: the bot sheds them.
      if (UNMEASURED_ENGINES.has(fam)) {
        if (sim.meat.war >= B.discardCost + 10) { sim.issue({ kind: 'discard', cardIndex: i }); return; }
        continue;
      }
      if (fam === 'ward' || fam === 'bombard' || isEngine) {
        const have = sim.towers.filter((t) => t.family === fam).length;
        const cap = fam === 'ward' ? Math.floor(guns.length / 4)
          : isEngine ? Math.floor(guns.length / 3)
            : Math.min(2, Math.floor(guns.length / 5));
        let cell = have < cap
          ? (fam === 'bombard' ? this.bombardCell(sim) : this.wardCell(sim, guns))
          : null;
        // A combo engine is only worth its science if it actually multiplies
        // something from here: trial-place it, measure, build only on a real gain.
        let plan = isEngine && cell !== null ? this.engineGain(sim, fam, cell) : null;
        // Amplifiers go where the CARRY is: try spots around the limb the other
        // engines already feed and keep the best measured gain.
        if (fam === 'amp' && have < cap) {
          const best = this.ampSpot(sim);
          if (best && (!plan || best.gain > plan.gain)) { cell = best.cell; plan = best; }
        }
        const worthIt = !isEngine || (plan !== null && plan.gain >= 0.15);
        if (cell !== null && worthIt && sim.issue({
          kind: 'build', cardIndex: i, cell, facing: plan?.facing,
        }).ok) {
          this.builds += 1;
          return;
        }
        if (sim.meat.war >= B.discardCost + 10) {
          sim.issue({ kind: 'discard', cardIndex: i });
          return;
        }
        continue;
      }
      // A second sling or lobber sits idle — shed the surplus cheaply.
      const cap = SURPLUS_CAP[fam];
      if (cap !== undefined && sim.towers.filter((t) => t.family === fam).length >= cap) {
        if (sim.meat.war >= B.discardCost + 10) sim.issue({ kind: 'discard', cardIndex: i });
        return;
      }
      // A pit that found no lane road this act waits its turn rather than block the hand.
      if (fam === 'swamp') continue;
      // So does a big limb that fits nowhere yet: the cards behind it are played, and it is shed when meat allows.
      if (isMultiCell(towerSpec(fam)) && !this.fitsSomewhere(sim, fam)) {
        if (sim.meat.war >= B.discardCost + 40) { sim.issue({ kind: 'discard', cardIndex: i }); return; }
        continue;
      }
      if (tryBuild(i)) return;
      return;
    }

    // Hand clogged with cards we cannot pay for while meat piles up: discard one.
    if (sim.meat.war >= 25) {
      for (let i = 0; i < sim.hand.length; i++) {
        if (!sim.canAfford(towerSpec(sim.hand[i].family).cost)) {
          sim.issue({ kind: 'discard', cardIndex: i });
          return;
        }
      }
    }
  }

  /** Is there ground anywhere on the board that a limb of this family could be built on? */
  private fitsSomewhere(sim: Sim, family: TowerFamily): boolean {
    for (let cell = 0; cell < sim.map.cells.length; cell++) if (sim.canBuildTower(cell, family)) return true;
    return false;
  }

  /** A rough damage-per-second read of a limb (for choosing between evolutions). */
  private dpsOf(sim: Sim, t: Tower): number {
    const s = sim.statsOf(t);
    const hit = s.damage * s.volley * (1 + s.extraTargets) * (1 + 0.5 * s.chains) * (1 + s.aoe / 40) * (1 + 0.3 * s.skips);
    const dots = s.poisonDps * s.poisonDur + s.burnDps * s.burnDur;
    const control = (1 - s.slowMult) * 10 + s.shred + s.execute * 0.3 + s.grounding * 3;
    return s.rate * (hit + dots + control) * (1 + s.reach) * (s.hitsAir ? 1.2 : 1) * (s.hitsGround ? 1 : 0.6);
  }

  /**
   * Spare royal points buy ROYAL DECREES (content/royal.ts), a plain player's way: the core's
   * heart when it is hurt, the consort's favour once, then crowns on the best killers.
   */
  private spendRoyal(sim: Sim): void {
    const spare = sim.meat.royal - (this.stage3Ready(sim) ? 1 : 0);
    const can = (id: 'heart' | 'favour' | 'crown') => sim.decreeCost(id) <= spare;
    if (sim.coreHp < sim.coreMaxHp * 0.6 && can('heart')) { sim.issue({ kind: 'decree', decree: 'heart' }); return; }
    if (!sim.decrees.favour && can('favour')) { sim.issue({ kind: 'decree', decree: 'favour' }); return; }
    const best = sim.towers
      .filter((t) => !t.crowns && towerSpec(t.family).rate > 0)
      .sort((a, b) => b.kills - a.kills || a.id - b.id)[0];
    if (best && can('crown')) { sim.issue({ kind: 'decree', decree: 'crown', towerId: best.id }); return; }
    if (can('heart')) sim.issue({ kind: 'decree', decree: 'heart' });
  }

  private stage3Ready(sim: Sim): boolean {
    return sim.towers.some((t) => (t.upgrades?.length ?? 0) === 2);
  }

  /** Evolve the best-killing limb that can afford its next stage, taking the option that reads stronger. */
  private tryEvolve(sim: Sim): boolean {
    const guns = sim.towers
      .filter((t) => towerSpec(t.family).rate > 0 && !towerSpec(t.family).engine && (t.upgrades?.length ?? 0) < 3)
      .sort((a, b) => b.kills - a.kills || a.id - b.id);
    for (const t of guns.slice(0, 4)) {
      const stage = t.upgrades?.length ?? 0;
      if (!sim.canAfford(UPGRADE_COST[stage])) continue;
      const before = t.upgrades;
      let best: UpgradeChoice = 'A';
      let bestScore = -Infinity;
      for (const c of ['A', 'B'] as UpgradeChoice[]) {
        t.upgrades = [...(before ?? []), c];
        const score = this.dpsOf(sim, t);
        if (score > bestScore) { bestScore = score; best = c; }
      }
      t.upgrades = before;
      if (sim.issue({ kind: 'evolve', towerId: t.id, choice: best }).ok) return true;
    }
    return false;
  }

  /**
   * Chokepoint-aware placement: shooters go on buildable cells ADJACENT to a
   * street (covering traffic without blocking it); spine walls go ON a street
   * to force detours. Prefers cells the flow actually crosses near the core.
   */
  /** Cells on the marching routes to the core, with multiplicity: EVERY frontier
   *  gate's route counts (the telegraph alternates — chasing only the current one
   *  leaves last wave's guns pointing the wrong way), telegraphed lanes count
   *  extra, and MERGE points where routes share a street shine brightest. */
  private lanePathCells(sim: Sim): Map<number, number> {
    const path = new Map<number, number>();
    const walk = (gate: number, w: number) => {
      let c = gate;
      let guard = 0;
      while (c >= 0 && guard++ < 500) {
        path.set(c, (path.get(c) ?? 0) + w);
        c = sim.flowNextOf(c);
      }
    };
    for (const gate of sim.incomingGates) walk(gate, 1);
    return path;
  }

  /** A buildable STREET cell on the telegraphed march, as far out as the creep reaches. */
  private laneRoadCell(sim: Sim, family: 'spine' | 'swamp' = 'spine'): number | null {
    let best: number | null = null;
    let bestCd = -1;
    for (const gate of sim.incomingGates) {
      let c = gate;
      let guard = 0;
      while (c >= 0 && guard++ < 500) {
        if (sim.map.cells[c] === CellType.Road && sim.canBuildTower(c, family)) {
          const cd = sim.creepDistOf(c);
          if (cd > bestCd) { bestCd = cd; best = c; }
        }
        c = sim.flowNextOf(c);
      }
    }
    return best;
  }

  /**
   * The real TD skill, made explicit: score a block by how many DISTINCT
   * street cells sit within tower range — switchback pockets score double —
   * with a bonus when those street cells are on the telegraphed lanes.
   */
  /** Cells under the straight gate->core lines — where the FLIERS come. */
  private airLaneCells(sim: Sim): Set<number> {
    const air = new Set<number>();
    for (const gate of sim.incomingGates) {
      const a = sim.cellCenter(gate);
      const steps = Math.ceil(Math.hypot(sim.core.x - a.x, sim.core.y - a.y) / sim.cfg.cellPx);
      for (let i = 0; i <= steps; i++) {
        const x = a.x + ((sim.core.x - a.x) * i) / steps;
        const y = a.y + ((sim.core.y - a.y) * i) / steps;
        air.add(sim.cellAt(x, y));
      }
    }
    return air;
  }

  private findTowerCell(sim: Sim, asBlocker: boolean, interiorOnly = false, big?: TowerFamily): number | null {
    const w = sim.cfg.gridW;
    const lane = this.lanePathCells(sim);
    const air = this.airLaneCells(sim);
    const rangeCells = 3; // ~95px on 32px cells
    const candidates: Array<{ cell: number; score: number }> = [];
    for (let cell = 0; cell < sim.map.cells.length; cell++) {
      if (!sim.canBuildTower(cell, asBlocker ? 'spine' : big)) continue;
      if (interiorOnly && (sim.creepDistOf(cell) < 0 || sim.creepDistOf(cell) > 5)) continue;
      if (asBlocker) {
        if (sim.map.cells[cell] !== CellType.Road) continue;
      } else if (sim.map.cells[cell] === CellType.Road) continue;
      const cx = cell % w;
      const cy = Math.floor(cell / w);
      let coverage = 0;
      let laneCoverage = 0;
      let airCoverage = 0;
      for (let dy = -rangeCells; dy <= rangeCells; dy++) {
        for (let dx = -rangeCells; dx <= rangeCells; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= sim.cfg.gridH) continue;
          if (dx * dx + dy * dy > rangeCells * rangeCells) continue;
          const nb = ny * w + nx;
          if (sim.map.cells[nb] === CellType.Road) {
            coverage += 1;
            laneCoverage += lane.get(nb) ?? 0; // merge points count double+
          }
          if (air.has(nb)) airCoverage += 1; // fliers cross HERE, blocks or not
        }
      }
      if (coverage === 0 && airCoverage === 0) continue;
      // Verticality: a taller perch shoots further — worth real points.
      const height = sim.map.heights[cell] || 1;
      const score = coverage + laneCoverage * 2 + Math.min(airCoverage, 4) * 1.5
        + (height - 1) * 2 + this.rng.float(0, 1.2);
      candidates.push({ cell, score });
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score || a.cell - b.cell);
    return candidates[0].cell;
  }

  /** Ward: the block that shields the most unwarded guns, preferring cells OFF the lanes (don't take a gun's perch). */
  private wardCell(sim: Sim, guns: Array<{ id: number; pos: { x: number; y: number }; shieldMax?: number }>): number | null {
    const radius = towerSpec('ward').auraRadius ?? 0;
    const lane = this.lanePathCells(sim);
    let best: number | null = null;
    let bestScore = 0;
    for (let cell = 0; cell < sim.map.cells.length; cell++) {
      if (!sim.canBuildTower(cell, 'ward') || sim.map.cells[cell] === CellType.Road) continue;
      const p = sim.cellCenter(cell);
      let covered = 0;
      for (const g of guns) {
        if ((g.shieldMax ?? 0) > 0) continue; // already under a ward
        if (Math.hypot(g.pos.x - p.x, g.pos.y - p.y) <= radius) covered++;
      }
      if (covered < 2) continue;
      let laneNear = 0;
      const w = sim.cfg.gridW;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nb = cell + dy * w + dx;
          if (nb >= 0 && nb < sim.map.cells.length && lane.has(nb)) laneNear++;
        }
      }
      const score = covered * 10 - laneNear;
      if (score > bestScore) { bestScore = score; best = cell; }
    }
    return best;
  }

  /**
   * Trial-place a combo engine at `cell` (a ghost limb, removed afterwards) and
   * measure, over the four headings, the best relative dps gain on its target.
   */
  private engineGain(sim: Sim, family: string, cell: number): { gain: number; facing: 'N' | 'E' | 'S' | 'W' } | null {
    const ghost = {
      id: -999, family: family as never, pos: sim.cellCenter(cell), cell,
      hp: 1, maxHp: 1, pips: [], cooldown: 0, kills: 0, facing: 'N' as 'N' | 'E' | 'S' | 'W',
    };
    let best: { gain: number; facing: 'N' | 'E' | 'S' | 'W' } | null = null;
    for (const dir of ['N', 'E', 'S', 'W'] as const) {
      ghost.facing = dir;
      const target = sim.conduitTarget(ghost);
      if (!target) continue;
      const before = sim.statsOf(target);
      sim.towers.push(ghost);
      const after = sim.statsOf(target);
      sim.towers.pop();
      const dpsB = before.damage * before.rate;
      const dpsA = after.damage * after.rate;
      const gain = dpsB > 0 ? dpsA / dpsB - 1 : 0;
      if (!best || gain > best.gain) best = { gain, facing: dir };
    }
    return best;
  }

  /** The best spot for an amplifier: around the carry (the limb with the most engines on it). */
  private ampSpot(sim: Sim): { cell: number; gain: number; facing: 'N' | 'E' | 'S' | 'W' } | null {
    let carry: { pos: { x: number; y: number } } | null = null;
    let most = 0;
    for (const t of sim.towers) {
      if (towerSpec(t.family).engine) continue;
      const fed = sim.towers.filter((c) => towerSpec(c.family).engine && sim.engineTargets(c).includes(t)).length;
      if (fed > most) { most = fed; carry = t; }
    }
    if (!carry) return null;
    const near: number[] = [];
    for (let cell = 0; cell < sim.map.cells.length; cell++) {
      if (!sim.canBuildTower(cell) || sim.map.cells[cell] === CellType.Road) continue;
      const p = sim.cellCenter(cell);
      if (Math.hypot(p.x - carry.pos.x, p.y - carry.pos.y) <= 150) near.push(cell);
    }
    near.sort((a, b) => {
      const pa = sim.cellCenter(a);
      const pb = sim.cellCenter(b);
      return Math.hypot(pa.x - carry!.pos.x, pa.y - carry!.pos.y) - Math.hypot(pb.x - carry!.pos.x, pb.y - carry!.pos.y);
    });
    let best: { cell: number; gain: number; facing: 'N' | 'E' | 'S' | 'W' } | null = null;
    for (const cell of near.slice(0, 24)) {
      const g = this.engineGain(sim, 'amp', cell);
      if (g && (!best || g.gain > best.gain)) best = { cell, ...g };
    }
    return best;
  }

  /**
   * The combo line: pick ONE carry and point every engine at it. Among the
   * four headings, prefer a limb other engines already feed (concentration is
   * what makes amplifiers pay: they only grow stacks of 2+), then raw dps.
   */
  private aimConduit(sim: Sim, c: { id: number; family: string }): void {
    let best: 'N' | 'E' | 'S' | 'W' | null = null;
    let bestKey = -1;
    for (const dir of ['N', 'E', 'S', 'W'] as const) {
      sim.issue({ kind: 'set-facing', towerId: c.id, dir });
      const t = sim.conduitTarget(sim.towers.find((x) => x.id === c.id)!);
      if (!t) continue;
      const st = sim.statsOf(t);
      const fedBy = sim.towers.filter((o) => o.id !== c.id && towerSpec(o.family).engine && sim.engineTargets(o).includes(t)).length;
      const key = fedBy * 1e6 + st.damage * st.rate;
      if (key > bestKey) { bestKey = key; best = dir; }
    }
    if (best) sim.issue({ kind: 'set-facing', towerId: c.id, dir: best });
  }

  /** Bombard: deep and high — its reach covers the lanes from the safety of the body. */
  private bombardCell(sim: Sim): number | null {
    let best: number | null = null;
    let bestScore = -Infinity;
    for (let cell = 0; cell < sim.map.cells.length; cell++) {
      if (!sim.canBuildTower(cell) || sim.map.cells[cell] === CellType.Road) continue;
      const cd = sim.creepDistOf(cell);
      if (cd < 0) continue;
      const score = -cd + (sim.map.heights[cell] || 1) * 3;
      if (score > bestScore) { bestScore = score; best = cell; }
    }
    return best;
  }

}
