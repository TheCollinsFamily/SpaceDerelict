import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
const root='C:/Users/Merry/dev/space-derelict/games/broodfall';
const child = spawn('npx.cmd', ['vite','preview','--outDir','dist-looks','--port','5293','--strictPort'], { cwd: root, shell: true });
await new Promise(r=>child.stdout.on('data',d=>{ if(String(d).includes('localhost')) r(); }));
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://localhost:5293/?seed=11&autostart=1&speed=0&biome=suburb');
await p.waitForFunction(() => window.broodfall?.sim, null, {timeout:40000});
const out = await p.evaluate(() => { window.broodfall.step(200); const s = window.broodfall.sim; s.meat.war=9000; const r0=s.creepRangeCells; const desc=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(s),'creepRadius'); s.creepRadius += 156; const probe={r0, r1:s.creepRangeCells, getter: !!desc, any: [...Array(s.map.cells.length).keys()].filter(c=>s.canBuildTower(c)).length};
  const cells=[]; for (let c=0;c<s.map.cells.length;c++) if (s.canBuildTower(c,'frond')) cells.push(c);
  const g = cells.map(c=>s.groundFor(c,'frond','S')).filter(Boolean);
  const res=[]; for (let i=0;i<4;i++){ const c=cells.find(c=>s.groundFor(c,'frond','S')); s.hand[0]={id:99+i,family:'frond',free:true}; const r=s.issue({kind:'build',cardIndex:0,cell:c,facing:'S'}); res.push(r.err||'ok'); }
  return {probe, cells: cells.length, grounds: g.length, res};});
console.log(JSON.stringify(out)); await b.close(); child.kill(); process.exit(0);
