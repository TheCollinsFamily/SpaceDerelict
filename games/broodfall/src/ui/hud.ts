/**
 * DOM HUD: the empire's operator software. Reads sim state, renders panels,
 * translates sim events into the broadcast voice, and reports player intent
 * back to main.ts via callbacks.
 */
import { Sim, towerSpec } from '../sim/sim';
import { UPGRADES, UPGRADE_COST } from '../../content/upgrades';
import { BALANCE as B } from '../../content/data';
import { artUrl, loadManifest, type LimbArt } from '../render/art';
import { idleFrames, phaseOf } from '../render/idleClock';
import { aliveSwitchedOn } from './alive';

/** The limbs' baked pictures, once the manifest has loaded: a card shows its limb (null: text only). */
let limbArt: Record<string, LimbArt> | null = null;

/** The first idle frame of a limb, as a CSS background `size` px square, cut from its atlas. */
function cardArt(family: string, size: number): string {
  const a = limbArt?.[family];
  if (!a) return '';
  const i = a.anims.idle.start;
  const k = size / a.frame;
  const url = new URL(artUrl(a.atlas), document.baseURI).href;
  return `background-image:url("${url}");background-size:${a.cols * a.frame * k}px auto;background-position:-${(i % a.cols) * size}px -${Math.floor(i / a.cols) * size}px`;
}

/**
 * The hand's limbs are alive (Oct 1 2026, notes/VIDEO-AUDIT.md): each card's picture steps through its limb's own
 * idle, the frames the board plays (no video, no new art), on ONE timer at the idle's 12 frames a second, each card
 * in its own phase. A frame is written only when it changes; nothing is read from the layout. Still under Settings >
 * Reduce motion (html.reduce-motion), in a hidden tab, and under automation unless asked for (src/ui/alive.ts).
 */
let cardTimer = 0;
function animateCards(hand: HTMLElement, size: number): void {
  if (cardTimer || !aliveSwitchedOn()) return;
  const t0 = performance.now();
  cardTimer = window.setInterval(() => {
    if (document.hidden || document.documentElement.classList.contains('reduce-motion')) return;
    const t = (performance.now() - t0) / 1000;
    for (const el of hand.querySelectorAll<HTMLElement>('.card-art[data-limb]')) {
      const a = limbArt?.[el.dataset.limb!];
      if (!a || a.anims.idle.count < 2) continue;
      const f = idleFrames(a.anims.idle, t, phaseOf(Number(el.dataset.k) + 1)).a;
      if (el.dataset.f === String(f)) continue;
      el.dataset.f = String(f);
      el.style.backgroundPosition = `-${(f % a.cols) * size}px -${Math.floor(f / a.cols) * size}px`;
    }
  }, 1000 / 12);
}
import type { Caste, CasteFocus, OrganId, RootDir, SimEvent, TargetMode, Tower, TowerFamily, UpgradeChoice } from '../sim/types';

import { CARD_DESC, layerTag } from '../../content/limbText';
export { PIP_DESC, layerTag } from '../../content/limbText';

