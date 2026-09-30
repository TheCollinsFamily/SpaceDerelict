/**
 * THE BOARD, ALIVE (Sep 30 2026): what the board does besides standing there. Kept out of
 * isoRender.ts, which calls it at a few points.
 *
 * - CreepLife: the skin breathes (a slow pulse that runs out from the landing site), creep
 *   that has just arrived fades in, tendrils feel their way past a ragged edge, burning skin
 *   flickers. Only tints, alphas and frames change: nothing is built again.
 * - PodArt: a creep node is a picture of its look (plain, mire, burning, big, thrown) that
 *   GROWS when it is placed and plays its SPREADING when it sends out its child.
 * - GateArt: each gate where waves come in is its tile set's gateway, standing across the
 *   opening; the assault lane glows and chevrons march inward (the direction is always seen).
 * - Skyline: the unclaimed city under smoke is dim blocks of the set's own buildings, rising
 *   away from the claimed ground, with wisps of smoke drifting over it.
 * - PlinthRise: a roof raised on a plinth rises out of the block over a second.
 */
import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { CellType, PLATE } from '../sim/citymap';
import type { Sim } from '../sim/sim';
import type { CreepSource } from '../sim/types';
import type { BoardArtSet } from './art';
import { boardCell, depth, project, viewCell, viewSize, type IsoGeo, type Pt } from './iso';
import { NODE_RADIUS, NODE_REACH } from '../../content/underground';

/** Two colours multiplied, as a tint is; and a colour scaled toward black. */
const scale = (c: number, k: number): number => {
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * k)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** A steady pseudo-random number in 0..1 from a whole number. */
const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ---------------------------------------------------------------- the skin

interface Skin {
  sprites: Sprite[];
  tints: number[];
  alphas: number[];
  /** When it arrived (renderer clock), or -1 when it was there before the board was built. */
  born: number;
  /** How far from the landing site, in cells: the pulse runs out from it. */
  dist: number;
  burning: boolean;
  tendrils: Array<{ sprite: Sprite; side: number; phase: number }>;
}

/** How long new creep takes to fade in, seconds; how long one beat of the pulse lasts. */
const ARRIVE = 0.9;
const BEAT = 2.8;
/** How far the skin darkens at the low of a beat. */
const DEPTH = 0.09;

export class CreepLife {
  private cells = new Map<number, Skin>();
  /** Cells that have ever held creep on this board: creep drawn again (a turn, a claim) does not fade in again. */
  private seen = new Uint8Array(0);
  private clock = 0;
  private tendrilTex = new Map<string, Texture | null>();

  constructor(private art: BoardArtSet) {}

  reset(n: number): void {
    this.cells.clear();
    this.seen = new Uint8Array(n);
  }

  /** All the skin is being drawn again (the map was rebuilt): it keeps its place in time. */
  clear(): void {
    for (const skin of this.cells.values()) for (const t of skin.tendrils) t.sprite.destroy();
    this.cells.clear();
  }

  private tendril(side: number, f: number): Texture | null {
    const key = `${side}-${f}`;
    if (!this.tendrilTex.has(key)) this.tendrilTex.set(key, this.art.sprite('creep', `tendril-${key}`));
    return this.tendrilTex.get(key)!;
  }

  /** How many frames the tendrils have (0: the art has none). */
  tendrilFrames(): number {
    let n = 0;
    while (this.tendril(1, n)) n++;
    return n;
  }

