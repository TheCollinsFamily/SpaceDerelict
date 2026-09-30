/**
 * A scene YOKE acts out full-screen over the ship (content/yokeScenes.ts): a sequence of clips
 * or stills, the last one held while her voice comes from the ship's speakers with her words on
 * the screen. Until the clips exist, storyboard cards stand in for them, one per stage.
 */
import { artUrl, loadManifest } from '../render/art';

export interface SceneStage { id: string; card: string; ms: number }

/** The files of a scene, from YOKE's own manifest (`scenes.<key>`) or the main one (`ship.yoke.scenes.<key>`): absolute URLs, in order. */
export async function sceneMedia(key: string): Promise<string[]> {
  const list = (v: unknown): string[] => {
    if (typeof v === 'string') return [v];
    if (Array.isArray(v)) return v.flatMap((x) => (typeof x === 'string' ? [x] : x && typeof x === 'object' && typeof (x as { file?: unknown }).file === 'string' ? [(x as { file: string }).file] : []));
    if (v && typeof v === 'object') return list((v as { clips?: unknown; files?: unknown }).clips ?? (v as { files?: unknown }).files);
    return [];
  };
  try {
    const res = await fetch(artUrl('ship/yoke/manifest.json'), { cache: 'no-cache' });
    if (res.ok) {
      const own = list(((await res.json()) as { scenes?: Record<string, unknown> })?.scenes?.[key]);
      if (own.length) return own.map((f) => new URL(artUrl(f.includes('/') ? f : `ship/yoke/${f}`), document.baseURI).href);
    }
  } catch { /* none */ }
  const m = await loadManifest();
  const main = list(((m?.ship as Record<string, unknown> | undefined)?.yoke as { scenes?: Record<string, unknown> } | undefined)?.scenes?.[key]);
  return main.map((f) => new URL(artUrl(f), document.baseURI).href);
}

export class YokeSceneOverlay {
  private el = document.createElement('div');
  private stageEl: HTMLElement;
  private sub: HTMLElement;
  private closed = false;

  constructor(private media: string[], private stages: SceneStage[]) {
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
      const file = this.media[i];
      const stage = this.stages[Math.min(i, this.stages.length - 1)];
      this.el.dataset.stage = stage?.id ?? String(i);
      if (file && /\.(webm|mp4)(\?|$)/i.test(file)) await this.clip(file);
      else if (file) await this.still(file, stage?.ms ?? 2500);
      else await this.card(stage);
      // More media than stages: the stages are only the cards' words.
      if (!this.media.length && i >= this.stages.length - 1) break;
    }
  }

  private clip(src: string): Promise<void> {
    return new Promise<void>((done) => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.src = src; v.className = 'ys-media';
      let over = false;
      const end = () => { if (!over) { over = true; done(); } };
      v.onended = end; v.onerror = end;
      this.stageEl.replaceChildren(v);
      void v.play().catch(end);
      setTimeout(end, 15000);
    });
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
