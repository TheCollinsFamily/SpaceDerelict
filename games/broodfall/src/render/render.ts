/**
 * Broodfall renderer: PixiJS, procedural placeholder art drawn per-frame.
 * Every entity's look comes from one function per family/kind, so swapping in
 * baked spritesheets later is a per-function change, not a rewrite.
 */
import { Application, Container, Graphics } from 'pixi.js';
import { CellType } from '../sim/citymap';
import { Sim, towerSpec, towerStats } from '../sim/sim';
import type { Enemy, RootDir, Tower, TowerFamily } from '../sim/types';
import { Civilians, type Civilian } from '../sim/civilians';

export const CASTE_COLORS = { war: 0xd1603c, science: 0x4fa9a4, royal: 0xd4a72c } as const;

export const FAMILY_COLORS: Record<TowerFamily, number> = {
  spitter: 0xc98f6a,
  burster: 0xb35633,
  lasher: 0x9c4f6d,
  maw: 0x8f2f3d,
  spine: 0x8a7f65,
  lure: 0x5fa898,
  tangler: 0x6f9c4a,
  blighter: 0x8fa833,
  impaler: 0xc9c2a4,
  choir: 0xa87fc9,
  sling: 0xb0685a,
  brood: 0xc75a68,
  hatch: 0xb0485a,
  swamp: 0x6b4a2c,
  frond: 0x7fc4d8,
  lobber: 0x9c8f3a,
  mister: 0xb8d84f,
  ocular: 0xe0d0b0,
  prism: 0x8fd8f0,
  bombard: 0x8a6a48,
  ward: 0x9ab8e8,
  quill: 0xb89868,
  skipper: 0x7a6040,
  lance: 0x9ab860,
  cage: 0x6a6a78,
  sprout: 0xc98a86,
  net: 0x88c8e0,
  ember: 0xd86a30,
  conduit: 0xc8a060,
  amp: 0xe070b0,
  mosaic: 0x60c0a8,
  twin: 0x9088e8,
  tap: 0x8a5a78,
  mitosis: 0x78b060,
  capacitor: 0x60a0d8,
  boomerang: 0xd8a040,
  press: 0x9a6a50,
  reliquary: 0xc8c0a0,
};

/** Link colour per combo-engine kind (sources in, arrow out). */
const ENGINE_COLOR: Record<string, number> = {
  funnel: 0xffd060, amplify: 0xff80c8, mosaic: 0x70e8c8, twin: 0xa8a0ff, tap: 0xc070a0,
  mitosis: 0x98e070, capacitor: 0x80c8ff, boomerang: 0xffc050, press: 0x4fd0c8, reliquary: 0xf0e8c8,
};

/** A small glyph per engine so they read apart at a glance. */
const ENGINE_GLYPH: Partial<Record<TowerFamily, (g: Graphics, x: number, y: number, pulse: number) => void>> = {
  mitosis: (g, x, y, p) => {
    const s = 3 + Math.abs(Math.sin(p)) * 1.5;
    g.circle(x - s, y, 4).fill(0xd8f0c8); g.circle(x + s, y, 4).fill(0xd8f0c8);
  },
  capacitor: (g, x, y) => {
    g.rect(x - 5, y - 4, 3, 8).fill(0xe0f0ff); g.rect(x + 2, y - 4, 3, 8).fill(0xe0f0ff);
  },
  boomerang: (g, x, y) => {
    g.moveTo(x - 6, y + 4).lineTo(x, y - 5).lineTo(x + 6, y + 4).stroke({ width: 2.5, color: 0xfff0c0 });
  },
  press: (g, x, y) => {
    g.rect(x - 6, y - 5, 12, 3).fill(0xe0d0c0); g.rect(x - 6, y + 2, 12, 3).fill(0xe0d0c0);
  },
  reliquary: (g, x, y) => {
    g.rect(x - 1.5, y - 6, 3, 12).fill(0xfff8e0); g.rect(x - 5, y - 3, 10, 3).fill(0xfff8e0);
  },
};

export const ENEMY_SIZE: Record<Enemy['kind'], number> = {
  responder: 5, militia: 6, skitterling: 3.5, soldier: 8, elite: 11, flier: 6, sapper: 7,
  phalanx: 13, drummer: 9, bomber: 6, tunneler: 8, tender: 7,
  splitter: 9, mortar: 9, carapace: 10, stalker: 8, shadewing: 6, ghostsapper: 7, flametrooper: 8,
  researcher: 6, thief: 6, infiltrator: 6, cannon: 10, dartgun: 9, royal: 20, consort: 13, matron: 13,
};

export interface PlacementPreview {
  cell: number;
  /** A big limb: every cell it would stand on (absent: `cell` alone). */
  cells?: number[];
  kind: 'tower' | 'organ' | 'node' | 'plinth' | 'burrow';
  family?: TowerFamily;
  valid: boolean;
  /** Directional limbs: the facing it will be placed with (right-click rotates). */
  facing?: RootDir;
  /** Banked cannibalize traits the placed limb will carry (so the preview is honest). */
  pips?: Tower['pips'];
  /** Creep node: cells of creep it will spread; spreading: the parent node's cell. */
  radius?: number;
  from?: number;
}

export class Renderer {
  app!: Application;
  protected world = new Container();
  protected ground = new Graphics();
  protected creepG = new Graphics();
  protected entG = new Graphics();
  protected fxG = new Graphics();
  protected ready = false;
  protected pulse = 0;
  /** A ring round every evolved limb. The isometric board leaves it out: the crest says it. */
  protected evolvedRing = true;
  /** Clouds and caltrops are drawn as pictures elsewhere (src/render/fx.ts): leave them out here. */
  protected fxArt = false;
  /** The inherited pips as dots round a limb. Off where the donors' parts are drawn on its body instead. */
  protected pipDots = true;

  preview: PlacementPreview | null = null;
  /** Tower id highlighted as the cannibalize donor candidate. */
  donorHighlightId: number | null = null;
  /** Armed spore sling: draw its throw range while the player aims. */
  slingArm: { x: number; y: number; range: number } | null = null;
  /** Limb whose inspect panel is open: ring it and show its reach. */
  selectedTowerId: number | null = null;

  protected camX = 0;
  protected camY = 0;
  protected camScale = 1;
  protected camInit = false;

  async init(mount: HTMLElement, worldW: number, worldH: number): Promise<void> {
    this.app = new Application();
    await this.app.init({
      width: 1360, height: 1000, background: 0x0a0806, antialias: true,
    });
    mount.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    this.world.addChild(this.ground, this.creepG, this.entG, this.fxG);
    this.ready = true;
  }