  /**
   * The skin of a cell was drawn: its sprites (each with the tint and alpha it rests at), how
   * far it lies from the landing site, and its open sides (tendrils reach out over those).
   */
  add(cell: number, sprites: Sprite[], opts: { dist: number; burning: boolean; open: number; layer: Container | null; at: Pt; z: number }): void {
    const fresh = this.seen[cell] === 0 && this.clock > 0.5;
    this.seen[cell] = 1;
    const skin: Skin = {
      sprites, tints: sprites.map((s) => s.tint as number), alphas: sprites.map((s) => s.alpha),
      born: fresh ? this.clock : -1, dist: opts.dist, burning: opts.burning, tendrils: [],
    };
    if (opts.open && opts.layer) {
      for (const side of [1, 2, 4, 8]) {
        if (!(opts.open & side)) continue;
        const tex = this.tendril(side, 0);
        if (!tex) break;
        const s = new Sprite(tex);
        s.position.set(opts.at.x, opts.at.y);
        s.zIndex = opts.z;
        s.tint = skin.tints[0] ?? 0xffffff;
        s.alpha = skin.alphas[0] ?? 1;
        opts.layer.addChild(s);
        skin.tendrils.push({ sprite: s, side, phase: hash(cell * 4 + side) });
      }
    }
    this.cells.set(cell, skin);
  }

  /** The skin of a cell was taken away (its sprites are destroyed by the caller; its tendrils here). */
  remove(cell: number): void {
    const skin = this.cells.get(cell);
    if (!skin) return;
    for (const t of skin.tendrils) t.sprite.destroy();
    this.cells.delete(cell);
  }

  /** Every frame: the beat, what arrives, the tendrils. `dt` real seconds (the skin lives while the game is paused). */
  update(dt: number): void {
    this.clock += dt;
    const frames = this.tendrilFrames();
    for (const skin of this.cells.values()) {
      const arrive = skin.born < 0 ? 1 : Math.min(1, (this.clock - skin.born) / ARRIVE);
      const eased = arrive * arrive * (3 - 2 * arrive);
      // The beat runs outward from the landing site: a wave, not the whole board at once.
      const wave = 0.5 + 0.5 * Math.sin(((this.clock / BEAT) - skin.dist * 0.07) * Math.PI * 2);
      let k = 1 - DEPTH * wave;
      // Burning skin flickers, faster and uneven.
      if (skin.burning) k *= 0.86 + 0.14 * (0.5 + 0.5 * Math.sin(this.clock * 9.3 + skin.dist * 1.7) * Math.sin(this.clock * 5.1 + skin.dist));
      for (let i = 0; i < skin.sprites.length; i++) {
        const s = skin.sprites[i];
        if (s.destroyed) continue;
        s.tint = scale(skin.tints[i], k);
        if (skin.born >= 0) s.alpha = skin.alphas[i] * eased;
      }
      if (frames) {
        for (const t of skin.tendrils) {
          // Slowly, each at its own time; a cell just reached is reached by long tendrils first.
          const f = Math.floor(((this.clock * 0.9 + t.phase * frames) % frames + frames) % frames);
          const tex = this.tendril(t.side, f);
          if (tex && t.sprite.texture !== tex) t.sprite.texture = tex;
          t.sprite.tint = scale(skin.tints[0] ?? 0xffffff, k);
          t.sprite.alpha = (skin.alphas[0] ?? 1) * eased;
        }
      }
    }
  }

  /** How many cells of skin are alive, and how many tendrils (for the beats). */
  count(): { cells: number; tendrils: number; arriving: number } {
    let tendrils = 0;
    let arriving = 0;
    for (const s of this.cells.values()) {
      tendrils += s.tendrils.length;
      if (s.born >= 0 && this.clock - s.born < ARRIVE) arriving++;
    }
    return { cells: this.cells.size, tendrils, arriving };
  }
}

// ---------------------------------------------------------------- the pods

export type PodLook = 'plain' | 'mire' | 'burning' | 'big' | 'thrown';

/** Which look a node's strain has: what it does to what walks on it first, then how far it reaches. */
export function podLook(s: CreepSource): PodLook {
  const st = s.strain;
  if (!st) return 'plain';
  if (st.dps > 0) return 'burning';
  if (st.slow < 1) return 'mire';
  if (st.reach > NODE_REACH) return 'thrown';
  if (st.radius > NODE_RADIUS) return 'big';
  return 'plain';
}

