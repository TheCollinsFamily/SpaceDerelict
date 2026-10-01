/**
 * Broodfall entry: wires sim + renderer + HUD + full game loop
 * (menu → deployment → debrief → ship gene bay → redeploy),
 * owns the fixed-timestep loop, input, the district-draft overlay,
 * wave banners, and demo mode (?auto=1&seed=N&speed=M).
 */
import { Autoplayer } from './sim/autoplayer';
import { DT, Sim, organSpec, towerSpec } from './sim/sim';
import { Renderer, type PlacementPreview } from './render/render';
import { hideReachTip, reachText, showReachTip } from './ui/reachTip';
import { IsoRenderer } from './render/isoRender';
import { BoardArtSet, artUrl, loadManifest, pickBiome } from './render/art';
import { Hud, PIP_DESC } from './ui/hud';
import { DecreeBox } from './ui/decrees';
import { UndergroundScreen } from './ui/underground';
import { CampaignUi } from './ui/campaignUi';
import { finish, newCampaign, plan, territory as territoryDef, type CampaignState, type DeploymentPlan } from './meta/campaign';
import { goalText, measure, type RunReport } from './meta/goals';
import { clearCampaign, clearPending, forgetEverything, introSeen, loadCampaign, loadPending, markIntroSeen, saveCampaign, savePending, veteran } from './meta/storage';
import { FIRST_MISSION, isFirstMission, launchKind, type Launch } from './meta/onboarding';
import { loadIntroArt, playIntro } from './ui/intro';
import { loadLandingArt, playLanding, type LandingBoard } from './ui/landing';
import { landingDecision, landingSeen, markLandingSeen, type LandingArt, type LandingFilm } from './meta/landing';
import { ConsoleMenu } from './ui/menu';
import { addRunButton, installEdgeScroll, markSpeed, openSettings, settingsOpen } from './ui/settings';
import { addCodexRunButton, codexOpen, openCodex } from './ui/codex';
import { turnOf } from './meta/settings';
import { loadSettings } from './meta/storage';
import { strainIcons, strainKey, strainLabel } from './ui/strain';
import { GENES } from '../content/plates';
import { BALANCE as B } from '../content/data';
import { CellType, PLATE, PLATE_FEATURES, draftOffers } from './sim/citymap';
import { Rng } from './sim/rng';
import { LoadingScreen, applyName, dressLogos, loadScreenArt, showArtNotice, showFailure, showSlowDrawingNotice } from './ui/screens';
import { debriefPictures, type Outcome } from './ui/debrief';
import { newsAfterDeployment } from './ui/newsreel';
import { padOutroPlaying, playPadOutro, preloadPadOutro } from './ui/padOutro';
import { shipLoop, withLoader } from './ui/loader';
import { platePicture } from './render/platePreview';
import type { Directive, OrganId, RootDir, SimConfig, SimEvent, TowerFamily } from './sim/types';
import { initAudio, setScene } from './audio/engine';
import { boardEvents, installConsoleSounds, watchBoard } from './audio/gameSounds';
import { sceneOf, type MusicScene } from './audio/cues';

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') ?? Math.floor(Math.random() * 1e9));
const AUTO = params.get('auto') === '1';

/** A new campaign that unfolds (src/meta/onboarding.ts), with mission 1 waiting to be played. */
function startOnboarding(): void {
  clearCampaign();
  saveCampaign(newCampaign(Math.floor(Math.random() * 1e9), { onboarding: true }));
  savePending({ territory: FIRST_MISSION, dares: [], objectors: [] });
}

/**
 * How the page opens when it is started with no address of its own (the launcher, `npm start`):
 * the first launch plays the cinematic and goes straight into mission 1; a first mission left
 * unfinished is gone back into; after that, the ship's console menu (src/meta/onboarding.ts).
 */
const BARE = !location.search || location.search === '?';
let launch: Launch | null = null;
if (BARE) {
  const saved = loadCampaign();
  launch = launchKind({ hasCampaign: !!saved, mission1Pending: !!saved && isFirstMission(saved), introSeen: introSeen(), veteran: veteran() });
  if (launch === 'first') startOnboarding();
  else if (launch === 'mission1' && !loadPending()) savePending({ territory: FIRST_MISSION, dares: [], objectors: [] });
}
/** 'ship' = open the ship; 'run' = play the pending campaign deployment. */
const CAMPAIGN = params.get('campaign') ?? (launch === 'first' || launch === 'mission1' ? 'run' : null);
/** The opening cinematic plays in front of this page: on the first launch (until it has been seen once), or asked for (?intro=1). */
const PLAY_INTRO = params.get('intro') === '1' || ((launch === 'first' || launch === 'mission1') && !introSeen());
const AUTOSTART = AUTO || params.get('autostart') === '1' || CAMPAIGN === 'run';
const START_SPEED = Number(params.get('speed') ?? 1);
/** 'top' = the old top-down board drawn as shapes; anything else = the isometric board, when its art is there. */
const VIEW = params.get('view');

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
  entrances: ENTRANCES, organStage: true,
};

// A campaign deployment: the pending plan (territory, dares, experiment, perks) shapes the run.
let campaignState: CampaignState | null = null;
let campaignPlan: DeploymentPlan | null = null;
/** The territory being fought over: it decides which tile set the board is drawn with. */
let territory: string | null = null;
if (CAMPAIGN === 'run') {
  campaignState = loadCampaign();
  const pending = loadPending();
  if (campaignState && pending) {
    territory = pending.territory;
    campaignPlan = plan(campaignState, pending.territory, pending);
    Object.assign(CFG, campaignPlan.config, { gridW: CFG.gridW, gridH: CFG.gridH, cellPx: CFG.cellPx, genes: [...meta.genes, ...(campaignPlan.config.genes ?? [])] });
  }
}
/** Mission 1 (src/meta/onboarding.ts): a plain tower-defence game; nothing on its screen speaks of the ship. */
const FIRST = !!campaignPlan?.first;
let sim = new Sim(CFG);
const auto = AUTO ? new Autoplayer(SEED + 1) : null;
// The address's ?speed= wins; otherwise the speed the settings say a deployment starts at.
let speed = params.has('speed') && Number.isFinite(START_SPEED) && START_SPEED >= 0 ? START_SPEED : loadSettings().speed;
/** The run's clock is going. Behind the cinematic it waits until the film is over. */
let started = AUTOSTART && !PLAY_INTRO;
let debriefShown = false;

/** The top-down board until boot() has loaded the art; then the isometric one, if its art is there. */
let renderer: Renderer = new Renderer();
/** The board's pictures, once loaded (the district draft draws its plates with them). */
let boardArt: BoardArtSet | null = null;
/** The board is drawn and the loop runs: until then a deployment waits behind the loading screen. */
let bootDone = false;
/** Pictures of the board that failed to load: said over the board when a run starts, not over the menu or the ship. */
let artFailed: string[] = [];
const loading = new LoadingScreen();
/** The board as it was when the run ended, for the report (a data URL). */
let endSnapshot: string | null = null;

/** A photograph of the board as it is now; null when the canvas cannot be read. */
function snapshotBoard(): string | null {
  try {
    renderer.draw(sim, 0);
    renderer.app.render();
    // Copied at once, in the same task as the render (the WebGL canvas keeps no copy of its own).
    const src = renderer.app.canvas;
    const full = document.createElement('canvas');
    full.width = src.width;
    full.height = src.height;
    const g = full.getContext('2d')!;
    g.drawImage(src, 0, 0);
    // Cut to the districts the body held (their corners on the screen), with room above for the tall blocks.
    let x0 = full.width, y0 = full.height, x1 = 0, y1 = 0;
    const side = PLATE * sim.cfg.cellPx;
    sim.map.slots.forEach((held, slot) => {
      if (!held) return;
      const wx = (slot % sim.map.slotsX) * side;
      const wy = Math.floor(slot / sim.map.slotsX) * side;
      for (const [cx, cy] of [[wx, wy], [wx + side, wy], [wx, wy + side], [wx + side, wy + side]]) {
        const p = renderer.worldToScreen(cx, cy);
        const k = full.width / p.vw;
        x0 = Math.min(x0, p.x * k); x1 = Math.max(x1, p.x * k);
        y0 = Math.min(y0, p.y * k); y1 = Math.max(y1, p.y * k);
      }
    });
    y0 -= (y1 - y0) * 0.12;
    if (x1 <= x0 || y1 <= y0) return full.toDataURL('image/jpeg', 0.84);
    const m = 20;
    x0 = Math.max(0, Math.floor(x0 - m)); y0 = Math.max(0, Math.floor(y0 - m));
    x1 = Math.min(full.width, Math.ceil(x1 + m)); y1 = Math.min(full.height, Math.ceil(y1 + m));
    const cut = document.createElement('canvas');
    cut.width = x1 - x0;
    cut.height = y1 - y0;
    cut.getContext('2d')!.drawImage(full, x0, y0, cut.width, cut.height, 0, 0, cut.width, cut.height);
    return cut.toDataURL('image/jpeg', 0.86);
  } catch {
    return null;
  }
}

