/**
 * THE ORGAN STAGE (Collins, Sep 28 2026 — a town stage like BALL x PIT's):
 * between waves you grow shaped organs around the half-buried meteor. Theme
 * organs unlock limbs into your draw and power them by level; zone organs
 * boost whatever touches their zone; roots connect and carry adjacency.
 *
 * House rule (no armed-mode toggles on the board): pick an organ in the
 * palette, HOVER the board for a ghost footprint and the consequence preview,
 * RIGHT-CLICK to rotate, CLICK to grow. Click a grown theme organ (or the
 * meteor) to level it — hover shows the price and what the level gives.
 */
import { organSpec, type Sim } from '../sim/sim';
import { neighbours4 } from '../sim/underground';
import {
  DEPOSITS, FEATURES, FEATURE_FAVORED_LEVEL, FEATURE_LEVEL, METEOR_THEME, ORGAN_BY_ID, ORGAN_DEFS,
  ORGAN_LEVEL_POTENCY,
} from '../../content/underground';
import { TOWERS } from '../../content/data';
import { strainIcons, strainLabel } from './strain';
import { artUrl, loadManifest } from '../render/art';
import { coreStageOf } from '../render/coreStage';
import type { OrganId, TowerFamily } from '../sim/types';

const COLOR: Record<OrganId, string> = {
  forge: '#d8cfb0', venom: '#6aa84f', gut: '#b5654a', nerve: '#e0c040', lattice: '#8fc7c0',
  womb: '#c07aa0', marrow: '#efe6d2', resonance: '#9a88e8', heart: '#b8352a', brain: '#c9a2b8',
  gland: '#4fa9a4', root: '#8f4a3d', atrophy: '#5a4a48',
  bladder: '#a8c878', pacemaker: '#e89a6a', budder: '#c8e0a0', cyst: '#98b060', swell: '#b8d890', catapult: '#d0b070',
  mire: '#7a9a70', acid: '#c8d040', runner: '#a0c070',
  scaffold: '#e6dcc0',
  seeder: '#e8a0a0',
};
const GLYPH: Record<OrganId, string> = {
  forge: '⚒', venom: '☣', gut: '∞', nerve: 'ϟ', lattice: '▦', womb: '◉', marrow: '⊞', resonance: '◎',
  heart: '♥', brain: '✺', gland: '◆', root: '⟟', atrophy: '⊘',
  bladder: '✿', pacemaker: '♪', budder: '❀', cyst: '•', swell: '◍', catapult: '➶',
  mire: '≋', acid: '☠', runner: '⇶',
  scaffold: '▲',
  seeder: '⇡',
};
const VERB: Partial<Record<TowerFamily, string>> = {
  spitter: 'tempo', impaler: 'armor-pierce', blighter: 'poison', maw: 'richer meat', frond: 'arcs',
  tangler: 'slow', brood: 'regrowth', spine: 'hp + caltrops', prism: 'focus ramp',
};
const famName = (f: TowerFamily) => TOWERS.find((t) => t.family === f)?.name ?? f;

/**
 * THE SCAN (Collins, Sep 29 2026, of the scanner concept: "go with the scanner board design,
 * it looks AWESOME and could be grown up with like a blink or scan"). The stage is the ship's
 * ground-penetrating scan: black, faint strata, organs glowing in false colour. The tiles are
 * made by tools/art/templates/under.mjs; without them the stage keeps its old look.
 * GLOW: the false colour an organ's outline and light take (the colour of its tile).
 */
const GLOW: Record<string, string> = {
  forge: '#f0dcb0', venom: '#c8f040', gut: '#e0404a', nerve: '#9cc8ff', lattice: '#60e0d8',
  womb: '#ff80b0', marrow: '#ffa030', resonance: '#b078ff', heart: '#ff4040', brain: '#e0a8d8',
  gland: '#40e0c0', root: '#d05050', atrophy: '#9a8a80',
  bladder: '#a8f060', pacemaker: '#ff8030', budder: '#b8f080', cyst: '#c0d040', swell: '#b8f090', catapult: '#e8c080',
  mire: '#70b050', acid: '#f0e040', runner: '#80e050',
  scaffold: '#f0e8d0', seeder: '#ff6a50',
};
interface ScanArt {
  tile: number; tiles: Record<string, string>; meteor: string | null;
  /** The city above, per tile set (tools/art/templates/under.mjs SKYLINES), and the meteor above the street line. */
  skylines: Record<string, string>; dome: string | null;
  /**
   * The meteor as ONE picture per stage of the core (tools/art/templates/core-evo.mjs, bakeCoreScan):
   * what is above its ground line stands over the street, what is below fills the meteor's cells.
   * line: the share of its height above the line; aspect: its width over its height.
   */
  stages: Array<{ id?: number; file: string; line: number; aspect: number }>;
  /**
   * THE STAGE ALIVE (Collins, Sep 30 2026: "should the organ screen have them alive? ... yeah"): one
   * looping clip per organ tile, deposit, feature and core stage (tools/art/templates/under-loops.mjs),
   * baked to a horizontal strip of frames and played as a CSS sprite animation (no <video> per cell).
   */
  loops: { fps: number; tiles: Record<string, ScanLoop>; stages: Record<string, ScanLoop> } | null;
}
interface ScanLoop { strip: string; count: number; pingpong?: boolean }

