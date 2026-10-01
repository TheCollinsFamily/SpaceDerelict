/**
 * THE LIMB CODEX (Collins, Oct 1 2026): every limb family in one screen, in the ship's look (black
 * glass, thin white lines): its picture alive (from in front, from behind, firing, withering, and the
 * upgrade looks drawn so far), what it is for, its numbers, what it teaches a limb that eats it, the
 * organ that puts it in the draw, and its evolution tree with the upgrade-look CLASS of every option.
 *
 * Reachable from the main menu (LIMB CODEX), the ship (the ▤ button in the room bar), and a
 * deployment (the ▤ button by the view controls, the C key, and CODEX on a built limb's panel, which
 * opens it at that limb; the run is paused while it is open).
 *
 * Nothing here is written by hand: src/ui/codexData.ts reads it all from the content and the sim.
 */
import './codex.css';
import { artUrl, loadManifest, type Clip, type LimbArt, type LimbSide } from '../render/art';
import { idleFrames, phaseOf } from '../render/idleClock';
import { CLASS_INFO, LOOK_CLASSES, SUPERS, type LookClass, type SuperKey } from '../../content/upgradeLooks';
import { ROLES, ROLE_INFO, codexEntries, type CodexEntry, type Role } from './codexData';
import type { TowerFamily } from '../sim/types';

export type CodexPlace = 'menu' | 'ship' | 'run';
export interface CodexOpen { where: CodexPlace; focus?: TowerFamily; onClose?: () => void }

type View = 'front' | 'back' | 'fire' | 'die';
type SizeFilter = 'one' | 'big' | 'long';

let root: HTMLElement | null = null;
let current: CodexOpen | null = null;
let entries: CodexEntry[] = [];
let limbs: Record<string, LimbArt> | null = null;
let selected: TowerFamily = 'spitter';
let view: View = 'front';
/** The upgrade look shown in the big picture: null is the limb's own. */
let look: string | null = null;
const filter: { role: Role | null; cls: LookClass | null; size: SizeFilter | null; text: string } = { role: null, cls: null, size: null, text: '' };
let timer = 0;

export const codexOpen = (): boolean => !!current;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function openCodex(o: CodexOpen): void {
  current = o;
  if (!entries.length) entries = codexEntries();
  if (o.focus) { selected = o.focus; view = 'front'; look = null; }
  if (!root) {
    root = document.createElement('div');
    root.id = 'codex';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Limb Codex');
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    window.addEventListener('keydown', onKey, true);
  }
  root.classList.remove('hidden');
  render();
  if (!limbs) void loadManifest().then((m) => { limbs = m?.limbs ?? null; if (current) render(); });
  startTimer();
}

export function closeCodex(): void {
  if (!current || !root) return;
  const was = current;
  current = null;
  root.classList.add('hidden');
  window.clearInterval(timer);
  timer = 0;
  was.onClose?.();
}

/** The ▤ button by a deployment's view controls (beside the ⚙). */
export function addCodexRunButton(open: () => void): void {
  const box = document.getElementById('view-controls');
  if (!box || document.getElementById('view-codex')) return;
  const b = document.createElement('button');
  b.id = 'view-codex';
  b.title = 'Limb Codex (C) — every limb, what it does and how it evolves; pauses the deployment';
  b.textContent = '▤';
  b.addEventListener('click', open);
  const settings = document.getElementById('view-settings');
  box.insertBefore(b, settings);
}

function shown(): CodexEntry[] {
  const t = filter.text.trim().toLowerCase();
  return entries.filter((e) => (!filter.role || e.role === filter.role)
    && (!filter.cls || e.pipClass === filter.cls)
    && (!filter.size || e.size === filter.size)
    && (!t || `${e.name} ${e.family} ${e.desc} ${e.traits.join(' ')} ${e.unlockedBy}`.toLowerCase().includes(t)));
}

// ------------------------------------------------------------------ pictures

