/** Short, readable labels for creep-node strains (tray chips, hints, the organ summary). */
import type { NodeStrain } from '../sim/types';
import { NODE_RADIUS, NODE_REACH } from '../../content/underground';

export function strainKey(s: NodeStrain): string {
  return `${s.radius}|${s.reach}|${s.slow.toFixed(3)}|${s.dps}`;
}

export function strainLabel(s: NodeStrain): string {
  const parts = [`${s.radius}-cell`];
  if (s.reach > NODE_REACH) parts.push(`thrown ${s.reach}`);
  if (s.slow < 1) parts.push(`mire −${Math.round((1 - s.slow) * 100)}%`);
  if (s.dps > 0) parts.push(`burn ${s.dps}/s`);
  if (parts.length === 1 && s.radius === NODE_RADIUS) return 'plain';
  return parts.join(' · ');
}

/** The icon string for a strain — the same marks on the bladder badge, the tray chip and the map pod. */
export function strainIcons(s: NodeStrain): string {
  const out = [`◍${s.radius}`];
  if (s.reach > NODE_REACH) out.push(`➶${s.reach}`);
  if (s.slow < 1) out.push('≋');
  if (s.dps > 0) out.push('☠');
  return out.join(' ');
}