const FEED_LINES: Partial<Record<SimEvent['kind'], (e: SimEvent) => { text: string; cls: string }>> = {
  kill: (e) => e.kind === 'kill'
    ? { text: `resource acquired — ${e.caste} caste`, cls: e.caste === 'science' ? 'sci' : e.caste === 'royal' ? 'royal' : '' }
    : { text: '', cls: '' },
  eaten: () => ({ text: 'specimen consumed whole', cls: 'hot' }),
  built: (e) => e.kind === 'built'
    ? { text: e.pips > 0 ? `limb cultivated (+${e.pips} traits)` : 'limb cultivated', cls: '' }
    : { text: '', cls: '' },
  cannibalized: (e) => e.kind === 'cannibalized'
    ? { text: `biomass reallocated: ${e.donor} → ${e.into}`, cls: 'hot' }
    : { text: '', cls: '' },
  butchered: (e) => e.kind === 'butchered'
    ? { text: `limb reclaimed: ${e.family} (+${e.refund} meat salvage)`, cls: 'hot' }
    : { text: '', cls: '' },
  'organ-built': (e) => e.kind === 'organ-built'
    ? { text: `internal structure grown: ${e.organ}`, cls: '' }
    : { text: '', cls: '' },
  'wave-start': (e) => e.kind === 'wave-start'
    ? { text: `assault from ${e.sides} — tier ${e.tier}`, cls: 'hot' }
    : { text: '', cls: '' },
  'researchers-arrive': () => ({ text: 'curious specimens inbound', cls: 'sci' }),
  'clot-hurled': () => ({ text: 'growth medium deployed downrange', cls: '' }),
  'clot-landed': () => ({ text: 'remote site seeded — new ground taking', cls: 'hot' }),
  'bile-landed': (e) => e.kind === 'bile-landed'
    ? { text: e.hits > 0 ? `bile strike: ${e.hits} specimens dissolving` : 'bile strike: no contacts', cls: 'hot' }
    : { text: '', cls: '' },
  'broodling-lost': () => ({ text: 'expendable subunit expended', cls: '' }),
  'meat-stolen': (e) => e.kind === 'meat-stolen'
    ? { text: `ASSET PILFERED: ${e.amount} war meat — intercept the courier`, cls: 'hot' }
    : { text: '', cls: '' },
  'meat-recovered': (e) => e.kind === 'meat-recovered'
    ? { text: `courier neutralized — ${e.amount} meat recovered`, cls: 'sci' }
    : { text: '', cls: '' },
  'tower-stolen': (e) => e.kind === 'tower-stolen'
    ? { text: `SPECIMEN LOSS: a ${e.family} is being carried off — intercept`, cls: 'hot' }
    : { text: '', cls: '' },
  'tower-recovered': (e) => e.kind === 'tower-recovered'
    ? { text: e.refunded ? `${e.family} recovered — ground taken, biomass refunded` : `${e.family} recovered and re-rooted`, cls: 'sci' }
    : { text: '', cls: '' },
  'cannon-deployed': (e) => e.kind === 'cannon-deployed'
    ? { text: e.enemy === 'dartgun' ? 'sedation battery emplaced — shield your limbs' : 'siege cannon emplaced — silence it', cls: 'hot' }
    : { text: '', cls: '' },
  promoted: (e) => e.kind === 'promoted'
    ? { text: `local response promoted: ${e.from} → ${e.to}`, cls: 'royal' }
    : { text: '', cls: '' },
  'royal-incoming': () => ({ text: 'priority asset detected: ROYAL', cls: 'royal' }),
  evolved: (e) => e.kind === 'evolved'
    ? { text: `${e.family} evolved — stage ${e.stage}${e.choice}: ${e.name}`, cls: e.stage === 3 ? 'royal' : 'sci' }
    : { text: '', cls: '' },
  reborn: (e) => e.kind === 'reborn'
    ? { text: `${e.family} reborn from the reliquary`, cls: 'sci' }
    : { text: '', cls: '' },
  budded: (e) => e.kind === 'budded'
    ? { text: `mitosis: a ${e.family} buds`, cls: 'sci' }
    : { text: '', cls: '' },
  'meat-cleared': (e) => e.kind === 'meat-cleared'
    ? { text: `unspent meat spoiled: ${e.war} war, ${e.science} science`, cls: 'hot' }
    : { text: '', cls: '' },
  'node-grown': (e) => e.kind === 'node-grown'
    ? { text: `spore bladder: +${e.count} creep node${e.count > 1 ? 's' : ''}`, cls: 'sci' }
    : { text: '', cls: '' },
  'organ-upgraded': (e) => e.kind === 'organ-upgraded'
    ? { text: `organ levelled: ${e.organ} → LV${e.level}`, cls: 'sci' }
    : { text: '', cls: '' },
  'relic-banked': (e) => e.kind === 'relic-banked'
    ? { text: `reliquary banks ${e.pips} bonuses from the fallen ${e.family}`, cls: 'sci' }
    : { text: '', cls: '' },
  'structure-lost': (e) => e.kind === 'structure-lost'
    ? { text: `limb lost: ${e.what}`, cls: 'hot' }
    : { text: '', cls: '' },
  'royal-decree': (e) => e.kind === 'royal-decree'
    ? { text: `royal decree: ${e.name}${e.family ? ` (${e.family})` : ''}`, cls: 'royal' }
    : { text: '', cls: '' },
  'limb-promoted': (e) => e.kind === 'limb-promoted'
    ? { text: `consort's favour: the ${e.family} is promoted (+1 ${e.family} bonus)`, cls: 'royal' }
    : { text: '', cls: '' },
  'surgery-under-fire': (e) => e.kind === 'surgery-under-fire'
    ? { text: `SURGERY UNDER FIRE: the ${e.family} grafts for ${e.seconds.toFixed(1)}s — it holds fire and bleeds`, cls: 'hot' }
    : { text: '', cls: '' },
  'graft-took': (e) => e.kind === 'graft-took'
    ? { text: `graft took: the ${e.family} is in the fight`, cls: 'sci' }
    : { text: '', cls: '' },
  burrowed: () => ({ text: 'burrowed through: a new way into the city (and out of it)', cls: 'hot' }),
  'sealed-in': () => ({ text: 'the body has walled itself in: burrow through a wall into the smoke to grow again', cls: 'hot' }),
};

