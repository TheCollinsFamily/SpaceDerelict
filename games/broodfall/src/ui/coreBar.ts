/**
 * THE CORE'S HEALTH ON THE BOARD (Bruno, Nov 27 2026: "add a health bar to the core; it's not clear to me how much it
 * has left when troops damage it, if it heals after a wave etc"). A bar over the core with its number ("1384 / 1500"):
 * what a blow took fades out behind the fill, and a heal (the Queen's Heart decree, the only one: the core does not
 * heal between waves) rises over it in green. Page markup over the canvas, placed each frame at the top of the core's
 * picture (IsoRenderer.coreTop), so its words are the HUD's and follow the text size.
 */
import type { Sim } from '../sim/sim';

export interface CoreTop { x: number; y: number; w: number }

export class CoreBar {
  private el: HTMLElement;
  private fill: HTMLElement;
  private lag: HTMLElement;
  private num: HTMLElement;
  private lastHp = -1;
  private lastMax = -1;

  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'core-bar';
    this.el.className = 'hidden';
    this.el.innerHTML = '<div class="cb-track"><div class="cb-lag"></div><div class="cb-fill"></div></div><div class="cb-num"></div>';
    this.fill = this.el.querySelector('.cb-fill')!;
    this.lag = this.el.querySelector('.cb-lag')!;
    this.num = this.el.querySelector('.cb-num')!;
    host.appendChild(this.el);
  }

  /** `at`: the top of the core's picture in the host's pixels, or null when the board does not show it. */
  update(sim: Sim, at: CoreTop | null, show: boolean): void {
    if (!show || !at) { this.el.classList.add('hidden'); return; }
    this.el.classList.remove('hidden');
    const hp = Math.max(0, Math.ceil(sim.coreHp));
    const max = Math.round(sim.coreMaxHp);
    const frac = max > 0 ? Math.min(1, hp / max) : 0;
    this.el.style.left = `${Math.round(at.x)}px`;
    this.el.style.top = `${Math.round(at.y)}px`;
    this.el.style.width = `${Math.round(Math.max(96, Math.min(180, at.w * 0.75)))}px`;
    if (hp !== this.lastHp || max !== this.lastMax) {
      const w = `${(frac * 100).toFixed(1)}%`;
      this.fill.style.width = w;
      this.lag.style.width = w;
      this.fill.classList.toggle('low', frac <= 0.4);
      this.num.textContent = `${hp} / ${max}`;
      if (this.lastHp >= 0 && hp > this.lastHp) this.gain(hp - this.lastHp);
      this.lastHp = hp;
      this.lastMax = max;
    }
  }

  /** A heal rises over the bar in green, and is gone in two seconds. */
  private gain(n: number): void {
    const g = document.createElement('div');
    g.className = 'cb-gain';
    g.textContent = `+${n}`;
    this.el.appendChild(g);
    window.setTimeout(() => g.remove(), 2000);
  }
}
