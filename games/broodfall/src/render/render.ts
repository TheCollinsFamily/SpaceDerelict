/**
 * Broodfall renderer: PixiJS, procedural placeholder art drawn per-frame.
 * Every entity's look comes from one function per family/kind, so swapping in
 * baked spritesheets later is a per-function change, not a rewrite.
 */
import { Application, Container, Graphics } from 'pixi.js';
import { CellType } from '../sim/citymap';
import { Sim, towerStats } from '../sim/sim';
import type { Enemy, Tower, TowerFamily } from '../sim/types';

export const CASTE_COLORS = { war: 0xd1603c, science: 0x4fa9a4, royal: 0xd4a72c } as const;

const FAMILY_COLORS: Record<TowerFamily, number> = {
  spitter: 0xc98f6a,
  burster: 0xb35633,
  lasher: 0x9c4f6d,
  maw: 0x8f2f3d,
  spine: 0x8a7f65,
  lure: 0x5fa898,
};

const ENEMY_SIZE: Record<Enemy['kind'], number> = {
  responder: 5, militia: 6, soldier: 8, elite: 11, researcher: 6, royal: 20,
};

export interface PlacementPreview {
  cell: number;
  kind: 'tower' | 'organ';
  family?: TowerFamily;
  valid: boolean;
}

export class Renderer {
  app!: Application;
  private world = new Container();
  private ground = new Graphics();
  private creepG = new Graphics();
  private entG = new Graphics();
  private fxG = new Graphics();
  private ready = false;
  private pulse = 0;

  preview: PlacementPreview | null = null;
  /** Tower id highlighted as the cannibalize donor candidate. */
  donorHighlightId: number | null = null;

  private camX = 0;
  private camY = 0;
  private camScale = 1;
  private camInit = false;

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
  private updateCamera(sim: Sim, dtReal: number): void {
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
    this.drawFx(sim);
  }

  private drawGround(sim: Sim): void {
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
    // Gates: the frontier ports where unclaimed city meets your turf.
    for (const gate of sim.gates) {
      const c = sim.cellCenter(gate);
      const incoming = sim.incomingGates.includes(gate);
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

  private drawCreep(sim: Sim): void {
    const g = this.creepG;
    g.clear();
    const cp = sim.cfg.cellPx;
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

  private drawEntities(sim: Sim): void {
    const g = this.entG;
    g.clear();

    for (const o of sim.organs) {
      const { x, y } = o.pos;
      if (o.organ === 'heart') {
        const r = 13 + Math.sin(this.pulse * 2.2) * 2.5;
        g.circle(x, y, r).fill(0xa8322a);
        g.circle(x, y, r * 0.55).fill(0xd0604a);
      } else if (o.organ === 'brain') {
        g.circle(x, y, 13).fill(0xc9a2b8);
        g.moveTo(x - 8, y).bezierCurveTo(x - 3, y - 9, x + 4, y + 7, x + 9, y - 2)
          .stroke({ width: 2, color: 0x7d5570 });
      } else {
        const mode = o.glandMode;
        const c = mode === 'lure' ? 0x4fa9a4 : mode === 'challenge' ? 0xd1603c : 0x8a7f65;
        g.poly([x, y - 14, x + 11, y, x, y + 14, x - 11, y]).fill(c);
        g.circle(x, y, 4).fill(0x26200f);
      }
      this.hpArc(g, x, y, 18, o.hp / o.maxHp);
    }

    for (const t of sim.towers) {
      const hgt = sim.map.heights[t.cell] || 0;
      this.drawTower(g, t, hgt > 0 ? hgt * 4 : 0);
    }

    for (const e of sim.enemies) {
      const { x, y } = e.pos;
      const s = ENEMY_SIZE[e.kind];
      const color = CASTE_COLORS[e.kind === 'royal' ? 'royal' : e.kind === 'researcher' ? 'science' : 'war'];
      if (e.kind === 'researcher') {
        g.circle(x, y, s + 1.5).fill({ color: 0x0d0805, alpha: 0.85 });
        g.circle(x, y, s).fill(color);
        if (!e.leaving) {
          // Study beam: curiosity made visible.
          g.circle(x, y - s - 4, 2).fill(0xdff5f2);
        }
      } else if (e.kind === 'royal') {
        g.circle(x, y, s + 2).fill({ color: 0x0d0805, alpha: 0.9 });
        g.circle(x, y, s).fill(color);
        g.circle(x, y, s * 0.55).fill(0xf3d67a);
        g.poly([x - 8, y - s - 2, x, y - s - 10, x + 8, y - s - 2]).fill(0xf3d67a);
      } else {
        // War caste: chevron bodies with a dark rim, bigger kinds broader.
        g.poly([x, y - s - 1.5, x + s + 1.5, y + s + 1.5, x - s - 1.5, y + s + 1.5])
          .fill({ color: 0x0d0805, alpha: 0.85 });
        g.poly([x, y - s, x + s, y + s, x - s, y + s]).fill(color);
        if (e.kind === 'elite') g.circle(x, y + 2, s * 0.35).fill(0x5c1d10);
      }
      if (e.hp < e.maxHp) this.hpArc(g, x, y, s + 5, e.hp / e.maxHp);
    }
  }

  private drawTower(g: Graphics, t: Tower, lift: number): void {
    const x = t.pos.x;
    const y = t.pos.y - lift;
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
    }
    // Inheritance pips: the silhouette is the build history.
    t.pips.forEach((p, i) => {
      const a = -Math.PI / 2 + i * 0.55;
      g.circle(x + Math.cos(a) * 16, y + Math.sin(a) * 16, 3).fill(FAMILY_COLORS[p.family]);
    });
    if (t.hp < t.maxHp) this.hpArc(g, x, y, 20, t.hp / t.maxHp);
    if (this.donorHighlightId === t.id) {
      g.circle(x, y, 22).stroke({ width: 2, color: 0xffe9a8, alpha: 0.9 });
    }
  }

  private drawFx(sim: Sim): void {
    const g = this.fxG;
    g.clear();

    for (const p of sim.projectiles) {
      g.circle(p.pos.x, p.pos.y, p.fromFamily === 'burster' ? 5 : 3).fill(0xf2c069);
    }
    for (const d of sim.drops) {
      g.rect(d.pos.x - 3, d.pos.y - 3, 6, 6).fill(CASTE_COLORS[d.caste]);
    }

    // Placement preview.
    if (this.preview) {
      const c = sim.cellCenter(this.preview.cell);
      const ok = this.preview.valid;
      g.rect(c.x - sim.cfg.cellPx / 2, c.y - sim.cfg.cellPx / 2, sim.cfg.cellPx, sim.cfg.cellPx)
        .fill({ color: ok ? 0x76b04a : 0xb03a2a, alpha: 0.4 });
      if (this.preview.kind === 'tower' && this.preview.family) {
        const spec = towerStats({
          id: 0, family: this.preview.family, pos: c, cell: 0,
          hp: 1, maxHp: 1, pips: [], cooldown: 0, kills: 0,
        });
        if (spec.range > 0) {
          g.circle(c.x, c.y, spec.range).stroke({ width: 1.5, color: 0xffffff, alpha: 0.25 });
        }
      }
    }
  }

  private hpArc(g: Graphics, x: number, y: number, r: number, frac: number): void {
    const f = Math.max(0, Math.min(1, frac));
    g.moveTo(x - r, y - r).lineTo(x - r + 2 * r * f, y - r)
      .stroke({ width: 3, color: f > 0.4 ? 0x7fae52 : 0xc84b2f, alpha: 0.95 });
  }
}
