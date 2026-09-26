/**
 * Broodfall entry: wires sim + renderer + HUD, owns the fixed-timestep loop,
 * input, and demo mode (?auto=1&seed=N&speed=M).
 */
import { Autoplayer } from './sim/autoplayer';
import { DT, Sim, organSpec, towerSpec } from './sim/sim';
import { Renderer } from './render/render';
import { Hud } from './ui/hud';
import type { Directive, OrganId, SimConfig } from './sim/types';

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') ?? Math.floor(Math.random() * 1e9));
const AUTO = params.get('auto') === '1';
const START_SPEED = Number(params.get('speed') ?? 1);

const DIRECTIVES: Record<string, Directive> = {
  hold: { kind: 'hold', waves: 12 },
  royal: { kind: 'royal', count: 1 },
  harvest: { kind: 'harvest', science: 80 },
};
const directive = DIRECTIVES[params.get('directive') ?? ''];

const CFG: SimConfig = { gridW: 40, gridH: 30, cellPx: 32, seed: SEED, directive };

let sim = new Sim(CFG);
const auto = AUTO ? new Autoplayer(SEED + 1) : null;
let speed = Number.isFinite(START_SPEED) && START_SPEED >= 0 ? START_SPEED : 1;

const renderer = new Renderer();

let selectedCard: number | null = null;
let armedOrgan: OrganId | null = null;
let cannibalizeMode = false;
let donorId: number | null = null;

const hud = new Hud({
  onSelectCard(i) {
    selectedCard = i;
    donorId = null;
    updateHint();
  },
  onArmOrgan(o) {
    armedOrgan = o;
    donorId = null;
    updateHint();
  },
  onToggleCannibalize() {
    cannibalizeMode = hud.cannibalizeMode;
    donorId = null;
    updateHint();
  },
  onRoyalSurge() {
    sim.issue({ kind: 'royal-surge' });
  },
  onSpeed(mult) {
    speed = mult;
  },
  onRestart() {
    location.href = location.pathname + (AUTO ? `?auto=1&speed=${speed}` : '');
  },
});

function updateHint(): void {
  if (armedOrgan) {
    hud.setHint(`place ${organSpec(armedOrgan).name} inside the body mass`);
  } else if (selectedCard !== null && cannibalizeMode && donorId === null) {
    hud.setHint('pick one of your limbs to feed into this build');
  } else if (selectedCard !== null && donorId !== null) {
    hud.setHint('place the new limb — the donor is consumed');
  } else if (selectedCard !== null) {
    hud.setHint('place on the creep — FEED A LIMB to inherit traits');
  } else {
    hud.setHint(AUTO ? 'demo mode: the asset is piloting itself' : '');
  }
}

function handleCanvasClick(clientX: number, clientY: number): void {
  const w = renderer.toWorld(clientX, clientY);
  const cell = sim.cellAt(w.x, w.y);

  // Gland cycling: click a gland with nothing armed.
  if (selectedCard === null && armedOrgan === null) {
    for (const o of sim.organs) {
      if (o.organ === 'gland' && Math.hypot(o.pos.x - w.x, o.pos.y - w.y) < 20) {
        sim.issue({ kind: 'cycle-gland', organInstanceId: o.id });
        return;
      }
    }
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
    // Cannibalize flow: first click picks the donor, second places.
    if (cannibalizeMode && donorId === null) {
      for (const t of sim.towers) {
        if (Math.hypot(t.pos.x - w.x, t.pos.y - w.y) < 22) {
          donorId = t.id;
          renderer.donorHighlightId = t.id;
          updateHint();
          return;
        }
      }
      return;
    }
    const res = sim.issue({
      kind: 'build', cardIndex: selectedCard, cell,
      cannibalizeTowerId: donorId ?? undefined,
    });
    if (res.ok) {
      selectedCard = null;
      hud.selectedCard = null;
      donorId = null;
      renderer.donorHighlightId = null;
      if (cannibalizeMode) {
        cannibalizeMode = false;
        hud.cannibalizeMode = false;
      }
      updateHint();
    }
  }
}

async function boot(): Promise<void> {
  const mount = document.getElementById('stage')!;
  await renderer.init(mount, CFG.gridW * CFG.cellPx, CFG.gridH * CFG.cellPx);

  renderer.app.canvas.addEventListener('click', (ev) => handleCanvasClick(ev.clientX, ev.clientY));
  renderer.app.canvas.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    selectedCard = null;
    armedOrgan = null;
    donorId = null;
    renderer.donorHighlightId = null;
    hud.selectedCard = null;
    hud.armedOrgan = null;
    updateHint();
  });
  renderer.app.canvas.addEventListener('pointermove', (ev) => {
    if (selectedCard === null && armedOrgan === null) {
      renderer.preview = null;
      return;
    }
    const w = renderer.toWorld(ev.clientX, ev.clientY);
    const cell = sim.cellAt(w.x, w.y);
    renderer.preview = armedOrgan
      ? { cell, kind: 'organ', valid: sim.canBuildOrgan(cell) }
      : {
        cell, kind: 'tower',
        family: sim.hand[selectedCard!]?.family,
        valid: sim.canBuildTower(cell),
      };
  });

  if (AUTO) updateHint();

  let last = performance.now();
  let acc = 0;
  const frame = (now: number) => {
    const dtReal = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dtReal * speed;
    let steps = 0;
    while (acc >= DT && steps < 64) {
      if (auto) auto.act(sim, DT);
      sim.tick();
      acc -= DT;
      steps++;
    }
    hud.pushEvents(sim.takeEvents());
    hud.update(sim);
    renderer.draw(sim, dtReal);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Expose for the visual-check script and console poking.
  (window as unknown as { broodfall: { sim: Sim } }).broodfall = { sim };
}

void boot();
