/**
 * The isometric board, drawn with the baked art (public/art/, made by tools/art/).
 *
 * The city is BUILT here from pieces, because limbs stand on it: every block is a flat
 * roof at an exact height, with walls below it. Units, limbs and blocks are sorted by how
 * far back they stand, so a block hides what is behind it; a faint copy of every unit is
 * drawn on top of everything, so a column behind a tall block can still be followed.
 *
 * Anything without art is drawn as its old shape, so the game plays the same with any part
 * of the art missing.
 */
import { Application, Container, Graphics, Matrix, Sprite, Texture } from 'pixi.js';
import { CellType, PLATE } from '../sim/citymap';
import { Sim, enemySpec, towerSpec, towerStats } from '../sim/sim';
import type { CreepSource, Enemy, Tower } from '../sim/types';
import { BoardArtSet, type Clip, type LimbArt, type UnitArt } from './art';
import {
  FACING_STEP, boardCell, creepRunsOn, depth, facingOf, headingOf, isoGeo, limbView, openSides, pick, project, unproject,
  viewCell, viewOf, viewSize, wallIndex,
  type Facing, type Heading, type IsoGeo, type Pt, type Turn,
} from './iso';
import { buildingsOf, pickVariant, variantName } from './biome';
import { CASTE_COLORS, ENEMY_SIZE, FAMILY_COLORS, Renderer } from './render';

/** The old marks were drawn for a 26 px cell; on this board they are drawn this much bigger. */
const K = 1.9;
/** Art pixels of body width for each world pixel of a unit's radius. */
const UNIT_PX = 3.6;
/**
 * What a roof limb stands on (its skirt of roots), as a share of the width of the ground it
 * takes. The same number as FILL in tools/art/lib/foot.mjs: the solid skirt lies inside the
 * cell and the thin tips of its roots reach a little over the edge.
 */
const LIMB_FILL = 0.75;
/** A limb of two cells: how many cells across it is drawn, and how far behind the middle of its ground it stands. */
const LONG_SIZE = 1.35;
const LONG_BACK = 0.25;
/** What the landing site stands on, as a share of the width of the square it fell on. */
const CORE_FILL = 0.92;
/** How high fliers fly, in levels. */
const FLY_UP = 2.4;
/** How strongly a unit shows through what stands in front of it. */
const GHOST_ALPHA = 0.26;
/** The first tile set's numbers: what the board is drawn with when the manifest names no tile set. */
const ROOF_TINT = [0xb9a783, 0xd0bd96, 0xe6d3aa];
const ROOF_PROPS: Record<string, string[]> = {
  plain: ['aircon', 'dish', 'solar', 'tank', 'dome-paper', 'aircon', 'solar'],
  science: ['dish', 'mast', 'solar', 'dish', 'aircon', 'mast'],
  meat: ['tank', 'tank', 'aircon', 'solar', 'dome-paper'],
  highground: ['dome-gold', 'spire', 'dome-paper', 'dome-gold', 'spire'],
};
const STREET_PROPS = ['lamp', 'signal', 'sign', 'car'];
/** What the skin is multiplied by on the street and at one, two and three levels: the higher it lies, the lighter. */
const SKIN_LIGHT = [0xffffff, 0xb4b4b4, 0xdcdcdc, 0xffffff];

/** Two colours multiplied, as a tint is. */
function mix(a: number, b: number): number {
  const ch = (n: number, k: number) => (n >> k) & 255;
  const m = (k: number) => Math.round((ch(a, k) * ch(b, k)) / 255) << k;
  return m(16) | m(8) | m(0);
}

interface UnitView {
  sprite: Sprite; ghost: Sprite; art: UnitArt;
  heading: Heading; want: Heading; wantFor: number;
  last: Pt; phase: number; attackT: number; seen: number;
}
interface LimbView {
  sprite: Sprite; shade: Sprite; art: LimbArt; family: string;
  cooldown: number; fireT: number; fireDur: number; seen: number;
  /** The way it faces in the WORLD: when the camera turns, another side of it is seen. */
  facing: Facing;
}
interface ShotView { up0: number; ttl0: number; seen: number }

export class IsoRenderer extends Renderer {
  private geo!: IsoGeo;
  private floors = new Container();
  private creepFloor = new Container();
  private flat = new Container();
  /** What lies ON the ground as a painting from straight above (the landing site's crater and roots). */
  private decalBox = new Container();
  private coreGround: Sprite | null = null;
  /** Which building every cell belongs to: the roofs of one height that touch, in one district. */
  private buildings: Int32Array = new Int32Array(0);
  private groundBox = new Container();
  private groundG = new Graphics();
  /** The shade a wall throws on the street at its foot: what makes a street read as a channel. */
  private shadeBox = new Container();
  private shadeG = new Graphics();
  /** How many quarter turns the camera has turned (Q and E). */
  private turned: Turn = 0;
  /** The world point to keep in the middle of the screen through a turn. */
  private keep: Pt | null = null;
  /** The square the landing site fell on: its middle, and how many cells across it is. */
  private square: { x: number; y: number; across: number } | null = null;
  private coreShade: Sprite | null = null;
  private sorted = new Container();
  private ghosts = new Container();
  private aimBox = new Container();
  private aimG = new Graphics();
  private marksBox = new Container();
  private marksG = new Graphics();

  private mapRef: unknown = null;
  private mapSig = '';
  private blockSprites: Sprite[] = [];
  private props = new Map<number, Sprite>();
  private creepState = new Uint16Array(0);
  private creepSprites = new Map<number, Sprite[]>();
  private units = new Map<number, UnitView>();
  private limbs = new Map<number, LimbView>();
  private nodes = new Map<number, Sprite>();
  private shots = new Map<number, ShotView>();
  private core: Sprite | null = null;
  /** A soft dark pool: what stands on the ground darkens it where it stands. */
  private shadeTex: Texture | null = null;
  private frameNo = 0;
  private lastSimTime = 0;
  private simClock = 0;

  /** The player's own zoom and pan, on top of the framing of the claimed districts. */
  private zoom = 1;
  private pan: Pt = { x: 0, y: 0 };
  /** The scale that frames the claimed districts, and the middle of them on the board. */
  private fit = 1;
  private mid: Pt = { x: 0, y: 0 };

  constructor(private art: BoardArtSet) {
    super();
  }

  async init(mount: HTMLElement, _worldW: number, _worldH: number): Promise<void> {
    this.app = new Application();
    await this.app.init({ width: 1360, height: 1000, background: 0x0a0806, antialias: true });
    mount.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    this.sorted.sortableChildren = true;
    this.flat.sortableChildren = true;
    this.evolvedRing = false;
    this.shadeBox.addChild(this.shadeG);
    this.groundBox.addChild(this.groundG);
    this.aimBox.addChild(this.aimG);
    this.marksBox.addChild(this.marksG);
    this.marksBox.scale.set(K);
    this.world.addChild(this.floors, this.creepFloor, this.decalBox, this.flat, this.shadeBox, this.groundBox, this.sorted, this.ghosts, this.aimBox, this.marksBox);
    this.ready = true;
  }

  // ------------------------------------------------------------ geometry

  private setGeo(sim: Sim): void {
    const t = this.art.terrain!;
    this.geo = isoGeo(t.tile, t.level, sim.cfg.cellPx, this.turned, sim.cfg.gridW, sim.cfg.gridH);
    const g = this.geo;
    // World coordinates laid on the ground, as the turned camera sees it: what the old
    // drawing code draws is drawn flat on the street.
    const o = project(g, 0, 0);
    const x = project(g, 1, 0);
    const y = project(g, 0, 1);
    const ground = new Matrix(x.x - o.x, x.y - o.y, y.x - o.x, y.y - o.y, o.x, o.y);
    this.groundBox.setFromMatrix(ground);
    this.aimBox.setFromMatrix(ground);
    this.decalBox.setFromMatrix(ground);
    // The view's own cells laid on the ground: a cell is one unit each way.
    this.shadeBox.setFromMatrix(new Matrix(g.a, g.b, -g.a, g.b, 0, 0));
  }

  /** How many quarter turns the camera has turned. */
  turn(): number {
    return this.turned;
  }

