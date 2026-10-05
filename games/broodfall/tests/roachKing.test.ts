import { describe, expect, it } from 'vitest';
import { ROACH_ADDRESSES, ROACH_SCENES, ROACH_STILLS } from '../content/roachKing';
import { filmOf } from '../content/cutscenes';
import { speakerOf, spokenText } from '../content/media';
import { CHANNELS, channelOfLine, noteFor } from '../content/translation';
import { FACTIONS } from '../content/campaign';
import {
  MAIN_PLOT, MAIN_PLOT_EVERY, MAIN_PLOT_FIRST, dueAddress, dueAfterDeployment, dueScene, emptyRoachLog, lastMissionScenes, logRoach, mainPlotSlots,
  type RoachLog,
} from '../src/meta/roachKing';
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

describe('the Roach King: when he comes on the air (the main plot, paced Oct 5 2026)', () => {
  // Captures 3, 5, 7, 9, 11 are his; the ally's are between (content/campaign.ts).
  const after = (captures: number, patch: Partial<CampaignState> = {}) => at({ captures, deployments: captures, held: held(captures), ...patch });
  const play = (s: CampaignState, log: RoachLog) => { const d = dueAfterDeployment(s, log); const id = d ? ('scene' in d ? d.scene.id : d.address.id) : null; return { id, log: id ? logRoach(log, { id }) : log }; };

  it('nothing before the third capture; then one piece every second capture', () => {
    expect(mainPlotSlots(after(MAIN_PLOT_FIRST - 1))).toBe(0);
    expect(dueAfterDeployment(after(MAIN_PLOT_FIRST - 1), emptyRoachLog(7))).toBeNull();
    expect(mainPlotSlots(after(MAIN_PLOT_FIRST))).toBe(1);
    // Capture 5 is the personal plot's: his second slot is capture 6, then every second capture.
    expect(mainPlotSlots(after(5))).toBe(1);
    expect(mainPlotSlots(after(6))).toBe(2);
    expect(mainPlotSlots(after(6 + MAIN_PLOT_EVERY))).toBe(3);
    // One piece per slot: after his first, nothing until the next slot is reached.
    expect(dueAddress(after(4), seen('rk-address'))).toBeNull();
  });
  it('in the order of the main plot; the piece on the ally is about his own ally', () => {
    let log = emptyRoachLog(7);
    const order: (string | null)[] = [];
    for (let c = 1; c <= 13; c++) { const r = play(after(c, { faction: 'faithful' }), log); log = r.log; if (r.id) order.push(r.id); }
    expect(order).toEqual(MAIN_PLOT.map((x) => (x === 'ally' ? 'rk-faithful' : x)));
  });
  it('a counter-attack massing takes the next slot, after his introduction', () => {
    expect(dueAddress(after(3, { underAttack: 'harbor' }), emptyRoachLog(7))?.id).toBe('rk-address');
    expect(dueAddress(after(6, { underAttack: 'harbor' }), seen('rk-address'))?.id).toBe('rk-counter');
    expect(dueAddress(after(8), seen('rk-address', 'rk-counter'))?.id).toBe('rk-draft');
  });
  it('a lost mission earns nothing: the slot count is in captures', () => {
    const s = after(3);
    const log = seen('rk-address');
    expect(dueAfterDeployment({ ...s, deployments: s.deployments + 3 }, log)).toBeNull();
  });
  it('nothing of his once the finale is played; off the air when the last mission is won', () => {
    expect(dueAfterDeployment(after(13, { faction: 'faithful', finale: 'faithful' }), seen('rk-address'))).toBeNull();
    const ended = after(14, { faction: 'faithful', finale: 'faithful', ended: 'faithful' });
    expect(dueAddress(ended, seen('rk-address'))?.id).toBe('rk-offline');
    expect(dueAddress(ended, seen('rk-address', 'rk-offline'))).toBeNull();
  });
  it('each plays once', () => {
    const s = after(3);
    const a = dueAddress(s, emptyRoachLog(7))!;
    expect(dueAddress(s, logRoach(emptyRoachLog(7), a))).toBeNull();
  });
});

describe('the Roach King off the air (Collins, Oct 4 2026): the central plot', () => {
  const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

  it('three scenes: the briefing, the call about the transports, his last message; each with its film\'s shot list', () => {
    expect(ROACH_SCENES.map((x) => x.id)).toEqual(['rk-briefing', 'rk-transports', 'rk-founding']);
    expect(ROACH_SCENES.map((x) => x.when)).toEqual(['briefing', 'last-call', 'last-address']);
    for (const sc of ROACH_SCENES) {
      expect(sc.scene.film, sc.id).toBe(sc.id);
      const film = filmOf(sc.id);
      expect(film, sc.id).toBeTruthy();
      // Every line is said by one shot, in order.
      expect(film!.shots.filter((x) => x.line !== undefined).map((x) => x.line)).toEqual(sc.scene.lines.map((_, i) => i));
      for (const l of sc.scene.lines) {
        expect(speakerOf(l), l).toMatch(/^(The Roach King|Aide|General)$/);
        expect(channelOfLine(l), l).toBe('roach');
        // A clip is 8 seconds; a video voice spells out a word in capitals.
        expect(words(spokenText(l)), l).toBeLessThanOrEqual(22);
        expect(spokenText(l).match(/\b[A-Z]{2,}\b/g) ?? [], l).toEqual([]);
      }
    }
  });

  it('his words are the ones Collins wrote', () => {
    const all = ROACH_SCENES.flatMap((x) => x.scene.lines.map(spokenText)).join(' ');
    for (const said of [
      'the Alliance of Nations have lost another territory', 'Of course they have', 'Are you fucking kidding me',
      'an enemy that appears to grow more powerful the more it kills', 'the warrior caste have a long tradition of honor',
      'They have a long tradition of being retards, is more like it', 'They are going to get us all killed',
      'The transports have been sabotaged', 'We will never make it in time', 'You disapprove? Well, too bad!',
      'without the war caste feeding them from the start, I think we could win',
      'today is the founding day of the empire', 'no longer be known as an imperial holiday', 'Today we celebrate our Independence Day!',
    ]) expect(all, said).toContain(said);
  });

  it('the briefing is the third piece of the main plot (capture 8 when no counter-attack came)', () => {
    expect(dueScene(at({ captures: 8, deployments: 8 }), seen('rk-address', 'rk-draft'))?.id).toBe('rk-briefing');
    expect(dueScene(at({ captures: 7, deployments: 7 }), seen('rk-address', 'rk-draft'))).toBeNull();
  });

  it('the call, then his last message, when the last mission is launched: each once', () => {
    expect(lastMissionScenes(emptyRoachLog(7)).map((x) => x.id)).toEqual(['rk-transports', 'rk-founding']);
    expect(lastMissionScenes(seen('rk-transports')).map((x) => x.id)).toEqual(['rk-founding']);
    expect(lastMissionScenes(seen('rk-transports', 'rk-founding'))).toEqual([]);
  });

});
