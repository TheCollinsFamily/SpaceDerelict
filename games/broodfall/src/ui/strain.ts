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
