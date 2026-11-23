/**
 * THE LIMB STAT CARD, in words (Collins, Nov 23 2026, playtesting: "I think we need to signal things much better with
 * stats on limbs on hover over and an explanation for those stats").
 *
 * Pure (no DOM, no Pixi): from a Sim and a placed limb (or a family in the hand) it returns the rows the hover card,
 * the hand card's hover and the click panel show. Each row is { label, value, explain, base?, sources[] }:
 *   - value   what the limb has NOW, from the sim's own Sim.statsOf (the card cannot lie),
 *   - base    what a bare limb of that family has, when the two differ,
 *   - explain one short plain line on what the number means,
 *   - sources where the difference comes from, named the way the player sees them (an inherited trait by the
 *             display name of the limb it came from and what that trait teaches, a roof's level, an organ's level, an
 *             evolution, a crown, a choir or engine nearby).
 * Reach is given in board cells, not pixels.
 */
import { BALANCE as B } from '../../content/data';
import { PIP_DESC, CARD_DESC } from '../../content/limbText';
import { ROYAL } from '../../content/royal';
import { Sim, gorgeOf, organSpec, themeOf, towerSpec, towerStats, upgradeOptions, upgradePips, type TowerStats } from '../sim/sim';
import type { ModPip, Tower, TowerFamily, UpgradeOption } from '../sim/types';

export interface StatRow {
  key: string;
  label: string;
  value: string;
  explain: string;
  /** The bare family's value, when the limb's own differs from it. */
  base?: string;
  /** Where the difference comes from, one short line each. */
  sources: string[];
  /** Higher or lower than the bare family (for colouring). */
  trend?: 'up' | 'down';
}

export interface StatCard {
  family: TowerFamily;
  name: string;
  /** What it does, in plain words (its card line). */
  role: string;
  /** What it can hit: AIR + GROUND / GROUND / AIR ONLY / SUPPORT, plus DETECTS. */
  tag: string;
  /** The numbers: hp, damage, speed, damage a second, reach (or aura, strength, cycle for a support limb). */
  rows: StatRow[];
  /** Its special verbs (slow, poison, burn, armor pierce, splash...), each explained. */
  verbs: StatRow[];
  /** One-line states: grafting, crowned, sheltered, tapped, held fire. */
  notes: string[];
}

const nameOf = (f: TowerFamily): string => towerSpec(f).name;
const pct = (m: number): string => `${m >= 1 ? '+' : '−'}${Math.abs(Math.round((m - 1) * 100))}%`;
const num = (v: number, d = 0): string => (Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(d));
const cellsText = (px: number, cellPx: number): string => (px >= 1000 ? 'the whole board' : `${(px / cellPx).toFixed(1)} cells`);
const times = (n: number): string => (n > 1 ? ` ×${n}` : '');

/** Which family's trait feeds which number row. */
const STAT_PIPS: Record<string, TowerFamily[]> = {
  damage: ['lasher'],
  rate: ['spitter', 'sprout'],
  reach: ['choir', 'bombard'],
  hp: ['spine'],
  volley: ['twin'],
  hits: ['net'],
};

/** Which evolution knobs touch which number row. */
const STAT_KNOBS: Record<string, { mul?: 'tempo' | 'potency' | 'reach'; keys: string[] }> = {
  damage: { mul: 'potency', keys: ['damage', 'potency'] },
  rate: { mul: 'tempo', keys: ['rate', 'tempo'] },
  reach: { mul: 'reach', keys: ['range', 'reach'] },
  hp: { keys: ['maxHp'] },
  volley: { keys: ['volley'] },
};

/** Every trait a limb carries or is fed, with who it came from: family -> [{ who, n }]. */
type Ledger = Map<TowerFamily, Array<{ who: string; n: number }>>;

function add(l: Ledger, f: TowerFamily, who: string, n = 1): void {
  const list = l.get(f) ?? [];
  const had = list.find((x) => x.who === who);
  if (had) had.n += n; else list.push({ who, n });
  l.set(f, list);
}

function addPips(l: Ledger, pips: ModPip[], who: (f: TowerFamily) => string): void {
  for (const p of pips) add(l, p.family, who(p.family));
}