export interface HudCallbacks {
  onSelectCard(index: number | null): void;
  onDiscardCard(index: number): void;
  onArmOrgan(organ: OrganId | null): void;
  onRoyalSurge(): void;
  onSpeed(mult: number): void;
  onRestart(): void;
  onSetPriority(towerId: number, mode?: TargetMode, caste?: CasteFocus): void;
  onSetFacing(towerId: number, dir: RootDir): void;
  onEvolve(towerId: number, choice: UpgradeChoice): void;
  /** A royal decree bought on a limb (its panel): the crown. */
  onCrown(towerId: number): void;
}

export class Hud {
  private cb: HudCallbacks;
  private el = {
    meat: {
      war: document.querySelector('#meat-war .meat-val') as HTMLElement,
      science: document.querySelector('#meat-science .meat-val') as HTMLElement,
      royal: document.querySelector('#meat-royal .meat-val') as HTMLElement,
    },
    biomassFill: document.getElementById('biomass-fill')!,
    biomassText: document.getElementById('biomass-text')!,
    phaseName: document.getElementById('phase-name')!,
    waveInfo: document.getElementById('wave-info')!,
    threat: document.querySelector('#dial-threat b') as HTMLElement,
    interest: document.querySelector('#dial-interest b') as HTMLElement,
    coreFill: document.getElementById('core-hp-fill')!,
    hand: document.getElementById('hand')!,
    feed: document.getElementById('feed')!,
    hint: document.getElementById('hint')!,
    overlay: document.getElementById('overlay')!,
    overlayTitle: document.getElementById('overlay-title')!,
    overlayBody: document.getElementById('overlay-body')!,
  };

  selectedCard: number | null = null;
  armedOrgan: OrganId | null = null;
  /** Limb whose inspect panel is open (null = closed). */
  inspectedId: number | null = null;
  private lastHandKey = '';
  private lastEvolveKey = '';
  private lastDirective: 'hold' | 'royal' | 'harvest' = 'hold';

  /** Mission 1 (src/meta/onboarding.ts): a plain tower-defence game; nothing on screen speaks of the ship, the Board or the globe. */
  plain = false;
  /** Mission 1: the HUD parts already shown (once shown, a part stays). */
  private revealed = new Set<string>();

  /**
   * MISSION 1 SHOWS ONE THING AT A TIME (Sep 30 2026 fix pass; notes/PERSONA-ONBOARDING-2026-09-30.md).
   * A new player's first screen showed every system at once. In mission 1 each HUD part waits,
   * hidden (src/onboard.css, body.first-mission), until the run makes it matter: science and royal
   * meat when the first of it is eaten, the threat and interest dials and the ORGANS button after the
   * first wave (the organ stage opens then), creep nodes and plinths when an organ grows them, royal
   * surge with the first royal point, cannibalize once a few limbs stand after the second wave.
   * A part comes in with a short glow, and stays. Nothing about the run changes, only what is drawn.
   */
  private revealForMission1(sim: Sim): void {
    const organ = (id: string) => sim.organs.some((o) => o.organ === id);
    const now: Array<[string, boolean]> = [
      ['science', sim.meat.science > 0],
      ['royal', sim.meat.royal > 0],
      ['dials', sim.wavesCleared >= 1],
      ['organs', sim.wavesCleared >= 1],
      ['nodes', sim.creepNodes > 0 || organ('bladder') || organ('cyst')],
      ['plinths', sim.plinths > 0 || organ('scaffold')],
      ['surge', sim.meat.royal > 0],
      ['cannibal', sim.pendingPips.length > 0 || (sim.wavesCleared >= 2 && sim.towers.length >= 3)],
    ];
    for (const [part, on] of now) {
      if (!on || this.revealed.has(part)) continue;
      this.revealed.add(part);
      document.body.classList.add(`m1-${part}`);
    }
  }

