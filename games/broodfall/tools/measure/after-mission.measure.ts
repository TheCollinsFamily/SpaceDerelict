/**
 * WHAT A PLAYER GETS AFTER EACH MISSION, over whole campaigns (Collins, Oct 5 2026: "how does our system even handle that
 * to make sure they get one unique thing after every mission success? (unique YOKE line + (maybe if one available)
 * comic, faction video, main story video, etc.)"). Drives the game's own rules (src/meta/*) through a campaign won
 * mission by mission, each faction as the ally, and prints, per return to the ship: the faction scenes, the Roach King
 * piece, YOKE's greeting, and whether it was new this campaign.
 *
 *   npx vite-node tools/measure/after-mission.measure.ts -- --run [--table]
 */
import { FACTIONS, HOME, LAST } from '../../content/campaign';
import { ally, dismissScene, finish, newCampaign, plan, stayLoyal, targets, type CampaignState } from '../../src/meta/campaign';
import { greetingFor } from '../../src/meta/onboarding';
import { afterMission } from '../../src/meta/afterMission';
import { emptyRoachLog, lastMissionScenes, logRoach, type RoachLog } from '../../src/meta/roachKing';
import type { RunReport } from '../../src/meta/goals';
import type { RunStats } from '../../src/sim/types';
import type { FactionId } from '../../content/campaign';
import fs from 'node:fs';
import path from 'node:path';
// The lorebook her Earth news is read from, as the game reads it (src/ui/campaignUi.ts).
const LORE = fs.readFileSync(path.join(__dirname, '..', '..', 'content', 'lore', 'ship-ai-lorebook.md'), 'utf8');

const stats = (): RunStats => ({
  kills: {}, killsByFamily: {}, killsByCause: {}, healed: 0, limbsGrown: 0, evolutions: 0, limbsLost: 0,
  cannibalized: 0, coreMinFrac: 1, depositsClaimed: 0, earlyCalls: 0, maxLimbs: 0, maxBurning: 0, maxPips: 0,
  families: [], pacifistWaves: 0, lastWaveKillsByCause: {}, royalsEaten: 0, matingStuns: 0, limbsCarriedOff: 0,
  gateBurnKills: 0, royalsCaptured: 0, nodesPlaced: 0, nodesLost: 0,
});
const won: RunReport = { won: true, wavesCleared: 9, coreEndFrac: 0.6, scienceBanked: 0, stats: stats() };

export interface Return { n: number; where: string; faction: string[]; roach: string | null; waits: string | null; greeting: string; greetingNew: boolean }

/** One campaign, allied with `with` from its first capture, every mission won. */
export function campaign(seed: number, withFaction: FactionId): { returns: Return[]; ended: boolean } {
  let s: CampaignState = newCampaign(seed);
  let log: RoachLog = emptyRoachLog(seed);
  const said = new Set<string>();
  const returns: Return[] = [];
  for (let n = 1; n <= 40 && !s.ended; n++) {
    const open = targets(s);
    if (!open.length) break;
    // The last mission when it is open; else a finale only once every beat is seen; else the first open landing.
    const beatsDone = !!s.faction && FACTIONS.find((f) => f.id === s.faction)!.beats.every((b) => s.beatsSeen.includes(b.id));
    const pick = open.find((t) => t.id === LAST) ?? open.find((t) => !t.finaleOf) ?? (beatsDone ? open.find((t) => t.finaleOf === s.faction) : undefined) ?? open[0];
    if (pick.id === LAST) for (const sc of lastMissionScenes(log)) log = logRoach(log, sc);
    const next = finish(s, plan(s, pick.id), won).state;
    const plays = afterMission(s, next, log);
    if (plays.roach) log = logRoach(log, { id: plays.roach });
    const faction = next.pendingScenes.filter((p) => !p.contact && !p.offer).map((p) => p.scene.film ?? p.scene.title);
    s = next;
    // The ship: he answers what is waiting (the ally after the first capture; loyal at the midpoint), the scenes are watched.
    if (!s.faction && s.captures >= 1) s = ally(s, withFaction);
    if (s.midpoint?.status === 'offered') s = stayLoyal(s);
    while (s.pendingScenes.length) s = dismissScene(s);
    const g = greetingFor(s, LORE).greeting;
    const fresh = !said.has(g.id);
    said.add(g.id);
    s = { ...s, lastGreeting: g.id, greetingsSaid: [...said] };
    returns.push({ n, where: pick.id === HOME ? 'home' : pick.id, faction, roach: plays.roach, waits: plays.roachWaits, greeting: g.id, greetingNew: fresh });
  }
  return { returns, ended: !!s.ended };
}

if (process.argv.includes('--run')) {
  for (const f of FACTIONS) {
    const { returns, ended } = campaign(1234, f.id);
    const both = returns.filter((r) => r.faction.length && r.roach).length;
    const nothing = returns.filter((r) => !r.faction.length && !r.roach).length;
    const stale = returns.filter((r) => !r.greetingNew).length;
    console.log(`\n${f.id}: ${returns.length} missions${ended ? ', campaign ended' : ''}; a faction scene AND a Roach King piece: ${both}; neither: ${nothing}; a greeting heard before: ${stale}`);
    if (process.argv.includes('--table')) for (const r of returns) console.log(`  ${String(r.n).padStart(2)} ${r.where.padEnd(14)} faction: ${(r.faction.join(', ') || '-').padEnd(40)} roach: ${(r.roach ?? (r.waits ? `(${r.waits} waits)` : '-')).padEnd(24)} yoke: ${r.greeting}${r.greetingNew ? '' : ' (again)'}`);
  }
}