interface PodView { sprite: Sprite; look: PodLook; t: number; spreadT: number; spent: boolean }

export class PodArt {
  private views = new Map<number, PodView>();
  constructor(private art: BoardArtSet) {}

  has(): boolean {
    return !!this.art.pods;
  }

  reset(): void {
    this.views.clear();
  }

  /**
   * One node: its picture at its place, growing when it is new, puffing its spores when it
   * spreads its child. `p`: where it stands on the screen. Returns its sprite.
   */
  sync(layer: Container, geo: IsoGeo, sim: Sim, s: CreepSource, p: Pt, dt: number, fresh: boolean): Sprite | null {
    const pods = this.art.pods;
    if (!pods) return null;
    const look = podLook(s);
    const clips = pods.art.looks[look] ?? pods.art.looks.plain;
    if (!clips) return null;
    let v = this.views.get(s.id);
    if (!v) {
      const sprite = new Sprite(pods.atlas.frame(clips.grow.start + clips.grow.count - 1, pods.art.frame, pods.art.cols));
      sprite.anchor.set(clips.anchor[0], clips.anchor[1]);
      layer.addChild(sprite);
      v = { sprite, look, t: fresh ? 0 : 99, spreadT: -1, spent: !!s.spent };
      this.views.set(s.id, v);
    }
    v.look = look;
    if (s.spent && !v.spent) v.spreadT = 0;
    v.spent = !!s.spent;
    v.t += dt;
    let frame: number;
    const growFor = clips.grow.count / clips.grow.fps;
    if (v.t < growFor) {
      frame = clips.grow.start + Math.min(clips.grow.count - 1, Math.floor(v.t * clips.grow.fps));
    } else if (v.spreadT >= 0) {
      v.spreadT += dt;
      const f = Math.floor(v.spreadT * clips.spread.fps);
      if (f >= clips.spread.count) { v.spreadT = -1; frame = clips.grow.start + clips.grow.count - 1; }
      else frame = clips.spread.start + f;
    } else {
      frame = clips.grow.start + clips.grow.count - 1;
    }
    v.sprite.texture = pods.atlas.frame(frame, pods.art.frame, pods.art.cols);
    v.sprite.position.set(p.x, p.y);
    const c = sim.cellCenter(s.cell);
    v.sprite.zIndex = depth(geo, c.x, c.y) * 100 + 8;
    // Size says how far it spreads; it breathes.
    const size = 0.55 + (s.strain?.radius ?? NODE_RADIUS) * 0.09;
    const breathe = 1 + 0.025 * Math.sin(v.t * 2.2 + s.id);
    const k = (geo.a * size) / (clips.body * pods.art.frame);
    v.sprite.scale.set(k * breathe, k / breathe);
    return v.sprite;
  }

  /** Nodes gone from the sim. */
  prune(seen: Set<number>): void {
    for (const [id, v] of this.views) if (!seen.has(id)) { v.sprite.destroy(); this.views.delete(id); }
  }

  /** What the beats read: each node's look, and whether it is growing or spreading right now. */
  state(): Array<{ id: number; look: PodLook; growing: boolean; spreading: boolean }> {
    return [...this.views].map(([id, v]) => ({ id, look: v.look, growing: v.t < 1, spreading: v.spreadT >= 0 }));
  }
}

// ---------------------------------------------------------------- the gates

