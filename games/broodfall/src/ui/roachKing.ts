/**
 * THE ROACH KING ON THE AIR (Oct 1 2026; content/roachKing.ts, src/meta/roachKing.ts).
 *
 * After a deployment's news (main.ts, after src/ui/newsreel.ts newsAfterDeployment), one of his addresses to
 * the nation may play: the ship's survey caught it off the Commonwealth's television band, and YOKE renders
 * it (content/translation.ts, channel 'roach'): the band on the title card, the source signal heard under
 * each line's first beat (src/audio/engine.ts translateIn), the words resolving from glyphs, her notes.
 *
 *   the card     INTERCEPTED · the channel · the address's title, over the flag on its pole
 *   the shots    each one a clip of him speaking on camera (its own sound, through the voice bus), the live
 *                bug, his name on the first, the line he says set in type under the picture
 *   the end      its last card over the flag
 *
 * A click, Esc, Enter or Space skips. Its sound follows Settings (voices) through the game's buses; the
 * words are always on screen. Reduce motion: no scan lines moving, no glyphs. Under automation it plays only
 * with localStorage['broodfall-media-auto'] = 'on', as the newsreels. Without public/media/roach/roach.json
 * (or with no clip of an address baked) nothing plays.
 */
import './roachKing.css';
import { routeMedia, translateIn, SIGNAL_LEAD_MS } from '../audio/engine';
import { gain, loadSettings } from '../meta/storage';
import { showLoader, watchBuffering } from './loader';
import { mediaAllowed, mediaUrl } from './newsreel';
import { bandHtml, decode, lineHtml } from './translation';
import { filmArt, loadScenes, playCutscene } from './cutscene';
import { ROACH_ADDRESSES, ROACH_KING, ROACH_SCENES, type RoachAddress, type RoachScene, type RoachShot } from '../../content/roachKing';
import { dueAddress, dueAfterDeployment, dueScene, emptyRoachLog, lastMissionScenes, logRoach, type RoachLog } from '../meta/roachKing';
import { cardConfidence } from '../../content/translation';
import type { CampaignState } from '../meta/campaign';

interface RoachArt { flag?: string; flagWave?: string; clips: Record<string, { video: string; poster: string; seconds: number }> }

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const SPEAKER = 'The Roach King';

let loading: Promise<RoachArt | null> | null = null;
let art: RoachArt | null = null;
export function loadRoach(): Promise<RoachArt | null> {
  loading ??= fetch(mediaUrl('media/roach/roach.json'), { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: RoachArt | null) => (art = j && j.clips ? j : null))
    .catch(() => null);
  return loading;
}

/** The shots of an address that have a clip baked. */
const playableShots = (a: RoachAddress): RoachShot[] => a.shots.filter((s) => art?.clips[s.id]);

let playing: { id: string; shot: string } | null = null;
export interface RoachHandle { skip(): void; done: Promise<'ended' | 'skipped'> }