interface Sprite { atlas: string; frame: number; cols: number; clip: Clip }

/** The sprite the big picture shows: a view of the limb, or of one of its upgrade looks. */
function spriteOf(family: string, v: View, lk: string | null): Sprite | null {
  const a = limbs?.[family];
  if (!a) return null;
  const base = lk ? a.variants?.[lk] : a;
  if (!base) return null;
  const side: LimbSide = v === 'back' && base.back ? base.back : base;
  const clip = v === 'fire' ? side.anims.fire ?? side.anims.idle : v === 'die' ? side.anims.die ?? side.anims.idle : side.anims.idle;
  return { atlas: base.atlas, frame: base.frame, cols: base.cols, clip };
}

function spriteStyle(s: Sprite, size: number, f = s.clip.start): string {
  const url = new URL(artUrl(s.atlas), document.baseURI).href;
  // Single quotes: the style is written inside a double-quoted attribute.
  return `background-image:url('${url}');background-size:${s.cols * size}px auto;background-position:-${(f % s.cols) * size}px -${Math.floor(f / s.cols) * size}px`;
}

/** Every picture on the screen steps through its own clip on one timer, at the clip's own speed (12 a second). */
function startTimer(): void {
  if (timer) return;
  const t0 = performance.now();
  timer = window.setInterval(() => {
    if (!root || !current || document.hidden || document.documentElement.classList.contains('reduce-motion')) return;
    const t = (performance.now() - t0) / 1000;
    for (const el of root.querySelectorAll<HTMLElement>('[data-sprite]')) {
      const [family, v, lk] = el.dataset.sprite!.split('|');
      const s = spriteOf(family, v as View, lk || null);
      if (!s || s.clip.count < 2) continue;
      const size = Number(el.dataset.size);
      // Firing and withering play through and hold a beat; the idle loops as the board plays it.
      const f = v === 'fire' || v === 'die'
        ? s.clip.start + Math.min(s.clip.count - 1, Math.floor((t * s.clip.fps) % (s.clip.count + 8)))
        : idleFrames(s.clip, t, phaseOf(Number(el.dataset.k ?? 0) + 1)).a;
      if (el.dataset.fr === String(f)) continue;
      el.dataset.fr = String(f);
      el.style.backgroundPosition = `-${(f % s.cols) * size}px -${Math.floor(f / s.cols) * size}px`;
    }
  }, 1000 / 12);
}

function spriteHtml(family: string, v: View, lk: string | null, size: number, k: number, cls: string): string {
  const s = spriteOf(family, v, lk);
  if (!s) return `<div class="${cls} cx-noart" style="width:${size}px;height:${size}px">no picture</div>`;
  return `<div class="${cls}" data-sprite="${family}|${v}|${lk ?? ''}" data-size="${size}" data-k="${k}" style="width:${size}px;height:${size}px;${spriteStyle(s, size)}"></div>`;
}

// ------------------------------------------------------------------ drawing

const cost = (c: CodexEntry['cost']) => [
  c.war ? `<span class="cx-meat war"><b>${c.war}</b> war</span>` : '',
  c.science ? `<span class="cx-meat sci"><b>${c.science}</b> science</span>` : '',
].join('') || '<span class="cx-meat free"><b>free</b></span>';

const clsTag = (c: LookClass, extra = '') => `<span class="cx-cls ${c}${extra}" title="${esc(CLASS_INFO[c].says)}">${CLASS_INFO[c].name.toUpperCase()}</span>`;