/** The two ends of a gate's opening on the ground (world pixels), and the way into the district. */
export function gateSpan(sim: Sim, gate: number): { a: Pt; b: Pt; inward: Pt } {
  const W = sim.cfg.gridW;
  const c = sim.cfg.cellPx;
  const x = gate % W;
  const y = Math.floor(gate / W);
  const sx = x - (x % PLATE);
  const sy = y - (y % PLATE);
  // Openings are two cells wide, from the fifth cell of the edge (citymap.ts portCell).
  if (y % PLATE === 0) return { a: { x: (sx + 4) * c, y: sy * c }, b: { x: (sx + 6) * c, y: sy * c }, inward: { x: 0, y: 1 } };
  if (y % PLATE === PLATE - 1) return { a: { x: (sx + 4) * c, y: (sy + PLATE) * c }, b: { x: (sx + 6) * c, y: (sy + PLATE) * c }, inward: { x: 0, y: -1 } };
  if (x % PLATE === 0) return { a: { x: sx * c, y: (sy + 4) * c }, b: { x: sx * c, y: (sy + 6) * c }, inward: { x: 1, y: 0 } };
  return { a: { x: (sx + PLATE) * c, y: (sy + 4) * c }, b: { x: (sx + PLATE) * c, y: (sy + 6) * c }, inward: { x: -1, y: 0 } };
}

export class GateArt {
  private sprites = new Map<number, Sprite>();
  constructor(private art: BoardArtSet) {}

  reset(): void {
    this.sprites.clear();
  }

  /** The gateway of a tile set, laid along the view's x or y (null: the set has none). */
  private tex(set: string, along: 'x' | 'y'): { tex: Texture; anchor: [number, number]; res: number } | null {
    const id = `gate-${set}-${along}`;
    const tex = this.art.sprite('gates', id);
    const r = this.art.rect('gates', id) as ({ anchor?: [number, number]; res?: number } | null);
    if (!tex || !r) return null;
    return { tex, anchor: r.anchor ?? [0, 1], res: r.res ?? 1 };
  }

  /**
   * Every gate: its gateway standing across the opening, lit when the next assault comes
   * through it; on the ground, chevrons marching inward. `setOf`: the tile set of a gate's district.
   * Returns false when there is no gateway art at all (the old ring is drawn instead).
   */
  draw(layer: Container, g: Graphics, geo: IsoGeo, sim: Sim, pulse: number, setOf: (gate: number) => string | null): boolean {
    const live = new Set<number>();
    let any = false;
    for (const gate of sim.gates) {
      const set = setOf(gate);
      const span = gateSpan(sim, gate);
      const pa = project(geo, span.a.x, span.a.y);
      const pb = project(geo, span.b.x, span.b.y);
      const [L, R] = pa.x <= pb.x ? [pa, pb] : [pb, pa];
      const along: 'x' | 'y' = L.y < R.y ? 'x' : 'y';
      const art = (set ? this.tex(set, along) : null) ?? this.tex('orthodox', along);
      const incoming = !sim.waveIntelHidden && sim.incomingGates.includes(gate);
      const mid = { x: (span.a.x + span.b.x) / 2, y: (span.a.y + span.b.y) / 2 };
      const c = sim.cfg.cellPx;
      // On the ground: the lane the assault will take glows, and chevrons march in along it.
      if (incoming) {
        const r = c * (1.05 + 0.08 * Math.sin(pulse * 2));
        g.ellipse(mid.x + span.inward.x * c * 0.5, mid.y + span.inward.y * c * 0.5, r, r).fill({ color: 0xd1603c, alpha: 0.22 });
        for (let k = 0; k < 3; k++) {
          const f = ((pulse * 0.35 + k / 3) % 1);
          const d = c * (0.3 + f * 2.2);
          const cx = mid.x + span.inward.x * d;
          const cy = mid.y + span.inward.y * d;
          const w = c * 0.55;
          const px = -span.inward.y;
          const py = span.inward.x;
          g.poly([
            cx - px * w - span.inward.x * w * 0.55, cy - py * w - span.inward.y * w * 0.55,
            cx, cy,
            cx + px * w - span.inward.x * w * 0.55, cy + py * w - span.inward.y * w * 0.55,
            cx + px * w * 0.7 - span.inward.x * w * 0.85, cy + py * w * 0.7 - span.inward.y * w * 0.85,
            cx - span.inward.x * w * 0.3, cy - span.inward.y * w * 0.3,
            cx - px * w * 0.7 - span.inward.x * w * 0.85, cy - py * w * 0.7 - span.inward.y * w * 0.85,
          ]).fill({ color: 0xf07a40, alpha: 0.9 * Math.sin(f * Math.PI) });
        }
      } else {
        g.ellipse(mid.x + span.inward.x * c * 0.5, mid.y + span.inward.y * c * 0.5, c * 0.7, c * 0.7).stroke({ width: 2, color: 0x8f2f2f, alpha: 0.35 });
      }
      if (!art) continue;
      any = true;
      live.add(gate);
      let s = this.sprites.get(gate);
      if (!s) {
        s = new Sprite(art.tex);
        layer.addChild(s);
        this.sprites.set(gate, s);
      }
      s.texture = art.tex;
      s.anchor.set(art.anchor[0], art.anchor[1]);
      s.position.set(L.x, L.y);
      s.scale.set(1 / art.res);
      // It stands on the line between its district and the city beyond: sorted with what stands there.
      s.zIndex = depth(geo, mid.x, mid.y) * 100 + 30;
      // The gate the next assault comes through is lit; the others stand in the dusk.
      const glow = incoming ? 0.5 + 0.5 * Math.sin(pulse * 2) : 0;
      s.tint = incoming ? (255 << 16) | (Math.round(215 + 25 * glow) << 8) | Math.round(185 + 25 * glow) : 0xa8a09a;
    }
    for (const [gate, s] of this.sprites) if (!live.has(gate)) { s.destroy(); this.sprites.delete(gate); }
    return any;
  }

