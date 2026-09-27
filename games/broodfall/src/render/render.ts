/**
 * Broodfall renderer: PixiJS, procedural placeholder art drawn per-frame.
 * Every entity's look comes from one function per family/kind, so swapping in
 * baked spritesheets later is a per-function change, not a rewrite.
 */
import { Application, Container, Graphics } from 'pixi.js';
import { CellType } from '../sim/citymap';
import { Sim, towerSpec, towerStats } from '../sim/sim';
import type { Enemy, RootDir, Tower, TowerFamily } from '../sim/types';

export const CASTE_COLORS = { war: 0xd1603c, science: 0x4fa9a4, royal: 0xd4a72c } as const;

const FAMILY_COLORS: Record<TowerFamily, number> = {
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
  net: 0x88c8e0,
  ember: 0xd86a30,
  conduit: 0xc8a060,
  amp: 0xe070b0,
  mosaic: 0x60c0a8,
};

/** Link colour per combo-engine kind (sources in, arrow out). */
const ENGINE_COLOR: Record<string, number> = { funnel: 0xffd060, amplify: 0xff80c8, mosaic: 0x70e8c8 };

const ENEMY_SIZE: Record<Enemy['kind'], number> = {
  responder: 5, militia: 6, skitterling: 3.5, soldier: 8, elite: 11, flier: 6, sapper: 7,
  phalanx: 13, drummer: 9, bomber: 6, tunneler: 8, tender: 7,
  splitter: 9, mortar: 9, carapace: 10, stalker: 8, shadewing: 6, ghostsapper: 7,
  researcher: 6, thief: 6, infiltrator: 6, cannon: 10, dartgun: 9, royal: 20, consort: 13, matron: 13,
};

