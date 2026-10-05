/**
 * WHAT A PLAYER GETS AFTER EACH MISSION, over whole campaigns (Collins, Oct 5 2026: "how does our system even handle that
 * to make sure they get one unique thing after every mission?", then "lets build in the pacing wire the beats into the
 * right places and mark which are still empty (need video or writing)"). Drives the game's own rules (src/meta/*)
 * through a campaign won mission by mission, each faction as the ally, and prints, per return to the ship: the capture,
 * whose slot it is (the ally's plot or the main plot), what plays, and whether it is FILMED, a CARD (written, its film not
 * made: needs video) or EMPTY (nothing written for it: needs writing).
 *
 *   npx vite-node tools/measure/after-mission.measure.ts -- --run [--table]
 */
import fs from 'node:fs';
import path from 'node:path';
import { FACTIONS, HOME, LAST } from '../../content/campaign';
import type { FactionId } from '../../content/campaign';
import { ROACH_ADDRESSES } from '../../content/roachKing';
import { ally, dismissScene, finish, newCampaign, plan, stayLoyal, targets, type CampaignState } from '../../src/meta/campaign';
import { EARLY_ONCE, STORY_ONCE, greetingFor } from '../../src/meta/onboarding';
import { afterMission } from '../../src/meta/afterMission';
import { MAIN_PLOT_EVERY, MAIN_PLOT_FIRST, PERSONAL_CAPTURE, emptyRoachLog, lastMissionScenes, logRoach, type RoachLog } from '../../src/meta/roachKing';
import type { RunReport } from '../../src/meta/goals';
import type { RunStats } from '../../src/sim/types';

const ROOT = path.join(__dirname, '..', '..');
// The lorebook her Earth news is read from, as the game reads it (src/ui/campaignUi.ts).
const LORE = fs.readFileSync(path.join(ROOT, 'content', 'lore', 'ship-ai-lorebook.md'), 'utf8');
const readJson = (f: string) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch { return {}; } };
const FILMS = new Set(Object.keys(readJson('public/media/scenes/scenes.json').films ?? {}));
const ROACH_CLIPS = new Set(Object.keys(readJson('public/media/roach/roach.json').clips ?? {}));

/** FILMED, or CARD (written, no film yet: needs video). */
export function statusOf(id: string): 'FILMED' | 'CARD' {
  const address = ROACH_ADDRESSES.find((a) => a.id === id);
  if (address) return address.shots.every((x) => ROACH_CLIPS.has(x.id)) ? 'FILMED' : 'CARD';
  return FILMS.has(id) ? 'FILMED' : 'CARD';
}

const stats = (): RunStats => ({
  kills: {}, killsByFamily: {}, killsByCause: {}, healed: 0, limbsGrown: 0, evolutions: 0, limbsLost: 0,
  cannibalized: 0, coreMinFrac: 1, depositsClaimed: 0, earlyCalls: 0, maxLimbs: 0, maxBurning: 0, maxPips: 0,
  families: [], pacifistWaves: 0, lastWaveKillsByCause: {}, royalsEaten: 0, matingStuns: 0, limbsCarriedOff: 0,
  gateBurnKills: 0, royalsCaptured: 0, nodesPlaced: 0, nodesLost: 0,
});
const won: RunReport = { won: true, wavesCleared: 9, coreEndFrac: 0.6, scienceBanked: 0, stats: stats() };

export interface Return {
  n: number; where: string; capture: number | null; slot: 'ally' | 'main' | 'personal' | 'end' | null;
  faction: string[]; roach: string | null; waits: string | null;
  status: 'FILMED' | 'CARD' | 'YOKE' | 'EMPTY' | null; greeting: string; greetingNew: boolean;
}

/** Whose slot a capture is: the main plot's at 3, 6, 8, 10...; the personal plot's at 5; the ally's between. */
export const slotOf = (capture: number): 'ally' | 'main' | 'personal' =>
  capture === PERSONAL_CAPTURE ? 'personal' : capture === MAIN_PLOT_FIRST || (capture > PERSONAL_CAPTURE && (capture - PERSONAL_CAPTURE - 1) % MAIN_PLOT_EVERY === 0) ? 'main' : 'ally';

