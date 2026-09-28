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
import { strainLabel } from './strain';
import type { OrganId, TowerFamily } from '../sim/types';

const COLOR: Record<OrganId, string> = {
  forge: '#d8cfb0', venom: '#6aa84f', gut: '#b5654a', nerve: '#e0c040', lattice: '#8fc7c0',
  womb: '#c07aa0', marrow: '#efe6d2', resonance: '#9a88e8', heart: '#b8352a', brain: '#c9a2b8',
  gland: '#4fa9a4', root: '#8f4a3d',
  bladder: '#a8c878', pacemaker: '#e89a6a', budder: '#c8e0a0', cyst: '#98b060', swell: '#b8d890', catapult: '#d0b070',
  mire: '#7a9a70', acid: '#c8d040', runner: '#a0c070',
};
const GLYPH: Record<OrganId, string> = {
  forge: '⚒', venom: '☣', gut: '∞', nerve: 'ϟ', lattice: '▦', womb: '◉', marrow: '⊞', resonance: '◎',
  heart: '♥', brain: '✺', gland: '◆', root: '⟟',
  bladder: '✿', pacemaker: '♪', budder: '❀', cyst: '•', swell: '◍', catapult: '➶',
  mire: '≋', acid: '☠', runner: '⇶',
};
const VERB: Partial<Record<TowerFamily, string>> = {
  spitter: 'tempo', impaler: 'armor-pierce', blighter: 'poison', maw: 'richer meat', frond: 'arcs',
  tangler: 'slow', brood: 'regrowth', spine: 'hp + caltrops', prism: 'focus ramp',
};
const famName = (f: TowerFamily) => TOWERS.find((t) => t.family === f)?.name ?? f;

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

  constructor(private getSim: () => Sim, private onClose: () => void) {
    document.getElementById('under-done')!.addEventListener('click', () => this.hide());
    this.palette.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-organ]');
      if (!b || b.classList.contains('built')) return;
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
    this.el.classList.remove('hidden');
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

  private render(): void {
    const sim = this.getSim();
    const u = sim.under;
    const key = [
      this.selected, this.rot, Math.floor(sim.meat.war), Math.floor(sim.meat.science), sim.coreLevel,
      sim.organs.map((o) => `${o.cell}${o.organ}${o.rot}${o.level}`).join(','),
    ].join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;

    const section = (title: string, ids: OrganId[]) => `<div class="pal-title">${title}</div><div class="pal-row">${ids.map((id) => {
      const d = ORGAN_BY_ID[id];
      const built = d.kind === 'theme' && sim.organs.some((o) => o.organ === id);
      const afford = sim.canAfford(d.cost);
      const lvl = built ? sim.organs.find((o) => o.organ === id)!.level : 0;
      const what = d.kind === 'theme' && d.unlocks ? d.unlocks.map(famName).join(', ') : d.blurb;
      return `<button class="under-organ${this.selected === id ? ' on' : ''}${afford ? '' : ' poor'}${built ? ' built' : ''}" data-organ="${id}" title="${d.blurb}">
        <b><span class="og" style="color:${COLOR[id]}">${GLYPH[id]}</span> ${d.name}</b>
        ${this.shapeSvg(id)}
        <span>${what}</span>
        <i>${built ? `GROWN · LV ${lvl} — click it to level` : this.priceText(d.cost)}${d.signature ? ` · shares ${VERB[d.signature] ?? d.signature}` : ''}</i>
      </button>`;
    }).join('')}</div>`;
    this.palette.innerHTML = section('THEMES — unlock limbs, power them by level', ORGAN_DEFS.filter((d) => d.kind === 'theme').map((d) => d.id))
      + section('ZONES & TISSUE', ORGAN_DEFS.filter((d) => d.kind === 'zone' || d.kind === 'root').map((d) => d.id))
      + section('CREEP — organs that make FREE creep nodes', ORGAN_DEFS.filter((d) => d.kind === 'creep').map((d) => d.id));

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
      } else if (c.kind === 'deposit' && c.deposit && !organ) {
        const d = DEPOSITS[c.deposit];
        inner = `<span class="glyph">${d.glyph}</span><span class="tag">${d.name}</span>`;
        cls += ` d-${c.deposit}`;
      } else if (c.kind === 'meteor' && i === u.cells.findIndex((x) => x.kind === 'meteor')) {
        inner = `<span class="tag core">METEOR CORE · LV ${sim.coreLevel}</span>`;
      }
      if (organ) {
        cls += ' has-organ';
        style = `background:${COLOR[organ.organ]};`;
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
          inner = `<span class="organ">${GLYPH[organ.organ]}</span>${lv}`;
        }
      }
      cells.push(`<div class="${cls}" style="${style}" data-cell="${i}">${inner}</div>`);
    }
    this.grid.style.gridTemplateColumns = `repeat(${u.w}, 1fr)`;
    this.grid.innerHTML = cells.join('');
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
        + `${shared ? ` · ${shared}` : ''}${e.draw > 1.01 ? ` · drawn ×${e.draw.toFixed(1)}` : ''}</div>`);
    }
    const bl = sim.organs.filter((o) => o.organ === 'bladder');
    if (bl.length || sim.creepNodes > 0 || sim.organs.some((o) => ORGAN_BY_ID[o.organ].kind === 'creep')) {
      const recipes = bl.map((o) => { const r = sim.bladderRate(o); return `${r.per} ${strainLabel(sim.bladderStrain(o))} per ${Math.round(r.interval)}s`; });
      rows.push(`<div><b>CREEP NODES</b> → ${sim.creepNodes} in stock${recipes.length ? ` · bladders: ${recipes.join('; ')}` : ' · no bladder yet'}</div>`);
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
      if (organ) { this.status.textContent = `${organSpec(organ.organ).name}: ${ORGAN_BY_ID[organ.organ].blurb}`; return; }
      if (c.kind === 'feature' && c.feature) {
        const f = FEATURES[c.feature];
        this.status.textContent = `${f.name}: fixed. Organs touching it are +${FEATURE_LEVEL} level, a ${organSpec(f.favors).name} +${FEATURE_FAVORED_LEVEL}.`;
        return;
      }
      if (c.kind === 'deposit' && c.deposit) { this.status.textContent = this.depositText(c.deposit, c.pips?.map((p) => p.family)); return; }
      if (c.kind === 'rock') { this.status.textContent = 'Bedrock: nothing grows here.'; return; }
      this.status.textContent = 'Open ground.';
      return;
    }
    const g = this.ghostCells();
    const sel = this.selected;
    const d = ORGAN_BY_ID[sel];
    if (!g) { this.status.textContent = `${d.name} does not fit here (off the board) — right-click to rotate`; return; }
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
    for (const dep of deps) parts.push(`covers ${this.depositText(dep.deposit!, dep.pips?.map((p) => p.family))}`);
    this.status.textContent = `GROW ${d.name.toUpperCase()} HERE (${this.priceText(d.cost)}): ${parts.join(' · ')}`;
  }

  private depositText(kind: keyof typeof DEPOSITS, pips?: string[]): string {
    const d = DEPOSITS[kind];
    const now = [
      d.now.war ? `+${d.now.war} war` : '', d.now.science ? `+${d.now.science} science` : '',
      d.now.royal ? `+${d.now.royal} royal point` : '', d.now.biomass ? `+${d.now.biomass} mass` : '',
      pips?.length ? `banks ${pips.map((f) => famName(f as TowerFamily)).join(' + ')} for your next limb` : '',
    ].filter(Boolean).join(', ');
    return `${d.name.toUpperCase()}: ${now}`;
  }
}

