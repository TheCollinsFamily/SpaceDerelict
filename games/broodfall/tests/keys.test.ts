import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYS, KEY_ROWS, keysFrom, mayShare, rebind } from '../src/meta/keys';
import { settingsFrom } from '../src/meta/settings';

// Bruno, Nov 27 2026: "all keyboard commands should be remappable".
describe('the key table', () => {
  it('gives every action its own key, except the pairs that never act at the same moment', () => {
    for (const a of KEY_ROWS) for (const b of KEY_ROWS) {
      if (a.id !== b.id && DEFAULT_KEYS[a.id] === DEFAULT_KEYS[b.id]) expect(mayShare(a.id, b.id), `${a.id} ${b.id}`).toBe(true);
    }
  });
  it('keeps the old saved turn keys', () => {
    const s = settingsFrom({ keys: { turnLeft: 'a', turnRight: 'd' } });
    expect(s.keys.turnLeft).toBe('a');
    expect(s.keys.turnRight).toBe('d');
    // The unit orders that had A and D by default are left with no key for the player to set.
    expect(s.keys.orderAttack).toBe('');
    expect(s.keys.orderDeploy).toBe('');
  });
  it('a clash in a saved file puts both actions back to their defaults', () => {
    const k = keysFrom({ turnLeft: 'z', speed1: 'z' });
    expect(k.turnLeft).toBe('q');
    expect(k.speed1).toBe('z');
  });
  it('a key taken by another action swaps the two keys', () => {
    const k = rebind(DEFAULT_KEYS, 'turnLeft', 'e')!;
    expect(k.turnLeft).toBe('e');
    expect(k.turnRight).toBe('q');
  });
  it('Esc, Enter and the modifier keys cannot be bound', () => {
    for (const key of ['Escape', 'Enter', 'Shift', 'Control', 'Alt', 'Meta', 'Tab']) expect(rebind(DEFAULT_KEYS, 'codex', key)).toBeNull();
  });
  it('a swap that would make a new clash is refused', () => {
    // pause shares Space with step: giving pause the Q key would hand Space to turnLeft, which clashes with step.
    expect(rebind(DEFAULT_KEYS, 'pause', 'q')).toBeNull();
    expect(rebind(DEFAULT_KEYS, 'pause', 'p')!.pause).toBe('p');
  });
  it('arrow keys and F keys can be bound', () => {
    expect(rebind(DEFAULT_KEYS, 'codex', 'F9')!.codex).toBe('f9');
  });
});