/**
 * The inline style that plays a loop strip: its frames in steps, in phase with `anchor` (a
 * performance.now() time at which it shows its first frame), so a cell drawn again carries on
 * where it was, and the dome and the meteor's cells (both anchored at 0) show the same frame.
 */
function loopStyle(l: ScanLoop, fps: number, anchor: number): string {
  const dur = (l.count / fps) * 1000;
  const period = l.pingpong ? 2 * dur : dur;
  const t = (((performance.now() - anchor) % period) + period) % period;
  return `background-image:url('${l.strip}');--n:${l.count};--ud:${Math.round(dur)}ms;--uw:${-Math.round(t)}ms;--udir:${l.pingpong ? 'alternate' : 'normal'};`;
}
/** A steady phase per organ or cell, so the organs do not all breathe together. */
const phaseOf = (k: number) => -(((k * 2654435761) >>> 0) % 100000);

/** The tile set the board is drawn with, as the game says (empty on the old board). */
function boardBiome(): string {
  const api = (window as unknown as { broodfall?: { biome?: () => string } }).broodfall;
  try { return api?.biome?.() ?? ''; } catch { return ''; }
}
/** How long an organ takes to scan in when it grows, and a deposit when it resolves, in ms. */
const SCAN_IN = 700;

/** The skyline of the city above, as a thin wireframe: blocks of a few heights, the same every time. */
function skylineSvg(): string {
  let x = 0;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const parts: string[] = [];
  while (x < 1000) {
    const w = 30 + rnd() * 70;
    // The meteor's dome stands where the middle three columns are: no buildings over it.
    if (x + w > 370 && x < 630) { x = 630; continue; }
    const h = 10 + rnd() * 34;
    parts.push(`<rect x="${x.toFixed(1)}" y="${(50 - h).toFixed(1)}" width="${(w - 4).toFixed(1)}" height="${h.toFixed(1)}"/>`);
    for (let k = 1; k < 4; k++) if (rnd() < 0.6) parts.push(`<line x1="${x.toFixed(1)}" y1="${(50 - h * k / 4).toFixed(1)}" x2="${(x + w - 4).toFixed(1)}" y2="${(50 - h * k / 4).toFixed(1)}"/>`);
    x += w;
  }
  return `<svg class="skyline" viewBox="0 0 1000 50" preserveAspectRatio="none">${parts.join('')}</svg>`;
}

export class UndergroundScreen {
  open = false;
  selected: OrganId | null = null;
  private rot = 0;
  private el = document.getElementById('under')!;
  private grid = document.getElementById('under-grid')!;
  private palette = document.getElementById('under-palette')!;
  private status = document.getElementById('under-status')!;
  private summary = document.getElementById('under-summary')!;
  private hoverCell: number | null = null;
  private lastKey = '';
  /** The scan's pictures (absolute URLs), once loaded; null keeps the old look. */
  private scan: ScanArt | null = null;
  /** When each organ was first seen, and each deposit first resolved: what is still scanning in. */
  private bornAt = new Map<number, number>();
  private revealedAt = new Map<number, number>();
  /** Organs and deposits that were there when the stage opened do not scan in again. */
  private settled = false;

  /** Mission 1: no word of the ship (a locked organ is only locked). */
  plain = false;

