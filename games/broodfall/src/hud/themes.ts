/**
 * THE HUD STYLE (Sep 30 2026). Collins picked the look of the ship's own consoles for the in-run
 * HUD ("would go with a style that looks like one of the consoles on the ship"): it is the
 * default, drawn by src/hud/themes/ship.css under `:root[data-hud="ship"]`, the same family as
 * the ship's main menu (src/onboard.css) and rooms (src/ship.css). The game's markup and code
 * are the same in every style.
 *
 * `?hud=classic` (or the menu's SETTINGS, remembered in localStorage) keeps the old khaki
 * console (src/style.css alone) as a fallback. src/hud/themes/newsreel.css is the 1950s
 * empire-newsreel option drafted before the pick; it is kept but not loaded.
 * Pictures: notes/screens/2026-09-30/hud-options/.
 */
import './themes/ship.css';

export interface HudTheme { id: string; name: string }

export const HUD_THEMES: HudTheme[] = [
  { id: 'ship', name: 'SHIP CONSOLE' },
  { id: 'classic', name: 'CLASSIC KHAKI' },
];
const KEY = 'broodfall-hud';
const known = (id: string | null | undefined): id is string => !!id && HUD_THEMES.some((t) => t.id === id);

function saved(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

/** The theme in force: the address, then the one picked in the menu, then the ship console. */
export function currentHud(): string {
  const q = new URLSearchParams(location.search).get('hud');
  if (known(q)) return q;
  const s = saved();
  return known(s) ? s : 'ship';
}

export function applyHud(id: string, remember = false): void {
  if (!known(id)) id = 'ship';
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
    const cur = document.documentElement.dataset.hud ?? 'ship';
    const i = HUD_THEMES.findIndex((t) => t.id === cur);
    applyHud(HUD_THEMES[(i + 1) % HUD_THEMES.length].id, true);
  });
  box.insertBefore(b, box.querySelector('#menu-reset'));
}

addMenuEntry();
applyHud(currentHud());
