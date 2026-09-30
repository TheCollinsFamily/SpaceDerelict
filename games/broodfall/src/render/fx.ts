/**
 * WHAT FLIES, BURSTS AND HANGS IN THE AIR, drawn with the baked effects
 * (public/art/fx/, made by tools/art/templates/fx.mjs). Sep 30 2026: all of it was lines and dots.
 *
 * - Shots in flight are turned along the way they fly (DESIGN rule 17: direction is always
 *   visible): a glob of spit, a harpoon, a fan of quills, a web, a bile glob, a shell, a dart.
 * - What lands or strikes leaves a burst where it struck: a splat, a splash, a blast.
 * - Light is drawn added onto what is under it: lightning between the frond and what it
 *   strikes, the prism's beam, the ocular's stare, the ember's jet of flame.
 * - What hangs in the air (poison clouds, caltrops) lies on the ground where it is.
 *
 * The renderer hands it where a world point is on the screen; it keeps its own clock for what
 * the sim does not (a burst outlives the shell that made it). The sim is only read.
 * Without the effects sheet the renderer draws its old shapes instead.
 */
import { Container, Sprite, Texture } from 'pixi.js';
import type { Sim } from '../sim/sim';
import type { TowerFamily } from '../sim/types';
import type { BoardArtSet } from './art';

export interface Pt { x: number; y: number }

/** What the renderer tells the effects about its board each frame. */
export interface FxView {
  /** A world point `up` board pixels above the street, on the screen (board pixels, before the camera). */
  at(wx: number, wy: number, up: number): Pt;
  /** How high a limb standing there shoots from, in board pixels. */
  muzzle(wx: number, wy: number): number;
  /** How high the ground is there, in board pixels (a roof is higher than a street). */
  floor(wx: number, wy: number): number;
  /** Board pixels on the screen per world pixel, across the ground. */
  scale: number;
}

/** Which picture a limb's shot is. */
const SHOT: Partial<Record<TowerFamily, string>> = {
  spitter: 'spit', sprout: 'spit', burster: 'sac', tangler: 'mucus', blighter: 'spore', impaler: 'harpoon',
  quill: 'quill', net: 'web', mister: 'droplets',
};
/** What a shot leaves where it ends, and how big (a share of the burst's picture). */
const LANDS: Record<string, [string, number] | null> = {
  spit: ['flesh-splat', 0.32], sac: ['flesh-splat', 0.55], mucus: ['web-mat', 0.3], spore: ['acid-splash', 0.4],
  harpoon: ['flesh-splat', 0.3], quill: null, web: ['web-mat', 0.42], droplets: ['mist-cloud', 0.34],
};
/** How long each shot picture is drawn, in board pixels along its flight. */
const LONG: Record<string, number> = {
  spit: 34, sac: 40, mucus: 42, spore: 32, harpoon: 84, quill: 48, web: 52, droplets: 34,
  bile: 48, clot: 46, 'spore-shell': 42, 'bone-shell': 36, 'cannon-shell': 30, dart: 40, 'mortar-bomb': 40, barb: 20,
};

interface Burst { id: string; x: number; y: number; t: number; dur: number; size: number; rot: number; glow: boolean; grow: number }
interface Streak { kind: 'bolt' | 'beam' | 'stare' | 'relay' | 'flame'; from: Pt; to: Pt; t: number; dur: number; seed: number }
interface Bomb { from: { x: number; y: number }; to: { x: number; y: number }; t: number; dur: number }

/** Sprites handed out each frame and taken back at the end of it. */
class Pool {
  private list: Sprite[] = [];
  private used = 0;
  constructor(readonly box: Container) {}
  begin(): void { this.used = 0; }
  take(tex: Texture): Sprite {
    let s = this.list[this.used];
    if (!s) { s = new Sprite(tex); this.box.addChild(s); this.list.push(s); }
    this.used++;
    s.texture = tex;
    s.visible = true;
    s.alpha = 1;
    s.tint = 0xffffff;
    s.rotation = 0;
    s.anchor.set(0.5, 0.5);
    s.scale.set(1);
    return s;
  }
  end(): void { for (let i = this.used; i < this.list.length; i++) this.list[i].visible = false; }
  count(): number { return this.used; }
}

