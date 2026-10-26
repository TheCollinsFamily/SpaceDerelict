import { it } from 'vitest';
import { Autoplayer } from '../../src/sim/autoplayer';
import { DT, Sim, enemySpec } from '../../src/sim/sim';
import { newCampaign, plan, targets, type CampaignState } from '../../src/meta/campaign';
it('probe', () => {
  for (const id of ['follow-courier', 'puppet-queen']) for (let seed = 1; seed <= 5; seed++) {
    const s: CampaignState = { ...newCampaign(seed * 97), onboard: { mission1: 'won', deskOpen: true }, captures: 3 };
    const t = targets(s)[0];
    const p = plan(s, t.id, { experiment: id });
    const sim = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed: 1, organStage: true, ...p.config } as any);
    const bot = new Autoplayer(seed + 1); bot.experimenter = true;
    let stolen = 0, royals = 0, sci = 0, minRoyalFrac = 1, cageAt = -1; let ticks = 0;
    const seen = new Set<number>();
    while (sim.outcome === 'playing' && ticks < 30000) {
      bot.act(sim, DT); sim.tick();
      for (const ev of sim.takeEvents()) if (ev.kind === 'tower-stolen') stolen++;
      for (const e of sim.enemies) { if (seen.has(e.id)) { if (enemySpec(e.kind).caste === 'royal') minRoyalFrac = Math.min(minRoyalFrac, e.hp / e.maxHp); continue; } seen.add(e.id); const c = enemySpec(e.kind).caste; if (c === 'royal') royals++; if (c === 'science') sci++; }
      if (cageAt < 0 && sim.towers.some((x) => x.family === 'cage')) cageAt = sim.wavesCleared;
      ticks++;
    }
    console.log(id, t.id, sim.outcome, 'waves', sim.wavesCleared, 'science bodies', sci, 'stolen', stolen, 'carried off', sim.stats.limbsCarriedOff, 'recovered', (sim.stats as any).limbsRecovered ?? 0, 'royals', royals, 'min royal hp', minRoyalFrac.toFixed(2), 'captured', sim.stats.royalsCaptured, 'cage placed at wave', cageAt, 'cage kills', sim.stats.killsByFamily['cage'] ?? 0);
  }
});
