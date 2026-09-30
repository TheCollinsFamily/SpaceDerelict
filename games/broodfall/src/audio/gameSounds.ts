/**
 * WHAT MAKES A SOUND (src/audio/engine.ts plays them; src/audio/cues.ts says how).
 *
 * - The board: `watchBoard(sim)` every frame reads the sim (never changes it): a limb whose
 *   cooldown jumps up has fired (the renderer's own rule for its firing clip); a shot, shell or
 *   glob that is gone has landed; a card that is new in the hand was drawn; the core's stage
 *   (src/render/coreStage.ts) going up is the core evolving.
 * - The sim's events: `boardEvents(events)` (main.ts handleEvents): grown, lost, withered, killed,
 *   waves, the royal, the end.
 * - The console: `installConsoleSounds()` — every button of every screen clicks, hovers and is
 *   refused alike (one delegated listener, nothing per screen), the intercom opens and closes,
 *   a faction's call and the print-a-body scene are heard.
 */
import type { Sim } from '../sim/sim';
import type { SimEvent } from '../sim/types';
import { coreStageOf } from '../render/coreStage';
import { FIRE_CLASS, deathOf } from './cues';
import { say, sfx, sting } from './engine';

// ----------------------------------------------------------------------------- the board

const cooldowns = new Map<number, number>();
let shots = new Set<number>();
let shells = new Map<number, boolean>();
let lobs = new Set<number>();
let hand: number[] = [];
let coreStage = 0;
let lastTime = -1;
let lastSim: Sim | null = null;

/** Every frame of a deployment: what the board did since the last one. */
export function watchBoard(sim: Sim): void {
  if (sim !== lastSim) { lastSim = sim; cooldowns.clear(); shots = new Set(sim.projectiles.map((p) => p.id)); shells = new Map(sim.shells.map((s) => [s.id, s.side === 'body'])); lobs = new Set(); hand = sim.hand.map((c) => c.id); coreStage = coreStageOf(sim.stats.limbsGrown); lastTime = sim.time; return; }
  // Only time that passed makes sound (a paused or reloaded board is quiet).
  const moved = sim.time > lastTime;
  lastTime = sim.time;

  for (const t of sim.towers) {
    const was = cooldowns.get(t.id);
    cooldowns.set(t.id, t.cooldown);
    if (!moved || was === undefined) continue;
    if (t.cooldown > was + 0.05) {
      const id = FIRE_CLASS[t.family];
      if (id) sfx(id);
    }
  }
  if (cooldowns.size > sim.towers.length + 32) {
    const alive = new Set(sim.towers.map((t) => t.id));
    for (const id of cooldowns.keys()) if (!alive.has(id)) cooldowns.delete(id);
  }

  const nowShots = new Set(sim.projectiles.map((p) => p.id));
  if (moved) {
    let landed = 0;
    for (const id of shots) if (!nowShots.has(id)) landed++;
    if (landed) sfx('hit-splat', { gain: Math.min(1.4, 0.8 + landed * 0.1) });
  }
  shots = nowShots;

  const nowShells = new Map(sim.shells.map((s) => [s.id, s.side === 'body']));
  if (moved) {
    for (const [id, body] of nowShells) if (!shells.has(id) && !body) sfx('enemy-cannon');
    for (const [id] of shells) if (!nowShells.has(id)) sfx('hit-blast');
  }
  shells = nowShells;

  const nowLobs = new Set([...sim.bileFlights.map((b) => b.id), ...sim.clotFlights.map((c) => -1 - c.id)]);
  if (moved) for (const id of lobs) if (!nowLobs.has(id)) sfx('hit-blast', { gain: 0.8 });
  lobs = nowLobs;

  // A card that was not in the hand before (a draw); the whole hand turned over at once is one flutter.
  const nowHand = sim.hand.map((c) => c.id);
  const had = new Set(hand);
  const drawn = nowHand.filter((id) => !had.has(id)).length;
  for (let i = 0; i < Math.min(drawn, 3); i++) sfx('card-draw', { delay: i * 0.07 });
  hand = nowHand;

  const stage = coreStageOf(sim.stats.limbsGrown);
  if (stage > coreStage && moved) { sfx('core-evolve'); sting('sting-core', { gain: 0.8 }); }
  coreStage = stage;
}

let wavesCalled = 0;
let lastNarration = -1e9;
/** The newsreel narrator speaks now and then, never twice in a minute. */
function narrate(id: string, chance: number): void {
  const now = performance.now();
  if (now - lastNarration < 60000 || Math.random() > chance) return;
  if (say(id)) lastNarration = now;
}