export class FxLayer {
  /** Clouds and what lies on the ground: under the units. */
  readonly ground = new Container();
  /** What flies and what bursts: over everything standing. */
  readonly air = new Container();
  /** Light, added onto what is under it. */
  readonly glow = new Container();
  private groundPool = new Pool(this.ground);
  private airPool = new Pool(this.air);
  private glowPool = new Pool(this.glow);

  private shots = new Map<number, { pic: string; x: number; y: number; up: number; up0: number; ttl0: number; seen: number }>();
  private shells = new Map<number, { pic: string; to: { x: number; y: number }; land: [string, number, boolean]; seen: number }>();
  private lobs = new Map<number, { pic: string; to: { x: number; y: number }; land: [string, number, boolean]; seen: number }>();
  private arcsSeen = new WeakSet<object>();
  private bursts: Burst[] = [];
  private streaks: Streak[] = [];
  private bombs: Bomb[] = [];
  private frame = 0;
  private clock = 0;

  constructor(private art: BoardArtSet) {
    this.glow.blendMode = 'add';
  }

  /** The effects sheet loaded: the renderer draws with it instead of its dots. */
  ready(): boolean {
    return this.art.fx.has('effects');
  }

  private tex(id: string): Texture | null {
    return this.art.fxSprite('effects', id)?.tex ?? null;
  }

  /** How many effects are on screen now, by kind (for the beats). */
  counts(): Record<string, number> {
    return {
      shots: this.shots.size, shells: this.shells.size + this.lobs.size, bursts: this.bursts.length,
      streaks: this.streaks.length, bombs: this.bombs.length,
      sprites: this.groundPool.count() + this.airPool.count() + this.glowPool.count(),
    };
  }

  reset(): void {
    this.shots.clear(); this.shells.clear(); this.lobs.clear();
    this.bursts = []; this.streaks = []; this.bombs = [];
  }

  /** A burst where something struck, `size` board pixels across. */
  burst(id: string, p: Pt, size: number, dur = 0.45, grow = 0.5): void {
    if (this.bursts.length > 160) return;
    const r = this.art.fxSprite('effects', id);
    if (!r) return;
    this.bursts.push({ id, x: p.x, y: p.y, t: 0, dur, size, rot: (this.frame * 2.39996) % (Math.PI * 2), glow: !!r.rect.glow, grow });
  }

  /** Before anything of this frame is drawn (the units draw what is done to them in between). */
  begin(dt: number): void {
    this.frame++;
    this.clock += dt;
    this.groundPool.begin(); this.airPool.begin(); this.glowPool.begin();
  }

  /** After everything of this frame: what was not drawn again is hidden. */
  end(): void {
    this.groundPool.end(); this.airPool.end(); this.glowPool.end();
  }

  draw(sim: Sim, v: FxView, dt: number): void {
    this.drawClouds(sim, v);
    this.drawProjectiles(sim, v);
    this.drawShells(sim, v);
    this.drawArcs(sim, v, dt);
    this.drawBombs(v, dt);
    this.drawBursts(dt);
  }

  /** A thing in flight at `p`, turned to fly toward `ahead`, `long` board pixels along its flight. */
  private flying(pic: string, p: Pt, ahead: Pt, long = LONG[pic] ?? 24): void {
    const tex = this.tex(pic);
    if (!tex) return;
    const s = this.airPool.take(tex);
    s.position.set(p.x, p.y);
    s.rotation = Math.atan2(ahead.y - p.y, ahead.x - p.x);
    s.scale.set(long / tex.width);
  }