  /**
   * Turn the camera by quarter turns (E: one way, Q: the other). What is in the middle of
   * the screen stays there; everything standing on the board is drawn again from its new side.
   */
  turnBy(quarters: number): void {
    const sim = this.simRef;
    if (!sim || !this.ready) return;
    const mid = { x: (this.app.renderer.width / 2 - this.camX) / this.camScale, y: (this.app.renderer.height / 2 - this.camY) / this.camScale };
    this.keep = unproject(this.geo, mid.x, mid.y);
    this.turned = ((((this.turned + Math.round(quarters)) % 4) + 4) % 4) as Turn;
    this.setGeo(sim);
    this.mapSig = '';
    this.camInit = false;
  }

  private heightOf(sim: Sim, cell: number): number {
    return sim.map.cells[cell] === CellType.Block ? (sim.map.heights[cell] || 1) : 0;
  }

  private heightAt(sim: Sim, wx: number, wy: number): number {
    const c = sim.cfg.cellPx;
    if (wx < 0 || wy < 0 || wx >= sim.cfg.gridW * c || wy >= sim.cfg.gridH * c) return 0;
    return this.heightOf(sim, sim.cellAt(wx, wy));
  }

  /** A world point on the screen, standing on whatever is under it. */
  private onGround(sim: Sim, wx: number, wy: number): Pt {
    return project(this.geo, wx, wy, this.heightAt(sim, wx, wy));
  }

  private simRef: Sim | null = null;

  protected updateCamera(sim: Sim, dtReal: number): void {
    const g = this.geo;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let slot = 0; slot < sim.map.slots.length; slot++) {
      if (!sim.map.slots[slot]) continue;
      const x0 = (slot % sim.map.slotsX) * PLATE * g.cell;
      const y0 = Math.floor(slot / sim.map.slotsX) * PLATE * g.cell;
      const side = PLATE * g.cell;
      for (const [x, y] of [[x0, y0], [x0 + side, y0], [x0, y0 + side], [x0 + side, y0 + side]]) {
        const p = project(g, x, y);
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    }
    // Room above for the tallest blocks and what stands on them, and a margin all round.
    minY -= 3 * g.level + 2 * g.a;
    const m = 1.5 * g.a;
    minX -= m; maxX += m; minY -= m; maxY += m;
    const vw = this.app.renderer.width;
    const vh = this.app.renderer.height;
    this.fit = Math.min(vw / (maxX - minX), vh / (maxY - minY), 1.1);
    this.mid = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    if (this.keep) {
      // After a turn: the place that was in the middle of the screen is in the middle of it still.
      const p = project(g, this.keep.x, this.keep.y);
      this.pan = { x: p.x - this.mid.x, y: p.y - this.mid.y };
      this.keep = null;
    }
    const scale = this.fit * this.zoom;
    const tx = vw / 2 - (this.mid.x + this.pan.x) * scale;
    const ty = vh / 2 - (this.mid.y + this.pan.y) * scale;
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

  /** Zoom in or out, keeping the point under the pointer where it is. */
  zoomAt(clientX: number, clientY: number, factor: number): void {
    const rect = this.app.canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * this.app.renderer.width;
    const py = ((clientY - rect.top) / rect.height) * this.app.renderer.height;
    const at = { x: (px - this.camX) / this.camScale, y: (py - this.camY) / this.camScale };
    this.zoom = Math.max(0.6, Math.min(6, this.zoom * factor));
    const scale = this.fit * this.zoom;
    this.pan = {
      x: (this.app.renderer.width / 2 - px) / scale + at.x - this.mid.x,
      y: (this.app.renderer.height / 2 - py) / scale + at.y - this.mid.y,
    };
    this.camInit = false;
  }

  /** Slide the view by a distance in canvas pixels. */
  panBy(dx: number, dy: number): void {
    const scale = this.fit * this.zoom;
    this.pan = { x: this.pan.x - dx / scale, y: this.pan.y - dy / scale };
    this.camInit = false;
  }

  /** Back to the framing of the claimed districts. */
  resetView(): void {
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
  }

  /** What of the baked art could not be loaded. */
  missing(): string[] {
    return this.art.failed.slice();
  }

  /** The tile set the city is drawn with. */
  biome(): string {
    return this.art.biome?.id ?? '';
  }

  /** Client (CSS) coordinates to the board's own pixels (before the camera). */
  private toBoard(clientX: number, clientY: number): Pt {
    const rect = this.app.canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * this.app.renderer.width;
    const py = ((clientY - rect.top) / rect.height) * this.app.renderer.height;
    return { x: (px - this.camX) / this.camScale, y: (py - this.camY) / this.camScale };
  }

  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const sim = this.simRef;
    const s = this.toBoard(clientX, clientY);
    if (!sim) return unproject(this.geo, s.x, s.y);
    const hit = pick(this.geo, s.x, s.y, (x, y) => this.heightAt(sim, x, y), 5);
    const under = sim.cellAt(hit.x, hit.y);
    if (hit.top && sim.towers.some((t) => sim.cellsOf(t).includes(under))) return { x: hit.x, y: hit.y };
    // A limb is taller than its cell: a click on its body is a click on the limb.
    let best: Tower | null = null;
    for (const t of sim.towers) {
      const v = this.limbs.get(t.id);
      if (!v || v.art.flat) continue;
      const p = this.onGround(sim, t.pos.x, t.pos.y);
      // Its body rises from the middle of what it stands on: as wide as that, and most of a frame high.
      const w = (2 * this.geo.a * LIMB_FILL * this.sizeOf(sim, t)) / Math.SQRT2;
      const h = v.art.frame * v.sprite.scale.y * 0.7;
      if (Math.abs(s.x - p.x) < w * 0.5 && s.y < p.y + w * 0.2 && s.y > p.y - h) {
        if (!best || depth(this.geo, t.pos.x, t.pos.y) > depth(this.geo, best.pos.x, best.pos.y)) best = t;
      }
    }
    if (best) return { x: best.pos.x, y: best.pos.y };
    return { x: hit.x, y: hit.y };
  }

  worldToScreen(x: number, y: number): { x: number; y: number; vw: number; vh: number } {
    const p = this.simRef ? this.onGround(this.simRef, x, y) : project(this.geo, x, y);
    return {
      x: p.x * this.camScale + this.camX, y: p.y * this.camScale + this.camY,
      vw: this.app.renderer.width, vh: this.app.renderer.height,
    };
  }

  // ------------------------------------------------------------ the frame

  draw(sim: Sim, dtReal: number): void {
    if (!this.ready || !this.art.terrain) return;
    if (this.mapRef !== sim.map) this.reset(sim);
    this.simRef = sim;
    this.pulse += dtReal * 3;
    this.frameNo += 1;
    // Everything that moves follows the sim's clock: a paused game stands still.
    const dt = Math.max(0, Math.min(1, sim.time - this.lastSimTime));
    this.lastSimTime = sim.time;
    this.simClock += dt;

    this.updateCamera(sim, dtReal);
    this.syncMap(sim);
    this.syncCreep(sim);
    this.groundG.clear();
    this.aimG.clear();
    this.marksG.clear();
    this.drawGates(this.groundG, sim);
    this.drawGroundFx(this.groundG, sim);
    this.syncCore(sim);
    this.syncNodes(sim);
    this.syncLimbs(sim, dt);
    this.syncUnits(sim, dt);
    this.drawShots(this.marksG, sim);
    this.drawAim(this.aimG, sim);
  }

  private reset(sim: Sim): void {
    this.mapRef = sim.map;
    this.mapSig = '';
    this.setGeo(sim);
    for (const c of [this.floors, this.creepFloor, this.flat, this.sorted, this.ghosts]) c.removeChildren().forEach((x) => x.destroy());
    this.blockSprites = [];
    this.props.clear();
    this.creepSprites.clear();
    this.creepState = new Uint16Array(sim.map.cells.length);
    this.units.clear();
    this.limbs.clear();
    this.nodes.clear();
    this.shots.clear();
    this.core = null;
    this.coreShade = null;
    this.decalBox.removeChildren().forEach((x) => x.destroy());
    this.coreGround = null;
    this.square = this.squareOf(sim);
    this.camInit = false;
    this.lastSimTime = sim.time;
  }

