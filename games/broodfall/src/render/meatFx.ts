/**
 * MEAT DROPS, drawn (Sep 30 2026; notes/TO-CREATE.md "Meat drops: no picture of their own"). A kill drops
 * meat of its caste; the sim flies it to the core and banks it (src/sim/sim.ts `updateDrops`). It was a
 * 6-pixel square. Now:
 *
 *  - it is a chunk of the insect it came from (public/art/fx/meat.webp, tools/art/meat.mjs): war = torn
 *    muscle and chitin, science = teal brain and ganglia, royal = golden jelly glands; two looks a caste,
 *    picked by the drop's id, a bigger chunk for a bigger amount;
 *  - it pops up off the body, then glides to the core bobbing and turning, a faint trail of its caste's
 *    colour behind it and its shadow on the ground under it;
 *  - when the core takes it, a small pickup: the chunk is swallowed (shrinks into the core), a ring of its
 *    caste's colour opens and a few sparks fly off.
 *
 * Only reads the sim. Without the meat sheet the renderer draws its old squares (src/render/isoRender.ts).
 */
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Sim } from '../sim/sim';
import type { Caste } from '../sim/types';
import type { BoardArtSet } from './art';
import type { FxView, Pt } from './fx';
import { CASTE_COLORS } from './render';

interface Flight { caste: Caste; look: string; born: number; x: number; y: number; up: number; size: number; seen: number; spin: number }
interface Pickup { caste: Caste; look: string; from: Pt; to: Pt; t: number; size: number; seed: number }

const POP = 0.28;
const PICKUP = 0.55;

export class MeatFx {
  readonly ground = new Container();
  readonly air = new Container();
  readonly glow = new Container();
  private sprites: Sprite[] = [];
  private shadows: Sprite[] = [];
  private used = 0;
  private shUsed = 0;
  private g = new Graphics();
  private flights = new Map<number, Flight>();
  private pickups: Pickup[] = [];
  private clock = 0;
  private frame = 0;
  /** How many pickups have played (the beats read it). */
  pickedUp = 0;

  constructor(private art: BoardArtSet) {
    this.glow.blendMode = 'add';
    this.glow.addChild(this.g);
  }

  ready(): boolean { return this.art.fx.has('meat'); }

  reset(): void { this.flights.clear(); this.pickups = []; }

  /** On screen now (the beats read it). */
  counts(): { flying: number; pickups: number; pickedUp: number } {
    return { flying: this.flights.size, pickups: this.pickups.length, pickedUp: this.pickedUp };
  }

  private tex(id: string): Texture | null { return this.art.fxSprite('meat', id)?.tex ?? null; }

  private take(tex: Texture): Sprite {
    let s = this.sprites[this.used];
    if (!s) { s = new Sprite(tex); s.anchor.set(0.5); this.air.addChild(s); this.sprites.push(s); }
    this.used++;
    s.texture = tex; s.visible = true; s.alpha = 1; s.rotation = 0; s.tint = 0xffffff;
    return s;
  }

  private shadow(tex: Texture): Sprite {
    let s = this.shadows[this.shUsed];
    if (!s) { s = new Sprite(tex); s.anchor.set(0.5); s.tint = 0x000000; this.ground.addChild(s); this.shadows.push(s); }
    this.shUsed++;
    s.texture = tex; s.visible = true;
    return s;
  }

