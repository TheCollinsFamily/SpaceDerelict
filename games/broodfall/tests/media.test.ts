/**
 * THE CAMPAIGN'S MEDIA (Sep 30 2026; content/media.ts, src/meta/media.ts, tools/media/make.ts):
 * the newsreels and clippings between runs, the leaders' voices, the ending films, the reveal
 * pictures. What is picked when, and that everything the game asks for is on disk.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { ENDING_FILMS, LEADER_VOICES, MEDIA, NARRATION, REVEAL_PICTURES, spokenText, voiceKey, type MediaPiece } from '../content/media';
import { FACTIONS, TERRITORIES } from '../content/campaign';
import { emptyLog, logShown, momentsOf, pickMedia, type MediaLog } from '../src/meta/media';
import { finish, newCampaign, plan, type CampaignState, type Debrief } from '../src/meta/campaign';
// @ts-expect-error: a .mjs of the tools, no types
import { CLIPS, PHOTOS, REVEALS } from '../tools/media/prompts.mjs';

const media = JSON.parse(readFileSync('public/media/media.json', 'utf8'));
const INTRO = ['sky', 'lookup', 'fall', 'impact', 'crater', 'creep', 'militia', 'rise'];
const beats = FACTIONS.flatMap((f) => f.beats.map((b) => b.id));
const MOMENT = new RegExp(`^(retaken|repelled|desk-open|counter|capture|lost|ally:(${FACTIONS.map((f) => f.id).join('|')})|beat:(${beats.join('|')})|capture:(${TERRITORIES.map((t) => t.id).join('|')}))$`);

describe('the pieces', () => {
  it('are about twenty or more, with their own ids, for moments the campaign has', () => {
    expect(MEDIA.length).toBeGreaterThanOrEqual(20);
    expect(new Set(MEDIA.map((m) => m.id)).size).toBe(MEDIA.length);
    for (const m of MEDIA) for (const w of m.when) expect(w, `${m.id}: ${w}`).toMatch(MOMENT);
  });

  it('cover the campaign: its beats, captures, counter-attacks, the three contacts, wins and losses, both sides', () => {
    const when = new Set(MEDIA.flatMap((m) => m.when));
    for (const w of ['desk-open', 'capture', 'lost', 'retaken', 'repelled', 'counter', 'ally:delegation', 'ally:faithful', 'ally:institute']) expect(when.has(w), w).toBe(true);
    expect([...when].filter((w) => w.startsWith('beat:')).length).toBeGreaterThanOrEqual(3);
    expect([...when].filter((w) => w.startsWith('capture:')).length).toBeGreaterThanOrEqual(10);
    expect(MEDIA.some((m) => m.kind === 'reel' && m.side === 'empire')).toBe(true);
    expect(MEDIA.some((m) => m.kind === 'reel' && m.side === 'colony')).toBe(true);
    expect(MEDIA.some((m) => m.kind === 'clipping')).toBe(true);
    // The break: at least one shot the reel did not mean to show.
    expect(MEDIA.some((m) => m.kind === 'reel' && m.shots.some((s) => s.raw))).toBe(true);
  });

  it('ask only for clips, photos and lines that are made (the prompts) and baked (media.json)', () => {
    for (const m of MEDIA) {
      if (m.kind === 'clipping') {
        expect(PHOTOS[m.photo], `${m.id}: prompt for ${m.photo}`).toBeTruthy();
        expect(media.photos[m.photo], `${m.id}: ${m.photo} baked`).toBeTruthy();
        continue;
      }
      for (const s of m.shots) {
        if (s.clip.startsWith('intro:')) { expect(INTRO).toContain(s.clip.slice(6)); continue; }
        expect(CLIPS[s.clip], `${m.id}: prompt for ${s.clip}`).toBeTruthy();
        expect(media.clips[s.clip], `${m.id}: ${s.clip} baked`).toBeTruthy();
        if (s.say) {
          expect(NARRATION[s.say], `${m.id}: ${s.say}`).toBeTruthy();
          expect(media.narration[s.say], `${m.id}: ${s.say} baked`).toBeTruthy();
          expect(NARRATION[s.say].side).toBe(m.side);
        }
        // The break has no title and no narrator.
        if (s.raw) expect(s.title ?? s.say).toBeUndefined();
      }
    }
  });

  it('every file media.json names is on disk', () => {
    const files: string[] = [
      ...Object.values(media.clips as Record<string, { video: string; poster: string }>).flatMap((c) => [c.video, c.poster]),
      ...Object.values(media.photos as Record<string, string>), ...Object.values(media.pictures as Record<string, string>),
      ...Object.values(media.voices as Record<string, { file: string }>).map((v) => v.file),
      ...Object.values(media.narration as Record<string, { file: string }>).map((v) => v.file),
      ...Object.values(media.music as Record<string, { file: string }>).map((v) => v.file),
      ...(media.field ? [media.field.file] : []),
    ];
    expect(files.length).toBeGreaterThan(100);
    for (const f of files) expect(existsSync(`public/${f}`), f).toBe(true);
  });

  it('never set a word into a picture: the headlines and titles are type (no prompt asks for lettering)', () => {
    const prompts = [...Object.values(CLIPS).map((c) => (c as { still?: string }).still ?? ''), ...Object.values(PHOTOS).map((p) => (typeof p === 'string' ? p : (p as { prompt: string }).prompt)), ...Object.values(REVEALS).map((p) => (p as { prompt: string }).prompt)];
    for (const p of prompts.filter(Boolean)) expect(p).toMatch(/no letters of any alphabet/);
  });
});

describe('which piece, when', () => {
  const pieceIds = (moments: string[], rounds: number) => {
    let log: MediaLog = emptyLog(1);
    const out: string[] = [];
    for (let i = 0; i < rounds; i++) {
      const p = pickMedia(moments, log);
      if (!p) break;
      out.push(p.piece.id);
      log = logShown(log, p.piece);
    }
    return out;
  };

  it('never shows the same piece twice in a row, and a story piece only once', () => {
    const seq = pieceIds(['capture'], 12);
    expect(seq.length).toBe(12);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
    // Both sides tell of a town taken.
    expect(new Set(seq.map((id) => MEDIA.find((m) => m.id === id)!.side)).size).toBe(2);
    const harbor = pieceIds(['capture:harbor', 'capture'], 3);
    expect(harbor[0]).toBe('reel-harbor');
    expect(harbor.slice(1)).not.toContain('reel-harbor');
  });

  it('tells a loss from their side, a counter-attack lost as their victory, one repelled as the Office\'s', () => {
    const side = (m: string) => MEDIA.find((x) => x.id === pickMedia([m], emptyLog(1))!.piece.id)!;
    expect(side('lost').side).toBe('colony');
    expect(side('retaken').id).toBe('reel-retaken');
    expect(side('repelled').id).toBe('reel-repelled');
    expect(side('ally:institute').id).toBe('clip-institute');
    expect(side('beat:reveal').id).toBe('clip-extinction');
  });

  it('replays an Empire reel with the filter off now and then (the break), never the first', () => {
    let log = emptyLog(1);
    const replays: boolean[] = [];
    for (let i = 0; i < 8; i++) {
      const p = pickMedia(['repelled'], { ...log, last: null })!;
      replays.push(p.replay);
      log = logShown(log, p.piece);
    }
    expect(replays[0]).toBe(false);
    expect(replays.filter(Boolean).length).toBe(2);
  });

  it('reads the moments of a real deployment: the desk opening, a capture, a counter-attack, a loss', () => {
    // A save from before the unfolding: the neighbours of the crash site are open.
    let s: CampaignState = newCampaign(7);
    const stats = { kills: {}, killsByFamily: {}, killsByCause: {}, healed: 0, limbsGrown: 0, evolutions: 0, limbsLost: 0, cannibalized: 0, coreMinFrac: 1, depositsClaimed: 0, earlyCalls: 0, maxLimbs: 0, maxBurning: 0, maxPips: 0, families: [], pacifistWaves: 0, lastWaveKillsByCause: {}, royalsEaten: 0, matingStuns: 0, limbsCarriedOff: 0, gateBurnKills: 0, royalsCaptured: 0, nodesPlaced: 0, nodesLost: 0 };
    const run = (st: CampaignState, t: string, ok: boolean): { state: CampaignState; debrief: Debrief } =>
      finish(st, plan(st, t), { won: ok, wavesCleared: 6, coreEndFrac: 0.8, scienceBanked: 0, stats: stats as never });
    const a = run(s, 'cul-de-sac', true);
    const m1 = momentsOf(s, a.state, a.debrief);
    expect(m1).toContain('capture:cul-de-sac');
    expect(m1.indexOf('capture:cul-de-sac')).toBeLessThan(m1.indexOf('capture'));
    s = a.state;
    const b = run(s, 'harbor', false);
    expect(momentsOf(s, b.state, b.debrief)).toContain('lost');
  });

  it('plays every piece: with the media baked, each is complete', () => {
    const complete = (p: MediaPiece) => (p.kind === 'clipping' ? !!media.photos[p.photo] : p.shots.every((s) => s.clip.startsWith('intro:') || media.clips[s.clip]));
    for (const p of MEDIA) expect(complete(p), p.id).toBe(true);
  });
});

describe('the leaders\' voices', () => {
  const lines = FACTIONS.flatMap((f) => [f.contact, ...f.beats.map((b) => b.scene), f.ending, ...Object.values(f.endingByChoice?.scenes ?? {}), ...(f.reveal ? [f.reveal] : []), ...(f.afterReveal ?? [])]
    .flatMap((s) => s.lines.map((l, i) => ({ f: f.id, s, l, i, who: l.slice(0, l.indexOf(':')) }))));

  it('the Delegate, the Voice, the Director and the Awaited One each have a voice, none of them YOKE\'s or the boss\'s', () => {
    for (const who of ['Delegate', 'The Voice', 'The Director', 'The Awaited One']) expect(LEADER_VOICES[who], who).toBeTruthy();
    const aura = Object.values(LEADER_VOICES).filter((v) => v.how === 'aura').map((v) => v.voice);
    expect(new Set(aura).size).toBe(aura.length);
    expect(aura).not.toContain('aura-2-thalia-en');
    expect(aura).not.toContain('aura-2-apollo-en');
  });

  it('every line they speak in a contact, beat, ending or reveal scene is voiced, with its words as they are now', () => {
    let n = 0;
    for (const x of lines) {
      if (!LEADER_VOICES[x.who] || !spokenText(x.l)) continue;
      const v = media.voices[voiceKey(x.f, x.s.title, x.i)];
      expect(v, `${x.f} "${x.s.title}" line ${x.i}`).toBeTruthy();
      expect(v.text).toBe(spokenText(x.l));
      n++;
    }
    expect(n).toBeGreaterThan(60);
  });

  it('stage directions are not spoken', () => {
    expect(spokenText('Delegate: (smiling, not looking up from the tea) Mm?')).toBe('Mm?');
    expect(spokenText('Delegate: (switches off the lights)')).toBe('');
  });
});

describe('the endings as films, the reveals as pictures', () => {
  it('each of the four endings has a film of four to eight shots, all baked, with its own music', () => {
    const endings = FACTIONS.flatMap((f) => [f.ending.picture, ...Object.values(f.endingByChoice?.scenes ?? {}).map((s) => s.picture)]);
    expect(endings.length).toBe(4);
    for (const e of endings) {
      const film = ENDING_FILMS.find((x) => x.scene === e);
      expect(film, e).toBeTruthy();
      expect(film!.shots.length).toBeGreaterThanOrEqual(4);
      expect(film!.shots.length).toBeLessThanOrEqual(8);
      for (const s of film!.shots) expect(media.clips[s.clip], `${e}: ${s.clip}`).toBeTruthy();
      expect(media.music[film!.music], film!.music).toBeTruthy();
    }
  });

  it('each reveal card names its own picture, and it is baked', () => {
    for (const f of FACTIONS) {
      expect(f.reveal?.picture).toBe(REVEAL_PICTURES[f.id]);
      expect(media.pictures[REVEAL_PICTURES[f.id]], f.id).toBeTruthy();
    }
  });
});
