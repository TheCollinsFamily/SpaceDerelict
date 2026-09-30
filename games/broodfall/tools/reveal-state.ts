/**
 * A campaign played to the end of one route, as JSON on stdout: for looking at the reveal card
 * (DESIGN.md "The reveal") in the real page without playing the whole route by hand.
 *   npx vite-node tools/reveal-state.ts -- faithful > state.json
 * Load it as localStorage 'broodfall-campaign' and open the ship: the ending, then the reveal.
 */
import { ally, finish, newCampaign, plan, targets, type CampaignState } from '../src/meta/campaign';
import type { RunReport } from '../src/meta/goals';
import type { FactionId } from '../content/campaign';
import type { RunStats } from '../src/sim/types';

const route = (process.argv.slice(2).filter((a) => a !== '--')[0] ?? 'faithful') as FactionId;
const stats = (): RunStats => ({
  kills: {}, killsByFamily: {}, killsByCause: {}, healed: 0, limbsGrown: 0, evolutions: 0, limbsLost: 0,
  cannibalized: 0, coreMinFrac: 1, depositsClaimed: 0, earlyCalls: 0, maxLimbs: 0, maxBurning: 0, maxPips: 0,
  families: [], pacifistWaves: 0, lastWaveKillsByCause: {}, royalsEaten: 0, matingStuns: 0, limbsCarriedOff: 0,
  gateBurnKills: 0, royalsCaptured: 0, nodesPlaced: 0, nodesLost: 0,
});
const won = (): RunReport => ({ won: true, wavesCleared: 6, coreEndFrac: 0.8, scienceBanked: 0, stats: stats() });

let s: CampaignState = newCampaign(11);
s = finish(s, plan(s, targets(s)[0].id), won()).state;
s = ally(s, route);
for (let i = 0; i < 60 && !s.ended; i++) {
  const t = targets(s);
  const to = s.underAttack ?? (t.find((x) => x.finaleOf === route) ?? t.find((x) => !x.finaleOf) ?? t[0])?.id;
  if (!to) break;
  s = finish(s, plan(s, to), won()).state;
  // Choices along the route: take the first option, so the route goes on.
  const c = s.pendingScenes.find((p) => p.choice);
  if (c && c.beat) s = { ...s, choices: { ...s.choices, [c.beat]: c.choice!.options[0].id } };
}
// Keep only the ending and the reveal waiting on the ship.
s = { ...s, pendingScenes: s.pendingScenes.slice(-2) };
process.stdout.write(JSON.stringify(s));
