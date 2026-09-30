/**
 * THE SETTINGS SCREEN — reachable from the main menu (SETTINGS), the ship (⚙ Settings in the room
 * bar) and a deployment (Esc with nothing in hand, or the ⚙ button by the view controls; the run
 * is paused while it is open). The model is src/meta/settings.ts; it is kept by src/meta/storage.ts.
 *
 *   SOUND          master / music / effects / voice; YOKE's voice on/off (voice is wired to her
 *                  lines and the boss's message; music and effects are ready for when there are any)
 *   THE SCREEN     HUD style (src/hud/themes.ts), text size, reduce motion, reduce flashes,
 *                  caste colours (the colour-blind-safe set)
 *   THE BOARD      turn keys, edge scroll, zoom speed, the speed a deployment starts at
 *   YOKE           her account and model: a SLOT, filled by the YOKE connect session
 *                  (`registerSettingsSection('yoke-account', …)`), not built here
 *   THE GAME       replay the opening film, forget everything (twice, to be sure)
 */
import './settings.css';
import { CASTE_TINTS, RESERVED_KEYS, type Channel, type Settings } from '../meta/settings';
import { forgetEverything, loadSettings, loadYoke, saveSettings, saveYoke } from '../meta/storage';
import { CASTE_COLORS } from '../render/render';
import { HUD_THEMES, applyHud, currentHud } from '../hud/themes';
import { loadIntroArt, playIntro, type IntroHandle } from './intro';

export type SettingsPlace = 'menu' | 'ship' | 'run';

export interface SettingsOpen {
  where: SettingsPlace;
  /** Called when the screen closes (the caller re-reads what it shows: her voice, the speed). */
  onClose?: () => void;
  /** The opening film started from here (a deployment waits for it before it goes on). */
  onIntro?: (h: IntroHandle) => void;
}

/** Sections other sessions fill (YOKE's account and model): id → a function that draws into its box. */
const sections = new Map<string, (box: HTMLElement) => void>();
/** The YOKE connect session registers its section here; until it does, the slot says what will be there. */
export function registerSettingsSection(id: 'yoke-account' | string, draw: (box: HTMLElement) => void): void {
  sections.set(id, draw);
}

let root: HTMLElement | null = null;
let current: SettingsOpen | null = null;
let confirmReset = false;
let listening: 'turnLeft' | 'turnRight' | null = null;

export const settingsOpen = (): boolean => !!current;

/** Put the saved settings into force: text size, motion, flashes, caste colours. Run at start and on every change. */
export function applySettings(s: Settings = loadSettings()): void {
  const html = document.documentElement;
  html.style.setProperty('--ui-scale', String(s.textScale));
  html.classList.toggle('reduce-motion', s.reduceMotion);
  html.classList.toggle('reduce-flashes', s.reduceFlashes);
  const t = CASTE_TINTS[s.casteTints];
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  html.style.setProperty('--war', hex(t.war));
  html.style.setProperty('--science', hex(t.science));
  html.style.setProperty('--royal', hex(t.royal));
  html.dataset.casteTints = s.casteTints;
  // The board reads its caste colours from this object every frame.
  Object.assign(CASTE_COLORS as unknown as Record<string, number>, t);
}

export function openSettings(o: SettingsOpen): void {
  current = o;
  confirmReset = false;
  listening = null;
  if (!root) {
    root = document.createElement('div');
    root.id = 'settings';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Settings');
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    window.addEventListener('keydown', onKey, true);
  }
  root.classList.remove('hidden');
  render();
}

export function closeSettings(): void {
  if (!root || !current) return;
  const o = current;
  current = null;
  root.classList.add('hidden');
  o.onClose?.();
}

const PLACE: Record<SettingsPlace, string> = { menu: 'MAIN CONSOLE', ship: 'SHIPBOARD', run: 'DEPLOYMENT PAUSED' };
const pct = (v: number) => `${Math.round(v * 100)}%`;
const keyName = (k: string) => (k === ' ' ? 'SPACE' : k.toUpperCase());

