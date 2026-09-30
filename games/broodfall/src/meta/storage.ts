/** The campaign save and the pending deployment, in localStorage (never trusted to exist). */
import type { EnemyKind } from '../sim/types';
import type { CampaignState } from './campaign';
import { YOKE_AVATAR, type YokeMode } from './yokeAvatar';
import { gainOf, settingsFrom, type Channel, type Settings } from './settings';

const KEY = 'broodfall-campaign';
const PENDING = 'broodfall-campaign-pending';

export interface PendingDeployment {
  territory: string;
  dares: string[];
  experiment?: string;
  objectors: EnemyKind[];
}

export function loadCampaign(): CampaignState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as CampaignState;
    return s && s.version === 1 ? s : null;
  } catch { return null; }
}

export function saveCampaign(s: CampaignState): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

export function clearCampaign(): void {
  try { localStorage.removeItem(KEY); localStorage.removeItem(PENDING); } catch { /* ok */ }
}

export function savePending(p: PendingDeployment): void {
  try { localStorage.setItem(PENDING, JSON.stringify(p)); } catch { /* ok */ }
}

export function loadPending(): PendingDeployment | null {
  try {
    const raw = localStorage.getItem(PENDING);
    return raw ? JSON.parse(raw) as PendingDeployment : null;
  } catch { return null; }
}

export function clearPending(): void {
  try { localStorage.removeItem(PENDING); } catch { /* ok */ }
}

/**
 * YOKE's link to rfab.ai: who answers, the player's own API key, the API root, and
 * whether her voice is off.
 *   avatar    her Living Avatar on rfab.ai: a body, a voice, a mind that remembers him
 *   kimi      text from Kimi K2.6 (POST /api/broodfall/ship-ai)
 *   scripted  the lore book's own lines; spends nothing, needs no network
 */
export interface YokeSettings { mode: YokeMode; key: string; base: string; muted: boolean }
const YOKE = 'broodfall-yoke';
/** Settings saved since the avatar exists carry this mark; older ones never chose between her and Kimi. */
const YOKE_SAVED = 2;
/**
 * Where rfab.ai is. Served from this PC (`npm start`, `vite preview`, the beats) the page has
 * the /rfab-api proxy; anywhere else — a web host, a desktop wrap's file:// page, what a player
 * runs — there is no proxy and no key, and the game talks to https://api.rfab.ai itself with
 * its own player token (src/meta/yokePlayer.ts). VITE_RFAB_API_BASE overrides both at build time.
 */
function rfabApiBase(): string {
  const forced = import.meta.env?.VITE_RFAB_API_BASE as string | undefined;
  if (forced) return forced;
  let host = '';
  try { host = location.hostname; } catch { /* no page (tests): the proxy */ return '/rfab-api'; }
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]' ? '/rfab-api' : 'https://api.rfab.ai';
}
export const RFAB_API_BASE: string = rfabApiBase();
/** The avatar is who answers by default, when content/lore/yoke-avatar.json names one. */
export const DEFAULT_YOKE: YokeSettings = { mode: YOKE_AVATAR ? 'avatar' : 'kimi', key: '', base: RFAB_API_BASE, muted: false };

/** Settings as they were saved, made whole. `hasAvatar`: an avatar is named (a mode that needs one falls to Kimi without). */
export function yokeFrom(raw: unknown, hasAvatar: boolean = !!YOKE_AVATAR): YokeSettings {
  const best: YokeMode = hasAvatar ? 'avatar' : 'kimi';
  const base = { ...DEFAULT_YOKE, mode: best };
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  // "scripted" was always a choice (it spends nothing) and is kept. "kimi" was the only live
  // YOKE before she had a body: only one saved since then is a choice against the avatar.
  const mode: YokeMode = r.mode === 'scripted' ? 'scripted' : r.mode === 'kimi' && r.v === YOKE_SAVED ? 'kimi' : best;
  return {
    mode,
    key: typeof r.key === 'string' ? r.key : '',
    // A saved '/rfab-api' is the dev server's proxy: a built game has none, and goes to rfab.ai itself.
    base: typeof r.base === 'string' && r.base && !(r.base === '/rfab-api' && DEFAULT_YOKE.base !== '/rfab-api') ? r.base : DEFAULT_YOKE.base,
    muted: r.muted === true,
  };
}

export function loadYoke(): YokeSettings {
  try { return yokeFrom(JSON.parse(localStorage.getItem(YOKE) ?? 'null')); } catch { return { ...DEFAULT_YOKE }; }
}

export function saveYoke(y: YokeSettings): void {
  try { localStorage.setItem(YOKE, JSON.stringify({ ...y, v: YOKE_SAVED })); } catch { /* private mode */ }
}

/**
 * The player's token for YOKE on rfab.ai (src/meta/yokePlayer.ts): a guest token until he links
 * an RFab account, then one bound to it. Kept apart from the settings; the menu's RESET forgets
 * it with everything else (his free talk is counted on rfab.ai, not here).
 */
const YOKE_PLAYER = 'broodfall-yoke-player';
export const playerTokenStore = {
  load(): string | null {
    try { const t = localStorage.getItem(YOKE_PLAYER); return t && /^bf[gc]_[A-Za-z0-9_-]{40,64}$/.test(t) ? t : null; } catch { return null; }
  },
  save(token: string): void { try { localStorage.setItem(YOKE_PLAYER, token); } catch { /* private mode: a new player next time */ } },
  clear(): void { try { localStorage.removeItem(YOKE_PLAYER); } catch { /* ok */ } },
};

// ------------------------------------------------------------------ the first launch (src/meta/onboarding.ts)

const INTRO = 'broodfall-intro-seen';

/** The opening cinematic has played once (to its end, or skipped). */
export function introSeen(): boolean {
  try { return localStorage.getItem(INTRO) === '1'; } catch { return true; }
}

export function markIntroSeen(): void {
  try { localStorage.setItem(INTRO, '1'); } catch { /* private mode: it plays again next time */ }
}

/** This browser played before the campaign existed (skirmish records): it is not a first launch. */
export function veteran(): boolean {
  try { return !!localStorage.getItem('broodfall-meta'); } catch { return false; }
}

/** Everything the game keeps, gone: the next start is a first launch again (the menu's RESET). */
export function forgetEverything(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('broodfall-')) localStorage.removeItem(k);
  } catch { /* ok */ }
}

// ------------------------------------------------------------------ the player's settings (src/meta/settings.ts)

const SETTINGS = 'broodfall-settings';
let cachedSettings: Settings | null = null;

/** The settings in force (read once, then kept; the settings screen writes through saveSettings). */
export function loadSettings(): Settings {
  if (cachedSettings) return cachedSettings;
  try { cachedSettings = settingsFrom(JSON.parse(localStorage.getItem(SETTINGS) ?? 'null')); } catch { cachedSettings = settingsFrom(null); }
  return cachedSettings;
}

export function saveSettings(s: Settings): void {
  cachedSettings = settingsFrom(s);
  try { localStorage.setItem(SETTINGS, JSON.stringify(cachedSettings)); } catch { /* private mode: kept for this page */ }
}

/** What a sound on this channel plays at now (YOKE's voice, the boss's message; music and effects when there are any). */
export const gain = (ch: Exclude<Channel, 'master'>): number => gainOf(loadSettings(), ch);
