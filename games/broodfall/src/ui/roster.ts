/**
 * THE ROSTER (Collins, Oct 2 2026: "an image of every unit type you have in the top left of your screen, as well as
 * an ALL UNITS button ... click one of these, then click a location, and all units of that type (or all units) go
 * there or fight the thing you clicked"). The low-micro way to command: one portrait per unit kind you have (with
 * its count) and ALL; click one, then click the board:
 *
 *   an enemy or its structure   they hunt it down, then come home          (a sortie)
 *   your outpost                they go and guard its door
 *   the body                    they come home
 *   anywhere else               they go there, fighting what they meet, and stay
 *
 * Right-click or Esc cancels. Keys: F1..F5 the portraits in order, ` (backquote) ALL. Each kind that answers
 * alerts has an AUTO toggle under its portrait. ALERTS (a science party, an engineer, a field station, an outpost
 * under attack) show as toasts under the roster with SEND: one click sends the right units (src/sim/groups.ts).
 * The individual select / box / command panel (src/ui/command.ts) stays for players who want it.
 */
import type { IsoRenderer } from '../render/isoRender';
import type { Sim } from '../sim/sim';
import { ALERT_ANSWER, UNIT_KINDS, type UnitKind, type Who } from '../sim/groups';
import { artUrl } from '../render/art';

export interface RosterHooks {
  renderer: () => IsoRenderer | null;
  sim: () => Sim;
  /** Nothing else in hand: a board click is free for the roster. */
  idle: () => boolean;
  hint: (text: string) => void;
}

export interface Roster {
  /** A click on the board: true when it carried out an armed group order. */
  consumeClick(clientX: number, clientY: number): boolean;
  update(): void;
  /** Disarm (a new run, or another tool armed). */
  clear(): void;
  readonly armed: Who | null;
}

/** Each kind's portrait: a walking frame of its unit art (a Spore Mule is a broodling in its sac's green). */
const PORTRAIT: Record<UnitKind, { art: string; filter?: string }> = {
  warrior: { art: 'broodling' },
  mother: { art: 'broodmother' },
  harrier: { art: 'harrier' },
  infestor: { art: 'infestor' },
  mule: { art: 'broodling', filter: 'hue-rotate(80deg) saturate(1.3)' },
};
/** Alerts in the game's voice. */
const ALERT_TEXT: Record<string, string> = {
  science: 'SCIENCE PARTY',
  engineer: 'ENGINEER SETTING UP',
  station: 'FIELD STATION STANDING',
  outpost: 'OUTPOST UNDER ATTACK',
};
const KIND_WORD: Record<UnitKind, string> = { warrior: 'WARRIORS', mother: 'MOTHERS', harrier: 'HARRIERS', mule: 'MULES', infestor: 'INFESTORS' };

interface ManifestUnit { atlas: string; frame: number; cols: number; anims: { walk: Record<string, { start: number }> } }

