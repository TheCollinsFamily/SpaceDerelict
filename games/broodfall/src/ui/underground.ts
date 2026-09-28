/**
 * THE BODY BELOW — the between-waves organ screen (Collins, Sep 28 2026:
 * "organs -> place towers -> wave ... not something on screen during a wave").
 * A side-view cross-section under the city: the meteor sits half above ground
 * (the core you defend) and half buried; organs grow down from it.
 *
 * Interaction follows the house rule (no armed-mode toggles on the board):
 * pick an organ in the palette, HOVER a cell for the consequence preview
 * (power, adjacency, what the deposit pays), CLICK to grow it. Click a grown
 * gland or root to switch its mode / turn its lobe.
 */
import { organSpec, type Sim } from '../sim/sim';
import { neighbours4 } from '../sim/underground';
import {
  DEPOSITS, FEATURES, FEATURE_FAVORED_POWER, FEATURE_POWER, ORGAN_TEXT, SAME_KIND_POWER,
} from '../../content/underground';
import type { OrganId } from '../sim/types';

const ORGANS: OrganId[] = ['heart', 'brain', 'gland', 'root'];
const ORGAN_GLYPH: Record<OrganId, string> = { heart: '♥', brain: '✺', gland: '◆', root: '⟟' };
const DIR_ARROW: Record<string, string> = { N: '▲', E: '▶', S: '▼', W: '◀' };

export class UndergroundScreen {
  open = false;
  selected: OrganId | null = 'heart';
  private el = document.getElementById('under')!;
  private grid = document.getElementById('under-grid')!;
  private palette = document.getElementById('under-palette')!;
  private status = document.getElementById('under-status')!;
  private hoverCell: number | null = null;
  private lastKey = '';

