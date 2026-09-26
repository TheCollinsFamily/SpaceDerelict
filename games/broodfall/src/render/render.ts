/**
 * Broodfall renderer: PixiJS, procedural placeholder art drawn per-frame.
 * Every entity's look comes from one function per family/kind, so swapping in
 * baked spritesheets later is a per-function change, not a rewrite.
 */
import { Application, Container, Graphics } from 'pixi.js';
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

  async init(mount: HTMLElement, worldW: number, worldH: number): Promise<void> {
    this.app = new Application();
    await this.app.init({
      width: worldW, height: worldH, background: 0x14100b, antialias: true,
    });
    mount.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    this.world.addChild(this.ground, this.creepG, this.entG, this.fxG);
    this.ready = true;
  }

  /** Client (CSS) coords -> world coords, accounting for canvas scaling. */
  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.app.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * this.app.renderer.width,
      y: ((clientY - rect.top) / rect.height) * this.app.renderer.height,
    };
  }

  draw(sim: Sim, dtReal: number): void {
    if (!this.ready) return;
    this.pulse += dtReal * 3;
    this.drawGround(sim);
    this.drawCreep(sim);
    this.drawEntities(sim);
    this.drawFx(sim);
  }

  private drawGround(sim: Sim): void {
    const g = this.ground;
    g.clear();
    g.rect(0, 0, sim.worldW, sim.worldH).fill(0x1c1710);
    const cp = sim.cfg.cellPx;
    // Roads: the city has a plan the asset is ignoring.
    for (let cx = 4; cx < sim.cfg.gridW; cx += 8) {
      g.rect(cx * cp - 3, 0, 6, sim.worldH).fill({ color: 0x2a2318, alpha: 0.9 });
    }
    for (let cy = 4; cy < sim.cfg.gridH; cy += 7) {
      g.rect(0, cy * cp - 3, sim.worldW, 6).fill({ color: 0x2a2318, alpha: 0.9 });
    }
    // The insect city, alive at the edges: mound-blocks with lit doorways
    // (placeholder for the painted map).
    for (let cy = 0; cy < sim.cfg.gridH; cy += 2) {
      for (let cx = 0; cx < sim.cfg.gridW; cx += 2) {
        const n = ((cx * 7919 + cy * 104729) % 13);
        if (n < 4) {
          const h = cp * (0.8 + (n % 3) * 0.35);
          g.rect(cx * cp + 3, cy * cp + 3, cp * 1.5, h).fill({ color: 0x352a19, alpha: 0.95 });
          g.rect(cx * cp + 3, cy * cp + 3, cp * 1.5, 4).fill({ color: 0x4a3b22, alpha: 0.9 });
          // Warm doorway light, flickering faintly: someone lives here.
          const flicker = 0.45 + 0.25 * Math.sin(this.pulse * 0.7 + cx * 3 + cy);
          g.rect(cx * cp + 9 + (n % 4) * 6, cy * cp + h - 8, 5, 8)
            .fill({ color: 0xd8a84e, alpha: flicker });
        }
      }
    }
    // Grid whisper.
    for (let x = 0; x <= sim.cfg.gridW; x++) {
      g.moveTo(x * cp, 0).lineTo(x * cp, sim.worldH).stroke({ width: 1, color: 0x000000, alpha: 0.12 });
    }
    for (let y = 0; y <= sim.cfg.gridH; y++) {
      g.moveTo(0, y * cp).lineTo(sim.worldW, y * cp).stroke({ width: 1, color: 0x000000, alpha: 0.12 });
    }
  }

  private drawCreep(sim: Sim): void {
    const g = this.creepG;
    g.clear();
    const { x, y } = sim.core;
    // Creep skin: layered translucent lobes so the edge looks organic, not compass-drawn.
    for (let i = 0; i < 7; i++) {
      const wob = Math.sin(this.pulse * 0.4 + i * 1.7) * 6;
      g.circle(
        x + Math.cos(i * 0.9) * 9, y + Math.sin(i * 1.3) * 9,
        sim.creepRadius + wob - i * 3,
      ).fill({ color: 0x4a1410, alpha: 0.10 });
    }
    g.circle(x, y, sim.creepRadius).fill({ color: 0x571812, alpha: 0.22 });
    // Body mass.
    g.circle(x, y, sim.bodyRadius + Math.sin(this.pulse) * 2).fill({ color: 0x6e1e14, alpha: 0.55 });
    g.circle(x, y, sim.bodyRadius * 0.72).fill({ color: 0x832619, alpha: 0.5 });
    // Core: the heart of the asset.
    const coreR = 26 + Math.sin(this.pulse * 1.6) * 3;
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

    for (const t of sim.towers) this.drawTower(g, t);

    for (const e of sim.enemies) {
      const { x, y } = e.pos;
      const s = ENEMY_SIZE[e.kind];
      const color = CASTE_COLORS[e.kind === 'royal' ? 'royal' : e.kind === 'researcher' ? 'science' : 'war'];
      if (e.kind === 'researcher') {
        g.circle(x, y, s).fill(color);
        if (!e.leaving) {
          // Study beam: curiosity made visible.
          g.circle(x, y - s - 4, 2).fill(0xdff5f2);
        }
      } else if (e.kind === 'royal') {
        g.circle(x, y, s).fill(color);
        g.circle(x, y, s * 0.55).fill(0xf3d67a);
        g.poly([x - 8, y - s - 2, x, y - s - 10, x + 8, y - s - 2]).fill(0xf3d67a);
      } else {
        // War caste: chevron bodies, bigger kinds broader.
        g.poly([x, y - s, x + s, y + s, x - s, y + s]).fill(color);
        if (e.kind === 'elite') g.circle(x, y + 2, s * 0.35).fill(0x5c1d10);
      }
      if (e.hp < e.maxHp) this.hpArc(g, x, y, s + 5, e.hp / e.maxHp);
    }
  }

  private drawTower(g: Graphics, t: Tower): void {
    const { x, y } = t.pos;
    const c = FAMILY_COLORS[t.family];
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
