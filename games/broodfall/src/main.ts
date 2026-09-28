/**
 * Broodfall entry: wires sim + renderer + HUD + full game loop
 * (menu → deployment → debrief → ship gene bay → redeploy),
 * owns the fixed-timestep loop, input, the district-draft overlay,
 * wave banners, and demo mode (?auto=1&seed=N&speed=M).
 */
import { Autoplayer } from './sim/autoplayer';
import { DT, Sim, organSpec, towerSpec } from './sim/sim';
import { Renderer } from './render/render';
import { Hud, PIP_DESC } from './ui/hud';
import { GENES } from '../content/plates';
import { BALANCE as B } from '../content/data';
import { PLATE_FEATURES } from './sim/citymap';
import type { Directive, OrganId, RootDir, SimConfig, SimEvent, TowerFamily } from './sim/types';

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') ?? Math.floor(Math.random() * 1e9));
const AUTO = params.get('auto') === '1';
const AUTOSTART = AUTO || params.get('autostart') === '1';
const START_SPEED = Number(params.get('speed') ?? 1);

const DIRECTIVES: Record<string, Directive> = {
  hold: { kind: 'hold', waves: 12 },
  royal: { kind: 'royal', count: 1 },
  harvest: { kind: 'harvest', science: 80 },
};
const directive = DIRECTIVES[params.get('directive') ?? ''];

// ---------- persistent meta (ship progression) ----------

interface Meta { standing: number; genes: string[]; runs: number; entrances?: number }

function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem('broodfall-meta');
    if (raw) return JSON.parse(raw) as Meta;
  } catch { /* private mode etc. */ }
  return { standing: 0, genes: [], runs: 0 };
}

function saveMeta(m: Meta): void {
  try { localStorage.setItem('broodfall-meta', JSON.stringify(m)); } catch { /* ok */ }
}

const meta = loadMeta();

const ENTRANCES = Math.max(1, Math.min(3,
  Number(params.get('entrances')) || meta.entrances || 1));

const CFG: SimConfig = {
  gridW: 50, gridH: 40, cellPx: 26, seed: SEED, directive, genes: meta.genes,
  entrances: ENTRANCES,
};

let sim = new Sim(CFG);
const auto = AUTO ? new Autoplayer(SEED + 1) : null;
let speed = Number.isFinite(START_SPEED) && START_SPEED >= 0 ? START_SPEED : 1;
let started = AUTOSTART;
let debriefShown = false;

const renderer = new Renderer();

let selectedCard: number | null = null;
let armedOrgan: OrganId | null = null;
/** Tower under the pointer that a click would cannibalize (card armed + hover). */
let hoverDonorId: number | null = null;
/** Aimed structure waiting for a target (armed by clicking the built sling/lobber). */
let armedThrower: { id: number; family: 'sling' | 'lobber' | 'bombard' } | null = null;
/** Facing a DIRECTIONAL card will be placed with (right-click rotates while placing). */
let placeFacing: RootDir | null = null;
const FACING_ORDER: RootDir[] = ['N', 'E', 'S', 'W'];
const nextFacing = (d: RootDir): RootDir => FACING_ORDER[(FACING_ORDER.indexOf(d) + 1) % 4];

function selectedIsDirectional(): boolean {
  const fam = selectedCard !== null ? sim.hand[selectedCard]?.family : undefined;
  return fam !== undefined && !!towerSpec(fam).directional;
}

const hud = new Hud({
  onSelectCard(i) {
    selectedCard = i;
    placeFacing = null; // a fresh pick starts facing the nearest gate
    updateHint();
  },
  onDiscardCard(i) {
    sim.issue({ kind: 'discard', cardIndex: i });
    if (selectedCard === i) selectedCard = null;
  },
  onArmOrgan(o) {
    armedOrgan = o;
    updateHint();
  },
  onRoyalSurge() {
    sim.issue({ kind: 'royal-surge' });
  },
  onSpeed(mult) {
    speed = mult;
  },
  onRestart() {
    showDebrief();
  },
  onSetPriority(towerId, mode, caste) {
    sim.issue({ kind: 'set-priority', towerId, mode, caste });
  },
  onSetFacing(towerId, dir) {
    sim.issue({ kind: 'set-facing', towerId, dir });
  },
  onEvolve(towerId, choice) {
    const r = sim.issue({ kind: 'evolve', towerId, choice });
    if (!r.ok) hud.setHint(r.err === 'cannot afford' ? 'NOT ENOUGH SCIENCE (STAGE 3 ALSO NEEDS A ROYAL POINT)' : String(r.err).toUpperCase());
  },
});