  draw(sim: Sim, v: FxView, dt: number): void {
    this.frame++;
    this.clock += dt;
    this.used = 0; this.shUsed = 0;
    this.g.clear();
    const core = v.at(sim.core.x, sim.core.y, v.floor(sim.core.x, sim.core.y) + 26);
    for (const d of sim.drops) {
      let f = this.flights.get(d.id);
      if (!f) {
        const look = `meat-${d.caste}-${(d.id % 2) + 1}`;
        // A bigger chunk for more meat: 1 → 24 world px, 8 → 31, 32+ → 36 (it has to read beside a unit).
        const size = 24 + Math.min(12, Math.log2(Math.max(1, d.amount)) * 2.4);
        f = { caste: d.caste, look, born: this.clock, x: d.pos.x, y: d.pos.y, up: 0, size, seen: 0, spin: ((d.id * 2.39996) % 2) - 1 };
        this.flights.set(d.id, f);
      }
      f.seen = this.frame;
      f.x = d.pos.x; f.y = d.pos.y;
      const age = this.clock - f.born;
      const ground = v.floor(d.pos.x, d.pos.y);
      // Pops up off the body (an arc), then glides at a bobbing height.
      const pop = Math.min(1, age / POP);
      const cruise = 24 + Math.sin(age * 7 + f.spin * 3) * 3;
      f.up = ground + (pop < 1 ? Math.sin(pop * Math.PI * 0.5) * cruise + Math.sin(pop * Math.PI) * 16 : cruise);
      const tex = this.tex(f.look);
      if (!tex) continue;
      const p = v.at(d.pos.x, d.pos.y, f.up);
      const px = (f.size * v.scale) / Math.max(tex.width, tex.height);
      const s = this.take(tex);
      s.position.set(p.x, p.y);
      s.rotation = Math.sin(age * 3.1 + f.spin * 5) * 0.35 + f.spin * age * 1.2;
      // It lands with a squash at the top of its pop.
      const squash = pop < 1 ? 1 + Math.sin(pop * Math.PI) * 0.18 : 1 + Math.sin(age * 9) * 0.04;
      s.scale.set(px * squash, px / squash);
      const sh = this.shadow(tex);
      const gp = v.at(d.pos.x, d.pos.y, ground);
      sh.position.set(gp.x, gp.y);
      sh.alpha = 0.26;
      sh.scale.set(px * 0.9, px * 0.38);
      // A faint trail of its caste's colour, toward where it came from.
      const col = CASTE_COLORS[d.caste];
      const dx = sim.core.x - d.pos.x, dy = sim.core.y - d.pos.y;
      const m = Math.hypot(dx, dy) || 1;
      for (let k = 1; k <= 4; k++) {
        const t = v.at(d.pos.x - (dx / m) * k * 5, d.pos.y - (dy / m) * k * 5, f.up);
        this.g.circle(t.x, t.y, (f.size * v.scale) * (0.28 - k * 0.05)).fill({ color: col, alpha: 0.2 - k * 0.04 });
      }
    }
    // A drop that is gone was banked: the core swallows it.
    for (const [id, f] of this.flights) {
      if (f.seen === this.frame) continue;
      this.flights.delete(id);
      if (this.pickups.length < 40) {
        this.pickups.push({ caste: f.caste, look: f.look, from: v.at(f.x, f.y, f.up), to: core, t: 0, size: f.size, seed: id });
        this.pickedUp++;
      }
    }
    this.pickups = this.pickups.filter((pk) => (pk.t += dt) < PICKUP);
    for (const pk of this.pickups) {
      const k = pk.t / PICKUP;
      const col = CASTE_COLORS[pk.caste];
      // The chunk: pulled into the core and shrinking, over the first half.
      const tex = this.tex(pk.look);
      if (tex && k < 0.5) {
        const e = k / 0.5;
        const s = this.take(tex);
        s.position.set(pk.from.x + (pk.to.x - pk.from.x) * e, pk.from.y + (pk.to.y - pk.from.y) * e);
        const px = ((pk.size * v.scale) / Math.max(tex.width, tex.height)) * (1 - e * 0.85);
        s.scale.set(px);
        s.alpha = 1 - e * 0.4;
      }
      // The ring and the sparks, where it went in.
      const r = (10 + k * 42) * v.scale;
      this.g.circle(pk.to.x, pk.to.y, r).stroke({ width: 2.5 * v.scale * (1 - k) + 0.5, color: col, alpha: 0.85 * (1 - k) });
      this.g.circle(pk.to.x, pk.to.y, (8 * (1 - k) + 2) * v.scale).fill({ color: col, alpha: 0.35 * (1 - k) });
      for (let i = 0; i < 6; i++) {
        const a = pk.seed * 1.7 + (i * Math.PI) / 3;
        const d = (6 + k * 34) * v.scale;
        this.g.circle(pk.to.x + Math.cos(a) * d, pk.to.y + Math.sin(a) * d * 0.6 - k * 8 * v.scale, 1.6 * v.scale * (1 - k) + 0.4).fill({ color: 0xffffff, alpha: 0.9 * (1 - k) });
      }
    }
    for (let i = this.used; i < this.sprites.length; i++) this.sprites[i].visible = false;
    for (let i = this.shUsed; i < this.shadows.length; i++) this.shadows[i].visible = false;
  }
}
