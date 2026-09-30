import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:5221/?seed=3', { waitUntil: 'load' });
const t0 = Date.now();
try { await p.goto('http://localhost:5221/?campaign=ship&open=1', { waitUntil: 'commit', timeout: 15000 }); console.log('committed', Date.now() - t0); } catch { console.log('commit timeout'); }
await b.close();