  /**
   * The open square the landing site fell on: the square of open ground round the core's
   * cell. The core is drawn in the MIDDLE of it and as wide as it, so that it lies on the
   * square and not over the roofs round it.
   */
  private squareOf(sim: Sim): { x: number; y: number; across: number } {
    const W = sim.cfg.gridW;
    const H = sim.cfg.gridH;
    const open = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && sim.map.cells[y * W + x] === CellType.Plaza;
    const cx = sim.map.coreCell % W;
    const cy = Math.floor(sim.map.coreCell / W);
    let x0 = cx, x1 = cx, y0 = cy, y1 = cy;
    if (open(cx, cy)) {
      while (open(x0 - 1, cy)) x0--;
      while (open(x1 + 1, cy)) x1++;
      while (open(cx, y0 - 1)) y0--;
      while (open(cx, y1 + 1)) y1++;
    }
    const c = sim.cfg.cellPx;
    return { x: ((x0 + x1 + 1) / 2) * c, y: ((y0 + y1 + 1) / 2) * c, across: Math.max(2, Math.min(x1 - x0 + 1, y1 - y0 + 1)) };
  }

  // ------------------------------------------------------------ the city

  /** The top-left corner of the tile of a cell OF THE VIEW on the screen, `up` levels above the ground. */
  private tileAt(vx: number, vy: number, up = 0): Pt {
    const g = this.geo;
    return { x: (vx - vy) * g.a - g.a, y: (vx + vy) * g.b - up * g.level };
  }

  /** The same, of a cell of the board. */
  private tileOf(sim: Sim, cell: number, up = 0): Pt {
    const v = viewCell(this.geo, cell % sim.cfg.gridW, Math.floor(cell / sim.cfg.gridW));
    return this.tileAt(v.x, v.y, up);
  }

  /**
   * How many cells across a limb is drawn. A big limb is drawn as big as its ground. A LONG
   * limb (two cells, one behind the other) is a mound with a long thing lying forward from
   * it: it is drawn a third bigger, standing a quarter of a cell behind the middle of its
   * ground, so that the mound fills its back cell and what lies forward lies over its front one.
   */
  private sizeOf(sim: Sim, t: Tower): number {
    const n = sim.cellsOf(t).length;
    if (n === 2) return LONG_SIZE;
    return n > 1 ? Math.sqrt(n) : 1;
  }

  private add(layer: Container, tex: Texture | null, x: number, y: number, z = 0): Sprite | null {
    if (!tex) return null;
    const s = new Sprite(tex);
    s.position.set(x, y);
    s.zIndex = z;
    layer.addChild(s);
    return s;
  }

  /**
   * Streets, squares, smoke over the unclaimed city, and the blocks. Built again when a
   * district is claimed and when the camera turns. It is built cell by cell OF THE VIEW: the
   * two faces of a block that are seen are the ones toward the camera, whichever those are.
   */
  private syncMap(sim: Sim): void {
    const sig = `${this.turned}:${sim.plinthsPlaced}:${sim.map.slots.map((s) => (s ? '1' : '0')).join('')}`;
    if (sig === this.mapSig) return;
    this.mapSig = sig;
    this.floors.removeChildren().forEach((x) => x.destroy());
    for (const s of this.blockSprites) s.destroy();
    this.blockSprites = [];
    for (const s of this.props.values()) s.destroy();
    this.props.clear();
    const g = this.geo;
    const W = sim.cfg.gridW;
    const size = viewSize(g);
    const span = this.art.terrain!.wallSpan;
    const hV = (vx: number, vy: number) => this.heightV(sim, vx, vy);
    this.buildings = buildingsOf(sim.map.cells, sim.map.heights, sim.map.w, sim.map.h, CellType.Block, PLATE);
    for (let vy = 0; vy < size.h; vy++) for (let vx = 0; vx < size.w; vx++) {
      const b = boardCell(g, vx, vy);
      const cell = b.y * W + b.x;
      const type = sim.map.cells[cell];
      const p = this.tileAt(vx, vy);
      const ij = `${vx % 4}${vy % 4}`;
      const slot = Math.floor(b.y / PLATE) * sim.map.slotsX + Math.floor(b.x / PLATE);
      // Every district is drawn with one tile set: the board's own, or one of its guests.
      const set = this.setOfSlot(sim, slot);
      if (type !== CellType.Block) {
        const name = type === CellType.Void ? 'smoke' : type === CellType.Plaza ? 'plaza' : 'street';
        const floor = type === CellType.Void ? name : variantName(name, pickVariant(this.art.variantsOf(set, name), slot * 31 + 7));
        this.add(this.floors, this.art.sprite('floors', `${floor}-${ij}`, set) ?? this.art.sprite('floors', `${name}-${ij}`, set), p.x, p.y);
        if (type !== CellType.Void) this.addStreetProp(sim, cell, vx, vy, type === CellType.Plaza, hV(vx, vy - 1) > 0, hV(vx - 1, vy) > 0, set);
        continue;
      }
      const h = hV(vx, vy);
      const z = (vx + vy + 1) * 100;
      const kind = sim.map.slots[slot]?.feature ?? 'plain';
      // Every BUILDING (the roofs of one height that touch, in one district) has one facade and one roof of its set's.
      const building = this.buildings[cell];
      const wall = variantName(kind, pickVariant(this.art.variantsOf(set, `wall-${kind}`), building * 17 + 3));
      const roofName = variantName('roof', pickVariant(this.art.variantsOf(set, 'roof'), building * 29 + 11));
      // How many of its levels, from the top, the body has raised on plinths: those are the body's own making.
      const raised = sim.map.plinths[cell];
      const face = (side: 'south' | 'east', l: number): Texture | null => {
        const i = wallIndex(side, vx, vy, span);
        if (l >= h - raised) return this.art.sprite('creep', `wall-plinth-${side}-${l % 3}-${i}`);
        return this.art.sprite('walls', `wall-${wall}-${side}-${l}-${i}`, set) ?? this.art.sprite('walls', `wall-${kind}-${side}-${l}-${i}`, set);
      };
      // The face on the left of the screen (toward +view y) and the one on the right (toward +view x).
      for (let l = hV(vx, vy + 1); l < h; l++) {
        const s = this.add(this.sorted, face('south', l), p.x, p.y + g.b - (l + 1) * g.level, z);
        if (s) this.blockSprites.push(s);
      }
      for (let l = hV(vx + 1, vy); l < h; l++) {
        const s = this.add(this.sorted, face('east', l), p.x + g.a, p.y + g.b - (l + 1) * g.level, z);
        if (s) this.blockSprites.push(s);
      }
      const roof = this.add(this.sorted, this.art.sprite('floors', `${roofName}-${ij}`, set) ?? this.art.sprite('floors', `roof-${ij}`, set), p.x, p.y - h * g.level, z + 1);
      if (roof) {
        // Higher roofs catch more light: height reads at a glance.
        const tints = this.art.biomeArt(set)?.roofTint ?? ROOF_TINT;
        roof.tint = tints[Math.min(h, tints.length) - 1] ?? 0xffffff;
        this.blockSprites.push(roof);
      }
      // A roof at the foot of a taller block lies in its shade (over the skin too: the skin is drawn at z + 2).
      if (hV(vx, vy - 1) > h) { const e = this.add(this.sorted, this.art.sprite('creep', 'edge-shade-north'), p.x, p.y - h * g.level, z + 4); if (e) this.blockSprites.push(e); }
      if (hV(vx - 1, vy) > h) { const e = this.add(this.sorted, this.art.sprite('creep', 'edge-shade-west'), p.x, p.y - h * g.level, z + 4); if (e) this.blockSprites.push(e); }
      this.addProp(sim, b.x, b.y, h, kind, z, set);
    }
    this.drawShade(sim);
    // Everything standing on the map is placed again over the new ground.
    this.creepState.fill(0);
    for (const list of this.creepSprites.values()) for (const s of list) s.destroy();
    this.creepSprites.clear();
  }

  /**
   * The tile set a district is drawn with: the board's own, or one of the sets that are its
   * guests (tools/art/biomes.mjs). The district the body fell in is always the board's own,
   * and two districts in three are: a board is one place, with other places at its edges.
   */
  private setOfSlot(sim: Sim, slot: number): string | null {
    const home = this.art.biome?.id ?? null;
    if (!home) return null;
    const guests = this.art.guests();
    const start = Math.floor(Math.floor(sim.map.coreCell / sim.cfg.gridW) / PLATE) * sim.map.slotsX + Math.floor((sim.map.coreCell % sim.cfg.gridW) / PLATE);
    if (!guests.length || slot === start) return home;
    const r = (Math.imul(slot + 1, 2654435761) ^ Math.imul(sim.cfg.seed | 0, 40503)) >>> 0;
    if (r % 3 !== 0) return home;
    return guests[(r >>> 8) % guests.length];
  }