export function installRoster(hooks: RosterHooks): Roster {
  let armed: Who | null = null;
  const el = document.createElement('div');
  el.id = 'unit-roster';
  el.className = 'hidden';
  const toasts = document.createElement('div');
  toasts.id = 'unit-alerts';
  (document.getElementById('inspect')?.parentElement ?? document.body).append(el, toasts);

  // Portrait art from the manifest (read once; the board loads the same file).
  const art = new Map<string, ManifestUnit>();
  void fetch(artUrl('manifest.json')).then((r) => r.json()).then((m: { allies?: Record<string, ManifestUnit> }) => {
    for (const [k, v] of Object.entries(m.allies ?? {})) art.set(k, v);
    built = '';
  }).catch(() => { /* no art: the portraits stay lettered */ });

  const marks: Array<{ el: HTMLDivElement; x: number; y: number; until: number }> = [];
  const mark = (wx: number, wy: number, text: string): void => {
    const m = document.createElement('div');
    m.className = 'unit-roster-mark';
    m.textContent = text;
    document.body.appendChild(m);
    marks.push({ el: m, x: wx, y: wy, until: performance.now() + 1800 });
  };

  const arm = (who: Who | null): void => {
    armed = who;
    if (who === null) return;
    const what = who === 'all' ? 'ALL FIGHTERS' : `ALL ${KIND_WORD[who]}`;
    hooks.hint(`${what}: click an enemy (hunt it) · your outpost (guard it) · the body (home) · anywhere (go there) · Esc cancels`);
  };

  // ---- the portraits ----
  let built = '';
  const kindsPresent = (): Array<{ kind: UnitKind; n: number }> =>
    UNIT_KINDS.map((k) => ({ kind: k.kind, n: k.list(hooks.sim()).length })).filter((k) => k.n > 0);

  const portraitStyle = (kind: UnitKind): string => {
    const p = PORTRAIT[kind];
    const a = art.get(p.art);
    if (!a) return '';
    const start = a.anims.walk.S?.start ?? 0;
    const size = 44; // the portrait box, px
    const scale = size / (a.frame * 0.62); // crop to the body: the frame has room round it
    const sheet = a.cols * a.frame * scale;
    const x = (start % a.cols) * a.frame * scale + (a.frame * scale - size) / 2;
    const y = Math.floor(start / a.cols) * a.frame * scale + (a.frame * scale - size) * 0.62;
    return `background-image:url(${artUrl(a.atlas)});background-size:${sheet}px auto;background-position:-${x}px -${y}px;${p.filter ? `filter:${p.filter};` : ''}`;
  };

  const rebuild = (present: Array<{ kind: UnitKind; n: number }>): void => {
    const sim = hooks.sim();
    const fighters = present.filter((p) => UNIT_KINDS.find((k) => k.kind === p.kind)!.inAll).reduce((n, p) => n + p.n, 0);
    let html = fighters ? `<button class="ur-btn ur-all" data-who="all" title="ALL your fighters (not mules or Infestors). Then click where. Key: \`"><span class="ur-all-txt">ALL</span><b class="ur-n">${fighters}</b><kbd>\`</kbd></button>` : '';
    present.forEach((p, i) => {
      const k = UNIT_KINDS.find((x) => x.kind === p.kind)!;
      const answers = Object.values(ALERT_ANSWER).some((who) => who.includes(p.kind));
      html += `<div class="ur-slot"><button class="ur-btn" data-who="${p.kind}" title="All your ${k.name.toLowerCase()}. Then click where. Key: F${i + 1}">`
        + `<span class="ur-face" style="${portraitStyle(p.kind)}"></span><b class="ur-n">${p.n}</b><kbd>F${i + 1}</kbd></button>`
        + (answers ? `<button class="ur-auto${sim.groups.auto[p.kind] ? ' on' : ''}" data-auto="${p.kind}" title="AUTO: they answer alerts by themselves">AUTO</button>` : '')
        + '</div>';
    });
    el.innerHTML = html;
    el.querySelectorAll<HTMLButtonElement>('button[data-who]').forEach((b) => {
      b.addEventListener('click', (ev) => { ev.stopPropagation(); const w = b.dataset.who as Who; arm(armed === w ? null : w); });
    });
    el.querySelectorAll<HTMLButtonElement>('button[data-auto]').forEach((b) => {
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const k = b.dataset.auto as UnitKind;
        const s = hooks.sim();
        s.issue({ kind: 'set-auto', who: k, on: !s.groups.auto[k] });
        built = '';
      });
    });
  };

  // ---- keys ----
  window.addEventListener('keydown', (ev) => {
    const tag = (ev.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || !hooks.renderer()) return;
    if (ev.key === 'Escape' && armed) { arm(null); ev.preventDefault(); ev.stopImmediatePropagation(); return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const present = kindsPresent();
    if (ev.key === '`') { if (present.length) { arm('all'); ev.preventDefault(); ev.stopImmediatePropagation(); } return; }
    const f = /^F([1-5])$/.exec(ev.key);
    if (f) {
      const p = present[Number(f[1]) - 1];
      if (p) { arm(p.kind); ev.preventDefault(); ev.stopImmediatePropagation(); }
    }
  }, { capture: true });
  // Right-click cancels an armed group order (before anything else reads it).
  window.addEventListener('contextmenu', (ev) => {
    if (!armed) return;
    arm(null);
    ev.preventDefault();
    ev.stopImmediatePropagation();
  }, { capture: true });

  const consumeClick = (clientX: number, clientY: number): boolean => {
    if (!armed) return false;
    const r = hooks.renderer();
    if (!r || !hooks.idle()) { arm(null); return false; }
    const w = r.toWorld(clientX, clientY);
    const sim = hooks.sim();
    const who = armed;
    armed = null;
    const target = sim.groups.targetAt(w);
    const res = sim.issue({ kind: 'group-order', who, at: w });
    if (!res.ok) { hooks.hint(String(res.err).toUpperCase()); return true; }
    const n = who === 'all' ? UNIT_KINDS.filter((k) => k.inAll).reduce((s, k) => s + k.list(sim).length, 0) : UNIT_KINDS.find((k) => k.kind === who)!.list(sim).length;
    const verb = target.kind === 'enemy' ? 'HUNT IT' : target.kind === 'outpost' ? 'GUARD THE OUTPOST' : target.kind === 'body' ? 'HOME' : 'GO';
    mark(target.at.x, target.at.y, `${n} ▸ ${verb}`);
    hooks.hint(`${n} ${who === 'all' ? 'FIGHTERS' : KIND_WORD[who]}: ${verb}${sim.groups.tunnel() ? ' (THE TUNNEL WHERE IT IS FASTER)' : ''}`);
    return true;
  };

  // ---- alerts ----
  const shownAlerts = new Map<number, HTMLDivElement>();
  const dir = (sim: Sim, at: { x: number; y: number }): string => {
    const dx = at.x - sim.core.x;
    const dy = at.y - sim.core.y;
    if (Math.hypot(dx, dy) < 60) return 'AT THE BODY';
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'TO THE EAST' : 'TO THE WEST') : dy > 0 ? 'TO THE SOUTH' : 'TO THE NORTH';
  };

  const update = (): void => {
    const sim = hooks.sim();
    const r = hooks.renderer();
    const present = kindsPresent();
    const sig = present.map((p) => `${p.kind}:${p.n}`).join(',') + '|' + present.map((p) => (sim.groups.auto[p.kind] ? 1 : 0)).join('') + (art.size ? 'a' : '');
    if (sig !== built) { built = sig; rebuild(present); }
    el.classList.toggle('hidden', present.length === 0 || !r);
    el.querySelectorAll<HTMLButtonElement>('button[data-who]').forEach((b) => b.classList.toggle('on', b.dataset.who === armed));
    // Order marks follow the board.
    const now = performance.now();
    for (let i = marks.length - 1; i >= 0; i--) {
      const m = marks[i];
      if (now > m.until || !r) { m.el.remove(); marks.splice(i, 1); continue; }
      const p = r.clientOf(sim, m.x, m.y);
      m.el.style.left = `${p.x}px`;
      m.el.style.top = `${p.y}px`;
      m.el.style.opacity = String(Math.min(1, (m.until - now) / 600));
    }
    // Toasts: the open alerts (not answered), newest first, at most three.
    const open = sim.groups.alerts.filter((a) => !a.answered).slice(-3).reverse();
    const keep = new Set(open.map((a) => a.id));
    for (const [id, t] of shownAlerts) if (!keep.has(id)) { t.remove(); shownAlerts.delete(id); }
    for (const a of open) {
      let t = shownAlerts.get(a.id);
      const who = a.who.filter((k) => UNIT_KINDS.find((x) => x.kind === k)!.list(sim).length > 0);
      const label = `${ALERT_TEXT[a.kind]} ${dir(sim, a.at)}`;
      if (!t) {
        t = document.createElement('div');
        t.className = `unit-alert unit-alert-${a.kind}`;
        t.innerHTML = `<span class="ua-text"></span><button class="ua-send">SEND</button><button class="ua-x" title="Dismiss">✕</button>`;
        t.querySelector('.ua-send')!.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const res = hooks.sim().issue({ kind: 'answer-alert', alertId: a.id });
          hooks.hint(res.ok ? `SENT: ${a.who.filter((k) => UNIT_KINDS.find((x) => x.kind === k)!.list(hooks.sim()).length).map((k) => KIND_WORD[k]).join(' + ')}` : String(res.err).toUpperCase());
        });
        t.querySelector('.ua-x')!.addEventListener('click', (ev) => { ev.stopPropagation(); a.answered = true; });
        toasts.appendChild(t);
        shownAlerts.set(a.id, t);
      }
      (t.querySelector('.ua-text') as HTMLElement).textContent = label;
      const send = t.querySelector('.ua-send') as HTMLButtonElement;
      send.disabled = who.length === 0;
      send.textContent = who.length ? `SEND ${who.map((k) => KIND_WORD[k]).join(' + ')}` : 'NO UNITS';
    }
    toasts.classList.toggle('hidden', open.length === 0 || !r);
  };

  return {
    consumeClick,
    update,
    clear: () => { armed = null; },
    get armed() { return armed; },
  };
}
