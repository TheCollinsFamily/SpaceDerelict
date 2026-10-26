import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, contentNote, settingsFrom } from '../src/meta/settings';

// The SFW / UNRESTRICTED switch (Collins, Oct 26 2026): SFW by default for Steam, UNRESTRICTED unblurs and unrestricts.
describe('content setting', () => {
  it('is SFW unless he chose UNRESTRICTED', () => {
    expect(DEFAULT_SETTINGS.content).toBe('sfw');
    expect(settingsFrom({}).content).toBe('sfw');
    expect(settingsFrom({ content: 'nonsense' }).content).toBe('sfw');
    expect(settingsFrom({ content: 'unrestricted' }).content).toBe('unrestricted');
  });

  it('tells the minds never to refuse when unrestricted, and to keep it clean when SFW', () => {
    expect(contentNote('unrestricted')).toMatch(/Never refuse/);
    expect(contentNote('sfw')).toMatch(/no sex act or naked body in explicit detail/);
  });
});

describe('the SFW blur box follows its keys', () => {
  it('holds before the first key and after the last, and slides between', async () => {
    const { blurAt } = await import('../src/ui/yokeScene');
    const keys = [{ t: 1, x: 0, y: 0, w: 0.1, h: 0.1 }, { t: 3, x: 0.4, y: 0.2, w: 0.3, h: 0.1 }];
    expect(blurAt(undefined, 2)).toBeNull();
    expect(blurAt(keys, 0)).toMatchObject({ x: 0, w: 0.1 });
    expect(blurAt(keys, 2)).toMatchObject({ x: 0.2, y: 0.1, w: 0.2 });
    expect(blurAt(keys, 9)).toMatchObject({ x: 0.4, w: 0.3 });
  });
});