  /** The height in levels of a cell of the view (0: a street, a square, or off the board). */
  private heightV(sim: Sim, vx: number, vy: number): number {
    const size = viewSize(this.geo);
    if (vx < 0 || vy < 0 || vx >= size.w || vy >= size.h) return 0;
    const b = boardCell(this.geo, vx, vy);
    return this.heightOf(sim, b.y * sim.cfg.gridW + b.x);
  }

  /** Streets are channels between blocks: the walls shade the street at their feet. Drawn in cells of the view. */
  private drawShade(sim: Sim): void {
    const g = this.shadeG;
    g.clear();
    const size = viewSize(this.geo);
    const W = sim.cfg.gridW;
    for (let vy = 0; vy < size.h; vy++) for (let vx = 0; vx < size.w; vx++) {
      const b = boardCell(this.geo, vx, vy);
      const t = sim.map.cells[b.y * W + b.x];
      if (t !== CellType.Road && t !== CellType.Plaza) continue;
      // The walls we see are the near faces of the blocks behind the street.
      const n = this.heightV(sim, vx, vy - 1);
      const w = this.heightV(sim, vx - 1, vy);
      for (let k = 0; k < 4; k++) {
        const d = k / 10;
        if (n) g.rect(vx, vy + d, 1, 0.1).fill({ color: 0x1a1208, alpha: (0.42 - k * 0.1) * Math.min(1, 0.6 + n * 0.2) });
        if (w) g.rect(vx + d, vy, 0.1, 1).fill({ color: 0x1a1208, alpha: (0.42 - k * 0.1) * Math.min(1, 0.6 + w * 0.2) });
      }
      // The far side of the street lies under the lip of the block in front of it.
      if (this.heightV(sim, vx, vy + 1)) g.rect(vx, vy + 1 - 0.125, 1, 0.125).fill({ color: 0x1a1208, alpha: 0.3 });
      if (this.heightV(sim, vx + 1, vy)) g.rect(vx + 1 - 0.125, vy, 0.125, 1).fill({ color: 0x1a1208, alpha: 0.3 });
    }
  }

  /** What stands on the roofs of the living city. A roof the body has taken is bare. */
  private addProp(sim: Sim, cx: number, cy: number, h: number, kind: string, z: number, set: string | null): void {
    const r = ((cx * 7919 + cy * 104729 + cx * cy * 31) >>> 0) % 100;
    if (r >= 22) return;
    // A roof the body has raised on a plinth is the body's: nothing of the city's stands on it.
    if (sim.map.plinths[cy * sim.cfg.gridW + cx] > 0) return;
    const sets = this.art.biomeArt(set)?.roofProps ?? ROOF_PROPS;
    const list = sets[kind] ?? sets.plain ?? [];
    if (!list.length) return;
    // Which of them: by the place, and spread over the whole list (the first pick was the remainder of a number under 22).
    const id = `prop-${list[((cx * 2246822519 + cy * 3266489917) >>> 0) % list.length]}`;
    const tex = this.art.sprite('props', id, set);
    const rect = this.art.rect('props', id, set);
    if (!tex || !rect) return;
    const s = new Sprite(tex);
    s.anchor.set(rect.anchor?.[0] ?? 0.5, rect.anchor?.[1] ?? 0.94);
    const p = project(this.geo, (cx + 0.5) * this.geo.cell, (cy + 0.5) * this.geo.cell, h);
    s.position.set(p.x, p.y);
    s.zIndex = z + 5;
    this.sorted.addChild(s);
    this.props.set(cy * sim.cfg.gridW + cx, s);
  }

  /**
   * What stands in the streets of the living city: small things at the foot of the wall
   * behind the street, out of the lane; big things only on the squares. The body's skin
   * hides them, as it hides what stands on the roofs.
   */
  private addStreetProp(sim: Sim, cell: number, vx: number, vy: number, square: boolean, wallBehind: boolean, wallBeside: boolean, set: string | null): void {
    const cx = cell % sim.cfg.gridW;
    const cy = Math.floor(cell / sim.cfg.gridW);
    const r = ((cx * 15485863 + cy * 32452843 + cx * cy * 131) >>> 0) % 1000;
    if (square ? r >= 90 : r >= 110 || !(wallBehind || wallBeside)) return;
    const all = this.art.biomeArt(set)?.streetProps ?? STREET_PROPS;
    const fits = all.filter((id) => {
      const rect = this.art.rect('props', `prop-${id}`, set);
      return rect !== null && (square || rect.w <= this.geo.a * 0.62);
    });
    if (!fits.length) return;
    const id = `prop-${fits[(r * 7 + cx + cy) % fits.length]}`;
    const tex = this.art.sprite('props', id, set);
    const rect = this.art.rect('props', id, set);
    if (!tex || !rect) return;
    const s = new Sprite(tex);
    s.anchor.set(rect.anchor?.[0] ?? 0.5, rect.anchor?.[1] ?? 0.94);
    const at = square ? [0.5, 0.5] : wallBehind ? [0.5, 0.14] : [0.14, 0.5];
    const g = this.geo;
    s.position.set((vx + at[0] - vy - at[1]) * g.a, (vx + at[0] + vy + at[1]) * g.b);
    s.zIndex = (vx + vy + at[0] + at[1]) * 100 + 45;
    this.sorted.addChild(s);
    this.props.set(cell, s);
  }

  /**
   * The skin. Only the cells that changed since the last frame are drawn again.
   *
   * It runs to the edge of every roof it holds, and down the wall. It stops at a ragged edge
   * only where the same surface goes on bare. The cells a limb stands on, and the ground
   * under the landing site, are whole and thick: what stands on the skin stands on all of it.
   */
  private syncCreep(sim: Sim): void {
    const W = sim.cfg.gridW;
    const H = sim.cfg.gridH;
    const n = W * H;
    const on = new Uint8Array(n);
    for (let c = 0; c < n; c++) on[c] = sim.map.cells[c] !== CellType.Void && sim.isCreeped(c) ? 1 : 0;
    const held = new Uint8Array(n);
    for (const t of sim.towers) for (const c of sim.cellsOf(t)) held[c] = 1;
    const g = this.geo;
    const size = viewSize(g);
    for (let vy = 0; vy < size.h; vy++) for (let vx = 0; vx < size.w; vx++) {
      const b = boardCell(g, vx, vy);
      const cell = b.y * W + b.x;
      let state = 0;
      if (on[cell]) {
        const h = this.heightOf(sim, cell);
        const open = held[cell] ? 0 : openSides((dx, dy) => {
          const x = vx + dx, y = vy + dy;
          if (x < 0 || y < 0 || x >= size.w || y >= size.h) return true;
          const o = boardCell(g, x, y);
          const oc = o.y * W + o.x;
          return creepRunsOn({ height: h }, { height: this.heightOf(sim, oc), creeped: on[oc] === 1 });
        });
        const fx = sim.creepEffectAt(cell);
        state = 1 + open + (fx.slow < 1 ? 32 : 0) + (fx.dps > 0 ? 64 : 0) + (sim.isBody(cell) ? 128 : 0)
          + (h === 0 && held[cell] ? 256 : 0) + (sim.map.plinths[cell] > 0 ? 512 : 0);
      }
      if (state === this.creepState[cell]) continue;
      this.creepState[cell] = state;
      for (const s of this.creepSprites.get(cell) ?? []) s.destroy();
      this.creepSprites.delete(cell);
      const prop = this.props.get(cell);
      if (prop) prop.visible = state === 0;
      if (!state) continue;
      const h = this.heightOf(sim, cell);
      const open = (state - 1) & 15;
      const m = open === 0 ? 4 : 2;
      const p = this.tileAt(vx, vy, h);
      const made: Sprite[] = [];
      // What the skin does to what walks on it, and how high it lies: the higher, the lighter.
      const tint = mix(state & 64 ? 0xffd890 : state & 32 ? 0x9fd8a8 : state & 128 ? 0xd8c0c0 : 0xffffff, SKIN_LIGHT[Math.min(h, SKIN_LIGHT.length - 1)]);
      const z = (vx + vy + 1) * 100;
      const skin = this.add(h ? this.sorted : this.creepFloor, this.art.sprite('creep', `creep-${open}-${vx % m}${vy % m}`), p.x, p.y, z + 2);
      if (skin) {
        // Streets stay readable under the creep: a thin film there, thick hide on the roofs
        // and under whatever of the body stands in the street.
        skin.alpha = h ? 1 : state & 256 ? 0.92 : 0.34;
        skin.tint = tint;
        made.push(skin);
      }
      if (h) {
        // Where the roof ends the skin rolls over its edge, lit, and runs down the wall. Not down a
        // plinth: a plinth is bone, and is seen to be what holds the limb up.
        const bone = sim.map.plinths[cell] > 0;
        if (this.heightV(sim, vx, vy + 1) < h) {
          const d = bone ? null : this.add(this.sorted, this.art.sprite('creep', `drip-south-${vx % 4}`), p.x, p.y + g.b, z + 3);
          if (d) { d.tint = tint; made.push(d); }
          const lip = this.add(this.sorted, this.art.sprite('creep', 'edge-lip-south'), p.x, p.y, z + 3);
          if (lip) made.push(lip);
        }
        if (this.heightV(sim, vx + 1, vy) < h) {
          const d = bone ? null : this.add(this.sorted, this.art.sprite('creep', `drip-east-${3 - (vy % 4)}`), p.x + g.a, p.y + g.b, z + 3);
          if (d) { d.tint = tint; made.push(d); }
          const lip = this.add(this.sorted, this.art.sprite('creep', 'edge-lip-east'), p.x, p.y, z + 3);
          if (lip) made.push(lip);
        }
      }
      this.creepSprites.set(cell, made);
    }
  }