  constructor(private getSim: () => Sim, private onClose: () => void) {
    document.getElementById('under-done')!.addEventListener('click', () => this.hide());
    this.palette.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-organ]');
      if (!b) return;
      this.selected = b.dataset.organ as OrganId;
      this.lastKey = '';
      this.render();
    });
    this.grid.addEventListener('click', (ev) => {
      const c = (ev.target as HTMLElement).closest<HTMLElement>('[data-cell]');
      if (c) this.clickCell(Number(c.dataset.cell));
    });
    this.grid.addEventListener('mousemove', (ev) => {
      const c = (ev.target as HTMLElement).closest<HTMLElement>('[data-cell]');
      const cell = c ? Number(c.dataset.cell) : null;
      if (cell !== this.hoverCell) {
        this.hoverCell = cell;
        this.status.classList.remove('warn'); // a new cell deserves its own preview
        this.updateStatus();
        this.markHover();
      }
    });
    this.grid.addEventListener('mouseleave', () => {
      this.hoverCell = null;
      this.updateStatus();
      this.markHover();
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
    this.el.classList.add('hidden');
    this.onClose();
  }

  /** Re-render when anything the screen shows has changed (cheap key check). */
  update(): void {
    if (this.open) this.render();
  }

  private clickCell(cell: number): void {
    const sim = this.getSim();
    const organ = sim.organs.find((o) => o.cell === cell);
    if (organ) {
      if (organ.organ === 'gland') sim.issue({ kind: 'cycle-gland', organInstanceId: organ.id });
      if (organ.organ === 'root') sim.issue({ kind: 'cycle-root', organInstanceId: organ.id });
    } else if (this.selected) {
      const r = sim.issue({ kind: 'build-organ', organ: this.selected, cell });
      if (!r.ok) this.flash(r.err === 'cannot afford' ? `not enough meat for a ${organSpec(this.selected).name}` : String(r.err));
    }
    this.lastKey = '';
    this.render();
  }

  private flash(text: string): void {
    this.status.textContent = text.toUpperCase();
    this.status.classList.add('warn');
    window.setTimeout(() => { this.status.classList.remove('warn'); this.updateStatus(); }, 1400);
  }

  private costText(id: OrganId): string {
    const c = organSpec(id).cost;
    return (['war', 'science', 'royal'] as const).filter((k) => (c[k] ?? 0) > 0).map((k) => `${c[k]}${k[0].toUpperCase()}`).join(' ');
  }

  private render(): void {
    const sim = this.getSim();
    const u = sim.under;
    const key = [
      this.selected, Math.floor(sim.meat.war), Math.floor(sim.meat.science), Math.floor(sim.meat.royal),
      sim.organs.map((o) => `${o.cell}${o.organ}${o.glandMode}${o.rootDir ?? ''}`).join(','),
    ].join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;

    this.palette.innerHTML = ORGANS.map((id) => {
      const afford = sim.canAfford(organSpec(id).cost);
      const have = sim.organs.filter((o) => o.organ === id).length;
      return `<button class="under-organ${this.selected === id ? ' on' : ''}${afford ? '' : ' poor'}" data-organ="${id}">
        <b><span class="og og-${id}">${ORGAN_GLYPH[id]}</span> ${organSpec(id).name}</b>
        <span>${ORGAN_TEXT[id]}</span>
        <i>${this.costText(id)} · have ${have} · power ${sim.organPower(id).toFixed(1).replace('.0', '')}</i>
      </button>`;
    }).join('');

    const cells: string[] = [];
    for (let i = 0; i < u.cells.length; i++) {
      const c = u.cells[i];
      const row = Math.floor(i / u.w);
      const organ = sim.organs.find((o) => o.cell === i);
      const legal = !organ && this.selected !== null && sim.canBuildOrgan(i);
      let cls = `uc depth-${Math.min(3, Math.floor(row / 2))} k-${c.kind}`;
      let inner = '';
      if (c.kind === 'meteor') {
        inner = '';
      } else if (c.kind === 'rock') {
        inner = '';
      } else if (c.kind === 'feature' && c.feature) {
        const f = FEATURES[c.feature];
        inner = `<span class="glyph">${f.glyph}</span><span class="tag">${f.name}</span>`;
        cls += ` f-${c.feature}`;
      } else if (c.kind === 'deposit' && c.deposit && !organ) {
        const d = DEPOSITS[c.deposit];
        inner = `<span class="glyph">${d.glyph}</span><span class="tag">${d.name}</span>`;
        cls += ` d-${c.deposit}`;
      }
      if (organ) {
        const p = sim.organPowerOf(organ);
        const extra = organ.organ === 'gland' ? `<span class="mode">${organ.glandMode}</span>`
          : organ.organ === 'root' ? `<span class="mode">${DIR_ARROW[organ.rootDir ?? 'N']}</span>` : '';
        const dug = c.kind === 'deposit' && c.deposit ? `<span class="dug" title="${DEPOSITS[c.deposit].name}">${DEPOSITS[c.deposit].glyph}</span>` : '';
        inner = `<span class="organ og-${organ.organ}">${ORGAN_GLYPH[organ.organ]}</span><span class="pow">×${p.toFixed(1).replace('.0', '')}</span>${extra}${dug}`;
        cls += ' has-organ';
      }
      if (legal) cls += ' legal';
      cells.push(`<div class="${cls}" data-cell="${i}">${inner}</div>`);
    }
    // What the claimed deposits pay every cleared wave.
    let wWar = 0;
    let wSci = 0;
    for (const o of sim.organs) {
      const dc = u.cells[o.cell];
      const wage = dc.deposit ? DEPOSITS[dc.deposit].perWave : undefined;
      wWar += wage?.war ?? 0;
      wSci += wage?.science ?? 0;
    }
    document.getElementById('under-wage')!.textContent = wWar || wSci
      ? `deposits paying every wave: ${[wWar ? `+${wWar} war` : '', wSci ? `+${wSci} science` : ''].filter(Boolean).join(', ')}`
      : u.cells.some((x) => x.claimed)
        ? 'claimed deposits paid out once — seams and laboratories pay every wave'
        : 'no deposit claimed yet — the richest lie deep';
    this.grid.style.gridTemplateColumns = `repeat(${u.w}, 1fr)`;
    this.grid.innerHTML = cells.join('');
    this.markHover();
    this.updateStatus();
  }

  private markHover(): void {
    for (const el of this.grid.querySelectorAll('.hover')) el.classList.remove('hover');
    if (this.hoverCell !== null) this.grid.querySelector(`[data-cell="${this.hoverCell}"]`)?.classList.add('hover');
  }

  /** The consequence preview for the hovered cell. */
  private updateStatus(): void {
    if (this.status.classList.contains('warn')) return;
    const sim = this.getSim();
    const u = sim.under;
    const i = this.hoverCell;
    if (i === null) {
      this.status.textContent = 'Every organ must touch the meteor or an organ that does. Dig onto deposits to claim them; features power the organs touching them.';
      return;
    }
    const c = u.cells[i];
    const organ = sim.organs.find((o) => o.cell === i);
    if (organ) {
      const what = organ.organ === 'gland' ? ` · mode ${organ.glandMode.toUpperCase()} — click to switch`
        : organ.organ === 'root' ? ` · lobe grows ${organ.rootDir} from the core — click to turn` : '';
      this.status.textContent = `${organSpec(organ.organ).name}: power ${sim.organPowerOf(organ)}${what}`;
      return;
    }
    if (c.kind === 'meteor') { this.status.textContent = 'The meteor it came down in — half above ground, half buried. Everything grows from here.'; return; }
    if (c.kind === 'rock') { this.status.textContent = 'Bedrock: nothing grows here — dig around it.'; return; }
    if (c.kind === 'feature' && c.feature) {
      const f = FEATURES[c.feature];
      this.status.textContent = `${f.name}: fixed. Every organ touching it gets +${FEATURE_POWER} power, a ${organSpec(f.favors).name} +${FEATURE_FAVORED_POWER}.`;
      return;
    }
    const sel = this.selected;
    const depositText = c.kind === 'deposit' && c.deposit ? this.depositText(c.deposit, c.pips?.map((p) => p.family)) : '';
    if (!sel) { this.status.textContent = depositText || 'Soil.'; return; }
    if (!sim.canBuildOrgan(i)) {
      this.status.textContent = `${depositText ? depositText + ' · ' : ''}not connected yet — an organ must touch the meteor or another organ`;
      return;
    }
    // Power this organ would have here, and why.
    const why: string[] = [];
    for (const n of neighbours4(u, i)) {
      const nc = u.cells[n];
      if (nc.kind === 'feature' && nc.feature) {
        const f = FEATURES[nc.feature];
        why.push(`+${f.favors === sel ? FEATURE_FAVORED_POWER : FEATURE_POWER} ${f.name}`);
      }
      if (sim.organs.some((o) => o.cell === n && o.organ === sel)) why.push(`+${SAME_KIND_POWER} touching ${organSpec(sel).name}`);
    }
    const p = sim.organPowerOf({ organ: sel, cell: i });
    this.status.textContent = `GROW ${organSpec(sel).name.toUpperCase()} HERE: power ${p}${why.length ? ` (${why.join(', ')})` : ''}`
      + (depositText ? ` · DIGS INTO ${depositText}` : '');
  }

  private depositText(kind: keyof typeof DEPOSITS, pips?: string[]): string {
    const d = DEPOSITS[kind];
    const now = [
      d.now.war ? `+${d.now.war} war` : '', d.now.science ? `+${d.now.science} science` : '',
      d.now.royal ? `+${d.now.royal} royal point` : '', d.now.biomass ? `+${d.now.biomass} mass` : '',
      pips?.length ? `banks ${pips.join(' + ')} for your next limb` : '',
    ].filter(Boolean).join(', ');
    const wave = d.perWave ? [d.perWave.war ? `+${d.perWave.war} war` : '', d.perWave.science ? `+${d.perWave.science} science` : ''].filter(Boolean).join(', ') : '';
    return `${d.name.toUpperCase()}: ${now}${wave ? `, then ${wave} every wave` : ''}`;
  }
}