function render(): void {
  if (!root || !current) return;
  const s = loadSettings();
  const y = loadYoke();
  const hud = document.documentElement.dataset.hud ?? currentHud();
  const slider = (ch: Channel, label: string, note: string) => `<label class="st-row"><span>${label}<small>${note}</small></span>
    <input type="range" min="0" max="100" step="5" value="${Math.round(s.volume[ch] * 100)}" data-vol="${ch}" aria-label="${label}"><b>${pct(s.volume[ch])}</b></label>`;
  const toggle = (id: string, on: boolean, label: string, note = '') => `<div class="st-row"><span>${label}${note ? `<small>${note}</small>` : ''}</span>
    <button class="st-toggle${on ? ' on' : ''}" data-toggle="${id}" aria-pressed="${on}">${on ? 'ON' : 'OFF'}</button></div>`;
  const choice = (id: string, opts: Array<[string, string]>, cur: string) =>
    `<div class="st-choice">${opts.map(([v, l]) => `<button class="${v === cur ? 'on' : ''}" data-choice="${id}" data-value="${v}">${l}</button>`).join('')}</div>`;
  const tint = CASTE_TINTS[s.casteTints];
  const sw = (n: number, l: string) => `<span class="st-swatch" style="background:#${n.toString(16).padStart(6, '0')}">${l}</span>`;
  const yokeSlot = sections.has('yoke-account') ? '<div class="st-slot" data-slot="yoke-account"></div>'
    : '<div class="st-slot empty" data-slot="yoke-account">Her rfab.ai account and which mind answers as her are set here once the YOKE connect screen is in. Until then: the AI Core room on the ship.</div>';
  root.innerHTML = `<div class="st-card">
    <div class="st-head"><div><div class="st-kicker">ORBITAL TENDER "MERCIFUL YOKE" — ${PLACE[current.where]}</div><div class="st-title">SETTINGS</div></div>
      <button class="st-close" data-act="close" title="Close (Esc)">✕</button></div>
    <div class="st-cols">
      <section><h3>SOUND</h3>
        ${slider('master', 'Master', 'everything')}
        ${slider('voice', 'Voices', 'YOKE, the boss\'s message')}
        ${slider('music', 'Music', 'none aboard yet; kept for it')}
        ${slider('sfx', 'Effects', 'none aboard yet; kept for them')}
        ${toggle('yoke-voice', !y.muted, 'YOKE\'s voice', 'off: her words are read, not heard')}
      </section>
      <section><h3>THE SCREEN</h3>
        <div class="st-row col"><span>HUD style<small>how a deployment's screen is drawn</small></span>
          ${choice('hud', HUD_THEMES.map((t) => [t.id, t.name] as [string, string]), hud)}</div>
        <div class="st-row col"><span>Text size</span>${choice('text', [['0.9', 'SMALL'], ['1', 'NORMAL'], ['1.15', 'LARGE'], ['1.3', 'LARGER']], String(s.textScale))}</div>
        ${toggle('motion', s.reduceMotion, 'Reduce motion', 'panels and banners do not slide or pulse')}
        ${toggle('flashes', s.reduceFlashes, 'Reduce flashes', 'no bright flash when something is hit')}
        <div class="st-row col"><span>Caste colours<small>war · science · royal</small></span>
          ${choice('tints', [['standard', 'THE GAME\'S'], ['safe', 'COLOUR-BLIND SAFE']], s.casteTints)}
          <div class="st-swatches">${sw(tint.war, 'WAR')}${sw(tint.science, 'SCIENCE')}${sw(tint.royal, 'ROYAL')}</div></div>
      </section>
      <section><h3>THE BOARD</h3>
        <div class="st-row"><span>Turn the view<small>click a key, then press the new one</small></span>
          <span class="st-keys"><button class="st-key${listening === 'turnLeft' ? ' listen' : ''}" data-key="turnLeft">${listening === 'turnLeft' ? 'PRESS…' : keyName(s.keys.turnLeft)}</button>
          <button class="st-key${listening === 'turnRight' ? ' listen' : ''}" data-key="turnRight">${listening === 'turnRight' ? 'PRESS…' : keyName(s.keys.turnRight)}</button></span></div>
        ${toggle('edge', s.edgeScroll, 'Edge scroll', 'the pointer at the window\'s edge slides the board')}
        <label class="st-row"><span>Zoom speed<small>the wheel, per notch</small></span>
          <input type="range" min="105" max="135" step="5" value="${Math.round(s.zoomStep * 100)}" data-range="zoom" aria-label="Zoom speed"><b>${Math.round((s.zoomStep - 1) * 100)}%</b></label>
        <div class="st-row col"><span>A deployment starts at<small>the ❚❚ 1× 3× 8× buttons still change it in play</small></span>
          ${choice('speed', [['1', '1×'], ['3', '3×'], ['8', '8×']], String(s.speed))}</div>
      </section>
      <section><h3>YOKE — ACCOUNT &amp; MIND</h3>${yokeSlot}
        <h3>THE GAME</h3>
        <div class="st-row"><span>The opening film</span><button class="st-btn" data-act="intro">REPLAY THE OPENING</button></div>
        <div class="st-row"><span>Reset progress<small>the campaign, the skirmish genes, every setting: the next start is a first launch</small></span>
          <button class="st-btn danger" data-act="reset">${confirmReset ? 'AGAIN TO CONFIRM — EVERYTHING IS LOST' : 'FORGET EVERYTHING'}</button></div>
      </section>
    </div>
    <div class="st-foot">Esc closes${current.where === 'run' ? ' and the deployment goes on' : ''}.</div></div>`;
  const slot = root.querySelector<HTMLElement>('.st-slot[data-slot="yoke-account"]:not(.empty)');
  if (slot) sections.get('yoke-account')!(slot);
}