function salvageText(family: TowerFamily): string {
  const salv = sim.salvageOf(family);
  const parts = (['war', 'science', 'royal'] as const)
    .filter((c) => (salv[c] ?? 0) > 0)
    .map((c) => `${salv[c]}${c[0].toUpperCase()}`);
  return parts.join(' ') || 'no';
}

function updateHint(): void {
  if (armedThrower !== null) {
    hud.setHint(armedThrower.family === 'sling'
      ? 'SPORE SLING ARMED: click any claimed ground in range — the clot seeds new skin to build on (right-click cancels)'
      : armedThrower.family === 'lobber'
        ? 'BILE LOBBER ARMED: click ground in range — the volley detonates on whatever stands there (right-click cancels)'
        : 'BOMBARD: click ground in range to set its MARKER — it shells that spot whenever the hive is there (right-click cancels)');
  } else if (armedOrgan) {
    hud.setHint(`place ${organSpec(armedOrgan).name} on open ground inside the body`);
  } else if (selectedCard !== null && hoverDonorId !== null) {
    const donor = sim.towers.find((t) => t.id === hoverDonorId);
    if (donor && donor.family === 'tap') {
      const target = sim.conduitTarget(donor);
      hud.setHint(target
        ? `MILK THE TAP: +${target.pips.length + 1} bonus${target.pips.length ? 'es' : ''} from ${towerSpec(target.family).name.toUpperCase()} — the tap STAYS (milk it again any time) · no salvage`
        : 'this tap points at nothing — rotate it (right-click, no card armed) toward a limb to milk');
      return;
    }
    if (donor) {
      const deps = sim.dependentsOf(donor.id);
      const harvest = donor.family === 'conduit' ? sim.conduitPool(donor).length : 0;
      hud.setHint(`CANNIBALIZE ${towerSpec(donor.family).name.toUpperCase()}: `
        + `${salvageText(donor.family)} meat back · new limb gets: ${PIP_DESC[donor.family]}`
        + (donor.pips.length ? ` (+${donor.pips.length} inherited)` : '')
        + (harvest ? ` · HARVESTS ${harvest} channelled bonus${harvest > 1 ? 'es' : ''}` : '')
        + (deps > 0 ? ` · WARNING: ${deps} limb${deps > 1 ? 's' : ''} stand on its creep and will WITHER` : ''));
      return;
    }
    hoverDonorId = null;
    updateHint();
  } else if (selectedCard !== null && sim.pendingPips.length > 0) {
    hud.setHint(`${sim.pendingPips.length} trait${sim.pendingPips.length > 1 ? 's' : ''} banked — `
      + 'place the new limb to inherit them (or eat another)');
  } else if (selectedCard !== null) {
    const fam = sim.hand[selectedCard]?.family;
    hud.setHint(selectedIsDirectional()
      ? `place it — it faces ${placeFacing ?? 'the nearest gate'} · RIGHT-CLICK to rotate · Esc to cancel`
      : fam === 'spine' || fam === 'swamp'
        ? 'plug a street — the swarm must go through it'
        : 'place on a creeped block by a street (higher = longer reach) — or click one of your limbs to feed it in');
  } else {
    hud.setHint(AUTO
      ? 'demo mode: the asset is piloting itself'
      : 'select a limb card below, then click a creeped block by a street — the assault forms at the glowing gate');
  }
}

// ---------- banners ----------

const bannerEl = document.getElementById('banner')!;
function banner(text: string): void {
  bannerEl.textContent = text;
  bannerEl.classList.remove('hidden');
  // retrigger the CSS animation
  bannerEl.style.animation = 'none';
  void (bannerEl as HTMLElement).offsetWidth;
  bannerEl.style.animation = '';
}

function handleEvents(events: SimEvent[]): void {
  hud.pushEvents(events);
  for (const e of events) {
    if (e.kind === 'wave-start') banner(`WAVE ${e.wave} — ASSAULT FROM ${e.sides}`);
    if (e.kind === 'wave-cleared') banner(`WAVE ${e.wave} CLEARED · +${e.bonus} WAR MEAT`);
    if (e.kind === 'royal-incoming') banner('THE ROYAL TAKES THE FIELD');
    if (e.kind === 'plate-drafted') banner(`DISTRICT CONSUMED: ${e.name.toUpperCase()}`);
    if ((e.kind === 'won' || e.kind === 'lost') && !AUTO) {
      window.setTimeout(showDebrief, 1600);
    }
  }
}

