/**
 * PLACING A DRAFTED DISTRICT (Collins, Nov 22 2026: "after choosing a tile set it should not auto place it but let me
 * rotate it with R and place it where I want so long as the placement is legal").
 *
 * A card taken from the district draft is carried over the board: the district follows the pointer as a ghost over
 * the slot under it, green where it can go, red (with the reason on the hint line) where it cannot, its mouths lit by
 * what each meets. Every slot it fits as it is turned now is outlined green; the ones it would fit turned another way,
 * faint amber. A click on a green slot puts it down (the order carries the slot and the turn: Sim choose-plate).
 *   R: a quarter turn clockwise. Shift+R: the other way. Right-click: a quarter turn clockwise (as a limb in hand).
 *   Esc: back to the three cards (nothing is spent; the draft stays open). The panel's buttons do the same.
 * Nothing is armed: the card is the thing in hand, and the board answers wherever the pointer is.
 */
import { PLATE_FEATURES, checkPlacement, draftHeights, slotOfCell, turnedPattern, type DraftOffer, type PlatePattern } from '../sim/citymap';
import type { Sim } from '../sim/sim';
import type { Renderer } from '../render/render';
import './districtPlace.css';

export interface PlacerDeps {
  sim: () => Sim;
  renderer: () => Renderer;
  canvas: HTMLCanvasElement;
  /** The hint line (the HUD's). */
  hint: (text: string) => void;
  /** Give the hint line back to the game. */
  restoreHint: () => void;
  /** Show / hide the draft's cards. */
  showCards: () => void;
  hideCards: () => void;
  /** The district drawn as the board draws it (a data URL), turned as it is now; null when there is no board art. */
  picture?: (offer: DraftOffer, pattern: PlatePattern, slot: number) => string | null;
}

export interface DistrictPlacer {
  /** Take offer `index` of the open draft in hand. */
  pick(index: number): void;
  /** A district is in hand. */
  active(): boolean;
  /** Back to the cards. */
  cancel(): void;
  /** Turn the district in hand (1: clockwise, -1: the other way). */
  turn(by: number): void;
  /** Hover a slot as the pointer would (scripted play). */
  hoverSlot(slot: number | null): void;
  /** Put it down on the hovered slot, or on `slot` (scripted play): what the sim said. */
  place(slot?: number): { ok: boolean; err?: string };
  /** What is in hand now (scripted play, the beats). */
  state(): { index: number; rot: number; slot: number | null; problem: string | null; fits: number[]; fitsTurned: number[] } | null;
}

