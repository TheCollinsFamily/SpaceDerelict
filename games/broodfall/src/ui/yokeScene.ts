/**
 * A scene YOKE acts out full-screen over the ship (content/yokeScenes.ts): a sequence of clips
 * or stills, the last one held while her voice comes from the ship's speakers with her words on
 * the screen. Until the clips exist, storyboard cards stand in for them, one per stage.
 */
import { artUrl, loadManifest } from '../render/art';
import { loadSettings } from '../meta/storage';

export interface SceneStage { id: string; card: string; ms: number }

/**
 * Where a clip is blurred in SFW mode (Settings → Content): at `t` seconds, a box in fractions of the picture
 * (x, y its top left). Between two keys the box slides; before the first it holds; after the last there is none.
 */
export interface BlurKey { t: number; x: number; y: number; w: number; h: number }

/** One piece of a scene: a clip or a still; `loop`: it keeps playing (the last, under her voice). */
export interface SceneMedia { src: string; loop?: boolean; seconds?: number; blur?: BlurKey[] }

/** The blur box at time t (null: none at that moment, or no keys). */
export function blurAt(keys: BlurKey[] | undefined, t: number): Omit<BlurKey, 't'> | null {
  if (!keys?.length) return null;
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b.t) {
      const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
      const mix = (k: 'x' | 'y' | 'w' | 'h') => a[k] + (b[k] - a[k]) * f;
      return { x: mix('x'), y: mix('y'), w: mix('w'), h: mix('h') };
    }
  }
  return null;
}

const blurKeys = (v: unknown): BlurKey[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const keys = v.filter((k): k is BlurKey => !!k && typeof k === 'object' && ['t', 'x', 'y', 'w', 'h'].every((n) => Number.isFinite((k as Record<string, unknown>)[n])));
  return keys.length ? keys.sort((a, b) => a.t - b.t) : undefined;
};

/**
 * The pieces of a scene, from YOKE's own manifest (`scenes.<key>`: file names, or {file, seconds, loop},
 * relative to public/art/ship/yoke/) or the main one (`ship.yoke.scenes.<key>`, relative to public/art/).
 */
export async function sceneMedia(key: string): Promise<SceneMedia[]> {
  const list = (v: unknown): Array<{ file: string; loop?: boolean; seconds?: number; blur?: BlurKey[] }> => {
    if (typeof v === 'string') return [{ file: v }];
    if (Array.isArray(v)) {
      return v.flatMap((x) => (typeof x === 'string' ? [{ file: x }]
        : x && typeof x === 'object' && typeof (x as { file?: unknown }).file === 'string'
          ? [{ file: (x as { file: string }).file, loop: (x as { loop?: unknown }).loop === true, seconds: Number((x as { seconds?: unknown }).seconds) || undefined, blur: blurKeys((x as { blur?: unknown }).blur) }]
          : []));
    }
    if (v && typeof v === 'object') return list((v as { clips?: unknown; files?: unknown }).clips ?? (v as { files?: unknown }).files);
    return [];
  };
  const whole = (f: string) => new URL(artUrl(f), document.baseURI).href;
  try {
    const res = await fetch(artUrl('ship/yoke/manifest.json'), { cache: 'no-cache' });
    if (res.ok) {
      const own = list(((await res.json()) as { scenes?: Record<string, unknown> })?.scenes?.[key]);
      if (own.length) return own.map((m) => ({ ...m, src: whole(`ship/yoke/${m.file}`) }));
    }
  } catch { /* none */ }
  const m = await loadManifest();
  const main = list(((m?.ship as Record<string, unknown> | undefined)?.yoke as { scenes?: Record<string, unknown> } | undefined)?.scenes?.[key]);
  return main.map((x) => ({ ...x, src: whole(x.file) }));
}

export class YokeSceneOverlay {
  private el = document.createElement('div');
  private stageEl: HTMLElement;
  private sub: HTMLElement;
  private closed = false;