// ---------- district draft overlay ----------

const draftEl = document.getElementById('draft')!;
const draftOptionsEl = document.getElementById('draft-options')!;
let draftRendered = false;

function slotCompass(slot: number): string {
  const sx = (slot % sim.map.slotsX) + 0.5;
  const sy = Math.floor(slot / sim.map.slotsX) + 0.5;
  const cx = (sim.core.x / sim.cfg.cellPx) / 10;
  const cy = (sim.core.y / sim.cfg.cellPx) / 10;
  const dx = sx - cx;
  const dy = sy - cy;
  const ns = dy < -0.4 ? 'N' : dy > 0.4 ? 'S' : '';
  const ew = dx > 0.4 ? 'E' : dx < -0.4 ? 'W' : '';
  return (ns + ew) || 'CENTER';
}

function renderDraft(): void {
  if (!sim.pendingDraft) return;
  draftOptionsEl.innerHTML = '';
  sim.pendingDraft.forEach((offer, i) => {
    const card = document.createElement('div');
    card.className = 'draft-option';
    const feat = PLATE_FEATURES[offer.feature];
    const grid = offer.pattern.rows.map((row) => [...row].map((ch) => {
      const cls = ch === '.' ? 'c-road' : ch === 'P' ? 'c-plaza' : ch === 'A' ? 'c-b2' : ch === 'B' ? 'c-b3' : 'c-b1';
      return `<div class="df-cell ${cls}"></div>`;
    }).join('')).join('');
    card.innerHTML = `<div class="df-name"></div><div class="df-desc"></div>`
      + `<div class="df-grid">${grid}</div><div class="df-where"></div>`;
    (card.querySelector('.df-name') as HTMLElement).textContent = feat.name;
    (card.querySelector('.df-desc') as HTMLElement).textContent = feat.desc;
    (card.querySelector('.df-where') as HTMLElement).textContent = `GROW ${slotCompass(offer.slot)}`;
    card.addEventListener('click', () => {
      sim.issue({ kind: 'choose-plate', index: i });
      draftEl.classList.add('hidden');
      draftRendered = false;
    });
    draftOptionsEl.appendChild(card);
  });
}

// ---------- screens: menu / debrief / ship ----------

const menuEl = document.getElementById('menu')!;
const debriefEl = document.getElementById('debrief')!;
const shipEl = document.getElementById('ship')!;

function wireEntrancePicker(containerId: string): void {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.querySelectorAll<HTMLElement>('.ent-opt').forEach((btn) => {
    btn.classList.toggle('on', Number(btn.dataset.ent) === (meta.entrances ?? 1));
    btn.addEventListener('click', () => {
      meta.entrances = Number(btn.dataset.ent);
      saveMeta(meta);
      wrap.querySelectorAll('.ent-opt').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
    });
  });
}

function setupMenu(): void {
  const genesNote = document.getElementById('menu-genes')!;
  genesNote.textContent = meta.genes.length
    ? `Spliced genes: ${meta.genes.map((id) => GENES.find((g) => g.id === id)?.name ?? id).join(', ')} · Standing: ${meta.standing}`
    : 'Baseline organism. No splices on record.';
  wireEntrancePicker('menu-entrances');
  document.getElementById('menu-deploy')!.addEventListener('click', () => {
    // The wager applies from the NEXT board build; reload if it differs.
    if ((meta.entrances ?? 1) !== ENTRANCES) {
      const q = new URLSearchParams(location.search);
      q.set('autostart', '1');
      q.set('entrances', String(meta.entrances ?? 1));
      location.href = `${location.pathname}?${q.toString()}`;
      return;
    }
    menuEl.classList.add('hidden');
    started = true;
  });
  if (AUTOSTART) menuEl.classList.add('hidden');
}

function standingEarned(): number {
  return sim.outcome === 'won' ? 10 + sim.wavesCleared : Math.floor(sim.wavesCleared / 2);
}