  constructor(private getSim: () => Sim, private onClose: () => void) {
    // The scan wraps the board: a depth ruler down its left and a scan line sweeping down it.
    const box = document.createElement('div');
    box.id = 'under-scanbox';
    this.grid.parentElement!.insertBefore(box, this.grid);
    box.innerHTML = '<div id="under-ruler"></div><div class="scanline"></div>';
    box.appendChild(this.grid);
    void loadManifest().then((m) => {
      const under = (m as unknown as { under?: { scan?: ScanArt; core?: { stages?: ScanArt['stages'] }; loops?: NonNullable<ScanArt['loops']> } } | null)?.under;
      const art = under?.scan;
      if (!art || !Object.keys(art.tiles).length) return;
      const abs = (f: string) => new URL(artUrl(f), document.baseURI).href;
      this.scan = {
        tile: art.tile,
        tiles: Object.fromEntries(Object.entries(art.tiles).map(([k, f]) => [k, abs(f)])),
        meteor: art.meteor ? abs(art.meteor) : null,
        skylines: Object.fromEntries(Object.entries(art.skylines ?? {}).map(([k, f]) => [k, abs(f)])),
        dome: art.dome ? abs(art.dome) : null,
        stages: (under?.core?.stages ?? []).map((s) => ({ ...s, file: abs(s.file) })),
        loops: under?.loops ? {
          fps: under.loops.fps,
          tiles: Object.fromEntries(Object.entries(under.loops.tiles ?? {}).map(([k, l]) => [k, { ...l, strip: abs(l.strip) }])),
          stages: Object.fromEntries(Object.entries(under.loops.stages ?? {}).map(([k, l]) => [k, { ...l, strip: abs(l.strip) }])),
        } : null,
      };
      this.el.classList.add('scan');
      // The city above: the board's own kind of place when there is a picture of it, else a plain wireframe.
      document.getElementById('under-surface')!.insertAdjacentHTML('afterbegin', `${skylineSvg()}<div class="skyline-img"></div>`);
      const dome = document.getElementById('under-dome')!;
      if (this.scan.dome && !this.scan.stages.length) {
        dome.classList.add('art');
        dome.style.backgroundImage = `url('${this.scan.dome}')`;
      }
      this.paintAbove();
      const rows = this.getSim().under.h;
      document.getElementById('under-ruler')!.innerHTML = Array.from({ length: rows * 2 + 1 }, (_, i) =>
        `<i style="top:${(i / (rows * 2)) * 100}%" class="${i % 2 ? '' : 'major'}"></i>`).join('');
      this.lastKey = '';
      if (this.open) this.render();
    });
    document.getElementById('under-done')!.addEventListener('click', () => this.hide());
    this.palette.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-organ]');
      if (!b || b.classList.contains('built') || b.classList.contains('locked')) return;
      const id = b.dataset.organ as OrganId;
      this.selected = this.selected === id ? null : id;
      this.rot = 0;
      this.lastKey = '';
      this.render();
    });
    this.grid.addEventListener('click', (ev) => {
      const c = (ev.target as HTMLElement).closest<HTMLElement>('[data-cell]');
      if (c) this.clickCell(Number(c.dataset.cell));
    });
    this.grid.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      if (this.selected) { this.rot = (this.rot + 1) % 4; this.paintGhost(); this.updateStatus(); }
    });
    this.grid.addEventListener('mousemove', (ev) => {
      const c = (ev.target as HTMLElement).closest<HTMLElement>('[data-cell]');
      const cell = c ? Number(c.dataset.cell) : null;
      if (cell !== this.hoverCell) {
        this.hoverCell = cell;
        this.status.classList.remove('warn');
        this.paintGhost();
        this.updateStatus();
      }
    });
    this.grid.addEventListener('mouseleave', () => {
      this.hoverCell = null;
      this.paintGhost();
      this.updateStatus();
    });
    window.addEventListener('keydown', (ev) => {
      if (!this.open) return;
      if (ev.key === 'Escape') { this.selected = null; this.lastKey = ''; this.render(); }
      if (ev.key === 'r' || ev.key === 'R') { this.rot = (this.rot + 1) % 4; this.paintGhost(); this.updateStatus(); }
    });
  }

  show(): void {
    this.open = true;
    this.lastKey = '';
    this.settled = false;
    this.el.classList.remove('hidden');
    // The scan boots: one sweep down the whole board as the stage opens.
    this.el.classList.remove('booting');
    void this.el.offsetWidth;
    this.el.classList.add('booting');
    window.setTimeout(() => this.el.classList.remove('booting'), 1100);
    // The dome's loop restarted when the stage was hidden: set it in phase again.
    const dome = document.getElementById('under-dome');
    if (dome) delete dome.dataset.file;
    this.render();
  }

  hide(): void {
    this.open = false;
    this.selected = null;
    this.el.classList.add('hidden');
    this.onClose();
  }

  update(): void {
    if (this.open) this.render();
  }

  private priceText(c: { war?: number; science?: number }): string {
    return [c.war ? `${c.war}W` : '', c.science ? `${c.science}S` : ''].filter(Boolean).join(' ');
  }

  private clickCell(cell: number): void {
    const sim = this.getSim();
    const organ = sim.organAt(cell);
    const onMeteor = sim.under.cells[cell].kind === 'meteor';
    if (!this.selected && (onMeteor || (organ && ORGAN_BY_ID[organ.organ].kind === 'theme'))) {
      const r = sim.issue({ kind: 'upgrade-organ', organInstanceId: onMeteor ? -1 : organ!.id });
      if (!r.ok) this.flash(r.err === 'cannot afford' ? 'not enough meat to level it' : String(r.err));
    } else if (this.selected) {
      const r = sim.issue({ kind: 'build-organ', organ: this.selected, cell, rot: this.rot });
      if (r.ok) {
        if (ORGAN_BY_ID[this.selected].kind === 'theme') this.selected = null;
      } else {
        this.flash(r.err === 'cannot afford' ? `not enough meat for the ${organSpec(this.selected).name}` : String(r.err));
      }
    }
    this.lastKey = '';
    this.render();
  }

  private flash(text: string): void {
    this.status.textContent = text.toUpperCase();
    this.status.classList.add('warn');
    window.setTimeout(() => { this.status.classList.remove('warn'); this.updateStatus(); }, 1400);
  }

  /** A tiny picture of an organ's shape for its palette button. */
  private shapeSvg(id: OrganId): string {
    const shape = ORGAN_BY_ID[id].shape;
    const w = Math.max(...shape.map((p) => p[0])) + 1;
    const h = Math.max(...shape.map((p) => p[1])) + 1;
    const cells = shape.map(([x, y]) => `<rect x="${x * 7}" y="${y * 7}" width="6" height="6" fill="${COLOR[id]}" stroke="#26200f" stroke-width="0.6"/>`).join('');
    return `<svg class="shape" width="${w * 7}" height="${h * 7}" viewBox="0 0 ${w * 7} ${h * 7}">${cells}</svg>`;
  }

  /** The meteor's picture for the core's stage now, when there are stage pictures. */
  private stageArt(): ScanArt['stages'][number] | null {
    const stages = this.scan?.stages ?? [];
    if (!stages.length) return null;
    return stages[Math.min(stages.length, coreStageOf(this.getSim().stats.limbsGrown)) - 1];
  }

  /**
   * The meteor above the street line: the top of the SAME picture the cells below the line show
   * the bottom of (Collins, Sep 30 2026: it was "rendered twice, one above ground, one under").
   * As wide as the meteor's three columns; as tall as the picture is above its ground line.
   */
  private paintDome(): void {
    const art = this.stageArt();
    const dome = document.getElementById('under-dome');
    if (!art || !dome || dome.dataset.file === art.file) return;
    dome.dataset.file = art.file;
    dome.classList.add('art', 'staged');
    dome.style.backgroundImage = `url('${art.file}')`;
    dome.style.aspectRatio = String(art.aspect / art.line);
    // Alive: the same strip the meteor's cells play, in the same phase (both anchored at 0).
    const loop = this.stageLoop(art);
    dome.classList.toggle('alive', !!loop);
    for (const k of ['--n', '--ud', '--uw', '--udir']) dome.style.removeProperty(k);
    if (loop) dome.style.cssText += loopStyle(loop, this.scan!.loops!.fps, 0);
  }

  /** The loop strip of a core stage's picture, when there is one. */
  private stageLoop(art: ScanArt['stages'][number]): ScanLoop | null {
    return art.id != null ? this.scan?.loops?.stages[String(art.id)] ?? null : null;
  }

  /** The skyline of the board's tile set along the street line. */
  private paintAbove(): void {
    if (!this.scan) return;
    this.paintDome();
    const surface = document.getElementById('under-surface');
    const img = surface?.querySelector<HTMLElement>('.skyline-img');
    if (!surface || !img) return;
    const set = boardBiome();
    const url = this.scan.skylines[set] ?? this.scan.skylines.orthodox ?? null;
    if (img.dataset.set === set && img.dataset.url === (url ?? '')) return;
    img.dataset.set = set;
    img.dataset.url = url ?? '';
    img.style.backgroundImage = url ? `url('${url}')` : '';
    surface.classList.toggle('has-skyline', !!url);
  }

  private render(): void {
    this.paintAbove();
    const sim = this.getSim();
    const u = sim.under;
    const key = [
      this.selected, this.rot, Math.floor(sim.meat.war), Math.floor(sim.meat.science), sim.coreLevel, coreStageOf(sim.stats.limbsGrown),
      sim.organs.map((o) => `${o.cell}${o.organ}${o.rot}${o.level}`).join(','),
    ].join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;

    const section = (title: string, ids: OrganId[]) => `<div class="pal-title">${title}</div><div class="pal-row">${ids.map((id) => {
      const d = ORGAN_BY_ID[id];
      const built = d.kind === 'theme' && sim.organs.some((o) => o.organ === id);
      const afford = sim.canAfford(d.cost);
      const locked = !!sim.cfg.organPool && !sim.cfg.organPool.includes(id) && !(sim.cfg.startOrgans ?? []).includes(id);
      const lvl = built ? sim.organs.find((o) => o.organ === id)!.level : 0;
      const what = d.kind === 'theme' && d.unlocks ? d.unlocks.map(famName).join(', ') : d.blurb;
      return `<button class="under-organ${this.selected === id ? ' on' : ''}${afford ? '' : ' poor'}${built ? ' built' : ''}${locked ? ' locked' : ''}" data-organ="${id}" title="${d.blurb}">
        <b><span class="og" style="color:${COLOR[id]}">${GLYPH[id]}</span> ${d.name}</b>
        ${this.shapeSvg(id)}${this.scan?.tiles[id] ? `<img class="pal-tile" alt="" src="${this.scan.tiles[id]}" style="--acc:${GLOW[id] ?? COLOR[id]}">` : ""}
        <span>${what}</span>
        <i>${locked ? (this.plain ? 'LOCKED' : 'LOCKED — get it in the Gene Bay on the ship') : built ? `GROWN · LV ${lvl} — click it to level` : this.priceText(d.cost)}${d.signature ? ` · shares ${VERB[d.signature] ?? d.signature}` : ''}</i>
      </button>`;
    }).join('')}</div>`;
    this.palette.innerHTML = section('THEMES — unlock limbs, power them by level', ORGAN_DEFS.filter((d) => d.kind === 'theme').map((d) => d.id))
      + section('ZONES & TISSUE', ORGAN_DEFS.filter((d) => d.kind === 'zone' || d.kind === 'root').map((d) => d.id))
      + section('CREEP — organs that make FREE creep nodes', ORGAN_DEFS.filter((d) => d.kind === 'creep').map((d) => d.id))
      + section('SCAFFOLD — FREE plinths: raise a limb, or level a roof for a big one', ORGAN_DEFS.filter((d) => d.kind === 'scaffold').map((d) => d.id))
      + section('SEEDING — must touch the SURFACE: shoots a free Seedling limb up every 2 turns', ORGAN_DEFS.filter((d) => d.kind === 'seeder').map((d) => d.id));

    const cells: string[] = [];
    for (let i = 0; i < u.cells.length; i++) {
      const c = u.cells[i];
      const row = Math.floor(i / u.w);
      const organ = sim.organAt(i);
      let cls = `uc depth-${Math.min(3, Math.floor(row / 2))} k-${c.kind}`;
      let style = '';
      let inner = '';
      if (c.kind === 'feature' && c.feature) {
        const f = FEATURES[c.feature];
        inner = `<span class="glyph">${f.glyph}</span><span class="tag">${f.name}</span>`;
        cls += ` f-${c.feature}`;
      } else if (c.kind === 'deposit' && c.deposit && !organ && !sim.isUncovered(i)) {
        // Something is buried here — grow closer to find out what.
        inner = '<span class="glyph">?</span>';
        cls += ' d-unknown';
      } else if (c.kind === 'deposit' && c.deposit && !organ) {
        const d = DEPOSITS[c.deposit];
        inner = `<span class="glyph">${d.glyph}</span><span class="tag">${d.name}</span>`;
        cls += ` d-${c.deposit}`;
      } else if (c.kind === 'meteor' && i === u.cells.findIndex((x) => x.kind === 'meteor')) {
        inner = `<span class="tag core">METEOR CORE · LV ${sim.coreLevel}</span>`;
      }
      const scan = this.scan;
      if (scan) {
        // The ground under everything: soil darker as it goes down, the hard return of rock,
        // what is buried (or the unknown return until the body grows near), the fixed features.
        const tileOf = (): string | undefined => {
          if (c.kind === 'rock') return scan.tiles.rock;
          if (c.kind === 'feature' && c.feature) return scan.tiles[c.feature];
          if (c.kind === 'deposit' && c.deposit) return sim.isUncovered(i) ? scan.tiles[c.deposit] : scan.tiles.unknown;
          return scan.tiles[`soil-${Math.min(3, Math.floor(row / 2))}`];
        };
        const t = c.kind === 'meteor' ? undefined : tileOf();
        if (t) style = `background-image:url('${t}');`;
        // What is buried (once resolved) and the features are alive too, each in its own phase.
        const lk = c.kind === 'feature' ? c.feature : c.kind === 'deposit' && c.deposit && sim.isUncovered(i) ? c.deposit : null;
        const cellLoop = lk && !organ ? scan.loops?.tiles[lk] : undefined;
        let resolving = false;
        if (c.kind === 'deposit' && c.deposit && !organ && sim.isUncovered(i)) {
          if (!this.revealedAt.has(i)) this.revealedAt.set(i, this.settled ? performance.now() : 0);
          const age = performance.now() - this.revealedAt.get(i)!;
          if (age < SCAN_IN) { resolving = true; cls += ' scan-in'; style += `animation-delay:-${Math.round(age)}ms;`; }
        }
        if (cellLoop && !resolving) { cls += ' alive'; style = loopStyle(cellLoop, scan.loops!.fps, phaseOf(i + 7919)); }
        const staged = this.stageArt();
        if (c.kind === 'meteor' && i === u.cells.findIndex((x) => x.kind === 'meteor') && staged) {
          // The bottom of the stage's one picture: exactly the meteor's 3 by 2 cells below its ground line.
          const loop = this.stageLoop(staged);
          inner += loop
            ? `<div class="meteor-img staged alive" style="${loopStyle(loop, scan.loops!.fps, 0)}"></div>`
            : `<div class="meteor-img staged" style="background-image:url('${staged.file}')"></div>`;
        } else if (c.kind === 'meteor' && i === u.cells.findIndex((x) => x.kind === 'meteor') && scan.meteor) {
          inner += `<div class="meteor-img" style="background-image:url('${scan.meteor}')"></div>`;
        }
        // The top row lies under the street: a Seeding Gland must touch it.
        if (row === 0 && this.selected && (ORGAN_BY_ID[this.selected] as { surface?: boolean }).surface) cls += ' surface-lane';
      }
      if (organ) {
        cls += ' has-organ';
        style = `background:${COLOR[organ.organ]};`;
        if (scan) {
          const t = scan.tiles[organ.organ];
          style = `--acc:${GLOW[organ.organ] ?? COLOR[organ.organ]};${t ? `background-image:url('${t}');` : ''}`;
          if (!this.bornAt.has(organ.id)) this.bornAt.set(organ.id, this.settled ? performance.now() : 0);
          const age = performance.now() - this.bornAt.get(organ.id)!;
          // It grows in cell by cell from the top: each row a little after the one above.
          const lag = (row - Math.min(...organ.cells.map((x) => Math.floor(x / u.w)))) * 90;
          if (age < SCAN_IN + lag) { cls += ' scan-in'; style += `animation-delay:${Math.round(lag - age)}ms;`; }
          else {
            // Alive once scanned in: from its first frame (the still it scanned in as) when it has just
            // grown, else in its own phase; every cell of one organ in step.
            const loop = scan.loops?.tiles[organ.organ];
            const born = this.bornAt.get(organ.id)!;
            if (loop) { cls += ' alive'; style = `--acc:${GLOW[organ.organ] ?? COLOR[organ.organ]};${loopStyle(loop, scan.loops!.fps, born ? born + SCAN_IN : phaseOf(organ.id))}`; }
          }
          // Where two organs that share touch, the edge between them pulses.
          const shares = (n: number): boolean => {
            if (n < 0 || n >= u.cells.length) return false;
            if (u.cells[n].kind === 'meteor') return ORGAN_BY_ID[organ.organ].kind === 'theme' || organ.organ === 'root';
            const o = sim.organAt(n);
            if (!o || o === organ) return false;
            const a = ORGAN_BY_ID[organ.organ].kind, b = ORGAN_BY_ID[o.organ].kind;
            return (a === 'theme' || a === 'root') && (b === 'theme' || b === 'root')
              || (organ.organ === 'bladder' && b === 'creep') || (o.organ === 'bladder' && a === 'creep');
          };
          const w = u.w;
          const sides = [
            shares(i - w) ? 's-t' : '', shares(i + w) ? 's-b' : '',
            i % w !== 0 && shares(i - 1) ? 's-l' : '', i % w !== w - 1 && shares(i + 1) ? 's-r' : '',
          ].filter(Boolean);
          if (sides.length) inner += `<span class="share ${sides.join(' ')}"></span>`;
          // A Seeding Gland's launch tube: what it fires goes up through the street.
          if (organ.organ === ('seeder' as OrganId) && row === 0) { inner += '<span class="launch"></span>'; cls += ' has-launch'; }
        }
        // Borders only where the organ ends, so each shape reads as one body.
        const same = (n: number) => organ.cells.includes(n);
        const w = u.w;
        const edge = [
          !same(i - w) ? 'bt' : '', !same(i + w) ? 'bb' : '',
          i % w === 0 || !same(i - 1) ? 'bl' : '', i % w === w - 1 || !same(i + 1) ? 'br' : '',
        ].filter(Boolean).join(' ');
        cls += ` ${edge}`;
        if (i === organ.cells[0]) {
          const lv = ORGAN_BY_ID[organ.organ].kind === 'theme' ? `<span class="pow">LV${organ.level}</span>` : '';
          inner += `<span class="organ">${GLYPH[organ.organ]}</span>${lv}`;
        } else if (organ.organ === 'bladder' && i === organ.cells[1]) {
          // The bladder's RECIPE, in the same marks as its nodes on the map and in the tray.
          const r = sim.bladderRate(organ);
          inner += `<span class="recipe">${strainIcons(sim.bladderStrain(organ))}</span><span class="rate">${r.per}/${r.every === 1 ? 'turn' : `${r.every} turns`}${r.atWaveStart ? ` +${r.atWaveStart}@wave` : ''}</span>`;
        }
      }
      cells.push(`<div class="${cls}" style="${style}" data-cell="${i}">${inner}</div>`);
    }
    // A zone organ's zone is always faintly on the scan: a soft pulsing ring round it.
    if (this.scan) {
      const w = u.w;
      for (const o of sim.organs) {
        if (ORGAN_BY_ID[o.organ].kind !== 'zone') continue;
        for (let i = 0; i < u.cells.length; i++) {
          if (o.cells.includes(i)) continue;
          if (o.cells.some((c) => Math.max(Math.abs((c % w) - (i % w)), Math.abs(Math.floor(c / w) - Math.floor(i / w))) <= 1)) {
            cells[i] = cells[i].replace('class="uc ', `class="uc zq `).replace('style="', `style="--zc:${GLOW[o.organ]};`);
          }
        }
      }
    }
    this.settled = true;
    this.grid.style.gridTemplateColumns = `repeat(${u.w}, 1fr)`;
    this.grid.innerHTML = cells.join('');
    // Something is still scanning in: draw again when it has.
    if (this.scan && this.grid.querySelector('.scan-in')) {
      window.setTimeout(() => { this.lastKey = ''; if (this.open) this.render(); }, SCAN_IN + 600);
    }
    this.renderSummary();
    this.paintGhost();
    this.updateStatus();
  }

  /** What the organs are doing to the surface: every drawable theme, its level and shared verbs. */
  private renderSummary(): void {
    const sim = this.getSim();
    const fx = sim.organEffects();
    const rows: string[] = [];
    for (const [theme, e] of fx) {
      const name = theme === 'core' ? METEOR_THEME.name : ORGAN_BY_ID[theme].name;
      const fams = theme === 'core' ? METEOR_THEME.unlocks : ORGAN_BY_ID[theme].unlocks ?? [];
      const counts = new Map<string, number>();
      for (const p of e.pips) counts.set(p.family, (counts.get(p.family) ?? 0) + 1);
      const shared = [...counts].map(([f, n]) => `+${n > 1 ? `${n}× ` : ''}${VERB[f as TowerFamily] ?? f}`).join(', ');
      rows.push(`<div><b>${name} LV${e.level}</b> → ${fams.map(famName).join(', ')}`
        + `${e.level > 1 ? ` · +${Math.round(ORGAN_LEVEL_POTENCY * (e.level - 1) * 100)}% power` : ''}`
        + `${shared ? ` · ${shared}` : ''}${e.draw > 1.01 ? ` · drawn ×${e.draw.toFixed(1)}` : ''}${e.draw === 0 ? ' · ATROPHIED: never drawn' : ''}</div>`);
    }
    const bl = sim.organs.filter((o) => o.organ === 'bladder');
    if (bl.length || sim.creepNodes > 0 || sim.organs.some((o) => ORGAN_BY_ID[o.organ].kind === 'creep')) {
      const recipes = bl.map((o) => { const r = sim.bladderRate(o); return `${r.per} every ${r.every === 1 ? 'turn' : `${r.every} turns`}${r.atWaveStart ? ` +${r.atWaveStart} at wave start` : ''}: ${strainIcons(sim.bladderStrain(o))} (${strainLabel(sim.bladderStrain(o))})`; });
      rows.push(`<div><b>CREEP NODES</b> → ${sim.creepNodes} in stock${recipes.length ? ` · bladders: ${recipes.join('; ')}` : ' · no bladder yet'}</div>`);
    }
    const glands = sim.organs.filter((o) => o.organ === 'scaffold');
    if (glands.length || sim.plinths > 0) {
      const soonest = glands.length ? Math.min(...glands.map((o) => sim.scaffoldTurnsLeft(o))) : 0;
      rows.push(`<div><b>PLINTHS</b> → ${sim.plinths} in stock${glands.length ? ` · next in ${soonest} turn${soonest === 1 ? '' : 's'}` : ' · no scaffold gland yet'}</div>`);
    }
    const core = sim.coreStrainBonus();
    if (core.radius || core.slow < 1 || core.dps) {
      rows.push(`<div><b>CORE CREEP</b> → ${[core.radius ? `+${core.radius} cells` : '', core.slow < 1 ? `mire −${Math.round((1 - core.slow) * 100)}%` : '', core.dps ? `burn ${core.dps}/s` : ''].filter(Boolean).join(' · ')}</div>`);
    }
    this.summary.innerHTML = rows.join('');
  }

  private ghostCells(): { cells: number[]; ok: boolean } | null {
    if (!this.selected || this.hoverCell === null) return null;
    const sim = this.getSim();
    const cells = sim.organFootprint(this.selected, this.hoverCell, this.rot);
    if (!cells) return null;
    return { cells, ok: sim.canBuildOrgan(this.selected, this.hoverCell, this.rot) };
  }

  private paintGhost(): void {
    for (const el of this.grid.querySelectorAll('.ghost-ok, .ghost-bad, .hover, .zone')) el.classList.remove('ghost-ok', 'ghost-bad', 'hover', 'zone');
    const sim = this.getSim();
    const g = this.ghostCells();
    // A zone organ (being placed, or hovered) lights up the cells its zone covers.
    let zoneOf: number[] | null = null;
    if (g && this.selected && ORGAN_BY_ID[this.selected].kind === 'zone') zoneOf = g.cells;
    const hovered = this.hoverCell !== null ? sim.organAt(this.hoverCell) : undefined;
    if (!g && hovered && ORGAN_BY_ID[hovered.organ].kind === 'zone') zoneOf = hovered.cells;
    if (zoneOf) {
      const w = sim.under.w;
      for (let i = 0; i < sim.under.cells.length; i++) {
        if (zoneOf.includes(i)) continue;
        if (zoneOf.some((c) => Math.max(Math.abs((c % w) - (i % w)), Math.abs(Math.floor(c / w) - Math.floor(i / w))) <= 1)) {
          this.grid.querySelector(`[data-cell="${i}"]`)?.classList.add('zone');
        }
      }
    }
    for (const el of this.grid.querySelectorAll('.linked')) el.classList.remove('linked');
    if (!g && hovered && ORGAN_BY_ID[hovered.organ].kind === 'creep') {
      const u = sim.under;
      const touching = (a: number[], b: number[]) => a.some((c) => neighbours4(u, c).some((n) => b.includes(n)));
      const partners = sim.organs.filter((o) => o !== hovered && touching(o.cells, hovered.cells)
        && (hovered.organ === 'bladder' ? ORGAN_BY_ID[o.organ].kind === 'creep' : o.organ === 'bladder'));
      for (const o of partners) for (const c of o.cells) this.grid.querySelector(`[data-cell="${c}"]`)?.classList.add('linked');
    }
    if (g) {
      for (const c of g.cells) this.grid.querySelector(`[data-cell="${c}"]`)?.classList.add(g.ok ? 'ghost-ok' : 'ghost-bad');
    } else if (this.hoverCell !== null) {
      this.grid.querySelector(`[data-cell="${this.hoverCell}"]`)?.classList.add('hover');
    }
  }

  /** The consequence preview for what is under the pointer. */
  private updateStatus(): void {
    if (this.status.classList.contains('warn')) return;
    const sim = this.getSim();
    const u = sim.under;
    const i = this.hoverCell;
    if (i === null) {
      this.status.textContent = this.selected
        ? `${organSpec(this.selected).name}: hover the board — RIGHT-CLICK (or R) rotates — it must touch the meteor or an organ`
        : 'Pick an organ above. Click a grown theme organ (or the meteor) to LEVEL it.';
      return;
    }
    const c = u.cells[i];
    const organ = sim.organAt(i);
    if (!this.selected) {
      if (c.kind === 'meteor' || (organ && ORGAN_BY_ID[organ.organ].kind === 'theme')) {
        const cost = sim.organUpgradeCost(organ ?? null);
        const lv = organ ? organ.level : sim.coreLevel;
        const name = organ ? organSpec(organ.organ).name : METEOR_THEME.name;
        this.status.textContent = `CLICK TO LEVEL ${name.toUpperCase()} to LV${lv + 1} for ${this.priceText(cost)}: its limbs +${Math.round(ORGAN_LEVEL_POTENCY * 100)}% potency and tempo, drawn more often`;
        return;
      }
      if (organ && organ.organ === 'bladder') {
        const r = sim.bladderRate(organ);
        this.status.textContent = `SPORE BLADDER: grows ${r.per} node${r.per > 1 ? 's' : ''} every ${r.every === 1 ? 'turn' : `${r.every} turns`} (next in ${sim.bladderTurnsLeft(organ)})${r.atWaveStart ? ` (+${r.atWaveStart} when the wave starts)` : ''} — ${strainIcons(sim.bladderStrain(organ))} ${strainLabel(sim.bladderStrain(organ))} (lit: the organs shaping it)`;
        return;
      }
      if (organ) { this.status.textContent = `${organSpec(organ.organ).name}: ${ORGAN_BY_ID[organ.organ].blurb}`; return; }
      if (c.kind === 'feature' && c.feature) {
        const f = FEATURES[c.feature];
        this.status.textContent = `${f.name}: fixed. Organs touching it are +${FEATURE_LEVEL} level, a ${organSpec(f.favors).name} +${FEATURE_FAVORED_LEVEL}.`;
        return;
      }
      if (c.kind === 'deposit' && c.deposit && !sim.isUncovered(i)) { this.status.textContent = 'Something is buried here. Grow within 2 cells to find out what — the deeper, the richer.'; return; }
      if (c.kind === 'deposit' && c.deposit) { this.status.textContent = this.depositText(c.deposit, c.pips?.map((p) => p.family), c.pay); return; }
      if (c.kind === 'rock') { this.status.textContent = 'Bedrock: nothing grows here.'; return; }
      this.status.textContent = 'Open ground.';
      return;
    }
    const g = this.ghostCells();
    const sel = this.selected;
    const d = ORGAN_BY_ID[sel];
    if (!g) { this.status.textContent = `${d.name} does not fit here (off the board) — right-click to rotate`; return; }
    if (!g.ok && (d as { surface?: boolean }).surface && !g.cells.some((x) => x < u.w)) {
      this.status.textContent = `${d.name} must touch the SURFACE: one of its cells in the top row, under the street (lit) — it fires what it grows up through the street`;
      return;
    }
    if (!g.ok) {
      this.status.textContent = `${d.name} can't grow here: every cell must be open ground, and it must touch the meteor or an organ`;
      return;
    }
    // What it would do here.
    const parts: string[] = [];
    if (d.unlocks) parts.push(`unlocks ${d.unlocks.map(famName).join(', ')}`);
    const touched = new Set<string>();
    for (const cell of g.cells) {
      for (const n of neighbours4(u, cell)) {
        if (g.cells.includes(n)) continue;
        const nc = u.cells[n];
        if (nc.kind === 'meteor') touched.add(METEOR_THEME.name);
        const o = sim.organAt(n);
        if (o && ORGAN_BY_ID[o.organ].kind === 'theme') touched.add(organSpec(o.organ).name);
        if (o && o.organ === 'root') touched.add('a root (carries adjacency)');
        if (nc.kind === 'feature' && nc.feature) {
          const f = FEATURES[nc.feature];
          touched.add(`${f.name} (+${f.favors === sel ? FEATURE_FAVORED_LEVEL : FEATURE_LEVEL} level)`);
        }
      }
    }
    if (d.kind === 'theme' && touched.size) parts.push(`touches ${[...touched].join(', ')} — sharing ${VERB[d.signature!] ?? d.signature}`);
    else if (touched.size) parts.push(`touches ${[...touched].join(', ')}`);
    if (d.kind === 'zone') parts.push(d.blurb);
    if (d.kind === 'creep') {
      const bladders = new Set<number>();
      for (const cell of g.cells) for (const n of neighbours4(u, cell)) { const o = sim.organAt(n); if (o && o.organ === 'bladder') bladders.add(o.id); }
      const meteorTouch = g.cells.some((cell) => neighbours4(u, cell).some((n) => u.cells[n].kind === 'meteor'));
      const recipe = d.creep === 'pace' || d.creep === 'bud' || d.creep === 'swell' || d.creep === 'catapult' || d.creep === 'mire' || d.creep === 'acid';
      if (recipe) {
        const coreToo = meteorTouch && (d.creep === 'swell' || d.creep === 'mire' || d.creep === 'acid');
        parts.push(bladders.size || coreToo
          ? `shapes ${bladders.size ? `${bladders.size} bladder${bladders.size > 1 ? 's' : ''}` : ''}${bladders.size && coreToo ? ' and ' : ''}${coreToo ? 'the CORE creep' : ''}`
          : 'touches NO bladder — it only shapes the bladders (or meteor) it touches');
      } else parts.push(d.blurb);
    }
    const deps = g.cells.map((x) => u.cells[x]).filter((x) => x.kind === 'deposit' && x.deposit && !x.claimed);
    for (const dep of deps) parts.push(`covers ${dep === undefined ? '' : this.depositText(dep.deposit!, dep.pips?.map((p) => p.family), dep.pay)}`);
    this.status.textContent = `GROW ${d.name.toUpperCase()} HERE (${this.priceText(d.cost)}): ${parts.join(' · ')}`;
  }

  private depositText(kind: keyof typeof DEPOSITS, pips?: string[], pay?: { war?: number; science?: number; royal?: number; biomass?: number }): string {
    const d = DEPOSITS[kind];
    const p = pay ?? d.now;
    const now = [
      p.war ? `+${p.war} war` : '', p.science ? `+${p.science} science` : '',
      p.royal ? `+${p.royal} royal point${p.royal > 1 ? 's' : ''}` : '', p.biomass ? `+${p.biomass} mass` : '',
      pips?.length ? `banks ${pips.map((f) => famName(f as TowerFamily)).join(' + ')} for your next limb` : '',
    ].filter(Boolean).join(', ');
    return `${d.name.toUpperCase()}: ${now}`;
  }
}

