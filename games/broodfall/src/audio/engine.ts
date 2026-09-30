/**
 * THE SOUND ENGINE (WebAudio). Sep 30 2026: the game was silent but for YOKE and the boss.
 *
 *   master ─┬─ music ── musicDuck ── (loops, stingers, the film's score)
 *           ├─ sfx ──── sfxDuck ──── (every effect, capped at MAX_VOICES at once)
 *           └─ voice ──────────────── (the newsreel narrator; YOKE's and the boss's lines are
 *                                      <audio> elements levelled by gain('voice') themselves)
 *
 * - The four sliders of the settings screen (master, music, effects, voices) are read from the
 *   saved settings several times a second, so a slider is heard as it moves.
 * - A browser will not play sound on a page nobody has clicked: the context is resumed on the
 *   first pointer or key press; what was asked for before (the menu's music) starts then.
 * - Effects are rate-limited per sound (src/audio/cues.ts SFX_RULES: a least gap, a polyphony
 *   cap, a pitch spread) and picked among their variants, so forty limbs never machine-gun.
 * - Music is a scene (src/audio/cues.ts sceneOf): each scene's loop is crossfaded in, and a loop
 *   left comes back where it was left. Stingers play over it and duck it.
 * - A voice (YOKE, the boss, the narrator) ducks the music and the effects while it speaks.
 * - Settings "Mute when the window is not in front": the master falls to zero on blur/hidden.
 * - For the beats (tools/shot-audio.mjs): `window.__bfAudio` holds a log of every cue asked
 *   for (played or why not), the buses' levels, a level meter on the master, and a recorder of
 *   the mixed output.
 *
 * Files: public/audio/manifest.json (tools/audio/make.mjs). Without it the game is silent, as before.
 */
import { loadSettings } from '../meta/storage';
import { DUCK, MAX_VOICES, SCENE_FADE, SCENE_TRACK, STING_DUCK, ruleOf, type MusicScene } from './cues';

interface Manifest {
  v: number;
  music: Record<string, { file: string; seconds: number; loop?: boolean }>;
  sfx: Record<string, { files: string[]; seconds?: number[] }>;
  voice: Record<string, { file: string; seconds: number; line?: string }>;
}
export interface CueLog { t: number; kind: 'sfx' | 'music' | 'sting' | 'voice' | 'duck' | 'scene' | 'film'; id: string; played: boolean; why?: string }

const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
const url = (file: string) => new URL(base + file, document.baseURI).href;

let ctx: AudioContext | null = null;
let master: GainNode, musicBus: GainNode, sfxBus: GainNode, voiceBus: GainNode, musicDuck: GainNode, sfxDuck: GainNode, stingDuck: GainNode;
let meter: AnalyserNode;
let manifest: Manifest | null = null;
let manifestLoad: Promise<Manifest | null> | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
/** Decoded music is big (a 2-minute stereo loop is ~45 MB of floats): only the latest few are kept. */
const musicLru: string[] = [];
const MUSIC_KEEP = 4;

const log: CueLog[] = [];
function note(e: Omit<CueLog, 't'>): void {
  log.push({ t: Math.round(performance.now()), ...e });
  if (log.length > 4000) log.splice(0, 1000);
}

// ----------------------------------------------------------------------------- set-up

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC({ latencyHint: 'interactive' }); } catch { return null; }
  const g = () => ctx!.createGain();
  master = g(); musicBus = g(); sfxBus = g(); voiceBus = g(); musicDuck = g(); sfxDuck = g(); stingDuck = g();
  meter = ctx.createAnalyser();
  meter.fftSize = 2048;
  musicDuck.connect(stingDuck).connect(musicBus).connect(master);
  sfxDuck.connect(sfxBus).connect(master);
  voiceBus.connect(master);
  master.connect(meter);
  master.connect(ctx.destination);
  applyVolumes(true);
  return ctx;
}