  constructor(private media: SceneMedia[], private stages: SceneStage[]) {
    this.el.id = 'yoke-scene';
    this.el.innerHTML = '<div class="ys-stage"></div><div class="ys-sub"></div><div class="ys-mark">SHIP\'S HOLD · CAMERA 4</div>';
    this.stageEl = this.el.querySelector('.ys-stage')!;
    this.sub = this.el.querySelector('.ys-sub')!;
    this.el.dataset.placeholder = media.length ? '' : '1';
    document.body.appendChild(this.el);
  }

  /** The whole sequence; resolves on its last frame, which stays up. */
  async run(): Promise<void> {
    const n = Math.max(this.media.length, this.stages.length);
    for (let i = 0; i < n && !this.closed; i++) {
      const piece = this.media[i];
      const stage = this.stages[Math.min(i, this.stages.length - 1)];
      this.el.dataset.stage = stage?.id ?? String(i);
      const last = i === n - 1;
      if (piece && /\.(webm|mp4)(\?|$)/i.test(piece.src)) await this.clip(piece, last);
      else if (piece) await this.still(piece.src, stage?.ms ?? 2500);
      else await this.card(stage);
      // More media than stages: the stages are only the cards' words.
      if (!this.media.length && i >= this.stages.length - 1) break;
    }
  }

  /** A clip to its end; the last one keeps playing (looped, when it loops) and her voice comes over it after a moment. */
  private clip(piece: SceneMedia, last: boolean): Promise<void> {
    return new Promise<void>((done) => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.src = piece.src; v.className = 'ys-media';
      v.loop = last && !!piece.loop;
      let over = false;
      const end = () => { if (!over) { over = true; done(); } };
      if (!v.loop) v.onended = end;
      v.onerror = end;
      this.stageEl.replaceChildren(v);
      if (piece.blur && loadSettings().content !== 'unrestricted') this.blur(v, piece.blur);
      void v.play().catch(end);
      setTimeout(end, last ? 1600 : Math.max(2000, ((piece.seconds ?? 6) + 2) * 1000));
    });
  }

  /**
   * SFW: a blurred patch over the clip where its keys say, following the picture as it plays. The video is drawn
   * `object-fit: cover` (src/onboard.css), so the box is placed on the picture as scaled and cropped, not on the stage.
   */
  private blur(v: HTMLVideoElement, keys: BlurKey[]): void {
    const box = document.createElement('div');
    box.className = 'ys-blur';
    this.stageEl.appendChild(box);
    const place = () => {
      if (!box.isConnected) return;
      const b = blurAt(keys, v.currentTime);
      const W = v.clientWidth, H = v.clientHeight, vw = v.videoWidth || 16, vh = v.videoHeight || 9;
      const k = Math.max(W / vw, H / vh), pw = vw * k, ph = vh * k;
      const ox = v.offsetLeft + (W - pw) / 2, oy = v.offsetTop + (H - ph) / 2;
      box.style.display = b ? '' : 'none';
      if (b) Object.assign(box.style, { left: `${ox + b.x * pw}px`, top: `${oy + b.y * ph}px`, width: `${b.w * pw}px`, height: `${b.h * ph}px` });
      requestAnimationFrame(place);
    };
    place();
  }

  private still(src: string, ms: number): Promise<void> {
    const img = document.createElement('img');
    img.src = src; img.className = 'ys-media'; img.alt = '';
    this.stageEl.replaceChildren(img);
    return new Promise((r) => setTimeout(r, ms));
  }

  private card(stage: SceneStage | undefined): Promise<void> {
    const c = document.createElement('div');
    c.className = 'ys-card';
    c.textContent = stage?.card ?? '';
    this.stageEl.replaceChildren(c);
    return new Promise((r) => setTimeout(r, stage?.ms ?? 2500));
  }

  /** Her words, on the screen while she says them. */
  subtitle(text: string): void {
    this.sub.textContent = text;
    this.sub.classList.add('on');
  }

  close(): void {
    this.closed = true;
    this.el.classList.add('leaving');
    setTimeout(() => this.el.remove(), 400);
  }
}
