/**
 * THE SOUND (Sep 30 2026): every cue the game asks for is baked; every limb that fires and every
 * insect that dies has a sound; the music follows the screens as Collins asked (menu → ship → a
 * run's build / assault → the organ stage → the end), without flapping; the settings keep the new
 * "mute when away" switch.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENEMIES, TOWERS } from '../content/data';
import { DEFAULT_RULE, FIRE_CLASS, SCENE_TRACK, SFX_RULES, deathOf, sceneOf, type MusicScene } from '../src/audio/cues';
import { SHOT } from '../src/render/fxNames';
import { DEFAULT_SETTINGS, settingsFrom } from '../src/meta/settings';
// @ts-expect-error: the sound scripts are plain JavaScript modules
import { MUSIC, SFX, VOICE } from '../tools/audio/cues.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PUB = join(here, '..', 'public');
const file = join(PUB, 'audio', 'manifest.json');
const manifest = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;

describe('what makes a sound', () => {
  it('gives every limb that shoots a firing sound, and only sounds that have rules', () => {
    for (const fam of Object.keys(SHOT)) expect(FIRE_CLASS[fam as keyof typeof FIRE_CLASS], `${fam} fires`).toBeTruthy();
    for (const id of new Set(Object.values(FIRE_CLASS))) expect(SFX_RULES[id!], id).toBeTruthy();
    for (const t of TOWERS) if (FIRE_CLASS[t.family]) expect(SFX.some((s: { id: string }) => s.id === FIRE_CLASS[t.family]), t.family).toBe(true);
  });

  it('gives every insect a death, and the royals their own', () => {
    for (const e of ENEMIES) expect(SFX_RULES[deathOf(e.kind)], e.kind).toBeTruthy();
    expect(deathOf('royal')).toBe('die-boss');
    expect(deathOf('flier')).toBe('die-flier');
    expect(deathOf('soldier')).toBe('die-soldier');
    expect(deathOf('militia')).toBe('die-bug');
  });

  it('never lets a sound pile up: every rule has a gap and a polyphony cap', () => {
    for (const [id, r] of Object.entries(SFX_RULES)) {
      expect(r.poly, id).toBeGreaterThanOrEqual(1);
      expect(r.poly, id).toBeLessThanOrEqual(4);
      expect(r.gap, id).toBeGreaterThan(0.03);
      expect(r.gain, id).toBeLessThanOrEqual(1);
    }
    // The limbs, which fire most, are the quietest and the most varied.
    for (const id of new Set(Object.values(FIRE_CLASS))) expect(SFX_RULES[id!].gain, id).toBeLessThanOrEqual(0.45);
    expect(DEFAULT_RULE.poly).toBeLessThanOrEqual(2);
  });
});

describe('the music follows the screen', () => {
  const base = { film: false, menu: false, ship: false, started: false, organ: false, outcome: 'playing' as const, siege: false, enemies: 0 };
  it('walks menu → ship → build → assault → organ → end', () => {
    expect(sceneOf({ ...base, menu: true })).toBe('menu');
    expect(sceneOf({ ...base, ship: true })).toBe('ship');
    expect(sceneOf({ ...base, started: true })).toBe('build');
    expect(sceneOf({ ...base, started: true, siege: true, enemies: 12 })).toBe('assault');
    expect(sceneOf({ ...base, started: true, organ: true })).toBe('organ');
    expect(sceneOf({ ...base, started: true, outcome: 'won' })).toBe('end');
    expect(sceneOf({ ...base, film: true, menu: true })).toBe('film');
  });
  it('holds the assault until the board is clear (no flapping at two or three left)', () => {
    const s = { ...base, started: true, siege: true };
    let prev: MusicScene = sceneOf({ ...s, enemies: 1 }, 'build');
    expect(prev).toBe('build');
    prev = sceneOf({ ...s, enemies: 5 }, prev);
    expect(prev).toBe('assault');
    prev = sceneOf({ ...s, enemies: 1 }, prev);
    expect(prev).toBe('assault');
    expect(sceneOf({ ...s, enemies: 0 }, prev)).toBe('build');
  });
  it('has a loop for every scene that plays one', () => {
    for (const id of Object.values(SCENE_TRACK)) if (id) expect(MUSIC.find((m: { id: string }) => m.id === id)?.loop, id).toBe(true);
  });
});

describe('the settings', () => {
  it('keep "mute when away", on by default', () => {
    expect(DEFAULT_SETTINGS.muteUnfocused).toBe(true);
    expect(settingsFrom({}).muteUnfocused).toBe(true);
    expect(settingsFrom({ muteUnfocused: false }).muteUnfocused).toBe(false);
  });
});

describe.skipIf(!manifest)('the baked sounds (public/audio/)', () => {
  it('has every cue of tools/audio/cues.mjs, and every file it names', () => {
    for (const m of MUSIC) {
      const e = manifest.music[m.id];
      expect(e, m.id).toBeTruthy();
      expect(existsSync(join(PUB, e.file)), e.file).toBe(true);
      expect(e.seconds, m.id).toBeGreaterThan(m.loop ? 30 : 2);
      expect(!!e.loop, m.id).toBe(!!m.loop);
    }
    for (const s of SFX) {
      const e = manifest.sfx[s.id];
      expect(e?.files?.length, s.id).toBeGreaterThan(0);
      for (const f of e.files) expect(existsSync(join(PUB, f)), f).toBe(true);
    }
    for (const v of VOICE) if (manifest.voice[v.id]) expect(existsSync(join(PUB, manifest.voice[v.id].file))).toBe(true);
  });
  it('has a sound for every rule the game plays', () => {
    for (const id of Object.keys(SFX_RULES)) expect(manifest.sfx[id], id).toBeTruthy();
  });
  it('gives the busiest sounds several variants', () => {
    for (const id of ['fire-spit', 'hit-splat', 'die-bug', 'ui-click']) expect(manifest.sfx[id].files.length, id).toBeGreaterThanOrEqual(3);
  });
});
