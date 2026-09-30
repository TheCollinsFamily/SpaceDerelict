/**
 * THE HUD STYLE OPTIONS (Sep 30 2026): the in-run HUD drawn several ways, for Collins to pick one.
 * Each theme is a stylesheet scoped under `:root[data-hud="<id>"]` (src/hud/themes/*.css), so the
 * game's markup and code are the same in all of them. `console` is today's look (src/style.css)
 * and stays the default until one is picked.
 *
 * Chosen by `?hud=<id>` in the address (not remembered), or in the main menu's SETTINGS
 * ("HUD STYLE: …", remembered in localStorage). Notes and pictures:
 * notes/screens/2026-09-30/hud-options/README.md.
 */
import './themes/newsreel.css';
import './themes/ship.css';
import './themes/brood.css';
import './themes/hybrid.css';

export interface HudTheme { id: string; name: string }

export const HUD_THEMES: HudTheme[] = [
  { id: 'console', name: 'PROCUREMENT KHAKI (today)' },
  { id: 'newsreel', name: 'EMPIRE NEWSREEL (1950s)' },
  { id: 'ship', name: 'THE SHIP\'S BLACK GLASS' },
  { id: 'brood', name: 'THE BROOD\'S OWN VIEW' },
  { id: 'hybrid', name: 'SHIP FRAME + EMPIRE BROADCASTS' },
];
const KEY = 'broodfall-hud';
const known = (id: string | null | undefined): id is string => !!id && HUD_THEMES.some((t) => t.id === id);

function saved(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

/** The theme in force: the address, then the one picked in the menu, then today's look. */
export function currentHud(): string {
  const q = new URLSearchParams(location.search).get('hud');
  if (known(q)) return q;
  const s = saved();
  return known(s) ? s : 'console';
}

export function applyHud(id: string, remember = false): void {
  if (!known(id)) id = 'console';
  document.documentElement.dataset.hud = id;
  if (remember) { try { localStorage.setItem(KEY, id); } catch { /* ok */ } }
  const btn = document.getElementById('menu-hud');
  if (btn) btn.textContent = `HUD STYLE: ${HUD_THEMES.find((t) => t.id === id)!.name}`;
}

/** The menu's SETTINGS gets one more line: it steps through the styles. */
function addMenuEntry(): void {
  const box = document.querySelector('#menu .menu-settings');
  if (!box || document.getElementById('menu-hud')) return;
  const b = document.createElement('button');
  b.id = 'menu-hud';
  b.className = 'menu-item small';
  b.title = 'How the in-run screen is drawn';
  b.addEventListener('click', () => {
    const cur = document.documentElement.dataset.hud ?? 'console';
    const i = HUD_THEMES.findIndex((t) => t.id === cur);
    applyHud(HUD_THEMES[(i + 1) % HUD_THEMES.length].id, true);
  });
  box.insertBefore(b, box.querySelector('#menu-reset'));
}

addMenuEntry();
applyHud(currentHud());
