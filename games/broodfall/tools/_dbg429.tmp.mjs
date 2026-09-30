import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
const child = spawn('npx.cmd', ['vite', 'preview'], { cwd: process.cwd(), shell: true, env: { ...process.env, BROODFALL_PORT: '5313', BROODFALL_DIST: 'dist-shipgap' } });
await new Promise((r) => child.stdout.on('data', (d) => { if (String(d).includes('localhost')) r(); }));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('response', (r) => { if (r.status() >= 400) console.log(r.status(), r.url().slice(0, 150)); });
await page.addInitScript(() => { localStorage.setItem('broodfall-intro-seen', '1'); localStorage.setItem('broodfall-yoke', JSON.stringify({ mode: 'scripted' })); });
await page.goto('http://localhost:5313/?campaign=ship&open=1');
await page.waitForTimeout(8000);
for (const r of ['desk','genes','ai','comms']) { await page.locator(`[data-room="${r}"]`).click({ force: true }).catch(()=>{}); await page.waitForTimeout(1500); }
await browser.close();
spawn('taskkill', ['/PID', String(child.pid), '/T', '/F']);
