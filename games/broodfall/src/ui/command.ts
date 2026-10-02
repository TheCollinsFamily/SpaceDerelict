/**
 * COMMANDING YOUR WALKING UNITS (Collins, Oct 1 2026: "Broodmothers and brood output should be
 * selectable", and orderable). Warriors (from a Brood Pit or a Broodmother) and Broodmothers:
 *
 *   click a unit                      select it (Shift: add or remove)
 *   drag a box on the board           select every unit in it (Shift: add)
 *   right-click / tap a street        MOVE there (Shift: queue it after the orders they have)
 *   A, then click                     ATTACK-MOVE there (fight what they meet on the way)
 *   H  hold · B  back to the body · G  guard (clear orders) · T  a Broodmother's mode · N, then click  her net
 *   D  a Spore Mule roots where it stands and becomes a creep node (Collins, Oct 2 2026)
 *   I  an Infestor goes to the shelter you click (or right-click a shelter) and burrows into it (Oct 2 2026)
 *   Ctrl+1..5 make a group · 1..5 select it · Esc  clear the selection
 *   a Brood Pit or Den's panel open: right-click a street sets its RALLY point; R selects its brood
 *
 * Every order is a sim command (deterministic, issued while paused too: they wait in the units' order
 * lists and are carried out when the clock runs). The panel at the bottom left does the same with buttons,
 * for touch and for a player who has not found the keys.
 */
import type { IsoRenderer } from '../render/isoRender';
import type { Sim } from '../sim/sim';
import { BALANCE } from '../../content/data';
import type { Broodling, Broodmother, Harrier, Infestor, Shelter, SporeMule, UnitOrder } from '../sim/types';

export interface CommandHooks {
  renderer: () => IsoRenderer | null;
  sim: () => Sim;
  /** Nothing else is in hand (no card, organ, throw, node or plinth armed): clicks are free for units. */
  idle: () => boolean;
  /** The limb whose panel is open (a Brood Pit or Den's rally point is set from it). */
  inspected: () => number | null;
  hint: (text: string) => void;
}

export interface Command {
  /** A click on the board: true when it was a unit command (the board's own click must not run). */
  consumeClick(clientX: number, clientY: number, pointerType: string, shift: boolean): boolean;
  /** Every frame: drop the dead from the selection, refresh the panel and what the board draws. */
  update(): void;
  /** Forget the selection (a new run). */
  clear(): void;
  readonly selected: ReadonlySet<number>;
}

type Armed = 'move' | 'attack' | 'net' | 'infest' | null;