  /** The shadow of something in the air, on the ground under it. */
  private shadow(p: Pt, w: number): void {
    const tex = this.tex('spit');
    if (!tex) return;
    const s = this.groundPool.take(tex);
    s.position.set(p.x, p.y);
    s.tint = 0x000000;
    s.alpha = 0.3;
    s.scale.set(w / tex.width, (w * 0.45) / tex.height);
  }

  private drawProjectiles(sim: Sim, v: FxView): void {
    for (const p of sim.projectiles) {
      const pic = SHOT[p.fromFamily] ?? 'spit';
      let st = this.shots.get(p.id);
      if (!st) {
        const up0 = v.muzzle(p.pos.x, p.pos.y);
        st = { pic, x: p.pos.x, y: p.pos.y, up: up0, up0, ttl0: Math.max(0.05, p.ttl), seen: 0 };
        this.shots.set(p.id, st);
      }
      st.seen = this.frame;
      // It leaves the limb up on its roof and comes down to the street as it flies (as the dots did).
      const f = Math.min(1, 1 - p.ttl / st.ttl0);
      st.up = st.up0 + (14 - st.up0) * Math.min(1, f * 2.2);
      st.x = p.pos.x; st.y = p.pos.y;
      const here = v.at(p.pos.x, p.pos.y, st.up);
      const m = Math.hypot(p.vel.x, p.vel.y) || 1;
      const ahead = v.at(p.pos.x + (p.vel.x / m) * 6, p.pos.y + (p.vel.y / m) * 6, st.up - 0.4);
      this.flying(pic, here, ahead);
      if (pic === 'harpoon' || pic === 'quill') this.shadow(v.at(p.pos.x, p.pos.y, v.floor(p.pos.x, p.pos.y)), 10);
    }
    for (const [id, st] of this.shots) {
      if (st.seen === this.frame) continue;
      this.shots.delete(id);
      const land = LANDS[st.pic];
      if (land) this.burst(land[0], v.at(st.x, st.y, Math.max(v.floor(st.x, st.y) + 4, st.up * 0.7)), land[1] * 100, 0.4);
    }
  }