function render(): void {
  if (!root || !current) return;
  const list = shown();
  if (!entries.some((e) => e.family === selected)) selected = entries[0].family;
  const count = (pred: (e: CodexEntry) => boolean) => entries.filter(pred).length;
  const chip = (group: string, val: string, label: string, on: boolean, n: number, extra = '') =>
    `<button class="cx-chip${on ? ' on' : ''}${extra}" data-f="${group}" data-v="${val}">${label}<i>${n}</i></button>`;
  root.innerHTML = `<div class="cx-card">
    <div class="cx-head">
      <div><div class="cx-kicker">SPECIMEN LOCKER — FIELD GUIDE TO THE HIVE'S LIMBS</div>
        <div class="cx-title">LIMB CODEX</div></div>
      <div class="cx-headr"><span class="cx-total">${entries.length} FAMILIES · ${count((e) => e.drawn)} IN THE DRAW</span>
        <button class="cx-close" data-act="close" title="Close (Esc)">✕</button></div>
    </div>
    <div class="cx-filters">
      <div class="cx-frow"><span class="cx-flabel">ROLE</span>${chip('role', '', 'ALL', !filter.role, entries.length)}${ROLES.map((r) => chip('role', r, ROLE_INFO[r].name.toUpperCase(), filter.role === r, count((e) => e.role === r))).join('')}</div>
      <div class="cx-frow"><span class="cx-flabel">TEACHES</span>${chip('cls', '', 'ANY', !filter.cls, entries.length)}${LOOK_CLASSES.map((c) => chip('cls', c, CLASS_INFO[c].name.toUpperCase(), filter.cls === c, count((e) => e.pipClass === c), ` c-${c}`)).join('')}
        <span class="cx-flabel gap">GROUND</span>${chip('size', '', 'ANY', !filter.size, entries.length)}${chip('size', 'one', '1 CELL', filter.size === 'one', count((e) => e.size === 'one'))}${chip('size', 'big', 'BIG 2×2', filter.size === 'big', count((e) => e.size === 'big'))}${chip('size', 'long', 'LONG 1×2', filter.size === 'long', count((e) => e.size === 'long'))}
        <input class="cx-search" placeholder="search: poison, fliers, Bone Forge…" value="${esc(filter.text)}"/></div>
    </div>
    <div class="cx-main">
      <div class="cx-grid">${list.length ? list.map((e, i) => tileHtml(e, i)).join('') : '<div class="cx-empty">No limb fits all of that.</div>'}</div>
      <div class="cx-detail">${detailHtml(entries.find((e) => e.family === selected)!)}</div>
    </div>
    <div class="cx-foot">Read live from the game's own numbers. Upgrade looks: a limb's evolutions and eaten bonuses count toward BONE, SWARM, VENOM or REACH; one class at 2 points changes its look, two at 3 make a superstructure.</div>
  </div>`;
}

function tileHtml(e: CodexEntry, i: number): string {
  const variants = Object.keys(limbs?.[e.family]?.variants ?? {}).length;
  return `<button class="cx-tile${e.family === selected ? ' on' : ''}" data-pick="${e.family}" title="${esc(e.desc)}">
    ${spriteHtml(e.family, 'front', null, 76, i, 'cx-tart')}
    <span class="cx-tname">${esc(e.name)}</span>
    <span class="cx-tmeta"><span class="cx-dot ${e.pipClass}"></span>${ROLE_INFO[e.role].name}${e.size !== 'one' ? ` · ${e.size.toUpperCase()}` : ''}${variants ? ' · <b class="cx-proto">LOOKS</b>' : ''}${e.drawn ? '' : ' · <b class="cx-gift">GIVEN</b>'}</span>
  </button>`;
}

function stat(label: string, val: string | number, hint = ''): string {
  return `<div class="cx-stat"${hint ? ` title="${esc(hint)}"` : ''}><span>${label}</span><b>${val}</b></div>`;
}

