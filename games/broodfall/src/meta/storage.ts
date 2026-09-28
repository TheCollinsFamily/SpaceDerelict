/** The campaign save and the pending deployment, in localStorage (never trusted to exist). */
import type { EnemyKind } from '../sim/types';
import type { CampaignState } from './campaign';

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

/** YOKE's link to rfab.ai: which provider, the player's own API key, and the API root. */
export interface YokeSettings { mode: 'kimi' | 'scripted'; key: string; base: string }
const YOKE = 'broodfall-yoke';
export const DEFAULT_YOKE: YokeSettings = { mode: 'kimi', key: '', base: '/rfab-api' };

export function loadYoke(): YokeSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(YOKE) ?? 'null');
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_YOKE };
    return {
      mode: raw.mode === 'scripted' ? 'scripted' : 'kimi',
      key: typeof raw.key === 'string' ? raw.key : '',
      base: typeof raw.base === 'string' && raw.base ? raw.base : DEFAULT_YOKE.base,
    };
  } catch { return { ...DEFAULT_YOKE }; }
}

export function saveYoke(y: YokeSettings): void {
  try { localStorage.setItem(YOKE, JSON.stringify(y)); } catch { /* private mode */ }
}
