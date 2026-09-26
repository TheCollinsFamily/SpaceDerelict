/**
 * DOM HUD: the empire's operator software. Reads sim state, renders panels,
 * translates sim events into the broadcast voice, and reports player intent
 * back to main.ts via callbacks.
 */
import { Sim, towerSpec } from '../sim/sim';
import { BALANCE as B } from '../../content/data';
import type { Caste, OrganId, SimEvent, TowerFamily } from '../sim/types';

const CARD_DESC: Record<TowerFamily, string> = {
  spitter: 'Ranged acid limb. Cheap, reliable.',
  burster: 'Lobs detonating polyps. Area denial.',
  lasher: 'Melee flail. Shreds crowds up close.',
  maw: 'Eats weakened specimens whole. Mass gain.',
  spine: 'Dense barricade of bone. Holds a line.',
  lure: 'Scent bloom. Draws curious specimens.',
  tangler: 'Snare mucus. Hit specimens wade, not march.',
  blighter: 'Spore clouds. The blight keeps eating — through armor.',
  impaler: 'Bone harpoon. Skewers a file, ignores shields.',
  choir: 'Resonance organ. Nearby limbs strike faster.',
  sling: 'Hurls creep to chosen ground. Click it to aim.',
  brood: 'Keeps 3 broodlings fighting in the streets.',
  pit: 'A mouth IN the street. Holds and digests.',
  frond: 'One strike arcs through the whole squad.',
  lobber: 'Aimed bile volley. Click it, click ground.',
  mister: 'Shreds armor — everyone hits deeper.',
  ocular: 'Board-wide eye. Executes drummers and tenders.',
};

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
    const handKey = sim.hand.map((c) => `${c.id}:${sim.canAfford(towerSpec(c.family).cost) ? 1 : 0}`).join(',')
      + `|${this.selectedCard}`;
    if (handKey !== this.lastHandKey) {
      this.lastHandKey = handKey;
      this.el.hand.innerHTML = '';
      sim.hand.forEach((card, i) => {
        const spec = towerSpec(card.family);
        const div = document.createElement('div');
        const affordable = sim.canAfford(spec.cost);
        div.className = 'card'
          + (this.selectedCard === i ? ' selected' : '')
          + (affordable ? '' : ' unaffordable');
        const cost = (['war', 'science', 'royal'] as Caste[])
          .filter((c) => (spec.cost[c] ?? 0) > 0)
          .map((c) => `${spec.cost[c]}${c[0].toUpperCase()}`)
          .join(' ');
        div.innerHTML = `<div class="card-top"><div class="card-name"></div><button class="card-discard" title="Discard (3 war meat)">✕</button></div><div class="card-desc"></div><div class="card-cost"></div>`;
        (div.querySelector('.card-name') as HTMLElement).textContent = spec.name;
        (div.querySelector('.card-discard') as HTMLElement).addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.cb.onDiscardCard(i);
          this.lastHandKey = '';
        });
        (div.querySelector('.card-desc') as HTMLElement).textContent = CARD_DESC[card.family];
        (div.querySelector('.card-cost') as HTMLElement).textContent = cost;
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
