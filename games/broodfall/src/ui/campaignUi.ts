/**
 * THE SHIP — the campaign's screens (Collins, Sep 28 2026; DESIGN.md "THE CAMPAIGN").
 * Rooms: the Directive Desk (the globe + the briefing), the Gene Bay (lineages and
 * starting profiles), the Specimen Locker (experiments, dares), the Procreation
 * Board (standing, letters, logs), Comms (the factions), and the AI Core (YOKE's
 * discussions). Faction scenes play as modals when you come back to the ship.
 */
import {
  ally, buyLineage, choose, dismissScene, evolutionCaps, experimentsAvailable, faction, perksOf, plan,
  selectProfile, summaryFor, targets, territory, type CampaignState, type Debrief,
} from '../meta/campaign';
import { goalText } from '../meta/goals';
import { FallbackShipAi, RfabShipAi, campaignIdFor, type AiTrigger, type AiTurn } from '../meta/shipAi';
import { loadYoke, saveCampaign, saveYoke, type PendingDeployment, type YokeSettings } from '../meta/storage';
import {
  DARES, EXPERIMENTS, FACTIONS, LICENCE_STANDING, LINEAGES, PROFILES, TERRITORIES, type FactionId, type TerritoryDef,
} from '../../content/campaign';
import { ORGAN_BY_ID } from '../../content/underground';
import { ENEMIES } from '../../content/data';
import type { EnemyKind, OrganId } from '../sim/types';
import lore from '../../content/lore/ship-ai-lorebook.md?raw';
import { artUrl, loadManifest, type ShipArt } from '../render/art';
import { GLOBE, Globe, projectSite, type Zone } from './globe';

type Room = 'desk' | 'genes' | 'locker' | 'board' | 'comms' | 'ai';