function showDebrief(): void {
  if (debriefShown) return;
  debriefShown = true;
  const won = sim.outcome === 'won';
  document.getElementById('debrief-title')!.textContent = won ? 'DIRECTIVE FULFILLED' : 'ASSET TERMINATED';
  const p = sim.directiveProgress();
  document.getElementById('debrief-body')!.innerHTML = '';
  const lines = [
    `Directive progress: ${Math.floor(p.done)} / ${p.goal}.`,
    `Waves repelled: ${sim.wavesCleared}. Districts held: ${sim.map.slots.filter(Boolean).length}.`,
    `Peak mass: ${Math.floor(sim.biomass)}. Residual integrity: ${Math.max(0, Math.floor(sim.coreHp))}.`,
    `Standing earned: ${standingEarned()}. ${won ? 'The Board notes your efficiency.' : 'The Board notes the loss of Navy property.'}`,
  ];
  for (const line of lines) {
    const div = document.createElement('div');
    div.textContent = line;
    document.getElementById('debrief-body')!.appendChild(div);
  }
  debriefEl.classList.remove('hidden');
}

function setupScreens(): void {
  document.getElementById('debrief-ship')!.addEventListener('click', () => {
    debriefEl.classList.add('hidden');
    showShip();
  });
  document.getElementById('ship-deploy')!.addEventListener('click', () => {
    const q = new URLSearchParams();
    q.set('autostart', '1');
    q.set('entrances', String(meta.entrances ?? 1));
    if (params.get('directive')) q.set('directive', params.get('directive')!);
    location.href = `${location.pathname}?${q.toString()}`;
  });
}

function showShip(): void {
  meta.standing += standingEarned();
  meta.runs += 1;
  saveMeta(meta);
  document.getElementById('ship-standing')!.textContent =
    `Service standing: ${meta.standing}. Procreation license review at 200. `
    + 'One splice is authorized for the replacement organism.';
  wireEntrancePicker('ship-entrances');
  const wrap = document.getElementById('ship-genes')!;
  wrap.innerHTML = '';
  const available = GENES.filter((g) => !meta.genes.includes(g.id));
  const offer = available.slice((meta.runs * 3) % Math.max(1, available.length))
    .concat(available)
    .slice(0, 3);
  let picked = false;
  offer.forEach((gene) => {
    const card = document.createElement('div');
    card.className = 'gene-card';
    card.innerHTML = '<div class="g-name"></div><div class="g-desc"></div>';
    (card.querySelector('.g-name') as HTMLElement).textContent = gene.name;
    (card.querySelector('.g-desc') as HTMLElement).textContent = gene.desc;
    card.addEventListener('click', () => {
      if (picked) return;
      picked = true;
      card.classList.add('picked');
      meta.genes.push(gene.id);
      saveMeta(meta);
    });
    wrap.appendChild(card);
  });
  shipEl.classList.remove('hidden');
}

// ---------- input on the board ----------

function handleCanvasClick(clientX: number, clientY: number): void {
  const w = renderer.toWorld(clientX, clientY);
  const cell = sim.cellAt(w.x, w.y);

  // An armed sling/lobber throws at whatever claimed ground is clicked.
  if (armedThrower !== null) {
    const res = sim.issue(armedThrower.family === 'sling'
      ? { kind: 'sling-throw', towerId: armedThrower.id, cell }
      : armedThrower.family === 'lobber'
        ? { kind: 'bile-throw', towerId: armedThrower.id, cell }
        : { kind: 'set-marker', towerId: armedThrower.id, cell });
    if (res.ok) {
      armedThrower = null;
      renderer.slingArm = null;
      updateHint();
    }
    return;
  }

  if (selectedCard === null && armedOrgan === null) {
    for (const o of sim.organs) {
      if (o.organ === 'gland' && Math.hypot(o.pos.x - w.x, o.pos.y - w.y) < 20) {
        sim.issue({ kind: 'cycle-gland', organInstanceId: o.id });
        return;
      }
      if (o.organ === 'root' && Math.hypot(o.pos.x - w.x, o.pos.y - w.y) < 20) {
        sim.issue({ kind: 'cycle-root', organInstanceId: o.id });
        return;
      }
    }
    // Clicking one of your limbs opens its panel (hp, traits, targeting).
    // A sling or lobber ALSO arms its throw — object-initiated, no mode button.
    const clicked = towerNearWorld(w.x, w.y);
    if (clicked) {
      const t = sim.towers.find((x) => x.id === clicked.id)!;
      hud.inspectedId = t.id;
      renderer.selectedTowerId = t.id;
      if (t.family === 'sling' || t.family === 'lobber' || t.family === 'bombard') {
        const name = t.family === 'sling' ? 'spore sling' : 'bile lobber';
        // The bombard's marker can be re-set any time; the throwers recharge.
        if (t.family !== 'bombard' && t.cooldown > 0) {
          hud.setHint(`${name} recharging — ${Math.ceil(t.cooldown)}s`);
          return;
        }
        armedThrower = { id: t.id, family: t.family };
        renderer.slingArm = {
          x: t.pos.x, y: t.pos.y,
          range: t.family === 'sling' ? sim.slingRangeOf(t) : sim.statsOf(t).range,
        };
        updateHint();
      }
      return;
    }
    // Empty ground with nothing armed: close the panel.
    hud.inspectedId = null;
    renderer.selectedTowerId = null;
  }

  if (armedOrgan) {
    const res = sim.issue({ kind: 'build-organ', organ: armedOrgan, cell });
    if (res.ok) {
      armedOrgan = null;
      hud.armedOrgan = null;
      updateHint();
    }
    return;
  }

  if (selectedCard !== null) {
    // Clicking one of your limbs with a card armed EATS it on the spot:
    // salvage is credited immediately, its traits fold into the next build.
    const donor = towerNearWorld(w.x, w.y);
    if (donor) {
      sim.issue({ kind: 'butcher', towerId: donor.id });
      hoverDonorId = null;
      renderer.donorHighlightId = null;
      updateHint();
      return;
    }
    const res = sim.issue({
      kind: 'build', cardIndex: selectedCard, cell,
      facing: selectedIsDirectional() ? currentPlaceFacing(cell) : undefined,
    });
    if (res.ok) {
      selectedCard = null;
      hud.selectedCard = null;
      hoverDonorId = null;
      placeFacing = null;
      renderer.donorHighlightId = null;
      renderer.preview = null;
      updateHint();
    }
  }
}