/** The traits a PLACED limb runs on and where each came from (mirrors Sim.statsOf's sources). */
function ledgerOf(sim: Sim, t: Tower): Ledger {
  const l: Ledger = new Map();
  const promos = t.promotions ?? 0;
  let promoLeft = promos;
  for (const p of t.pips) {
    if (p.family === t.family && promoLeft > 0) { promoLeft--; add(l, p.family, 'a promotion'); continue; }
    add(l, p.family, `inherited from a ${nameOf(p.family)}`);
  }
  for (const o of upgradeOptions(t)) for (const f of o.pips ?? []) add(l, f, `evolution ${o.name}`);
  for (const c of sim.towers) {
    if (c.id === t.id) continue;
    const spec = towerSpec(c.family);
    if (spec.engine) {
      if (!sim.engineTargets(c).includes(t)) continue;
      const who = `${spec.name} pointed at it`;
      addPips(l, sim.conduitPool(c), () => who);
      for (const o of upgradeOptions(c)) for (const f of o.targetPips ?? []) add(l, f, who);
      continue;
    }
    if (c.family !== 'choir' && c.family !== 'ward') continue;
    if (sim.isTapped(c)) continue;
    if (Math.hypot(c.pos.x - t.pos.x, c.pos.y - t.pos.y) > sim.auraOf(c).radius) continue;
    const who = `a ${spec.name} nearby`;
    for (const p of [...c.pips, ...upgradePips(c)]) {
      if (PIP_DESC[p.family] && BROADCAST.has(p.family)) add(l, p.family, who);
    }
  }
  const ob = sim.organBonusOf(t.family);
  const theme = themeOf(t.family);
  const organName = theme === 'core' ? 'the core' : organSpec(theme).name;
  addPips(l, ob.pips, () => `${organName} below`);
  return l;
}

/** Families whose pips a choir or ward shares with the limbs it covers (Sim.BROADCAST). */
const BROADCAST = new Set<TowerFamily>([
  'maw', 'lure', 'tangler', 'blighter', 'impaler', 'swamp', 'frond', 'lobber', 'mister',
  'ocular', 'prism', 'spine', 'quill', 'skipper', 'net',
]);

/** "inherited from a Spitter ×2, Organ below" for one trait family. */
function pipLine(l: Ledger, f: TowerFamily, amp: number): string[] {
  const list = l.get(f);
  if (!list?.length) return [];
  const total = list.reduce((a, x) => a + x.n, 0);
  return [`${nameOf(f)} trait${times(total)}: ${teaches(f)}${total > 1 ? ' each' : ''} — ${list.map((x) => `${x.who}${times(x.n)}`).join(', ')}${amp > 0 ? `; amplified ×1.5${amp > 1 ? ` ${amp} times` : ''}` : ''}`];
}

/** What a family's trait teaches, without PIP_DESC's bracketed asides (the card is a few short lines). */
export function teaches(f: TowerFamily): string {
  return PIP_DESC[f].replace(/\s*\([^)]*\)/g, '').trim();
}

function evoLines(ups: UpgradeOption[], key: string): string[] {
  const k = STAT_KNOBS[key];
  if (!k) return [];
  return ups.filter((o) => (k.mul && (o[k.mul] ?? 1) !== 1)
    || k.keys.some((x) => (o.add as Record<string, number> | undefined)?.[x] !== undefined || (o.mult as Record<string, number> | undefined)?.[x] !== undefined))
    .map((o) => `evolution ${o.name}: ${o.text}`);
}

/** What makes a limb's numbers what they are: environment that is not a trait. */
interface Lift {
  height: number;
  heightFactor: number;
  geneRange: number;
  organ: { name: string; level: number; potency: number; tempo: number } | null;
  crowns: number;
  choirs: Array<{ name: string; bonus: number }>;
  twinGlands: number;
  gentleTaps: number;
  amp: number;
}