export interface PlacementPreview {
  cell: number;
  kind: 'tower' | 'organ';
  family?: TowerFamily;
  valid: boolean;
  /** Directional limbs: the facing it will be placed with (right-click rotates). */
  facing?: RootDir;
  /** Banked cannibalize traits the placed limb will carry (so the preview is honest). */
  pips?: Tower['pips'];
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
  /** Armed spore sling: draw its throw range while the player aims. */
  slingArm: { x: number; y: number; range: number } | null = null;
  /** Limb whose inspect panel is open: ring it and show its reach. */
  selectedTowerId: number | null = null;

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
      } else if (o.organ === 'root') {
        // Tendril root: a bulb with a fat runner pointing where the lobe grows.
        g.circle(x, y, 11).fill(0x8f4a3d);
        g.circle(x, y, 6).fill(0xb0685a);
        const d = o.rootDir ?? 'N';
        const vx = d === 'E' ? 1 : d === 'W' ? -1 : 0;
        const vy = d === 'S' ? 1 : d === 'N' ? -1 : 0;
        const wob = Math.sin(this.pulse * 2) * 2;
        g.moveTo(x, y).lineTo(x + vx * (18 + wob), y + vy * (18 + wob))
          .stroke({ width: 4, color: 0x8f4a3d, alpha: 0.9 });
        g.poly([
          x + vx * 24 + vy * 5, y + vy * 24 + vx * 5,
          x + vx * 30, y + vy * 30,
          x + vx * 24 - vy * 5, y + vy * 24 - vx * 5,
        ]).fill({ color: 0xb0685a, alpha: 0.9 });
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
      this.drawTower(g, t, hgt > 0 ? hgt * 4 : 0, sim);
    }

    // Royal presence: a faint gold field around royals and consorts.
    for (const e of sim.enemies) {
      if (e.kind !== 'royal' && e.kind !== 'consort') continue;
      g.circle(e.pos.x, e.pos.y, 120).fill({ color: 0xd4a72c, alpha: 0.05 + 0.02 * Math.sin(this.pulse) });
    }

    // Toxic pheromone clouds.
    for (const c of sim.clouds) {
      g.circle(c.pos.x, c.pos.y, c.radius).fill({ color: 0x9a6ac8, alpha: 0.12 + 0.1 * Math.min(1, c.ttl) });
      g.circle(c.pos.x, c.pos.y, c.radius * 0.6).fill({ color: 0xb8e060, alpha: 0.08 });
    }
    // Caltrops: barb-mats in the street.
    for (const k of sim.caltrops) {
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + k.id;
        g.moveTo(k.pos.x - Math.cos(a) * 5, k.pos.y - Math.sin(a) * 5)
          .lineTo(k.pos.x + Math.cos(a) * 5, k.pos.y + Math.sin(a) * 5)
          .stroke({ width: 1.8, color: 0xc8b890, alpha: 0.9 });
      }
    }

    for (const e of sim.enemies) {
      const { x, y } = e.pos;
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
          continue;
        }
        g.circle(x, y, s + 3).stroke({ width: 1.5, color: 0xd8a0ff, alpha: 0.9 });
      }
      if (e.kind === 'stalker') {
        g.circle(x, y, s).fill({ color: 0x8a6ab0, alpha: 0.9 });
        if (e.hp < e.maxHp) this.hpArc(g, x, y, s + 5, e.hp / e.maxHp);
        continue;
      }
      if (e.kind === 'matron') {
        // Veil matron: gilded, trailing a violet veil ring (her cloaking reach).
        g.circle(x, y, 90).stroke({ width: 1, color: 0xb890e0, alpha: 0.25 + 0.1 * Math.sin(this.pulse * 1.5) });
        g.circle(x, y, s + 2).fill({ color: 0x0d0805, alpha: 0.9 });
        g.circle(x, y, s).fill(CASTE_COLORS.royal);
        g.circle(x, y, s * 0.5).fill(0xb890e0);
        if (e.hp < e.maxHp) this.hpArc(g, x, y, s + 5, e.hp / e.maxHp);
        continue;
      }
      // A netted flier: on the ground, tangled.
      if ((e.kind === 'flier' || e.kind === 'shadewing') && !sim.isAirborne(e)) {
        g.circle(x, y, s + 1.5).fill({ color: 0x0d0805, alpha: 0.85 });
        g.circle(x, y, s * 0.8).fill(color);
        g.moveTo(x - s - 2, y - s - 2).lineTo(x + s + 2, y + s + 2).stroke({ width: 1, color: 0xe0f4fa, alpha: 0.8 });
        g.moveTo(x + s + 2, y - s - 2).lineTo(x - s - 2, y + s + 2).stroke({ width: 1, color: 0xe0f4fa, alpha: 0.8 });
        if (e.hp < e.maxHp) this.hpArc(g, x, y, s + 5, e.hp / e.maxHp);
        continue;
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

  private drawTower(g: Graphics, t: Tower, lift: number, sim: Sim): void {
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
      case 'amp':
      case 'mosaic': {
        // Combo engines: a resonance bell (amp) / a faceted node (mosaic), arrow = heading.
        const f = t.facing ?? 'N';
        const vx = f === 'E' ? 1 : f === 'W' ? -1 : 0;
        const vy = f === 'S' ? 1 : f === 'N' ? -1 : 0;
        const col = t.family === 'amp' ? 0xff80c8 : 0x70e8c8;
        if (t.family === 'amp') {
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
    t.pips.forEach((p, i) => {
      const a = -Math.PI / 2 + i * 0.55;
      g.circle(x + Math.cos(a) * 16, y + Math.sin(a) * 16, 3).fill(FAMILY_COLORS[p.family]);
    });
    if (t.hp < t.maxHp) this.hpArc(g, x, y, 20, t.hp / t.maxHp);
    // Shield bubble: brighter the fuller it is.
    if ((t.shieldMax ?? 0) > 0 && (t.shield ?? 0) > 0) {
      const f = (t.shield ?? 0) / (t.shieldMax ?? 1);
      g.circle(x, y, 18).stroke({ width: 2, color: 0x9fc4ff, alpha: 0.25 + 0.55 * f });
    }
    // Stunned by a sedation dart: a pale halo.
    if (t.stunnedUntil !== undefined && t.stunnedUntil > sim.time) {
      g.circle(x, y - 18, 4).stroke({ width: 1.5, color: 0xdff5f2, alpha: 0.9 });
      g.circle(x + 5, y - 20, 2).fill({ color: 0xdff5f2, alpha: 0.7 });
    }
    if (this.donorHighlightId === t.id) {
      g.circle(x, y, 22).stroke({ width: 2, color: 0xffe9a8, alpha: 0.9 });
    }
    if (this.selectedTowerId === t.id) {
      g.circle(x, y, 24).stroke({ width: 2, color: 0x9fd8ff, alpha: 0.9 });
      const reach = towerStats(t).range;
      if (reach > 0 && reach < 1000 && !towerSpec(t.family).directional) {
        g.circle(t.pos.x, t.pos.y, reach).stroke({ width: 1, color: 0x9fd8ff, alpha: 0.3 });
      }
    }
  }

  /**
   * FIELD OF FIRE for limbs whose facing matters: the skipping mortar's firing
   * lane and the conduit's pointing lane, drawn as a corridor down its heading.
   */
  private drawFieldOfFire(g: Graphics, sim: Sim, t: Tower, valid = true): void {
    const spec = towerSpec(t.family);
    if (!spec.directional) return;
    const f = Sim.facingVec(t.facing ?? 'N');
    const eng = spec.engine;
    const len = eng ? eng.reach * towerStats(t).reach : sim.statsOf(t).range;
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
  private drawEffectLinks(g: Graphics, sim: Sim, t: Tower): void {
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

  private drawFx(sim: Sim): void {
    const g = this.fxG;
    g.clear();

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
    for (const d of sim.drops) {
      g.rect(d.pos.x - 3, d.pos.y - 3, 6, 6).fill(CASTE_COLORS[d.caste]);
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
      g.circle(x, y + 3, 3.5).fill({ color: 0x000000, alpha: 0.3 });
      g.circle(x, y - arc, s.stun ? 2.5 : 4.5).fill(col);
    }

    // Bombard markers: the crosshair you ordered it to shell.
    for (const t of sim.towers) {
      if (t.family !== 'bombard' || t.marker === undefined) continue;
      const m = sim.cellCenter(t.marker);
      const r = towerStats(t).aoe;
      g.circle(m.x, m.y, r).stroke({ width: 1.5, color: 0xd8b060, alpha: 0.55 });
      g.moveTo(m.x - 8, m.y).lineTo(m.x + 8, m.y).stroke({ width: 1.5, color: 0xd8b060, alpha: 0.8 });
      g.moveTo(m.x, m.y - 8).lineTo(m.x, m.y + 8).stroke({ width: 1.5, color: 0xd8b060, alpha: 0.8 });
    }

    // Bile globs in flight: heavier arc than the clot, sickly color.
    for (const gb of sim.bileFlights) {
      const f = 1 - gb.ttl / 0.9;
      const x = gb.from.x + (gb.to.x - gb.from.x) * f;
      const y = gb.from.y + (gb.to.y - gb.from.y) * f;
      const arc = Math.sin(f * Math.PI) * 40;
      g.circle(x, y + 3, 5).fill({ color: 0x000000, alpha: 0.3 });
      g.circle(x, y - arc, 6).fill(0xc4b83a);
    }

    // Creep clots in flight: a lobbed blob on a parabola, shadow tracking below.
    for (const c of sim.clotFlights) {
      const f = 1 - c.ttl / 1.2;
      const x = c.from.x + (c.to.x - c.from.x) * f;
      const y = c.from.y + (c.to.y - c.from.y) * f;
      const arc = Math.sin(f * Math.PI) * 46;
      g.circle(x, y + 3, 5).fill({ color: 0x000000, alpha: 0.3 });
      g.circle(x, y - arc, 7).fill(0x9c3120);
      g.circle(x - 2, y - arc - 2, 2.5).fill({ color: 0xd0604a, alpha: 0.9 });
    }

    // Armed sling: show the throw range while the player aims.
    if (this.slingArm) {
      g.circle(this.slingArm.x, this.slingArm.y, this.slingArm.range)
        .stroke({ width: 2, color: 0xd0604a, alpha: 0.5 });
      g.circle(this.slingArm.x, this.slingArm.y, this.slingArm.range * (0.9 + 0.1 * Math.sin(this.pulse * 3)))
        .stroke({ width: 1, color: 0xd0604a, alpha: 0.25 });
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
      const c = sim.cellCenter(this.preview.cell);
      const ok = this.preview.valid;
      g.rect(c.x - sim.cfg.cellPx / 2, c.y - sim.cfg.cellPx / 2, sim.cfg.cellPx, sim.cfg.cellPx)
        .fill({ color: ok ? 0x76b04a : 0xb03a2a, alpha: 0.4 });
      if (this.preview.kind === 'tower' && this.preview.family) {
        const ghost: Tower = {
          id: -1, family: this.preview.family, pos: c, cell: this.preview.cell,
          hp: 1, maxHp: 1, pips: this.preview.pips ?? [], cooldown: 0, kills: 0, facing: this.preview.facing,
        };
        const spec = towerSpec(ghost.family);
        const st = towerStats(ghost);
        if (spec.directional) {
          this.drawFieldOfFire(g, sim, ghost, ok);
        } else if (st.range > 0 && st.range < 1000) {
          g.circle(c.x, c.y, st.range).stroke({ width: 1.5, color: 0xffffff, alpha: 0.25 });
        }
        this.drawEffectLinks(g, sim, ghost);
      }
    }
  }

  private hpArc(g: Graphics, x: number, y: number, r: number, frac: number): void {
    const f = Math.max(0, Math.min(1, frac));
    g.moveTo(x - r, y - r).lineTo(x - r + 2 * r * f, y - r)
      .stroke({ width: 3, color: f > 0.4 ? 0x7fae52 : 0xc84b2f, alpha: 0.95 });
  }
}