function detailHtml(e: CodexEntry): string {
  const a = limbs?.[e.family];
  const variants = Object.keys(a?.variants ?? {});
  const hasBack = !!(look ? a?.variants?.[look]?.back : a?.back);
  const views: Array<[View, string, boolean]> = [['front', 'FRONT', true], ['back', 'BEHIND', hasBack], ['fire', e.role === 'engine' ? 'ACTING' : 'FIRING', !!a?.anims.fire], ['die', 'WITHERING', !!a?.anims.die]];
  const v = views.find(([id, , ok]) => id === view && ok) ? view : 'front';
  const lookName = (k: string) => k.includes('+') ? SUPERS[k as SuperKey]?.name ?? k : CLASS_INFO[k as LookClass]?.name ?? k;
  const rate = e.rate > 0 ? `${e.rate}/s` : '—';
  const missing: string[] = [];
  if (!a) missing.push('no baked picture');
  else {
    if (!a.back) missing.push('no view from behind (it is drawn the same from every side)');
    if (a.anims.idle.breathe) missing.push('its idle barely moves (it breathes)');
    if (!a.anims.fire) missing.push('no firing clip');
  }
  return `<div class="cx-dhead">
      <div><div class="cx-dname">${esc(e.name)}</div><div class="cx-dsub">${ROLE_INFO[e.role].name.toUpperCase()} · ${esc(e.layer)}${e.size !== 'one' ? ` · ${e.size === 'big' ? 'BIG, 2×2 roof' : 'LONG, 1×2, turned to fit'}` : ''}${e.directional ? ' · FACES ONE WAY' : ''}</div></div>
      <div class="cx-dcost">${cost(e.cost)}</div>
    </div>
    <div class="cx-dtop">
      <div class="cx-stage">
        ${spriteHtml(e.family, v, look, 220, 0, 'cx-big')}
        <div class="cx-views">${views.filter(([, , ok]) => ok).map(([id, label]) => `<button class="cx-vb${id === v ? ' on' : ''}" data-view="${id}">${label}</button>`).join('')}</div>
        ${look ? `<div class="cx-looking">UPGRADE LOOK: ${esc(lookName(look).toUpperCase())}</div>` : ''}
      </div>
      <div class="cx-dright">
        <p class="cx-desc">${esc(e.desc)}</p>
        <div class="cx-stats">
          ${stat('HP', e.maxHp)}${stat('RANGE', e.range >= 9999 ? 'board' : e.range || '—')}${stat('DAMAGE', e.damage || '—')}${stat('RATE', rate)}
          ${stat('DPS', e.dps || (e.fires ? 'aimed' : '—'), 'damage a second on one target from its own hits, every pellet landing')}${stat('DOT', e.dot ? `${e.dot}/s` : '—', 'poison, fire, clouds or digestion a second')}
          ${stat('SPLASH', e.aoe || '—')}${stat('IN DRAW', e.drawn ? `weight ${e.weight}` : 'given')}
        </div>
        <div class="cx-traits">${e.traits.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
      </div>
    </div>
    <div class="cx-section"><h4>UPGRADE LOOKS</h4>
      <div class="cx-looks">
        <button class="cx-look${look === null ? ' on' : ''}" data-look="">${spriteHtml(e.family, 'front', null, 64, 1, 'cx-lart')}<span>OWN</span></button>
        ${variants.map((k, i) => `<button class="cx-look${look === k ? ' on' : ''}" data-look="${k}">${spriteHtml(e.family, 'front', k, 64, i + 2, 'cx-lart')}<span>${esc(lookName(k).toUpperCase())}</span></button>`).join('')}
        ${variants.length ? '' : `<div class="cx-nolooks">Not drawn yet. What its evolutions lean toward: ${LOOK_CLASSES.filter((c) => e.treeClassCount[c]).map((c) => `${clsTag(c)} ×${e.treeClassCount[c]}`).join(' ')}</div>`}
      </div></div>
    <div class="cx-cols">
      <div class="cx-section"><h4>WHEN EATEN</h4>
        <p>A limb grown from this one gets: <b>${esc(e.donor)}</b></p>
        <p class="cx-small">That bonus counts toward ${clsTag(e.pipClass)} on the eater's look.</p></div>
      <div class="cx-section"><h4>WORKS WITH</h4>
        <p>${e.drawn ? `Put in the draw by <b>${esc(e.unlockedBy)}</b>${e.unlockedBy === 'Meteor Core' ? ' (from the start)' : ''}; every level of it is +10% potency and tempo for` : esc(e.unlockedBy[0].toUpperCase() + e.unlockedBy.slice(1)) + '.'}
          ${e.drawn && e.themeMates.length ? ` it and ${e.themeMates.map((f) => `<a data-pick="${f}">${esc(entries.find((x) => x.family === f)?.name ?? f)}</a>`).join(', ')}.` : e.drawn ? ' it.' : ''}</p>
        ${e.signatureOf.length ? `<p class="cx-small">Its bonus is the signature of <b>${e.signatureOf.map(esc).join(', ')}</b>: an organ touching that one gives its own limbs this bonus too.</p>` : ''}
        <p class="cx-small">${e.role === 'engine' ? 'An engine: point it at a limb.' : `Engines: ${e.projectiles ? 'Boomerang, Twinning and Capacitor all fit' : e.fires ? 'Twinning and Capacitor fit; the Boomerang does not (no projectiles)' : 'it does not shoot, so firing engines do little for it'}; Conduit, Mosaic, Amplifier, Tap, Press and Reliquary work on any limb.`}</p></div>
    </div>
    <div class="cx-section"><h4>EVOLUTION · THREE STAGES, ONE OF TWO AT EACH</h4>
      <div class="cx-tree">${e.tree.map((st) => `<div class="cx-st"><div class="cx-stn">STAGE ${st.stage}<small>${st.cost.science ?? 0} sci${st.cost.royal ? ` + ${st.cost.royal} royal` : ''}</small></div>
        ${st.options.map((o) => `<div class="cx-opt"><div class="cx-oh"><b>${st.stage}${o.choice}</b> ${esc(o.name)} ${clsTag(o.cls, ' sm')}</div><div class="cx-ot">${esc(o.text)}</div></div>`).join('')}</div>`).join('')}</div></div>
    ${missing.length ? `<div class="cx-missing">ART: ${missing.map(esc).join(' · ')}</div>` : ''}`;
}

