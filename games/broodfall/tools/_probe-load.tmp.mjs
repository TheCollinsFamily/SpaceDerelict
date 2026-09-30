import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
const pending = new Map();
p.on('request', (r) => pending.set(r, Date.now()));
p.on('requestfinished', (r) => pending.delete(r));
p.on('requestfailed', (r) => pending.delete(r));
p.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 200)));
await p.goto('http://localhost:5221/?seed=3', { waitUntil: 'load' });
await p.evaluate(() => { localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'avatar', v: 2 })); });
try { await p.goto('http://localhost:5221/?campaign=ship&open=1', { waitUntil: 'load', timeout: 20000 }); console.log('loaded'); } catch (e) { console.log('timeout'); }
for (const [r] of pending) console.log('pending', r.url().slice(0, 140));
await b.close();