/** The facing a directional placement will use: the player's rotation, else toward the nearest gate. */
function currentPlaceFacing(cell: number): RootDir {
  return placeFacing ?? sim.facingTowardGate(sim.cellCenter(cell));
}

/** Cancel whatever is armed (cards, organs, throwers) and close the panel. */
function cancelAll(): void {
  selectedCard = null;
  armedOrgan = null;
  hoverDonorId = null;
  armedThrower = null;
  placeFacing = null;
  renderer.slingArm = null;
  renderer.donorHighlightId = null;
  renderer.preview = null;
  hud.selectedCard = null;
  hud.armedOrgan = null;
  hud.inspectedId = null;
  renderer.selectedTowerId = null;
  updateHint();
}

/** The player's own tower under a world point (click/hover pick radius). */
function towerNearWorld(x: number, y: number): { id: number } | null {
  for (const t of sim.towers) {
    if (Math.hypot(t.pos.x - x, t.pos.y - y) < 22) return t;
  }
  return null;
}

// ---------- boot ----------

async function boot(): Promise<void> {
  const mount = document.getElementById('stage')!;
  await renderer.init(mount, CFG.gridW * CFG.cellPx, CFG.gridH * CFG.cellPx);
  setupMenu();
  setupScreens();

  renderer.app.canvas.addEventListener('click', (ev) => handleCanvasClick(ev.clientX, ev.clientY));
  // RIGHT-CLICK: rotates a directional card being placed, or a built directional
  // limb under the cursor; otherwise it cancels. (Esc always cancels.)
  renderer.app.canvas.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    const w = renderer.toWorld(ev.clientX, ev.clientY);
    if (selectedCard !== null && selectedIsDirectional() && hoverDonorId === null) {
      placeFacing = nextFacing(currentPlaceFacing(sim.cellAt(w.x, w.y)));
      if (renderer.preview) renderer.preview.facing = placeFacing;
      updateHint();
      return;
    }
    if (selectedCard === null && armedOrgan === null && armedThrower === null) {
      const near = towerNearWorld(w.x, w.y);
      const t = near ? sim.towers.find((x) => x.id === near.id) : undefined;
      if (t && towerSpec(t.family).directional) {
        sim.issue({ kind: 'set-facing', towerId: t.id, dir: nextFacing(t.facing ?? 'N') });
        hud.inspectedId = t.id;
        renderer.selectedTowerId = t.id;
        return;
      }
    }
    cancelAll();
  });
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') cancelAll();
  });
  renderer.app.canvas.addEventListener('pointermove', (ev) => {
    if (selectedCard === null && armedOrgan === null) {
      renderer.preview = null;
      if (hoverDonorId !== null) {
        hoverDonorId = null;
        renderer.donorHighlightId = null;
      }
      return;
    }
    const w = renderer.toWorld(ev.clientX, ev.clientY);
    const cell = sim.cellAt(w.x, w.y);
    // Hovering one of your limbs with a card armed shows the cannibalize
    // affordance instead of a placement preview.
    if (selectedCard !== null && armedOrgan === null) {
      const donor = towerNearWorld(w.x, w.y);
      const donorId = donor ? donor.id : null;
      if (donorId !== hoverDonorId) {
        hoverDonorId = donorId;
        renderer.donorHighlightId = donorId;
        updateHint();
      }
      if (donorId !== null) {
        renderer.preview = null;
        return;
      }
    }
    const fam = sim.hand[selectedCard!]?.family;
    renderer.preview = armedOrgan
      ? { cell, kind: 'organ', valid: sim.canBuildOrgan(cell) }
      : {
        cell, kind: 'tower', family: fam, valid: sim.canBuildTower(cell, fam),
        facing: selectedIsDirectional() ? currentPlaceFacing(cell) : undefined,
        pips: sim.pendingPips,
      };
  });

  const callEarlyBtn = document.getElementById('call-early')! as HTMLButtonElement;
  callEarlyBtn.addEventListener('click', () => sim.issue({ kind: 'call-early' }));

  if (AUTO) updateHint();

  let last = performance.now();
  let acc = 0;
  const frame = (now: number) => {
    const dtReal = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (started) {
      acc += dtReal * speed;
      let steps = 0;
      while (acc >= DT && steps < 64) {
        if (auto) auto.act(sim, DT);
        sim.tick();
        acc -= DT;
        steps++;
      }
    }
    handleEvents(sim.takeEvents());
    hud.update(sim);
    // Draft overlay lifecycle (manual play only; the autoplayer picks itself).
    if (!AUTO) {
      if (sim.phase === 'draft' && !draftRendered && sim.pendingDraft) {
        renderDraft();
        draftEl.classList.remove('hidden');
        draftRendered = true;
      } else if (sim.phase !== 'draft' && draftRendered) {
        draftEl.classList.add('hidden');
        draftRendered = false;
      }
      callEarlyBtn.classList.toggle('hidden', sim.phase !== 'growth' || sim.outcome !== 'playing');
    } else {
      callEarlyBtn.classList.add('hidden');
    }
    renderer.draw(sim, dtReal);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // AI-play pathway: everything a scripted player (or Claude) needs without
  // clicking pixels. step(n) advances synchronously (no rAF throttle).
  const api = {
    sim,
    step(n: number): void {
      started = true;
      menuEl.classList.add('hidden');
      for (let i = 0; i < n && sim.outcome === 'playing'; i++) {
        if (auto) auto.act(sim, DT);
        else if (sim.phase === 'draft') break; // manual play: draft waits for a choice
        sim.tick();
      }
      handleEvents(sim.takeEvents());
      hud.update(sim);
      renderer.draw(sim, 0.016);
    },
    play(cmd: Parameters<Sim['issue']>[0]): { ok: boolean; err?: string } {
      const r = sim.issue(cmd);
      hud.update(sim);
      renderer.draw(sim, 0.016);
      return r;
    },
    summary() {
      return {
        time: sim.time, outcome: sim.outcome, phase: sim.phase, wave: sim.waveNumber,
        tier: sim.tier, directive: sim.directive, progress: sim.directiveProgress(),
        meat: sim.meat, biomass: sim.biomass, coreHp: sim.coreHp,
        towers: sim.towers.map((t) => ({ id: t.id, family: t.family, cell: t.cell, pips: t.pips.length, hp: t.hp })),
        organs: sim.organs.map((o) => ({ id: o.id, organ: o.organ, cell: o.cell, mode: o.glandMode })),
        enemies: sim.enemies.length,
        hand: sim.hand.map((c) => c.family),
        interest: sim.interest, threat: sim.threat,
        draft: sim.pendingDraft?.map((o) => ({ id: o.pattern.id, slot: o.slot, feature: o.feature })) ?? null,
        entrances: sim.entrances,
        districts: sim.map.slots.filter(Boolean).length,
        gates: sim.gates.length,
      };
    },
    camera() {
      return renderer.camera();
    },
    /** World coords -> canvas-pixel coords (for scripted clicking/sampling). */
    worldToScreen(x: number, y: number) {
      const c = renderer.camera();
      return { x: x * c.scale + c.x, y: y * c.scale + c.y, vw: c.vw, vh: c.vh };
    },
    buildableCells(limit = 40): number[] {
      const out: number[] = [];
      for (let c = 0; c < sim.map.cells.length && out.length < limit; c++) {
        if (sim.canBuildTower(c)) out.push(c);
      }
      return out;
    },
  };
  (window as unknown as { broodfall: typeof api }).broodfall = api;
}

void boot();