// ------------------------------------------------------------------ input

function onClick(ev: MouseEvent): void {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-act],[data-pick],[data-f],[data-view],[data-look]');
  if (!el) {
    // A click on the dimmed board around the card closes it.
    if (ev.target === root) closeCodex();
    return;
  }
  const d = el.dataset;
  if (d.act === 'close') { closeCodex(); return; }
  if (d.pick) { selected = d.pick as TowerFamily; look = null; view = 'front'; }
  else if (d.f) {
    const v = d.v || null;
    if (d.f === 'role') filter.role = v as Role | null;
    if (d.f === 'cls') filter.cls = v as LookClass | null;
    if (d.f === 'size') filter.size = v as SizeFilter | null;
  } else if (d.view) view = d.view as View;
  else if (d.look !== undefined) look = d.look || null;
  const scroll = root?.querySelector('.cx-grid')?.scrollTop ?? 0;
  render();
  const grid = root?.querySelector('.cx-grid');
  if (grid) grid.scrollTop = scroll;
}

function onInput(ev: Event): void {
  const t = ev.target as HTMLInputElement;
  if (!t.classList.contains('cx-search')) return;
  filter.text = t.value;
  const at = t.selectionStart ?? t.value.length;
  render();
  const again = root?.querySelector<HTMLInputElement>('.cx-search');
  if (again) { again.focus(); again.setSelectionRange(at, at); }
}

function onKey(ev: KeyboardEvent): void {
  if (!current) return;
  if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeCodex(); return; }
  if ((ev.target as HTMLElement).tagName === 'INPUT') return;
  // Arrows walk the limbs on show; nothing else reaches the board under it.
  if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    const list = shown();
    const i = list.findIndex((e) => e.family === selected);
    const step = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : -1;
    const next = list[(Math.max(0, i) + step + list.length) % list.length];
    if (next) { selected = next.family; look = null; view = 'front'; render(); }
    ev.preventDefault();
    ev.stopPropagation();
  }
}