export function installCommand(canvas: HTMLCanvasElement, hooks: CommandHooks): Command {
  const selected = new Set<number>();
  const groups = new Map<string, number[]>();
  let armed: Armed = null;
  let boxFrom: { x: number; y: number } | null = null;
  let boxEl: HTMLDivElement | null = null;
  let swallowClick = false;

  const panel = document.createElement('div');
  panel.id = 'unit-cmd';
  panel.className = 'hidden';
  panel.innerHTML = `
    <div id="unit-cmd-what"></div>
    <div class="unit-cmd-row">
      <button data-cmd="move" title="Move: then right-click or click a street (Shift queues)">MOVE <kbd>M</kbd></button>
      <button data-cmd="attack" title="Attack-move: then click a street; they fight what they meet on the way">ATTACK <kbd>A</kbd></button>
      <button data-cmd="hold" title="Hold position: fight only what comes within bite reach">HOLD <kbd>H</kbd></button>
    </div>
    <div class="unit-cmd-row">
      <button data-cmd="return" title="Back to the body, and guard it">BODY <kbd>B</kbd></button>
      <button data-cmd="guard" title="Clear their orders: back to their post (a Broodmother's side, or the Pit's rally point)">GUARD <kbd>G</kbd></button>
    </div>
    <div class="unit-cmd-row" id="unit-cmd-mother">
      <button data-cmd="mode" title="Brood mode: she stays and broods warriors. Fight mode: she walks, bites and nets.">BROOD / FIGHT <kbd>T</kbd></button>
      <button data-cmd="net" title="Throw her net: then click where (fight mode, in reach, off cooldown)">NET <kbd>N</kbd></button>
    </div>
    <div class="unit-cmd-row" id="unit-cmd-mule">
      <button data-cmd="deploy" title="Root here: the Spore Mule becomes a creep node where it stands, even past your creep">DEPLOY <kbd>D</kbd></button>
    </div>
    <div class="unit-cmd-row" id="unit-cmd-infestor">
      <button data-cmd="infest" title="Infest: then click a SHELTER; the Infestor walks to its door and burrows in (it is open to the defenders while it does). Right-clicking a shelter does it too">INFEST <kbd>I</kbd></button>
    </div>
    <div id="unit-cmd-help">right-click a street: move · Shift: queue · Ctrl+1-5: group · Esc: clear</div>`;
  (document.getElementById('inspect')?.parentElement ?? canvas.parentElement ?? document.body).appendChild(panel);
  const what = panel.querySelector('#unit-cmd-what') as HTMLDivElement;
  const motherRow = panel.querySelector('#unit-cmd-mother') as HTMLDivElement;
  const netBtn = panel.querySelector('[data-cmd="net"]') as HTMLButtonElement;
  const modeBtn = panel.querySelector('[data-cmd="mode"]') as HTMLButtonElement;
  const muleRow = panel.querySelector('#unit-cmd-mule') as HTMLDivElement;
  const infestorRow = panel.querySelector('#unit-cmd-infestor') as HTMLDivElement;

  type Unit = Broodling | Broodmother | SporeMule | Infestor | Harrier;
  const units = (): Unit[] => {
    const sim = hooks.sim();
    return [...sim.mothers, ...sim.infestors, ...sim.mules, ...sim.harriers, ...sim.broodlings.filter((b) => !b.puppet)];
  };
  const isBig = (u: Unit): boolean => 'mode' in u || 'cystId' in u;
  const selInfestors = (): Infestor[] => hooks.sim().infestors.filter((m) => selected.has(m.id));
  /** The intact shelter under a world point (its building, or close to its door). */
  const shelterNear = (w: { x: number; y: number }, client?: { x: number; y: number }): Shelter | null => {
    const sim = hooks.sim();
    // A shelter stands two storeys up: picked by where it is DRAWN on the screen too (a click on its roof maps to the ground
    // behind it).
    const r = hooks.renderer();
    if (client && r) {
      let best: Shelter | null = null;
      let bd = 70;
      for (const sh of sim.shelters) {
        if (sh.state !== 'intact') continue;
        const p = r.clientOf(sim, sh.pos.x, sh.pos.y);
        const d = Math.hypot(p.x - client.x, p.y - 30 - client.y);
        if (d < bd) { bd = d; best = sh; }
      }
      if (best) return best;
    }
    const cell = sim.cellAt(w.x, w.y);
    for (const sh of sim.shelters) {
      if (sh.state !== 'intact') continue;
      const door = sim.cellCenter(sh.door);
      if (sh.cells.includes(cell) || Math.hypot(door.x - w.x, door.y - w.y) < 18 || Math.hypot(sh.pos.x - w.x, sh.pos.y - w.y) < 30) return sh;
    }
    return null;
  };
  /** Send the selected Infestors into a shelter; anything else selected walks to its door with them. */
  const infest = (sh: Shelter): void => {
    const sim = hooks.sim();
    const inf = selInfestors();
    if (inf.length === 0) { hooks.hint('SELECT AN INFESTOR TO TAKE A SHELTER'); return; }
    let err = '';
    for (const u of inf) { const r = sim.issue({ kind: 'infest', unitId: u.id, shelterId: sh.id }); if (!r.ok) err = String(r.err); }
    const escort = [...selected].filter((id) => !inf.some((u) => u.id === id));
    if (escort.length) sim.issue({ kind: 'unit-order', ids: escort, order: { kind: 'attack', to: sim.cellCenter(sh.door) } });
    hooks.hint(err ? err.toUpperCase() : 'INFEST: IT WALKS TO THE SHELTER AND BURROWS IN (GUARD IT WHILE IT DOES)');
  };
  const isMule = (u: Unit): u is SporeMule => 'strain' in u;
  const selMules = (): SporeMule[] => hooks.sim().mules.filter((m) => selected.has(m.id));
  const isMother = (u: Unit): u is Broodmother => 'mode' in u;
  const selMothers = (): Broodmother[] => hooks.sim().mothers.filter((m) => selected.has(m.id));

  const order = (o: UnitOrder, queue = false): void => {
    if (selected.size === 0) return;
    const res = hooks.sim().issue({ kind: 'unit-order', ids: [...selected], order: o, queue });
    if (!res.ok) hooks.hint(String(res.err).toUpperCase());
  };

  const toggleMode = (): void => {
    const ms = selMothers();
    if (ms.length === 0) return;
    const to = ms.every((m) => m.mode === 'fight') ? 'brood' : 'fight';
    let refused = 0;
    for (const m of ms) if (!hooks.sim().issue({ kind: 'mother-mode', motherId: m.id, mode: to }).ok) refused++;
    // She broods only on your creep (Collins, Oct 2 2026): say why, not just nothing.
    if (to === 'brood' && refused === ms.length) hooks.hint('SHE BROODS ONLY ON YOUR CREEP: WALK HER ONTO IT, OR ROOT A SPORE MULE UNDER HER');
    else hooks.hint(to === 'brood' ? (refused ? `BROOD MODE (${refused} OFF THE CREEP STAY IN FIGHT MODE)` : 'BROOD MODE: SHE STAYS AND BROODS WARRIORS') : 'FIGHT MODE: SHE HUNTS, BITES AND NETS');
  };

  const deploy = (): void => {
    const ms = selMules();
    if (ms.length === 0) { hooks.hint('SELECT A SPORE MULE TO DEPLOY IT'); return; }
    let ok = 0;
    let err = '';
    for (const m of ms) { const r = hooks.sim().issue({ kind: 'mule-deploy', muleId: m.id }); if (r.ok) ok++; else err = String(r.err); }
    hooks.hint(ok ? `ROOTED: ${ok} NEW CREEP NODE${ok > 1 ? 'S' : ''}` : err.toUpperCase());
  };

  const arm = (a: Armed): void => {
    armed = a;
    if (a === 'move') hooks.hint('MOVE: click a street (Shift queues)');
    if (a === 'attack') hooks.hint('ATTACK-MOVE: click a street; they fight what they meet on the way');
    if (a === 'net') hooks.hint('NET: click where to throw it');
    if (a === 'infest') hooks.hint('INFEST: click a shelter');
  };

  const run = (cmd: string): void => {
    if (cmd === 'move' || cmd === 'attack' || cmd === 'net' || cmd === 'infest') arm(cmd);
    else if (cmd === 'hold') order({ kind: 'hold' });
    else if (cmd === 'return') order({ kind: 'return' });
    else if (cmd === 'guard') order({ kind: 'guard' });
    else if (cmd === 'mode') toggleMode();
    else if (cmd === 'deploy') deploy();
  };
  panel.querySelectorAll('button[data-cmd]').forEach((b) => {
    b.addEventListener('click', (ev) => { ev.stopPropagation(); run((b as HTMLElement).dataset.cmd!); });
  });

  /** The unit drawn under a point (a Broodmother is big; warriors are small). */
  const unitAt = (clientX: number, clientY: number): Unit | null => {
    const r = hooks.renderer();
    if (!r) return null;
    let best: Unit | null = null;
    let bd = Infinity;
    for (const u of units()) {
      const p = r.clientOf(hooks.sim(), u.pos.x, u.pos.y);
      const reach = isBig(u) ? 30 : 16;
      // The picture stands above its feet: measure to a point a little up the body.
      const d = Math.hypot(p.x - clientX, p.y - (isBig(u) ? 14 : 6) - clientY);
      if (d < reach && d < bd) { bd = d; best = u; }
    }
    return best;
  };

  const worldAt = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const r = hooks.renderer();
    return r ? r.toWorld(clientX, clientY) : null;
  };

  // ---- the box ----
  canvas.addEventListener('pointerdown', (ev) => {
    // Shift-drag pans the board; a touch drag pans too (a box is a mouse thing).
    if (ev.button !== 0 || ev.shiftKey || ev.pointerType === 'touch') return;
    if (!hooks.idle() || !hooks.renderer()) return;
    boxFrom = { x: ev.clientX, y: ev.clientY };
  });
  window.addEventListener('pointermove', (ev) => {
    if (!boxFrom) return;
    const dx = ev.clientX - boxFrom.x;
    const dy = ev.clientY - boxFrom.y;
    if (!boxEl && Math.abs(dx) + Math.abs(dy) < 8) return;
    if (!boxEl) {
      boxEl = document.createElement('div');
      boxEl.id = 'unit-box';
      document.body.appendChild(boxEl);
    }
    boxEl.style.left = `${Math.min(ev.clientX, boxFrom.x)}px`;
    boxEl.style.top = `${Math.min(ev.clientY, boxFrom.y)}px`;
    boxEl.style.width = `${Math.abs(dx)}px`;
    boxEl.style.height = `${Math.abs(dy)}px`;
  });
  window.addEventListener('pointerup', (ev) => {
    const from = boxFrom;
    boxFrom = null;
    if (!from || !boxEl) return;
    boxEl.remove();
    boxEl = null;
    const r = hooks.renderer();
    if (!r) return;
    const x0 = Math.min(from.x, ev.clientX);
    const x1 = Math.max(from.x, ev.clientX);
    const y0 = Math.min(from.y, ev.clientY);
    const y1 = Math.max(from.y, ev.clientY);
    if (!ev.shiftKey) selected.clear();
    for (const u of units()) {
      const p = r.clientOf(hooks.sim(), u.pos.x, u.pos.y);
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) selected.add(u.id);
    }
    swallowClick = true; // the click that ends a drag is not a click
    armed = null;
  });

  // ---- right-click: move (or the rally point of the open Pit or Den) ----
  canvas.addEventListener('contextmenu', (ev) => {
    if (!hooks.idle()) return;
    const w = worldAt(ev.clientX, ev.clientY);
    if (!w) return;
    const sim = hooks.sim();
    if (selected.size > 0) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      // A right-click on a shelter with an Infestor selected: take it.
      const sh = selInfestors().length ? shelterNear(w, { x: ev.clientX, y: ev.clientY }) : null;
      if (sh) { infest(sh); armed = null; return; }
      order({ kind: armed === 'attack' ? 'attack' : 'move', to: w }, ev.shiftKey);
      armed = null;
      return;
    }
    const insp = hooks.inspected();
    const t = insp === null ? undefined : sim.towers.find((x) => x.id === insp);
    if (t && (t.family === 'hatch' || t.family === 'brood')) {
      const cell = sim.cellAt(w.x, w.y);
      // A right-click on the limb itself still turns it (main.ts); anywhere else is its rally point.
      if (sim.cellsOf(t).includes(cell)) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      const res = sim.issue({ kind: 'set-rally', towerId: t.id, cell });
      hooks.hint(res.ok ? 'RALLY POINT SET: its new warriors gather there' : String(res.err).toUpperCase());
    }
  }, { capture: true });

  // ---- keys ----
  window.addEventListener('keydown', (ev) => {
    const tag = (ev.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || !hooks.renderer()) return;
    const k = ev.key.toLowerCase();
    // R with a Brood Pit or Den's panel open: select its brood (and its Broodmothers).
    if (k === 'r' && selected.size === 0 && hooks.idle()) {
      const insp = hooks.inspected();
      const sim = hooks.sim();
      const t = insp === null ? undefined : sim.towers.find((x) => x.id === insp);
      if (t && (t.family === 'hatch' || t.family === 'brood')) {
        for (const b of sim.broodlings) if (b.motherId === t.id && !b.puppet) selected.add(b.id);
        for (const m of sim.mothers) if (m.denId === t.id) selected.add(m.id);
        ev.preventDefault();
        return;
      }
    }
    if (/^[1-5]$/.test(ev.key)) {
      if (ev.ctrlKey || ev.metaKey) {
        if (selected.size > 0) { groups.set(ev.key, [...selected]); hooks.hint(`GROUP ${ev.key} SET (${selected.size})`); ev.preventDefault(); }
        return;
      }
      const g = groups.get(ev.key);
      if (g && !ev.altKey) {
        const alive = new Set(units().map((u) => u.id));
        selected.clear();
        for (const id of g) if (alive.has(id)) selected.add(id);
        ev.preventDefault();
      }
      return;
    }
    if (selected.size === 0) return;
    if (ev.key === 'Escape') {
      if (armed) armed = null; else selected.clear();
      ev.preventDefault();
      ev.stopImmediatePropagation();
      return;
    }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const map: Record<string, string> = { m: 'move', a: 'attack', h: 'hold', b: 'return', g: 'guard', t: 'mode', n: 'net', d: 'deploy', i: 'infest' };
    if (map[k]) { run(map[k]); ev.preventDefault(); ev.stopImmediatePropagation(); }
  }, { capture: true });

  const consumeClick = (clientX: number, clientY: number, pointerType: string, shift: boolean): boolean => {
    if (swallowClick) { swallowClick = false; return true; }
    if (!hooks.renderer() || !hooks.idle()) return false;
    const sim = hooks.sim();
    if (armed && selected.size > 0) {
      const w = worldAt(clientX, clientY);
      if (!w) return true;
      if (armed === 'infest') {
        const sh = shelterNear(w, { x: clientX, y: clientY });
        if (sh) infest(sh); else hooks.hint('NO SHELTER THERE: CLICK A SHELTER');
      } else if (armed === 'net') {
        const ms = selMothers().filter((m) => m.mode === 'fight');
        // The nearest fighting mother that can reach throws it.
        ms.sort((a, b) => Math.hypot(a.pos.x - w.x, a.pos.y - w.y) - Math.hypot(b.pos.x - w.x, b.pos.y - w.y));
        const res = ms.length ? sim.issue({ kind: 'mother-net', motherId: ms[0].id, at: w }) : { ok: false, err: 'no Broodmother in fight mode selected' };
        hooks.hint(res.ok ? 'NET THROWN' : String(res.err).toUpperCase());
      } else order({ kind: armed, to: w }, shift);
      armed = null;
      return true;
    }
    const u = unitAt(clientX, clientY);
    if (u) {
      if (!shift) selected.clear();
      if (shift && selected.has(u.id)) selected.delete(u.id); else selected.add(u.id);
      return true;
    }
    if (selected.size > 0 && pointerType === 'touch') {
      const w = worldAt(clientX, clientY);
      if (w) order({ kind: 'move', to: w });
      return true;
    }
    if (selected.size > 0) selected.clear();
    return false;
  };

  const update = (): void => {
    const r = hooks.renderer();
    const sim = hooks.sim();
    const alive = new Set(units().map((u) => u.id));
    for (const id of [...selected]) if (!alive.has(id)) selected.delete(id);
    if (r) {
      r.selectedUnits = selected;
      const rally = new Set<number>();
      const insp = hooks.inspected();
      if (insp !== null) rally.add(insp);
      for (const b of sim.broodlings) if (selected.has(b.id) && b.motherUnit === undefined) rally.add(b.motherId);
      for (const m of sim.mothers) if (selected.has(m.id)) rally.add(m.denId);
      r.rallyFor = rally;
    }
    if (selected.size === 0 || !r) { panel.classList.add('hidden'); armed = null; return; }
    panel.classList.remove('hidden');
    const ms = selMothers();
    const ws = sim.broodlings.filter((b) => selected.has(b.id)).length;
    const parts: string[] = [];
    if (ms.length) {
      parts.push(ms.map((m) => `BROODMOTHER · ${m.mode === 'fight' ? 'FIGHT' : 'BROOD'}${(m.stunnedUntil ?? 0) > sim.time ? ' · SEDATED' : ''} · ${Math.ceil(m.hp)}/${Math.ceil(m.maxHp)}`
        + (m.mode === 'brood' ? ` · ${sim.broodlings.filter((b) => b.motherUnit === m.id).length}/${sim.motherBroodCap(m)} warriors` : '')).join('<br>'));
    }
    if (ws) parts.push(`${ws} WARRIOR${ws === 1 ? '' : 'S'}`);
    const mus = selMules();
    if (mus.length) {
      parts.push(mus.map((m) => {
        const on = sim.isCreeped(sim.cellAt(m.pos.x, m.pos.y));
        return `SPORE MULE · ${Math.ceil(m.hp)}/${Math.ceil(m.maxHp)} · ${on ? 'ON YOUR CREEP' : 'PAST THE CREEP'}`;
      }).join('<br>'));
    }
    const infs = selInfestors();
    if (infs.length) {
      parts.push(infs.map((u) => {
        const sh = u.infest !== undefined ? sim.shelters.find((x) => x.id === u.infest) : undefined;
        const burrow = sh && sh.burrowBy === u.id ? ` · BURROWING ${Math.round(((sh.burrowT ?? 0) / BALANCE.infestChannel) * 100)}%` : sh ? ' · TO THE SHELTER' : '';
        return `INFESTOR · ${Math.ceil(u.hp)}/${Math.ceil(u.maxHp)}${burrow}`;
      }).join('<br>'));
    }
    const hs = sim.harriers.filter((u) => selected.has(u.id));
    if (hs.length) parts.push(hs.map((u) => `HARRIER · ${Math.ceil(u.hp)}/${Math.ceil(u.maxHp)}${u.orders.length ? '' : ' · HUNTING THE SCIENCE CASTE'}`).join('<br>'));
    what.innerHTML = parts.join('<br>') + (armed ? `<br><b>${armed.toUpperCase()}: click where</b>` : '');
    infestorRow.style.display = infs.length ? '' : 'none';
    motherRow.style.display = ms.length ? '' : 'none';
    muleRow.style.display = mus.length ? '' : 'none';
    // A mother off the creep cannot brood (Collins, Oct 2 2026): the toggle says so instead of doing nothing.
    const offCreep = ms.length > 0 && ms.every((m) => m.mode === 'fight' && !sim.motherOnCreep(m));
    modeBtn.disabled = offCreep;
    modeBtn.title = offCreep ? 'She broods only on your creep: walk her onto it, or root a Spore Mule under her' : 'Brood mode: she stays and broods warriors (only on your creep). Fight mode: she walks, bites and nets.';
    const fighters = ms.filter((m) => m.mode === 'fight');
    const cd = fighters.length ? Math.min(...fighters.map((m) => m.netCd)) : Infinity;
    netBtn.disabled = !(cd <= 0);
    netBtn.innerHTML = cd <= 0 ? 'NET <kbd>N</kbd>' : fighters.length ? `NET ${Math.ceil(cd)}s` : 'NET (fight mode)';
    modeBtn.innerHTML = offCreep ? 'BROOD: NEEDS CREEP' : ms.length && ms.every((m) => m.mode === 'fight') ? 'TO BROOD <kbd>T</kbd>' : 'TO FIGHT <kbd>T</kbd>';
    panel.querySelectorAll('button[data-cmd]').forEach((b) => {
      b.classList.toggle('on', (b as HTMLElement).dataset.cmd === armed);
    });
  };

  return {
    consumeClick,
    update,
    clear: () => { selected.clear(); groups.clear(); armed = null; },
    get selected() { return selected; },
  };
}