function liftOf(sim: Sim, t: Tower, placed: boolean): Lift {
  const height = placed ? (sim.map.heights[t.cell] || 1) : 1;
  const ob = sim.organBonusOf(t.family);
  const theme = themeOf(t.family);
  const level = theme === 'core' ? 1 : (sim.organEffects().get(theme)?.level ?? 1);
  const choirs: Lift['choirs'] = [];
  if (placed) {
    for (const c of sim.towers) {
      if (c.id === t.id || c.family !== 'choir' || sim.isTapped(c)) continue;
      const a = sim.auraOf(c);
      if (Math.hypot(c.pos.x - t.pos.x, c.pos.y - t.pos.y) > a.radius) continue;
      choirs.push({ name: towerSpec('choir').name, bonus: (towerSpec('choir').rateAura ?? 0) * a.strength });
    }
  }
  return {
    height,
    heightFactor: placed ? sim.heightRangeFactor(t.cell) : 1,
    geneRange: (sim as unknown as { geneMods?: { rangeMult?: number } }).geneMods?.rangeMult ?? 1,
    organ: ob.potency !== 1 || ob.tempo !== 1 || ob.pips.length
      ? { name: theme === 'core' ? 'the core' : organSpec(theme).name, level, potency: ob.potency, tempo: ob.tempo } : null,
    crowns: placed ? sim.crownsOver(t) : 0,
    choirs,
    twinGlands: placed ? sim.enginesPointedAt(t, 'twin').length : 0,
    gentleTaps: placed ? sim.enginesPointedAt(t, 'tap').filter((c) => towerStats(c).gentleTap).length : 0,
    amp: placed ? sim.ampStack(t).length : 0,
  };
}

/** GORGED (Nov 23 2026): what the limb ate swells it, past each bonus (src/sim/sim.ts gorgeOf). */
function gorgeLine(t: Tower, k: 'potency' | 'tempo' | 'hp'): string[] {
  const n = t.pips.length;
  if (!n) return [];
  const g = gorgeOf(n)[k];
  return [`GORGED on ${n} meal${n === 1 ? '' : 's'}: +${Math.round((g - 1) * 100)}% (every limb it ate swells it, and each meal more than the last)`];
}

function trend(now: number, base: number): StatRow['trend'] {
  if (Math.abs(now - base) < 1e-6 * Math.max(1, Math.abs(base))) return undefined;
  return now > base ? 'up' : 'down';
}

