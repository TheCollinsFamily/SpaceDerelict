/**
 * The campaign map as the ship shows it: a holographic projection of the planet, divided
 * into zones (Collins, Sep 29 2026: "a holographic projection of the planet with zones").
 *
 * The planet is a picture (public/art/ship/planet.webp) wrapped on a sphere. Every point of
 * the surface belongs to the landing site nearest to it, which gives each site its zone;
 * a zone is filled by what it is to the player (held, open to land on, under attack).
 * Plain arithmetic on pixels: no library, and the same projection the site markers use.
 */
export type ZoneState = 'held' | 'open' | 'locked' | 'attack';
/** `growth`: how far the brood's flesh has spread over a zone it holds, 0..1 (heldGrowth). */
export interface Zone { id: string; lat: number; lon: number; state: ZoneState; growth?: number }

/**
 * How far the flesh has spread over held ground (Oct 1 2026: "have regions look infested when they
 * are infested on the map"). The save keeps the held territories in the order they were taken: the
 * newest capture is a blot around its landing site, the one before it most of the way to its borders,
 * anything older (and the crash site, where it began) covered.
 */
export const GROWTH_BY_AGE = [0.34, 0.68, 1];
export function heldGrowth(held: string[], id: string): number {
  const i = held.indexOf(id);
  if (i < 0) return 0;
  if (i === 0) return 1;
  return GROWTH_BY_AGE[Math.min(held.length - 1 - i, GROWTH_BY_AGE.length - 1)];
}
/** A zone with no growth given: held ground is fully covered, anything else bare. */
export function infestGrowth(state: ZoneState): number {
  return state === 'held' || state === 'attack' ? 1 : 0;
}

/** Value noise on the sphere (the flat painter's flesh; the 3D planet has its own in GLSL). */
function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const s = (t: number) => t * t * (3 - 2 * t);
  const fx = s(x - xi), fy = s(y - yi), fz = s(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const h = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz);
  return l(l(l(h(0, 0, 0), h(1, 0, 0), fx), l(h(0, 1, 0), h(1, 1, 0), fx), fy),
           l(l(h(0, 0, 1), h(1, 0, 1), fx), l(h(0, 1, 1), h(1, 1, 1), fx), fy), fz);
}
export function fbm3(x: number, y: number, z: number, oct = 4): number {
  let sum = 0, a = 0.5;
  for (let i = 0; i < oct; i++) { sum += a * noise3(x, y, z); x *= 2.03; y *= 2.03; z *= 2.03; a *= 0.5; }
  return sum;
}

/**
 * How much of the flesh covers a place of a held zone, 0..1: a ragged front out from the site
 * (rd: 0 at the site, 1 where the zone's reach ends) that has spread as far as `growth`.
 */
export function creepCover(rd: number, growth: number, warp: number): number {
  if (growth <= 0) return 0;
  const r = rd + warp;
  const lim = growth * 1.45;
  const t = Math.max(0, Math.min(1, (r - (lim - 0.14)) / 0.14));
  return 1 - t * t * (3 - 2 * t);
}

export const GLOBE = { size: 420, r: 190, tilt: 18 };
const RAD = Math.PI / 180;
/** How far from its site a zone reaches, as an angle at the planet's centre. */
const REACH = 30 * RAD;

/** A place on the planet, on the globe's picture. `front`: is it on the side we see? */
export function projectSite(lat: number, lon: number, spin: number): { x: number; y: number; front: boolean } {
  const la = lat * RAD;
  const lo = (lon - spin) * RAD;
  const t = GLOBE.tilt * RAD;
  const c = GLOBE.size / 2;
  return {
    x: c + GLOBE.r * Math.cos(la) * Math.sin(lo),
    y: c - GLOBE.r * (Math.cos(t) * Math.sin(la) - Math.sin(t) * Math.cos(la) * Math.cos(lo)),
    front: Math.sin(t) * Math.sin(la) + Math.cos(t) * Math.cos(la) * Math.cos(lo) > 0,
  };
}