/** Play one address. */
export function playAddress(a: RoachAddress): RoachHandle {
  let finish: (h: 'ended' | 'skipped') => void = () => {};
  const done = new Promise<'ended' | 'skipped'>((r) => { finish = r; });
  const shots = playableShots(a);
  const reduce = loadSettings().reduceMotion;
  const el = document.createElement('div');
  // The id the rest of the game reads as "a film is playing" (main.ts), with its own look.
  el.id = 'newsreel';
  el.className = `rk-broadcast${reduce ? ' rk-still' : ''}`;
  const flagWave = art?.flagWave ? mediaUrl(art.flagWave) : '';
  const flag = art?.flag ? mediaUrl(art.flag) : '';
  el.innerHTML = `<div class="rk-screen">
      <video class="rk-v" playsinline preload="auto"></video><video class="rk-v" playsinline preload="auto"></video>
      <div class="rk-scan"></div>
      <div class="rk-bug"><span class="rk-dot"></span>LIVE</div>
      <div class="rk-tag">INTERCEPTED · SURVEY ARRAY</div>
      ${flag ? `<img class="rk-corner-flag" src="${flag}" alt="">` : ''}
      <div class="rk-lower"><div class="rk-name">${esc(ROACH_KING.name)}</div><div class="rk-known">${esc(ROACH_KING.known)}</div></div>
      <div class="rk-sub"></div>
      <div class="rk-card rk-open" style="${flagWave ? `background-image:url('${flagWave}')` : ''}">
        <div class="rk-card-in">
          <div class="rk-stamp">INTERCEPTED</div>
          <div class="rk-channel">${esc(ROACH_KING.channel)}</div>
          <div class="rk-title">${esc(a.title)}</div>
          <div class="rk-small">${esc(a.small)}</div>
          ${bandHtml('roach', a.shots.filter((s) => s.line).map((s) => `${SPEAKER}: ${s.line}`))}
        </div>
      </div>
      <div class="rk-card rk-end" style="${flagWave ? `background-image:url('${flagWave}')` : ''}"><div class="rk-card-in"><div class="rk-endline">${esc(a.end)}</div></div></div>
    </div>
    <button class="nr-skip rk-skip" type="button">SKIP ▸ <span>Esc</span></button>`;
  document.body.appendChild(el);
  playing = { id: a.id, shot: 'open' };
  el.dataset.shot = 'open';

  const layers = [...el.querySelectorAll<HTMLVideoElement>('video.rk-v')];
  const unwatch = layers.map((v) => watchBuffering(v, el));
  const sub = el.querySelector<HTMLElement>('.rk-sub')!;
  const lower = el.querySelector<HTMLElement>('.rk-lower')!;
  const open = el.querySelector<HTMLElement>('.rk-open')!;
  const last = el.querySelector<HTMLElement>('.rk-end')!;
  const timers: number[] = [];
  let over = false;
  const later = (ms: number, f: () => void) => { timers.push(window.setTimeout(() => { if (!over) f(); }, ms)); };

  const close = (how: 'ended' | 'skipped') => {
    if (over) return;
    over = true;
    for (const t of timers) clearTimeout(t);
    window.removeEventListener('keydown', onKey, true);
    unwatch.forEach((u) => u());
    el.classList.add('leaving');
    window.setTimeout(() => { for (const v of layers) { v.pause(); v.removeAttribute('src'); v.load(); } el.remove(); }, 450);
    playing = null;
    finish(how);
  };
  const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); close('skipped'); } };
  window.addEventListener('keydown', onKey, true);
  el.addEventListener('click', (ev) => { ev.stopPropagation(); close('skipped'); });

  const load = (s: RoachShot | undefined, v: HTMLVideoElement) => {
    if (!s || v.dataset.clip === s.id) return;
    const c = art!.clips[s.id];
    v.src = mediaUrl(c.video); v.poster = mediaUrl(c.poster); v.dataset.clip = s.id; v.load();
  };
  let top = 0;
  let i = -1;
  const next = () => {
    i++;
    if (i >= shots.length) { end(); return; }
    const s = shots[i];
    const v = layers[1 - top];
    load(s, v);
    try { v.currentTime = 0; } catch { /* from the start */ }
    playing!.shot = s.id;
    el.dataset.shot = s.id;
    sub.classList.remove('on');
    lower.classList.toggle('on', i === 0);
    // Through the voice bus (Settings, ducking); when there is no running sound, the element's own volume.
    if (!routeMedia(v, 'voice')) v.volume = Math.max(0, Math.min(1, gain('voice')));
    const lead = s.line && translateIn(v, 'roach') ? SIGNAL_LEAD_MS : 0;
    let advanced = false;
    const advance = () => { if (advanced) return; advanced = true; next(); };
    const go = () => {
      v.classList.add('on'); layers[top].classList.remove('on'); layers[top].pause(); top = 1 - top;
      if (s.line) {
        sub.innerHTML = lineHtml(`${SPEAKER}: ${s.line}`);
        sub.classList.add('on');
        decode(sub, 520);
      }
      later(300, () => load(shots[i + 1], layers[1 - top]));
      v.addEventListener('ended', () => later(350, advance), { once: true });
      later((art!.clips[s.id].seconds + 2.5) * 1000, advance);
    };
    const start = () => later(lead, () => { void v.play().then(go, go); });
    if (v.readyState >= 3) start();
    else {
      const w = showLoader('scan', { host: el, corner: i > 0, delay: i > 0 ? undefined : 0 });
      v.addEventListener('playing', () => w.hide(), { once: true });
      later(9000, () => w.hide());
      let begun = false;
      const once = () => { if (!begun) { begun = true; start(); } };
      v.addEventListener('canplay', once, { once: true });
      later(3000, once);
    }
  };
  const end = () => {
    sub.classList.remove('on');
    lower.classList.remove('on');
    last.classList.add('on');
    el.dataset.shot = 'end';
    if (playing) playing.shot = 'end';
    later(3000, () => close('ended'));
  };

  load(shots[0], layers[1]);
  open.classList.add('on');
  later(2800, () => { open.classList.remove('on'); next(); });
  return { skip: () => close('skipped'), done };
}

