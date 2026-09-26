/** Deterministic seeded RNG (mulberry32). The sim must never touch Math.random. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  /** [0, 1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  float(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  int(minIncl: number, maxIncl: number): number {
    return minIncl + Math.floor(this.next() * (maxIncl - minIncl + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.min(arr.length - 1, Math.floor(this.next() * arr.length))];
  }
  /** Weighted pick; weights must be >= 0 and sum > 0. */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
    let total = 0;
    for (const it of items) total += Math.max(0, weightOf(it));
    let roll = this.next() * total;
    for (const it of items) {
      roll -= Math.max(0, weightOf(it));
      if (roll <= 0) return it;
    }
    return items[items.length - 1];
  }
}