/** Build the card from the limb's live stats `s`, its bare family's stats `b`, its trait ledger and its lift. */
function cardFrom(sim: Sim, t: Tower, s: TowerStats, l: Ledger, lift: Lift, placed: boolean): StatCard {
  const spec = towerSpec(t.family);
  const ups = upgradeOptions(t);
  const px = sim.cfg.cellPx;
  const b = towerStats({ ...t, pips: [], upgrades: [], grownHp: 0 }, true);
  const pip = (key: string) => (STAT_PIPS[key] ?? []).flatMap((f) => pipLine(l, f, lift.amp));
  const rows: StatRow[] = [];
  const attacker = spec.rate > 0 && !spec.engine;
  const aura = spec.auraRadius !== undefined && spec.auraRadius > 0;

  // HP
  {
    const sources = [...pip('hp'), ...evoLines(ups, 'hp'), ...gorgeLine(t, 'hp')];
    if (t.grownHp) sources.push(`grew +${Math.round(t.grownHp)} by healing past full`);
    if (t.family === 'spine' && (t.cells?.length ?? 2) !== 2) sources.push(`a wall's body grows with the ${t.cells?.length ?? 1} cells it crosses`);
    const max = placed ? t.maxHp : s.maxHp;
    rows.push({
      key: 'hp', label: 'HP',
      value: placed ? `${Math.ceil(t.hp)} / ${Math.ceil(max)}` : num(max),
      base: trend(max, b.maxHp) ? num(b.maxHp) : undefined, trend: trend(max, b.maxHp),
      explain: lift.crowns > 0 ? `harm it can take before it dies; a crown nearby: it takes ${Math.round((1 - ROYAL.crownHarm ** lift.crowns) * 100)}% less`
        : 'harm it can take before it dies',
      sources,
    });
  }

  if (attacker) {
    const tag = !s.hitsGround ? 'AIR ONLY' : s.hitsAir ? 'AIR + GROUND' : 'GROUND';
    const hitSources = [...pip('hits'), ...ups.filter((o) => o.set?.hitsAir || o.set?.trueSight).map((o) => `evolution ${o.name}: ${o.text}`)];
    if (s.trueSight && spec.detects === undefined) hitSources.push(...pipLine(l, 'ocular', 0));
    rows.push({
      key: 'hits', label: 'HITS', value: tag + (s.trueSight ? ' · DETECTS' : ''),
      explain: (!s.hitsAir ? 'cannot touch fliers' : !s.hitsGround ? 'fliers only' : 'walkers and fliers')
        + (s.trueSight ? '; sees cloaked specimens in its reach' : ''),
      sources: hitSources,
    });
    // DAMAGE
    {
      const sources = [...pip('damage'), ...evoLines(ups, 'damage'), ...gorgeLine(t, 'potency')];
      if (lift.organ && lift.organ.potency !== 1) sources.push(`${lift.organ.name} at level ${lift.organ.level}: ${pct(lift.organ.potency)}`);
      if (lift.crowns > 0) sources.push(`crowned limb nearby${times(lift.crowns)}: +${Math.round(ROYAL.crownDamage * 100)}% each`);
      rows.push({
        key: 'damage', label: 'DAMAGE', value: `${num(s.damage, 1)} a hit${s.volley > 1 ? ` × ${num(s.volley)} shots` : ''}`,
        base: trend(s.damage, b.damage) ? num(b.damage, 1) : undefined, trend: trend(s.damage, b.damage),
        explain: 'harm each hit does before armor',
        sources,
      });
    }
    // SPEED
    {
      const sources = [...pip('rate'), ...evoLines(ups, 'rate'), ...gorgeLine(t, 'tempo')];
      for (const c of lift.choirs) sources.push(`a ${c.name} nearby: +${Math.round(c.bonus * 100)}%`);
      if (lift.organ && lift.organ.tempo !== 1) sources.push(`${lift.organ.name} at level ${lift.organ.level}: ${pct(lift.organ.tempo)}`);
      if (lift.gentleTaps) sources.push('a gentle tap on it: half speed');
      rows.push({
        key: 'rate', label: 'SPEED', value: `${s.rate.toFixed(2)} attacks/s`,
        base: trend(s.rate, b.rate) ? b.rate.toFixed(2) : undefined, trend: trend(s.rate, b.rate),
        explain: `attacks a second (one every ${(1 / Math.max(1e-6, s.rate)).toFixed(1)}s)`,
        sources,
      });
    }
    // DPS
    {
      const dps = s.damage * s.rate * s.volley;
      const bd = b.damage * b.rate * b.volley;
      const sources = [...pip('volley'), ...evoLines(ups, 'volley')];
      if (lift.twinGlands) sources.push(`twinning gland${lift.twinGlands > 1 ? `s ×${lift.twinGlands}` : ''} pointed at it: ×2 shots`);
      rows.push({
        key: 'dps', label: 'DAMAGE / S', value: num(dps, 1),
        base: trend(dps, bd) ? num(bd, 1) : undefined, trend: trend(dps, bd),
        explain: 'damage × attacks a second on one target; poison, burn and splash come on top',
        sources,
      });
    }
  }

  if (!attacker) {
    if (aura) {
      const a = placed ? sim.auraOf(t) : { radius: (spec.auraRadius ?? 0) * s.reach + (s.aoe - spec.aoe), strength: s.potency };
      rows.push({
        key: 'aura', label: 'AURA', value: cellsText(a.radius, px),
        base: trend(a.radius, spec.auraRadius ?? 0) ? cellsText(spec.auraRadius ?? 0, px) : undefined, trend: trend(a.radius, spec.auraRadius ?? 0),
        explain: t.family === 'choir'
          ? `limbs inside strike ${Math.round((spec.rateAura ?? 0) * a.strength * 100)}% faster and share its hit traits`
          : 'limbs inside get its regrowing shield and share its hit traits',
        sources: [...pip('reach'), ...pipLine(l, 'burster', lift.amp), ...evoLines(ups, 'reach')],
      });
    }
    if (spec.engine) {
      const targets = placed ? sim.engineTargets(t) : [];
      rows.push({
        key: 'feeds', label: 'POINTS AT',
        value: placed ? (targets.length ? [...new Set(targets.map((u) => nameOf(u.family)))].join(', ') : 'nothing yet') : 'the limb it faces',
        explain: spec.engine.touch ? 'works on every limb touching it' : `works on the nearest limb down its facing, within ${cellsText(spec.engine.reach * s.reach, px)}; right-click turns it`,
        sources: [],
      });
    }
    {
      const sources = [...pip('damage'), ...evoLines(ups, 'damage'), ...gorgeLine(t, 'potency')];
      if (lift.organ && lift.organ.potency !== 1) sources.push(`${lift.organ.name} at level ${lift.organ.level}: ${pct(lift.organ.potency)}`);
      if (lift.crowns > 0) sources.push(`crowned limb nearby${times(lift.crowns)}: +${Math.round(ROYAL.crownDamage * 100)}% each`);
      if (Math.abs(s.potency - 1) > 1e-6 || sources.length) {
        rows.push({ key: 'potency', label: 'STRENGTH', value: pct(s.potency), trend: trend(s.potency, 1),
          explain: 'how strong its effect is, against a bare one', sources });
      }
    }
    {
      const sources = [...pip('rate'), ...evoLines(ups, 'rate'), ...gorgeLine(t, 'tempo')];
      for (const c of lift.choirs) sources.push(`a ${c.name} nearby: +${Math.round(c.bonus * 100)}%`);
      if (lift.organ && lift.organ.tempo !== 1) sources.push(`${lift.organ.name} at level ${lift.organ.level}: ${pct(lift.organ.tempo)}`);
      if (Math.abs(s.tempo - 1) > 1e-6 || sources.length) {
        rows.push({ key: 'tempo', label: 'CYCLE', value: pct(s.tempo), trend: trend(s.tempo, 1),
          explain: 'how fast it works (pulses, recharges, births), against a bare one', sources });
      }
    }
  }

  // REACH (anything that reaches out)
  if (spec.range > 0 && !spec.engine) {
    const sources = [...pip('reach'), ...evoLines(ups, 'reach')];
    if (lift.height > 1) sources.push(`standing on roof level ${lift.height}: +${Math.round(B.heightRangeBonus * (lift.height - 1) * 100)}%`);
    if (lift.geneRange !== 1) sources.push(`your strain's genes: ${pct(lift.geneRange)}`);
    const baseRange = spec.range;
    rows.push({
      key: 'reach', label: 'REACH', value: cellsText(s.range, px),
      base: trend(s.range, baseRange) ? cellsText(baseRange, px) : undefined, trend: trend(s.range, baseRange),
      explain: s.range >= 1000 ? 'it hits anywhere on the board'
        : `how far it hits; +${Math.round(B.heightRangeBonus * 100)}% per roof level above the street${placed ? '' : ' where you place it'}`,
      sources,
    });
  }

  return {
    family: t.family, name: spec.name, role: CARD_DESC[t.family],
    tag: (attacker ? (!s.hitsGround ? 'AIR ONLY' : s.hitsAir ? 'AIR + GROUND' : 'GROUND') : 'SUPPORT') + (s.trueSight ? ' · DETECTS' : ''),
    rows, verbs: verbsOf(sim, t, s, l, lift.amp), notes: placed ? notesOf(sim, t) : [],
  };
}