/** One campaign, allied with `with` from its first capture, every mission won, staying loyal at the midpoint. */
export function campaign(seed: number, withFaction: FactionId): { returns: Return[]; ended: boolean } {
  // Past the first mission (won), the desk open: as a campaign is when its captures begin.
  let s: CampaignState = { ...newCampaign(seed), onboard: { mission1: 'won', deskOpen: true } };
  let log: RoachLog = emptyRoachLog(seed);
  const said = new Set<string>();
  const returns: Return[] = [];
  for (let n = 1; n <= 40 && !s.ended; n++) {
    const open = targets(s);
    if (!open.length) break;
    // The last mission when it is open; else an ordinary landing; the ally's finale when nothing else is left.
    const pick = open.find((t) => t.id === LAST) ?? open.find((t) => !t.finaleOf) ?? open.find((t) => t.finaleOf === s.faction) ?? open[0];
    if (pick.id === LAST) for (const sc of lastMissionScenes(log)) log = logRoach(log, sc);
    const next = finish(s, plan(s, pick.id), won).state;
    const plays = afterMission(s, next, log);
    if (plays.roach) log = logRoach(log, { id: plays.roach });
    const capture = next.captures > s.captures ? next.captures : null;
    const end = !!pick.finaleOf || pick.id === LAST;
    s = next;
    // The ship: he sides with his ally after the first capture (its first meeting and his public pledge play then, on
    // this return), stays loyal at the midpoint, and watches what is waiting.
    let pledged: CampaignState['pendingScenes'] = [];
    if (!s.faction && s.captures >= 1) { const before = s.pendingScenes.length; s = ally(s, withFaction); pledged = s.pendingScenes.slice(before); }
    const faction = [...plays.faction, ...pledged].map((p) => p.scene.film ?? `card:${p.scene.title}`);
    const slot = capture === null ? null : end ? 'end' : slotOf(capture);
    if (s.midpoint?.status === 'offered') s = stayLoyal(s);
    while (s.pendingScenes.length) s = dismissScene(s);
    // Her greeting, as the ship says it (src/ui/campaignUi.ts welcome): a once-only moment is marked said.
    const { moment, greeting: g } = greetingFor(s, LORE);
    const fresh = !said.has(g.id);
    said.add(g.id);
    const once = EARLY_ONCE.includes(moment) || STORY_ONCE.some((b) => b.id === moment);
    s = { ...s, greet: null, lastGreeting: g.id, greetingsSaid: [...said], said: once ? [...(s.said ?? []), moment] : s.said };
    // The story of this return: the films, and the personal plot's beat when YOKE carries it (her text: written).
    const story = [...faction, ...(plays.roach ? [plays.roach] : [])];
    const personal = STORY_ONCE.some((b) => b.id === moment);
    const status = slot === null ? null : !story.length ? (personal ? 'YOKE' : 'EMPTY') : story.every((x) => !x.startsWith('card:') && statusOf(x) === 'FILMED') ? 'FILMED' : 'CARD';
    returns.push({ n, where: pick.id === HOME ? 'home' : pick.id, capture, slot, faction, roach: plays.roach, waits: plays.roachWaits, status, greeting: g.id, greetingNew: fresh });
  }
  return { returns, ended: !!s.ended };
}

if (process.argv.includes('--run')) {
  for (const f of FACTIONS) {
    const { returns, ended } = campaign(1234, f.id);
    const both = returns.filter((r) => r.faction.length && r.roach).length;
    const count = (st: string) => returns.filter((r) => r.status === st).length;
    const stale = returns.filter((r) => !r.greetingNew).length;
    console.log(`\n${f.id}: ${returns.length} missions${ended ? ', campaign ended' : ''}; two story films on one return: ${both}; FILMED ${count('FILMED')}, CARD (needs video) ${count('CARD')}, YOKE text only ${count('YOKE')}, EMPTY (needs writing) ${count('EMPTY')}; a greeting heard before: ${stale}`);
    if (process.argv.includes('--table')) {
      for (const r of returns) {
        const what = [...r.faction, ...(r.roach ? [r.roach] : []), ...(r.waits ? [`(${r.waits} waits)`] : [])].join(', ') || '-';
        console.log(`  ${String(r.n).padStart(2)} ${r.where.padEnd(14)} ${r.capture === null ? 'defence   ' : `capture ${String(r.capture).padEnd(2)}`} ${(r.slot ?? '').padEnd(5)} ${(r.status ?? '').padEnd(7)} ${what.padEnd(46)} yoke: ${r.greeting}${r.greetingNew ? '' : ' (again)'}`);
      }
    }
  }
}