  /** A lobbed thing: where it is at `f` of its flight between two world points, and a little further on. */
  private lobbed(v: FxView, from: { x: number; y: number }, to: { x: number; y: number }, f: number, arc: number): { here: Pt; ahead: Pt; ground: Pt } {
    const a = v.at(from.x, from.y, v.muzzle(from.x, from.y));
    const b = v.at(to.x, to.y, v.floor(to.x, to.y) + 6);
    const place = (u: number) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * arc });
    const gx = from.x + (to.x - from.x) * f;
    const gy = from.y + (to.y - from.y) * f;
    return { here: place(f), ahead: place(Math.min(1, f + 0.03)), ground: v.at(gx, gy, v.floor(gx, gy)) };
  }

  private drawShells(sim: Sim, v: FxView): void {
    const arcPx = 42 * v.scale;
    for (const s of sim.shells) {
      let st = this.shells.get(s.id);
      if (!st) {
        const bombard = s.side === 'body' && sim.towers.some((t) => t.family === 'bombard' && Math.hypot(t.pos.x - s.from.x, t.pos.y - s.from.y) < 2);
        const pic = s.side === 'body' ? (bombard ? 'spore-shell' : 'bone-shell') : s.stun ? 'dart' : 'cannon-shell';
        const land: [string, number, boolean] = s.side === 'body' ? ['spore-burst', Math.max(0.45, Math.min(1.1, s.aoe / 40)), true]
          : s.stun ? ['sedation-puff', 0.6, true] : ['blast', Math.max(0.85, Math.min(1.3, s.aoe / 30)), true];
        st = { pic, to: { ...s.to }, land, seen: 0 };
        this.shells.set(s.id, st);
      }
      st.seen = this.frame;
      const f = 1 - s.ttl / s.flight;
      // A dart flies flat and fast; a shell climbs and falls.
      const { here, ahead, ground } = this.lobbed(v, s.from, s.to, f, st.pic === 'dart' ? arcPx * 0.25 : arcPx);
      this.shadow(ground, st.pic === 'dart' ? 8 : 14);
      this.flying(st.pic, here, ahead);
    }
    const flights: Array<{ id: number; from: { x: number; y: number }; to: { x: number; y: number }; f: number; pic: string; arc: number; land: [string, number, boolean] }> = [];
    for (const b of sim.bileFlights) flights.push({ id: b.id, from: b.from, to: b.to, f: 1 - b.ttl / 0.9, pic: 'bile', arc: 36 * v.scale, land: ['acid-splash', Math.max(0.5, Math.min(1.1, b.aoe / 35)), true] });
    for (const c of sim.clotFlights) flights.push({ id: c.id, from: c.from, to: c.to, f: 1 - c.ttl / 1.2, pic: 'clot', arc: 40 * v.scale, land: ['flesh-splat', 0.8, true] });
    for (const fl of flights) {
      let st = this.lobs.get(fl.id);
      if (!st) { st = { pic: fl.pic, to: { ...fl.to }, land: fl.land, seen: 0 }; this.lobs.set(fl.id, st); }
      st.seen = this.frame;
      const { here, ahead, ground } = this.lobbed(v, fl.from, fl.to, Math.max(0, Math.min(1, fl.f)), fl.arc);
      this.shadow(ground, 16);
      this.flying(fl.pic, here, ahead);
    }
    for (const map of [this.shells, this.lobs]) {
      for (const [id, st] of map) {
        if (st.seen === this.frame) continue;
        map.delete(id);
        this.burst(st.land[0], v.at(st.to.x, st.to.y, v.floor(st.to.x, st.to.y) + 6), st.land[1] * 110, 0.55, 0.7);
      }
    }
  }

  /**
   * Lightning, beams, stares, flames and the hive mortar's bombs. The sim keeps only a line
   * from one point to another for a moment; what made it is found by who stands at its start.
   */
  private drawArcs(sim: Sim, v: FxView, dt: number): void {
    for (const a of sim.arcs) {
      if (this.arcsSeen.has(a)) continue;
      this.arcsSeen.add(a);
      const near = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y) < 2;
      const limb = sim.towers.find((t) => near(t.pos, a.from));
      const at = (w: { x: number; y: number }, up: number) => v.at(w.x, w.y, up);
      const unitUp = (w: { x: number; y: number }) => v.floor(w.x, w.y) + 10 * v.scale;
      const seed = this.frame;
      if (limb) {
        const from = at(a.from, v.muzzle(a.from.x, a.from.y));
        const onLimb = sim.towers.find((t) => t !== limb && near(t.pos, a.to));
        const to = onLimb ? at(a.to, v.muzzle(a.to.x, a.to.y)) : at(a.to, unitUp(a.to));
        if (limb.family === 'ember') {
          this.streaks.push({ kind: 'flame', from, to, t: 0, dur: 0.42, seed });
        } else if (limb.family === 'prism') {
          this.streaks.push({ kind: onLimb ? 'relay' : 'beam', from, to, t: 0, dur: 0.3, seed });
          if (!onLimb) this.burst('sedation-puff', to, 34, 0.25, 0.3);
        } else if (limb.family === 'ocular') {
          this.streaks.push({ kind: 'stare', from, to, t: 0, dur: 0.35, seed });
        } else {
          this.streaks.push({ kind: 'bolt', from, to, t: 0, dur: 0.24, seed });
          this.burst('sedation-puff', to, 30, 0.22, 0.3);
        }
        continue;
      }
      const mortar = sim.enemies.find((e) => e.kind === 'mortar' && near(e.pos, a.from));
      if (mortar) {
        this.bombs.push({ from: { ...a.from }, to: { ...a.to }, t: 0, dur: 0.55 });
        continue;
      }
      // A strike jumping on from one body to the next.
      this.streaks.push({ kind: 'bolt', from: at(a.from, unitUp(a.from)), to: at(a.to, unitUp(a.to)), t: 0, dur: 0.22, seed });
      this.burst('sedation-puff', at(a.to, unitUp(a.to)), 26, 0.2, 0.3);
    }
    const keep: Streak[] = [];
    for (const s of this.streaks) {
      s.t += dt;
      if (s.t >= s.dur) continue;
      keep.push(s);
      this.streak(s);
    }
    this.streaks = keep;
  }

  private streak(s: Streak): void {
    const dx = s.to.x - s.from.x;
    const dy = s.to.y - s.from.y;
    const len = Math.max(4, Math.hypot(dx, dy));
    const rot = Math.atan2(dy, dx);
    const life = 1 - s.t / s.dur;
    const put = (id: string, thick: number, alpha: number, tint = 0xffffff, reach = len): void => {
      const tex = this.tex(id);
      if (!tex) return;
      const sp = this.glowPool.take(tex);
      sp.anchor.set(0, 0.5);
      sp.position.set(s.from.x, s.from.y);
      sp.rotation = rot;
      sp.scale.set(reach / tex.width, thick / tex.height);
      sp.alpha = alpha;
      sp.tint = tint;
    };
    if (s.kind === 'bolt') {
      // A new path every few frames: it crackles.
      const k = 1 + ((Math.floor(s.t * 30) + s.seed) % 3);
      put(`bolt-${k}`, Math.min(34, 10 + len * 0.12), Math.min(1, life * 1.6));
    } else if (s.kind === 'beam') {
      put('beam', 12, Math.min(1, life * 2));
      put('beam', 26, 0.45 * life, 0x80d8ff);
    } else if (s.kind === 'relay') {
      put('beam', 7, 0.7 * life, 0xa0e8ff);
    } else if (s.kind === 'stare') {
      put('beam', 6, 0.8 * life, 0xfff0c0);
    } else {
      // The jet reaches past what it aims at, across the whole cone, and flickers.
      const k = 1 + ((Math.floor(s.t * 20) + s.seed) % 2);
      const reach = len * 1.3;
      put(`flame-${k}`, reach * 0.42 * (0.9 + 0.2 * Math.sin(s.t * 40)), Math.min(1, life * 2.2), 0xffffff, reach * (0.6 + 0.4 * Math.min(1, s.t * 8)));
    }
  }

  /** The hive mortar's bombs: lobbed at a limb, and a blast where they land. */
  private drawBombs(v: FxView, dt: number): void {
    const keep: Bomb[] = [];
    for (const b of this.bombs) {
      b.t += dt;
      if (b.t >= b.dur) {
        this.burst('blast', v.at(b.to.x, b.to.y, v.muzzle(b.to.x, b.to.y) * 0.7), 100, 0.55, 0.6);
        continue;
      }
      keep.push(b);
      const f = b.t / b.dur;
      const a = v.at(b.from.x, b.from.y, v.floor(b.from.x, b.from.y) + 14 * v.scale);
      const c = v.at(b.to.x, b.to.y, v.muzzle(b.to.x, b.to.y) * 0.7);
      const arc = 60 * v.scale;
      const place = (u: number) => ({ x: a.x + (c.x - a.x) * u, y: a.y + (c.y - a.y) * u - Math.sin(u * Math.PI) * arc });
      this.flying('mortar-bomb', place(f), place(Math.min(1, f + 0.03)));
    }
    this.bombs = keep;
  }

  private drawBursts(dt: number): void {
    const keep: Burst[] = [];
    for (const b of this.bursts) {
      b.t += dt;
      if (b.t >= b.dur) continue;
      keep.push(b);
      const r = this.art.fxSprite('effects', b.id);
      if (!r) continue;
      const u = b.t / b.dur;
      const s = (b.glow ? this.glowPool : this.airPool).take(r.tex);
      s.position.set(b.x, b.y);
      s.rotation = b.rot;
      const k = (b.size / Math.max(r.tex.width, r.tex.height)) * (1 - b.grow * 0.5 + b.grow * Math.sqrt(u));
      s.scale.set(k, k * 0.8);
      s.alpha = u < 0.15 ? 1 : Math.max(0, 1 - (u - 0.15) / 0.85);
    }
    this.bursts = keep;
  }

  /** Poison clouds and caltrops, on the ground where they are. */
  private drawClouds(sim: Sim, v: FxView): void {
    const cloud = this.tex('poison-cloud');
    if (cloud) {
      for (const c of sim.clouds) {
        const p = v.at(c.pos.x, c.pos.y, v.floor(c.pos.x, c.pos.y) + 4);
        const w = c.radius * 2 * v.scale * 1.25;
        for (let k = 0; k < 2; k++) {
          const s = this.groundPool.take(cloud);
          s.position.set(p.x, p.y - k * 3);
          s.rotation = (k ? -1 : 1) * this.clock * 0.25 + c.id;
          const breathe = 1 + 0.06 * Math.sin(this.clock * 2 + c.id + k);
          s.scale.set((w / cloud.width) * breathe, (w / cloud.height) * 0.62 * breathe);
          s.alpha = Math.min(1, c.ttl) * (k ? 0.5 : 0.75);
        }
      }
    }
    const barb = this.tex('barb');
    if (barb) {
      for (const k of sim.caltrops) {
        for (let i = 0; i < 3; i++) {
          const a = i * 2.1 + k.id;
          const p = v.at(k.pos.x + Math.cos(a) * 5, k.pos.y + Math.sin(a) * 5, v.floor(k.pos.x, k.pos.y) + 2);
          const s = this.groundPool.take(barb);
          s.position.set(p.x, p.y);
          s.rotation = a;
          s.scale.set(12 * v.scale / barb.width);
          s.alpha = Math.min(1, k.ttl / 2);
        }
      }
    }
  }

  /**
   * What is done to a unit, on the unit: a web over one that is snared, a puff of poison over
   * one that is poisoned, flames licking up off one that burns. `r`: its size in board pixels.
   */
  status(p: Pt, r: number, snared: boolean, poisoned: boolean, burning: boolean, seed: number): void {
    if (snared) {
      const t = this.tex('web-mat');
      if (t) {
        const s = this.airPool.take(t);
        s.position.set(p.x, p.y + r * 0.2);
        s.scale.set((r * 2.4) / t.width, (r * 1.7) / t.height);
        s.rotation = seed;
        s.alpha = 0.8;
      }
    }
    if (poisoned) {
      const t = this.tex('poison-cloud');
      if (t) {
        const s = this.airPool.take(t);
        s.position.set(p.x + Math.sin(this.clock * 1.5 + seed) * r * 0.2, p.y - r * 0.9);
        s.scale.set((r * 1.3) / t.width);
        s.rotation = this.clock * 0.6 + seed;
        s.alpha = 0.55;
      }
    }
    if (burning) {
      const k = 1 + ((Math.floor(this.clock * 12) + seed) % 2);
      const t = this.tex(`flame-${k}`);
      if (t) {
        const s = this.glowPool.take(t);
        s.anchor.set(0, 0.5);
        s.position.set(p.x, p.y + r * 0.3);
        s.rotation = -Math.PI / 2;
        s.scale.set((r * 2.2) / t.width, (r * 1.4) / t.height);
        s.alpha = 0.9;
      }
    }
  }

  /** The researcher's sedation line to the limb it is taking: a thin teal beam. */
  tether(from: Pt, to: Pt, pulse: number): void {
    const t = this.tex('beam');
    if (!t) return;
    const s = this.glowPool.take(t);
    s.anchor.set(0, 0.5);
    s.position.set(from.x, from.y);
    s.rotation = Math.atan2(to.y - from.y, to.x - from.x);
    s.scale.set(Math.hypot(to.x - from.x, to.y - from.y) / t.width, 5 / t.height);
    s.tint = 0x4fe0d0;
    s.alpha = 0.6 + 0.3 * Math.sin(pulse * 6);
  }
}