// ------------------------------------------------------------------ off the air (Collins, Oct 4 2026)
/**
 * A SCENE OFF THE AIR (content/roachKing.ts ROACH_SCENES): a private line the survey caught, or his last message.
 * Once its film is baked (content/cutscenes.ts; public/media/scenes/) it plays as that film, under the intercept's
 * kicker. Until then it is the intercept's TRANSCRIPT: the stamp, where it was caught, the title, YOKE's band, and
 * every line with who says it (her notes under them), over the flag. A transcript is read, so only CONTINUE (or Esc,
 * Enter, Space) closes it: a stray click does not.
 */
export function playRoachScene(def: RoachScene): RoachHandle {
  if (def.scene.film && filmArt(def.scene.film)) return playCutscene(def.scene.film, def.scene, { kicker: def.kicker });
  let finish: (h: 'ended' | 'skipped') => void = () => {};
  const done = new Promise<'ended' | 'skipped'>((r) => { finish = r; });
  const reduce = loadSettings().reduceMotion;
  const el = document.createElement('div');
  el.id = 'newsreel';
  el.className = `rk-broadcast rk-transcript${reduce ? ' rk-still' : ''}`;
  el.dataset.scene = def.id;
  const flagWave = art?.flagWave ? mediaUrl(art.flagWave) : '';
  const lines = def.scene.lines;
  // A speaker's name is set once over a run of his lines (the address is nine lines of one man).
  const who = (l: string) => l.slice(0, Math.max(0, l.indexOf(':')));
  el.innerHTML = `<div class="rk-screen">
      <div class="rk-scan"></div>
      <div class="rk-tag rk-tag-alone">INTERCEPTED · SURVEY ARRAY</div>
      <div class="rk-card rk-open on" style="${flagWave ? `background-image:url('${flagWave}')` : ''}">
        <div class="rk-card-in rk-script">
          <div class="rk-stamp">INTERCEPTED</div>
          <div class="rk-channel">${esc(def.kicker)}</div>
          <div class="rk-title">${esc(def.scene.title.toUpperCase())}</div>
          <div class="rk-small">${esc(def.small)}</div>
          <div class="tl-band" data-tl="roach"><span class="tl-sig" aria-hidden="true"></span><span class="tl-src">SOURCE: ${esc(def.source)}</span><span class="tl-by">RENDERED BY YOKE · CONFIDENCE ${cardConfidence(lines, 'roach')}%</span></div>
          <div class="rk-lines">${lines.map((l, i) => `<p${i > 0 && who(l) === who(lines[i - 1]) ? ' class="rk-same"' : ''}>${lineHtml(l)}</p>`).join('')}</div>
          <div class="rk-nofilm">PICTURE NOT RECOVERED · THE WORDS ONLY</div>
          <div class="rk-endline rk-script-end">${esc(def.end)}</div>
          <button class="screen-btn rk-continue" type="button">CONTINUE ▸</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);
  playing = { id: def.id, shot: 'transcript' };
  el.dataset.shot = 'transcript';
  for (const p of el.querySelectorAll('.rk-lines p')) decode(p, 520);
  let over = false;
  const close = (how: 'ended' | 'skipped') => {
    if (over) return;
    over = true;
    window.removeEventListener('keydown', onKey, true);
    el.classList.add('leaving');
    window.setTimeout(() => el.remove(), 450);
    playing = null;
    finish(how);
  };
  const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); close('ended'); } };
  window.addEventListener('keydown', onKey, true);
  el.addEventListener('click', (ev) => ev.stopPropagation());
  el.querySelector<HTMLButtonElement>('.rk-continue')!.addEventListener('click', (ev) => { ev.stopPropagation(); close('ended'); });
  window.setTimeout(() => el.querySelector<HTMLButtonElement>('.rk-continue')?.focus({ preventScroll: true }), 50);
  return { skip: () => close('skipped'), done };
}

/** Show one scene off the air (its film, or its transcript), once the art that may be there has been asked for. */
async function showRoachScene(def: RoachScene): Promise<void> {
  await Promise.all([loadRoach(), loadScenes()]);
  await playRoachScene(def).done;
}

// ------------------------------------------------------------------ after a deployment
const LOG_KEY = 'broodfall-roach';
function loadLog(seed: number): RoachLog {
  try { const j = JSON.parse(localStorage.getItem(LOG_KEY) ?? 'null') as RoachLog | null; if (j && j.seed === seed) return j; } catch { /* none */ }
  return emptyRoachLog(seed);
}
function saveLog(l: RoachLog): void { try { localStorage.setItem(LOG_KEY, JSON.stringify(l)); } catch { /* private mode */ } }

/** His address after this deployment, if one is due (resolves at once when none is). */
export async function roachAfterDeployment(next: CampaignState): Promise<void> {
  if (!mediaAllowed()) return;
  const log = loadLog(next.seed);
  const due = dueAfterDeployment(next, log);
  if (!due) return;
  // A scene off the air (the briefing): its film, or its transcript; it needs no baked art.
  if ('scene' in due) { saveLog(logRoach(log, due.scene)); await showRoachScene(due.scene); return; }
  const a = due.address;
  if (!(await loadRoach())) return;
  if (!playableShots(a).length) return;
  saveLog(logRoach(log, a));
  await playAddress(a).done;
}

/**
 * BEFORE THE LAST MISSION (Collins, Oct 4 2026: "before the last message we see the roach king on a vid call ... this is
 * before the final mission"): the call about the transports, then his Founding Day address, each once a campaign.
 * Resolves at once when both have been shown (a second try at the mission goes straight in).
 */
export async function roachBeforeLastMission(s: CampaignState): Promise<void> {
  if (!mediaAllowed()) return;
  for (const sc of lastMissionScenes(loadLog(s.seed))) {
    saveLog(logRoach(loadLog(s.seed), sc));
    await showRoachScene(sc);
  }
}

// For the beats (tools/shot-roachking.mjs).
(window as unknown as { __bfRoach: unknown }).__bfRoach = {
  load: loadRoach,
  start: async (id: string) => { await loadRoach(); const a = ROACH_ADDRESSES.find((x) => x.id === id); if (!a || !playableShots(a).length) return false; void playAddress(a); return true; },
  play: async (id: string) => { await loadRoach(); const a = ROACH_ADDRESSES.find((x) => x.id === id); if (!a || !playableShots(a).length) return false; await playAddress(a).done; return true; },
  state: () => ({ playing, loaded: !!art, clips: art ? Object.keys(art.clips).length : 0 }),
  due: (s: CampaignState, seen: string[] = []) => dueAddress(s, { seed: s.seed, seen })?.id ?? null,
  // Off the air: show a scene by its id; which is due after a deployment; which are left before the last mission.
  scene: async (id: string) => { const sc = ROACH_SCENES.find((x) => x.id === id); if (!sc) return false; await Promise.all([loadRoach(), loadScenes()]); void playRoachScene(sc); return true; },
  dueScene: (s: CampaignState, seen: string[] = []) => dueScene(s, { seed: s.seed, seen })?.id ?? null,
  beforeLast: (s: CampaignState) => lastMissionScenes(loadLog(s.seed)).map((x) => x.id),
};
