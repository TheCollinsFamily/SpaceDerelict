import { describe, expect, it } from 'vitest';
import { ROACH_ADDRESSES, ROACH_STILLS } from '../content/roachKing';
import { CHANNELS, channelOfLine, noteFor } from '../content/translation';
import { FACTIONS } from '../content/campaign';
import { DRAFT_HELD, FIRST_ADDRESS_AFTER, STAND_HELD, dueAddress, emptyRoachLog, logRoach, type RoachLog } from '../src/meta/roachKing';
import { newCampaign, type CampaignState } from '../src/meta/campaign';

const at = (patch: Partial<CampaignState>): CampaignState => ({ ...newCampaign(7), ...patch });
const held = (n: number) => ['crash-site', 'cul-de-sac', 'granary', 'harbor', 'commuter', 'temple', 'foundry', 'mirewater', 'university', 'ossuary', 'pilgrim'].slice(0, n + 1);
const seen = (...ids: string[]): RoachLog => ({ seed: 7, seen: ids });

describe('the Roach King: content', () => {
  it('every address has shots, each from a known still, each line short enough for its clip', () => {
    const ids = new Set<string>();
    for (const a of ROACH_ADDRESSES) {
      expect(a.shots.length).toBeGreaterThan(0);
      for (const s of a.shots) {
        expect(ids.has(s.id), s.id).toBe(false);
        ids.add(s.id);
        expect(ROACH_STILLS as readonly string[]).toContain(s.from);
        // A clip is at most 8 s; he talks fast, but not that fast.
        expect(s.line.split(/\s+/).filter(Boolean).length, s.id).toBeLessThanOrEqual(21);
      }
    }
  });
  it('one ally address per faction, and every faction has one', () => {
    for (const f of FACTIONS) expect(ROACH_ADDRESSES.filter((a) => a.when === 'ally' && a.faction === f.id)).toHaveLength(1);
  });
  it('his lines are YOKE\'s renderings, on their own channel', () => {
    expect(CHANNELS.roach.source).toMatch(/INTERCEPTED/);
    expect(channelOfLine('The Roach King: Chat says it is just a fungus.')).toBe('roach');
    const lines = ROACH_ADDRESSES.flatMap((a) => a.shots.map((s) => `The Roach King: ${s.line}`));
    // Her notes on him match real lines.
    expect(lines.filter((l) => noteFor(l)).length).toBeGreaterThanOrEqual(4);
  });
});

describe('the Roach King: when he comes on the air', () => {
  it('never before the third deployment', () => {
    expect(dueAddress(at({ deployments: 0 }), emptyRoachLog(7))).toBeNull();
    expect(dueAddress(at({ deployments: FIRST_ADDRESS_AFTER - 1, held: held(4), underAttack: 'harbor' }), emptyRoachLog(7))).toBeNull();
  });
  it('introduces himself first, whatever else is due', () => {
    const s = at({ deployments: FIRST_ADDRESS_AFTER, held: held(DRAFT_HELD), underAttack: 'harbor' });
    expect(dueAddress(s, emptyRoachLog(7))?.id).toBe('rk-address');
    // Then the counter-attack before the draft.
    expect(dueAddress(s, seen('rk-address'))?.id).toBe('rk-counter');
    expect(dueAddress(s, seen('rk-address', 'rk-counter'))?.id).toBe('rk-draft');
    expect(dueAddress(s, seen('rk-address', 'rk-counter', 'rk-draft'))).toBeNull();
  });
  it('the draft at three territories held, not two', () => {
    expect(dueAddress(at({ deployments: 5, held: held(DRAFT_HELD - 1) }), seen('rk-address'))).toBeNull();
    expect(dueAddress(at({ deployments: 5, held: held(DRAFT_HELD) }), seen('rk-address'))?.id).toBe('rk-draft');
  });
  it('speaks of the ally once two of its beats are seen; a switched ally gets its own', () => {
    const f = FACTIONS.find((x) => x.id === 'delegation')!;
    const one = at({ deployments: 4, faction: 'delegation', beatsSeen: [f.beats[0].id] });
    expect(dueAddress(one, seen('rk-address'))).toBeNull();
    const two = at({ deployments: 5, faction: 'delegation', beatsSeen: f.beats.slice(0, 2).map((b) => b.id) });
    expect(dueAddress(two, seen('rk-address'))?.id).toBe('rk-delegation');
    const g = FACTIONS.find((x) => x.id === 'institute')!;
    const switched = at({ deployments: 7, faction: 'institute', beatsSeen: [...f.beats.slice(0, 2), ...g.beats.slice(0, 2)].map((b) => b.id) });
    expect(dueAddress(switched, seen('rk-address', 'rk-delegation'))?.id).toBe('rk-institute');
  });
  it('the last stand when the ally\'s finale opens (or deep in with no ally); offline at the end', () => {
    const f = FACTIONS.find((x) => x.id === 'faithful')!;
    const all = at({ deployments: 9, faction: 'faithful', beatsSeen: f.beats.map((b) => b.id) });
    expect(dueAddress(all, seen('rk-address', 'rk-faithful'))?.id).toBe('rk-stand');
    expect(dueAddress(at({ deployments: 12, held: held(STAND_HELD) }), seen('rk-address', 'rk-draft'))?.id).toBe('rk-stand');
    const ended = at({ deployments: 10, faction: 'faithful', beatsSeen: f.beats.map((b) => b.id), ended: 'faithful' });
    expect(dueAddress(ended, seen('rk-address', 'rk-faithful'))?.id).toBe('rk-offline');
    // Nothing after the broadcast has ended.
    expect(dueAddress(ended, seen('rk-address', 'rk-faithful', 'rk-stand', 'rk-offline', 'rk-draft'))).toBeNull();
  });
  it('each plays once', () => {
    const s = at({ deployments: 3 });
    const a = dueAddress(s, emptyRoachLog(7))!;
    expect(dueAddress(s, logRoach(emptyRoachLog(7), a))).toBeNull();
  });
});