  private frameOf(atlas: { frame(i: number, size: number, cols: number): Texture }, art: { frame: number; cols: number }, clip: Clip, at: number): Texture {
    const i = clip.start + (((Math.floor(at) % clip.count) + clip.count) % clip.count);
    return atlas.frame(i, art.frame, art.cols);
  }

  /**
   * The landing site, in two parts (tools/art/templates/core.mjs). What lies on the ground
   * (the crater and its roots) is a painting from straight above, laid on the ground by the
   * same matrix that lays everything else there: it cannot float, blocks stand on it, and it
   * turns with the camera. What stands up (the meteor and the heart in it) is a sprite like a
   * limb's, standing where its footing is marked. Both in the middle of the square it fell on.
   */
  private syncCore(sim: Sim): void {
    const c = this.art.core;
    if (!c) {
      // No picture of the landing site: the old heart, laid on the ground.
      const r = 24 + Math.sin(this.pulse * 1.6) * 3;
      this.groundG.circle(sim.core.x, sim.core.y, r + 8).fill({ color: 0x571812, alpha: 0.6 });
      this.groundG.circle(sim.core.x, sim.core.y, r).fill(0x9c3120);
      return;
    }
    const sq = this.square ?? { x: sim.core.x, y: sim.core.y, across: 3 };
    if (!this.core) {
      if (this.art.coreGround && c.art.ground) {
        this.coreGround = new Sprite(this.art.coreGround);
        this.coreGround.anchor.set(0.5, 0.5);
        this.decalBox.addChild(this.coreGround);
      }
      this.coreShade = new Sprite(this.shade());
      this.coreShade.anchor.set(0.5, 0.5);
      this.core = new Sprite(c.atlas.frame(0, c.art.frame, c.art.cols));
      // The point of the picture that stands on the middle of the square: the middle of its collar.
      this.core.anchor.set(c.art.anchor[0], c.art.anchor[1]);
      this.sorted.addChild(this.coreShade, this.core);
    }
    // The heart beats: the ground it grew swells a little with it.
    const beat = 0.5 + 0.5 * Math.sin(this.simClock * Math.PI * 2 * (c.art.fps / Math.max(1, c.art.count)));
    if (this.coreGround && c.art.ground) {
      // In world pixels: the box it is in lays it on the ground as the camera sees the ground.
      const across = c.art.ground.cells * sim.cfg.cellPx;
      this.coreGround.position.set(sq.x, sq.y);
      this.coreGround.width = across;
      this.coreGround.height = across;
      const k = Math.round(232 + 23 * beat);
      this.coreGround.tint = (255 << 16) | (k << 8) | k;
    }
    const p = project(this.geo, sq.x, sq.y);
    // A round thing `cells` wide on the ground is `cells` times the root of two half-tiles wide on the screen.
    const width = c.art.cells * Math.SQRT2 * this.geo.a * CORE_FILL;
    this.core.position.set(p.x, p.y);
    this.core.scale.set(width / ((c.art.body ?? 0.86) * c.art.frame));
    this.core.zIndex = depth(this.geo, sq.x, sq.y) * 100 + 40;
    const at = Math.floor(this.simClock * c.art.fps) % c.art.count;
    this.core.texture = c.atlas.frame(at, c.art.frame, c.art.cols);
    if (this.coreShade) {
      this.coreShade.position.set(p.x, p.y);
      this.coreShade.width = width * 1.3;
      this.coreShade.height = width * 1.3 * (this.geo.b / this.geo.a);
      this.coreShade.zIndex = this.core.zIndex - 1;
    }
  }

  // ------------------------------------------------------------ creep nodes

  private syncNodes(sim: Sim): void {
    const g = this.marksG;
    const seen = new Set<number>();
    for (const s of sim.creepSources) {
      if (s.kind !== 'node') continue;
      seen.add(s.id);
      const c = sim.cellCenter(s.cell);
      const p = this.onGround(sim, c.x, c.y);
      this.nodeSprite(sim, s, p);
      this.nodeMarks(g, sim, s, p.x / K, (p.y - 14) / K);
    }
    for (const [id, sp] of this.nodes) if (!seen.has(id)) { sp.destroy(); this.nodes.delete(id); }
  }

  private nodeSprite(sim: Sim, s: CreepSource, p: Pt): void {
    const tex = this.art.sprite('props', 'prop-pod');
    if (!tex) return;
    let sp = this.nodes.get(s.id);
    if (!sp) {
      sp = new Sprite(tex);
      sp.anchor.set(0.5, 0.9);
      this.sorted.addChild(sp);
      this.nodes.set(s.id, sp);
    }
    const st = s.strain;
    sp.position.set(p.x, p.y);
    const c = sim.cellCenter(s.cell);
    sp.zIndex = depth(this.geo, c.x, c.y) * 100 + 8;
    // Size says how far it spreads.
    const size = 0.55 + (st?.radius ?? 3) * 0.09 + Math.sin(this.pulse * 1.6 + s.id) * 0.02;
    sp.scale.set((this.geo.a * size) / tex.width);
    sp.tint = st && st.dps > 0 ? 0xffe070 : st && st.slow < 1 ? 0x80d8a0 : 0xffffff;
  }