  constructor(cb: HudCallbacks) {
    void loadManifest().then((m) => { limbArt = m?.limbs ?? null; this.lastHandKey = ''; });
    this.cb = cb;
    for (const btn of document.querySelectorAll<HTMLElement>('.organ-btn[data-organ]')) {
      btn.addEventListener('click', () => {
        const organ = btn.dataset.organ as OrganId;
        this.armedOrgan = this.armedOrgan === organ ? null : organ;
        this.selectedCard = null;
        cb.onArmOrgan(this.armedOrgan);
        cb.onSelectCard(null);
      });
    }
    document.getElementById('royal-surge')!.addEventListener('click', () => cb.onRoyalSurge());
    document.getElementById('inspect-close')!.addEventListener('click', () => { this.inspectedId = null; });
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#inspect-modes button')) {
      btn.addEventListener('click', () => {
        if (this.inspectedId !== null) cb.onSetPriority(this.inspectedId, btn.dataset.mode as TargetMode);
      });
    }
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#inspect-castes button')) {
      btn.addEventListener('click', () => {
        if (this.inspectedId !== null) cb.onSetPriority(this.inspectedId, undefined, btn.dataset.caste as CasteFocus);
      });
    }
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#inspect-facing button')) {
      btn.addEventListener('click', () => {
        if (this.inspectedId !== null) cb.onSetFacing(this.inspectedId, btn.dataset.dir as RootDir);
      });
    }
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#speed-box button')) {
      btn.addEventListener('click', () => {
        for (const b of document.querySelectorAll('#speed-box button')) b.classList.remove('on');
        btn.classList.add('on');
        cb.onSpeed(Number(btn.dataset.speed));
      });
    }
    document.getElementById('overlay-restart')!.addEventListener('click', () => cb.onRestart());
    // Evolution choices: delegated, because the buttons re-render as meat changes.
    document.getElementById('inspect-evolve')!.addEventListener('click', (ev) => {
      const crown = (ev.target as HTMLElement).closest<HTMLElement>('[data-crown]');
      if (crown && !crown.classList.contains('off') && this.inspectedId !== null) { cb.onCrown(this.inspectedId); this.lastEvolveKey = ''; return; }
      const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-choice]');
      if (!btn || btn.classList.contains('off') || this.inspectedId === null) return;
      cb.onEvolve(this.inspectedId, btn.dataset.choice as UpgradeChoice);
    });
  }

  setHint(text: string): void {
    this.el.hint.textContent = text;
  }

  pushEvents(events: SimEvent[]): void {
    for (const e of events) {
      if (e.kind === 'won') {
        const d = this.lastDirective;
        const title = d === 'royal' ? 'PRIORITY ASSET NEUTRALIZED'
          : d === 'harvest' ? 'SAMPLE QUOTA FILLED'
          : 'DEPLOYMENT ORDER FULFILLED';
        this.showOverlay(
          title,
          'Deployment complete. Asset recalled for redeployment.'
          + (this.plain ? '' : ' Your service metrics have been forwarded to the Procreation Licensing Board.'),
        );
        continue;
      }
      if (e.kind === 'lost') {
        this.showOverlay(
          'ASSET TERMINATED',
          'Field asset lost to local response. A replacement organism is being cultured. '
          + 'This outcome will not reflect well on your application.',
        );
        continue;
      }
      if (e.kind === 'banked') continue; // too chatty for the feed; the wallet ticks instead
      const line = FEED_LINES[e.kind]?.(e);
      if (!line || !line.text) continue;
      const div = document.createElement('div');
      div.className = `feed-item ${line.cls}`;
      div.textContent = line.text;
      this.el.feed.prepend(div);
      window.setTimeout(() => div.remove(), 6500);
      while (this.el.feed.children.length > 9) this.el.feed.lastChild?.remove();
    }
  }

  /** The limb inspect panel: hp, stats, traits, and its targeting controls. */
  private updateInspect(sim: Sim): void {
    const panel = document.getElementById('inspect')!;
    const t = this.inspectedId !== null ? sim.towers.find((x) => x.id === this.inspectedId) : undefined;
    if (!t) {
      this.inspectedId = null;
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');
    const spec = towerSpec(t.family);
    const st = sim.statsOf(t);
    document.getElementById('inspect-name')!.textContent = spec.name.toUpperCase();
    const frac = Math.max(0, t.hp / t.maxHp);
    const fill = document.getElementById('inspect-hp-fill')!;
    fill.style.width = `${(frac * 100).toFixed(0)}%`;
    fill.style.background = frac > 0.4 ? '#7fae52' : 'var(--accent)';
    document.getElementById('inspect-hp-text')!.textContent = `${Math.ceil(t.hp)} / ${Math.ceil(t.maxHp)} HP`
      + ((t.shieldMax ?? 0) > 0 ? ` · SHIELD ${Math.ceil(t.shield ?? 0)}/${Math.ceil(t.shieldMax ?? 0)}` : '');
    const layer = !st.hitsGround ? 'AIR ONLY' : st.hitsAir ? 'AIR + GROUND' : 'GROUND';
    document.getElementById('inspect-stats')!.textContent = st.rate > 0
      ? `${layer}${st.trueSight ? ' · DETECTS' : ''} · dmg ${st.damage.toFixed(0)} · ${st.rate.toFixed(2)}/s · reach ${st.range >= 1000 ? 'the whole board' : Math.round(st.range)}`
        + ((t.streak ?? 0) > 0 && st.streakRamp > 0 ? ` · streak ${t.streak}` : '')
      : `support limb · potency ×${st.potency.toFixed(2)} · tempo ×${st.tempo.toFixed(2)} · reach ×${st.reach.toFixed(2)}`;
    // What it is affecting, in words (the board draws the links).
    document.getElementById('inspect-effect')!.textContent = this.effectText(sim, t);
    const facingRow = document.getElementById('inspect-facing-wrap')!;
    facingRow.classList.toggle('hidden', !spec.directional);
    for (const b of document.querySelectorAll<HTMLElement>('#inspect-facing button')) {
      b.classList.toggle('on', (t.facing ?? 'N') === b.dataset.dir);
    }
    const counts = new Map<string, number>();
    for (const p of t.pips) counts.set(p.family, (counts.get(p.family) ?? 0) + 1);
    const grafting = t.graftUntil !== undefined && t.graftUntil > sim.time
      ? ` · GRAFTING ${(t.graftUntil - sim.time).toFixed(1)}s: holds fire, bleeds double` : '';
    const crowned = t.crowns ? ` · CROWNED${t.crowns > 1 ? ` ×${t.crowns}` : ''}` : '';
    const sheltered = sim.crownsOver(t);
    document.getElementById('inspect-traits')!.textContent = (t.pips.length
      ? `traits: ${[...counts].map(([f, n]) => (n > 1 ? `${f}×${n}` : f)).join(', ')}`
      : 'no inherited traits')
      + (t.promotions ? ` · promoted ×${t.promotions}` : '') + crowned
      + (sheltered ? ` · under ${sheltered} crown${sheltered > 1 ? 's' : ''}` : '') + grafting;
    this.renderEvolve(sim, t);
    const armed = st.rate > 0;
    document.getElementById('inspect-modes')!.classList.toggle('muted', !armed);
    document.getElementById('inspect-castes')!.classList.toggle('muted', !armed);
    for (const b of document.querySelectorAll<HTMLElement>('#inspect-modes button')) {
      b.classList.toggle('on', (t.priority ?? 'auto') === b.dataset.mode);
    }
    for (const b of document.querySelectorAll<HTMLElement>('#inspect-castes button')) {
      b.classList.toggle('on', (t.casteFocus ?? 'any') === b.dataset.caste);
    }
  }

  /**
   * EVOLVE: the limb's three-stage tree (Tower Dominion style). The path so far
   * reads as letters; the next stage offers its two options with their price;
   * later stages are shown faint so the player can plan a path.
   */
  private renderEvolve(sim: Sim, t: Tower): void {
    const tree = UPGRADES[t.family];
    const path = t.upgrades ?? [];
    const stage = path.length;
    const cost = stage < 3 ? UPGRADE_COST[stage] : null;
    const cap = sim.evolutionCapOf(t.family);
    const affordable = cost ? sim.canAfford(cost) && stage < cap : false;
    const crownCost = sim.decreeCost('crown');
    const key = `${t.id}|${path.join('')}|${affordable ? 1 : 0}|${cap}|${t.crowns ?? 0}|${sim.meat.royal >= crownCost ? 1 : 0}`;
    if (key === this.lastEvolveKey) return;
    this.lastEvolveKey = key;
    document.getElementById('inspect-path')!.textContent = path.length ? `· ${path.join('')}` : '';
    const box = document.getElementById('inspect-evolve')!;
    const priceText = (c: { science?: number; royal?: number }) =>
      [c.science ? `${c.science}S` : '', c.royal ? `${c.royal}R` : ''].filter(Boolean).join(' + ');
    const rows: string[] = [];
    for (let i = 0; i < 3; i++) {
      const [a, b] = tree[i];
      if (i < stage) {
        const got = path[i] === 'A' ? a : b;
        rows.push(`<div class="evo-done">${i + 1}${path[i]} · <b>${got.name}</b> — ${got.text}</div>`);
      } else if (i === stage && i >= cap) {
        rows.push(`<div class="evo-later locked">${i + 1}: ${a.name} / ${b.name} — LOCKED${this.plain ? '' : ': take the territory on the globe that unlocks it'}</div>`);
      } else if (i === stage) {
        const price = priceText(UPGRADE_COST[i]);
        const opt = (o: typeof a, c: 'A' | 'B') => `<button class="evo-opt${affordable ? '' : ' off'}" data-choice="${c}"
          title="${o.text}"><b>${c} · ${o.name}</b><span>${o.text}</span><i>${price}</i></button>`;
        rows.push(`<div class="evo-stage">${opt(a, 'A')}${opt(b, 'B')}</div>`);
      } else {
        rows.push(`<div class="evo-later">${i + 1}: ${a.name} / ${b.name}${i >= cap ? ' — LOCKED on the globe' : i === 2 ? ' (needs a royal point)' : ''}</div>`);
      }
    }
    if (stage >= 3) rows.push('<div class="evo-later">fully evolved</div>');
    // ROYAL DECREE on this limb: the crown (content/royal.ts). Every other limb near it is sheltered and hits harder.
    if (!this.plain) {
      const owned = t.crowns ?? 0;
      rows.push(`<div class="evo-stage evo-royal"><button class="evo-opt${sim.meat.royal >= crownCost ? '' : ' off'}" data-crown="1"
        title="Royal decree"><b>♛ ${owned ? `crown again (×${owned + 1})` : 'crown this limb'}</b><span>every OTHER limb within 120px takes 30% less harm and hits 25% harder${owned ? ' — crowns add' : ''}</span><i>${crownCost}R</i></button></div>`);
    }
    box.innerHTML = rows.join('');
  }

  /** One line: what this limb is doing to its neighbours right now. */
  private effectText(sim: Sim, t: Tower): string {
    const links = sim.effectLinks(t);
    const name = (u: Tower) => towerSpec(u.family).name;
    switch (t.family) {
      case 'conduit':
      case 'mosaic': {
        const pool = sim.conduitPool(t).length;
        const target = links.targets[0];
        const verb = t.family === 'conduit' ? 'FUNNELLING' : 'WEAVING';
        const what = t.family === 'conduit' ? 'bonus' : 'distinct type';
        return target
          ? `${verb} ${pool} ${what}${pool === 1 ? '' : (t.family === 'conduit' ? 'es' : 's')} from ${links.sources.length} limb${links.sources.length === 1 ? '' : 's'} → ${name(target).toUpperCase()} · sacrifice to harvest`
          : `pointed at nothing — right-click to rotate toward a limb · holding ${pool} to harvest`;
      }
      case 'amp': {
        const target = links.targets[0];
        return target
          ? `AMPLIFYING ${name(target).toUpperCase()} — its bonus counts ×1.5 (${sim.ampLayers(target)} layer${sim.ampLayers(target) > 1 ? 's' : ''} on it)`
          : 'pointed at nothing — right-click to rotate toward a limb';
      }
      case 'twin': {
        const target = links.targets[0];
        return target
          ? `TWINNING ${name(target).toUpperCase()} — ${sim.statsOf(target).volley}× projectiles per shot`
          : 'pointed at nothing — right-click to rotate toward a limb';
      }
      case 'tap': {
        const target = links.targets[0];
        return target
          ? `HOLDING ${name(target).toUpperCase()} IN STASIS · sacrifice this tap to harvest +${target.pips.length + 1} bonus${target.pips.length ? 'es' : ''} (it stays)`
          : 'pointed at nothing — right-click to rotate toward a limb to milk';
      }
      case 'mitosis': {
        const target = links.targets[0];
        return target
          ? `BUDDING ${name(target).toUpperCase()} — a plain copy next to this node every cleared wave (harvest them: it stops when the spaces are full)`
          : 'must point at an ADJACENT limb — right-click to rotate';
      }
      case 'capacitor': {
        const target = links.targets[0];
        return target
          ? `CHARGING ${name(target).toUpperCase()} — ${Math.floor(target.bank ?? 0)} shots banked (fired at 400% speed)`
          : 'pointed at nothing — right-click to rotate toward a limb';
      }
      case 'boomerang': {
        const target = links.targets[0];
        return target
          ? `CALLING BACK ${name(target).toUpperCase()}'s shots — after a hit they fly home to this node`
          : 'pointed at nothing — only projectile limbs qualify (not melee, beams, cones or shells)';
      }
      case 'press': {
        const target = links.targets[0];
        return target ? `PRESSING ${name(target).toUpperCase()} — its war kills pay science` : 'pointed at nothing — right-click to rotate';
      }
      case 'reliquary': {
        const target = links.targets[0];
        return target
          ? `GUARDING ${name(target).toUpperCase()} — if it dies, its ${target.pips.length + 1} bonus${target.pips.length ? 'es are' : ' is'} banked for you`
          : 'pointed at nothing — right-click to rotate';
      }
      case 'choir':
        return `SPEEDING ${links.targets.length} limb${links.targets.length === 1 ? '' : 's'} · +${Math.round((towerSpec('choir').rateAura ?? 0) * sim.auraOf(t).strength * 100)}% fire rate each`
          + (t.pips.length ? ' · sharing its hit bonuses' : '');
      case 'ward':
        return `SHIELDING ${links.targets.length} limb${links.targets.length === 1 ? '' : 's'} · +${Math.round((towerSpec('ward').wardShield ?? 0) * sim.auraOf(t).strength)} shield each`
          + (t.pips.length ? ' · sharing its hit bonuses' : '');
      case 'bombard':
        return t.marker === undefined ? 'NO MARKER — click it, then click the map' : 'shelling its marker (gold crosshair)';
      case 'skipper':
        return `firing ${t.facing ?? 'N'} only — right-click to rotate`;
      case 'brood':
        return `${sim.broodlings.filter((b) => b.motherId === t.id).length} broodlings in the streets`;
      default: {
        // Which combo engines are working on THIS limb?
        const on = sim.towers.filter((c) => towerSpec(c.family).engine && sim.conduitTarget(c) === t);
        if (!on.length) return '';
        if (sim.isTapped(t)) return 'TAPPED — held in stasis (it does nothing while a tap milks it)';
        const n = (f: string) => on.filter((c) => c.family === f).length;
        const parts = [
          n('conduit') ? `${n('conduit')} conduit${n('conduit') > 1 ? 's' : ''}` : '',
          n('mosaic') ? `${n('mosaic')} mosaic${n('mosaic') > 1 ? 's' : ''}` : '',
          n('amp') ? `${n('amp')} amplifier${n('amp') > 1 ? 's' : ''} (×1.5 each)` : '',
          n('twin') ? `${n('twin')} twinning gland${n('twin') > 1 ? 's' : ''} (×2 shots each)` : '',
          n('capacitor') ? `${n('capacitor')} capacitor${n('capacitor') > 1 ? 's' : ''}` : '',
          n('boomerang') ? 'a boomerang' : '',
          n('press') ? 'a meat press' : '',
          n('reliquary') ? `${n('reliquary')} reliquar${n('reliquary') > 1 ? 'ies' : 'y'}` : '',
          n('mitosis') ? 'a mitosis node' : '',
        ].filter(Boolean);
        return `FED by ${parts.join(' + ')}`;
      }
    }
  }

  private showOverlay(title: string, body: string): void {
    this.el.overlayTitle.textContent = title;
    this.el.overlayBody.textContent = body;
    this.el.overlay.classList.remove('hidden');
  }

  update(sim: Sim): void {
    this.el.meat.war.textContent = String(Math.floor(sim.meat.war));
    this.el.meat.science.textContent = String(Math.floor(sim.meat.science));
    this.el.meat.royal.textContent = String(Math.floor(sim.meat.royal));

    // Directive bar: the deployment order is the win condition.
    this.lastDirective = sim.directive.kind;
    const label = document.getElementById('biomass-label')!;
    label.textContent = sim.directive.kind === 'hold'
      ? `DIRECTIVE: HOLD FOR ${sim.directive.waves} WAVES`
      : sim.directive.kind === 'royal'
        ? 'DIRECTIVE: DESTROY THE ROYAL'
        : `DIRECTIVE: BANK ${sim.directive.science} SCIENCE SAMPLES`;
    const prog = sim.directiveProgress();
    const frac = Math.min(1, prog.done / prog.goal);
    this.el.biomassFill.style.width = `${(frac * 100).toFixed(1)}%`;
    this.el.biomassText.textContent = `${Math.floor(prog.done)} / ${prog.goal}`;

    const sides = sim.waveIntelHidden ? '?' : [...new Set(sim.incomingGates.map((g) => sim.gateSide(g)))].join('+') || '?';
    this.el.phaseName.textContent = sim.phase === 'draft'
      ? 'CHOOSE A DISTRICT'
      : sim.phase === 'growth'
        ? `ASSAULT FORMING: ${sides}`
        : 'SIEGE';
    this.el.phaseName.classList.toggle('siege', sim.phase === 'siege');
    const next = sim.phase === 'growth' && !sim.waveIntelHidden
      ? Object.entries(sim.previewNextWave()).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 4).map(([k, n]) => `${n} ${k}`).join(', ')
      : '';
    this.el.waveInfo.textContent = `WAVE ${sim.waveNumber} · TIER ${sim.tier}`
      + (sim.waveRisk > 0 ? ` · RISK ${sim.waveRisk}` : '')
      + ` · MASS ${Math.floor(sim.biomass)}`
      + (next ? ` · NEXT: ${next}` : sim.waveIntelHidden && sim.phase === 'growth' ? ' · NEXT: unknown' : '');
    this.el.threat.textContent = String(Math.floor(sim.threat));
    this.el.interest.textContent = String(Math.floor(sim.interest));

    const coreFrac = Math.max(0, sim.coreHp / sim.coreMaxHp);
    this.el.coreFill.style.width = `${(coreFrac * 100).toFixed(1)}%`;
    this.el.coreFill.style.background = coreFrac > 0.4 ? 'var(--ok)' : 'var(--accent)';

    // Cards: re-render only when the hand or affordability changes.
    const handKey = sim.hand.map((c) => `${c.id}:${c.free || sim.canAfford(towerSpec(c.family).cost) ? 1 : 0}`).join(',')
      + `|${this.selectedCard}`;
    if (handKey !== this.lastHandKey) {
      this.lastHandKey = handKey;
      this.el.hand.innerHTML = '';
      sim.hand.forEach((card, i) => {
        const spec = towerSpec(card.family);
        const div = document.createElement('div');
        const affordable = !!card.free || sim.canAfford(spec.cost);
        div.className = 'card'
          + (this.selectedCard === i ? ' selected' : '')
          + (affordable ? '' : ' unaffordable');
        div.innerHTML = `<div class="card-top"><div class="card-name"></div><button class="card-discard" title="Discard (3 war meat)">✕</button></div><div class="card-tag"></div><div class="card-art"></div><div class="card-desc"></div><div class="card-cost"></div>`;
        (div.querySelector('.card-name') as HTMLElement).textContent = spec.name;
        const tag = layerTag(card.family);
        const tagEl = div.querySelector('.card-tag') as HTMLElement;
        tagEl.textContent = tag + (spec.detects !== undefined ? ' · DETECTS' : '');
        tagEl.classList.add(tag === 'GROUND' ? 'ground' : tag === 'SUPPORT' ? 'support' : 'air');
        (div.querySelector('.card-discard') as HTMLElement).addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.cb.onDiscardCard(i);
          this.lastHandKey = '';
        });
        (div.querySelector('.card-desc') as HTMLElement).textContent = CARD_DESC[card.family];
        // The limb itself, from its baked art: the card is recognised by its picture, as on the board.
        const artEl = div.querySelector('.card-art') as HTMLElement;
        const art = cardArt(card.family, 64);
        if (art) { artEl.setAttribute('style', art); artEl.dataset.limb = card.family; artEl.dataset.k = String(card.id ?? i); animateCards(this.el.hand, 64); } else artEl.remove();
        // Each caste's price in its own span (the text is the same), so a HUD style can draw the caste (src/hud/themes).
        const costEl = div.querySelector('.card-cost') as HTMLElement;
        // A free card is priced like any other: the word where the number goes, why it is free where the caste goes.
        if (card.free) {
          const part = document.createElement('span');
          part.className = 'cc cc-free';
          part.innerHTML = `<b>FREE</b>${spec.pair ? '<u>PAIR</u>' : ''}`;
          if (spec.pair) part.title = 'The second of a pair: one pick, two placements';
          costEl.append(part);
        }
        else {
          (['war', 'science', 'royal'] as Caste[]).filter((c) => (spec.cost[c] ?? 0) > 0).forEach((c, k) => {
            if (k) costEl.append(' ');
            const part = document.createElement('span');
            part.className = `cc cc-${c}`;
            part.innerHTML = `<b>${spec.cost[c]}</b><u>${c[0].toUpperCase()}</u>`;
            costEl.append(part);
          });
        }
        div.addEventListener('click', () => {
          this.selectedCard = this.selectedCard === i ? null : i;
          this.armedOrgan = null;
          this.cb.onSelectCard(this.selectedCard);
          this.cb.onArmOrgan(null);
          this.lastHandKey = '';
        });
        this.el.hand.appendChild(div);
      });
    }

    this.updateInspect(sim);
    if (this.plain) this.revealForMission1(sim);

    // Button states.
    // The royal button opens the ROYAL DECREES (src/ui/decrees.ts): lit when a point would buy one.
    const surge = document.getElementById('royal-surge')!;
    surge.classList.toggle('disabled', sim.meat.royal < 1);
    // Banked-traits indicator: lights up while a butchered limb's history waits
    // to be folded into the next build.
    const traits = document.getElementById('pending-traits');
    if (traits) {
      traits.classList.toggle('armed', sim.pendingPips.length > 0);
      (traits.querySelector('.cost') as HTMLElement).textContent = sim.pendingPips.length > 0
        ? `${sim.pendingPips.length} trait${sim.pendingPips.length > 1 ? 's' : ''} banked — next build inherits`
        : 'click a limb while a card is armed: salvage + traits';
    }
    for (const btn of document.querySelectorAll<HTMLElement>('.organ-btn[data-organ]')) {
      btn.classList.toggle('armed', this.armedOrgan === btn.dataset.organ);
    }
  }
}
