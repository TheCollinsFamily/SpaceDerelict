/**
 * The loaders (src/ui/loader.ts, Oct 1 2026): YOKE's dance is a treat on the ship's waits, never twice running, and
 * the beats can pin it. The page side (every wait shows a moving loop) is tools/shot-loading.mjs.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LOADER_DELAY_MS, shipLoop } from '../src/ui/loader';

function store(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => m.get(k) ?? null,
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
  };
}

describe('the ship\'s loaders', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = store();
    (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = store();
  });
  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    delete (globalThis as unknown as { sessionStorage?: Storage }).sessionStorage;
  });

  it('YOKE dances on some ship waits, never on two running', () => {
    const got = Array.from({ length: 400 }, () => shipLoop());
    const dances = got.filter((k) => k === 'dance').length;
    expect(dances).toBeGreaterThan(40);
    expect(dances).toBeLessThan(200);
    for (let i = 1; i < got.length; i++) expect(got[i] === 'dance' && got[i - 1] === 'dance').toBe(false);
    expect(got.every((k) => k === 'dance' || k === 'scan')).toBe(true);
  });

  it('the beats can pin the loop', () => {
    localStorage.setItem('broodfall-loader', 'dance');
    expect([shipLoop(), shipLoop(), shipLoop()]).toEqual(['dance', 'dance', 'dance']);
  });

  it('a wait under 400 ms shows nothing (her dance has no words since Oct 26 2026)', () => {
    expect(LOADER_DELAY_MS).toBe(400);
  });
});
