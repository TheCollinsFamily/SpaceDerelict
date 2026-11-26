/**
 * THE MISSION MUSIC GOES ON (src/audio/engine.ts startPlaylist), Bruno's playtest, Nov 26 2026: "during the final
 * phase the song ended and it didn't loop/went for the next one in the playlist". Build and assault share
 * 'playlist:mission'; each switch between them moved the scene token on while the list kept playing, and the next
 * track checked that token, so the music stopped at the end of the first song after any wave began.
 *
 * The browser's sound is stood in for (an AudioContext that is running, <audio> elements whose end the test fires):
 * this is the engine's own rule for what plays next, not the sound.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

class FakeAudio {
  static made: FakeAudio[] = [];
  src = '';
  preload = '';
  currentTime = 0;
  loop = false;
  played = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { FakeAudio.made.push(this); }
  play(): Promise<void> { this.played++; return Promise.resolve(); }
  pause(): void {}
  load(): void {}
  removeAttribute(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
}

const param = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
const node = () => ({ gain: param(), fftSize: 0, connect(n: unknown) { return n; }, disconnect() {} });
class FakeContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  createGain() { return node(); }
  createAnalyser() { return node(); }
  createMediaElementSource() { return node(); }
  resume() { return Promise.resolve(); }
  addEventListener() {}
}

const manifest = {
  v: 1, sfx: {}, voice: {},
  music: {
    'song-a': { file: 'audio/mission/a.ogg', seconds: 100, loop: false },
    'song-b': { file: 'audio/mission/b.ogg', seconds: 100, loop: false },
    'song-c': { file: 'audio/mission/c.ogg', seconds: 100, loop: false },
  },
  playlists: { mission: ['song-a', 'song-b', 'song-c'], organ: ['song-c'] },
};

let engine: typeof import('../src/audio/engine');
const settle = () => new Promise((r) => setTimeout(r, 20));
const trackOf = (a: FakeAudio) => a.src.split('/').pop();

beforeAll(async () => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } });
  vi.stubGlobal('document', { baseURI: 'http://localhost/', hidden: false, hasFocus: () => true, addEventListener() {}, documentElement: { style: { setProperty() {} }, classList: { toggle() {} } } });
  vi.stubGlobal('window', { AudioContext: FakeContext, addEventListener() {}, setTimeout, clearTimeout, setInterval: () => 0 });
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, json: () => Promise.resolve(manifest) }));
  engine = await import('../src/audio/engine');
  engine.initAudio();
  await settle();
});

describe('the mission playlist', () => {
  it('starts the next song when one ends, after the scene went from build to assault', async () => {
    engine.setScene('build');
    await settle();
    expect(FakeAudio.made.length, 'the first song streams').toBe(1);
    const first = FakeAudio.made[0];
    // A wave starts: the assault scene, the same playlist (it plays on, nothing new starts).
    engine.setScene('assault');
    await settle();
    expect(FakeAudio.made.length).toBe(1);
    // The song ends: the next one in the shuffle must start.
    first.onended?.();
    await settle();
    expect(FakeAudio.made.length, 'a next song after the first ended').toBe(2);
    const second = FakeAudio.made[1];
    expect(second.played).toBe(1);
    expect(trackOf(second)).not.toBe(trackOf(first));
    // And after the wave (back to build), the one after that.
    engine.setScene('build');
    await settle();
    second.onended?.();
    await settle();
    expect(FakeAudio.made.length, 'a third song').toBe(3);
    expect(FakeAudio.made[2].played).toBe(1);
  });

  it('a song that ends after its playlist was left starts nothing', async () => {
    const before = FakeAudio.made.length;
    const playing = FakeAudio.made[before - 1];
    engine.setScene('organ');
    await settle();
    const after = FakeAudio.made.length;
    expect(after, 'the organ playlist starts').toBe(before + 1);
    playing.onended?.(); // the mission song that is fading out comes to its end
    await settle();
    expect(FakeAudio.made.length, 'the left playlist does not come back').toBe(after);
  });
});
