/**
 * THE FACTION LEADERS, HEARD (Sep 30 2026; content/media.ts LEADER_VOICES, tools/media/make.ts).
 * When a faction scene's card is up on the ship (src/ui/campaignUi.ts sceneHtml), its lines are
 * played one after another: the leader's in his own voice (the Delegate, the Voice, the Director,
 * the Awaited One), the character's read in the time it takes to read them, the line being said
 * lit as its caption. The music ducks under each voice. An ending scene first plays its film full
 * screen (src/ui/newsreel.ts), then loops it where its picture was.
 *
 * campaignUi calls `attachScene(this.el)` after every drawing of the ship: the card is drawn anew
 * each time, so this keeps what is playing and lights the right line again on the new card.
 * A line whose words were rewritten since its voice was made is read, not played.
 */
import { FACTIONS, type FactionId, type Scene } from '../../content/campaign';
import { spokenText, voiceKey } from '../../content/media';
import { duckFor, routeMedia } from '../audio/engine';
import { gain } from '../meta/storage';
import { endingFilmOf, loadMedia, mediaAllowed, mediaNow, mediaUrl, playEndingFilm } from './newsreel';

interface Now { key: string; faction: FactionId; scene: Scene; line: number; audio: HTMLAudioElement | null; timer: number; done: boolean; filmed: boolean }
let now: Now | null = null;
let root: HTMLElement | null = null;

function sceneOf(faction: string, title: string): Scene | null {
  const f = FACTIONS.find((x) => x.id === faction);
  if (!f) return null;
  const all = [f.contact, ...f.beats.map((b) => b.scene), f.ending, ...Object.values(f.endingByChoice?.scenes ?? {}), ...(f.reveal ? [f.reveal] : []), ...(f.afterReveal ?? [])];
  return all.find((s) => s.title === title) ?? null;
}

const card = () => root?.querySelector<HTMLElement>('.cp-scene-card[data-faction]') ?? null;

/** Light the line being said (and scroll it into view); none lit when the scene has been said. */
function light(): void {
  const c = card();
  if (!c || !now) return;
  const ps = [...c.querySelectorAll<HTMLElement>(':scope > p')];
  c.classList.toggle('cp-speaking', !now.done);
  ps.forEach((p, i) => p.classList.toggle('said-now', !now!.done && i === now!.line));
  if (!now.done) ps[now.line]?.scrollIntoView({ block: 'nearest' });
  film(c);
}

/** The ending's film in the picture's place, its shots one after another, silent. */
function film(c: HTMLElement): void {
  const f = now ? endingFilmOf(now.scene.picture) : null;
  const pic = c.querySelector<HTMLElement>('.cp-scene-pic, .cp-leader');
  if (!f || pic?.tagName === 'VIDEO' || c.querySelector('video.cp-scene-film')) return;
  const art = mediaNow()!;
  const v = document.createElement('video');
  v.className = 'cp-scene-pic cp-scene-film';
  v.muted = true; v.playsInline = true; v.autoplay = true;
  let k = 0;
  const go = () => { const clip = art.clips[f.shots[k % f.shots.length].clip]; v.src = mediaUrl(clip.video); void v.play().catch(() => {}); k++; };
  v.addEventListener('ended', go);
  go();
  // Where its picture was; at the head of the card when the ship's pictures have not come (yet).
  if (pic) pic.replaceWith(v); else c.prepend(v);
}

function stop(): void {
  if (!now) return;
  clearTimeout(now.timer);
  if (now.audio) { now.audio.pause(); now.audio = null; }
  now = null;
}

function say(n: Now): void {
  if (now !== n) return;
  const lines = n.scene.lines;
  if (n.line >= lines.length) { n.done = true; light(); return; }
  light();
  const l = lines[n.line];
  const next = (ms: number) => { n.timer = window.setTimeout(() => { if (now === n) { n.line++; say(n); } }, ms); };
  const v = mediaNow()?.voices[voiceKey(n.faction, n.scene.title, n.line)];
  const text = spokenText(l);
  if (v && v.text === text && gain('voice') > 0) {
    const a = new Audio(mediaUrl(v.file));
    if (!routeMedia(a, 'voice')) a.volume = Math.min(1, gain('voice'));
    n.audio = a;
    duckFor(a, 'leader');
    a.onended = () => { if (now === n) { n.audio = null; next(350); } };
    a.onerror = () => next(Math.min(6000, 900 + l.length * 40));
    void a.play().catch(() => next(Math.min(6000, 900 + l.length * 40)));
  } else next(Math.min(6000, 900 + l.length * 40));
}

/** After every drawing of the ship: start, carry on or stop the scene's voices. */
export function attachScene(el: HTMLElement | null): void {
  root = el;
  const c = card();
  if (!c || !el || el.classList.contains('hidden')) { stop(); return; }
  const key = `${c.dataset.faction}|${c.dataset.scene}`;
  if (now?.key === key) { light(); return; }
  stop();
  if (!mediaAllowed()) return;
  const scene = sceneOf(c.dataset.faction!, c.dataset.scene!);
  if (!scene) return;
  const n: Now = { key, faction: c.dataset.faction as FactionId, scene, line: 0, audio: null, timer: 0, done: false, filmed: false };
  now = n;
  void loadMedia().then(async (art) => {
    if (now !== n || !art) return;
    const f = endingFilmOf(scene.picture);
    if (f && !n.filmed) { n.filmed = true; await playEndingFilm(f).done; }
    if (now !== n) return;
    // Nothing to hear in the whole scene (or the voices are off): the card stays as it is.
    const any = scene.lines.some((l, i) => art.voices[voiceKey(n.faction, scene.title, i)]);
    if (!any || gain('voice') <= 0) { n.done = true; light(); return; }
    say(n);
  });
}
