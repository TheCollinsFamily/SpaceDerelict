/**
 * The ROYAL DECREES box (content/royal.ts): what royal points buy. Opened by the bar's royal
 * button; each decree is bought by clicking its own card (the action lives on the object). The
 * crown is bought on the limb itself (its panel), so here it is only explained. A Royal
 * Commission opens the list of limbs your organs unlock: click one to have its card.
 */
import './decrees.css';
import { DECREES, type DecreeDef, type DecreeId } from '../../content/royal';
import { TOWERS } from '../../content/data';
import type { Sim } from '../sim/sim';
import type { Command, TowerFamily } from '../sim/types';

export class DecreeBox {
  readonly el: HTMLElement;
  private isOpen = false;
  private picking = false;
  private key = '';

  constructor(private sim: () => Sim, private issue: (cmd: Command) => { ok: boolean; err?: string }, private say: (text: string) => void) {
    this.el = document.createElement('div');
    this.el.id = 'decrees';
    this.el.className = 'hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement;
      if (target.closest('[data-close]')) { this.close(); return; }
      const fam = target.closest<HTMLElement>('[data-family]');
      if (fam) {
        const r = this.issue({ kind: 'decree', decree: 'commission', family: fam.dataset.family as TowerFamily });
        this.picking = false;
        this.say(r.ok ? `ROYAL COMMISSION: a free ${fam.dataset.name} card is in your hand` : String(r.err).toUpperCase());
        this.key = '';
        return;
      }
      const card = target.closest<HTMLElement>('[data-decree]');
      if (!card || card.classList.contains('off')) return;
      const id = card.dataset.decree as DecreeId;
      if (id === 'commission') { this.picking = !this.picking; this.key = ''; return; }
      const r = this.issue({ kind: 'decree', decree: id });
      if (!r.ok) this.say(String(r.err).toUpperCase());
      this.key = '';
    });
  }

  get open(): boolean {
    return this.isOpen;
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else { this.isOpen = true; this.picking = false; this.key = ''; this.el.classList.remove('hidden'); this.update(); }
  }

  close(): void {
    this.isOpen = false;
    this.picking = false;
    this.el.classList.add('hidden');
  }

  /** Redraw when what it shows has changed (points, purchases, what the organs unlock). */
  update(): void {
    if (!this.isOpen) return;
    const sim = this.sim();
    const unlocked = TOWERS.filter((t) => sim.commissionable(t.family)).map((t) => t.family);
    const key = `${sim.meat.royal}|${JSON.stringify(sim.decrees)}|${this.picking}|${unlocked.join()}`;
    if (key === this.key) return;
    this.key = key;
    const pts = sim.meat.royal;
    const card = (d: DecreeDef): string => {
      const owned = sim.decrees[d.id] ?? 0;
      const price = sim.decreeCost(d.id);
      const off = d.onLimb || pts < price;
      const own = owned > 0 ? `<em>owned ×${owned} · again: ${d.again}</em>` : '';
      const how = d.onLimb ? '<em>click one of your limbs: CROWN is in its panel</em>' : '';
      return `<div class="decree${off ? ' off' : ''}${d.onLimb ? ' on-limb' : ''}" data-decree="${d.id}">
        <b>${d.name}<i>${price}R</i></b><span>${d.text}</span>${own}${how}</div>`;
    };
    const pick = this.picking
      ? `<div class="decree-pick"><b>COMMISSION WHICH LIMB? (a free card)</b>${unlocked.map((f) => {
        const name = TOWERS.find((t) => t.family === f)!.name;
        return `<button data-family="${f}" data-name="${name}">${name}</button>`;
      }).join('')}</div>`
      : '';
    this.el.innerHTML = `<div class="decree-head"><b>ROYAL DECREES</b><span>${pts} royal point${pts === 1 ? '' : 's'}</span><button data-close>✕</button></div>
      <div class="decree-note">Special upgrades that bend a rule of the run. Royal points come from the court (a consort or matron 1, the royal 3) and the dig's royal tombs.</div>
      <div class="decree-list">${DECREES.map(card).join('')}</div>${pick}`;
  }
}