  /** Frame the ACTIVE districts (plus margin); ease toward it — the map
   *  visibly grows on screen when a new district is consumed. */
  protected updateCamera(sim: Sim, dtReal: number): void {
    const cp = sim.cfg.cellPx;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let slot = 0; slot < sim.map.slots.length; slot++) {
      if (!sim.map.slots[slot]) continue;
      const sx = (slot % sim.map.slotsX) * 10 * cp;
      const sy = Math.floor(slot / sim.map.slotsX) * 10 * cp;
      minX = Math.min(minX, sx);
      minY = Math.min(minY, sy);
      maxX = Math.max(maxX, sx + 10 * cp);
      maxY = Math.max(maxY, sy + 10 * cp);
    }
    const margin = 3 * cp;
    minX -= margin; minY -= margin; maxX += margin; maxY += margin;
    const vw = this.app.renderer.width;
    const vh = this.app.renderer.height;
    const scale = Math.min(vw / (maxX - minX), vh / (maxY - minY), 1.6);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const tx = vw / 2 - cx * scale;
    const ty = vh / 2 - cy * scale;
    if (!this.camInit) {
      this.camScale = scale; this.camX = tx; this.camY = ty; this.camInit = true;
    } else {
      const k = Math.min(1, dtReal * 3.5);
      this.camScale += (scale - this.camScale) * k;
      this.camX += (tx - this.camX) * k;
      this.camY += (ty - this.camY) * k;
    }
    this.world.scale.set(this.camScale);
    this.world.position.set(this.camX, this.camY);
  }

  camera(): { x: number; y: number; scale: number; vw: number; vh: number } {
    return {
      x: this.camX, y: this.camY, scale: this.camScale,
      vw: this.app.renderer.width, vh: this.app.renderer.height,
    };
  }

  /** World coords -> canvas pixels: where to click to reach that point of the world. */
  worldToScreen(x: number, y: number): { x: number; y: number; vw: number; vh: number } {
    return {
      x: x * this.camScale + this.camX, y: y * this.camScale + this.camY,
      vw: this.app.renderer.width, vh: this.app.renderer.height,
    };
  }

  /** Client (CSS) coords -> world coords, through canvas scaling AND the camera. */
  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.app.canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * this.app.renderer.width;
    const py = ((clientY - rect.top) / rect.height) * this.app.renderer.height;
    return {
      x: (px - this.camX) / this.camScale,
      y: (py - this.camY) / this.camScale,
    };
  }

  draw(sim: Sim, dtReal: number): void {
    if (!this.ready) return;
    this.pulse += dtReal * 3;
    this.updateCamera(sim, dtReal);
    this.drawGround(sim);
    this.drawCreep(sim);
    this.drawEntities(sim);
    this.syncCivilians(sim);
    this.drawCivilians(this.entG);
    this.drawFx(sim);
  }

  // ------------------------------------------------------------ the townsfolk

  /** The townsfolk fleeing the crash (src/sim/civilians.ts): stepped here from the sim's clock, reading the sim only. */
  protected civ: Civilians | null = null;
  private civSim: Sim | null = null;
  /** Where a townsperson was taken by the creep: a puff, seconds left. */
  protected civPuffs: Array<{ x: number; y: number; t: number }> = [];
  /** Coat colours by a townsperson's look. */
  protected static CIV_COATS = [0x9fc3d9, 0xd9c79f, 0xb9a3c9];

  /** Step the crowd up to the sim's tick (a new run makes a new crowd). */
  protected syncCivilians(sim: Sim): void {
    if (this.civSim !== sim || !this.civ || sim.tickCount < this.civ.tick) {
      this.civ = new Civilians(sim);
      this.civSim = sim;
      this.civPuffs = [];
    }
    const stepped = this.civ.sync(sim);
    for (const p of this.civPuffs) p.t -= stepped * 0.1;
    this.civPuffs = this.civPuffs.filter((p) => p.t > 0);
    for (const e of this.civ.takeEvents()) if (e.kind === 'taken') this.civPuffs.push({ x: e.pos.x, y: e.pos.y, t: 0.9 });
  }

  /** What the crowd is doing (beats: tools/shot-civilians.mjs). */
  civiliansNow(): { count: number; calm: number; flee: number; cower: number; leaving: number; escaped: number; taken: number; puffs: number; list: Array<{ x: number; y: number; state: string }> } {
    const l = this.civ?.list ?? [];
    const n = (s: string) => l.filter((c) => c.state === s).length;
    return {
      count: l.length, calm: n('calm'), flee: n('flee'), cower: n('cower'), leaving: n('leaving'),
      escaped: this.civ?.escaped ?? 0, taken: this.civ?.taken ?? 0, puffs: this.civPuffs.length,
      list: l.map((c) => ({ x: c.pos.x, y: c.pos.y, state: c.state })),
    };
  }

  /** The top-down board's townsfolk: a small figure each, bobbing as it runs. */
  protected drawCivilians(g: Graphics): void {
    for (const c of this.civ?.list ?? []) this.drawCivilian(g, c, c.pos.x, c.pos.y, 1);
    for (const p of this.civPuffs) {
      const k = 1 - p.t / 0.9;
      g.circle(p.x, p.y - 3, 3 + k * 7).fill({ color: 0xc8566b, alpha: 0.55 * (1 - k) });
    }
  }

  /** One townsperson at (x, y) on the ground, s times the top-down size. */
  protected drawCivilian(g: Graphics, c: Civilian, x: number, y: number, s: number): void {
    const run = c.state === 'flee' || (c.state === 'calm' && c.moved > 0);
    const bob = run ? Math.abs(Math.sin((this.pulse * (c.state === 'flee' ? 4 : 2)) + c.id)) * 1.6 * s : 0;
    const low = c.state === 'cower' ? 1.8 * s : 0;
    const a = c.alpha;
    g.ellipse(x, y, 3 * s, 1.5 * s).fill({ color: 0x000000, alpha: 0.3 * a });
    const by = y - 4 * s - bob + low;
    g.roundRect(x - 2.2 * s, by - 1 * s, 4.4 * s, 5.5 * s - low, 1.5 * s).fill({ color: Renderer.CIV_COATS[c.look % 3], alpha: a });
    g.circle(x, by - 2.2 * s + low * 0.4, 1.9 * s).fill({ color: 0x241a12, alpha: a });
    // The bag, swinging on the side it runs from.
    g.rect(x + (c.dir.x > 0 ? -3.6 : 2.2) * s, by + 1.2 * s, 1.6 * s, 2 * s).fill({ color: 0x8a6a3e, alpha: a });
  }

  protected drawGround(sim: Sim): void {
    const g = this.ground;
    g.clear();
    const cp = sim.cfg.cellPx;
    g.rect(0, 0, sim.worldW, sim.worldH).fill(0x100c08);
    for (let cy = 0; cy < sim.cfg.gridH; cy++) {
      for (let cx = 0; cx < sim.cfg.gridW; cx++) {
        const cell = cy * sim.cfg.gridW + cx;
        const t = sim.map.cells[cell];
        const x = cx * cp;
        const y = cy * cp;
        const n = (cx * 7919 + cy * 104729) % 13;
        if (t === CellType.Void) {
          // Unclaimed district: city under smoke. You have not eaten this yet.
          g.rect(x, y, cp, cp).fill(0x0a0806);
          if (n < 3) g.rect(x + 4 + (n % 3) * 6, y + 6 + (n % 4) * 5, 3, 3).fill({ color: 0x1c150d, alpha: 0.8 });
        } else if (t === CellType.Road) {
          // Sunken carved channel: where the columns march. Inner shadow sells the depth.
          g.rect(x, y, cp, cp).fill(0x54432a);
          g.rect(x, y, cp, 4).fill({ color: 0x241a0e, alpha: 0.85 });
          g.rect(x, y, 3, cp).fill({ color: 0x2c2113, alpha: 0.6 });
          g.rect(x, y + cp - 2, cp, 2).fill({ color: 0x6b573a, alpha: 0.5 });
          if ((cx * 3 + cy) % 4 === 0) g.circle(x + 8 + (n % 3) * 7, y + 10 + (n % 4) * 4, 1.5).fill({ color: 0x2c2113, alpha: 0.7 });
        } else if (t === CellType.Plaza) {
          g.rect(x, y, cp, cp).fill(0x3a2f1d);
          g.rect(x, y, cp, 2).fill({ color: 0x241a0e, alpha: 0.5 });
        } else {
          // City block: RAISED architecture — the verticality is the read.
          const hgt = sim.map.heights[cell] || 1;
          const lift = hgt * 4;
          // Drop shadow into the street below.
          g.rect(x + 2, y + cp - 3, cp - 2, 4).fill({ color: 0x000000, alpha: 0.35 });
          // South face: taller blocks show a taller wall.
          const face = [0x1b140c, 0x241a0e, 0x2e2113][hgt - 1];
          g.rect(x + 1, y + 1 - lift + 6, cp - 2, cp - 8 + lift).fill(face);
          // Roof: higher = lighter (catches the light).
          const roof = [0x352b19, 0x453823, 0x57472c][hgt - 1];
          g.rect(x + 1, y + 1 - lift, cp - 2, cp - 8).fill(roof);
          g.rect(x + 1, y + 1 - lift, cp - 2, 3).fill({ color: [0x453823, 0x57472c, 0x6b5836][hgt - 1], alpha: 0.9 });
          const flicker = 0.4 + 0.25 * Math.sin(this.pulse * 0.7 + cx * 3 + cy);
          if (n < 4) g.rect(x + 6 + (n % 3) * 6, y + cp - 8, 3, 5).fill({ color: 0xd8a84e, alpha: flicker });
        }
      }
    }
    this.drawGates(g, sim);
  }

  /** Gates: the frontier ports where unclaimed city meets your turf. */
  protected drawGates(g: Graphics, sim: Sim): void {
    for (const gate of sim.gates) {
      const c = sim.cellCenter(gate);
      const incoming = !sim.waveIntelHidden && sim.incomingGates.includes(gate);
      if (incoming) {
        // The telegraphed assault lane: an angry beacon you plan around.
        const r = 8 + Math.sin(this.pulse * 3) * 3;
        g.circle(c.x, c.y, r + 6).fill({ color: 0xd1603c, alpha: 0.18 });
        g.circle(c.x, c.y, r).stroke({ width: 3, color: 0xe06a3a, alpha: 0.95 });
        // Arrow toward the city.
        const dx = Math.sign(sim.core.x - c.x) * (Math.abs(c.x - sim.core.x) > 60 ? 1 : 0);
        const dy = Math.sign(sim.core.y - c.y) * (Math.abs(c.y - sim.core.y) > 60 ? 1 : 0);
        g.poly([
          c.x + dx * 18 - dy * 6, c.y + dy * 18 - dx * 6,
          c.x + dx * 30, c.y + dy * 30,
          c.x + dx * 18 + dy * 6, c.y + dy * 18 + dx * 6,
        ]).fill({ color: 0xe06a3a, alpha: 0.9 });
      } else {
        g.circle(c.x, c.y, 5 + Math.sin(this.pulse * 2) * 1.5).stroke({ width: 2, color: 0x8f2f2f, alpha: 0.6 });
      }
    }
  }

  protected drawCreep(sim: Sim): void {
    const g = this.creepG;
    g.clear();
    const cp = sim.cfg.cellPx;
    const anyStrain = sim.creepSources.some((s) => s.kind === 'node' && s.strain && (s.strain.slow < 1 || s.strain.dps > 0))
      || sim.coreStrainBonus().slow < 1 || sim.coreStrainBonus().dps > 0;
    // Creep skin per cell, deeper red toward the core; edge cells wobble organically.
    for (let cy = 0; cy < sim.cfg.gridH; cy++) {
      for (let cx = 0; cx < sim.cfg.gridW; cx++) {
        const cell = cy * sim.cfg.gridW + cx;
        if (!sim.isCreeped(cell)) continue;
        const x = cx * cp;
        const y = cy * cp;
        if (sim.map.cells[cell] === CellType.Void) continue;
        const body = sim.isBody(cell);
        const isChannel = sim.map.cells[cell] === CellType.Road || sim.map.cells[cell] === CellType.Plaza;
        const lift = isChannel ? 0 : (sim.map.heights[cell] || 1) * 4;
        const wob = 0.05 * Math.sin(this.pulse * 0.8 + cx * 1.7 + cy * 2.3);
        // Streets stay readable under the creep: thin membrane there, thick hide on roofs.
        const alpha = body ? 0.58 : isChannel ? 0.15 : 0.4;
        g.rect(x, y - lift, cp, cp)
          .fill({ color: body ? 0x6e1e14 : 0x571812, alpha: alpha + wob });
        if (body) {
          g.circle(x + cp / 2, y + cp / 2, cp * 0.32 + Math.sin(this.pulse + cx + cy) * 2)
            .fill({ color: 0x832619, alpha: 0.4 });
        }
        // Strained creep shows what it does: mire is dark and glossy, burning creep glows.
        if (anyStrain) {
          const fx = sim.creepEffectAt(cell);
          if (fx.slow < 1) {
            // Mire: glossy brown-olive bog (rot, not grass) with a wet sheen, unmistakable from bare ground.
            g.rect(x, y - lift, cp, cp).fill({ color: 0x4a3f26, alpha: 0.55 });
            g.rect(x + 4, y - lift + 5 + (cx % 3), cp * 0.45, 2).fill({ color: 0xe0d6b0, alpha: 0.35 + 0.15 * Math.sin(this.pulse + cx) });
          }
          if (fx.dps > 0) g.rect(x + 3, y - lift + 3, cp - 6, cp - 6).fill({ color: 0xd8d040, alpha: 0.18 + 0.08 * Math.sin(this.pulse * 2 + cx + cy) });
        }
      }
    }
    // Core: the heart of the asset.
    const { x, y } = sim.core;
    const coreR = 24 + Math.sin(this.pulse * 1.6) * 3;
    g.circle(x, y, coreR + 8).fill({ color: 0x571812, alpha: 0.6 });
    g.circle(x, y, coreR).fill(0x9c3120);
    g.circle(x, y, coreR * 0.6).fill(0xc4502e);
    g.circle(x - 6, y - 7, coreR * 0.22).fill({ color: 0xf0b090, alpha: 0.8 });
  }

  protected drawEntities(sim: Sim): void {
    const g = this.entG;
    g.clear();
    this.drawNodes(g, sim);
    for (const t of sim.towers) {
      const hgt = sim.map.heights[t.cell] || 0;
      this.drawTower(g, t, hgt > 0 ? hgt * 4 : 0, sim);
    }
    this.drawGroundFx(g, sim);
    for (const e of sim.enemies) this.drawEnemy(g, e, e.pos.x, e.pos.y, sim);
  }

  /** Creep nodes: one call per node, at a place the caller chooses. */
  protected drawNodes(g: Graphics, sim: Sim): void {

    // Creep nodes: spore pods, coloured by strain; a ring fills as they mature, and
    // a mature node that has not spread yet glows (click it to spread its child).
    for (const s of sim.creepSources) {
      if (s.kind !== 'node') continue;
      const p = sim.cellCenter(s.cell);
      const st = s.strain;
      // Size says how far it spreads; the marks say what else it is.
      const r = 4 + (st?.radius ?? 3) * 1.2 + Math.sin(this.pulse * 1.6 + s.id) * 1.0;
      const col = st && st.dps > 0 ? 0xd0d040 : st && st.slow < 1 ? 0x6b5a30 : 0x8aa860;
      g.circle(p.x, p.y, r + 3).fill({ color: 0x3a1a10, alpha: 0.5 });
      g.circle(p.x, p.y, r).fill(col);
      g.circle(p.x - 2, p.y - 2, r * 0.4).fill({ color: 0xd8f0b0, alpha: 0.8 });
      if (st && st.slow < 1) {
        // Mire: a wavy ring.
        for (let k = 0; k < 10; k++) {
          const a0 = (k / 10) * Math.PI * 2 + this.pulse * 0.3;
          const rr = r + 4 + (k % 2 ? 1.5 : -0.5);
          g.circle(p.x + Math.cos(a0) * rr, p.y + Math.sin(a0) * rr, 1.4).fill({ color: 0xc8b878, alpha: 0.9 });
        }
      }
      if (st && st.dps > 0) {
        // Burning: a ring of spikes.
        for (let k = 0; k < 8; k++) {
          const a0 = (k / 8) * Math.PI * 2 - this.pulse * 0.5;
          g.moveTo(p.x + Math.cos(a0) * (r + 1), p.y + Math.sin(a0) * (r + 1))
            .lineTo(p.x + Math.cos(a0) * (r + 6), p.y + Math.sin(a0) * (r + 6))
            .stroke({ width: 2, color: 0xf0a030, alpha: 0.9 });
        }
      }
      if (st && st.reach > 3) {
        // Thrown: a little chevron on top.
        g.poly([p.x - 4, p.y - r - 3, p.x, p.y - r - 8, p.x + 4, p.y - r - 3]).fill({ color: 0xf0e0a0, alpha: 0.95 });
      }
      const mature = sim.wavesCleared >= (s.matureAt ?? 0);
      if (!s.spent) {
        if (mature) {
          g.circle(p.x, p.y, r + 8 + Math.sin(this.pulse * 3) * 1.5).stroke({ width: 2, color: 0xc8f090, alpha: 0.85 });
        } else {
          // Maturing: a faint dashed ring (it matures once it survives a wave).
          for (let k = 0; k < 12; k += 2) {
            const a0 = (k / 12) * Math.PI * 2;
            const a1 = ((k + 1) / 12) * Math.PI * 2;
            g.moveTo(p.x + Math.cos(a0) * (r + 8), p.y + Math.sin(a0) * (r + 8))
              .lineTo(p.x + Math.cos(a1) * (r + 8), p.y + Math.sin(a1) * (r + 8))
              .stroke({ width: 1.5, color: 0xc8f090, alpha: 0.45 });
          }
        }
      }
      if ((s.hp ?? 1) < (s.maxHp ?? 1)) this.hpArc(g, p.x, p.y, 11, (s.hp ?? 0) / (s.maxHp ?? 1));
    }
  }

  /** What lies on the ground: royal presence, pheromone clouds, caltrops. */
  protected drawGroundFx(g: Graphics, sim: Sim): void {
    // Royal presence: a faint gold field around royals and consorts.
    for (const e of sim.enemies) {
      if (e.kind !== 'royal' && e.kind !== 'consort') continue;
      g.circle(e.pos.x, e.pos.y, 120).fill({ color: 0xd4a72c, alpha: 0.05 + 0.02 * Math.sin(this.pulse) });
    }

    // Toxic pheromone clouds.
    for (const c of this.fxArt ? [] : sim.clouds) {
      g.circle(c.pos.x, c.pos.y, c.radius).fill({ color: 0x9a6ac8, alpha: 0.12 + 0.1 * Math.min(1, c.ttl) });
      g.circle(c.pos.x, c.pos.y, c.radius * 0.6).fill({ color: 0xb8e060, alpha: 0.08 });
    }
    // Caltrops: barb-mats in the street.
    for (const k of this.fxArt ? [] : sim.caltrops) {
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + k.id;
        g.moveTo(k.pos.x - Math.cos(a) * 5, k.pos.y - Math.sin(a) * 5)
          .lineTo(k.pos.x + Math.cos(a) * 5, k.pos.y + Math.sin(a) * 5)
          .stroke({ width: 1.8, color: 0xc8b890, alpha: 0.9 });
      }
    }

  }

  /** One enemy, drawn at (x, y). */
  protected drawEnemy(g: Graphics, e: Enemy, x: number, y: number, sim: Sim): void {
    {
      const s = ENEMY_SIZE[e.kind];
      const color = CASTE_COLORS[e.kind === 'royal' ? 'royal' : e.kind === 'researcher' ? 'science' : 'war'];
      // Burning: flames licking up off the body.
      if (e.burnUntil !== undefined && e.burnUntil > sim.time) {
        const fl = Math.abs(Math.sin(this.pulse * 7 + e.id));
        g.poly([x - 4, y - s, x, y - s - 6 - fl * 4, x + 4, y - s]).fill({ color: 0xff8a30, alpha: 0.85 });
        g.poly([x - 2, y - s, x + 1, y - s - 3 - fl * 3, x + 3, y - s]).fill({ color: 0xffe070, alpha: 0.9 });
      }
      // CLOAKED (by nature or under a matron's veil) and unseen: only a heat
      // shimmer. Seen: a violet rim over its normal body.
      if (sim.isCloaked(e)) {
        if (!sim.isRevealed(e)) {
          g.circle(x, y, s).stroke({ width: 1.2, color: 0xcfc0e8, alpha: 0.28 + 0.12 * Math.sin(this.pulse * 3 + e.id) });
          return;
        }
        g.circle(x, y, s + 3).stroke({ width: 1.5, color: 0xd8a0ff, alpha: 0.9 });
      }
      if (e.kind === 'stalker') {
        g.circle(x, y, s).fill({ color: 0x8a6ab0, alpha: 0.9 });
        if (e.hp < e.maxHp) this.hpArc(g, x, y, s + 5, e.hp / e.maxHp);
        return;
      }
      if (e.kind === 'matron') {
        // Veil matron: gilded, trailing a violet veil ring (her cloaking reach).
        g.circle(x, y, 90).stroke({ width: 1, color: 0xb890e0, alpha: 0.25 + 0.1 * Math.sin(this.pulse * 1.5) });
        g.circle(x, y, s + 2).fill({ color: 0x0d0805, alpha: 0.9 });
        g.circle(x, y, s).fill(CASTE_COLORS.royal);
        g.circle(x, y, s * 0.5).fill(0xb890e0);
        if (e.hp < e.maxHp) this.hpArc(g, x, y, s + 5, e.hp / e.maxHp);
        return;
      }
      // A netted flier: on the ground, tangled.
      if ((e.kind === 'flier' || e.kind === 'shadewing') && !sim.isAirborne(e)) {
        g.circle(x, y, s + 1.5).fill({ color: 0x0d0805, alpha: 0.85 });
        g.circle(x, y, s * 0.8).fill(color);
        g.moveTo(x - s - 2, y - s - 2).lineTo(x + s + 2, y + s + 2).stroke({ width: 1, color: 0xe0f4fa, alpha: 0.8 });
        g.moveTo(x + s + 2, y - s - 2).lineTo(x - s - 2, y + s + 2).stroke({ width: 1, color: 0xe0f4fa, alpha: 0.8 });
        if (e.hp < e.maxHp) this.hpArc(g, x, y, s + 5, e.hp / e.maxHp);
        return;
      }
      if (e.kind === 'researcher' || e.kind === 'infiltrator') {
        g.circle(x, y, s + 1.5).fill({ color: 0x0d0805, alpha: 0.85 });
        g.circle(x, y, s).fill(CASTE_COLORS.science);
        // Specimen cage on its back; full once it has a limb.
        g.rect(x - 4, y - s - 6, 8, 6).stroke({ width: 1.2, color: 0xdff5f2, alpha: 0.85 });
        if (e.carrying) g.circle(x, y - s - 3, 2.5).fill(0xc98f6a);
        if (e.extractId !== undefined && !e.carrying) {
          // The sedation line to the limb it is taking.
          const prey = sim.towers.find((tw) => tw.id === e.extractId);
          if (prey && Math.hypot(prey.pos.x - x, prey.pos.y - y) < 40) {
            g.moveTo(x, y).lineTo(prey.pos.x, prey.pos.y)
              .stroke({ width: 1.5, color: 0x4fa9a4, alpha: 0.6 + 0.3 * Math.sin(this.pulse * 6) });
          }
        }
      } else if (e.kind === 'royal') {
        g.circle(x, y, s + 2).fill({ color: 0x0d0805, alpha: 0.9 });
        g.circle(x, y, s).fill(color);
        g.circle(x, y, s * 0.55).fill(0xf3d67a);
        g.poly([x - 8, y - s - 2, x, y - s - 10, x + 8, y - s - 2]).fill(0xf3d67a);
      } else if (e.kind === 'flier' || e.kind === 'shadewing') {
        // Airborne: drawn lifted with a ground shadow and beating wings.
        const fy = y - 10;
        g.circle(x, y + 3, 4).fill({ color: 0x000000, alpha: 0.3 });
        const flap = Math.sin(this.pulse * 6 + e.id) * 4;
        g.poly([x - s - 4, fy - flap, x, fy - 2, x - 2, fy + 3]).fill({ color: 0xe8b06a, alpha: 0.9 });
        g.poly([x + s + 4, fy - flap, x, fy - 2, x + 2, fy + 3]).fill({ color: 0xe8b06a, alpha: 0.9 });
        g.circle(x, fy, s * 0.7).fill(color);
      } else if (e.kind === 'sapper' || e.kind === 'ghostsapper') {
        g.poly([x, y - s - 1.5, x + s + 1.5, y + s + 1.5, x - s - 1.5, y + s + 1.5])
          .fill({ color: 0x0d0805, alpha: 0.85 });
        g.poly([x, y - s, x + s, y + s, x - s, y + s]).fill(0xc97b2e);
        // Mandibles: this one eats LIMBS.
        g.moveTo(x - 4, y - s + 2).lineTo(x - 7, y - s - 4).stroke({ width: 2, color: 0xf0d0a0 });
        g.moveTo(x + 4, y - s + 2).lineTo(x + 7, y - s - 4).stroke({ width: 2, color: 0xf0d0a0 });
      } else if (e.kind === 'tunneler' && e.burrowed) {
        // Underground: only a travelling mound of disturbed street.
        g.circle(x, y + 2, s + 2).fill({ color: 0x3a2c18, alpha: 0.8 });
        g.circle(x, y, s).fill({ color: 0x54432a, alpha: 0.9 });
        g.circle(x - 3, y - 2, 1.5).fill({ color: 0x2c2113, alpha: 0.9 });
        g.circle(x + 4, y + 1, 1.5).fill({ color: 0x2c2113, alpha: 0.9 });
      } else if (e.kind === 'drummer') {
        // War-drummer: broad body with a beating drum ring — kill it first.
        g.circle(x, y, s + 1.5).fill({ color: 0x0d0805, alpha: 0.85 });
        g.circle(x, y, s).fill(color);
        g.circle(x, y, s + 6 + Math.sin(this.pulse * 5) * 3).stroke({ width: 1.5, color: 0xe0a03a, alpha: 0.5 });
        g.circle(x, y, s * 0.45).fill(0xe0a03a);
      } else if (e.kind === 'bomber') {
        // A running charge: small, fast, glowing payload.
        g.circle(x, y, s + 1.5).fill({ color: 0x0d0805, alpha: 0.85 });
        g.circle(x, y, s).fill(color);
        const arm = 0.5 + 0.5 * Math.sin(this.pulse * 8 + e.id);
        g.circle(x, y, s * 0.5).fill({ color: 0xf2e04a, alpha: 0.5 + arm * 0.5 });
      } else if (e.kind === 'thief') {
        // Science-caste cutpurse: researcher colors, but running with a satchel.
        g.circle(x, y, s + 1.5).fill({ color: 0x0d0805, alpha: 0.85 });
        g.circle(x, y, s).fill(CASTE_COLORS.science);
        g.rect(x - 3, y + 2, 6, 4).fill(e.stole ? 0xd1603c : 0x2a4a48);
      } else if (e.kind === 'cannon' || e.kind === 'dartgun') {
        // THE CANNON: a beetle carrying a barrel; braced legs once deployed.
        const sci = e.kind === 'dartgun';
        const body = sci ? CASTE_COLORS.science : 0x6a4a30;
        if (e.deployed) {
          for (const a of [0.6, 2.5, 3.8, 5.6]) {
            g.moveTo(x, y).lineTo(x + Math.cos(a) * (s + 6), y + Math.sin(a) * (s + 6))
              .stroke({ width: 2, color: 0x1a0e06, alpha: 0.9 });
          }
        }
        g.circle(x, y, s + 1.5).fill({ color: 0x0d0805, alpha: 0.9 });
        g.circle(x, y, s).fill(body);
        g.rect(x - 2.5, y - s - (sci ? 5 : 8), 5, sci ? 7 : 10).fill(sci ? 0xdff5f2 : 0x2a1a0e);
      } else if (e.kind === 'consort') {
        // Royal consort: gilded, crowned; promotes the ranks around it.
        g.circle(x, y, s + 2).fill({ color: 0x0d0805, alpha: 0.9 });
        g.circle(x, y, s).fill(CASTE_COLORS.royal);
        g.circle(x, y, s * 0.5 + Math.sin(this.pulse * 2 + e.id) * 1.5).fill(0xf3d67a);
        g.poly([x - 6, y - s - 1, x, y - s - 7, x + 6, y - s - 1]).fill(0xf3d67a);
      } else if (e.kind === 'splitter') {
        // Gravid husk: lumpy body, the children visible under the skin.
        g.circle(x, y, s + 1.5).fill({ color: 0x0d0805, alpha: 0.85 });
        g.circle(x, y, s).fill(color);
        g.circle(x - 3, y - 2, 2.5).fill(0xf0c8a0);
        g.circle(x + 3, y + 1, 2.5).fill(0xf0c8a0);
      } else if (e.kind === 'mortar') {
        // Siege beetle: squat dome with a lobber tube, besieges from standoff.
        g.circle(x, y, s + 1.5).fill({ color: 0x0d0805, alpha: 0.85 });
        g.circle(x, y, s).fill(0x7a5a38);
        g.rect(x - 2, y - s - 6, 4, 8).fill(0x4a3520);
      } else if (e.kind === 'carapace') {
        // Ablative shell: hex plate; the ring is the hits it has left.
        g.poly([x, y - s, x + s * 0.87, y - s * 0.5, x + s * 0.87, y + s * 0.5,
          x, y + s, x - s * 0.87, y + s * 0.5, x - s * 0.87, y - s * 0.5])
          .fill({ color: 0x0d0805, alpha: 0.9 });
        g.poly([x, y - s + 2, x + s * 0.87 - 2, y - s * 0.5 + 1, x + s * 0.87 - 2, y + s * 0.5 - 1,
          x, y + s - 2, x - s * 0.87 + 2, y + s * 0.5 - 1, x - s * 0.87 + 2, y - s * 0.5 + 1])
          .fill(0x9a8a5a);
        if (e.hitShield !== undefined && e.hitShield > 0) {
          g.circle(x, y, s + 4).stroke({ width: 2, color: 0xe8dca0, alpha: 0.3 + 0.08 * e.hitShield });
        }
      } else if (e.kind === 'tender') {
        // Tender: pale carer with a pulsing cross — a priority target.
        g.circle(x, y, s + 1.5).fill({ color: 0x0d0805, alpha: 0.85 });
        g.circle(x, y, s).fill(0xd8b8a0);
        g.rect(x - 1.5, y - 4, 3, 8).fill(0x8f2f3d);
        g.rect(x - 4, y - 1.5, 8, 3).fill(0x8f2f3d);
      } else if (e.kind === 'phalanx') {
        // Shield-wall: a broad plated slab.
        g.rect(x - s, y - s * 0.8, s * 2, s * 1.6).fill({ color: 0x0d0805, alpha: 0.9 });
        g.rect(x - s + 2, y - s * 0.8 + 2, s * 2 - 4, s * 1.6 - 4).fill(0x8a4a30);
        g.rect(x - s + 2, y - s * 0.8 + 2, s * 2 - 4, 4).fill(0xb56a40);
        g.moveTo(x - s + 4, y).lineTo(x + s - 4, y).stroke({ width: 2, color: 0x5c2a1a, alpha: 0.8 });
      } else {
        // War caste: chevron bodies with a dark rim, bigger kinds broader.
        g.poly([x, y - s - 1.5, x + s + 1.5, y + s + 1.5, x - s - 1.5, y + s + 1.5])
          .fill({ color: 0x0d0805, alpha: 0.85 });
        g.poly([x, y - s, x + s, y + s, x - s, y + s]).fill(color);
        if (e.kind === 'elite') g.circle(x, y + 2, s * 0.35).fill(0x5c1d10);
      }
      // Status reads: snared = web ring, blighted = spore motes.
      if (e.slowUntil !== undefined && e.slowUntil > sim.time) {
        g.circle(x, y, s + 3).stroke({ width: 1.5, color: 0x9cc45f, alpha: 0.8 });
      }
      if (e.poisonUntil !== undefined && e.poisonUntil > sim.time) {
        g.circle(x + 3, y - s - 3, 2).fill({ color: 0xb8cc55, alpha: 0.9 });
        g.circle(x - 3, y - s - 5, 1.5).fill({ color: 0xb8cc55, alpha: 0.7 });
      }
      if (e.hp < e.maxHp) this.hpArc(g, x, y, s + 5, e.hp / e.maxHp);
    }
  }

  protected drawTower(g: Graphics, t: Tower, lift: number, sim: Sim): void {
    this.drawTowerBody(g, t, t.pos.x, t.pos.y - lift, sim);
    this.drawTowerMarks(g, t, t.pos.x, t.pos.y - lift, sim);
  }

  /** The limb itself, as a drawn shape (what is shown when it has no picture). */
  protected drawTowerBody(g: Graphics, t: Tower, x: number, y: number, sim: Sim): void {
    const c = FAMILY_COLORS[t.family];
    // Ground shadow + rim so limbs read against the creep.
    g.circle(x, y + 2, 15).fill({ color: 0x000000, alpha: 0.35 });
    g.circle(x, y, 14).stroke({ width: 2, color: 0x1a0b08, alpha: 0.9 });
    switch (t.family) {
      case 'spitter':
        g.circle(x, y, 10).fill(c);
        g.rect(x - 2, y - 16, 4, 10).fill(c);
        break;
      case 'burster':
        g.circle(x, y, 12).fill(c);
        g.circle(x, y, 6 + Math.sin(this.pulse * 2 + t.id) * 2).fill(0xe08a4f);
        break;
      case 'lasher':
        g.circle(x, y, 9).fill(c);
        for (let i = 0; i < 3; i++) {
          const a = this.pulse * 1.5 + t.id + (i * Math.PI * 2) / 3;
          g.moveTo(x, y).lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16)
            .stroke({ width: 3, color: c, alpha: 0.8 });
        }
        break;
      case 'maw':
        g.circle(x, y, 12).fill(c);
        g.circle(x, y, 6 + Math.abs(Math.sin(this.pulse + t.id)) * 4).fill(0x2b0d10);
        break;
      case 'spine':
        g.poly([x - 11, y + 10, x - 4, y - 12, x + 2, y + 10]).fill(c);
        g.poly([x + 1, y + 10, x + 7, y - 8, x + 12, y + 10]).fill(c);
        break;
      case 'lure':
        g.circle(x, y, 9).fill(c);
        g.circle(x, y, 13 + (this.pulse * 14 % 18)).stroke({ width: 1.5, color: c, alpha: 0.5 });
        break;
      case 'tangler':
        // A web bed: hub with radiating snare threads.
        g.circle(x, y, 8).fill(c);
        for (let i = 0; i < 5; i++) {
          const a = (i * Math.PI * 2) / 5 + 0.3;
          g.moveTo(x, y).lineTo(x + Math.cos(a) * 15, y + Math.sin(a) * 15)
            .stroke({ width: 1.5, color: c, alpha: 0.7 });
        }
        break;
      case 'blighter':
        // Spore chimney venting motes.
        g.circle(x, y, 10).fill(c);
        g.rect(x - 3, y - 15, 6, 9).fill(c);
        g.circle(x + Math.sin(this.pulse * 2 + t.id) * 5, y - 18, 2.5).fill({ color: 0xb8cc55, alpha: 0.7 });
        break;
      case 'impaler':
        // A long bone harpoon on a squat base.
        g.circle(x, y, 9).fill(c);
        g.poly([x - 2.5, y - 2, x + 2.5, y - 2, x + 1, y - 22, x - 1, y - 22]).fill(0xe8e2cc);
        g.poly([x - 3, y - 18, x + 3, y - 18, x, y - 25]).fill(0xf4efdd);
        break;
      case 'choir':
        // Resonance organ: pulsing ring that syncs the limbs around it.
        g.circle(x, y, 9).fill(c);
        g.circle(x, y, 12 + Math.sin(this.pulse * 4) * 3).stroke({ width: 2, color: c, alpha: 0.6 });
        g.circle(x, y, 4).fill(0xe8d8f4);
        break;
      case 'sling': {
        // A tendon catapult: cocked arm with a clot in the basket.
        g.circle(x, y, 9).fill(c);
        const cocked = t.cooldown > 0;
        const ang = cocked ? -0.5 : -1.2; // arm springs up when ready
        g.moveTo(x, y).lineTo(x + Math.cos(ang) * 16, y + Math.sin(ang) * 16)
          .stroke({ width: 3.5, color: 0x7a4438 });
        g.circle(x + Math.cos(ang) * 16, y + Math.sin(ang) * 16, cocked ? 2.5 : 4.5)
          .fill(cocked ? 0x5c2a1a : 0x9c3120);
        break;
      }
      case 'brood':
        // The mother: swollen sac, egg bumps breathing.
        g.circle(x, y, 12 + Math.sin(this.pulse * 1.4 + t.id) * 1.5).fill(c);
        g.circle(x - 4, y - 3, 3).fill(0xe8a0ac);
        g.circle(x + 4, y - 1, 2.5).fill(0xe8a0ac);
        g.circle(x, y + 5, 2.5).fill(0xe8a0ac);
        break;
      case 'swamp': {
        // A digestive swamp across the street: murky pool, bubbles rising.
        const r = (towerSpec('swamp').swamp?.radius ?? 30) + (towerStats(t).aoe - towerSpec('swamp').aoe);
        g.circle(t.pos.x, t.pos.y, r).fill({ color: 0x3a4a1c, alpha: 0.45 });
        g.circle(t.pos.x, t.pos.y, r * 0.7).fill({ color: 0x4f5e22, alpha: 0.4 });
        for (let i = 0; i < 4; i++) {
          const a = i * 1.7 + t.id;
          const bob = (this.pulse * 0.6 + i * 0.25) % 1;
          g.circle(t.pos.x + Math.cos(a) * r * 0.5, t.pos.y + Math.sin(a) * r * 0.5 - bob * 4, 2 + bob * 1.5)
            .stroke({ width: 1, color: 0xc8d890, alpha: 1 - bob });
        }
        break;
      }
      case 'quill':
        // A fan of bristling quills.
        g.circle(x, y, 9).fill(c);
        for (let i = -2; i <= 2; i++) {
          const a = -Math.PI / 2 + i * 0.35;
          g.moveTo(x, y).lineTo(x + Math.cos(a) * 17, y + Math.sin(a) * 17)
            .stroke({ width: 2, color: 0xe8dcc0, alpha: 0.9 });
        }
        break;
      case 'cage': {
        // Bars around a hollow: the trap waiting for a royal.
        g.circle(x, y, 11).stroke({ width: 2, color: c });
        for (let k = -2; k <= 2; k++) g.moveTo(x + k * 4, y - 10).lineTo(x + k * 4, y + 10).stroke({ width: 1.5, color: 0xb8b8c8 });
        if ((t.captures ?? 0) > 0) g.circle(x, y, 4).fill(0xd4a72c);
        break;
      }
      case 'lance': {
        // A creep spout: a bulb with a long nozzle pointing down its strip.
        const f = t.facing ?? 'N';
        const vx = f === 'E' ? 1 : f === 'W' ? -1 : 0;
        const vy = f === 'S' ? 1 : f === 'N' ? -1 : 0;
        g.circle(x, y, 10).fill(c);
        g.moveTo(x, y).lineTo(x + vx * 20, y + vy * 20).stroke({ width: 5, color: 0x5a7038 });
        for (let k = 1; k <= 3; k++) {
          const px = x + vx * (22 + k * 7);
          const py = y + vy * (22 + k * 7);
          g.circle(px, py, 3 - k * 0.5).fill({ color: 0xc8e090, alpha: 0.8 - k * 0.15 });
        }
        break;
      }
      case 'skipper': {
        // A long mortar tube locked to one heading (arrow = its facing).
        const f = t.facing ?? 'N';
        const vx = f === 'E' ? 1 : f === 'W' ? -1 : 0;
        const vy = f === 'S' ? 1 : f === 'N' ? -1 : 0;
        g.circle(x, y, 10).fill(c);
        g.moveTo(x, y).lineTo(x + vx * 18, y + vy * 18).stroke({ width: 6, color: 0x4a3620 });
        g.poly([
          x + vx * 22 + vy * 5, y + vy * 22 + vx * 5,
          x + vx * 30, y + vy * 30,
          x + vx * 22 - vy * 5, y + vy * 22 - vx * 5,
        ]).fill({ color: 0xd8b060, alpha: 0.85 });
        break;
      }
      case 'conduit': {
        // Marrow conduit: a bone funnel, glowing with the pool it channels.
        const f = t.facing ?? 'N';
        const vx = f === 'E' ? 1 : f === 'W' ? -1 : 0;
        const vy = f === 'S' ? 1 : f === 'N' ? -1 : 0;
        const fed = sim.conduitPool(t).length;
        g.circle(x, y, 10).fill(c);
        g.circle(x, y, 5 + Math.min(5, fed * 0.6)).fill({ color: 0xffd060, alpha: 0.35 + 0.1 * Math.sin(this.pulse * 3) });
        g.poly([x + vx * 10 + vy * 7, y + vy * 10 + vx * 7, x + vx * 22, y + vy * 22, x + vx * 10 - vy * 7, y + vy * 10 - vx * 7])
          .fill({ color: 0xffd060, alpha: 0.9 });
        break;
      }
      case 'mitosis':
      case 'capacitor':
      case 'boomerang':
      case 'press':
      case 'reliquary': {
        const f = t.facing ?? 'N';
        const vx = f === 'E' ? 1 : f === 'W' ? -1 : 0;
        const vy = f === 'S' ? 1 : f === 'N' ? -1 : 0;
        const col = ENGINE_COLOR[towerSpec(t.family).engine!.kind];
        g.circle(x, y, 10).fill(c);
        ENGINE_GLYPH[t.family]?.(g, x, y, this.pulse + t.id);
        g.poly([x + vx * 10 + vy * 6, y + vy * 10 + vx * 6, x + vx * 20, y + vy * 20, x + vx * 10 - vy * 6, y + vy * 10 - vx * 6])
          .fill({ color: col, alpha: 0.9 });
        break;
      }
      case 'amp':
      case 'mosaic':
      case 'twin':
      case 'tap': {
        // Combo engines: bell (amp), faceted node (mosaic), paired sacs (twin),
        // a lamprey tap (tap); the arrow is the heading.
        const f = t.facing ?? 'N';
        const vx = f === 'E' ? 1 : f === 'W' ? -1 : 0;
        const vy = f === 'S' ? 1 : f === 'N' ? -1 : 0;
        const col = ENGINE_COLOR[towerSpec(t.family).engine!.kind];
        if (t.family === 'twin') {
          g.circle(x - 5, y, 7).fill(c);
          g.circle(x + 5, y, 7).fill(c);
          g.circle(x - 5, y, 3).fill({ color: 0xe8e4ff, alpha: 0.8 });
          g.circle(x + 5, y, 3).fill({ color: 0xe8e4ff, alpha: 0.8 });
        } else if (t.family === 'tap') {
          g.circle(x, y, 10).fill(c);
          for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3 + this.pulse * 0.4;
            g.circle(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 1.4).fill(0xf0d0e0);
          }
        } else if (t.family === 'amp') {
          g.circle(x, y, 10).fill(c);
          g.circle(x, y, 7 + Math.sin(this.pulse * 4 + t.id) * 2).stroke({ width: 1.5, color: col, alpha: 0.8 });
          g.circle(x, y, 12 + Math.sin(this.pulse * 4 + t.id + 1) * 2).stroke({ width: 1, color: col, alpha: 0.5 });
        } else {
          g.poly([x, y - 11, x + 10, y - 3, x + 6, y + 9, x - 6, y + 9, x - 10, y - 3]).fill(c);
          g.poly([x, y - 5, x + 4, y, x, y + 5, x - 4, y]).fill({ color: 0xffffff, alpha: 0.6 });
        }
        g.poly([x + vx * 10 + vy * 6, y + vy * 10 + vx * 6, x + vx * 21, y + vy * 21, x + vx * 10 - vy * 6, y + vy * 10 - vx * 6])
          .fill({ color: col, alpha: 0.9 });
        break;
      }
      case 'ember':
        // Ember sac: a swollen fuel bladder with a lit nozzle.
        g.circle(x, y, 10).fill(c);
        g.rect(x - 2, y - 15, 4, 8).fill(0x5a2a10);
        g.circle(x, y - 17, 2.5 + Math.abs(Math.sin(this.pulse * 6 + t.id)) * 1.5).fill(0xffb040);
        break;
      case 'net':
        // Netcaster: a web dish pointed at the sky.
        g.circle(x, y, 9).fill(c);
        g.circle(x, y - 6, 9).stroke({ width: 1.5, color: 0xe0f4fa, alpha: 0.8 });
        g.moveTo(x - 8, y - 6).lineTo(x + 8, y - 6).stroke({ width: 1, color: 0xe0f4fa, alpha: 0.6 });
        g.moveTo(x, y - 14).lineTo(x, y + 2).stroke({ width: 1, color: 0xe0f4fa, alpha: 0.6 });
        break;
      case 'frond':
        // A charged frond: forked antenna crackling.
        g.circle(x, y, 8).fill(c);
        g.moveTo(x, y).lineTo(x - 6, y - 16).stroke({ width: 2.5, color: c });
        g.moveTo(x, y).lineTo(x + 6, y - 14).stroke({ width: 2.5, color: c });
        g.circle(x - 6, y - 16, 2 + Math.abs(Math.sin(this.pulse * 5 + t.id)) * 1.5).fill(0xdff4fa);
        g.circle(x + 6, y - 14, 2 + Math.abs(Math.cos(this.pulse * 5 + t.id)) * 1.5).fill(0xdff4fa);
        break;
      case 'lobber': {
        // A fat bile bladder on a stalk; swells when the volley is ready.
        const ready = t.cooldown <= 0;
        g.circle(x, y, 9).fill(c);
        g.circle(x, y - 10, ready ? 8 : 5).fill(ready ? 0xc4b83a : 0x7a713a);
        g.circle(x - 2, y - 12, 2).fill({ color: 0xf0ea9a, alpha: ready ? 0.9 : 0.4 });
        break;
      }
      case 'mister':
        // Spray stalks puffing caustic haze.
        g.circle(x, y, 9).fill(c);
        g.rect(x - 6, y - 14, 3, 9).fill(c);
        g.rect(x + 3, y - 12, 3, 7).fill(c);
        g.circle(x + Math.sin(this.pulse * 1.5 + t.id) * 6, y - 17, 3.5)
          .fill({ color: 0xd8ee9a, alpha: 0.4 });
        break;
      case 'ocular':
        // The eye on a stalk: iris tracks with the pulse.
        g.rect(x - 2.5, y - 14, 5, 14).fill(0x9a8f78);
        g.circle(x, y - 17, 8).fill(0xf0e8d8);
        g.circle(x + Math.sin(this.pulse * 0.8 + t.id) * 3, y - 17, 3.5).fill(0x3a2c14);
        break;
      case 'bombard': {
        // A squat spore mortar: wide tube angled at its marker.
        g.circle(x, y, 11).fill(c);
        let ang = -Math.PI / 2;
        if (t.marker !== undefined) {
          const m = sim.cellCenter(t.marker);
          ang = Math.atan2(m.y - t.pos.y, m.x - t.pos.x);
        }
        g.moveTo(x, y).lineTo(x + Math.cos(ang) * 15, y + Math.sin(ang) * 15)
          .stroke({ width: 6, color: 0x5a4430 });
        g.circle(x, y, 4).fill(t.marker === undefined ? 0x3a2c1c : 0xd8b060);
        break;
      }
      case 'ward':
        // A membrane node: translucent dome, shimmering.
        g.circle(x, y, 10).fill(c);
        g.circle(x, y, 13 + Math.sin(this.pulse * 1.8 + t.id) * 1.5)
          .stroke({ width: 2, color: 0xcfe0ff, alpha: 0.7 });
        break;
      case 'prism': {
        // A crystalline growth; the core brightens as a focus streak builds.
        const glow = Math.min(1, (t.streak ?? 0) / 5);
        g.poly([x, y - 20, x + 8, y - 4, x + 5, y + 8, x - 5, y + 8, x - 8, y - 4]).fill(c);
        g.poly([x, y - 14, x + 4, y - 3, x, y + 4, x - 4, y - 3])
          .fill({ color: 0xeafaff, alpha: 0.45 + 0.55 * glow });
        break;
      }
    }
  }

  /**
   * What is drawn ON a limb whatever it looks like: what it can shoot, its inherited pips,
   * its evolution crest, its health, shield, charge, stasis, stun and selection.
   */
  protected drawTowerMarks(g: Graphics, t: Tower, x: number, y: number, sim: Sim, top: number = y): void {
    // `top`: where what rides over the limb (its health, crest, crown, a stun) is measured from; the isometric
    // board passes the top of a tall look, so those clear it while the marks at its foot stay at its foot.
    // What it can shoot, at a glance: a sky-blue chevron = hits AIR; a hollow
    // ring under it too = AIR ONLY. No chevron = ground only.
    const st = towerStats(t);
    if (st.rate > 0 || t.family === 'lobber' || t.family === 'bombard') {
      if (st.hitsAir) {
        g.poly([x - 16, y + 12, x - 12, y + 7, x - 8, y + 12]).fill({ color: 0x9fe0ff, alpha: 0.95 });
        if (!st.hitsGround) g.circle(x - 12, y + 15, 3).stroke({ width: 1.2, color: 0x9fe0ff });
      }
      if (st.trueSight) g.circle(x + 12, y + 10, 3).fill({ color: 0xd8a0ff, alpha: 0.95 }); // detection
    }
    // Inheritance pips: the silhouette is the build history.
    if (this.pipDots) t.pips.forEach((p, i) => {
      const a = -Math.PI / 2 + i * 0.55;
      g.circle(x + Math.cos(a) * 16, y + Math.sin(a) * 16, 3).fill(FAMILY_COLORS[p.family]);
    });
    // Evolutions show on the body: a crest above the limb, one mark per stage —
    // A a spike, B a diamond; stages 1-2 science teal, stage 3 royal gold.
    const path = t.upgrades ?? [];
    if (path.length > 0) {
      if (this.evolvedRing) g.circle(x, y, 13).stroke({ width: 1.5, color: path.length >= 3 ? 0xd4a72c : 0x4fa9a4, alpha: 0.9 });
      path.forEach((c, i) => {
        const mx = x + (i - (path.length - 1) / 2) * 10;
        const my = top - 24;
        const col = i === 2 ? 0xd4a72c : 0x4fa9a4;
        if (c === 'A') g.poly([mx - 4.5, my + 4, mx, my - 5, mx + 4.5, my + 4]).fill(col).stroke({ width: 1, color: 0x10100a });
        else g.poly([mx, my - 5, mx + 4.5, my, mx, my + 5, mx - 4.5, my]).fill(col).stroke({ width: 1, color: 0x10100a });
      });
    }
    if (t.hp < t.maxHp) this.hpArc(g, x, top, 20, t.hp / t.maxHp);
    // Shield bubble: brighter the fuller it is.
    if ((t.shieldMax ?? 0) > 0 && (t.shield ?? 0) > 0) {
      const f = (t.shield ?? 0) / (t.shieldMax ?? 1);
      g.circle(x, y, 18).stroke({ width: 2, color: 0x9fc4ff, alpha: 0.25 + 0.55 * f });
    }
    // Capacitor bank: a blue charge bar under the limb (fills as it banks shots).
    if ((t.bank ?? 0) >= 1) {
      const w = Math.min(28, 4 + (t.bank ?? 0) * 1.5);
      g.rect(x - w / 2, y + 14, w, 3).fill({ color: 0x80c8ff, alpha: 0.9 });
    }
    // Held in stasis by a marrow tap: a dim cocoon over it.
    if (sim.isTapped(t)) {
      g.circle(x, y, 17).fill({ color: 0x3a2030, alpha: 0.55 });
      g.circle(x, y, 17).stroke({ width: 1.5, color: 0xc070a0, alpha: 0.8 });
    }
    // ROYAL DECREE: a crowned limb wears a small gold crown (its shelter reaches 120px: shown when selected).
    if (t.crowns) {
      const n = Math.min(3, t.crowns);
      for (let k = 0; k < n; k++) {
        const cx = x + (k - (n - 1) / 2) * 11;
        const cy = top - 34;
        g.poly([cx - 5, cy + 3, cx - 5, cy - 3, cx - 2.5, cy, cx, cy - 4, cx + 2.5, cy, cx + 5, cy - 3, cx + 5, cy + 3])
          .fill({ color: 0xe8c040, alpha: 0.95 }).stroke({ width: 1, color: 0x3a2808 });
      }
      if (this.selectedTowerId === t.id) g.circle(t.pos.x, t.pos.y, 120).stroke({ width: 1.5, color: 0xe8c040, alpha: 0.35 });
    }
    // SURGERY UNDER FIRE: an open graft — a pulsing raw ring, and the time left as an arc.
    if (t.graftUntil !== undefined && t.graftUntil > sim.time) {
      const beat = 0.55 + 0.45 * Math.sin(sim.time * 9);
      g.circle(x, y, 19).stroke({ width: 3, color: 0xe0303a, alpha: 0.5 + 0.4 * beat });
      g.circle(x, y, 23).stroke({ width: 1.2, color: 0xff8080, alpha: 0.35 * beat });
    }
    // Stunned by a sedation dart: a pale halo.
    if (t.stunnedUntil !== undefined && t.stunnedUntil > sim.time) {
      g.circle(x, top - 18, 4).stroke({ width: 1.5, color: 0xdff5f2, alpha: 0.9 });
      g.circle(x + 5, top - 20, 2).fill({ color: 0xdff5f2, alpha: 0.7 });
    }
    if (this.donorHighlightId === t.id) {
      g.circle(x, y, 22).stroke({ width: 2, color: 0xffe9a8, alpha: 0.9 });
    }
    if (this.selectedTowerId === t.id) {
      g.circle(x, y, 24).stroke({ width: 2, color: 0x9fd8ff, alpha: 0.9 });
      // The reach it HAS (height, genes, organs, amps), not its family's base.
      const reach = sim.statsOf(t).range;
      if (reach > 0 && reach < 1000 && !towerSpec(t.family).directional) {
        this.drawReach(g, t, reach, reach / sim.heightRangeFactor(t.cell));
      }
    }
  }

  /**
   * FIELD OF FIRE for limbs whose facing matters: the skipping mortar's firing
   * lane and the conduit's pointing lane, drawn as a corridor down its heading.
   */
  protected drawFieldOfFire(g: Graphics, sim: Sim, t: Tower, valid = true, range?: number): void {
    const spec = towerSpec(t.family);
    if (!spec.directional) return;
    const f = Sim.facingVec(t.facing ?? 'N');
    const eng = spec.engine;
    // An engine points as far as conduitTarget looks; a gun fires as far as statsOf says (height and all).
    const len = eng ? eng.reach * towerStats(t).reach : range ?? sim.statsOf(t).range;
    const half = eng ? 30 : 28;
    const px = -f.y;
    const py = f.x;
    const col = valid ? (eng ? ENGINE_COLOR[eng.kind] : 0xffb070) : 0xb03a2a;
    g.poly([
      t.pos.x + px * half, t.pos.y + py * half,
      t.pos.x + f.x * len + px * half, t.pos.y + f.y * len + py * half,
      t.pos.x + f.x * len - px * half, t.pos.y + f.y * len - py * half,
      t.pos.x - px * half, t.pos.y - py * half,
    ]).fill({ color: col, alpha: 0.1 }).stroke({ width: 1.2, color: col, alpha: 0.55 });
    // Chevrons down the lane: which way it points.
    for (let d = 40; d < len; d += 60) {
      const cx = t.pos.x + f.x * d;
      const cy = t.pos.y + f.y * d;
      g.moveTo(cx + px * 8 - f.x * 6, cy + py * 8 - f.y * 6).lineTo(cx, cy)
        .lineTo(cx - px * 8 - f.x * 6, cy - py * 8 - f.y * 6)
        .stroke({ width: 1.5, color: col, alpha: 0.6 });
    }
  }

  /**
   * WHAT IT AFFECTS (Collins: "the UI should indicate what they are affecting"):
   * a conduit's sources (thin lines in) and its target (thick arrow out); a
   * choir's or ward's covered limbs (rings), plus the reach it covers.
   */
  protected drawEffectLinks(g: Graphics, sim: Sim, t: Tower): void {
    const spec = towerSpec(t.family);
    const links = sim.effectLinks(t);
    if (spec.engine) {
      const col = ENGINE_COLOR[spec.engine.kind];
      const s = towerStats(t);
      if (spec.engine.gather !== undefined) {
        const gather = spec.engine.gather * s.reach + (s.aoe - spec.aoe);
        g.circle(t.pos.x, t.pos.y, gather).stroke({ width: 1, color: col, alpha: 0.35 });
      }
      for (const u of links.sources) {
        g.moveTo(u.pos.x, u.pos.y).lineTo(t.pos.x, t.pos.y).stroke({ width: 1.5, color: col, alpha: 0.7 });
        g.circle(u.pos.x, u.pos.y, 16).stroke({ width: 1.2, color: col, alpha: 0.6 });
      }
      for (const u of links.targets) {
        g.moveTo(t.pos.x, t.pos.y).lineTo(u.pos.x, u.pos.y).stroke({ width: 4, color: col, alpha: 0.9 });
        g.circle(u.pos.x, u.pos.y, 22 + Math.sin(this.pulse * 3) * 2).stroke({ width: 2.5, color: col, alpha: 0.95 });
      }
      return;
    }
    if (t.family === 'choir' || t.family === 'ward') {
      const col = t.family === 'choir' ? 0xc8a0f0 : 0x9fc4ff;
      g.circle(t.pos.x, t.pos.y, sim.auraOf(t).radius).stroke({ width: 1, color: col, alpha: 0.4 });
      for (const u of links.targets) {
        g.circle(u.pos.x, u.pos.y, 20).stroke({ width: 2, color: col, alpha: 0.85 });
      }
    }
  }

  protected drawFx(sim: Sim): void {
    const g = this.fxG;
    g.clear();
    this.drawFxInto(g, sim);
  }

  /** Where a thing thrown in an arc is drawn when it is `up` above the ground at (x, y). */
  protected lob(x: number, y: number, up: number): { x: number; y: number } {
    return { x, y: y - up };
  }

  protected drawFxInto(g: Graphics, sim: Sim): void {
    this.drawShots(g, sim);
    this.drawAim(g, sim);
  }

  /** What is in flight: shots, meat, broodlings, arcs, shells, globs and clots. */
  protected drawShots(g: Graphics, sim: Sim): void {

    for (const p of sim.projectiles) {
      if (p.fromFamily === 'impaler') {
        // The harpoon reads as a streak, not a dot.
        const len = 14;
        const m = Math.hypot(p.vel.x, p.vel.y) || 1;
        g.moveTo(p.pos.x - (p.vel.x / m) * len, p.pos.y - (p.vel.y / m) * len)
          .lineTo(p.pos.x, p.pos.y).stroke({ width: 3, color: 0xf4efdd, alpha: 0.95 });
      } else {
        const col = p.fromFamily === 'tangler' ? 0x9cc45f
          : p.fromFamily === 'blighter' ? 0xb8cc55 : 0xf2c069;
        g.circle(p.pos.x, p.pos.y, p.fromFamily === 'burster' ? 5 : 3).fill(col);
      }
    }
    // The dead on the ground (the creep digests them: src/sim/types.ts Corpse): dark husks, shrinking as they dissolve.
    for (const c of sim.corpses) {
      const k = c.digest === undefined ? 1 : Math.max(0.15, 1 - c.digest / 2.3);
      g.ellipse(c.pos.x, c.pos.y, 5 * k * (c.heap ? 1.5 : 1), 3 * k).fill({ color: 0x3a1a16, alpha: 0.85 });
    }

    // Broodlings: your mites in the streets.
    for (const b of sim.broodlings) {
      g.circle(b.pos.x, b.pos.y, 4.5).fill({ color: 0x0d0805, alpha: 0.8 });
      g.circle(b.pos.x, b.pos.y, 3.5).fill(0xc75a68);
      if (b.hp < b.maxHp) this.hpArc(g, b.pos.x, b.pos.y, 6, b.hp / b.maxHp);
    }

    // Lightning arcs and sniper beams (fade fast).
    for (const a of sim.arcs) {
      const midX = (a.from.x + a.to.x) / 2 + Math.sin(this.pulse * 30) * 4;
      const midY = (a.from.y + a.to.y) / 2 + Math.cos(this.pulse * 27) * 4;
      g.moveTo(a.from.x, a.from.y).lineTo(midX, midY).lineTo(a.to.x, a.to.y)
        .stroke({ width: 2, color: 0xcfeef8, alpha: Math.min(1, a.ttl * 4) });
    }

    // Shells in flight: hive shells dark, darts pale, bombard shells spore-gold.
    for (const s of sim.shells) {
      const f = 1 - s.ttl / s.flight;
      const x = s.from.x + (s.to.x - s.from.x) * f;
      const y = s.from.y + (s.to.y - s.from.y) * f;
      const arc = Math.sin(f * Math.PI) * 50;
      const col = s.side === 'body' ? 0xd8b060 : s.stun ? 0xdff5f2 : 0x2a1a0e;
      const top = this.lob(x, y, arc);
      g.circle(x, y + 3, 3.5).fill({ color: 0x000000, alpha: 0.3 });
      g.circle(top.x, top.y, s.stun ? 2.5 : 4.5).fill(col);
    }

    // Bile globs in flight: heavier arc than the clot, sickly color.
    for (const gb of sim.bileFlights) {
      const f = 1 - gb.ttl / 0.9;
      const x = gb.from.x + (gb.to.x - gb.from.x) * f;
      const y = gb.from.y + (gb.to.y - gb.from.y) * f;
      const arc = Math.sin(f * Math.PI) * 40;
      const top = this.lob(x, y, arc);
      g.circle(x, y + 3, 5).fill({ color: 0x000000, alpha: 0.3 });
      g.circle(top.x, top.y, 6).fill(0xc4b83a);
    }

    // Creep clots in flight: a lobbed blob on a parabola, shadow tracking below.
    for (const c of sim.clotFlights) {
      const f = 1 - c.ttl / 1.2;
      const x = c.from.x + (c.to.x - c.from.x) * f;
      const y = c.from.y + (c.to.y - c.from.y) * f;
      const arc = Math.sin(f * Math.PI) * 46;
      const top = this.lob(x, y, arc);
      g.circle(x, y + 3, 5).fill({ color: 0x000000, alpha: 0.3 });
      g.circle(top.x, top.y, 7).fill(0x9c3120);
      g.circle(top.x - 2, top.y - 2, 2.5).fill({ color: 0xd0604a, alpha: 0.9 });
    }

  }

  /** What the player is aiming or has ordered: markers, ranges, fields of fire, the placement preview. */
  protected drawAim(g: Graphics, sim: Sim): void {
    // Bombard markers: the crosshair you ordered it to shell.
    for (const t of sim.towers) {
      if (t.family !== 'bombard' || t.marker === undefined) continue;
      const m = sim.cellCenter(t.marker);
      const r = towerStats(t).aoe;
      g.circle(m.x, m.y, r).stroke({ width: 1.5, color: 0xd8b060, alpha: 0.55 });
      g.moveTo(m.x - 8, m.y).lineTo(m.x + 8, m.y).stroke({ width: 1.5, color: 0xd8b060, alpha: 0.8 });
      g.moveTo(m.x, m.y - 8).lineTo(m.x, m.y + 8).stroke({ width: 1.5, color: 0xd8b060, alpha: 0.8 });
    }

    // Armed sling: show the throw range while the player aims.
    if (this.slingArm) {
      g.circle(this.slingArm.x, this.slingArm.y, this.slingArm.range)
        .stroke({ width: 2, color: 0xd0604a, alpha: 0.5 });
      g.circle(this.slingArm.x, this.slingArm.y, this.slingArm.range * (0.9 + 0.1 * Math.sin(this.pulse * 3)))
        .stroke({ width: 1, color: 0xd0604a, alpha: 0.25 });
    }

    // A SHAPED limb (a T, an L: src/sim/footprint.ts) has its ground outlined, so its shape reads on the
    // board while its picture is still a placeholder.
    for (const t of sim.towers) {
      if (!towerSpec(t.family).shape) continue;
      for (const c of sim.cellsOf(t)) this.drawFootprintCell(g, sim, c);
    }

    // The open panel's limb: its field of fire and what it is affecting.
    const sel = this.selectedTowerId !== null ? sim.towers.find((t) => t.id === this.selectedTowerId) : undefined;
    if (sel) {
      this.drawFieldOfFire(g, sim, sel);
      this.drawEffectLinks(g, sim, sel);
    }

    // Placement preview: the limb as it WILL be — range, field of fire, and
    // (for effect limbs) exactly what it would affect from this spot.
    if (this.preview) {
      const ok = this.preview.valid;
      const ground = this.preview.cells ?? [this.preview.cell];
      // It will stand in the middle of the ground it takes (a T or an L: on its hub, src/sim/footprint.ts).
      const c = { x: 0, y: 0 };
      for (const cell of ground) {
        const p = sim.cellCenter(cell);
        c.x += p.x / ground.length;
        c.y += p.y / ground.length;
        this.drawPreviewCell(g, sim, cell, ok);
      }
      if (this.preview.kind === 'tower' && this.preview.family && towerSpec(this.preview.family).shape) {
        const hub = sim.hubPos(this.preview.family, this.preview.facing ?? 'S', ground);
        c.x = hub.x;
        c.y = hub.y;
      }
      if (this.preview.kind === 'node') {
        g.circle(c.x, c.y, (this.preview.radius ?? 3) * sim.cfg.cellPx).stroke({ width: 2, color: ok ? 0x9ad068 : 0xb03a2a, alpha: 0.6 });
        g.circle(c.x, c.y, 8).fill({ color: 0x8aa860, alpha: ok ? 0.9 : 0.4 });
        if (this.preview.from !== undefined) {
          const f = sim.cellCenter(this.preview.from);
          g.moveTo(f.x, f.y).lineTo(c.x, c.y).stroke({ width: 2, color: 0x9ad068, alpha: ok ? 0.7 : 0.25 });
        }
      }
      if (this.preview.kind === 'tower' && this.preview.family) {
        const ghost: Tower = {
          id: -1, family: this.preview.family, pos: c, cell: ground[0], ...(ground.length > 1 ? { cells: ground } : {}),
          hp: 1, maxHp: 1, pips: this.preview.pips ?? [], cooldown: 0, kills: 0, facing: this.preview.facing,
        };
        const spec = towerSpec(ghost.family);
        // The SAME stats the sim will give it on this ground: height (plinths too), genes,
        // organ bonuses, amps, banked pips. The ring is the reach it will have, never the base.
        const st = sim.previewStats(ghost.family, ground, ghost.facing, ghost.pips);
        const high = st.range > st.groundRange + 0.5;
        if (spec.directional) {
          this.drawFieldOfFire(g, sim, ghost, ok, spec.engine ? undefined : st.range);
        } else if (st.range > 0 && st.range < 1000) {
          // What height adds shows as the gap between a faint ring (its reach on level 1) and the real one.
          if (high) g.circle(c.x, c.y, st.groundRange).stroke({ width: 1.2, color: 0xffffff, alpha: 0.32 });
          g.circle(c.x, c.y, st.range).stroke({ width: high ? 2 : 1.5, color: high ? 0xffe08a : 0xffffff, alpha: high ? 0.5 : 0.25 });
        }
        this.drawEffectLinks(g, sim, ghost);
      }
    }
  }

  /** How far the selected limb reaches: a ring on the ground round it. */
  /** `ground`: its reach on level 1; when it stands higher, a faint ring shows what the height adds. */
  protected drawReach(g: Graphics, t: Tower, reach: number, ground = reach): void {
    if (reach > ground + 0.5) g.circle(t.pos.x, t.pos.y, ground).stroke({ width: 1, color: 0x9fd8ff, alpha: 0.14 });
    g.circle(t.pos.x, t.pos.y, reach).stroke({ width: 1, color: 0x9fd8ff, alpha: 0.3 });
  }

  /** The cell a placement would take, lit green or red. */
  /** A cell of a shaped limb's ground, outlined. */
  protected drawFootprintCell(g: Graphics, sim: Sim, cell: number): void {
    const p = sim.cellCenter(cell);
    const h = sim.cfg.cellPx / 2;
    g.rect(p.x - h + 1, p.y - h + 1, 2 * h - 2, 2 * h - 2).stroke({ width: 1.2, color: 0xffe08a, alpha: 0.7 });
  }

  protected drawPreviewCell(g: Graphics, sim: Sim, cell: number, ok: boolean): void {
    const c = sim.cellCenter(cell);
    g.rect(c.x - sim.cfg.cellPx / 2, c.y - sim.cfg.cellPx / 2, sim.cfg.cellPx, sim.cfg.cellPx)
      .fill({ color: ok ? 0x76b04a : 0xb03a2a, alpha: 0.4 });
  }

  protected hpArc(g: Graphics, x: number, y: number, r: number, frac: number): void {
    const f = Math.max(0, Math.min(1, frac));
    g.moveTo(x - r, y - r).lineTo(x - r + 2 * r * f, y - r)
      .stroke({ width: 3, color: f > 0.4 ? 0x7fae52 : 0xc84b2f, alpha: 0.95 });
  }
}
