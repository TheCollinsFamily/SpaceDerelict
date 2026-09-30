/**
 * The REACH READOUT by the cursor while a limb is being placed (Collins, Sep 30 2026: "elevation
 * increasing range by unit, and it shows in the range indication hover-over before placing the
 * building"). It says the reach the limb WILL have on that ground (Sim.previewStats: the sim's own
 * numbers) and what the height adds, so a roof three levels up reads "+20% height" before the click.
 */
import { BALANCE as B } from '../../content/data';

/** What the readout says, or '' for a limb that reaches nothing (a producer, a wall). */
export function reachText(st: { range: number; groundRange: number; height: number }): string {
  if (!(st.range > 0) || st.range >= 1000) return '';
  const pct = Math.round(B.heightRangeBonus * (st.height - 1) * 100);
  const lift = st.height > 1 ? ` (+${pct}% height, level ${st.height})` : ` (level 1: no height bonus, +${Math.round(B.heightRangeBonus * 100)}% a level higher)`;
  return `reach ${Math.round(st.range)}${lift}`;
}

let el: HTMLDivElement | null = null;

function tip(): HTMLDivElement {
  if (el) return el;
  el = document.createElement('div');
  el.id = 'reach-tip';
  Object.assign(el.style, {
    position: 'fixed', zIndex: '40', pointerEvents: 'none', padding: '3px 8px', borderRadius: '4px',
    font: '600 12px/1.3 system-ui, sans-serif', color: '#f3e3b0', background: 'rgba(12, 9, 6, 0.82)',
    border: '1px solid rgba(255, 224, 138, 0.45)', whiteSpace: 'nowrap', display: 'none',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  return el;
}

/** Show the readout just below and right of the pointer (hidden when the text is empty). */
export function showReachTip(clientX: number, clientY: number, text: string): void {
  const t = tip();
  if (!text) { t.style.display = 'none'; return; }
  t.textContent = text;
  t.style.left = `${clientX + 18}px`;
  t.style.top = `${clientY + 20}px`;
  t.style.display = 'block';
}

export function hideReachTip(): void {
  if (el) el.style.display = 'none';
}
