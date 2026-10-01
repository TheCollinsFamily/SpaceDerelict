/**
 * THE ORGAN STAGE'S SKYLINE, ALIVE (Oct 1 2026, notes/VIDEO-AUDIT.md). The skyline over the organ stage is a thin
 * wireframe drawing of the city above (one per tile set); a video model would melt its lines, so it is lit in CSS:
 * a red warning light blinking on its tallest spire, a faint wisp of smoke from the tallest roof of its other half,
 * and a slow searchlight sweeping up from the city's inner edge by the meteor. The points are read from each picture
 * by tools/art/skyline-life.mjs (public/art/under/skyline-life.json). Nothing under Reduce motion (settings.css stops
 * every animation; the light then simply stays lit). This file touches only the skyline: the organ loops are
 * src/ui/underAlive.ts's.
 */
import { artUrl } from '../render/art';
import './skylineLife.css';

type Points = { beacon: [number, number]; smoke: [number, number]; search: [number, number] };
let points: Record<string, Points> | null = null;
let asked = false;

/** Put the skyline's life over `surface` (#under-surface) for the tile set `set`; again for a new set. */
export function skylineLife(surface: HTMLElement, set: string): void {
  if (!points) {
    if (!asked) {
      asked = true;
      void fetch(artUrl('under/skyline-life.json'), { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null))
        .then((j) => { points = j ?? {}; if (surface.isConnected) skylineLife(surface, surface.dataset.lifeSet ?? set); })
        .catch(() => { points = {}; });
    }
    surface.dataset.lifeSet = set;
    return;
  }
  const p = points[set] ?? points.orthodox;
  let el = surface.querySelector<HTMLElement>('.skyline-life');
  if (!p) { el?.remove(); return; }
  if (el?.dataset.set === set) return;
  if (!el) {
    el = document.createElement('div');
    el.className = 'skyline-life';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<i class="sl-beam"></i><i class="sl-smoke"><b></b><b></b><b></b></i><i class="sl-beacon"></i>';
    const img = surface.querySelector('.skyline-img');
    if (img) img.after(el); else surface.append(el);
  }
  el.dataset.set = set;
  const at = (k: keyof Points) => `--${k}-x:${(p[k][0] * 100).toFixed(2)}%;--${k}-y:${(p[k][1] * 100).toFixed(2)}%`;
  el.setAttribute('style', [at('beacon'), at('smoke'), at('search'), `--lean:${p.search[0] < 0.5 ? 1 : -1}`].join(';'));
}