  /** What a node says about itself: its strain, and whether it is ready to spread. */
  private nodeMarks(g: Graphics, sim: Sim, s: CreepSource, x: number, y: number): void {
    const st = s.strain;
    const r = 7 + (st?.radius ?? 3) * 1.2;
    if (!this.art.sprite('props', 'prop-pod')) {
      g.circle(x, y, r).fill(st && st.dps > 0 ? 0xd0d040 : st && st.slow < 1 ? 0x4f8a5a : 0x8aa860);
    }
    if (st && st.slow < 1) {
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + this.pulse * 0.3;
        g.circle(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4) * 0.6, 1.4).fill({ color: 0x9ae0a8, alpha: 0.9 });
      }
    }
    if (st && st.dps > 0) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 - this.pulse * 0.5;
        g.moveTo(x + Math.cos(a) * (r + 1), y + Math.sin(a) * (r + 1) * 0.6)
          .lineTo(x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6) * 0.6)
          .stroke({ width: 2, color: 0xf0a030, alpha: 0.9 });
      }
    }
    if (st && st.reach > 3) g.poly([x - 4, y - r - 3, x, y - r - 8, x + 4, y - r - 3]).fill({ color: 0xf0e0a0, alpha: 0.95 });
    if (!s.spent) {
      const mature = sim.wavesCleared >= (s.matureAt ?? 0);
      const rr = r + 8 + (mature ? Math.sin(this.pulse * 3) * 1.5 : 0);
      for (let k = 0; k < 12; k += mature ? 1 : 2) {
        const a0 = (k / 12) * Math.PI * 2;
        const a1 = ((k + 1) / 12) * Math.PI * 2;
        g.moveTo(x + Math.cos(a0) * rr, y + Math.sin(a0) * rr * 0.6).lineTo(x + Math.cos(a1) * rr, y + Math.sin(a1) * rr * 0.6)
          .stroke({ width: mature ? 2 : 1.5, color: 0xc8f090, alpha: mature ? 0.85 : 0.45 });
      }
    }
    if ((s.hp ?? 1) < (s.maxHp ?? 1)) this.hpArc(g, x, y - 4, 11, (s.hp ?? 0) / (s.maxHp ?? 1));
  }

  // ------------------------------------------------------------ limbs

  private shade(): Texture {
    if (this.shadeTex) return this.shadeTex;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 32, 4, 64, 32, 64);
    grad.addColorStop(0, 'rgba(12, 4, 6, 0.62)');
    grad.addColorStop(0.55, 'rgba(12, 4, 6, 0.3)');
    grad.addColorStop(1, 'rgba(12, 4, 6, 0)');
    g.setTransform(1, 0, 0, 0.5, 0, 0);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(64, 64, 64, 0, Math.PI * 2);
    g.fill();
    this.shadeTex = Texture.from(c);
    return this.shadeTex;
  }

  /**
   * The way a limb faces in the world. One that was turned by the player faces that way;
   * one that fights faces what it last fought; the rest face south. It is a fact about the
   * limb, not about the camera: when the camera turns, another side of the limb is seen.
   */
  private facingOfLimb(sim: Sim, t: Tower, was: Facing | undefined): Facing {
    if (t.facing) return t.facing;
    if (t.lastTargetId !== undefined) {
      const e = sim.enemies.find((x) => x.id === t.lastTargetId);
      if (e) return facingOf(e.pos.x - t.pos.x, e.pos.y - t.pos.y);
    }
    return was ?? 'S';
  }

  private syncLimbs(sim: Sim, dt: number): void {
    const g = this.geo;
    for (const t of sim.towers) {
      const h = this.heightOf(sim, t.cell);
      const p0 = project(g, t.pos.x, t.pos.y, h);
      const found = this.art.limbs.get(t.family);
      let v = this.limbs.get(t.id);
      if (v && v.family !== t.family) { v.sprite.destroy(); v.shade.destroy(); this.limbs.delete(t.id); v = undefined; }
      if (!found) {
        // No picture of this limb: its old shape, at the size of the rest.
        this.drawTowerBody(this.marksG, t, p0.x / K, (p0.y - 20) / K, sim);
        this.drawTowerMarks(this.marksG, t, p0.x / K, (p0.y - 20) / K, sim);
        continue;
      }
      const { art, atlas } = found;
      if (!v) {
        const sprite = new Sprite(atlas.frame(art.anims.idle.start, art.frame, art.cols));
        const shade = new Sprite(this.shade());
        shade.anchor.set(0.5, 0.5);
        shade.visible = !art.flat;
        (art.flat ? this.flat : this.sorted).addChild(shade, sprite);
        v = { sprite, shade, art, family: t.family, cooldown: t.cooldown, fireT: -1, fireDur: 0, seen: 0, facing: this.facingOfLimb(sim, t, undefined) };
        this.limbs.set(t.id, v);
      }
      v.seen = this.frameNo;
      v.facing = this.facingOfLimb(sim, t, v.facing);

      // Which of its pictures the camera sees: from the front or from behind, as drawn or mirrored.
      let { back, mirror } = limbView(g, v.facing);
      if (art.flat) { back = false; mirror = false; }
      // A wall across a street lies across it: along the view's x as it is drawn, along its y mirrored.
      else if (art.on === 'street') {
        back = false;
        // A wall two cells long lies the way its two cells lie; one of a single cell, across its street.
        const ground = sim.cellsOf(t);
        const alongX = ground.length === 2 ? Math.abs(ground[1] - ground[0]) === 1 : !this.laneRunsAlongX(sim, t.cell);
        mirror = !alongX !== (g.turn % 2 === 1);
      }
      const side = back && art.back ? art.back : art;

      const stats = towerStats(t);
      const size = this.sizeOf(sim, t);
      // Where it stands: the middle of its ground; a long limb, a little behind it.
      const long = sim.cellsOf(t).length === 2 && !art.flat && art.on !== 'street';
      const step = FACING_STEP[v.facing];
      const p = long
        ? project(g, t.pos.x - step[0] * g.cell * LONG_BACK, t.pos.y - step[1] * g.cell * LONG_BACK, h)
        : p0;
      // How wide what it stands on is drawn: a swamp covers the ground it slows; a wall spans its lane; the rest fill their ground.
      let width = 2 * g.a * LIMB_FILL * size;
      if (art.flat) width = 2 * ((towerSpec(t.family).swamp?.radius ?? 30) + (stats.aoe - towerSpec(t.family).aoe)) * Math.SQRT2 * (g.a / g.cell);
      else if (art.on === 'street') width = 2 * g.a * 0.8 * (sim.cellsOf(t).length === 2 ? 1.8 : 1);
      const scale = width / (side.body * art.frame);

      // A limb that has just fired plays its firing clip, fitted into the time before it fires again.
      const held = sim.isTapped(t) || (t.stunnedUntil !== undefined && t.stunnedUntil > sim.time);
      if (t.cooldown > v.cooldown + 0.05 && art.anims.fire) {
        const native = art.anims.fire.count / art.anims.fire.fps;
        v.fireDur = Math.max(0.3, Math.min(native, 0.85 * t.cooldown));
        v.fireT = 0;
      }
      v.cooldown = t.cooldown;
      const fire = side.anims.fire ?? art.anims.fire;
      let tex: Texture;
      if (v.fireT >= 0 && fire && !held) {
        v.fireT += dt;
        const f = Math.min(fire.count - 1, Math.floor((v.fireT / v.fireDur) * fire.count));
        tex = atlas.frame(fire.start + f, art.frame, art.cols);
        if (v.fireT >= v.fireDur) v.fireT = -1;
      } else {
        const at = held ? 0 : (this.simClock + t.id * 0.37) * side.anims.idle.fps * Math.max(0.6, Math.min(2.5, stats.rate > 0 ? stats.rate / Math.max(0.01, towerSpec(t.family).rate) : 1));
        tex = this.frameOf(atlas, art, side.anims.idle, at);
      }
      v.sprite.texture = tex;

      // The point of the picture that stands on the middle of its ground is the middle of what it stands on.
      v.sprite.anchor.set(side.anchor[0], side.anchor[1]);
      v.sprite.scale.set(mirror ? -scale : scale, scale);
      v.sprite.position.set(p.x, p.y);
      // It is as far back as the nearest to the camera of the cells it stands on.
      let z = -Infinity;
      for (const c of sim.cellsOf(t)) {
        const vc = viewCell(g, c % sim.cfg.gridW, Math.floor(c / sim.cfg.gridW));
        z = Math.max(z, (vc.x + vc.y + 1) * 100);
      }
      v.sprite.zIndex = art.flat ? depth(g, t.pos.x, t.pos.y) : z + (h ? 10 : 45);
      v.shade.position.set(p.x, p.y);
      v.shade.width = width * 1.5;
      v.shade.height = width * 1.5 * (g.b / g.a);
      v.shade.zIndex = v.sprite.zIndex - 1;
      v.sprite.tint = held ? 0x9a90a8 : 0xffffff;
      if (!art.flat) this.drawTowerMarks(this.marksG, t, p.x / K, (p.y - width * 0.55) / K, sim);
      else if (t.hp < t.maxHp) this.hpArc(this.marksG, p.x / K, p.y / K - 8, 20, t.hp / t.maxHp);
    }
    for (const [id, v] of this.limbs) if (v.seen !== this.frameNo) { v.sprite.destroy(); v.shade.destroy(); this.limbs.delete(id); }
  }

  /** Does the street through this cell run along world x? Then a wall across it lies along world y. */
  private laneRunsAlongX(sim: Sim, cell: number): boolean {
    const next = sim.flowNextOf(cell);
    if (next >= 0) return Math.abs((next % sim.cfg.gridW) - (cell % sim.cfg.gridW)) > 0;
    const W = sim.cfg.gridW;
    const open = (c: number) => c >= 0 && c < sim.map.cells.length && sim.map.cells[c] !== CellType.Block;
    return open(cell - 1) && open(cell + 1) && !(open(cell - W) && open(cell + W));
  }

  protected drawReach(_g: Graphics, t: Tower, reach: number): void {
    this.aimG.circle(t.pos.x, t.pos.y, reach).stroke({ width: 1.2, color: 0x9fd8ff, alpha: 0.45 });
  }

  protected drawPreviewCell(_g: Graphics, sim: Sim, cell: number, ok: boolean): void {
    const p = this.tileOf(sim, cell, this.heightOf(sim, cell));
    const g = this.geo;
    this.marksG.poly([
      (p.x + g.a) / K, p.y / K, (p.x + 2 * g.a) / K, (p.y + g.b) / K,
      (p.x + g.a) / K, (p.y + 2 * g.b) / K, p.x / K, (p.y + g.b) / K,
    ]).fill({ color: ok ? 0x76b04a : 0xb03a2a, alpha: 0.45 }).stroke({ width: 1, color: ok ? 0xc8f090 : 0xff8070, alpha: 0.9 });
  }

  /** What a limb affects, drawn limb to limb (they stand on roofs, not on the street). */
  protected drawEffectLinks(_g: Graphics, sim: Sim, t: Tower): void {
    const spec = towerSpec(t.family);
    const links = sim.effectLinks(t);
    const at = (u: Tower) => {
      const p = this.onGround(sim, u.pos.x, u.pos.y);
      return { x: p.x / K, y: (p.y - this.geo.a * 0.5) / K };
    };
    const m = this.marksG;
    const me = at(t);
    if (spec.engine) {
      const col = ({ funnel: 0xffd060, amplify: 0xff80c8, mosaic: 0x70e8c8, twin: 0xa8a0ff, tap: 0xc070a0, mitosis: 0x98e070, capacitor: 0x80c8ff, boomerang: 0xffc050, press: 0x4fd0c8, reliquary: 0xf0e8c8 } as Record<string, number>)[spec.engine.kind] ?? 0xffffff;
      if (spec.engine.gather !== undefined) {
        const s = towerStats(t);
        this.aimG.circle(t.pos.x, t.pos.y, spec.engine.gather * s.reach + (s.aoe - spec.aoe)).stroke({ width: 1, color: col, alpha: 0.4 });
      }
      for (const u of links.sources) {
        const p = at(u);
        m.moveTo(p.x, p.y).lineTo(me.x, me.y).stroke({ width: 1.5, color: col, alpha: 0.75 });
        m.circle(p.x, p.y, 17).stroke({ width: 1.2, color: col, alpha: 0.6 });
      }
      for (const u of links.targets) {
        const p = at(u);
        m.moveTo(me.x, me.y).lineTo(p.x, p.y).stroke({ width: 3.5, color: col, alpha: 0.9 });
        m.circle(p.x, p.y, 22 + Math.sin(this.pulse * 3) * 2).stroke({ width: 2.5, color: col, alpha: 0.95 });
      }
      return;
    }
    if (t.family === 'choir' || t.family === 'ward') {
      const col = t.family === 'choir' ? 0xc8a0f0 : 0x9fc4ff;
      this.aimG.circle(t.pos.x, t.pos.y, sim.auraOf(t).radius).stroke({ width: 1, color: col, alpha: 0.45 });
      for (const u of links.targets) { const p = at(u); m.circle(p.x, p.y, 20).stroke({ width: 2, color: col, alpha: 0.85 }); }
    }
  }

  // ------------------------------------------------------------ units

  private syncUnits(sim: Sim, dt: number): void {
    const g = this.geo;
    for (const e of sim.enemies) {
      const spec = enemySpec(e.kind);
      const r = ENEMY_SIZE[e.kind];
      const air = sim.isAirborne(e);
      const up = air ? FLY_UP : this.heightAt(sim, e.pos.x, e.pos.y);
      const p = project(g, e.pos.x, e.pos.y, up);
      const found = this.art.units.get(e.kind);
      if (air) this.groundG.circle(e.pos.x, e.pos.y, r * 0.9).fill({ color: 0x000000, alpha: 0.28 });
      if (e.burrowed) {
        // Underground: only a travelling mound of broken street.
        this.groundG.circle(e.pos.x, e.pos.y, r + 3).fill({ color: 0x3a2c18, alpha: 0.85 });
        this.groundG.circle(e.pos.x - 2, e.pos.y - 2, r).fill({ color: 0x6b573a, alpha: 0.9 });
      }
      if (!found) {
        const col = CASTE_COLORS[spec.caste];
        this.marksG.circle(p.x / K, p.y / K - r, r + 1.5).fill({ color: 0x0d0805, alpha: 0.85 });
        this.marksG.circle(p.x / K, p.y / K - r, r).fill(col);
        this.unitMarks(sim, e, p.x / K, p.y / K - r, r);
        continue;
      }
      const { art, atlas } = found;
      let v = this.units.get(e.id);
      if (!v) {
        const sprite = new Sprite();
        const ghost = new Sprite();
        for (const s of [sprite, ghost]) s.anchor.set(art.anchor[0], art.anchor[1]);
        ghost.alpha = GHOST_ALPHA;
        this.sorted.addChild(sprite);
        this.ghosts.addChild(ghost);
        // It starts out facing the way the street leads.
        const next = sim.flowNextOf(sim.cellAt(e.pos.x, e.pos.y));
        const to = next >= 0 ? sim.cellCenter(next) : sim.core;
        const first = headingOf(g, to.x - e.pos.x, to.y - e.pos.y);
        v = { sprite, ghost, art, heading: first, want: first, wantFor: 0, last: { ...e.pos }, phase: (e.id * 0.618) % 1, attackT: 0, seen: 0 };
        this.units.set(e.id, v);
      }
      v.seen = this.frameNo;

      const dx = e.pos.x - v.last.x;
      const dy = e.pos.y - v.last.y;
      const moved = Math.hypot(dx, dy);
      v.last = { ...e.pos };
      const attacking = (e.targetId !== null && e.targetId !== undefined) || !!e.deployed;
      if (moved > 0.02) {
        // A new heading has to hold for a moment before it is taken: no flicker at a corner.
        const h = headingOf(g, dx, dy);
        if (h === v.want) v.wantFor += dt; else { v.want = h; v.wantFor = 0; }
        if (v.want !== v.heading && v.wantFor >= 0.12) v.heading = v.want;
        // The legs keep time with the ground covered, so feet do not slide.
        const clip0 = art.anims.walk[viewOf(v.heading).view];
        const loopDist = Math.max(8, spec.speed * ((clip0?.count ?? 12) / (clip0?.fps ?? 12)));
        v.phase = (v.phase + moved / loopDist) % 1;
      } else if (attacking) {
        const s = this.targetOf(sim, e);
        if (s) v.heading = headingOf(g, s.x - e.pos.x, s.y - e.pos.y);
      }
      const { view, mirror } = viewOf(v.heading);
      const walk = art.anims.walk[view] ?? art.anims.walk.SW ?? Object.values(art.anims.walk)[0]!;
      const strike = attacking ? art.anims.attack?.[view] : undefined;
      let tex: Texture;
      if (strike) {
        v.attackT += dt;
        const period = spec.rate > 0 ? 1 / spec.rate : strike.count / strike.fps;
        tex = this.frameOf(atlas, art, strike, ((v.attackT % period) / period) * strike.count);
      } else {
        v.attackT = 0;
        tex = this.frameOf(atlas, art, walk, v.phase * walk.count);
      }
      const scale = (2 * r * UNIT_PX) / (art.body * art.frame);
      const hidden = !!e.burrowed || (sim.isCloaked(e) && !sim.isRevealed(e));
      for (const s of [v.sprite, v.ghost]) {
        s.texture = tex;
        s.position.set(p.x, p.y);
        s.scale.set(mirror ? -scale : scale, scale);
        s.visible = !hidden;
      }
      v.sprite.zIndex = depth(g, e.pos.x, e.pos.y) * 100 + (air ? 400 : 50);
      v.sprite.tint = sim.isCloaked(e) ? 0xd8b0ff : 0xffffff;
      this.unitMarks(sim, e, p.x / K, (p.y - r * UNIT_PX * 0.9) / K, r);
    }
    for (const [id, v] of this.units) {
      if (v.seen !== this.frameNo) { v.sprite.destroy(); v.ghost.destroy(); this.units.delete(id); }
    }
    this.drawBroodlings(sim);
  }

  private targetOf(sim: Sim, e: Enemy): Pt | null {
    if (e.targetId === -1) return sim.core;
    if (e.targetId === null || e.targetId === undefined) return null;
    return sim.towers.find((t) => t.id === e.targetId)?.pos ?? null;
  }

  /** What is drawn ON a unit whatever it looks like: its health and what has been done to it. */
  private unitMarks(sim: Sim, e: Enemy, x: number, y: number, r: number): void {
    const g = this.marksG;
    const s = r + 3;
    if (sim.isCloaked(e)) {
      if (!sim.isRevealed(e)) {
        g.circle(x, y, s).stroke({ width: 1.2, color: 0xcfc0e8, alpha: 0.28 + 0.12 * Math.sin(this.pulse * 3 + e.id) });
        return;
      }
      g.circle(x, y, s + 3).stroke({ width: 1.5, color: 0xd8a0ff, alpha: 0.9 });
    }
    if (e.burrowed) return;
    if (e.burnUntil !== undefined && e.burnUntil > sim.time) {
      const fl = Math.abs(Math.sin(this.pulse * 7 + e.id));
      g.poly([x - 4, y - s, x, y - s - 6 - fl * 4, x + 4, y - s]).fill({ color: 0xff8a30, alpha: 0.85 });
      g.poly([x - 2, y - s, x + 1, y - s - 3 - fl * 3, x + 3, y - s]).fill({ color: 0xffe070, alpha: 0.9 });
    }
    if (e.kind === 'matron') this.groundG.circle(e.pos.x, e.pos.y, 90).stroke({ width: 1, color: 0xb890e0, alpha: 0.3 + 0.1 * Math.sin(this.pulse * 1.5) });
    if (e.kind === 'drummer') this.groundG.circle(e.pos.x, e.pos.y, r + 8 + Math.sin(this.pulse * 5) * 3).stroke({ width: 1.5, color: 0xe0a03a, alpha: 0.55 });
    if (e.kind === 'carapace' && e.hitShield !== undefined && e.hitShield > 0) {
      g.circle(x, y, s + 3).stroke({ width: 2, color: 0xe8dca0, alpha: 0.3 + 0.08 * e.hitShield });
    }
    if (e.carrying) g.circle(x, y - s - 4, 3).fill(FAMILY_COLORS[e.carrying.family]);
    if (e.extractId !== undefined && !e.carrying) {
      const prey = sim.towers.find((t) => t.id === e.extractId);
      if (prey && Math.hypot(prey.pos.x - e.pos.x, prey.pos.y - e.pos.y) < 40) {
        const p = this.onGround(sim, prey.pos.x, prey.pos.y);
        g.moveTo(x, y).lineTo(p.x / K, (p.y - this.geo.a * 0.5) / K).stroke({ width: 1.5, color: 0x4fa9a4, alpha: 0.6 + 0.3 * Math.sin(this.pulse * 6) });
      }
    }
    if (e.slowUntil !== undefined && e.slowUntil > sim.time) g.circle(x, y, s + 1).stroke({ width: 1.5, color: 0x9cc45f, alpha: 0.8 });
    if (e.poisonUntil !== undefined && e.poisonUntil > sim.time) {
      g.circle(x + 3, y - s - 3, 2).fill({ color: 0xb8cc55, alpha: 0.9 });
      g.circle(x - 3, y - s - 5, 1.5).fill({ color: 0xb8cc55, alpha: 0.7 });
    }
    if (e.hp < e.maxHp) this.hpArc(g, x, y - 4, s + 2, e.hp / e.maxHp);
  }

  private drawBroodlings(sim: Sim): void {
    const g = this.marksG;
    for (const b of sim.broodlings) {
      const p = this.onGround(sim, b.pos.x, b.pos.y);
      const x = p.x / K;
      const y = p.y / K - 3;
      g.ellipse(x, y + 3, 5, 2.5).fill({ color: 0x000000, alpha: 0.3 });
      g.circle(x, y, b.puppet ? 8 : 4.5).fill({ color: 0x0d0805, alpha: 0.8 });
      g.circle(x, y, b.puppet ? 7 : 3.5).fill(b.puppet ? 0xd4a72c : 0xc75a68);
      if (b.hp < b.maxHp) this.hpArc(g, x, y, b.puppet ? 10 : 6, b.hp / b.maxHp);
    }
  }

  // ------------------------------------------------------------ what flies

  /** How high above the ground (in board pixels) a limb on this cell shoots from. */
  private muzzle(sim: Sim, wx: number, wy: number): number {
    return this.heightAt(sim, wx, wy) * this.geo.level + this.geo.a * 0.55;
  }

  protected drawShots(g: Graphics, sim: Sim): void {
    const geo = this.geo;
    const at = (wx: number, wy: number, upPx: number): Pt => {
      const p = project(geo, wx, wy);
      return { x: p.x / K, y: (p.y - upPx) / K };
    };
    for (const p of sim.projectiles) {
      let v = this.shots.get(p.id);
      if (!v) { v = { up0: this.muzzle(sim, p.pos.x, p.pos.y), ttl0: Math.max(0.05, p.ttl), seen: 0 }; this.shots.set(p.id, v); }
      v.seen = this.frameNo;
      // It leaves the limb up on its roof and comes down to the street as it flies.
      const f = Math.min(1, 1 - p.ttl / v.ttl0);
      const up = v.up0 + (14 - v.up0) * Math.min(1, f * 2.2);
      const s = at(p.pos.x, p.pos.y, up);
      if (p.fromFamily === 'impaler') {
        const m = Math.hypot(p.vel.x, p.vel.y) || 1;
        const t = at(p.pos.x - (p.vel.x / m) * 14, p.pos.y - (p.vel.y / m) * 14, up);
        g.moveTo(t.x, t.y).lineTo(s.x, s.y).stroke({ width: 3, color: 0xf4efdd, alpha: 0.95 });
      } else {
        const col = p.fromFamily === 'tangler' ? 0x9cc45f : p.fromFamily === 'blighter' ? 0xb8cc55 : 0xf2c069;
        g.circle(s.x, s.y, p.fromFamily === 'burster' ? 5 : 3).fill(col);
      }
    }
    for (const [id, v] of this.shots) if (v.seen !== this.frameNo) this.shots.delete(id);

    for (const d of sim.drops) {
      const s = at(d.pos.x, d.pos.y, 8);
      g.rect(s.x - 3, s.y - 3, 6, 6).fill(CASTE_COLORS[d.caste]);
    }
    for (const a of sim.arcs) {
      const from = at(a.from.x, a.from.y, this.muzzle(sim, a.from.x, a.from.y));
      const to = at(a.to.x, a.to.y, this.muzzle(sim, a.to.x, a.to.y) * 0.6);
      const midX = (from.x + to.x) / 2 + Math.sin(this.pulse * 30) * 4;
      const midY = (from.y + to.y) / 2 + Math.cos(this.pulse * 27) * 4;
      g.moveTo(from.x, from.y).lineTo(midX, midY).lineTo(to.x, to.y).stroke({ width: 2, color: 0xcfeef8, alpha: Math.min(1, a.ttl * 4) });
    }
    const lobbed = (from: Pt, to: Pt, f: number, arc: number, r: number, col: number): void => {
      const a = at(from.x, from.y, this.muzzle(sim, from.x, from.y));
      const b = at(to.x, to.y, this.heightAt(sim, to.x, to.y) * geo.level + 6);
      const x = a.x + (b.x - a.x) * f;
      const y = a.y + (b.y - a.y) * f - Math.sin(f * Math.PI) * arc;
      const sh = at(from.x + (to.x - from.x) * f, from.y + (to.y - from.y) * f, 0);
      g.ellipse(sh.x, sh.y, r, r * 0.5).fill({ color: 0x000000, alpha: 0.28 });
      g.circle(x, y, r).fill(col);
    };
    for (const s of sim.shells) lobbed(s.from, s.to, 1 - s.ttl / s.flight, 22, s.stun ? 2.5 : 4.5, s.side === 'body' ? 0xd8b060 : s.stun ? 0xdff5f2 : 0x2a1a0e);
    for (const b of sim.bileFlights) lobbed(b.from, b.to, 1 - b.ttl / 0.9, 18, 6, 0xc4b83a);
    for (const c of sim.clotFlights) lobbed(c.from, c.to, 1 - c.ttl / 1.2, 20, 7, 0x9c3120);
  }
}