/** The place on the planet that a point of the globe's picture shows, or null off the disc. */
export function unprojectSite(x: number, y: number, spin: number): { lat: number; lon: number } | null {
  const c = GLOBE.size / 2;
  const px = (x - c) / GLOBE.r;
  const py = (c - y) / GLOBE.r;
  const d = px * px + py * py;
  if (d > 1) return null;
  const pz = Math.sqrt(1 - d);
  const t = GLOBE.tilt * RAD;
  // Undo the tilt (a turn about the x axis), then read off the angles.
  const yy = py * Math.cos(t) + pz * Math.sin(t);
  const zz = -py * Math.sin(t) + pz * Math.cos(t);
  return { lat: Math.asin(Math.max(-1, Math.min(1, yy))) / RAD, lon: Math.atan2(px, zz) / RAD + spin };
}

/** Which zone a place belongs to: the nearest site within reach, or -1. */
export function zoneAt(lat: number, lon: number, zones: Zone[]): number {
  const la = lat * RAD;
  const lo = lon * RAD;
  const x = Math.cos(la) * Math.sin(lo), y = Math.sin(la), z = Math.cos(la) * Math.cos(lo);
  let best = -1;
  let bestDot = Math.cos(REACH);
  for (let i = 0; i < zones.length; i++) {
    const a = zones[i].lat * RAD;
    const o = zones[i].lon * RAD;
    const dot = x * Math.cos(a) * Math.sin(o) + y * Math.sin(a) + z * Math.cos(a) * Math.cos(o);
    if (dot > bestDot) { bestDot = dot; best = i; }
  }
  return best;
}

const FILL: Record<ZoneState, [number, number, number, number]> = {
  held: [190, 38, 34, 0.62],
  attack: [255, 150, 40, 0.6],
  open: [150, 235, 250, 0.2],
  locked: [0, 0, 0, 0],
};
const EDGE: Record<ZoneState, [number, number, number]> = {
  held: [255, 120, 110], attack: [255, 190, 90], open: [200, 250, 255], locked: [110, 160, 175],
};

export class Globe {
  private map: ImageData | null = null;