function change(next: Settings): void {
  saveSettings(next);
  applySettings(loadSettings());
  render();
}

function onInput(ev: Event): void {
  const t = ev.target as HTMLInputElement;
  const s = structuredClone(loadSettings());
  if (t.dataset.vol) {
    s.volume[t.dataset.vol as Channel] = Number(t.value) / 100;
    saveSettings(s);
    const b = t.parentElement?.querySelector('b');
    if (b) b.textContent = pct(s.volume[t.dataset.vol as Channel]);
    return;
  }
  if (t.dataset.range === 'zoom') {
    s.zoomStep = Number(t.value) / 100;
    saveSettings(s);
    const b = t.parentElement?.querySelector('b');
    if (b) b.textContent = `${Math.round((s.zoomStep - 1) * 100)}%`;
  }
}

function onClick(ev: MouseEvent): void {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('button');
  if (!el || !root) { if (ev.target === root) closeSettings(); return; }
  const d = el.dataset;
  const s = structuredClone(loadSettings());
  if (d.act !== 'reset') confirmReset = false;
  if (d.act === 'close') { closeSettings(); return; }
  if (d.act === 'intro') {
    const o = current;
    closeSettings();
    void loadIntroArt().then((art) => { const h = playIntro(art); o?.onIntro?.(h); });
    return;
  }
  if (d.act === 'reset') {
    if (!confirmReset) { confirmReset = true; render(); return; }
    forgetEverything();
    location.href = location.pathname;
    return;
  }
  if (d.key) { listening = d.key as 'turnLeft' | 'turnRight'; render(); return; }
  if (d.toggle) {
    if (d.toggle === 'yoke-voice') { const y = loadYoke(); saveYoke({ ...y, muted: !y.muted }); render(); return; }
    if (d.toggle === 'motion') s.reduceMotion = !s.reduceMotion;
    if (d.toggle === 'flashes') s.reduceFlashes = !s.reduceFlashes;
    if (d.toggle === 'edge') s.edgeScroll = !s.edgeScroll;
    change(s);
    return;
  }
  if (d.choice) {
    const v = d.value ?? '';
    if (d.choice === 'hud') { applyHud(v, true); render(); return; }
    if (d.choice === 'text') s.textScale = Number(v);
    if (d.choice === 'tints') s.casteTints = v === 'safe' ? 'safe' : 'standard';
    if (d.choice === 'speed') s.speed = (Number(v) === 3 ? 3 : Number(v) === 8 ? 8 : 1);
    change(s);
  }
}

function onKey(ev: KeyboardEvent): void {
  if (!current) return;
  if (listening) {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const k = ev.key.toLowerCase();
    if (k === 'escape') { listening = null; render(); return; }
    const s = structuredClone(loadSettings());
    const other = listening === 'turnLeft' ? s.keys.turnRight : s.keys.turnLeft;
    if (ev.key.length === 1 && !RESERVED_KEYS.includes(k) && k !== other) s.keys[listening] = k;
    listening = null;
    change(s);
    return;
  }
  if (ev.key === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); closeSettings(); return; }
  // Nothing typed here reaches the board behind it.
  if (!(ev.target as HTMLElement).closest?.('#settings input')) ev.stopImmediatePropagation();
}

/** The ⚙ by the board's view buttons (a deployment). */
export function addRunButton(open: () => void): void {
  const box = document.getElementById('view-controls');
  if (!box || document.getElementById('view-settings')) return;
  const b = document.createElement('button');
  b.id = 'view-settings';
  b.title = 'Settings (Esc) — pauses the deployment';
  b.textContent = '⚙';
  b.addEventListener('click', open);
  box.appendChild(b);
}

/**
 * Edge scroll: the pointer within a few pixels of the window's edge slides the board, while
 * `active()` says the board is what is being looked at.
 */
export function installEdgeScroll(pan: (dx: number, dy: number) => void, active: () => boolean): void {
  let x = -1;
  let y = -1;
  window.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; });
  document.addEventListener('pointerleave', () => { x = -1; y = -1; });
  let last = performance.now();
  const EDGE = 14;
  const SPEED = 900; // px a second
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (loadSettings().edgeScroll && !current && x >= 0 && active()) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dx = x < EDGE ? 1 : x > w - EDGE ? -1 : 0;
      const dy = y < EDGE ? 1 : y > h - EDGE ? -1 : 0;
      if (dx || dy) pan(dx * SPEED * dt, dy * SPEED * dt);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** The speed button that is in force, lit (the HUD lights 1× by default). */
export function markSpeed(speed: number): void {
  for (const b of document.querySelectorAll<HTMLElement>('#speed-box button')) b.classList.toggle('on', Number(b.dataset.speed) === speed);
}

applySettings();
