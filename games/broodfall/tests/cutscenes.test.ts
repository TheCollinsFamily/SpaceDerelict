/**
 * THE CUT SCENES AS FILMS (Collins, Oct 3 2026: "I think videos make sense for all of them"; content/cutscenes.ts,
 * tools/media/cutscenes.ts, src/ui/cutscene.ts). The shot lists against the scenes' words, and every baked film
 * against the words as they are now.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { FACTIONS, type Scene } from '../content/campaign';
import { FILMS, STILLS, filmOf } from '../content/cutscenes';
import { scenesOf, speakerOf, spokenText } from '../content/media';

const filmed: Array<{ faction: string; scene: Scene }> = FACTIONS.flatMap((f) => scenesOf(f).filter((s) => s.film).map((scene) => ({ faction: f.id, scene })));
const sceneOfFilm = (id: string) => filmed.find((x) => x.scene.film === id)!;
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
/** A clip is at most 8 seconds: about 22 words said at a talking pace. */
const MAX_WORDS = 22;

describe('the films of the cut scenes: the shot lists', () => {
  it('every beat, pledge and finale has a film, and every film has its scene', () => {
    expect(filmed.length).toBe(16);
    for (const x of filmed) expect(filmOf(x.scene.film), x.scene.film).toBeTruthy();
    for (const f of FILMS) {
      expect(sceneOfFilm(f.id), f.id).toBeTruthy();
      expect(sceneOfFilm(f.id).faction).toBe(f.faction);
    }
    expect(new Set(FILMS.map((f) => f.id)).size).toBe(FILMS.length);
  });

  it('every line of a filmed scene is said by exactly one shot, in order', () => {
    for (const f of FILMS) {
      const scene = sceneOfFilm(f.id).scene;
      const said = f.shots.filter((s) => s.line !== undefined).map((s) => s.line!);
      expect(said, f.id).toEqual(scene.lines.map((_, i) => i));
      expect(new Set(f.shots.map((s) => s.id)).size, `${f.id}: shot ids`).toBe(f.shots.length);
    }
  });

  it('a spoken line fits a clip, and has no word in capitals (a video voice spells it out)', () => {
    for (const x of filmed) {
      for (const l of x.scene.lines) {
        const t = spokenText(l);
        expect(words(t), `${x.scene.film}: "${t}"`).toBeLessThanOrEqual(MAX_WORDS);
        expect((t.match(/\b[A-Z]{2,}\b/g) ?? []).filter((w) => w !== 'AI'), `${x.scene.film}: "${t}"`).toEqual([]);
        expect(speakerOf(l), l).toMatch(/^(You|Delegate|The Voice|The Director)$/);
      }
    }
  });

  it('every shot starts from a picture that is described, and every picture\'s references are', () => {
    for (const f of FILMS) {
      expect(f.shots[0].from, `${f.id}: the first shot cannot continue one before it`).not.toBe('^');
      for (const s of f.shots) {
        if (s.from !== '^') expect(STILLS[s.from], `${f.id}/${s.id}: ${s.from}`).toBeTruthy();
        expect(s.action.length).toBeGreaterThan(10);
        if (s.line === undefined) { expect(s.secs, `${f.id}/${s.id}`).toBeTruthy(); expect(s.sound, `${f.id}/${s.id}`).toBeTruthy(); }
      }
      expect(f.room.length).toBeGreaterThan(10);
    }
    for (const [id, st] of Object.entries(STILLS)) {
      for (const r of st.refs) if (r !== 'hero' && r !== 'leader') expect(STILLS[r], `${id}: ${r}`).toBeTruthy();
      expect(st.shows).toMatch(/WHO|HOLO|TECH|[a-z]/);
      // The words that say which reference a picture copies must have that reference.
      const n = (st.shows.match(/\b(second|third) reference picture/g) ?? []).map((m) => (m.startsWith('third') ? 3 : 2));
      for (const k of n) expect(st.refs.length, id).toBeGreaterThanOrEqual(k);
    }
  });

  it('on the planet he is a hologram; aboard he is alone', () => {
    for (const [id, st] of Object.entries(STILLS)) {
      if (st.look === 'ship') { expect(st.shows, id).toMatch(/TECH/); expect(st.shows, id).not.toMatch(/WHO|HOLO/); }
      else expect(st.shows, id).not.toMatch(/TECH/);
    }
  });
});

describe('the films that are baked', () => {
  const file = 'public/media/scenes/scenes.json';
  const man: { films: Record<string, { video: string; poster: string; seconds: number; cues: Array<{ shot: string; line?: number; who?: string; text?: string; t0: number; t1: number }> }> } =
    existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { films: {} };

  it('the first film is baked (the test film of Oct 3 2026)', () => {
    expect(man.films['delegation-understand']).toBeTruthy();
  });

  it('each baked film is on disk, and says the scene\'s words as they are now, in order', () => {
    for (const [id, f] of Object.entries(man.films)) {
      expect(existsSync(`public/${f.video}`), f.video).toBe(true);
      expect(existsSync(`public/${f.poster}`), f.poster).toBe(true);
      const film = filmOf(id);
      expect(film, id).toBeTruthy();
      const scene = sceneOfFilm(id).scene;
      expect(f.cues.map((c) => c.shot)).toEqual(film!.shots.map((s) => s.id));
      let t = 0;
      for (const c of f.cues) {
        expect(c.t0, `${id}/${c.shot}`).toBeCloseTo(t, 1);
        expect(c.t1).toBeGreaterThan(c.t0);
        t = c.t1;
        if (c.line === undefined) continue;
        expect(c.text, `${id}/${c.shot}`).toBe(spokenText(scene.lines[c.line]));
        expect(c.who).toBe(speakerOf(scene.lines[c.line]));
      }
      expect(Math.abs(f.seconds - t), id).toBeLessThan(0.5);
    }
  });
});