function loadManifest(): Promise<Manifest | null> {
  manifestLoad ??= fetch(url('audio/manifest.json'), { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((m: Manifest | null) => { manifest = m && m.v ? m : null; return manifest; })
    .catch(() => null);
  return manifestLoad;
}

function buffer(file: string, music = false): Promise<AudioBuffer | null> {
  const c = ensure();
  if (!c) return Promise.resolve(null);
  if (music) {
    const i = musicLru.indexOf(file);
    if (i >= 0) musicLru.splice(i, 1);
    musicLru.push(file);
    while (musicLru.length > MUSIC_KEEP) {
      const old = musicLru.shift()!;
      if (!playingFiles().has(old)) buffers.delete(old);
    }
  }
  let p = buffers.get(file);
  if (!p) {
    p = fetch(url(file))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${file}: HTTP ${r.status}`))))
      .then((b) => c.decodeAudioData(b))
      .catch((e) => { console.warn('[audio]', String(e)); buffers.delete(file); return null; });
    buffers.set(file, p);
  }
  return p;
}

let unlocked = false;
/** Wire the page: resume on the first gesture, keep the volumes, mute when the window is left. */
export function initAudio(): void {
  if ((window as unknown as { __bfAudioInit?: boolean }).__bfAudioInit) return;
  (window as unknown as { __bfAudioInit?: boolean }).__bfAudioInit = true;
  void loadManifest();
  const unlock = () => {
    const c = ensure();
    if (!c) return;
    if (c.state !== 'running') void c.resume().then(() => { unlocked = true; afterUnlock(); }, () => {});
    else if (!unlocked) { unlocked = true; afterUnlock(); }
  };
  for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(ev, unlock, { capture: true, passive: true });
  // A page that may play at once (the browser allows it, or an automated beat) starts at once.
  ensure();
  if (ctx?.state === 'running') { unlocked = true; afterUnlock(); }
  // A page the browser lets play (it was clicked before, or a policy allows it) turns running by itself.
  if (ctx) ctx.addEventListener('statechange', () => { if (ctx?.state === 'running' && !unlocked) { unlocked = true; afterUnlock(); } });
  const focus = () => applyVolumes();
  window.addEventListener('blur', focus);
  window.addEventListener('focus', focus);
  document.addEventListener('visibilitychange', focus);
  window.setInterval(() => applyVolumes(), 150);
  expose();
}

function afterUnlock(): void {
  // The effects are small: all fetched now, so the first shot of a run is heard.
  void loadManifest().then((m) => {
    if (!m) return;
    for (const s of Object.values(m.sfx)) for (const f of s.files) void buffer(f);
  });
  startScene(scene, true);
}

export const audioUnlocked = (): boolean => unlocked && ctx?.state === 'running';

// ----------------------------------------------------------------------------- volumes

let lastVol = '';
let away = false;
function applyVolumes(force = false): void {
  if (!ctx) return;
  const s = loadSettings();
  away = s.muteUnfocused && (document.hidden || !document.hasFocus());
  const key = `${s.volume.master}|${s.volume.music}|${s.volume.sfx}|${s.volume.voice}|${away}`;
  if (key === lastVol && !force) return;
  lastVol = key;
  const t = ctx.currentTime;
  const set = (n: GainNode, v: number) => { n.gain.cancelScheduledValues(t); n.gain.setTargetAtTime(v, t, 0.04); };
  set(master, away ? 0 : s.volume.master);
  set(musicBus, s.volume.music);
  set(sfxBus, s.volume.sfx);
  set(voiceBus, s.volume.voice);
}

// ----------------------------------------------------------------------------- effects

const lastAt = new Map<string, number>();
const sounding = new Map<string, number>();
let voices = 0;
const lastVariant = new Map<string, number>();

export interface SfxOpts { gain?: number; rate?: number; pan?: number; delay?: number }

/** Play an effect (rate-limited, varied). Returns whether it was started. */
export function sfx(id: string, o: SfxOpts = {}): boolean {
  const c = ctx;
  if (!c || c.state !== 'running') { note({ kind: 'sfx', id, played: false, why: 'locked' }); return false; }
  const entry = manifest?.sfx[id];
  if (!entry?.files.length) { note({ kind: 'sfx', id, played: false, why: manifest ? 'no-file' : 'no-manifest' }); return false; }
  const r = ruleOf(id);
  const now = c.currentTime + (o.delay ?? 0);
  if (Math.abs(now - (lastAt.get(id) ?? -99)) < r.gap) { note({ kind: 'sfx', id, played: false, why: 'gap' }); return false; }
  if ((sounding.get(id) ?? 0) >= r.poly) { note({ kind: 'sfx', id, played: false, why: 'poly' }); return false; }
  if (voices >= MAX_VOICES) { note({ kind: 'sfx', id, played: false, why: 'voices' }); return false; }
  lastAt.set(id, now);
  // Not the same variant twice running.
  let i = Math.floor(Math.random() * entry.files.length);
  if (entry.files.length > 1 && i === lastVariant.get(id)) i = (i + 1) % entry.files.length;
  lastVariant.set(id, i);
  const file = entry.files[i];
  const pending = buffers.get(file);
  sounding.set(id, (sounding.get(id) ?? 0) + 1);
  voices++;
  const release = () => { sounding.set(id, Math.max(0, (sounding.get(id) ?? 1) - 1)); voices = Math.max(0, voices - 1); };
  void (pending ?? buffer(file)).then((b) => {
    if (!b || !ctx) { release(); return; }
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = (o.rate ?? 1) * 2 ** (((Math.random() * 2 - 1) * r.pitch) / 12);
    const g = ctx.createGain();
    g.gain.value = r.gain * (o.gain ?? 1);
    let tail: AudioNode = g;
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); g.connect(p); tail = p; }
    src.connect(g);
    tail.connect(r.bus === 'music' ? musicDuck : sfxDuck);
    src.onended = () => { release(); try { g.disconnect(); tail.disconnect(); } catch { /* gone */ } };
    src.start(ctx.currentTime + (o.delay ?? 0));
  });
  note({ kind: 'sfx', id, played: true });
  return true;
}

// ----------------------------------------------------------------------------- ducking

let ducks = 0;
function setDuck(): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  const on = ducks > 0;
  for (const [n, lvl] of [[musicDuck, DUCK.music], [sfxDuck, DUCK.sfx]] as Array<[GainNode, number]>) {
    n.gain.cancelScheduledValues(t);
    n.gain.setTargetAtTime(on ? lvl : 1, t, on ? DUCK.attack / 3 : DUCK.release / 3);
  }
}
/** The music and effects duck until the returned function is called (once). */
export function duck(why = 'voice'): () => void {
  ducks++;
  setDuck();
  note({ kind: 'duck', id: why, played: true });
  let done = false;
  return () => { if (done) return; done = true; ducks = Math.max(0, ducks - 1); setDuck(); };
}
/** Duck under a voice playing in an <audio> element (YOKE, the boss) for as long as it plays. */
export function duckFor(el: HTMLMediaElement, why = 'voice'): void {
  ensure();
  const off = duck(why);
  const end = () => { off(); for (const e of ['ended', 'pause', 'error', 'emptied'] as const) el.removeEventListener(e, end); };
  for (const e of ['ended', 'pause', 'error', 'emptied'] as const) el.addEventListener(e, end);
  // A voice that never gets going must not hold the music down.
  window.setTimeout(() => { if (el.paused) end(); }, 3000);
  window.setTimeout(end, 60000);
}

// ----------------------------------------------------------------------------- music

interface Playing { id: string; file: string; src: AudioBufferSourceNode; gain: GainNode; startedAt: number; offset: number; seconds: number }
let loopNow: Playing | null = null;
const fading = new Set<Playing>();
const resumeAt = new Map<string, number>();
let scene: MusicScene = 'silent';
let sceneToken = 0;

function playingFiles(): Set<string> {
  const s = new Set<string>();
  if (loopNow) s.add(loopNow.file);
  for (const p of fading) s.add(p.file);
  return s;
}

/** Where a loop is now (seconds into it). */
const positionOf = (p: Playing) => (ctx ? (p.offset + (ctx.currentTime - p.startedAt)) % Math.max(0.001, p.seconds) : 0);

function fadeOut(p: Playing, secs: number): void {
  if (!ctx) return;
  resumeAt.set(p.id, positionOf(p));
  const t = ctx.currentTime;
  p.gain.gain.cancelScheduledValues(t);
  p.gain.gain.setValueAtTime(p.gain.gain.value, t);
  p.gain.gain.linearRampToValueAtTime(0, t + secs);
  fading.add(p);
  try { p.src.stop(t + secs + 0.05); } catch { /* stopped */ }
  p.src.onended = () => { fading.delete(p); try { p.gain.disconnect(); } catch { /* gone */ } };
}

/** The scene the game is in; its loop is crossfaded in (a scene with none fades the music out). */
export function setScene(next: MusicScene): void {
  if (next === scene) return;
  scene = next;
  note({ kind: 'scene', id: next, played: audioUnlocked() });
  startScene(next);
}
export const currentScene = (): MusicScene => scene;

function startScene(next: MusicScene, fromUnlock = false): void {
  const c = ctx;
  const token = ++sceneToken;
  const id = SCENE_TRACK[next];
  const secs = SCENE_FADE[next];
  if (!c || c.state !== 'running') return;
  if (loopNow && loopNow.id === id) return;
  if (loopNow) { fadeOut(loopNow, secs); loopNow = null; }
  if (!id) return;
  void loadManifest().then(async (m) => {
    const e = m?.music[id];
    if (!e) { note({ kind: 'music', id, played: false, why: m ? 'no-file' : 'no-manifest' }); return; }
    const b = await buffer(e.file, true);
    if (!b || token !== sceneToken || !ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.loop = e.loop !== false;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + (fromUnlock ? 1.5 : secs));
    src.connect(gain).connect(musicDuck);
    const offset = (resumeAt.get(id) ?? 0) % b.duration;
    src.start(t, offset);
    loopNow = { id, file: e.file, src, gain, startedAt: t, offset, seconds: b.duration };
    note({ kind: 'music', id, played: true });
  });
}

let stingOff: (() => void) | null = null;
/** A short cue over the music (a fanfare, a sting): the loop ducks under it. */
export function sting(id: string, o: { gain?: number } = {}): boolean {
  const c = ctx;
  if (!c || c.state !== 'running') { note({ kind: 'sting', id, played: false, why: 'locked' }); return false; }
  const e = manifest?.music[id];
  if (!e) { note({ kind: 'sting', id, played: false, why: 'no-file' }); return false; }
  note({ kind: 'sting', id, played: true });
  void buffer(e.file).then((b) => {
    if (!b || !ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = b;
    const g = ctx.createGain();
    g.gain.value = o.gain ?? 0.9;
    src.connect(g).connect(musicBus);
    const t = ctx.currentTime;
    stingDuck.gain.cancelScheduledValues(t);
    stingDuck.gain.setTargetAtTime(STING_DUCK, t, 0.05);
    stingOff?.();
    let over = false;
    stingOff = () => { if (over) return; over = true; if (!ctx) return; const u = ctx.currentTime; stingDuck.gain.cancelScheduledValues(u); stingDuck.gain.setTargetAtTime(1, u, 0.5); };
    const mine = stingOff;
    src.onended = () => { mine(); try { g.disconnect(); } catch { /* gone */ } };
    src.start(t);
  });
  return true;
}

let film: Playing | null = null;
/** The opening film's score, from its start. Returns false when it cannot play (no click on the page yet). */
export function playFilm(): boolean {
  const c = ctx;
  if (!c || c.state !== 'running') { note({ kind: 'film', id: 'film', played: false, why: 'locked' }); return false; }
  const e = manifest?.music.film;
  if (!e) { note({ kind: 'film', id: 'film', played: false, why: 'no-file' }); return false; }
  note({ kind: 'film', id: 'film', played: true });
  void buffer(e.file).then((b) => {
    if (!b || !ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = b;
    const gain = ctx.createGain();
    src.connect(gain).connect(musicDuck);
    const t = ctx.currentTime;
    src.start(t);
    film = { id: 'film', file: e.file, src, gain, startedAt: t, offset: 0, seconds: b.duration };
    src.onended = () => { if (film?.src === src) film = null; };
  });
  return true;
}
export function stopFilm(secs = 0.8): void {
  if (film) { fadeOut(film, secs); film = null; }
}

/** A narrator's line on the voice bus; the music ducks under it. */
export function say(id: string): boolean {
  const c = ctx;
  if (!c || c.state !== 'running') { note({ kind: 'voice', id, played: false, why: 'locked' }); return false; }
  const e = manifest?.voice[id];
  if (!e) { note({ kind: 'voice', id, played: false, why: 'no-file' }); return false; }
  note({ kind: 'voice', id, played: true });
  const off = duck(`narrator:${id}`);
  void buffer(e.file).then((b) => {
    if (!b || !ctx) { off(); return; }
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.connect(voiceBus);
    src.onended = off;
    src.start();
  });
  return true;
}
/** The narrator's lines there are (the film asks which of its titles have one). */
export const hasVoice = (id: string): boolean => !!manifest?.voice[id];
export const audioReady = (): Promise<boolean> => loadManifest().then((m) => !!m);

// ----------------------------------------------------------------------------- the beats' window

function level(): number {
  if (!meter) return -120;
  const a = new Float32Array(meter.fftSize);
  meter.getFloatTimeDomainData(a);
  let s = 0;
  for (const v of a) s += v * v;
  return 20 * Math.log10(Math.max(1e-7, Math.sqrt(s / a.length)));
}

function expose(): void {
  let rec: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  (window as unknown as { __bfAudio: unknown }).__bfAudio = {
    log,
    state: () => ({
      context: ctx?.state ?? 'none', unlocked: audioUnlocked(), scene, loop: loopNow?.id ?? null, film: !!film,
      voices, ducks, away, manifest: !!manifest,
      gains: ctx ? { master: master.gain.value, music: musicBus.gain.value, sfx: sfxBus.gain.value, voice: voiceBus.gain.value, musicDuck: musicDuck.gain.value, sfxDuck: sfxDuck.gain.value } : null,
    }),
    level,
    /** Record the mixed output (what the speakers get) as Opus/WebM. */
    record(): boolean {
      if (!ctx || rec) return false;
      const dest = ctx.createMediaStreamDestination();
      master.connect(dest);
      chunks = [];
      rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 160000 });
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.start(1000);
      return true;
    },
    /** Stop recording; the recording as base64. */
    stop(): Promise<string> {
      const r = rec;
      if (!r) return Promise.resolve('');
      rec = null;
      return new Promise((done) => {
        r.onstop = () => { void new Blob(chunks, { type: 'audio/webm' }).arrayBuffer().then((ab) => {
          const u = new Uint8Array(ab);
          let s = '';
          for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
          done(btoa(s));
        }); };
        r.stop();
      });
    },
    sfx, sting, say, setScene,
  };
}