  count(): number {
    return this.sprites.size;
  }
}

// ---------------------------------------------------------------- the unclaimed city

/**
 * The city the body has not reached: blocks of the set's own buildings, dim under smoke,
 * low at the edge of the claimed ground and rising away from it, and smoke drifting over.
 * Built again when the map is (a claim, a turn); the smoke moves every frame.
 */
export class Skyline {
  readonly under = new Container();
  readonly smoke = new Container();
  private wisps: Array<{ s: Sprite; vx: number; vy: number; base: number; phase: number }> = [];
  private bounds = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private clock = 0;

  constructor(private art: BoardArtSet) {
    this.under.sortableChildren = true;
  }

  build(geo: IsoGeo, sim: Sim, setOf: (cell: number) => string | null, wallSpan: number): number {
    this.under.removeChildren().forEach((x) => x.destroy());
    this.smoke.removeChildren().forEach((x) => x.destroy());
    this.wisps = [];
    const W = sim.cfg.gridW;
    const H = sim.cfg.gridH;
    const n = W * H;
    // How far every cell is from claimed ground, in cells (a few steps are enough).
    const far = new Uint8Array(n).fill(9);
    const queue: number[] = [];
    for (let c = 0; c < n; c++) if (sim.map.cells[c] !== CellType.Void) { far[c] = 0; queue.push(c); }
    for (let q = 0; q < queue.length; q++) {
      const c = queue[q];
      if (far[c] >= 8) continue;
      const x = c % W;
      const y = Math.floor(c / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const o = ny * W + nx;
        if (far[o] <= far[c] + 1) continue;
        far[o] = far[c] + 1;
        queue.push(o);
      }
    }
    // A made-up city: blocks of two by two to three by three with lanes between, by a steady hash of each district.
    const heightOf = (x: number, y: number): number => {
      if (x < 0 || y < 0 || x >= W || y >= H) return 0;
      const c = y * W + x;
      if (sim.map.cells[c] !== CellType.Void) return 0;
      const slot = Math.floor(y / PLATE) * sim.map.slotsX + Math.floor(x / PLATE);
      const lx = x % PLATE, ly = y % PLATE;
      const lane = (v: number, k: number) => v === Math.floor(2 + hash(slot * 7 + k) * 2) || v === Math.floor(6 + hash(slot * 13 + k) * 2);
      if (lane(lx, 1) || lane(ly, 2)) return 0;
      // Low beside the claimed ground, taller away from it: the body's ground is never hidden.
      const room = far[c] <= 1 ? 0 : far[c] === 2 ? 1 : far[c] === 3 ? 2 : 3;
      const bx = Math.floor(lx / 3), by = Math.floor(ly / 3);
      const want = 1 + Math.floor(hash(slot * 31 + bx * 5 + by * 11) * 3.2);
      return Math.min(room, want);
    };
    const size = viewSize(geo);
    let sprites = 0;
    const put = (tex: Texture | null, x: number, y: number, z: number, tint: number): void => {
      if (!tex) return;
      const s = new Sprite(tex);
      s.position.set(x, y);
      s.zIndex = z;
      s.tint = tint;
      this.under.addChild(s);
      sprites++;
    };
    const hV = (vx: number, vy: number): number => {
      if (vx < 0 || vy < 0 || vx >= size.w || vy >= size.h) return 0;
      const b = boardCell(geo, vx, vy);
      return heightOf(b.x, b.y);
    };
    const kinds = ['plain', 'science', 'meat', 'highground'];
    for (let vy = 0; vy < size.h; vy++) for (let vx = 0; vx < size.w; vx++) {
      const b = boardCell(geo, vx, vy);
      const cell = b.y * W + b.x;
      if (sim.map.cells[cell] !== CellType.Void) continue;
      const h = hV(vx, vy);
      if (!h) continue;
      const set = setOf(cell);
      const slot = Math.floor(b.y / PLATE) * sim.map.slotsX + Math.floor(b.x / PLATE);
      const kind = kinds[Math.floor(hash(slot * 3 + 1) * 4)];
      const px = (vx - vy) * geo.a - geo.a;
      const py = (vx + vy) * geo.b;
      const z = (vx + vy + 1) * 100;
      // Further from the claimed ground, deeper in the smoke.
      const fade = Math.max(0.3, 0.62 - far[cell] * 0.05);
      for (let l = hV(vx, vy + 1); l < h; l++) {
        const i = (((vx % (2 * wallSpan)) + 2 * wallSpan) % (2 * wallSpan));
        put(this.art.sprite('walls', `wall-${kind}-south-${l}-${i}`, set), px, py + geo.b - (l + 1) * geo.level, z, scale(0x8a8aa0, fade));
      }
      for (let l = hV(vx + 1, vy); l < h; l++) {
        const i = 2 * wallSpan - 1 - (((vy % (2 * wallSpan)) + 2 * wallSpan) % (2 * wallSpan));
        put(this.art.sprite('walls', `wall-${kind}-east-${l}-${i}`, set), px + geo.a, py + geo.b - (l + 1) * geo.level, z, scale(0x6a6a80, fade));
      }
      put(this.art.sprite('floors', `roof-${vx % 4}${vy % 4}`, set), px, py - h * geo.level, z + 1, scale(0x9a98a8, fade));
    }
    // The smoke: wisps spread over the whole board, thicker where the city is unclaimed.
    const wispTex: Texture[] = [];
    for (let i = 0; i < 8; i++) { const t = this.art.sprite('smoke', `smoke-${i}`); if (t) wispTex.push(t); }
    const corners = [project(geo, 0, 0), project(geo, W * geo.cell, 0), project(geo, 0, H * geo.cell), project(geo, W * geo.cell, H * geo.cell)];
    this.bounds = {
      x0: Math.min(...corners.map((p) => p.x)), x1: Math.max(...corners.map((p) => p.x)),
      y0: Math.min(...corners.map((p) => p.y)) - 3 * geo.level, y1: Math.max(...corners.map((p) => p.y)),
    };
    if (wispTex.length) {
      let placed = 0;
      for (let k = 0; placed < 46 && k < 400; k++) {
        const wx = hash(k * 2 + 1) * W;
        const wy = hash(k * 2 + 2) * H;
        const c = Math.floor(wy) * W + Math.floor(wx);
        if (sim.map.cells[c] !== CellType.Void || far[c] < 2) continue;
        const p = project(geo, wx * geo.cell, wy * geo.cell);
        const s = new Sprite(wispTex[k % wispTex.length]);
        s.anchor.set(0.5, 0.5);
        s.position.set(p.x, p.y - geo.level * (1 + hash(k * 5) * 2));
        s.scale.set((1.3 + hash(k * 9) * 1.4) * geo.a / 64);
        s.tint = 0xb8b4ae;
        const base = 0.22 + hash(k * 11) * 0.2;
        s.alpha = base;
        this.smoke.addChild(s);
        this.wisps.push({ s, vx: (6 + hash(k * 3) * 8) * geo.a / 64, vy: (2 + hash(k * 7) * 3) * geo.b / 38, base, phase: hash(k * 13) * 6.28 });
        placed++;
      }
    }
    return sprites;
  }

