/**
 * DOM HUD: the empire's operator software. Reads sim state, renders panels,
 * translates sim events into the broadcast voice, and reports player intent
 * back to main.ts via callbacks.
 */
import { Sim, towerSpec } from '../sim/sim';
import { BALANCE as B } from '../../content/data';
import type { Caste, CasteFocus, OrganId, RootDir, SimEvent, TargetMode, Tower, TowerFamily } from '../sim/types';

const CARD_DESC: Record<TowerFamily, string> = {
  spitter: 'Ranged acid limb. Cheap, reliable.',
  burster: 'Lobs detonating polyps. Area denial.',
  lasher: 'Melee flail. Shreds crowds up close.',
  maw: 'Eats weakened specimens whole. Mass gain.',
  spine: 'Bone barricade IN the street. Chewers get barbs.',
  lure: 'Bait that bites: toxic clouds that reveal the unseen.',
  tangler: 'Snare mucus. Hit specimens wade, not march.',
  blighter: 'Spore clouds. The blight keeps eating — through armor.',
  impaler: 'Bone harpoon. Skewers a file, ignores shields.',
  choir: 'Resonance organ. Nearby limbs strike faster.',
  sling: 'Hurls creep to chosen ground. Click it to aim.',
  brood: 'Keeps 3 broodlings fighting in the streets.',
  swamp: 'Anti-wall: they wade through; the weak dissolve.',
  frond: 'One strike arcs through the whole squad.',
  lobber: 'Aimed bile volley. Click it, click ground.',
  mister: 'Shreds armor — everyone hits deeper.',
  ocular: 'Board-wide eye. Executes drummers and tenders.',
  prism: 'Focus beam that ramps. Idle prisms relay it charge.',
  bombard: 'Long-range shelling. Click it, set its marker.',
  ward: 'Shields the limbs around it. Regrows when quiet.',
  quill: 'Shotgun fan of quills. Brutal up close.',
  skipper: 'Fires ONE way, very far; shells skip on.',
  net: 'Anti-air only. Nets drag fliers to the ground.',
  ember: 'Flamethrower cone. Fire spreads body to body.',
  conduit: 'Funnels every bonus around it into the limb it points at.',
  amp: 'Target\'s bonuses ×1.5 (round down). Stack them!',
  mosaic: 'Gives its target one of EVERY bonus type nearby.',
  twin: 'Its target fires DOUBLE the projectiles.',
  tap: 'Stops its target — sacrifice the tap again and again.',
  mitosis: 'Buds a plain copy of the adjacent limb each wave.',
  capacitor: 'Banks idle shots; fires them at 400% speed.',
  boomerang: 'Its target\'s shots fly BACK to it after a hit.',
  press: 'Its target\'s kills pay SCIENCE instead of war.',
  reliquary: 'If its target dies, keep its bonuses. Comes as a PAIR.',
};

/** What each family's bonus does when it is EATEN (shown on the cannibalize hover). */
export const PIP_DESC: Record<TowerFamily, string> = {
  spitter: '+25% fire rate (or a producer cycles faster)',
  burster: '+12px splash (or a bigger effect radius)',
  lasher: '+20% damage (or a stronger effect)',
  maw: '+30% meat from its kills',
  spine: '+75 hp, and its kills leave caltrops',
  lure: '+2 interest, and its hits leave toxic pheromone clouds',
  tangler: 'its hits slow ×0.9',
  blighter: 'its hits poison +2/s',
  impaler: '+5 armor pierce',
  choir: '+8% reach',
  sling: 'needs no creep to stand on, and seeps creep',
  brood: 'heals 50% every wave (on a Broodmother: +1 broodling)',
  swamp: 'its hits digest anything left under +10 hp',
  frond: 'its hits arc to +1 more',
  lobber: 'its hits knock back 8px',
  mister: 'its hits break armor +3 (and reveal the unseen)',
  ocular: 'detects the unseen, shoots supports first, +25% vs them',
  prism: '+6% damage per shot held on one target',
  bombard: '×2 range',
  ward: '+60 permanent shield',
  quill: 'every shot also hits +1 more target',
  skipper: 'every impact skips on once more',
  net: 'can hit AIR, and its hits drag fliers down 1s',
  ember: 'its hits IGNITE +3/s — contagious fire that lights up the unseen',
  conduit: 'EVERYTHING it was channelling (harvested), plus: draws its nearest neighbour\'s bonus',
  amp: 'ALL its bonus counts ×1.5, rounded down (2→3, 4→6)',
  mosaic: 'one of each type it was channelling (harvested), plus: draws one of each type among its neighbours',
  twin: '+1 projectile on every shot',
  tap: 'a copy of the TAPPED limb\'s bonuses — and the tap stays (sacrifice it again)',
  mitosis: 'buds a plain copy of ITSELF next to it every wave',
  capacitor: 'banks its own idle shots and spends them at 400% speed',
  boomerang: 'its projectiles fly back to it after a hit',
  press: 'its war kills pay science instead',
  reliquary: 'if it dies, its bonuses are banked for your next build',
};

