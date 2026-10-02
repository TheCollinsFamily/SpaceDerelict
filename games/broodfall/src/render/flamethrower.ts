/**
 * THE FLAMETROOPER'S FIRE (Oct 2 2026). Collins on the first version: "the fire effects are awful, come on we can do
 * better, and they don't track the front of the nozzle". So:
 *
 * - It starts AT THE NOZZLE TIP, every frame: the tip is found on the baked art by its blue pilot light, frame by
 *   frame and view by view (tools/art/nozzles.mjs -> nozzles.ts), and placed as the trooper is drawn now.
 * - It runs from the tip toward what it burns, as long as the sim's stream reaches (Enemy.flameTo).
 * - The jet is a real flamethrower filmed on RFab (tools/art/flamejet.mjs, public/art/fx/flamejet.webp: 16 frames
 *   of a roaring jet on black), drawn ADDED and laid along the stream: white-yellow core, orange body, licking red
 *   edges. Over it: a bright flickering pilot flare at the tip, its light cast on the ground under the stream and on
 *   the walls round it (an added glow), a little black smoke rolling off the far end, a few embers, and flames on
 *   whatever of yours it is burning. It ignites with a flare and a short run-up, and sputters out when it stops.
 * - Seen from behind (the trooper facing away) the jet starts in front of his chest and is drawn behind him.
 * - Reduce motion: one still frame of the jet, no smoke, embers or flicker; a quick fade in and out.
 * - ?flame=particles draws the jet from particles instead (the other option tried; tools/shot-flame.mjs compares).
 *
 * It only reads the sim. Pooled sprites: cheap at four or more troopers.
 */
import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { artUrl } from './art';
import { CALM } from '../meta/settings';
import { NOZZLES } from './nozzles';

export interface Pt { x: number; y: number }
type View = 'S' | 'SW' | 'W' | 'NW' | 'N';
const NZ = NOZZLES.flametrooper;

/** One trooper as the renderer drew it this frame. */
export interface Thrower {
  id: number;
  /** Where its sprite stands and how it is drawn (anchor in shares of the frame, scale with the mirror's sign). */
  pos: Pt; anchor: Pt; scaleX: number; scaleY: number; frame: number;
  /** The attack view drawn and the frame of the attack clip shown (null: it is not on its attack clip). */
  view: View; at: number | null;
  /** Where the stream reaches this tick, on the screen at the ground (null: it is not firing). */
  to: Pt | null;
  /** The ground under the tip, on the screen (for the cast light). */
  ground: Pt;
  /** Its sprite's depth: a jet seen from behind goes just under it. */
  z: number;
  /** Board pixels per world pixel across the ground (for widths). */
  k: number;
}

const JET_W = 256;
const JET_H = 96;
const JET_FRAMES = 16;
const FPS = 18;
const PARTICLES = new URLSearchParams(typeof location === 'undefined' ? '' : location.search).get('flame') === 'particles';

interface State { on: number; off: number; was: boolean; seen: number; last: Thrower | null; seed: number }
interface Puff { x: number; y: number; vx: number; vy: number; t: number; life: number; size: number; kind: 'smoke' | 'ember' | 'spark' }

/** A soft round spot, white in the middle, fading to nothing: the glow, the flare, smoke, particles. */
function softDot(size = 64): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, size, size);
  return Texture.from(c);
}

class Pool {
  private list: Sprite[] = [];
  private used = 0;
  constructor(private box: Container) {}
  begin(): void { this.used = 0; }
  get(tex: Texture): Sprite {
    let s = this.list[this.used];
    if (!s) { s = new Sprite(tex); this.box.addChild(s); this.list.push(s); }
    this.used++;
    s.texture = tex; s.visible = true; s.alpha = 1; s.tint = 0xffffff; s.rotation = 0; s.blendMode = 'add'; s.zIndex = 0;
    return s;
  }
  end(): void { for (let i = this.used; i < this.list.length; i++) this.list[i].visible = false; }
}

export class Flamethrowers {
  /** Over everything standing: the jets of troopers facing the camera, their light, smoke and embers. */
  readonly glow = new Container();
  readonly air = new Container();
  private glowPool = new Pool(this.glow);
  private airPool = new Pool(this.air);
  /** Behind a trooper seen from behind: in the board's depth-sorted layer, just under him. */
  private behindPool: Pool;
  private frames: Texture[] = [];
  private dot: Texture | null = null;
  private states = new Map<number, State>();
  private puffs: Puff[] = [];
  private clock = 0;
  private tick = 0;