export function installDistrictPlacer(deps: PlacerDeps): DistrictPlacer {
  let hand: { index: number; rot: number; slot: number | null; draft: DraftOffer[] } | null = null;
  let downAt: { x: number; y: number } | null = null;
  const pics = new Map<string, string | null>();

  const panel = document.createElement('div');
  panel.id = 'place-district';
  panel.className = 'hidden';
  panel.innerHTML = `
    <div class="pd-head"><span class="pd-kicker">PLACE THE DISTRICT</span> <span class="pd-name"></span></div>
    <div class="pd-body">
      <img class="pd-pic" alt="">
      <div class="pd-side">
        <div class="pd-why"></div>
        <div class="pd-keys">Click a <b class="pd-green">green</b> slot · <b>R</b> turn · <b>Shift+R</b> / right-click turn back · <b>Esc</b> the cards</div>
        <div class="pd-btns">
          <button class="pd-ccw" title="Turn it the other way (Shift+R)">⟲ TURN</button>
          <button class="pd-cw" title="Turn it a quarter (R)">TURN ⟳</button>
          <button class="pd-back" title="Back to the three districts (Esc)">THE CARDS</button>
        </div>
      </div>
    </div>`;
  (deps.canvas.closest('#stage-wrap') ?? deps.canvas.parentElement ?? document.body).appendChild(panel);
  const q = <T extends HTMLElement>(sel: string) => panel.querySelector(sel) as T;
  q<HTMLButtonElement>('.pd-cw').addEventListener('click', () => turn(1));
  q<HTMLButtonElement>('.pd-ccw').addEventListener('click', () => turn(-1));
  q<HTMLButtonElement>('.pd-back').addEventListener('click', () => cancel());

  const live = (): boolean => {
    if (!hand) return false;
    const sim = deps.sim();
    // The draft closed or changed under it (a load, a new run): drop it.
    if (sim.phase !== 'draft' || sim.pendingDraft !== hand.draft) { drop(); return false; }
    return true;
  };

  const offer = (): DraftOffer => hand!.draft[hand!.index];
  const pattern = (): PlatePattern => turnedPattern(offer().pattern, hand!.rot);

  /** Every slot it fits as turned now, and the ones it fits only another way round. */
  const fitsOf = (): { fits: number[]; fitsTurned: number[] } => {
    const sim = deps.sim();
    const fits: number[] = [];
    const fitsTurned: number[] = [];
    for (const p of sim.draftPlacements(hand!.index)) {
      if (p.rot === hand!.rot) fits.push(p.slot);
      else if (!fitsTurned.includes(p.slot)) fitsTurned.push(p.slot);
    }
    return { fits, fitsTurned: fitsTurned.filter((s) => !fits.includes(s)) };
  };

  const problemAt = (slot: number | null): string | null => {
    if (slot === null) return 'move it over the city beside the districts you hold';
    return deps.sim().draftPlacementProblem(hand!.index, slot, hand!.rot);
  };

  const refresh = (): void => {
    if (!live()) return;
    const sim = deps.sim();
    const { fits, fitsTurned } = fitsOf();
    const slot = hand!.slot;
    const free = slot !== null && sim.map.slots[slot] === null;
    const pat = pattern();
    const check = slot !== null ? checkPlacement(sim.map, pat, slot) : null;
    const problem = problemAt(slot);
    deps.renderer().districtGhost = {
      slot, rows: pat.rows, free, ok: problem === null,
      heights: free && slot !== null ? draftHeights(sim.map, pat, slot, offer().feature) : null,
      edges: check?.edges ?? [], fits, fitsTurned,
    };
    const name = PLATE_FEATURES[offer().feature].name;
    q('.pd-name').textContent = `${name.toUpperCase()}${offer().shelter ? ' ⛫' : ''}`;
    const turned = slot !== null && fitsTurned.includes(slot);
    const why = problem === null
      ? 'It fits here: click to put it down.'
      : turned && !/turn it/.test(problem) ? `${cap(problem)} — it fits here turned (R).` : `${cap(problem)}.`;
    const whyEl = q('.pd-why');
    whyEl.textContent = why;
    whyEl.classList.toggle('ok', problem === null);
    const where = fits.length
      ? `${fits.length} green ${fits.length === 1 ? 'slot fits' : 'slots fit'} it this way round${fitsTurned.length ? `, ${fitsTurned.length} more turned` : ''}`
      : `no slot fits it this way round: turn it (R) — ${fitsTurned.length} ${fitsTurned.length === 1 ? 'slot fits' : 'slots fit'} it turned`;
    deps.hint(`PLACE ${name.toUpperCase()}: ${problem === null ? 'CLICK TO PUT IT DOWN' : problem.toUpperCase()} · ${where.toUpperCase()} · R TURNS IT · ESC: THE CARDS`);
    // Its picture, turned as it is now (on the slot it would take, for that slot's tile set).
    const at = free && slot !== null ? slot : offer().slot;
    const key = `${hand!.index}:${hand!.rot}:${at}`;
    if (!pics.has(key)) pics.set(key, deps.picture?.(offer(), pat, at) ?? null);
    const src = pics.get(key);
    const img = q<HTMLImageElement>('.pd-pic');
    img.style.display = src ? '' : 'none';
    if (src && img.src !== src) img.src = src;
  };

  const drop = (): void => {
    hand = null;
    pics.clear();
    panel.classList.add('hidden');
    deps.renderer().districtGhost = null;
  };

  const pick = (index: number): void => {
    const sim = deps.sim();
    if (sim.phase !== 'draft' || !sim.pendingDraft?.[index]) return;
    // It starts where it fits as it comes, so the first look shows a legal place (the offer's own).
    hand = { index, rot: 0, slot: sim.pendingDraft[index].slot, draft: sim.pendingDraft };
    deps.hideCards();
    panel.classList.remove('hidden');
    refresh();
  };

  const cancel = (): void => {
    if (!hand) return;
    drop();
    deps.restoreHint();
    if (deps.sim().phase === 'draft') deps.showCards();
  };

  const turn = (by: number): void => {
    if (!live()) return;
    hand!.rot = (((hand!.rot + by) % 4) + 4) % 4;
    refresh();
  };

  const hoverSlot = (slot: number | null): void => {
    if (!live() || hand!.slot === slot) return;
    hand!.slot = slot;
    refresh();
  };

  const place = (slot?: number): { ok: boolean; err?: string } => {
    if (!live()) return { ok: false, err: 'nothing in hand' };
    if (slot !== undefined) hoverSlot(slot);
    const at = hand!.slot;
    if (at === null) return { ok: false, err: 'no slot' };
    const index = hand!.index;
    const rot = hand!.rot;
    const r = deps.sim().issue({ kind: 'choose-plate', index, slot: at, rot });
    if (r.ok) {
      drop();
      deps.restoreHint();
    } else {
      // Said again, louder, where the eye is.
      const whyEl = q('.pd-why');
      whyEl.classList.remove('shake');
      void whyEl.offsetWidth;
      whyEl.classList.add('shake');
    }
    return r;
  };

  const slotUnder = (clientX: number, clientY: number): number | null => {
    const sim = deps.sim();
    const w = deps.renderer().toWorld(clientX, clientY);
    if (w.x < 0 || w.y < 0 || w.x >= sim.cfg.gridW * sim.cfg.cellPx || w.y >= sim.cfg.gridH * sim.cfg.cellPx) return null;
    return slotOfCell(sim.map, sim.cellAt(w.x, w.y));
  };

  // The board's own listeners are told nothing while a district is in hand (main.ts asks active()); these come first.
  deps.canvas.addEventListener('pointermove', (ev) => { if (live()) hoverSlot(slotUnder(ev.clientX, ev.clientY)); });
  deps.canvas.addEventListener('pointerdown', (ev) => { downAt = { x: ev.clientX, y: ev.clientY }; });
  window.addEventListener('click', (ev) => {
    if (!live() || ev.target !== deps.canvas) return;
    ev.stopPropagation();
    ev.preventDefault();
    // A drag (the view slid) is not a click.
    if (downAt && Math.abs(ev.clientX - downAt.x) + Math.abs(ev.clientY - downAt.y) > 5) return;
    hoverSlot(slotUnder(ev.clientX, ev.clientY));
    place();
  }, true);
  window.addEventListener('contextmenu', (ev) => {
    if (!live() || ev.target !== deps.canvas) return;
    ev.stopPropagation();
    ev.preventDefault();
    turn(1);
  }, true);
  window.addEventListener('keydown', (ev) => {
    if (!live()) return;
    const tag = (ev.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if ((ev.key === 'r' || ev.key === 'R') && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      ev.preventDefault();
      ev.stopPropagation();
      turn(ev.shiftKey ? -1 : 1);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      cancel();
    }
  }, true);

  return {
    pick, active: () => live(), cancel, turn, hoverSlot, place,
    state: () => {
      if (!live()) return null;
      const { fits, fitsTurned } = fitsOf();
      return { index: hand!.index, rot: hand!.rot, slot: hand!.slot, problem: problemAt(hand!.slot), fits, fitsTurned };
    },
  };
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