/** What a family can shoot, as the card and panel tag. */
export function layerTag(family: TowerFamily): string {
  const spec = towerSpec(family);
  if (spec.rate <= 0 && family !== 'lobber' && family !== 'bombard' && family !== 'spine' && family !== 'swamp' && family !== 'lure') return 'SUPPORT';
  const h = spec.hits ?? 'both';
  return h === 'both' ? 'AIR + GROUND' : h === 'air' ? 'AIR ONLY' : 'GROUND';
}

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
  'structure-lost': (e) => e.kind === 'structure-lost'
    ? { text: `limb lost: ${e.what}`, cls: 'hot' }
    : { text: '', cls: '' },
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
  private lastDirective: 'hold' | 'royal' | 'harvest' = 'hold';

  constructor(cb: HudCallbacks) {
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
          'Deployment complete. Asset recalled for redeployment. '
          + 'Your service metrics have been forwarded to the Procreation Licensing Board.',
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
      ? `${layer}${st.trueSight ? ' · DETECTS' : ''} · dmg ${st.damage.toFixed(0)} · ${st.rate.toFixed(2)}/s · reach ${Math.round(st.range)}`
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
    document.getElementById('inspect-traits')!.textContent = t.pips.length
      ? `traits: ${[...counts].map(([f, n]) => (n > 1 ? `${f}×${n}` : f)).join(', ')}`
      : 'no inherited traits';
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

    const sides = [...new Set(sim.incomingGates.map((g) => sim.gateSide(g)))].join('+') || '?';
    this.el.phaseName.textContent = sim.phase === 'draft'
      ? 'CHOOSE A DISTRICT'
      : sim.phase === 'growth'
        ? `ASSAULT FORMING: ${sides}`
        : 'SIEGE';
    this.el.phaseName.classList.toggle('siege', sim.phase === 'siege');
    this.el.waveInfo.textContent = `WAVE ${sim.waveNumber} · TIER ${sim.tier}`
      + (sim.waveRisk > 0 ? ` · RISK ${sim.waveRisk}` : '')
      + ` · MASS ${Math.floor(sim.biomass)}`;
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
        const cost = (['war', 'science', 'royal'] as Caste[])
          .filter((c) => (spec.cost[c] ?? 0) > 0)
          .map((c) => `${spec.cost[c]}${c[0].toUpperCase()}`)
          .join(' ');
        div.innerHTML = `<div class="card-top"><div class="card-name"></div><button class="card-discard" title="Discard (3 war meat)">✕</button></div><div class="card-tag"></div><div class="card-desc"></div><div class="card-cost"></div>`;
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
        (div.querySelector('.card-cost') as HTMLElement).textContent = card.free ? 'FREE (the pair)' : cost;
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

    // Button states.
    const surge = document.getElementById('royal-surge')!;
    surge.classList.toggle('disabled', sim.meat.royal < B.royalSurgeCost);
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