  /** The smoke drifts with the wind, and thins and thickens as it goes. `dt`: real seconds. */
  update(dt: number): void {
    this.clock += dt;
    const { x0, x1, y0, y1 } = this.bounds;
    for (const w of this.wisps) {
      w.s.x += w.vx * dt;
      w.s.y += w.vy * dt;
      if (w.s.x > x1 + 150) w.s.x = x0 - 150;
      if (w.s.y > y1 + 100) w.s.y = y0 - 100;
      w.s.alpha = w.base * (0.75 + 0.25 * Math.sin(this.clock * 0.4 + w.phase));
    }
  }

  count(): { blocks: number; wisps: number } {
    return { blocks: this.under.children.length, wisps: this.wisps.length };
  }
}

// ---------------------------------------------------------------- plinths

/**
 * A roof raised on a plinth rises out of its block: for RISE seconds everything the map built
 * for that cell (its new level of bone, its roof, the skin on it, what stands there) is drawn
 * that much lower, and comes up. The level of bone below it is seen to grow.
 */
export const RISE = 1.1;
export class PlinthRise {
  private last = new Uint8Array(0);
  /** The cells rising, and when they started (renderer clock). */
  private rising = new Map<number, number>();
  private clock = 0;

  reset(n: number): void {
    this.last = new Uint8Array(n);
    this.rising.clear();
  }

