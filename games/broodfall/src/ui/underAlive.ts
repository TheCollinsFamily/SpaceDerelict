/**
 * THE ORGAN STAGE ALIVE, drawn (Sep 30 2026). Every living tile (an organ, a resolved deposit, a
 * feature) plays its loop strip (tools/art/templates/under-loops.mjs) on ONE canvas under the
 * grid's cells, instead of a CSS animation per cell: a background-position animation per cell
 * made the browser paint the grid again every frame (a busy stage fell from ~36 to ~16 fps under
 * load). Here a cell is drawn only when its frame changes (12 a second, each in its own phase),
 * as one drawImage from the strip, and nothing is drawn while the stage is shut.
 *
 * A cell marks itself `data-loop="<strip url>|<frames>|<anchor ms>|<1 = ping-pong>"` and carries
 * the class `alive` (its own background is then clear, so the canvas shows through; its outline,
 * glow, highlights and labels stay on top).
 */
export class UnderAlive {
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private images = new Map<string, HTMLImageElement>();
  private cells: Array<{ x: number; y: number; w: number; h: number; img: HTMLImageElement; count: number; anchor: number; pingpong: boolean; shown: number }> = [];
  private raf = 0;
  /** The clock's last step: every cell moves on the same 12-a-second step (each with its own phase), so the canvas changes 12 times a second, not every frame. */
  private step = NaN;
  /** The grid changed size: measure again before the next drawing (no layout is read in the frame loop). */
  private stale = true;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private grid: HTMLElement, private fps: number) {
    this.canvas.className = 'under-alive';
    grid.parentElement!.insertBefore(this.canvas, grid);
    new ResizeObserver(() => { this.stale = true; }).observe(grid);
    matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener?.('change', () => { this.stale = true; });
  }

  /** The grid was drawn again: read its living cells afresh. */
  scan(): void {
    this.cells = [];
    this.step = NaN;
    this.measure();
    if (this.cells.length && !this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private image(url: string): HTMLImageElement {
    let img = this.images.get(url);
    if (!img) {
      img = new Image();
      img.decoding = 'async';
      img.src = url;
      // Loaded after the cells were read: draw them.
      img.onload = () => { for (const c of this.cells) if (c.img === img) c.shown = -1; };
      this.images.set(url, img);
    }
    return img;
  }

  /** Where each living cell is, in the canvas's pixels; the canvas sized to the grid. */
  private measure(): void {
    const g = this.grid;
    const dpr = window.devicePixelRatio || 1;
    const W = g.clientWidth, H = g.clientHeight;
    this.stale = false;
    Object.assign(this.canvas.style, { left: `${g.offsetLeft + g.clientLeft}px`, top: `${g.offsetTop + g.clientTop}px`, width: `${W}px`, height: `${H}px` });
    this.canvas.width = Math.max(1, Math.round(W * dpr));
    this.canvas.height = Math.max(1, Math.round(H * dpr));
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.cells = [...g.querySelectorAll<HTMLElement>('[data-loop]')].map((el) => {
      const [url, n, anchor, pong] = el.dataset.loop!.split('|');
      return {
        x: Math.round(el.offsetLeft * dpr), y: Math.round(el.offsetTop * dpr),
        w: Math.round(el.offsetWidth * dpr), h: Math.round(el.offsetHeight * dpr),
        img: this.image(url), count: Number(n), anchor: Number(anchor), pingpong: pong === '1', shown: -1,
      };
    });
  }

  private tick = (now: number): void => {
    this.raf = 0;
    if (!this.cells.length) return;
    if (this.stale) this.measure();
    // data-frozen (tools/shot-organ-alive.mjs, to measure the frame rate without the loops): nothing drawn.
    if (this.canvas.dataset.frozen) { this.raf = requestAnimationFrame(this.tick); return; }
    // Settings > Reduce motion (or the system's): the tiles hold their first frame.
    const still = document.documentElement.classList.contains('reduce-motion') || this.reduced.matches;
    const step = Math.floor((now / 1000) * this.fps);
    if (step === this.step && !this.cells.some((c) => c.shown < 0)) { this.raf = requestAnimationFrame(this.tick); return; }
    this.step = step;
    for (const c of this.cells) {
      if (!c.img.complete || !c.img.naturalWidth) continue;
      const k = still ? 0 : step - Math.floor((c.anchor / 1000) * this.fps);
      let f: number;
      if (c.pingpong) {
        const p = 2 * (c.count - 1);
        const m = ((k % p) + p) % p;
        f = m < c.count ? m : p - m;
      } else f = ((k % c.count) + c.count) % c.count;
      if (f === c.shown) continue;
      c.shown = f;
      // The frame is square and the cell wider than tall: cut its middle band, as `cover` does.
      const fw = c.img.naturalWidth / c.count, fh = c.img.naturalHeight;
      const sh = Math.min(fh, (fw * c.h) / c.w);
      this.ctx.drawImage(c.img, f * fw, (fh - sh) / 2, fw, sh, c.x, c.y, c.w, c.h);
    }
    this.raf = requestAnimationFrame(this.tick);
  };
}