  /** The picture of the planet, once it has loaded. Without it the globe is plain. */
  async load(url: string): Promise<void> {
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      this.map = g.getImageData(0, 0, c.width, c.height);
    } catch {
      this.map = null;
    }
  }

  paint(canvas: HTMLCanvasElement, spin: number, zones: Zone[], selected: string | null): void {
    const S = GLOBE.size;
    canvas.width = S;
    canvas.height = S;
    const g = canvas.getContext('2d')!;
    const out = g.createImageData(S, S);
    const zone = new Int16Array(S * S).fill(-2);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p = unprojectSite(x + 0.5, y + 0.5, spin);
      if (!p) continue;
      zone[y * S + x] = zoneAt(p.lat, p.lon, zones);
    }
    const c = S / 2;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const z = zone[i];
      if (z === -2) continue;
      const p = unprojectSite(x + 0.5, y + 0.5, spin)!;
      // The planet's own relief, as light: land is brighter than sea.
      let land = 0.3;
      if (this.map) {
        const u = ((((p.lon + 180) / 360) % 1) + 1) % 1;
        const v = Math.max(0, Math.min(0.999, (90 - p.lat) / 180));
        const m = (Math.floor(v * this.map.height) * this.map.width + Math.floor(u * this.map.width)) * 4;
        const r = this.map.data[m], gr = this.map.data[m + 1], b = this.map.data[m + 2];
        // Sea is blue: what is not blue is land, and brighter land is higher or drier.
        const sea = b > r * 1.25 && b > gr * 1.05;
        land = sea ? 0.1 + (r + gr + b) / 2400 : 0.42 + (r + gr + b) / 1500;
      }
      const edge = Math.hypot(x + 0.5 - c, y + 0.5 - c) / GLOBE.r;
      const rim = Math.pow(edge, 6);
      const scan = y % 3 === 0 ? 0.82 : 1;
      let r = (20 + 120 * land) * scan + 90 * rim;
      let gr = (44 + 190 * land) * scan + 150 * rim;
      let b = (58 + 200 * land) * scan + 170 * rim;
      if (z >= 0) {
        const zn = zones[z];
        const st = zn.state;
        const growth = zn.growth ?? infestGrowth(st);
        if (growth > 0) {
          // The flesh, as on the 3D planet: spread out of the site, ragged, veined; thin on the sea.
          const la = p.lat * RAD, lo = p.lon * RAD;
          const px = Math.cos(la) * Math.sin(lo), py = Math.sin(la), pz = Math.cos(la) * Math.cos(lo);
          const sa = zn.lat * RAD, so = zn.lon * RAD;
          const dot = px * Math.cos(sa) * Math.sin(so) + py * Math.sin(sa) + pz * Math.cos(sa) * Math.cos(so);
          const rd = (1 - dot) / (1 - Math.cos(REACH));
          const warp = (fbm3(px * 6 + 11, py * 6 + 11, pz * 6 + 11, 3) - 0.5) * 0.6 + (fbm3(px * 21 + 2, py * 21 + 2, pz * 21 + 2, 2) - 0.5) * 0.22;
          const cov = creepCover(rd, growth, warp) * (land < 0.3 ? 0.45 : 1);
          const v = 1 - Math.abs(fbm3(px * 8, py * 8, pz * 8, 4) * 2 - 1);
          const vein = Math.max(0, Math.min(1, (v - 0.9) / 0.085));
          const mott = fbm3(px * 15 + 5, py * 15 + 5, pz * 15 + 5, 3);
          const fr = 40 + 90 * mott + 180 * vein, fg = 4 + 14 * mott + 40 * vein, fb = 8 + 14 * mott + 25 * vein;
          r = r * (1 - cov) + fr * cov;
          gr = gr * (1 - cov) + fg * cov;
          b = b * (1 - cov) + fb * cov;
          if (st === 'attack') { r += 60 * cov; gr += 30 * cov; }
        } else {
          const f = FILL[st];
          r = r * (1 - f[3]) + f[0] * f[3] * (0.55 + land * 0.6);
          gr = gr * (1 - f[3]) + f[1] * f[3] * (0.55 + land * 0.6);
          b = b * (1 - f[3]) + f[2] * f[3] * (0.55 + land * 0.6);
        }
      }
      // Where one zone meets another, or the open planet: a thin bright line.
      const other = (zone[i + 1] ?? z) !== z || (zone[i + S] ?? z) !== z || (zone[i - 1] ?? z) !== z || (zone[i - S] ?? z) !== z;
      if (other && edge < 0.985) {
        const a = z >= 0 ? zones[z] : null;
        const near = [zone[i + 1], zone[i - 1], zone[i + S], zone[i - S]].find((k) => k !== undefined && k >= 0);
        const st = a?.state ?? (near !== undefined ? zones[near].state : 'locked');
        const chosen = a?.id === selected || (near !== undefined && zones[near].id === selected);
        const e = chosen ? [255, 255, 255] : EDGE[st];
        const k = chosen ? 1 : st === 'locked' ? 0.5 : 0.85;
        r = r * (1 - k) + e[0] * k; gr = gr * (1 - k) + e[1] * k; b = b * (1 - k) + e[2] * k;
      }
      const o = i * 4;
      out.data[o] = Math.min(255, r);
      out.data[o + 1] = Math.min(255, gr);
      out.data[o + 2] = Math.min(255, b);
      // A projection is light: it thins toward the edge of the disc.
      out.data[o + 3] = Math.round(255 * Math.min(1, (1 - edge) * 30) * 0.94);
    }
    g.putImageData(out, 0, 0);
  }
}
