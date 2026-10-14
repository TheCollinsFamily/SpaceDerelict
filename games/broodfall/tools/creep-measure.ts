/** How far the creep reaches at the start, and whether the enemy can still find a station site, per creepBase. Scratch. */
import { Sim } from '../src/sim/sim';
import { CellType } from '../src/sim/citymap';
import { BALANCE as B } from '../content/data';

const keys = Object.keys(CellType).filter((k) => isNaN(Number(k)));
console.log('cell types:', keys.join(' '));
for (const base of [135, 200, 270]) {
  (B as { creepBase: number }).creepBase = base;
  for (const seed of [3, 4242, 7, 42]) {
    const s = new Sim({ gridW: 50, gridH: 40, cellPx: 26, seed });
    const cells = s.map.cells;
    const active = cells.filter((t) => t !== (CellType as unknown as Record<string, number>).Void).length;
    const at = (label: string) => {
      let creeped = 0;
      for (let c = 0; c < cells.length; c++) if (s.isCreeped(c)) creeped++;
      const site = (s as unknown as { stationSite(): number }).stationSite();
      console.log(`base ${base} seed ${seed} ${label}: creep ${s.creepRangeCells} hops, ${creeped}/${active} active cells creeped (${Math.round(100 * creeped / active)}%), station site ${site >= 0 ? 'yes' : 'NONE'}`);
    };
    at('t=0');
    for (let i = 0; i < 900; i++) s.tick();
    at('t=90s');
  }
}