let selectedCard: number | null = null;
let armedOrgan: OrganId | null = null;
/** Tower under the pointer that a click would cannibalize (card armed + hover). */
let hoverDonorId: number | null = null;
/** Aimed structure waiting for a target (armed by clicking the built sling/lobber). */
let armedThrower: { id: number; family: 'sling' | 'lobber' | 'bombard' } | null = null;
/** A free creep node picked from the stock (its stock index), waiting for a spot on the map. */
let armedNode: number | null = null;
/** A free plinth picked from the stock, waiting for a roof or a limb to raise. */
let armedPlinth = false;
/** A mature node chosen to spread its one child (its creep-source id). */
let armedSpread: number | null = null;
/** The pointer is over a creep node (its readout is in the hint line). */
let hoveringNode = false;
/** Facing a DIRECTIONAL card will be placed with (right-click rotates while placing). */
let placeFacing: RootDir | null = null;
const FACING_ORDER: RootDir[] = ['N', 'E', 'S', 'W'];
const nextFacing = (d: RootDir): RootDir => FACING_ORDER[(FACING_ORDER.indexOf(d) + 1) % 4];

function selectedIsDirectional(): boolean {
  const fam = selectedCard !== null ? sim.hand[selectedCard]?.family : undefined;
  if (fam === undefined) return false;
  const span = towerSpec(fam).span;
  // A limb that is longer than it is wide is turned to fit, as one that aims one way is turned to aim.
  return !!towerSpec(fam).directional || (span !== undefined && span[0] !== span[1]);
}

/** The ground a build at this cell would take, and where it could not be built, the ground it would want. */
function groundAt(cell: number, fam: TowerFamily | undefined, facing: RootDir | undefined): { cells: number[]; valid: boolean } {
  const legal = sim.groundFor(cell, fam, facing);
  if (legal) return { cells: legal, valid: true };
  if (!fam) return { cells: [cell], valid: false };
  const [sw, sh] = sim.spanOf(fam, facing);
  const w = sim.cfg.gridW;
  const x0 = Math.min(cell % w, w - sw);
  const y0 = Math.min(Math.floor(cell / w), sim.cfg.gridH - sh);
  const cells: number[] = [];
  for (let y = y0; y < y0 + sh; y++) for (let x = x0; x < x0 + sw; x++) cells.push(y * w + x);
  return { cells, valid: false };
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
    // The bar's royal button opens the ROYAL DECREES (content/royal.ts); the old surge is gone from play.
    decreeBox.toggle();
  },
  onCrown(towerId) {
    const r = sim.issue({ kind: 'decree', decree: 'crown', towerId });
    hud.setHint(r.ok ? 'CROWNED: every other limb within 120px takes 30% less harm and hits 25% harder' : String(r.err).toUpperCase());
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

/** The ROYAL DECREES box (src/ui/decrees.ts), opened by the bar's royal button. */
const decreeBox = new DecreeBox(() => sim, (cmd) => sim.issue(cmd), (text) => hud.setHint(text));

/** A wall of the body facing the smoke under the pointer (between waves): hovering it offers the burrow. */
let hoverBurrow = false;

function updateHint(): void {
  if (armedPlinth) {
    hud.setHint('PLINTH: click one of your limbs to raise it a level (a big limb rises whole), or a bare roof your creep holds to raise the roof — free · higher reaches further · Esc cancels');
  } else if (armedNode !== null && sim.nodeStock[armedNode]) {
    const st = sim.nodeStock[armedNode];
    hud.setHint(`CREEP NODE (${strainLabel(st)}): click claimed ground on or within ${st.reach} cells of your creep — free · it can spread one child once it matures · Esc cancels`);
  } else if (armedSpread !== null) {
    hud.setHint('SPREAD: click claimed ground within this node\'s reach — its child carries the same strain · Esc cancels');
  } else if (armedThrower !== null) {
    hud.setHint(armedThrower.family === 'sling'
      ? 'SPORE SLING ARMED: click any claimed ground in range — the clot seeds new skin to build on (right-click cancels)'
      : armedThrower.family === 'lobber'
        ? 'BILE LOBBER ARMED: click ground in range — the volley detonates on whatever stands there (right-click cancels)'
        : 'BOMBARD: click ground in range to set its MARKER — it shells that spot whenever the hive is there (right-click cancels)');
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
        + (deps > 0 ? ` · WARNING: ${deps} limb${deps > 1 ? 's' : ''} stand on its creep and will WITHER` : '')
        + (sim.phase === 'siege' ? ` · SURGERY UNDER FIRE: the new limb will graft ~${(B.graftSeconds + B.graftPerPip * (sim.pendingPips.length + donor.pips.length + 1)).toFixed(0)}s — no fire, double harm, the climbers smell it` : ''));
      return;
    }
    hoverDonorId = null;
    updateHint();
  } else if (selectedCard !== null && sim.pendingPips.length > 0) {
    hud.setHint(`${sim.pendingPips.length} trait${sim.pendingPips.length > 1 ? 's' : ''} banked — `
      + 'place the new limb to inherit them (or eat another)'
      + (sim.phase === 'siege' ? ` · SURGERY UNDER FIRE: grafting mid-siege takes ${(B.graftSeconds + B.graftPerPip * sim.pendingPips.length).toFixed(1)}s — it holds fire and bleeds double (between waves the graft takes at once)` : ''));
  } else if (selectedCard !== null) {
    const fam = sim.hand[selectedCard]?.family;
    const span = fam ? towerSpec(fam).span : undefined;
    const turn = ' · RIGHT-CLICK turns it a quarter · Esc cancels';
    hud.setHint(selectedIsDirectional()
      ? `place it — it faces ${placeFacing ?? (fam && towerSpec(fam).directional ? 'the nearest gate' : 'the way it fits')}${turn}`
      : span
        ? `a BIG limb: it needs ${span[0]} by ${span[1]} cells of one flat creeped roof${placeFacing ? ` · faces ${placeFacing}` : ''}${turn} · Q and E turn the view`
      : fam === 'spine' || fam === 'swamp'
        ? `plug a street — the swarm must go through it${turn}`
        : `place on a creeped block by a street — higher roofs reach further (+10% a level)${placeFacing ? ` · faces ${placeFacing}` : ''}${turn} — or click one of your limbs to feed it in`);
  } else if (FIRST && !AUTO && coachText()) {
    hud.setHint(coachText());
  } else {
    hud.setHint(AUTO
      ? 'demo mode: the asset is piloting itself'
      : sim.phase === 'growth' && sim.waveNumber > 0
        ? 'WAVE SETUP: place limbs — unspent war and science are lost when the wave starts'
        : 'select a limb card below, then click a creeped block by a street — the assault forms at the glowing gate');
  }
}

// ---------- mission 1: teaching by doing ----------

/**
 * Mission 1 is the player's first minutes with the game: the hint line says the ONE next thing
 * to do, from what is on the board (Sep 30 2026, the brand-new-player pass; notes/PERSONA-
 * ONBOARDING-2026-09-30.md). The card hand, then the CALL button, glow while they are the answer.
 */