/** The sim's events of a frame. */
export function boardEvents(events: SimEvent[]): void {
  for (const e of events) {
    switch (e.kind) {
      case 'built': sfx('limb-grow'); break;
      case 'organ-built': case 'organ-upgraded': sfx('organ-place'); break;
      case 'node-placed': case 'node-spread': sfx('creep-spread'); break;
      case 'node-grown': case 'seedling-grown': sfx('creep-pulse'); break;
      case 'plinth-placed': case 'plinth-grown': sfx('plinth-rise'); break;
      case 'cannibalized': sfx('cannibalize'); break;
      case 'butchered': case 'tower-stolen': sfx('limb-lost'); break;
      case 'structure-lost': sfx(/wither/.test(e.what) ? 'limb-wither' : 'limb-lost'); break;
      case 'evolved': sfx('evolve-limb'); break;
      case 'discarded': sfx('card-pick'); break;
      case 'kill': sfx(deathOf(e.enemy)); break;
      case 'martyr': sfx('hit-blast'); break;
      case 'wave-start':
        wavesCalled++;
        sting('sting-wave');
        sfx('assault-march', { delay: 1.2 });
        if (wavesCalled === 1) sfx('wave-siren', { delay: 0.3 });
        narrate(Math.random() < 0.5 ? 'nar-wave' : 'nar-wave-2', wavesCalled === 1 ? 1 : 0.35);
        break;
      case 'wave-cleared':
        sting('sting-cleared');
        narrate('nar-cleared', 0.3);
        break;
      case 'royal-incoming':
        sfx('boss-roar');
        lastNarration = -1e9;
        narrate('nar-royal', 1);
        break;
      case 'won': sting('sting-victory', { gain: 1 }); break;
      case 'lost': sting('sting-defeat', { gain: 1 }); break;
      default: break;
    }
  }
}

// ----------------------------------------------------------------------------- the console

/** A button that does nothing now (disabled, or marked so by its screen). */
const refused = (b: HTMLElement) => (b as HTMLButtonElement).disabled || b.classList.contains('disabled') || b.getAttribute('aria-disabled') === 'true' || b.dataset.dark === '1';
/** The decisions: deploy, continue, ally, choose; everything else is a plain click. */
const CONFIRM = /^(menu-campaign|menu-new|menu-deploy|ship-deploy|debrief-ship|call-early)$/;
const CONFIRM_SEL = '.screen-btn, [data-ally], [data-choice], [data-engage], .cp-pick, .draft-option';

let installed = false;
export function installConsoleSounds(): void {
  if (installed) return;
  installed = true;
  let hovered: Element | null = null;
  document.addEventListener('pointerover', (ev) => {
    const b = (ev.target as HTMLElement).closest?.('button, .card, .gene-card, .draft-option, [data-room]');
    if (!b || b === hovered) return;
    hovered = b;
    if (!refused(b as HTMLElement)) sfx('ui-hover');
  }, { passive: true });
  document.addEventListener('pointerout', (ev) => { if (!(ev.relatedTarget as HTMLElement | null)?.closest?.('button') ) hovered = null; }, { passive: true });
  document.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const card = t.closest?.('#hand .card, .hand .card');
    if (card) { sfx('card-pick'); return; }
    const b = t.closest?.('button, .gene-card, .draft-option') as HTMLElement | null;
    if (!b) return;
    if (refused(b)) { sfx('ui-deny'); return; }
    if (CONFIRM.test(b.id) || b.matches(CONFIRM_SEL)) sfx('ui-confirm');
    else sfx('ui-click');
  }, { capture: true });

  // What comes and goes on the screen (checked a few times a second; nothing per screen).
  let icom = false;
  let scene = '';
  let print = false;
  window.setInterval(() => {
    const i = !!document.querySelector('#campaign:not(.hidden) .cp-icom');
    if (i !== icom) { icom = i; sfx(i ? 'intercom-open' : 'intercom-close'); }
    const sc = document.querySelector('#campaign:not(.hidden) .cp-scene .screen-kicker')?.textContent ?? '';
    if (sc && sc !== scene) sting('sting-desk', { gain: 0.8 });
    scene = sc;
    const p = !!document.getElementById('yoke-scene');
    if (p && !print) sfx('print-body');
    print = p;
  }, 200);
}