  constructor(sorted: Container) {
    this.behindPool = new Pool(sorted);
    this.air.sortableChildren = false;
    void Assets.load<Texture>(artUrl('fx/flamejet.webp')).then((t) => {
      for (let i = 0; i < JET_FRAMES; i++) this.frames.push(new Texture({ source: t.source, frame: new Rectangle(i * JET_W, 0, JET_W, JET_H) }));
    }).catch(() => { /* no jet strip: particles only */ });
  }

  /** The nozzle tip of this trooper as it is drawn now, on the screen. */
  static tip(t: Thrower): { at: Pt; hidden: boolean } {
    const hidden = NZ.hidden.includes(t.view);
    const pts = NZ.attack[t.view] ?? NZ.attack.SW;
    const m = t.at === null ? pts[0] : pts[((Math.floor(t.at) % pts.length) + pts.length) % pts.length];
    return { at: { x: t.pos.x + (m[0] - t.anchor.x) * t.frame * t.scaleX, y: t.pos.y + (m[1] - t.anchor.y) * t.frame * t.scaleY }, hidden };
  }

  /** Every frame: draw the fire of every trooper handed in; one that stopped sputters out. `burning`: your units in a stream, on the screen. */
  update(dt: number, list: Thrower[], burning: Array<Pt & { r: number }>): void {
    this.clock += dt;
    this.tick++;
    this.glowPool.begin(); this.airPool.begin(); this.behindPool.begin();
    if (!this.dot) this.dot = softDot();
    const calm = CALM.motion;
    for (const t of list) {
      let st = this.states.get(t.id);
      if (!st) { st = { on: 0, off: 0, was: false, seen: 0, last: null, seed: (t.id * 7919) % 1000 }; this.states.set(t.id, st); }
      st.seen = this.tick;
      const firing = !!t.to;
      if (firing && !st.was) st.on = 0;
      if (!firing && st.was) st.off = 0;
      st.was = firing;
      if (firing) { st.on += dt; st.last = t; this.draw(t, st, Math.min(1, st.on / (calm ? 0.05 : 0.16)), 1, calm); }
      else if (st.last && st.off < (calm ? 0.1 : 0.32)) {
        // It stops: the stream breaks up and sputters for a moment from where it was last aimed (from the tip now).
        st.off += dt;
        const f = 1 - st.off / (calm ? 0.1 : 0.32);
        const sputter = calm ? 1 : 0.55 + 0.45 * Math.sin(st.off * 70 + st.seed);
        this.draw({ ...t, to: st.last.to }, st, f, f * sputter, calm);
      }
    }
    for (const [id, st] of this.states) if (st.seen !== this.tick && !(st.last && st.off < 0.32)) this.states.delete(id);
    // What of yours it burns: a little fire on each, flickering.
    for (const b of burning) {
      const f = this.frames.length ? this.frames[(Math.floor(this.clock * FPS) + Math.round(b.x)) % this.frames.length] : this.dot;
      const s = this.airPool.get(f);
      s.anchor.set(0.08, 0.5);
      s.position.set(b.x, b.y);
      s.rotation = -Math.PI / 2 + (calm ? 0 : Math.sin(this.clock * 9 + b.x) * 0.15);
      s.width = b.r * 3.2; s.height = b.r * 1.6;
      s.alpha = 0.9;
    }
    // Smoke and embers, moved on.
    if (!calm) {
      for (const p of this.puffs) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind === 'smoke') { p.vx *= 0.98; p.vy -= 6 * dt; } else p.vy += 8 * dt; }
      this.puffs = this.puffs.filter((p) => p.t < p.life);
      for (const p of this.puffs) {
        const f = p.t / p.life;
        const s = (p.kind === 'smoke' ? this.airPool : this.glowPool).get(this.dot);
        s.anchor.set(0.5);
        s.position.set(p.x, p.y);
        if (p.kind === 'smoke') { s.blendMode = 'normal'; s.tint = 0x1a1410; s.alpha = 0.38 * (1 - f) * Math.min(1, f * 5); s.width = s.height = p.size * (1 + f * 1.6); }
        else { s.tint = f < 0.4 ? 0xffd27a : 0xff7a22; s.alpha = 1 - f; s.width = s.height = p.size; }
      }
    } else this.puffs = [];
    this.glowPool.end(); this.airPool.end(); this.behindPool.end();
  }

  private draw(t: Thrower, st: State, grow: number, alpha: number, calm: boolean): void {
    if (!t.to || !this.dot) return;
    const { at: a, hidden } = Flamethrowers.tip(t);
    const dx = t.to.x - a.x;
    const dy = t.to.y - a.y;
    const full = Math.hypot(dx, dy);
    if (full < 2) return;
    const len = full * grow;
    const ang = Math.atan2(dy, dx);
    const ux = dx / full; const uy = dy / full;
    const pool = hidden ? this.behindPool : this.glowPool;
    const z = hidden ? t.z - 1 : 0;
    const wide = Math.max(10, len * 0.42);
    const flick = calm ? 1 : 0.85 + 0.15 * Math.sin(this.clock * 31 + st.seed);
    // The cast light: an orange pool on the ground under the stream and round what it reaches.
    const g0 = this.glowPool.get(this.dot);
    g0.anchor.set(0.5);
    g0.position.set(t.ground.x + ux * len * 0.55, t.ground.y + uy * len * 0.55 + 4);
    g0.rotation = ang;
    g0.width = len * 1.5; g0.height = wide * 1.5;
    g0.tint = 0xff7a28; g0.alpha = 0.32 * alpha * flick;
    if (PARTICLES || !this.frames.length) this.particleJet(a, ux, uy, len, wide, alpha, pool, z, calm);
    else {
      // The jet: two frames of the filmed fire, a little apart in time, laid from the tip along the stream.
      const k = Math.floor(this.clock * FPS + st.seed);
      for (const [off, sc, al] of [[0, 1, 1], [7, 1.12, 0.55]] as const) {
        const s = pool.get(this.frames[calm ? 0 : (k + off) % JET_FRAMES]);
        s.anchor.set(0.012, 0.5);
        s.position.set(a.x, a.y);
        s.rotation = ang;
        s.width = len * sc; s.height = wide * sc;
        s.alpha = al * alpha;
        s.zIndex = z;
      }
    }
    // The pilot flare at the tip: white-yellow, flickering, bigger as it ignites.
    const ignite = grow < 1 ? 1.6 - grow * 0.6 : 1;
    const p = pool.get(this.dot);
    p.anchor.set(0.5);
    p.position.set(a.x, a.y);
    p.width = p.height = 14 * ignite * flick;
    p.tint = 0xfff2c0; p.alpha = alpha; p.zIndex = z + 1;
    // Smoke rolling off the far end, embers flying.
    if (!calm && alpha > 0.5 && grow > 0.9) {
      const end = { x: a.x + ux * len, y: a.y + uy * len };
      if (this.tick % 3 === st.seed % 3 && this.puffs.length < 220) {
        this.puffs.push({ x: end.x + (Math.random() - 0.5) * wide * 0.5, y: end.y - 4, vx: ux * 12, vy: -14 - Math.random() * 8, t: 0, life: 1.4 + Math.random() * 0.6, size: wide * 0.7, kind: 'smoke' });
      }
      if (Math.random() < 0.5 && this.puffs.length < 220) {
        const f = 0.4 + Math.random() * 0.6;
        this.puffs.push({ x: a.x + ux * len * f, y: a.y + uy * len * f, vx: ux * 40 + (Math.random() - 0.5) * 30, vy: uy * 40 - 30 - Math.random() * 30, t: 0, life: 0.5 + Math.random() * 0.4, size: 2 + Math.random() * 2, kind: 'ember' });
      }
    }
  }

  /** The other option: the jet as particles (white-yellow at the tip, orange, then red and gone), each frame. */
  private particleJet(a: Pt, ux: number, uy: number, len: number, wide: number, alpha: number, pool: Pool, z: number, calm: boolean): void {
    const n = 26;
    for (let i = 0; i < n; i++) {
      const f = ((i / n) + (calm ? 0 : this.clock * 2.2)) % 1;
      const side = calm ? 0 : Math.sin(i * 12.9898 + this.clock * 8) * f * wide * 0.35;
      const s = pool.get(this.dot!);
      s.anchor.set(0.5);
      s.position.set(a.x + ux * len * f - uy * side, a.y + uy * len * f + ux * side);
      s.width = s.height = 6 + wide * 0.9 * f;
      s.tint = f < 0.15 ? 0xfff4c8 : f < 0.45 ? 0xffb030 : f < 0.8 ? 0xf05a14 : 0x9a2008;
      s.alpha = alpha * (f < 0.85 ? 0.85 : (1 - f) * 5);
      s.zIndex = z;
    }
  }
}