  /** Before the map is built again: which cells have just been raised. */
  note(plinths: Uint8Array | number[]): void {
    if (this.last.length !== plinths.length) { this.last = Uint8Array.from(plinths); return; }
    for (let c = 0; c < plinths.length; c++) {
      if (plinths[c] > this.last[c]) this.rising.set(c, this.clock);
      this.last[c] = plinths[c];
    }
  }

  /** How far below its place a cell's things are drawn right now, in levels (0: in place). */
  drop(cell: number): number {
    const t0 = this.rising.get(cell);
    if (t0 === undefined) return 0;
    const f = Math.min(1, (this.clock - t0) / RISE);
    // It rises quickly, overshoots a hair, and settles: grown, not lifted.
    const e = 1 - Math.pow(1 - f, 3) + Math.sin(f * Math.PI) * 0.06;
    return 1 - Math.min(1.04, e);
  }

  update(dt: number): number[] {
    this.clock += dt;
    const done: number[] = [];
    for (const [c, t0] of this.rising) if (this.clock - t0 > RISE + 0.2) { this.rising.delete(c); done.push(c); }
    return done;
  }

  cells(): number[] {
    return [...this.rising.keys()];
  }
}

/** Where a view cell's board cell is, as a number (for the renderer's loops). */
export const cellOfView = (geo: IsoGeo, W: number, vx: number, vy: number): number => {
  const b = boardCell(geo, vx, vy);
  return b.y * W + b.x;
};
export { viewCell };