/** The special verbs, each with what it does and where it comes from. Only the ones it has. */
function verbsOf(sim: Sim, t: Tower, s: TowerStats, l: Ledger, amp: number): StatRow[] {
  const spec = towerSpec(t.family);
  const px = sim.cfg.cellPx;
  const out: StatRow[] = [];
  const v = (key: string, label: string, value: string, explain: string, fams: TowerFamily[], own: boolean) => {
    const sources = fams.flatMap((f) => pipLine(l, f, amp));
    if (own) sources.unshift(`a ${spec.name} does this by nature`);
    out.push({ key, label, value, explain, sources });
  };
  const sec = (d: number) => `${d.toFixed(1)}s`;
  if (s.aoe > 0) v('splash', 'SPLASH', cellsText(s.aoe, px), 'every specimen this close to the hit is struck too', ['burster'], spec.aoe > 0);
  if (s.slowMult < 1 && s.slowDur > 0) v('slow', 'SLOW', `${Math.round(s.slowMult * 100)}% speed · ${sec(s.slowDur)}`, 'what it hits walks slower for a while', ['tangler'], (spec.slowMult ?? 1) < 1);
  if (s.poisonDps > 0) v('poison', 'POISON', `${num(s.poisonDps, 1)}/s · ${sec(s.poisonDur)}`, 'harm over time that goes through armor', ['blighter'], (spec.poisonDps ?? 0) > 0);
  if (s.burnDps > 0) v('burn', 'BURN', `${num(s.burnDps, 1)}/s · ${sec(s.burnDur)}`, 'fire that spreads body to body and lights up the cloaked', ['ember'], (spec.burnDps ?? 0) > 0);
  if (s.pierce) v('pierce', 'PIERCE', 'ignores armor', 'goes through the file and every shield', ['impaler'], !!spec.pierce);
  else if (s.capBonus > 0) v('pierce', 'ARMOR PIERCE', `+${num(s.capBonus)}`, 'hits through this much armor', ['impaler'], false);
  if (s.shred > 0) v('shred', 'SHRED', `+${num(s.shred)} · ${sec(s.shredDur)}`, 'breaks armor: everyone hits what it struck deeper', ['mister'], (spec.shred ?? 0) > 0);
  if (s.chains > 0) v('chains', 'CHAINS', `${num(s.chains)} more`, 'each hit arcs on to more specimens, weaker each hop', ['frond'], (spec.chains ?? 0) > 0);
  if (s.knock > 0) v('knock', 'KNOCKBACK', `${num(s.knock)}px`, 'hits push specimens back down the street', ['lobber'], false);
  if (s.execute > 0) v('execute', 'DIGEST', `under ${num(s.execute)} hp`, 'anything left this weak is dissolved outright', ['swamp'], (spec.swamp?.execute ?? 0) > 0);
  if (s.cloud > 0) v('cloud', 'TOXIC CLOUD', 'on hit', 'hits leave a pheromone cloud that hurts and reveals', ['lure'], false);
  if (s.caltrop > 0) v('caltrop', 'CALTROPS', 'on kill', 'kills leave barbs in the street', ['spine'], false);
  if (s.sniper || s.supportDmg > 0) v('sniper', 'SNIPER', s.supportDmg > 0 ? `+${Math.round(s.supportDmg * 100)}% vs supports` : 'supports first', 'shoots drummers, tenders and bombers before the rest', ['ocular'], !!spec.sniper);
  if (s.streakRamp > 0) v('streak', 'FOCUS', `+${Math.round(s.streakRamp * 100)}% a hit`, 'grows stronger for every shot held on one target', ['prism'], t.family === 'prism');
  if (s.grounding > 0) v('ground', 'GROUNDS', sec(s.grounding), 'fliers it strikes are dragged to the ground', ['net'], (spec.grounds ?? 0) > 0);
  if (s.skips > 0) v('skips', 'SKIPS', `${num(s.skips)}×`, 'each impact skips on down the line', ['skipper'], (spec.skips ?? 0) > 0);
  if (s.extraTargets > 0) v('extra', 'MULTI-HIT', `+${num(s.extraTargets)} target${s.extraTargets > 1 ? 's' : ''}`, 'every shot also strikes more specimens', ['quill'], false);
  if (s.rootDur > 0) v('root', 'ROOT', sec(s.rootDur), 'what it hits is held in place', ['cage'], false);
  if (s.yieldMult > 1) v('yield', 'MEAT', `+${Math.round((s.yieldMult - 1) * 100)}%`, 'its kills pay more meat', ['maw'], false);
  if (s.shieldPerm > 0) v('shield', 'SHIELD', `+${num(s.shieldPerm)}`, 'a personal shield it carries for life', ['ward'], false);
  if (s.waveHeal > 0) v('heal', 'REGROWS', `${Math.round(s.waveHeal * 100)}% a wave`, 'heals after every wave you clear; past full it grows', ['brood', 'hatch'], false);
  if (s.seepRadius > 0 || s.offCreep) v('seep', 'SEEPS CREEP', s.seepRadius > 0 ? `${num(s.seepRadius)} cell${s.seepRadius > 1 ? 's' : ''}` : 'yes', `spreads creep round itself${s.offCreep ? '; needs no creep to stand on' : ''}`, ['sling', 'lance'], false);
  return out;
}