function coachText(): string {
  if (sim.outcome !== 'playing') return '';
  const left = Math.max(0, Math.ceil(B.growthSeconds - sim.phaseElapsed));
  if (sim.waveNumber === 0 && sim.phase === 'growth') {
    if (!sim.towers.length) return `YOUR FIRST LIMB: pick a card below, then click a dark red block beside a street — the townsfolk march in from the glowing gate in ${left}s`;
    const affordable = sim.hand.some((c) => c.free || sim.canAfford(towerSpec(c.family).cost));
    if (!affordable) return `GOOD. That is all the meat you have: kills pay more. Wait for them (${left}s), or CALL THE WAVE now (top right) for a bonus`;
    if (sim.towers.length < 3) return `GOOD. Grow more limbs beside the street they will walk down (${left}s) — or CALL THE WAVE early for extra meat`;
    return `READY? They come in ${left}s — or CALL THE WAVE now (top right) for extra meat`;
  }
  if (sim.waveNumber === 1 && sim.phase === 'siege') return 'Your limbs fight on their own. Every kill pays WAR meat (top left): spend it on more cards';
  if (sim.waveNumber === 1 && sim.phase === 'growth' && sim.towers.length < 5) return `Wave cleared. Place more limbs with the meat you earned — the next wave is bigger (${left}s)`;
  if (sim.waveNumber === 2 && sim.phase === 'siege') return 'Click one of your limbs to see it: its health, and EVOLVE when you have science';
  return '';
}
let coachAt = 0;
function coachTick(now: number): void {
  if (!FIRST || AUTO || now - coachAt < 400) return;
  coachAt = now;
  const idle = selectedCard === null && armedOrgan === null && armedThrower === null && armedNode === null && armedSpread === null && !armedPlinth && !hoveringNode && hoverDonorId === null;
  const text = coachText();
  document.body.classList.toggle('coach-hand', idle && sim.phase === 'growth' && sim.waveNumber === 0 && !sim.towers.length);
  const broke = !sim.hand.some((c) => c.free || sim.canAfford(towerSpec(c.family).cost));
  document.body.classList.toggle('coach-call', idle && sim.phase === 'growth' && sim.waveNumber === 0 && sim.towers.length > 0 && (broke || sim.towers.length >= 3));
  // Nothing armed: the coach's line, or once it has nothing to say, the game's own.
  if (idle && text !== lastCoach) { lastCoach = text; updateHint(); }
}
let lastCoach = '';

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
  if (started) boardEvents(events);
  for (const e of events) {
    if (e.kind === 'wave-start') banner(`WAVE ${e.wave} — ASSAULT FROM ${e.sides}`);
    if (e.kind === 'wave-start' && !AUTO) preloadPadOutro(); // the end's clip, fetched while the run is on
    if (e.kind === 'wave-cleared') banner(`WAVE ${e.wave} CLEARED · +${e.bonus} WAR MEAT`);
    if (e.kind === 'royal-incoming') banner('THE ROYAL TAKES THE FIELD');
    if (e.kind === 'plate-drafted') banner(`DISTRICT CONSUMED: ${e.name.toUpperCase()}`);
    if (e.kind === 'sealed-in' && !AUTO) banner('WALLED IN — BURROW THROUGH A WALL INTO THE SMOKE TO GROW');
    if (e.kind === 'burrowed') banner('BURROWED THROUGH — A NEW WAY IN');
    if (e.kind === 'surgery-under-fire') banner(`SURGERY UNDER FIRE — GRAFTING ${e.seconds.toFixed(0)}s`);
    if ((e.kind === 'won' || e.kind === 'lost') && !AUTO) {
      endSnapshot = snapshotBoard();
      // The hero sets the pad down (src/ui/padOutro.ts: this very view on its screen), then the report.
      const report = FIRST ? firstDebrief : campaignPlan ? campaignDebrief : showDebrief;
      window.setTimeout(() => { void playPadOutro(e.kind === 'won' ? 'won' : 'lost').then(report, report); }, 1600);
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

/** Where an offered plate would go: every district of the board, the ones held, the core's, and this one. */
function draftMap(slot: number): string {
  const coreSlot = Math.floor(Math.floor(sim.map.coreCell / sim.cfg.gridW) / PLATE) * sim.map.slotsX + Math.floor((sim.map.coreCell % sim.cfg.gridW) / PLATE);
  return sim.map.slots.map((s, i) => `<i class="${i === slot ? 'here' : i === coreSlot ? 'core' : s ? 'held' : ''}"></i>`).join('');
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
    // The plate drawn as the board will draw it (its streets, heights, facades, roofs), when the board's art is up.
    const pic = renderer instanceof IsoRenderer && boardArt
      ? platePicture(renderer.app, boardArt, { gridW: sim.cfg.gridW, slotsX: sim.map.slotsX, slotsY: sim.map.slotsY, coreCell: sim.map.coreCell, seed: sim.cfg.seed }, offer, 460)
      : null;
    if (pic) card.classList.add('has-pic');
    card.innerHTML = `<div class="df-name"></div><div class="df-desc"></div>`
      + (pic ? `<img class="df-pic" alt="" src="${pic}">` : '')
      + `<div class="df-grid">${grid}</div><div class="df-map" style="grid-template-columns:repeat(${sim.map.slotsX},9px)">${draftMap(offer.slot)}</div><div class="df-where"></div>`;
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

// ---------- the campaign (the ship, the globe, the debrief) ----------

let campaignUi: CampaignUi | null = null;
const campaignHooks = {
  deploy(p: Parameters<typeof savePending>[0]) {
    savePending(p);
    location.href = `${location.pathname}?campaign=run`;
  },
  /** A new campaign unfolds like the first: mission 1, then the ship with its desk dark. */
  newCampaign() {
    startOnboarding();
    location.href = `${location.pathname}?campaign=run`;
  },
  quit() {
    location.href = location.pathname;
  },
};

/** Aboard: every time he comes to the ship, YOKE greets him (src/ui/campaignUi.ts welcome). */
function openShip(state?: CampaignState): void {
  // `?campaign=ship&open=1` (for the browser beats only): with no campaign on record, one whose desk is
  // already open, as a save from before the unfolding is; the unfolding itself is tools/shot-onboarding.mjs.
  const s = state ?? loadCampaign() ?? (params.get('open') === '1' ? newCampaign(Math.floor(Math.random() * 1e9)) : null);
  // No campaign, or one whose first mission is not over: the ship is not seen before mission 1.
  if (!s || isFirstMission(s)) { if (!s) startOnboarding(); else if (!loadPending()) savePending({ territory: FIRST_MISSION, dares: [], objectors: [] }); location.href = `${location.pathname}?campaign=run`; return; }
  saveCampaign(s);
  menuEl.classList.add('hidden');
  campaignUi = new CampaignUi(s, campaignHooks);
  campaignUi.show({ greet: true });
}

/**
 * The end of mission 1: a plain report of the game just played (its pictures, a few numbers,
 * no forms, no standing), and one way on. The campaign takes the result at once (a reload
 * does not lose it); CONTINUE is the first time the ship is seen.
 */
let firstDebriefShown = false;
function firstDebrief(): void {
  if (!campaignPlan || !campaignState || firstDebriefShown) return;
  firstDebriefShown = true;
  const won = sim.outcome === 'won';
  const report: RunReport = {
    won, wavesCleared: sim.wavesCleared, coreEndFrac: Math.max(0, sim.coreHp / sim.coreMaxHp),
    scienceBanked: sim.scienceBanked, stats: sim.stats,
  };
  const { state } = finish(campaignState, campaignPlan, report);
  saveCampaign(state);
  clearPending();
  const kills = Object.values(sim.stats.kills).reduce((a, n) => a + (n ?? 0), 0);
  const verdict = won ? 'THE TOWN IS YOURS' : 'THE TOWN FOUGHT BACK';
  document.getElementById('debrief-title')!.textContent = verdict;
  const body = document.getElementById('debrief-body')!;
  body.innerHTML = '';
  for (const line of [
    won ? `You held for ${sim.wavesCleared} waves. The crater is a garden now.` : `The thing that fell was burned out after ${sim.wavesCleared} wave${sim.wavesCleared === 1 ? '' : 's'}.`,
    `Districts taken: ${sim.map.slots.filter(Boolean).length}. Limbs grown: ${sim.stats.limbsGrown}. Townsfolk eaten: ${kills}.`,
  ]) {
    const div = document.createElement('div');
    div.textContent = line;
    body.appendChild(div);
  }
  const btn = document.getElementById('debrief-ship')!;
  btn.textContent = 'CONTINUE ▸';
  debriefEl.dataset.first = won ? 'won' : 'lost';
  debriefEl.classList.remove('hidden');
  void reportWait(debriefPictures(runPictures(won ? 'won' : 'lost', verdict,
    won ? 'The little town is quiet now.' : 'They cheered. They should not have.',
    [['waves held', String(sim.wavesCleared)], ['districts taken', String(sim.map.slots.filter(Boolean).length)],
      ['limbs grown', String(sim.stats.limbsGrown)], ['townsfolk eaten', String(kills)]])))
    .then((pics) => {
      document.getElementById('debrief-pictures')!.replaceChildren(pics);
      debriefEl.querySelector('.screen-card')!.classList.add('pictured');
    }, (e) => console.warn('[debrief] no pictures', e));
}

let campaignDebriefShown = false;
function campaignDebrief(): void {
  if (!campaignPlan || !campaignState || campaignDebriefShown) return;
  campaignDebriefShown = true;
  const report: RunReport = {
    won: sim.outcome === 'won', wavesCleared: sim.wavesCleared, coreEndFrac: Math.max(0, sim.coreHp / sim.coreMaxHp),
    scienceBanked: sim.scienceBanked, stats: sim.stats,
  };
  const { state, debrief } = finish(campaignState, campaignPlan, report);
  saveCampaign(state);
  clearPending();
  campaignUi = new CampaignUi(state, campaignHooks);
  const outcome: Outcome = debrief.captured ? 'won' : debrief.repelled ? 'held' : 'lost';
  const where = territory ? territoryDef(territory).name : '';
  const verdict = outcome === 'won' ? `${where.toUpperCase()} TAKEN` : outcome === 'held' ? 'COUNTER-ATTACK REPELLED' : 'DEPLOYMENT FAILED';
  const ui = campaignUi;
  // Aboard in the same page, so that the click on the report's button lets her voice be heard
  // (a browser will not play sound on a page nobody has clicked); a reload lands on the ship.
  const prev = campaignState;
  const back = () => {
    history.replaceState(null, '', `${location.pathname}?campaign=ship`);
    document.getElementById('board-goals')!.classList.add('hidden');
    // The planet's news of it first (src/ui/newsreel.ts): a newsreel or one of their papers, skippable.
    void newsAfterDeployment(prev, state, debrief).catch(() => {}).then(() => ui.show({ greet: true }));
  };
  // The report waits for its pictures: a loop meanwhile (src/ui/loader.ts), never a still board.
  void withLoader(debriefPictures(runPictures(outcome, verdict,
    outcome === 'lost' ? `${where} · the asset was lost after ${sim.wavesCleared} wave${sim.wavesCleared === 1 ? '' : 's'}` : `${where} · ${sim.wavesCleared} wave${sim.wavesCleared === 1 ? '' : 's'} held`,
    [['waves held', String(sim.wavesCleared)], ['districts taken', String(sim.map.slots.filter(Boolean).length)], ['limbs grown', String(sim.stats.limbsGrown)], ['standing earned', `+${debrief.standing}`]])), shipLoop(), { label: 'THE REPORT' })
    .then((pics) => ui.showDebrief(debrief, back, pics), () => ui.showDebrief(debrief, back));
}

/**
 * The organ stage's own pictures (the scan's tiles, the meteor, the dome, the skylines, the core, each organ's shape):
 * ~14 MB in all with their loops, so they are not held behind the boot screen; these stills are fetched once the board
 * is up, and if the stage is opened before they are in, the scan loop (the ground scan's own look) covers its grid until
 * they are (never black cells).
 */
let underArtReady: Promise<unknown> | null = null;
function underArt(): Promise<unknown> {
  underArtReady ??= loadManifest().then((m) => {
    type Under = { scan?: { tiles?: Record<string, string>; meteor?: string; dome?: string; skylines?: Record<string, string> }; core?: { stages?: Array<{ file: string }> }; shapes?: { organs?: Record<string, { still?: string }> } };
    const u = (m as unknown as { under?: Under } | null)?.under;
    if (!u) return;
    const files = [...Object.values(u.scan?.tiles ?? {}), u.scan?.meteor, u.scan?.dome, ...Object.values(u.scan?.skylines ?? {}),
      u.core?.stages?.[0]?.file, ...Object.values(u.shapes?.organs ?? {}).map((o) => o.still)].filter((f): f is string => !!f);
    return Promise.all(files.map((f) => new Promise<void>((done) => {
      const img = new Image();
      img.onload = img.onerror = () => done();
      img.src = new URL(artUrl(f), document.baseURI).href;
    })));
  });
  return underArtReady;
}
function openUnder(): void {
  under.show();
  const grid = document.getElementById('under-right');
  void withLoader(underArt(), 'scan', { host: grid ?? undefined, label: 'THE ORGAN STAGE', lines: ['Mapping the ground under the town.', 'Waking the organs.', 'Counting the cellars.'] });
}

/** The report is up, its pictures still coming: a loop in their place meanwhile (shown only if it takes over 400 ms). */
function reportWait<T>(p: Promise<T>): Promise<T> {
  return withLoader(p, 'scan', { host: document.getElementById('debrief-pictures')!, panelHeight: 220 });
}

/** The report's pictures of this run (src/ui/debrief.ts). */
function runPictures(outcome: Outcome, verdict: string, caption: string, figures: Array<[string, string]>): Parameters<typeof debriefPictures>[0] {
  const standing: Partial<Record<TowerFamily, number>> = {};
  for (const t of sim.towers) standing[t.family] = (standing[t.family] ?? 0) + 1;
  return { outcome, verdict, caption, snapshot: endSnapshot ?? snapshotBoard(), stats: sim.stats, standing, figures };
}

/** The Requisition Board and the picked dares/experiment, live during a campaign run. */
const boardEl = document.getElementById('board-goals')!;
function updateBoardPanel(): void {
  if (!campaignPlan || FIRST) return;
  boardEl.classList.remove('hidden');
  const r: RunReport = { won: false, wavesCleared: sim.wavesCleared, coreEndFrac: sim.coreHp / sim.coreMaxHp, scienceBanked: sim.scienceBanked, stats: sim.stats };
  const line = (g: DeploymentPlan['board'][number], cls: string) => {
    const v = Math.round(measure(g.def.measure, r));
    const le = (g.def.cmp ?? '>=') === '<=';
    const met = le ? v <= g.target : v >= g.target;
    return `<div class="bg ${cls}${met && !le ? ' met' : ''}">${goalText(g)} <b>${v}/${g.target}</b></div>`;
  };
  const html = [
    `<div class="bg-title">${campaignPlan.defence ? 'DEFENCE' : 'DEPLOYMENT'} — REQUISITION BOARD</div>`,
    ...campaignPlan.board.map((g) => line(g, 'std')),
    ...campaignPlan.dares.map((g) => line(g, 'dare')),
    ...(campaignPlan.experiment ? [line(campaignPlan.experiment.goal, 'exp')] : []),
    // His pinned hobby page (src/meta/hobby.ts), in his own hand.
    ...(campaignPlan.hobby ? campaignPlan.hobby.goals.map((g) => line(g, 'hobby')) : []),
  ].join('');
  if (boardEl.innerHTML !== html) boardEl.innerHTML = html;
}

function setupMenu(): void {
  const saved = loadCampaign();
  new ConsoleMenu(saved, {
    continueCampaign: () => openShip(),
    newCampaign: () => campaignHooks.newCampaign(),
    skirmish: () => document.getElementById('menu-deploy')!.click(),
    replayIntro: () => { void loadIntroArt().then((art) => playIntro(art)); },
    reset: () => { forgetEverything(); location.href = location.pathname; },
  });
  const genesNote = document.getElementById('menu-genes')!;
  genesNote.textContent = meta.genes.length
    ? `Skirmish: spliced genes ${meta.genes.map((id) => GENES.find((g) => g.id === id)?.name ?? id).join(', ')}`
    : '';
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
    // The landing film first (src/ui/landing.ts); then the run, behind the loading screen if the art is still coming.
    void landThenStart();
  });
  if (AUTOSTART) menuEl.classList.add('hidden');
  if (CAMPAIGN === 'ship') openShip();
  // A click on SKIRMISH / NEW CAMPAIGN made before this code had arrived (index.html kept it): played now.
  const w = window as unknown as { __bfMenuReady?: boolean; __bfEarlyClick?: string };
  w.__bfMenuReady = true;
  if (w.__bfEarlyClick) document.getElementById(w.__bfEarlyClick)?.click();
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
  // What happened, in pictures, at the head of the report; the lines above stay as its small print.
  const verdict = won ? 'DIRECTIVE FULFILLED' : 'ASSET TERMINATED';
  void reportWait(debriefPictures(runPictures(won ? 'won' : 'lost', verdict,
    won ? 'The city is the body\'s. The Board notes your efficiency.' : 'The Board notes the loss of Navy property.',
    [['directive', `${Math.floor(p.done)} / ${p.goal}`], ['waves repelled', String(sim.wavesCleared)],
      ['districts held', String(sim.map.slots.filter(Boolean).length)], ['standing earned', `+${standingEarned()}`]])))
    .then((pics) => {
      document.getElementById('debrief-pictures')!.replaceChildren(pics);
      debriefEl.querySelector('.screen-card')!.classList.add('pictured');
    }, (e) => console.warn('[debrief] no pictures', e));
}

function setupScreens(): void {
  document.getElementById('debrief-ship')!.addEventListener('click', () => {
    debriefEl.classList.add('hidden');
    // Mission 1's report: CONTINUE is the way aboard, the first time the ship is seen.
    if (FIRST) {
      history.replaceState(null, '', `${location.pathname}?campaign=ship`);
      const s = loadCampaign();
      if (s) { campaignUi = new CampaignUi(s, campaignHooks); campaignUi.show({ greet: true }); }
      else location.href = `${location.pathname}?campaign=ship`;
      return;
    }
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

  // A picked plinth raises what is clicked.
  if (armedPlinth) {
    const res = sim.issue({ kind: 'place-plinth', cell });
    if (res.ok) {
      // Keep raising while there are more.
      if (sim.plinths < 1) { armedPlinth = false; renderer.preview = null; }
      updateHint();
    } else hud.setHint(String(res.err).toUpperCase());
    return;
  }
  // A picked creep node goes down wherever is clicked (if in reach).
  if (armedNode !== null) {
    const key = sim.nodeStock[armedNode] ? strainKey(sim.nodeStock[armedNode]) : '';
    const res = sim.issue({ kind: 'place-node', cell, stock: armedNode });
    if (res.ok) {
      // Keep placing the same strain while there is more of it.
      const next = sim.nodeStock.findIndex((s) => strainKey(s) === key);
      armedNode = next >= 0 ? next : null;
      if (armedNode === null) renderer.preview = null;
      updateHint();
    } else hud.setHint(String(res.err).toUpperCase());
    return;
  }
  if (armedSpread !== null) {
    const res = sim.issue({ kind: 'spread-node', sourceId: armedSpread, cell });
    if (res.ok) { armedSpread = null; renderer.preview = null; updateHint(); } else hud.setHint(String(res.err).toUpperCase());
    return;
  }
  // Clicking a MATURE node (nothing armed) picks it to spread its one child.
  if (selectedCard === null && armedThrower === null) {
    const node = sim.creepSources.find((s) => s.kind === 'node' && Math.hypot(sim.cellCenter(s.cell).x - w.x, sim.cellCenter(s.cell).y - w.y) < 13);
    if (node) {
      if (node.spent) { hud.setHint('this node has already spread its child'); return; }
      if (sim.wavesCleared < (node.matureAt ?? 0)) { hud.setHint('node still maturing — once it survives a wave it can spread its child'); return; }
      armedSpread = node.id;
      updateHint();
      return;
    }
  }

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
    // The smoke in front of a wall of yours (between waves): burrow through it.
    const site = sim.burrowSiteAt(cell);
    if (site && sim.map.cells[cell] === CellType.Void) {
      const res = sim.issue({ kind: 'burrow', cell });
      hud.setHint(res.ok ? 'BURROWED: the district beyond can be drafted now, and the hive has a new way in' : String(res.err).toUpperCase());
      renderer.preview = null;
      return;
    }
    // Empty ground with nothing armed: close the panel.
    hud.inspectedId = null;
    renderer.selectedTowerId = null;
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
      facing: buildFacing(cell),
    });
    if (res.ok) {
      hideReachTip();
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

/**
 * The facing a placement will use: the way the player turned it; else, a limb that AIMS one
 * way faces the nearest gate, and a limb that is only long lies whichever way fits there.
 */
function currentPlaceFacing(cell: number): RootDir {
  if (placeFacing) return placeFacing;
  const fam = selectedCard !== null ? sim.hand[selectedCard]?.family : undefined;
  if (fam && !towerSpec(fam).directional) return sim.placementFor(cell, fam)?.facing ?? 'S';
  return sim.facingTowardGate(sim.cellCenter(cell));
}

/**
 * The facing a build at this cell is ordered with: a directional or long limb always takes one;
 * any other limb only once the player has turned it (unturned, it faces what it fights).
 */
function buildFacing(cell: number): RootDir | undefined {
  return selectedIsDirectional() ? currentPlaceFacing(cell) : placeFacing ?? undefined;
}

/** The placement preview of the held card at this cell: its ground (re-checked for the way it is turned) and the way it faces. */
function placePreview(cell: number): void {
  const fam = selectedCard !== null ? sim.hand[selectedCard]?.family : undefined;
  if (fam === undefined) return;
  const ground = groundAt(cell, fam, buildFacing(cell));
  renderer.preview = {
    cell, cells: ground.cells, kind: 'tower', family: fam, valid: ground.valid,
    facing: currentPlaceFacing(cell),
    pips: sim.pendingPips,
  };
}

/** Cancel whatever is armed (cards, organs, throwers) and close the panel. */
/** The settings over a deployment: the clock stops while they are open and runs on at its old speed. */
function openRunSettings(): void {
  const was = speed;
  speed = 0;
  markSpeed(0);
  openSettings({
    where: 'run',
    onClose: () => { speed = was; markSpeed(speed); },
    onIntro: (h) => { speed = 0; void h.done.then(() => { speed = was; markSpeed(speed); }); },
  });
}

/** The Limb Codex over a deployment (src/ui/codex.ts), at a limb when one is named: the clock stops while it is open. */
function openRunCodex(focus?: TowerFamily): void {
  if (codexOpen()) return;
  const was = speed;
  speed = 0;
  markSpeed(0);
  openCodex({ where: 'run', focus, onClose: () => { speed = was; markSpeed(speed); } });
}

function cancelAll(): void {
  decreeBox.close();
  armedPlinth = false;
  armedNode = null;
  armedSpread = null;
  selectedCard = null;
  armedOrgan = null;
  hoverDonorId = null;
  armedThrower = null;
  placeFacing = null;
  renderer.slingArm = null;
  renderer.donorHighlightId = null;
  renderer.preview = null;
  hideReachTip();
  hud.selectedCard = null;
  hud.armedOrgan = null;
  hud.inspectedId = null;
  renderer.selectedTowerId = null;
  updateHint();
}

/** The player's own tower under a world point (click/hover pick radius). */
function towerNearWorld(x: number, y: number): { id: number } | null {
  // A big limb is pointed at anywhere on the ground it stands on.
  const under = sim.cellAt(x, y);
  for (const t of sim.towers) {
    if (t.cells?.includes(under)) return t;
  }
  for (const t of sim.towers) {
    if (Math.hypot(t.pos.x - x, t.pos.y - y) < 22) return t;
  }
  return null;
}

// ---------- the body below (between waves) ----------

const under = new UndergroundScreen(() => sim, () => updateHint());
const nodeBtn = document.getElementById('creep-nodes')!;
const nodeTray = document.getElementById('node-tray')!;
nodeBtn.addEventListener('click', (ev) => {
  const chip = (ev.target as HTMLElement).closest<HTMLElement>('[data-strain]');
  if (sim.creepNodes < 1) { hud.setHint('NO CREEP NODES — grow a Spore Bladder (or a Spore Cyst) in the organ stage'); return; }
  const key = chip ? chip.dataset.strain! : strainKey(sim.nodeStock[0]);
  const idx = sim.nodeStock.findIndex((s) => strainKey(s) === key);
  const wasSame = armedNode !== null && sim.nodeStock[armedNode] && strainKey(sim.nodeStock[armedNode]) === key;
  cancelAll();
  armedNode = wasSame ? null : idx;
  updateHint();
});
const plinthBtn = document.getElementById('plinths')!;
plinthBtn.addEventListener('click', () => {
  if (sim.plinths < 1) { hud.setHint('NO PLINTHS — grow a Scaffold Gland in the organ stage: it makes one every 2 turns, free'); return; }
  const was = armedPlinth;
  cancelAll();
  armedPlinth = !was;
  updateHint();
});
function updatePlinthButton(): void {
  document.getElementById('plinth-count')!.textContent = String(sim.plinths);
  const glands = sim.organs.filter((o) => o.organ === 'scaffold');
  const soonest = glands.length ? Math.min(...glands.map((o) => sim.scaffoldTurnsLeft(o))) : 0;
  document.getElementById('plinth-next')!.textContent = !glands.length ? 'grow a Scaffold Gland in the organ stage'
    : sim.plinthsNextTurn() > 0 ? `+${sim.plinthsNextTurn()} next turn` : `next in ${soonest} turns`;
  plinthBtn.classList.toggle('disabled', sim.plinths < 1);
  plinthBtn.classList.toggle('on', armedPlinth);
}

let lastTrayKey = '';
function updateNodeButton(): void {
  updatePlinthButton();
  document.getElementById('node-count')!.textContent = String(sim.creepNodes);
  const next = sim.nodesNextTurn();
  const bladders = sim.organs.filter((o) => o.organ === 'bladder');
  const soonest = bladders.length ? Math.min(...bladders.map((o) => sim.bladderTurnsLeft(o))) : 0;
  document.getElementById('node-next')!.textContent = !bladders.length ? 'grow a Spore Bladder in the organ stage'
    : next > 0 ? `+${next} next turn` : `next in ${soonest} turns`;
  nodeBtn.classList.toggle('disabled', sim.creepNodes < 1);
  // One chip per strain in stock.
  const groups = new Map<string, { n: number; label: string; icons: string; mire: boolean; burn: boolean }>();
  for (const s of sim.nodeStock) {
    const k = strainKey(s);
    const g = groups.get(k) ?? { n: 0, label: strainLabel(s), icons: strainIcons(s), mire: s.slow < 1, burn: s.dps > 0 };
    g.n++;
    groups.set(k, g);
  }
  const armedKey = armedNode !== null && sim.nodeStock[armedNode] ? strainKey(sim.nodeStock[armedNode]) : '';
  const trayKey = [...groups].map(([k, g]) => k + ':' + g.n).join(',') + '|' + armedKey;
  if (trayKey === lastTrayKey) return;
  lastTrayKey = trayKey;
  nodeTray.innerHTML = [...groups].map(([k, g]) =>
    `<button class="node-chip${g.mire ? ' mire' : ''}${g.burn ? ' burn' : ''}${k === armedKey ? ' on' : ''}" data-strain="${k}" title="${g.label}">${g.n}× ${g.icons}</button>`).join('');
}
const openUnderBtn = document.getElementById('open-under')!;
openUnderBtn.addEventListener('click', () => { if (sim.phase !== 'siege') { cancelAll(); openUnder(); } });
/** Last phase seen by the loop — a wave (and any draft) ending into wave setup opens the organ stage. */
let lastPhase = sim.phase;
function underLifecycle(): void {
  if (AUTO || !started || sim.outcome !== 'playing') return;
  // The run starts at wave setup; the organ stage comes after every wave.
  if (sim.phase === 'growth' && lastPhase !== 'growth') openUnder();
  lastPhase = sim.phase;
  openUnderBtn.classList.toggle('disabled', sim.phase === 'siege');
}

// ---------- boot ----------

/** The music follows the screen in front (src/audio/cues.ts sceneOf): film, menu, ship, the run's build / assault, the organ stage, the end. */
let musicScene: MusicScene = 'silent';
function musicTick(): void {
  const shown = (el: HTMLElement | null) => !!el && !el.classList.contains('hidden');
  musicScene = sceneOf({
    film: !!document.getElementById('intro') || !!document.getElementById('newsreel') || !!document.getElementById('landing'),
    menu: shown(menuEl),
    ship: shown(shipEl) || (!!campaignUi && shown(document.getElementById('campaign'))),
    started, organ: under.open, outcome: sim.outcome, siege: sim.phase === 'siege', enemies: sim.enemies.length,
  }, musicScene);
  setScene(musicScene);
}

// ---------- the landing film (src/ui/landing.ts, src/meta/landing.ts) ----------

/** Which landing film plays before this run, if any (and why not, in window.__bfLandingWhy for the beats). */
async function landingFilmFor(afterOpening: boolean): Promise<{ film: LandingFilm; art: LandingArt } | null> {
  const q = params.get('landing');
  let forced = q === '1';
  try { forced ||= localStorage.getItem('broodfall-landing') === 'on'; } catch { /* private mode */ }
  const automated = typeof navigator !== 'undefined' && !!navigator.webdriver;
  const note = (why: string) => { (window as unknown as { __bfLandingWhy?: string }).__bfLandingWhy = why; };
  // The cheap answers first: a beat (automation) is not held up by a fetch.
  if (q === '0') { note('asked-off'); return null; }
  if (afterOpening) { note('after-opening'); return null; }
  if (automated && !forced) { note('automation'); return null; }
  const [manifest, art] = await Promise.all([loadManifest(), loadLandingArt()]);
  const set = manifest ? pickBiome(manifest, { biome: params.get('biome'), territory, seed: SEED }) : null;
  const s = loadSettings();
  const why = landingDecision({ mode: s.landingFilms, set, seen: landingSeen(), hasFilm: !!(set && art?.films[set]),
    afterOpening, automated, forced, off: false });
  note(why);
  return why === 'play' && art && set ? { film: art.films[set], art } : null;
}

/** The board as the landing film hands over to it: the canvas on the screen, the live meteor on it; null until drawn. */
function landingBoard(): LandingBoard | null {
  if (!bootDone || !renderer.app?.canvas) return null;
  const c = renderer.app.canvas.getBoundingClientRect();
  if (c.width < 2) return null;
  const p = renderer instanceof IsoRenderer ? renderer.worldToScreen(sim.core.x, sim.core.y) : null;
  return { canvas: { left: c.left, top: c.top, width: c.width, height: c.height }, core: p ? { x: p.x, y: p.y } : null };
}

let landing = false;
/**
 * A deployment begins: the tile set's landing film (it covers the board's loading), and the run's clock starts once
 * the film is over AND the board is drawn. With no film: at once, behind the loading screen as before.
 */
async function landThenStart(afterOpening = false): Promise<void> {
  if (landing) return;
  landing = true;
  started = false;
  const pick = await landingFilmFor(afterOpening).catch(() => null);
  if (pick) {
    const s = loadSettings();
    await playLanding(pick.film, pick.art, { board: landingBoard, reduceMotion: s.reduceMotion, reduceFlashes: s.reduceFlashes }).done;
    markLandingSeen(pick.film.set);
  }
  landing = false;
  started = true;
  if (!bootDone) loading.show('THE DEPLOYMENT');
  else showArtNotice(artFailed);
}

async function boot(): Promise<void> {
  const mount = document.getElementById('stage')!;
  // Sound (src/audio/): the buses, the first-click unlock, every console button, the music's scenes.
  initAudio();
  installConsoleSounds();
  window.setInterval(musicTick, 200);
  applyName();
  // The menu answers at once; the art loads behind it.
  setupMenu();
  setupScreens();
  // Mission 1: nothing on its screens speaks of the ship, the Board or the globe.
  hud.plain = FIRST;
  under.plain = FIRST;
  document.body.classList.toggle('first-mission', FIRST);
  // A deployment started from the address (a campaign run, a redeploy) waits behind the loading screen.
  if (started && CAMPAIGN !== 'ship') {
    loading.show('THE DEPLOYMENT', { cover: true });
    // The tile set's landing film over it (src/ui/landing.ts); the run's clock waits for the film and the board.
    void landThenStart();
  }
  // The opening cinematic, in front of everything; the board loads behind it.
  if (PLAY_INTRO) {
    void loadIntroArt().then((art) => playIntro(art).done).then(() => {
      markIntroSeen();
      if (!AUTOSTART) return;
      // Mission 1 after the opening film: the film ended at the crash site, it is this run's landing.
      void landThenStart(true);
    });
  }
  // The emblem around the name; the menu's own background is the viewport's loop (src/ui/menu.ts).
  void loadScreenArt().then((art) => dressLogos(art));
  void loadManifest().then((m) => {
    const file = m?.ship?.ship?.exterior;
    if (!file) return;
    // Until the loop plays (or when it is missing): the ship in orbit.
    menuEl.style.setProperty('--exterior', `url("${new URL(artUrl(file), document.baseURI).href}")`);
  });
  /** A fault screen that can be passed (playing on without the pictures): boot goes on when it is. */
  const passable = (detail: string) => new Promise<void>((resolve) => {
    loading.hide();
    showFailure({ kind: 'no-art', detail }, () => { if (started) loading.show('THE DEPLOYMENT'); resolve(); });
  });
  if (VIEW !== 'top') {
    const manifest = await loadManifest();
    if (!manifest) {
      await passable('public/art/manifest.json could not be read: the list of every picture the board is drawn with.');
    } else {
      // ?biome=megacity names a tile set; a campaign deployment is drawn with its territory's; a skirmish with one chosen by its seed.
      const art = await BoardArtSet.load(manifest, pickBiome(manifest, { biome: params.get('biome'), territory, seed: SEED }),
        (done, total) => loading.progress(done, total));
      if (art.terrain) {
        renderer = new IsoRenderer(art);
        boardArt = art;
        artFailed = art.failed;
      } else {
        await passable(`The board's floors and walls did not load.\n${art.failed.join('\n')}`);
      }
    }
  }
  document.body.classList.toggle('view-iso', renderer instanceof IsoRenderer);
  try {
    await renderer.init(mount, CFG.gridW * CFG.cellPx, CFG.gridH * CFG.cellPx);
  } catch (e) {
    loading.hide();
    showFailure({ kind: webglMissing() ? 'no-webgl' : 'crash', detail: String((e as Error)?.stack ?? e) });
    return;
  }
  // No WebGL: the board is drawn on a plain canvas instead (PixiJS falls back), slowly. Said once, over the board.
  if ((renderer.app.renderer as { name?: string }).name === 'canvas') showSlowDrawingNotice();
  bootDone = true;
  if (started) showArtNotice(artFailed);
  (window as unknown as { __bfBooted?: boolean }).__bfBooted = true;
  loading.hide();
  // The organ stage's stills, fetched while the first wave is being set up (src/main.ts openUnder).
  window.setTimeout(() => void underArt(), 1500);

  renderer.app.canvas.addEventListener('click', (ev) => { if (!dragged) handleCanvasClick(ev.clientX, ev.clientY); });
  // The isometric board can be looked at closely: the wheel zooms on the pointer, the
  // middle button (or Shift + drag) slides the view, Home frames the claimed districts again.
  let dragFrom: { x: number; y: number } | null = null;
  let dragged = false;
  const canvasScale = () => renderer.app.renderer.width / renderer.app.canvas.getBoundingClientRect().width;
  renderer.app.canvas.addEventListener('wheel', (ev) => {
    if (!(renderer instanceof IsoRenderer)) return;
    ev.preventDefault();
    const z = loadSettings().zoomStep; // the settings' zoom speed
    renderer.zoomAt(ev.clientX, ev.clientY, ev.deltaY < 0 ? z : 1 / z);
  }, { passive: false });
  renderer.app.canvas.addEventListener('pointerdown', (ev) => {
    dragged = false;
    if (renderer instanceof IsoRenderer && (ev.button === 1 || (ev.button === 0 && ev.shiftKey))) {
      dragFrom = { x: ev.clientX, y: ev.clientY };
      ev.preventDefault();
    }
  });
  window.addEventListener('pointermove', (ev) => {
    if (!dragFrom || !(renderer instanceof IsoRenderer)) return;
    const k = canvasScale();
    renderer.panBy((ev.clientX - dragFrom.x) * k, (ev.clientY - dragFrom.y) * k);
    if (Math.abs(ev.clientX - dragFrom.x) + Math.abs(ev.clientY - dragFrom.y) > 2) dragged = true;
    dragFrom = { x: ev.clientX, y: ev.clientY };
  });
  window.addEventListener('pointerup', () => { dragFrom = null; });
  window.addEventListener('keydown', (ev) => {
    if (!(renderer instanceof IsoRenderer) || (ev.target as HTMLElement).tagName === 'INPUT') return;
    const step = 90;
    // Q and E turn the board a quarter turn: what stands behind a block is seen from the other side.
    const turn = turnOf(loadSettings(), ev.key); // Q and E unless the settings say other keys
    if (turn) renderer.turnBy(turn);
    else if ((ev.key === 'c' || ev.key === 'C') && !ev.ctrlKey && !ev.metaKey && started && !debriefShown && !settingsOpen()) openRunCodex();
    else if (ev.key === 'Home') renderer.resetView();
    else if (ev.key === 'ArrowLeft') renderer.panBy(step, 0);
    else if (ev.key === 'ArrowRight') renderer.panBy(-step, 0);
    else if (ev.key === 'ArrowUp') renderer.panBy(0, step);
    else if (ev.key === 'ArrowDown') renderer.panBy(0, -step);
  });
  // The same, for a player who has not found the keys.
  const viewButton = (id: string, act: (r: IsoRenderer) => void): void => {
    document.getElementById(id)?.addEventListener('click', () => { if (renderer instanceof IsoRenderer) act(renderer); });
  };
  viewButton('view-turn-left', (r) => r.turnBy(-1));
  viewButton('view-turn-right', (r) => r.turnBy(1));
  viewButton('view-home', (r) => r.resetView());
  // The settings (src/ui/settings.ts): a ⚙ beside the view buttons; the run pauses while it is open.
  addRunButton(() => openRunSettings());
  // The Limb Codex: the ▤ beside it, the C key, and CODEX on a built limb's panel (at that limb).
  addCodexRunButton(() => openRunCodex());
  document.getElementById('inspect-codex')?.addEventListener('click', () => {
    const t = hud.inspectedId === null ? undefined : sim.towers.find((x) => x.id === hud.inspectedId);
    openRunCodex(t?.family);
  });
  installEdgeScroll((dx, dy) => { if (renderer instanceof IsoRenderer) renderer.panBy(dx, dy); },
    () => started && !debriefShown && !padOutroPlaying() && menuEl.classList.contains('hidden') && document.getElementById('campaign')!.classList.contains('hidden'));
  markSpeed(speed);
  // RIGHT-CLICK: turns the limb being placed a quarter (ANY limb: a directional one turns its
  // field of fire, a long one its ground, the rest the way they face), or a built limb under the
  // cursor; otherwise it cancels. (Esc always cancels.)
  renderer.app.canvas.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    const w = renderer.toWorld(ev.clientX, ev.clientY);
    if (selectedCard !== null && armedOrgan === null && hoverDonorId === null) {
      const cell = sim.cellAt(w.x, w.y);
      placeFacing = nextFacing(currentPlaceFacing(cell));
      // The ground a long limb takes turns with it: placed again, and checked again.
      placePreview(cell);
      updateHint();
      return;
    }
    if (selectedCard === null && armedOrgan === null && armedThrower === null) {
      const near = towerNearWorld(w.x, w.y);
      const t = near ? sim.towers.find((x) => x.id === near.id) : undefined;
      if (t) {
        // A long limb that is not directional keeps its ground: it turns end for end.
        const [sw, sh] = sim.spanOf(t.family, t.facing);
        const long = !towerSpec(t.family).directional && sw !== sh;
        const from = t.facing ?? (towerSpec(t.family).directional ? 'N' : 'S');
        sim.issue({ kind: 'set-facing', towerId: t.id, dir: long ? nextFacing(nextFacing(from)) : nextFacing(from) });
        hud.inspectedId = t.id;
        renderer.selectedTowerId = t.id;
        return;
      }
    }
    cancelAll();
  });
  // Right-click on the limb panel itself closes it too (it sits over the board's corner: a right-click
  // there must not fall to the browser's menu and leave the panel open).
  document.getElementById('inspect')?.addEventListener('contextmenu', (ev) => { ev.preventDefault(); cancelAll(); });
  window.addEventListener('keydown', (ev) => {
    // On the organ stage Esc first puts down the organ in hand (src/ui/underground.ts), whichever listener runs first.
    if (ev.key !== 'Escape' || settingsOpen() || ev.defaultPrevented || (under.open && under.selected)) return;
    // Esc with nothing in hand, armed or open: the settings (the run paused). Otherwise it cancels, as always.
    const idle = selectedCard === null && armedOrgan === null && armedThrower === null && !armedPlinth
      && armedNode === null && armedSpread === null && hud.inspectedId === null;
    if (idle && started && !debriefShown) openRunSettings();
    else cancelAll();
  });
  renderer.app.canvas.addEventListener('pointermove', (ev) => {
    hideReachTip();
    if (armedPlinth) {
      const wp = renderer.toWorld(ev.clientX, ev.clientY);
      const cp = sim.cellAt(wp.x, wp.y);
      const ground = sim.plinthGround(cp);
      renderer.preview = { cell: cp, cells: ground ?? [cp], kind: 'plinth', valid: ground !== null };
      return;
    }
    if (armedNode !== null && sim.nodeStock[armedNode]) {
      const wn = renderer.toWorld(ev.clientX, ev.clientY);
      const cn = sim.cellAt(wn.x, wn.y);
      const st = sim.nodeStock[armedNode];
      renderer.preview = { cell: cn, kind: 'node', valid: sim.canPlaceNode(cn, st.reach), radius: st.radius };
      return;
    }
    if (armedSpread !== null) {
      const wn = renderer.toWorld(ev.clientX, ev.clientY);
      const cn = sim.cellAt(wn.x, wn.y);
      const p = sim.creepSources.find((s) => s.id === armedSpread);
      if (p) renderer.preview = { cell: cn, kind: 'node', valid: sim.canSpreadTo(p, cn), radius: p.strain?.radius ?? 3, from: p.cell };
      return;
    }
    if (selectedCard === null && armedOrgan === null) {
      renderer.preview = null;
      const wh = renderer.toWorld(ev.clientX, ev.clientY);
      const hovered = sim.creepSources.find((s) => s.kind === 'node' && Math.hypot(sim.cellCenter(s.cell).x - wh.x, sim.cellCenter(s.cell).y - wh.y) < 13);
      if (hovered && hovered.strain) {
        const state = hovered.spent ? 'already spread its child'
          : sim.wavesCleared >= (hovered.matureAt ?? 0) ? 'READY — click it to spread its child' : 'maturing — spreads after it survives a wave';
        hud.setHint(`CREEP NODE ${strainIcons(hovered.strain)} (${strainLabel(hovered.strain)}) · HP ${Math.ceil(hovered.hp ?? 0)}/${hovered.maxHp ?? 0} · ${state}`);
        hoveringNode = true;
      } else if (hoveringNode) {
        hoveringNode = false;
        updateHint();
      }
      // The smoke in front of one of the body's walls: offer the burrow (hover shows what it digs).
      const hc = sim.cellAt(wh.x, wh.y);
      const site = !hovered && sim.map.cells[hc] === CellType.Void ? sim.burrowSiteAt(hc) : null;
      if (site) {
        const can = sim.phase !== 'siege' && !site.blocked && sim.meat.war >= B.burrowCost;
        renderer.preview = { cell: site.mouth[0], cells: site.carve, kind: 'burrow', valid: can };
        hud.setHint(sim.phase === 'siege' ? 'BURROW: the body digs between waves'
          : site.blocked ? 'BURROW: something of yours stands in the way'
            : `BURROW THROUGH THIS WALL — ${B.burrowCost} war: the district beyond can be drafted again, and the hive gets a new way in${can ? ' · click' : ' (not enough war meat)'}`);
        hoverBurrow = true;
      } else if (hoverBurrow) {
        hoverBurrow = false;
        updateHint();
      }
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
    placePreview(cell);
    const pv = renderer.preview as PlacementPreview | null;
    showReachTip(ev.clientX, ev.clientY, pv?.family
      ? reachText(sim.previewStats(pv.family, pv.cells ?? [pv.cell], pv.facing, sim.pendingPips)) : '');
  });

  const callEarlyBtn = document.getElementById('call-early')! as HTMLButtonElement;
  callEarlyBtn.addEventListener('click', () => sim.issue({ kind: 'call-early' }));

  // The hint line says what to do from the first second (it was empty until the first action).
  updateHint();

  let last = performance.now();
  let acc = 0;
  const frame = (now: number) => {
    const dtReal = Math.min(0.1, (now - last) / 1000);
    last = now;
    underLifecycle();
    if (started) coachTick(now);
    if (started && !under.open) {
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
    if (started) watchBoard(sim);
    hud.update(sim);
    decreeBox.update();
    under.update();
    updateBoardPanel();
    updateNodeButton();
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
    /** The board's renderer itself, for beats that look inside what it draws (tools/shot-board-art.mjs). */
    renderer,
    /** The HUD, for beats that open a limb's panel without clicking its pixels (tools/shot-codex.mjs). */
    hud,
    /** Close the between-waves organ screen (scripted play). */
    surface(): void {
      if (under.open) under.hide();
    },
    step(n: number): void {
      started = true;
      menuEl.classList.add('hidden');
      if (under.open) under.hide();
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
        organs: sim.organs.map((o) => ({ id: o.id, organ: o.organ, cell: o.cell, level: o.level })),
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
    /** Draft `n` districts at once, taking offer `pick` each time (tools/shot-cities.mjs: a grown city to look at). */
    growCity(n: number, pick = 0): number {
      for (let i = 0; i < n; i++) {
        const offers = draftOffers(sim.map, new Rng(SEED * 31 + i), 3);
        if (!offers.length) break;
        sim.phase = 'draft';
        sim.pendingDraft = offers;
        sim.issue({ kind: 'choose-plate', index: (pick + i) % offers.length });
      }
      renderer.draw(sim, 0.016);
      return sim.map.slots.filter(Boolean).length;
    },
    /** World coords -> canvas-pixel coords (for scripted clicking/sampling). */
    worldToScreen(x: number, y: number) {
      return renderer.worldToScreen(x, y);
    },
    /** The cell a click at these client coordinates would reach. */
    cellAtClient(clientX: number, clientY: number): number {
      const w = renderer.toWorld(clientX, clientY);
      return sim.cellAt(w.x, w.y);
    },
    /** The way the limb being placed faces now (right-click turns it), or null with nothing held. */
    previewFacing(): RootDir | null {
      return renderer.preview?.kind === 'tower' ? renderer.preview.facing ?? null : null;
    },
    /** 'iso' (the baked art) or 'top' (the old shapes). */
    view(): 'iso' | 'top' {
      return renderer instanceof IsoRenderer ? 'iso' : 'top';
    },
    /** How many quarter turns the view has turned (0 on the old board), and turning it. */
    turn(): number {
      return renderer instanceof IsoRenderer ? renderer.turn() : 0;
    },
    turnBy(quarters: number): void {
      if (renderer instanceof IsoRenderer) renderer.turnBy(quarters);
    },
    /** The tile set the board is drawn with ('' on the old board, or when the manifest names none). */
    biome(): string {
      return renderer instanceof IsoRenderer ? renderer.biome() : '';
    },
    /** The fallen units still drawn (empty on the old board). */
    dying() {
      return renderer instanceof IsoRenderer ? renderer.dyingNow() : [];
    },
    /** The effects on screen now (src/render/fx.ts), for the beats: shots, shells, bursts, streaks, bombs. */
    fx() {
      return renderer instanceof IsoRenderer ? renderer.fxNow() : { ready: false };
    },
    /** The families of the limbs playing their firing or acting clip now. */
    limbsActing(): string[] {
      return renderer instanceof IsoRenderer ? renderer.limbsActing() : [];
    },
    /** Limbs gone from the board that are playing their end (withering, carried off). */
    limbFalls() {
      return renderer instanceof IsoRenderer ? renderer.limbFalls() : [];
    },
    /** How many donor parts are drawn on limbs now. */
    graftsDrawn(): number {
      return renderer instanceof IsoRenderer ? renderer.graftsDrawn() : 0;
    },
    /** The core's stage as drawn (src/render/coreStage.ts): stage, the one it grows into, how far (s). */
    coreStage() {
      return renderer instanceof IsoRenderer ? renderer.coreStageNow() : null;
    },
    /** The Maws' tongues out now, and which carry a body (src/render/mawTongue.ts). */
    tongues() {
      return renderer instanceof IsoRenderer ? renderer.tonguesNow() : [];
    },
    /** Every limb's upgrade look, earned and drawn (content/upgradeLooks.ts): for the screenshots. */
    limbLooks() {
      return renderer instanceof IsoRenderer ? renderer.limbLooks() : [];
    },
    /** What of the baked art the board could not load (empty when all of it is there). */
    artMissing(): string[] {
      return renderer instanceof IsoRenderer ? renderer.missing() : [];
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

/** No WebGL canvas can be had in this browser (the board cannot be drawn without one). */
function webglMissing(): boolean {
  try {
    const c = document.createElement('canvas');
    return !(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return true;
  }
}

boot().catch((e: unknown) => {
  loading.hide();
  showFailure({ kind: 'crash', detail: String((e as Error)?.stack ?? e) });
});
