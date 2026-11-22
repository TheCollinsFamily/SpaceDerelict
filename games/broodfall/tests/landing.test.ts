import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { coverBox, filmBoxOnBoard, landingDecision } from '../src/meta/landing';
import { DEFAULT_SETTINGS, settingsFrom } from '../src/meta/settings';

const base = { mode: 'always' as const, set: 'suburb', seen: [] as string[], hasFilm: true, afterOpening: false, automated: false, forced: false, off: false };

describe('the landing film: when it plays', () => {
  it('plays before every deployment by default', () => {
    expect(DEFAULT_SETTINGS.landingFilms).toBe('always');
    expect(landingDecision(base)).toBe('play');
    expect(landingDecision({ ...base, seen: ['suburb'] })).toBe('play');
  });
  it('first time per tile set, never, and the setting kept', () => {
    expect(landingDecision({ ...base, mode: 'first' })).toBe('play');
    expect(landingDecision({ ...base, mode: 'first', seen: ['suburb'] })).toBe('seen-set');
    expect(landingDecision({ ...base, mode: 'first', seen: ['megacity'] })).toBe('play');
    expect(landingDecision({ ...base, mode: 'never' })).toBe('setting-never');
    expect(settingsFrom({ landingFilms: 'first' }).landingFilms).toBe('first');
    expect(settingsFrom({ landingFilms: 'nonsense' }).landingFilms).toBe('always');
  });
  it('mission 1 after the opening film has none (the opening is its landing); no film, no wait', () => {
    expect(landingDecision({ ...base, afterOpening: true })).toBe('after-opening');
    expect(landingDecision({ ...base, hasFilm: false })).toBe('no-film');
    expect(landingDecision({ ...base, set: null })).toBe('no-film');
  });
  it('beats skip it unless they ask; the address can turn it off', () => {
    expect(landingDecision({ ...base, automated: true })).toBe('automation');
    expect(landingDecision({ ...base, automated: true, forced: true })).toBe('play');
    expect(landingDecision({ ...base, mode: 'never', forced: true, automated: true })).toBe('setting-never');
    expect(landingDecision({ ...base, off: true, forced: true })).toBe('asked-off');
  });
});

describe('the landing film: its last frame laid on the board', () => {
  const art = { canvas: { w: 1360, h: 1000 }, band: { x: 0, y: 118, w: 1360, h: 765, left: 0, top: 118, width: 1360, height: 765 } };
  it('maps the band of the canvas through the canvas box on the screen', () => {
    const r = filmBoxOnBoard({ left: 100, top: 50, width: 680, height: 500 }, art, { core: { x: 474, y: 717 } }, { x: 474, y: 717 });
    expect(r).toEqual({ left: 100, top: 50 + 59, width: 680, height: 382.5 });
  });
  it('on the old 1360x1000 canvas at the films\' own framing, the board view changes nothing', () => {
    const box = { left: 100, top: 50, width: 680, height: 500 };
    const old = filmBoxOnBoard(box, art, { core: { x: 474, y: 717 } }, { x: 600, y: 500 });
    const now = filmBoxOnBoard(box, art, { core: { x: 474, y: 717 } }, { x: 600, y: 500 }, { canvasW: 1360, liveScale: 0.644, filmScale: 0.644 });
    for (const k of ['left', 'top', 'width', 'height'] as const) expect(now[k]).toBeCloseTo(old[k], 6);
  });
  it('on a canvas that fills the window (Nov 22 2026), every board point of the film lies on the same point of the live board', () => {
    // His window: a 2781x1175 canvas drawn 1:1, the board framed bigger than in the films.
    const box = { left: 0, top: 72, width: 2781, height: 1175 };
    const filmScale = 0.644, liveScale = 0.758;
    const filmCore = { x: 474, y: 717 }, liveCore = { x: 1500, y: 640 }; // canvas pixels
    const r = filmBoxOnBoard(box, art, { core: filmCore }, liveCore, { canvasW: 2781, liveScale, filmScale });
    // A board point d world pixels from the meteor: in the film at filmCore + d*filmScale, live at liveCore + d*liveScale.
    for (const d of [{ x: 0, y: 0 }, { x: 300, y: -120 }, { x: -500, y: 260 }]) {
      const fx = filmCore.x + d.x * filmScale, fy = filmCore.y + d.y * filmScale; // film canvas pixels
      const onScreen = { x: r.left + ((fx - art.band.x) / art.band.w) * r.width, y: r.top + ((fy - art.band.y) / art.band.h) * r.height };
      const live = { x: box.left + liveCore.x + d.x * liveScale, y: box.top + liveCore.y + d.y * liveScale };
      expect(onScreen.x).toBeCloseTo(live.x, 6);
      expect(onScreen.y).toBeCloseTo(live.y, 6);
    }
    // ...and the same when the canvas is drawn smaller than its pixels (a canvas box half its own width).
    const half = { left: 10, top: 20, width: 683, height: 261.5 };
    const h = filmBoxOnBoard(half, art, { core: filmCore }, { x: 683, y: 261 }, { canvasW: 1366, liveScale: 0.34, filmScale });
    const fx = filmCore.x + 200 * filmScale;
    expect(h.left + ((fx - art.band.x) / art.band.w) * h.width).toBeCloseTo(10 + (683 + 200 * 0.34) * 0.5, 6);
  });
  it('moves the film so its crater lies on the live meteor', () => {
    const r = filmBoxOnBoard({ left: 0, top: 0, width: 1360, height: 1000 }, art, { core: { x: 474, y: 717 } }, { x: 600, y: 500 });
    expect(r.left).toBe(126);
    expect(r.top).toBe(118 - 217);
  });
  it('covers the window like object-fit: cover', () => {
    const r = coverBox(1600, 1000, 16 / 9);
    expect(r.width).toBeCloseTo(1777.78, 1);
    expect(r.height).toBe(1000);
    expect(r.left).toBeCloseTo(-88.89, 1);
  });
});

describe('the landing films on disk', () => {
  const file = path.join(__dirname, '..', 'public', 'art', 'landing', 'landing.json');
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'art', 'manifest.json'), 'utf8'));
  it('one film per tile set, every file there, the strike inside the film', () => {
    for (const set of Object.keys(manifest.biomes)) {
      const f = j.films[set];
      expect(f, set).toBeTruthy();
      for (const k of ['video', 'start', 'end']) expect(fs.existsSync(path.join(__dirname, '..', 'public', 'art', f[k])), `${set} ${k}`).toBe(true);
      expect(f.seconds).toBeGreaterThan(5);
      expect(f.seconds).toBeLessThan(10);
      expect(f.strikeAt).toBeGreaterThan(f.fallAt);
      expect(f.strikeAt).toBeLessThan(f.seconds);
    }
  });
  it('its sounds are baked', () => {
    const a = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'audio', 'manifest.json'), 'utf8'));
    for (const id of ['land-roar', 'land-impact']) expect(a.sfx[id]?.files?.length, id).toBeGreaterThan(0);
  });
});