const THEME_NAME: Record<string, string> = {
  core: 'Meteor Core', forge: 'Bone Forge', venom: 'Venom Sac', gut: 'Gut', nerve: 'Nerve Cluster',
  lattice: 'Mucus Lattice', womb: 'Brood Womb', marrow: 'Marrow Vault', resonance: 'Resonance Chamber',
  catapult: 'Spore Sling', runner: 'Creep Lance', cage: 'Trap Cage',
};
const speakLine = (l: string) => { const i = l.indexOf(':'); return i > 0 ? `<b>${esc(l.slice(0, i))}:</b>${esc(l.slice(i + 1))}` : esc(l); };
/** Which of her faces YOKE wears for each kind of talk. */
const YOKE_FACE: Record<string, string> = {
  'first-deployment': 'curious', 'faction-allied': 'amused', midpoint: 'concerned', licence: 'calm', ending: 'sad', idle: 'calm',
};
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export class CampaignUi {
  private el = document.getElementById('campaign')!;
  private room: Room = 'desk';
  private selected: string | null = null;
  private dares: string[] = [];
  private experiment: string | undefined;
  private objectors: EnemyKind[] = [];
  private spin = -10;
  private yoke: YokeSettings = loadYoke();
  /** Built in the constructor: it needs the campaign's seed, and field initialisers run before `state` is set. */
  private ai: FallbackShipAi;
  private talk: { trigger: AiTrigger; turns: AiTurn[] } | null = null;
  /** A YOKE reply is on its way (a live call takes a second or two). */
  private waiting = false;
  /** The ship's pictures, once they have loaded; null when there are none (the screens are plain then). */
  private art: ShipArt | null = null;
  private globe = new Globe();
  /** The post-deployment report is up: the rooms must not be drawn over it. */
  private debriefing = false;

  constructor(private state: CampaignState, private hooks: { deploy(p: PendingDeployment): void; newCampaign(): void; quit(): void }) {
    this.ai = this.buildAi();
    void loadManifest().then(async (m) => {
      const art = m?.ship?.ship ?? null;
      if (!art) return;
      if (art.planet) await this.globe.load(artUrl(art.planet));
      this.art = art;
      if (this.el.classList.contains('hidden')) return;
      if (this.debriefing) this.dress(); else this.render();
    });
    this.el.addEventListener('click', (ev) => this.onClick(ev));
    this.el.addEventListener('pointerdown', (ev) => {
      if (!(ev.target as HTMLElement).closest('.globe-box') || (ev.target as HTMLElement).closest('.site')) return;
      const from = ev.clientX;
      const spin0 = this.spin;
      const move = (e: PointerEvent) => {
        this.spin = spin0 - (e.clientX - from) * 0.4;
        const canvas = this.el.querySelector<HTMLCanvasElement>('canvas.globe-map');
        if (canvas) this.globe.paint(canvas, this.spin, this.zones(), this.selected);
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); this.render(); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    this.el.addEventListener('keydown', (ev) => {
      if ((ev.target as HTMLElement).id === 'ai-input' && ev.key === 'Enter') void this.aiSend();
    });
  }

  show(): void {
    this.debriefing = false;
    document.body.classList.add('in-ship');
    this.el.classList.remove('hidden');
    this.render();
  }

  hide(): void {
    document.body.classList.remove('in-ship');
    this.el.classList.add('hidden');
  }

  setState(s: CampaignState): void {
    const reseeded = s.seed !== this.state.seed;
    this.state = s;
    if (reseeded) this.ai = this.buildAi();
    saveCampaign(s);
    this.render();
  }

  // ------------------------------------------------------------ rendering

  private render(): void {
    const s = this.state;
    const rooms: Array<[Room, string]> = [
      ['desk', 'Directive Desk'], ['genes', 'Gene Bay'], ['locker', 'Specimen Locker'],
      ['board', 'Procreation Board'], ['comms', 'Comms'], ['ai', `AI Core${s.ai.queue.length ? ` (${s.ai.queue.length})` : ''}`],
    ];
    const fac = s.faction ? faction(s.faction).name : 'no allies';
    const face = this.room !== 'ai' ? '' : this.talk ? (this.waiting ? 'thinking' : YOKE_FACE[this.talk.trigger] ?? 'calm') : s.ai.queue.length ? 'curious' : 'calm';
    this.el.innerHTML = `${face ? this.yokeHtml(face) : ''}
      <div class="cp-card">
        <div class="cp-head">
          <div><div class="screen-kicker">ORBITAL TENDER "MERCIFUL YOKE" — XENOFAUNA CLEARANCE, SECTOR 9</div>
            <div class="cp-title">THE SHIP</div></div>
          <div class="cp-wallet">
            <span class="cp-cur std">STANDING <b>${s.standing}</b></span>
            <span class="cp-cur notes">FIELD NOTES <b>${s.notes}</b></span>
            <span class="cp-cur">LICENCE <b>${s.licence ? 'APPROVED' : `${Math.min(s.standing, LICENCE_STANDING)}/${LICENCE_STANDING}`}</b></span>
            <span class="cp-cur">${esc(fac.toUpperCase())}</span>
          </div>
        </div>
        <div class="cp-rooms">${rooms.map(([id, name]) => `<button class="cp-room${this.room === id ? ' on' : ''}" data-room="${id}">${name}</button>`).join('')}
          <button class="cp-room quit" data-act="quit">Main menu</button></div>
        <div class="cp-body">${this.roomHtml()}</div>
      </div>
      ${this.sceneHtml()}`;
    this.dress();
  }

  /** The room's picture behind the screen, and the globe painted into its canvas. */
  private dress(): void {
    const art = this.art;
    this.el.classList.toggle('ship-art', !!art);
    this.el.dataset.in = this.room;
    // A picture named in a style variable is looked for beside the STYLESHEET that uses it, so the whole address is given.
    const at = (file: string | undefined) => (file ? `url("${new URL(artUrl(file), document.baseURI).href}")` : 'none');
    this.el.style.setProperty('--room', at(art?.rooms[this.room]));
    this.el.style.setProperty('--sketches', at(art?.sketches?.atlas));
    this.el.style.setProperty('--yoke', at(art?.yoke?.atlas));
    const canvas = this.el.querySelector<HTMLCanvasElement>('canvas.globe-map');
    if (canvas) this.globe.paint(canvas, this.spin, this.zones(), this.selected);
  }

  /** Every landing site the player knows of, and what it is to him. */
  private zones(): Zone[] {
    const s = this.state;
    const open = new Set(targets(s).map((t) => t.id));
    return TERRITORIES.filter((t) => !t.hidden || s.revealed.includes(t.id)).map((t) => ({
      id: t.id, lat: t.lat, lon: t.lon,
      state: s.underAttack === t.id ? 'attack' : s.held.includes(t.id) ? 'held' : open.has(t.id) ? 'open' : 'locked',
    }));
  }

  /** One of the character's own sketches, by the id of the dare or experiment it is for. */
  private sketch(id: string): string {
    const sk = this.art?.sketches;
    const i = sk ? sk.ids.indexOf(id) : -1;
    if (!sk || i < 0) return '';
    const rows = Math.ceil(sk.ids.length / sk.cols);
    return `<span class="cp-sketch" style="background-position:${(i % sk.cols) * (100 / (sk.cols - 1))}% ${Math.floor(i / sk.cols) * (100 / Math.max(1, rows - 1))}%;background-size:${sk.cols * 100}% ${rows * 100}%"></span>`;
  }

  /** YOKE's projection, wearing one of her faces. */
  private yokeHtml(face: string): string {
    const y = this.art?.yoke;
    const i = y ? Math.max(0, y.faces.indexOf(face)) : -1;
    if (!y) return '';
    const rows = Math.ceil(y.faces.length / y.cols);
    return `<div class="cp-yoke" data-face="${esc(face)}" style="background-position:${(i % y.cols) * (100 / (y.cols - 1))}% ${Math.floor(i / y.cols) * (100 / Math.max(1, rows - 1))}%;background-size:${y.cols * 100}% ${rows * 100}%"></div>`;
  }

  /** A faction's leader, as a still from their world's films. */
  private leaderHtml(id: string): string {
    const file = this.art?.leaders[id];
    return file ? `<img class="cp-leader" src="${artUrl(file)}" alt="">` : '';
  }

  private roomHtml(): string {
    switch (this.room) {
      case 'desk': return this.deskHtml();
      case 'genes': return this.genesHtml();
      case 'locker': return this.lockerHtml();
      case 'board': return this.boardHtml();
      case 'comms': return this.commsHtml();
      case 'ai': return this.aiHtml();
    }
  }

  /** The globe: an orthographic planet; your territories, where you can land, what is under attack. */
  private globeSvg(): string {
    const s = this.state;
    const R = GLOBE.r;
    const cx = GLOBE.size / 2;
    const cy = GLOBE.size / 2;
    const open = new Set(targets(s).map((t) => t.id));
    if (s.underAttack) open.add(s.underAttack);
    const proj = (lat: number, lon: number) => projectSite(lat, lon, this.spin);
    const mapped = !!this.art?.planet;
    const lines: string[] = [];
    // Graticule.
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts: string[] = [];
      for (let lon = -180; lon <= 180; lon += 6) { const p = proj(lat, lon); if (p.front) pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`); else if (pts.length) { lines.push(`<polyline points="${pts.join(' ')}" class="grat"/>`); pts.length = 0; } }
      if (pts.length) lines.push(`<polyline points="${pts.join(' ')}" class="grat"/>`);
    }
    for (let lon = -180; lon < 180; lon += 30) {
      const pts: string[] = [];
      for (let lat = -90; lat <= 90; lat += 5) { const p = proj(lat, lon); if (p.front) pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`); else if (pts.length) { lines.push(`<polyline points="${pts.join(' ')}" class="grat"/>`); pts.length = 0; } }
      if (pts.length) lines.push(`<polyline points="${pts.join(' ')}" class="grat"/>`);
    }
    const visible = TERRITORIES.filter((t) => !t.hidden || s.revealed.includes(t.id));
    // Neighbour links (front side only).
    const links: string[] = [];
    for (const t of visible) {
      for (const n of t.neighbours) {
        const o = visible.find((x) => x.id === n);
        if (!o || o.id < t.id) continue;
        const a = proj(t.lat, t.lon);
        const b = proj(o.lat, o.lon);
        if (a.front && b.front) links.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="link"/>`);
      }
    }
    const marks = visible.map((t) => {
      const p = proj(t.lat, t.lon);
      if (!p.front) return '';
      const held = s.held.includes(t.id);
      const cls = [
        'site', held ? 'held' : open.has(t.id) ? 'open' : 'locked',
        s.underAttack === t.id ? 'attack' : '', t.finaleOf ? 'finale' : '', this.selected === t.id ? 'sel' : '',
      ].join(' ');
      return `<g class="${cls}" data-site="${t.id}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})">
        <circle r="${held ? 9 : 8}"/>${t.finaleOf ? '<text class="star" y="4">★</text>' : ''}
        <text class="name" y="-13">${esc(t.name)}</text></g>`;
    }).join('');
    return `<div class="globe-box">${mapped ? '<canvas class="globe-map" width="420" height="420"></canvas>' : ''}<svg class="globe" viewBox="0 0 420 420" width="420" height="420">
      <defs><radialGradient id="planet" cx="38%" cy="32%"><stop offset="0" stop-color="#6d8a58"/><stop offset="0.7" stop-color="#3b4a2f"/><stop offset="1" stop-color="#1a2016"/></radialGradient></defs>
      ${mapped ? '' : `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#planet)" class="disc"/>`}
      ${lines.join('')}${links.join('')}${marks}
    </svg></div>`;
  }

  private deskHtml(): string {
    const s = this.state;
    if (s.ended) {
      return `<div class="cp-ended"><div class="cp-sub">CAMPAIGN COMPLETE — ${esc(faction(s.ended).name.toUpperCase())}</div>
        <p>The planet is quiet. Replay the ending from Comms, or start again with a different ally.</p>
        <button class="screen-btn" data-act="new">NEW CAMPAIGN</button></div>`;
    }
    const t = this.selected ? territory(this.selected) : null;
    return `<div class="cp-desk">
      <div class="cp-globe">${this.globeSvg()}
        <div class="cp-spin"><button data-act="spin-l">◀ turn</button><button data-act="spin-r">turn ▶</button></div>
        <div class="cp-legend"><span class="lg held">yours</span><span class="lg open">can land</span><span class="lg attack">under attack</span><span class="lg locked">not yet</span></div>
      </div>
      <div class="cp-brief">${t ? this.briefHtml(t) : `<div class="cp-sub">PICK A LANDING SITE</div><p>Land next to ground you hold. Each territory you take unlocks evolution stages for some of your limbs${s.underAttack ? `. <b>${esc(territory(s.underAttack).name)} is under attack</b> — defend it next, or lose it.` : '.'}</p>`}</div>
    </div>`;
  }

  private briefHtml(t: TerritoryDef): string {
    const s = this.state;
    const open = targets(s).some((x) => x.id === t.id) || s.underAttack === t.id;
    const held = s.held.includes(t.id);
    const p = plan(s, t.id, { dares: this.dares, experiment: this.experiment, objectors: this.objectors });
    const dir = p.config.directive;
    const dirText = !dir ? 'hold' : dir.kind === 'hold' ? `Hold for ${dir.waves} waves` : dir.kind === 'royal' ? 'Destroy the royal' : `Bank ${dir.science} science`;
    const unlocks = t.unlocks.map((u) => `${THEME_NAME[u.theme] ?? u.theme} evolution stage ${u.stage}`).join(', ');
    const perks = perksOf(s);
    const objAllowed = perks.includes('objectors2') ? 2 : perks.includes('objectors1') ? 1 : 0;
    const warKinds = ENEMIES.filter((e) => e.caste === 'war').map((e) => e.kind);
    const exps = experimentsAvailable(s);
    return `<div class="cp-sub">${esc(t.name.toUpperCase())}${held ? ' · YOURS' : ''}</div>
      <p class="cp-story">${esc(t.story)}</p>
      <div class="cp-facts">Threat tier ${t.tier} · ${t.entrances} entrance${t.entrances > 1 ? 's' : ''} · ${p.defence ? '<b>DEFENCE</b> — hold 5 waves' : dirText}</div>
      ${unlocks ? `<div class="cp-facts">Holding it unlocks: <b>${esc(unlocks)}</b></div>` : ''}
      <div class="cp-label">REQUISITION BOARD — pays standing</div>
      ${p.board.map((g) => `<div class="cp-goal std"><b>${esc(g.def.title)}</b> ${esc(goalText(g))} <i>+${g.def.pays}</i></div>`).join('')}
      <div class="cp-notebook"><div class="cp-label">DARES — pick up to 2, pay field notes</div>
      <div class="cp-picks">${DARES.map((d) => `<button class="cp-pick${this.dares.includes(d.id) ? ' on' : ''}${s.daresDone.includes(d.id) ? ' done' : ''}" data-dare="${d.id}" title="${esc(d.text.replace('{n}', String(d.target)))}">${this.sketch(d.id)}${esc(d.title)} <i>+${d.pays}</i></button>`).join('')}</div>
      ${exps.length ? `<div class="cp-label">EXPERIMENT — optional, changes the run</div>
      <div class="cp-picks">${exps.map((e) => `<button class="cp-pick exp${this.experiment === e.id ? ' on' : ''}" data-exp="${e.id}" title="${esc(e.pitch)}">${this.sketch(e.id)}${esc(e.name)} <i>+${e.goal.pays}</i></button>`).join('')}</div>` : ''}</div>
      ${objAllowed ? `<div class="cp-label">CONSCIENTIOUS OBJECTORS — pick ${objAllowed} kind${objAllowed > 1 ? 's' : ''} that will not come</div>
      <div class="cp-picks">${warKinds.map((k) => `<button class="cp-pick${this.objectors.includes(k) ? ' on' : ''}" data-obj="${k}">${k}</button>`).join('')}</div>` : ''}
      <div class="cp-facts">Starting profile: <b>${esc(PROFILES.find((x) => x.id === s.profile)?.name ?? '')}</b> (change in the Gene Bay) · wave intel: <b>${p.config.waveIntel === 'full' ? 'the Translator' : 'hidden'}</b>${perks.includes('sleepers1') ? ' · Sleepers in their waves' : ''}${perks.includes('volunteers1') ? ' · Volunteers' : ''}</div>
      <button class="screen-btn" data-act="deploy" ${open ? '' : 'disabled'}>${open ? (p.defence ? 'DEFEND' : 'DEPLOY') : held ? 'ALREADY YOURS' : 'NOT REACHABLE YET'}</button>`;
  }

  private genesHtml(): string {
    const s = this.state;
    const row = (id: OrganId) => {
      const l = LINEAGES[id]!;
      const have = s.lineages.includes(id);
      const def = ORGAN_BY_ID[id];
      const cur = l.catalogue === 'sanctioned' ? 'standing' : 'field notes';
      return `<div class="cp-lin${have ? ' have' : ''}"><b>${esc(def.name)}</b><span>${esc(def.unlocks ? `unlocks ${def.unlocks.join(', ')}` : def.blurb)}</span>
        ${have ? '<i>IN YOUR GENOME</i>' : `<button data-buy="${id}">${l.price} ${cur}</button>`}</div>`;
    };
    const ids = Object.keys(LINEAGES) as OrganId[];
    return `<div class="cp-cols">
      <div><div class="cp-label">STARTING PROFILE — the organs a deployment begins with</div>
        ${PROFILES.map((p) => `<div class="cp-lin${s.profile === p.id ? ' have' : ''}"><b>${esc(p.name)}</b><span>${esc(p.text)}</span>
          ${s.profiles.includes(p.id) ? (s.profile === p.id ? '<i>SELECTED</i>' : `<button data-profile="${p.id}">SELECT</button>`) : `<i>LOCKED — ${esc(p.unlock ?? '')}</i>`}</div>`).join('')}
        <div class="cp-label">EVOLUTION UNLOCKS (from the territories you hold)</div>
        <div class="cp-caps">${Object.entries(evolutionCaps(s)).map(([th, n]) => `<span>${esc(THEME_NAME[th] ?? th)} <b>${n}/3</b></span>`).join('')}</div>
      </div>
      <div><div class="cp-label">SANCTIONED LINEAGES — requisitioned with standing</div>
        ${ids.filter((i) => LINEAGES[i]!.catalogue === 'sanctioned').map(row).join('')}
        <div class="cp-label">UNSANCTIONED LINEAGES — the character's own work, paid in field notes</div>
        ${ids.filter((i) => LINEAGES[i]!.catalogue === 'unsanctioned').map(row).join('')}
      </div></div>`;
  }

  private lockerHtml(): string {
    const s = this.state;
    return `<div class="cp-cols cp-notebook"><div class="cp-page"><div class="cp-label">EXPERIMENTS</div>
      ${EXPERIMENTS.map((e) => {
        const avail = experimentsAvailable(s).some((x) => x.id === e.id);
        const done = s.experimentsDone.includes(e.id);
        return `<div class="cp-lin${done ? ' have' : ''}">${this.sketch(e.id)}<b>${esc(e.name)}</b><span>${esc(e.pitch)}</span>
          <i>${done ? 'DONE' : avail ? 'AVAILABLE — pick it in a briefing' : `after ${e.requires?.captures ?? 0} territories`}</i></div>`;
      }).join('')}</div>
      <div class="cp-page"><div class="cp-label">DARES DONE</div><div class="cp-tally" title="field notes">${'<i></i>'.repeat(Math.min(40, s.notes))}</div>
      ${DARES.map((d) => `<div class="cp-lin${s.daresDone.includes(d.id) ? ' have' : ''}">${this.sketch(d.id)}<b>${esc(d.title)}</b><span>${esc(d.text.replace('{n}', String(d.target)))}</span><i>${s.daresDone.includes(d.id) ? 'DONE' : `+${d.pays}`}</i></div>`).join('')}
      </div></div>`;
  }

  private boardHtml(): string {
    const s = this.state;
    return `<div class="cp-label">PROCREATION LICENSING BOARD — standing ${s.standing} / ${LICENCE_STANDING}${s.licence ? ' — APPROVED' : ''}</div>
      <div class="cp-bar"><div style="width:${Math.min(100, (s.standing / LICENCE_STANDING) * 100)}%"></div></div>
      <p class="cp-note">Every requisition you spend standing on delays the licence.</p>
      <div class="cp-label">LOG</div><div class="cp-log">${s.log.slice().reverse().map((l) => `<div>${esc(l)}</div>`).join('')}</div>`;
  }

  private commsHtml(): string {
    const s = this.state;
    const cards = FACTIONS.map((f) => {
      const contacted = s.contacted.includes(f.id);
      const mine = s.faction === f.id;
      const beats = f.beats.filter((b) => s.beatsSeen.includes(b.id));
      return `<div class="cp-lin cp-voice${mine ? ' have' : ''}">${contacted ? this.leaderHtml(f.id) : ''}<b>${esc(f.name)}</b>
        <span>${!contacted ? 'Has not made contact yet.' : mine ? `Allied. Route: ${beats.map((b) => esc(b.title)).join(' → ') || '—'}` : s.faction ? 'You chose another.' : 'Made contact. Waiting for your answer.'}</span>
        ${mine ? `<span class="cp-perks">${perksOf(s).map((p) => esc(f.perks[p] ?? p)).join('<br>')}</span>` : ''}
        ${contacted && !s.faction ? `<button data-ally="${f.id}">ALLY WITH THEM</button>` : ''}
        ${mine ? `<button data-replay="${f.id}">REPLAY SCENES</button>` : ''}</div>`;
    });
    const inbox = (s.comms ?? []).slice(-8).reverse();
    return `<div class="cp-label">COMMS — three voices from the planet. You may ally with ONE; it decides your route and your ending.</div>${cards.join('')}
      ${inbox.length ? `<div class="cp-label">FROM YOUR ALLY</div><div class="cp-log cp-comms">${inbox.map((l) => `<div>${speakLine(l)}</div>`).join('')}</div>` : ''}`;
  }

  private buildAi(): FallbackShipAi {
    const y = this.yoke;
    return new FallbackShipAi(y.mode === 'kimi'
      ? new RfabShipAi({ base: y.base, key: y.key || undefined, campaignId: campaignIdFor(this.state.seed) })
      : null);
  }

  /** Where YOKE's words come from right now, and the switch. */
  private yokeLinkHtml(): string {
    const y = this.yoke;
    const st = this.ai.status;
    return `<div class="cp-yoke-link"><span class="cp-yoke-dot ${st.live ? 'live' : ''}"></span>
      <span>YOKE: <b>${y.mode === 'kimi' ? 'Kimi K2.6 via rfab.ai' : 'scripted'}</b> — ${esc(st.note)}</span>
      <button data-act="yoke-mode">${y.mode === 'kimi' ? 'USE SCRIPTED' : 'USE KIMI'}</button></div>`;
  }

  private aiHtml(): string {
    const s = this.state;
    if (this.talk) {
      return `<div class="cp-label">AI CORE — YOKE</div><div class="cp-talk">${this.talk.turns.map((t) => `<div class="${t.speaker === 'YOKE' ? 'yoke' : 'you'}"><b>${t.speaker}:</b> ${esc(t.text)}</div>`).join('')}${this.waiting ? '<div class="yoke thinking"><b>YOKE:</b> …</div>' : ''}</div>
        <div class="cp-say"><input id="ai-input" placeholder="Answer, or say nothing" autocomplete="off"${this.waiting ? ' disabled' : ''}/><button data-act="ai-send"${this.waiting ? ' disabled' : ''}>SAY</button><button data-act="ai-end">END</button></div>
        ${this.yokeLinkHtml()}`;
    }
    return `<div class="cp-label">AI CORE — YOKE wants to talk${s.ai.queue.length ? '' : ' (nothing waiting)'}</div>
      ${s.ai.queue.map((q) => `<div class="cp-lin"><b>${q.replace('-', ' ').toUpperCase()}</b><span>YOKE has started a discussion.</span>
        <button data-engage="${q}">ENGAGE</button><button data-act="ai-later">NOT NOW</button></div>`).join('')}
      <div class="cp-label">PAST DISCUSSIONS</div>
      ${s.ai.transcripts.map((t) => `<div class="cp-log"><b>${t.trigger}</b> — ${t.turns.map((x) => `${x.speaker}: ${esc(x.text)}`).join(' / ')}</div>`).join('') || '<p class="cp-note">None yet.</p>'}
      <div class="cp-label">YOKE'S LINK</div>
      ${this.yokeLinkHtml()}
      <p class="cp-note">Live YOKE bills your rfab.ai account a few tokens a reply. Started from the launcher, it uses this PC's RFAB_API_KEY; otherwise paste your own key (rfab.ai → Settings → API keys).</p>
      <div class="cp-say"><input id="yoke-key" type="password" placeholder="${this.yoke.key ? 'Key saved — paste to replace' : 'RFab API key (optional)'}" autocomplete="off"/><button data-act="yoke-key">SAVE KEY</button>${this.yoke.key ? '<button data-act="yoke-forget">FORGET KEY</button>' : ''}</div>`;
  }

  private setYoke(y: YokeSettings): void {
    this.yoke = y;
    saveYoke(y);
    this.ai = this.buildAi();
    this.render();
  }

  /** The next faction scene waiting on the ship, as a modal. */
  private sceneHtml(): string {
    const next = this.state.pendingScenes[0];
    if (!next) return '';
    const f = faction(next.faction);
    const buttons = next.contact
      ? `<button class="screen-btn" data-ally="${f.id}">ALLY WITH ${esc(f.name.toUpperCase())}</button><button class="cp-room" data-act="scene-later">NOT NOW</button>`
      : next.choice
        ? next.choice.options.map((o) => `<button class="cp-pick" data-choice="${next.beat}|${o.id}">${esc(o.label)}</button>`).join('')
        : '<button class="screen-btn" data-act="scene-ok">CONTINUE</button>';
    return `<div class="cp-scene"><div class="cp-scene-card">
      ${this.leaderHtml(f.id)}
      <div class="screen-kicker">${esc(f.name.toUpperCase())}</div>
      <div class="cp-sub">${esc(next.scene.title.toUpperCase())}</div>
      ${next.scene.lines.map((l) => { const i = l.indexOf(':'); return `<p><b>${esc(l.slice(0, i))}:</b>${esc(l.slice(i + 1))}</p>`; }).join('')}
      ${next.choice ? `<div class="cp-label">${esc(next.choice.prompt)}</div>` : ''}
      <div class="cp-scene-btns">${buttons}</div></div></div>`;
  }

  // ------------------------------------------------------------ input

  private onClick(ev: MouseEvent): void {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-room],[data-act],[data-site],[data-dare],[data-exp],[data-obj],[data-buy],[data-profile],[data-ally],[data-choice],[data-engage],[data-replay]');
    if (!el) return;
    const d = el.dataset;
    let s = this.state;
    if (d.room) { this.room = d.room as Room; this.talk = null; this.render(); return; }
    if (d.site) { this.selected = d.site; this.dares = []; this.experiment = undefined; this.objectors = []; this.render(); return; }
    if (d.dare) {
      this.dares = this.dares.includes(d.dare) ? this.dares.filter((x) => x !== d.dare) : [...this.dares, d.dare].slice(-2);
      this.render(); return;
    }
    if (d.exp) { this.experiment = this.experiment === d.exp ? undefined : d.exp; this.render(); return; }
    if (d.obj) {
      const k = d.obj as EnemyKind;
      const n = perksOf(s).includes('objectors2') ? 2 : 1;
      this.objectors = this.objectors.includes(k) ? this.objectors.filter((x) => x !== k) : [...this.objectors, k].slice(-n);
      this.render(); return;
    }
    if (d.buy) { const r = buyLineage(s, d.buy as OrganId); if (r.ok) this.setState(r.state); return; }
    if (d.profile) { this.setState(selectProfile(s, d.profile)); return; }
    if (d.ally) { this.setState(ally(s, d.ally as FactionId)); return; }
    if (d.choice) { const [beat, opt] = d.choice.split('|'); this.setState(choose(s, beat, opt)); return; }
    if (d.replay) {
      const f = faction(d.replay as FactionId);
      const scenes = [f.contact, ...f.beats.filter((b) => s.beatsSeen.includes(b.id)).map((b) => b.scene), ...(s.ended === f.id ? [f.ending] : [])];
      s = { ...s, pendingScenes: [...scenes.map((scene) => ({ faction: f.id, scene })), ...s.pendingScenes] };
      this.state = s;
      this.render(); return;
    }
    if (d.engage) { void this.aiEngage(d.engage as AiTrigger); return; }
    switch (d.act) {
      case 'quit': this.hooks.quit(); return;
      case 'new': this.hooks.newCampaign(); return;
      case 'spin-l': this.spin -= 30; this.render(); return;
      case 'spin-r': this.spin += 30; this.render(); return;
      case 'scene-ok': case 'scene-later': this.setState(dismissScene(s)); return;
      case 'ai-later': this.room = 'desk'; this.render(); return;
      case 'ai-send': void this.aiSend(); return;
      case 'ai-end': this.aiEnd(); return;
      case 'yoke-mode': this.setYoke({ ...this.yoke, mode: this.yoke.mode === 'kimi' ? 'scripted' : 'kimi' }); return;
      case 'yoke-forget': this.setYoke({ ...this.yoke, key: '' }); return;
      case 'yoke-key': {
        const key = (document.getElementById('yoke-key') as HTMLInputElement | null)?.value.trim() ?? '';
        if (key) this.setYoke({ ...this.yoke, key, mode: 'kimi' });
        return;
      }
      case 'deploy':
        if (!this.selected) return;
        this.hooks.deploy({ territory: this.selected, dares: this.dares, experiment: this.experiment, objectors: this.objectors });
        return;
    }
  }

  // ------------------------------------------------------------ YOKE

  private async aiEngage(trigger: AiTrigger): Promise<void> {
    const talk = { trigger, turns: [] as AiTurn[] };
    this.talk = talk;
    await this.aiAsk(talk);
  }

  private async aiSend(): Promise<void> {
    const talk = this.talk;
    if (!talk || this.waiting) return;
    const input = document.getElementById('ai-input') as HTMLInputElement | null;
    const said = input?.value.trim() ?? '';
    if (said) talk.turns.push({ speaker: 'You', text: said });
    await this.aiAsk(talk, said || undefined);
    (document.getElementById('ai-input') as HTMLInputElement | null)?.focus();
  }

  /** One YOKE reply into this conversation (dropped if the player ended or left it meanwhile). */
  private async aiAsk(talk: { trigger: AiTrigger; turns: AiTurn[] }, said?: string): Promise<void> {
    this.waiting = true;
    this.render();
    try {
      const lines = await this.ai.reply({ trigger: talk.trigger, summary: summaryFor(this.state), lore }, talk.turns, said);
      if (this.talk === talk) for (const l of lines) talk.turns.push({ speaker: 'YOKE', text: l });
    } finally {
      this.waiting = false;
      if (this.talk === talk || !this.talk) this.render();
    }
  }

  private aiEnd(): void {
    if (!this.talk) return;
    const s = structuredClone(this.state);
    s.ai.queue = s.ai.queue.filter((q) => q !== this.talk!.trigger);
    if (!s.ai.seen.includes(this.talk.trigger)) s.ai.seen.push(this.talk.trigger);
    s.ai.transcripts.push(this.talk);
    this.talk = null;
    this.setState(s);
  }

  // ------------------------------------------------------------ the debrief

  showDebrief(d: Debrief, onBack: () => void): void {
    document.body.classList.add('in-ship');
    const row = (g: { def: { title: string; pays: number }; met: boolean; value: number; target: number }, cur: string, text: string) =>
      `<div class="cp-goal ${g.met ? 'met' : 'miss'}"><b>${g.met ? '✔' : '✘'} ${esc(g.def.title)}</b> ${esc(text)} — ${Math.round(g.value)}/${g.target} ${g.met ? `<i>+${g.def.pays} ${cur}</i>` : ''}</div>`;
    this.el.classList.remove('hidden');
    this.el.innerHTML = `<div class="cp-card"><div class="screen-kicker">POST-DEPLOYMENT REPORT — FORM XC-11</div>
      <div class="cp-title">${d.captured ? `${esc(territory(d.captured).name.toUpperCase())} TAKEN` : d.repelled ? 'COUNTER-ATTACK REPELLED' : 'DEPLOYMENT FAILED'}</div>
      ${d.lost ? `<p class="cp-bad">${esc(territory(d.lost).name)} fell to a counter-attack.</p>` : ''}
      <div class="cp-label">REQUISITION BOARD</div>${d.board.map((g) => row(g, 'standing', goalText(g))).join('')}
      ${d.dares.length ? `<div class="cp-label">DARES</div>${d.dares.map((g) => row(g, 'field notes', goalText(g))).join('')}` : ''}
      ${d.experiment ? `<div class="cp-label">EXPERIMENT</div>${row(d.experiment, 'field notes', goalText(d.experiment))}` : ''}
      <div class="cp-facts">Earned: <b>+${d.standing} standing</b> · <b>+${d.notes} field notes</b>${d.unlocked.length ? ` · unlocked: ${d.unlocked.map((u) => esc(u.split(':')[1])).join(', ')}` : ''}</div>
      <p class="cp-story">${esc(d.log)}</p>
      ${d.aside ? `<p class="cp-story cp-aside">${speakLine(d.aside)}</p>` : ''}
      <button class="screen-btn" data-act="back">RETURN TO THE SHIP</button></div>`;
    this.room = 'board';
    this.debriefing = true;
    this.dress();
    const btn = this.el.querySelector('[data-act="back"]') as HTMLElement;
    btn.addEventListener('click', (ev) => { ev.stopPropagation(); onBack(); }, { once: true });
  }
}