function notesOf(sim: Sim, t: Tower): string[] {
  const out: string[] = [];
  if (t.graftUntil !== undefined && t.graftUntil > sim.time) out.push(`GRAFTING ${(t.graftUntil - sim.time).toFixed(1)}s: holds fire, bleeds double`);
  if (t.crowns) out.push(`CROWNED${times(t.crowns)}: limbs within ${cellsText(ROYAL.crownRadius, sim.cfg.cellPx)} hit harder and take less harm`);
  if (sim.isTapped(t)) out.push('TAPPED: a marrow tap holds it; it does nothing until the tap is eaten');
  if ((t.stunnedUntil ?? 0) > sim.time) out.push('STUNNED by a dart: holds fire');
  return out;
}

/** The stat card of a placed limb, from the sim's own numbers. */
export function limbCard(sim: Sim, t: Tower): StatCard {
  return cardFrom(sim, t, sim.statsOf(t), ledgerOf(sim, t), liftOf(sim, t, true), true);
}

/**
 * The stat card of a HAND card: what that limb would be if you placed it now on street level, carrying what a pending
 * sacrifice banked (sim.pendingPips) and the organ stage's bonus for its theme. A roof adds reach on top.
 */
export function handCard(sim: Sim, family: TowerFamily, pips: ModPip[] = sim.pendingPips): StatCard {
  const spec = towerSpec(family);
  const ob = sim.organBonusOf(family);
  const ghost: Tower = { id: -1, family, pos: { x: -1e6, y: -1e6 }, cell: 0, hp: spec.maxHp, maxHp: spec.maxHp, pips: [...pips], cooldown: 0, kills: 0 };
  const s = towerStats({ ...ghost, pips: [...pips, ...ob.pips] }, true);
  s.range *= (sim as unknown as { geneMods?: { rangeMult?: number } }).geneMods?.rangeMult ?? 1;
  s.potency *= ob.potency; s.damage *= ob.potency; s.tempo *= ob.tempo; s.rate *= ob.tempo;
  const l: Ledger = new Map();
  addPips(l, pips, () => 'banked by the limb you ate');
  const theme = themeOf(family);
  addPips(l, ob.pips, () => `${theme === 'core' ? 'the core' : organSpec(theme).name} below`);
  return cardFrom(sim, ghost, s, l, liftOf(sim, ghost, false), false);
}

/** A cheap change key: the card re-renders only when this changes. */
export function cardKey(c: StatCard): string {
  return JSON.stringify(c);
}

/** The click panel's stats line, in the same words (no raw multipliers). */
export function inspectLine(c: StatCard): string {
  const pick = (k: string) => c.rows.find((r) => r.key === k);
  const parts: string[] = [];
  for (const k of ['hits', 'damage', 'rate', 'dps', 'reach', 'aura', 'feeds', 'potency', 'tempo']) {
    const r = pick(k);
    if (!r) continue;
    parts.push(k === 'hits' ? r.value : `${r.label.toLowerCase()} ${r.value}`);
  }
  return parts.join(' · ');
}

/** The click panel's traits line, by display name: "inherited: Spitter ×2 (+25% fire rate each)". */
export function traitsLine(t: Tower): string {
  if (!t.pips.length) return 'no inherited traits';
  const counts = new Map<TowerFamily, number>();
  for (const p of t.pips) counts.set(p.family, (counts.get(p.family) ?? 0) + 1);
  return `inherited: ${[...counts].map(([f, n]) => `${nameOf(f)}${times(n)} (${teaches(f)}${n > 1 ? " each" : ""})`).join(', ')}`;
}
