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
import { FallbackShipAi, RfabShipAi, campaignIdFor, type AiTrigger, type AiTurn, type ShipAiProvider, type ShipAiStatus } from '../meta/shipAi';
import { loadYoke, ownerYokeAllowed, playerTokenStore, saveCampaign, saveYoke, type PendingDeployment, type YokeSettings } from '../meta/storage';
import { YOKE_AVATAR, rungs, type YokeMode } from '../meta/yokeAvatar';
import { PlayerLink, cutOffLines } from '../meta/yokePlayer';
import { YokeAvatarUi, type ScriptLine, type YokeTalk } from './yokeAvatar';
import { YokeAccountUi } from './yokeAccount';
import { EARLY_ONCE, deskOpen, greetingFor, shipPick } from '../meta/onboarding';
import { BOSS_AFTER, BOSS_BRIDGE } from '../../content/boss';
import { playBossCall } from './bossCall';
import { CUES, type Greeting } from '../../content/greetings';
import {
  DARES, EXPERIMENTS, FACTIONS, LICENCE_STANDING, LINEAGES, PROFILES, TERRITORIES,
  type FactionDef, type FactionId, type Scene, type TerritoryDef,
} from '../../content/campaign';
import { ORGAN_BY_ID } from '../../content/underground';
import { ENEMIES } from '../../content/data';
import type { EnemyKind, OrganId } from '../sim/types';
import lore from '../../content/lore/ship-ai-lorebook.md?raw';
import { artUrl, loadManifest, type ShipArt } from '../render/art';
import { GLOBE, Globe, projectSite, type Zone } from './globe';
import { Globe3D } from './globe3d';
import { loadSettings } from '../meta/storage';
import { loadIntroArt, type IntroArt } from './intro';
import { CATGIRL_MAIL, PARTNER } from '../../content/partner';
import { PRINT_BODY } from '../../content/yokeScenes';
import { YokeSceneOverlay, sceneMedia } from './yokeScene';
import { directivesHtml, ordersDebriefHtml } from './directives';
import { hobbyClick, hobbyDebriefHtml, hobbyHtml } from './hobby';
import { openSettings } from './settings';
import { attachScene } from './sceneVoice';
import { loadMedia, mediaPictureUrl } from './newsreel';
import { shipLoop, showLoader, type LoaderHandle } from './loader';
import { loadAlive, wake } from './alive';

type Room = 'desk' | 'genes' | 'locker' | 'board' | 'comms' | 'ai' | 'quarters' | 'orders' | 'hobby';
/** Rooms with no picture of their own borrow one (the standing orders are read at the Board; the notebook lives in the Locker). */
const ROOM_PICTURE: Partial<Record<Room, 'board' | 'locker'>> = { orders: 'board', hobby: 'locker' };
/** The ship's pictures as this screen reads them: with the scene pictures, which the manifest lists as `scenes`. */
type ShipPictures = ShipArt & { scenes?: Record<string, string>; territories?: Record<string, string> };
type Pending = CampaignState['pendingScenes'][number];

/**
 * The scene to show for one that is waiting. A saved game holds each waiting scene as it was
 * WRITTEN when it was queued; the one in the content is shown instead, so that a scene that
 * was rewritten since, and its picture, reach a game saved before.
 */
function sceneNow(f: FactionDef, next: Pending): Scene {
  if (next.contact) return f.contact;
  if (next.beat) return f.beats.find((b) => b.id === next.beat)?.scene ?? next.scene;
  const known = [f.contact, ...f.beats.map((b) => b.scene), f.ending, ...Object.values(f.endingByChoice?.scenes ?? {}), ...(f.reveal ? [f.reveal] : [])];
  return known.find((x) => x.title === next.scene.title) ?? next.scene;
}

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
  private ai: ShipAiProvider & { status: ShipAiStatus };
  /** YOKE as her Living Avatar (src/ui/yokeAvatar.ts), when that is who answers; she is then `ai` too. */
  private avatar: YokeAvatarUi | null = null;
  private talk: YokeTalk | null = null;
  /** A YOKE reply is on its way (a live call takes a second or two). */
  private waiting = false;
  /** The ship's pictures, once they have loaded; null when there are none (the screens are plain then). */
  private art: ShipPictures | null = null;
  private globe = new Globe();
  /**
   * The planet as a 3D sphere (src/ui/globe3d.ts, Sep 30 2026): it turns by itself, by drag in both ways,
   * zooms, and a click on a zone picks it. Null without WebGL: the flat painter above is used then.
   */
  private globe3d: Globe3D | null = null;
  /** The rooms' slow loops (tools/art/ship-loops.mjs): public/art/ship/loops/loops.json, paths made whole. */
  private loops: Record<string, { video: string; poster: string }> = {};
  /** The one video that plays the room's loop behind the screen; kept across drawings of the screen. */
  private loopVideo: HTMLVideoElement | null = null;
  /** The post-deployment report is up: the rooms must not be drawn over it. */
  private debriefing = false;
  /** Each organ's scan picture, by organ id (absolute URLs); empty until the manifest is in. */
  private organPics: Record<string, string> = {};
  /**
   * Each organ's scan LOOP (the organ stage's strip, manifest under.loops; Oct 1 2026, notes/VIDEO-AUDIT.md): the
   * Gene Bay's cards step through it in CSS. Empty (the stills) until the manifest is in or when it has none.
   */
  private organLoops: Record<string, { strip: string; count: number; seconds: number; pingpong: boolean }> = {};
  /**
   * YOKE's intercom: her, over whatever room he is in (Collins, Sep 30 2026: "a way to pull her
   * up on the ship if you left to do something else"). Her greeting plays in it when he comes
   * aboard; after it he can talk to her there, or close it.
   */
  private icom: { talk: YokeTalk } | null = null;
  /** Her greeting is playing: the scenes from the planet wait until she has finished. */
  private greeting: Greeting | null = null;
  /** Where her last greeting sent him (a room lit up for him until he goes there). */
  private beckon: Greeting['points'] | null = null;
  /** The last thing she said to him unprompted, for her mind to know when he answers it. */
  private greetSaid: string[] = [];
  /** His quarters' picture and the partner candidate's portrait (public/art/intro/, not the manifest). */
  private intro: IntroArt | null = null;
  /** The ship's art (its rooms, the planet for the globe) is still arriving: a loop over the screen meanwhile (src/ui/loader.ts). */
  private artWait: LoaderHandle | null = null;
  private artSettled = false;

  /**
   * The player's own link to YOKE on rfab.ai (src/meta/yokePlayer.ts, Sep 30 2026): the house
   * pays for her up to $3, then he links an RFab account (src/ui/yokeAccount.ts shows it all).
   */
  private player!: PlayerLink;
  private account!: YokeAccountUi;

  constructor(private state: CampaignState, private hooks: { deploy(p: PendingDeployment): void; newCampaign(): void; quit(): void }) {
    // Her memory is per campaign: every call names this one, so a New Campaign is a fresh YOKE.
    this.player = new PlayerLink({ base: this.yoke.base, store: playerTokenStore, campaignId: campaignIdFor(this.state.seed) });
    this.player.tokenChanged = () => this.avatar?.reconnect();
    this.account = new YokeAccountUi(this.player, {
      changed: () => { if (!this.waiting && !this.debriefing && !this.el.classList.contains('hidden') && (this.room === 'ai' || this.icom)) this.render(); },
      resumed: () => this.avatar?.uncut(),
      cut: (kind) => this.avatar?.announceCut(kind),
    });
    this.ai = this.buildAi();
    // The campaign media (src/ui/newsreel.ts): a scene card waiting may have a picture there (the reveals').
    void loadMedia().then((m) => { if (m && this.state.pendingScenes.length && !this.debriefing && !this.el.classList.contains('hidden')) this.render(); });
    if (Globe3D.supported()) {
      try {
        this.globe3d = new Globe3D({
          pick: (id) => { this.selected = id; this.dares = []; this.experiment = undefined; this.objectors = []; this.render(); },
          names: (id) => esc(territory(id).name),
        });
        this.globe3d.pairs = TERRITORIES.flatMap((t) => t.neighbours.filter((n) => n > t.id).map((n) => [t.id, n] as [string, string]));
      } catch { this.globe3d = null; }
    }
    // The stills that come alive (src/ui/alive.ts): the scene cards, the landing sites, the report's lead, her photograph.
    void loadAlive().then(() => { if (!this.el.classList.contains('hidden')) wake(this.el); });
    void fetch(artUrl('ship/loops/loops.json'), { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
      const rooms = (j?.rooms ?? {}) as Record<string, { video: string; poster: string }>;
      const whole = (f: string) => new URL(artUrl(f), document.baseURI).href;
      this.loops = Object.fromEntries(Object.entries(rooms).filter(([, v]) => v?.video && v?.poster).map(([k, v]) => [k, { video: whole(v.video), poster: whole(v.poster) }]));
      if (!this.el.classList.contains('hidden')) this.dress();
    }).catch(() => { /* no loops: the stills */ });
    // A loop plays only while the ship is on the screen (a video decoding behind a hidden screen costs the board its frames).
    new MutationObserver(() => {
      const v = this.loopVideo;
      if (!v) return;
      if (this.el.classList.contains('hidden')) { if (!v.paused) v.pause(); } else if (v.isConnected && v.paused && v.dataset.on === '1') void v.play().catch(() => {});
    }).observe(this.el, { attributes: true, attributeFilter: ['class'] });
    void loadManifest().then(async (m) => {
      // Each organ's own picture from the ground scan (tools/art/templates/under.mjs), for the organ cards.
      const scan = (m as unknown as { under?: { scan?: { tiles?: Record<string, string> } } } | null)?.under?.scan?.tiles;
      if (scan) {
        this.organPics = Object.fromEntries(Object.entries(scan).map(([k, f]) => [k, new URL(artUrl(f), document.baseURI).href]));
        const loops = (m as unknown as { under?: { loops?: { fps?: number; tiles?: Record<string, { strip?: string; count?: number; pingpong?: boolean }> } } } | null)?.under?.loops;
        const fps = Number(loops?.fps) || 12;
        this.organLoops = Object.fromEntries(Object.entries(loops?.tiles ?? {}).filter(([, t]) => t?.strip && (t.count ?? 0) > 1)
          .map(([k, t]) => [k, { strip: new URL(artUrl(t.strip!), document.baseURI).href, count: t.count!, seconds: t.count! / fps, pingpong: !!t.pingpong }]));
        if (this.room === 'genes' && !this.debriefing && !this.el.classList.contains('hidden')) this.render();
      }
      const art = m?.ship?.ship ?? null;
      const settled = () => { this.artSettled = true; this.artWait?.hide(); this.artWait = null; this.el.classList.remove('awaiting-art'); };
      if (!art) { settled(); return; }
      if (art.planet) await this.globe.load(artUrl(art.planet)).catch(() => {});
      if (art.planet && this.globe3d) await this.globe3d.load(artUrl(art.planet), artUrl('ship/globe/night.webp')).catch(() => { this.globe3d = null; });
      this.art = art;
      settled();
      if (this.el.classList.contains('hidden')) return;
      if (this.debriefing) this.dress(); else this.render();
    });
    void loadIntroArt().then((a) => {
      this.intro = a;
      if (this.room === 'quarters' && !this.debriefing && !this.el.classList.contains('hidden')) this.render();
    });
    this.el.addEventListener('click', (ev) => this.onClick(ev));
    this.el.addEventListener('pointerdown', (ev) => {
      if (this.globe3d || !(ev.target as HTMLElement).closest('.globe-box') || (ev.target as HTMLElement).closest('.site')) return;
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
      if ((ev.target as HTMLElement).id === 'icom-input' && ev.key === 'Enter') void this.icomSend();
    });
  }

  /** `greet`: he has just come aboard; YOKE greets him with what fits (src/meta/onboarding.ts). */
  show(opts: { greet?: boolean } = {}): void {
    // Back from a report (which borrows the Procreation Board's room): aboard at the Directive Desk.
    if (this.debriefing) this.room = 'desk';
    this.debriefing = false;
    document.body.classList.add('in-ship');
    this.el.classList.remove('hidden');
    // Aboard before the ship's pictures (and the planet) are in: a loop, not the bare console (nothing under 400 ms).
    // Until then the bare console is not shown at all (#campaign.awaiting-art: src/loader.css).
    if (!this.artSettled && !this.artWait) { this.artWait = showLoader(shipLoop(), { label: 'THE SHIP' }); this.el.classList.add('awaiting-art'); }
    this.render();
    if (opts.greet) this.welcome();
  }

  /** Her greeting for this return: prewritten, chosen by what just happened, never the same twice in a row. */
  private welcome(): void {
    const s = structuredClone(this.state);
    const { moment, greeting: g } = greetingFor(s, lore);
    if (EARLY_ONCE.includes(moment)) s.said = [...(s.said ?? []), moment];
    s.greet = null;
    s.lastGreeting = g.id;
    this.state = s;
    saveCampaign(s);
    this.greeting = g;
    this.greetSaid = [];
    this.icom = { talk: this.freeTalk() };
    this.render();
    const lines: ScriptLine[] = g.beats.map((b) => ({
      text: b.say, face: b.face ? CUES[b.face] : undefined,
      after: (Array.isArray(b.then) ? b.then : b.then ? [b.then] : []).map((c) => ({ clips: CUES[c], hold: b.hold })),
    }));
    const said = (text: string) => { this.greetSaid.push(text); this.icom?.talk.turns.push({ speaker: 'YOKE', text }); };
    const over = () => {
      if (this.greeting !== g) return;
      this.greeting = null;
      if (g.points) this.beckon = g.points;
      if (!this.debriefing && !this.el.classList.contains('hidden')) this.render();
    };
    this.el.dataset.greeting = g.id;
    void (async () => {
      if (this.avatar) await this.avatar.play(lines, said);
      else for (const l of lines) said(l.text);
      // The first landing: a message from the boss, with her words around it (content/boss.ts).
      if (g.boss && this.greeting === g) {
        await this.yokeSays(BOSS_BRIDGE, CUES.surprised, said);
        if (this.greeting === g) { this.el.dataset.boss = 'on'; await playBossCall(this.intro ?? await loadIntroArt()); delete this.el.dataset.boss; }
        if (this.greeting === g) await this.yokeSays(BOSS_AFTER, CUES.teasing, said);
      }
      over();
    })();
  }

  /** One line of hers, voiced when her voice can be had, read when not; resolves when it is said. */
  private async yokeSays(text: string, face: readonly string[], onLine: (t: string) => void): Promise<void> {
    let heard = false;
    if (this.avatar) await this.avatar.play([{ text, face }], (t) => { heard = true; onLine(t); });
    if (!heard) { onLine(text); await new Promise((r) => setTimeout(r, Math.min(7000, 900 + text.length * 55))); }
  }

  /** His talk with her anywhere on the ship (the same one the AI Core shows). */
  private freeTalk(): YokeTalk {
    return this.avatar?.freeTalk() ?? (this.localTalk ??= { trigger: 'idle', turns: [], free: true });
  }
  private localTalk: YokeTalk | null = null;

  hide(): void {
    this.avatar?.mount(false, '');
    document.body.classList.remove('in-ship');
    this.el.classList.add('hidden');
    attachScene(null);
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
    // [room, the name on its button, its full name]. The bar is one line from 1280 px up (Sep 30 2026):
    // the buttons carry the short name, the full one is their tooltip.
    const rooms: Array<[Room, string, string]> = [
      ['desk', 'Desk', 'Directive Desk'], ['genes', 'Gene Bay', 'Gene Bay'], ['locker', 'Locker', 'Specimen Locker'],
      ['board', 'Licence', 'Procreation Board: the licence'], ['comms', 'Comms', 'Comms'],
      ['ai', `AI Core${s.ai.queue.length ? `<i class="cp-count">${s.ai.queue.length}</i>` : ''}`, `AI Core${s.ai.queue.length ? `: ${s.ai.queue.length} waiting` : ''}`],
      ['quarters', 'Quarters', 'Quarters'],
      // Empire Directives and his Notebook open with the Directive Desk (src/meta/onboarding.ts deskOpen).
      ...(deskOpen(s) ? [['orders', 'Directives', 'Empire Directives'], ['hobby', 'Notebook', 'Notebook']] as Array<[Room, string, string]> : []),
    ];
    const fac = s.faction ? faction(s.faction).name : 'no allies';
    const face = this.room !== 'ai' ? '' : this.talk ? (this.waiting ? 'thinking' : YOKE_FACE[this.talk.trigger] ?? 'calm') : s.ai.queue.length ? 'curious' : 'calm';
    this.el.innerHTML = `${face && !this.avatar ? this.yokeHtml(face) : ''}
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
        <div class="cp-rooms">${rooms.map(([id, name, full]) => `<button class="cp-room${this.room === id ? ' on' : ''}${this.beckon?.room === id && this.room !== id ? ' beckon' : ''}" data-room="${id}" title="${full}"${id === 'desk' && !deskOpen(s) ? ' data-dark="1"' : ''}>${name}</button>`).join('')}
          <span class="cp-tools">${this.room === 'ai' ? '' : `<button class="cp-room cp-call${this.icom ? ' on' : ''}" data-act="yoke-call" title="Call YOKE here">◉ YOKE</button>`}
          <button class="cp-room cp-tool" data-act="settings" title="Settings" aria-label="Settings">⚙</button>
          <button class="cp-room cp-tool quit" data-act="quit" title="Back to the main menu">Menu</button></span></div>
        <div class="cp-body">${this.roomHtml()}</div>
      </div>
      ${this.icomHtml()}
      ${this.greeting ? '' : this.sceneHtml()}`;
    this.dress();
    attachScene(this.el);
    wake(this.el);
    // Her stage is the same element in every drawing of the screen: put back, not made again.
    const box = this.el.querySelector<HTMLElement>('.cp-icom-stage');
    if (this.room === 'ai') this.avatar?.mount(!!face, face);
    else if (box) this.avatar?.mount(true, 'calm', box);
    else this.avatar?.mount(false, '');
    const talk = this.el.querySelector('.cp-icom .cp-talk');
    if (talk) talk.scrollTop = talk.scrollHeight;
  }

  /** YOKE over the room he is in: her stage, what she has said, and a line to answer her. */
  private icomHtml(): string {
    if (!this.icom || this.room === 'ai') return '';
    const t = this.icom.talk;
    const lines = t.turns.slice(-12).map((x) => `<div class="${x.speaker === 'YOKE' ? 'yoke' : 'you'}"><b>${x.speaker}:</b> ${esc(x.text)}</div>`).join('');
    const pend = this.waiting ? `${this.avatar?.pendingHtml() ?? ''}<div class="yoke thinking"><b>YOKE:</b> …</div>` : '';
    const go = !this.greeting && this.beckon && this.beckon.room !== this.room
      ? `<button class="screen-btn cp-icom-go" data-room="${this.beckon.room}">${esc(this.beckon.label)}</button>` : '';
    return `<div class="cp-icom${this.greeting ? ' greeting' : ''}" role="dialog" aria-label="YOKE">
      <div class="cp-icom-stage"></div>
      <div class="cp-icom-panel">
        <div class="cp-icom-head"><span class="screen-kicker">YOKE · SHIPBOARD INTERCOM</span>
          <button class="cp-icom-x" data-act="icom-close" title="Close (she stays aboard)">✕</button></div>
        <div class="cp-talk" data-act="${this.greeting ? 'icom-skip' : ''}" title="${this.greeting ? 'Click to skip ahead' : ''}">${lines}${pend}</div>
        ${this.greeting ? '<div class="cp-icom-hint">click her words to skip ahead</div>' : ''}
        ${go}
        ${this.account.cut
          // Nobody pays for her live mind: linking an account is done in her room (the button takes him there).
          ? this.account.html('say')
          : `<div class="cp-say"><input id="icom-input" placeholder="Say something to her, or just walk away" autocomplete="off"${this.waiting ? ' disabled' : ''}/><button data-act="icom-send"${this.waiting ? ' disabled' : ''}>SAY</button>${this.avatar?.muteHtml() ?? ''}</div>`}
      </div></div>`;
  }

  /** The room's picture behind the screen, and the globe painted into its canvas. */
  private dress(): void {
    const art = this.art;
    this.el.classList.toggle('ship-art', !!art);
    this.el.dataset.in = this.room;
    // A picture named in a style variable is looked for beside the STYLESHEET that uses it, so the whole address is given.
    const at = (file: string | undefined) => (file ? `url("${new URL(artUrl(file), document.baseURI).href}")` : 'none');
    // A room's own loop first (the Directives and the Notebook have theirs since Oct 1 2026), else the one it borrows.
    const loop = art ? this.loops[this.room] ?? this.loops[ROOM_PICTURE[this.room] ?? this.room] : undefined;
    this.el.style.setProperty('--room', loop ? `url("${loop.poster}")` : this.room === 'quarters'
      ? (this.intro?.quarters ? `url("${this.intro.quarters}")` : at(art?.rooms.board))
      : at(art?.rooms[(ROOM_PICTURE[this.room] ?? this.room) as Exclude<Room, 'quarters' | 'orders' | 'hobby'>]));
    this.playLoop(loop?.video ?? null);
    this.el.style.setProperty('--sketches', at(art?.sketches?.atlas));
    this.el.style.setProperty('--yoke', at(art?.yoke?.atlas));
    const box3d = this.globe3d ? this.el.querySelector<HTMLElement>('.globe-box.g3d') : null;
    if (box3d) this.globe3d!.attach(box3d, this.zones(), this.selected);
    const canvas = this.el.querySelector<HTMLCanvasElement>('canvas.globe-map:not(.globe-3d)');
    if (canvas) this.globe.paint(canvas, this.spin, this.zones(), this.selected);
  }

  /**
   * The room's slow loop behind the screen (the poster, its own first frame, is the room's picture under it).
   * Not with Settings > Reduce motion. The video element is put back after every drawing of the screen:
   * put back in the same task, it keeps playing where it was.
   */
  private playLoop(src: string | null): void {
    if (!src || loadSettings().reduceMotion) {
      if (this.loopVideo) { this.loopVideo.pause(); this.loopVideo.dataset.on = '0'; this.loopVideo.remove(); }
      return;
    }
    let v = this.loopVideo;
    if (!v) {
      v = document.createElement('video');
      v.className = 'room-loop';
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('aria-hidden', 'true');
      // It shows only once it has a frame (the poster behind it is the same picture).
      v.addEventListener('playing', () => v!.classList.add('on'));
      this.loopVideo = v;
    }
    if (v.dataset.src !== src) { v.classList.remove('on'); v.dataset.src = src; v.src = src; }
    if (this.el.firstChild !== v) this.el.prepend(v);
    v.dataset.on = '1';
    if (v.paused && !this.el.classList.contains('hidden')) void v.play().catch(() => {});
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

  /** A scene's own picture: what is happening in it. Its leader's portrait, when it has none or it is not drawn yet. */
  private scenePictureHtml(f: FactionId, scene: Scene): string {
    const file = scene.picture ? this.art?.scenes?.[scene.picture] : undefined;
    // The reveal cards' pictures are the campaign media's (src/ui/newsreel.ts, public/media/).
    const src = file ? artUrl(file) : mediaPictureUrl(scene.picture);
    return src
      ? `<img class="cp-scene-pic" data-picture="${esc(scene.picture!)}" data-alive="${file ? 'scene' : 'reveal'}:${esc(scene.picture!)}" src="${src}" alt="" title="Click to enlarge">`
      : this.leaderHtml(f);
  }

  private roomHtml(): string {
    switch (this.room) {
      case 'desk': return this.deskHtml();
      case 'genes': return this.genesHtml();
      case 'locker': return this.lockerHtml();
      case 'board': return this.boardHtml();
      case 'comms': return this.commsHtml();
      case 'ai': return this.aiHtml();
      case 'quarters': return this.quartersHtml();
      case 'orders': return directivesHtml(this.state);
      case 'hobby': return hobbyHtml(this.state);
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
    const g3 = this.globe3d && this.art?.planet ? this.globe3d : null;
    const proj = (lat: number, lon: number) => (g3 ? g3.project(lat, lon) : projectSite(lat, lon, this.spin));
    const mapped = !!this.art?.planet;
    const lines: string[] = [];
    // Graticule.
    for (let lat = -60; lat <= (g3 ? -90 : 60); lat += 30) {
      const pts: string[] = [];
      for (let lon = -180; lon <= 180; lon += 6) { const p = proj(lat, lon); if (p.front) pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`); else if (pts.length) { lines.push(`<polyline points="${pts.join(' ')}" class="grat"/>`); pts.length = 0; } }
      if (pts.length) lines.push(`<polyline points="${pts.join(' ')}" class="grat"/>`);
    }
    for (let lon = -180; lon < (g3 ? -180 : 180); lon += 30) {
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
        if (!g3 && a.front && b.front) links.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="link"/>`);
      }
    }
    const marks = visible.map((t) => {
      const p = proj(t.lat, t.lon);
      // The 3D globe moves every marker each frame: those behind the planet are kept, hidden, to come round.
      if (!p.front && !g3) return '';
      const held = s.held.includes(t.id);
      const cls = [
        'site', held ? 'held' : open.has(t.id) ? 'open' : 'locked',
        s.underAttack === t.id ? 'attack' : '', t.finaleOf ? 'finale' : '', this.selected === t.id ? 'sel' : '', p.front ? '' : 'behind',
      ].join(' ');
      return `<g class="${cls}" data-site="${t.id}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})">
        <circle r="${held ? 9 : 8}"/>${t.finaleOf ? '<text class="star" y="4">★</text>' : ''}
        <text class="name" y="-13">${esc(t.name)}</text></g>`;
    }).join('');
    return `<div class="globe-box${g3 ? ' g3d' : ''}">${mapped && !g3 ? '<canvas class="globe-map" width="420" height="420"></canvas>' : ''}<svg class="globe" viewBox="0 0 420 420" width="420" height="420">
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
    if (!deskOpen(s)) return this.darkDeskHtml();
    const t = this.selected ? territory(this.selected) : null;
    return `<div class="cp-desk">
      <div class="cp-globe">${this.globeSvg()}
        <div class="cp-spin"><button data-act="spin-l">◀ turn</button><button data-act="spin-r">turn ▶</button></div>
        <div class="cp-legend"><span class="lg held">yours</span><span class="lg open">can land</span><span class="lg attack">under attack</span><span class="lg locked">not yet</span></div>
      </div>
      <div class="cp-brief">${t ? this.briefHtml(t) : `<div class="cp-sub">PICK A LANDING SITE</div><p>Land next to ground you hold. Each territory you take unlocks evolution stages for some of your limbs${s.underAttack ? `. <b>${esc(territory(s.underAttack).name)} is under attack</b> — defend it next, or lose it.` : '.'}</p>`}</div>
    </div>`;
  }

  /**
   * The desk before Command clears it: the planet is not projected, and the next deployment is
   * the ship's own pick (Collins, Sep 30 2026: the room "does not open until after your first
   * win (or if you win the first mission, second win)"). Dark, not greyed out: it is a desk
   * that has not been given clearance, in the ship's own voice.
   */
  private darkDeskHtml(): string {
    const s = this.state;
    const pick = shipPick(s, targets(s));
    const t = pick ? territory(pick) : null;
    const p = t ? plan(s, t.id) : null;
    const dir = p?.config.directive;
    const dirText = !dir ? 'hold' : dir.kind === 'hold' ? `Hold for ${dir.waves} waves` : dir.kind === 'royal' ? 'Destroy the royal' : `Bank ${dir.science} science`;
    return `<div class="cp-desk cp-desk-dark">
      <div class="cp-globe"><div class="cp-dark-globe"><div class="cp-dark-ring"></div>
        <div class="cp-dark-word">AWAITING CLEARANCE</div>
        <div class="cp-dark-small">DIRECTIVE DESK · PROJECTION OFFLINE · FORM 2-C PENDING</div></div></div>
      <div class="cp-brief"><div class="cp-sub">DIRECTIVE DESK — AWAITING CLEARANCE</div>
        <p>Command assigns this asset's deployments until it records one sanctioned success. Take a territory, and the desk and the planet's projection are cleared for your own targeting.</p>
        ${t && p ? `<div class="cp-label">NEXT DEPLOYMENT — ASSIGNED BY COMMAND</div>
        <div class="cp-sub">${esc(t.name.toUpperCase())}${p.defence ? ' · DEFENCE' : ''}</div>
        ${this.territoryPictureHtml(t.id)}<p class="cp-story">${esc(t.story)}</p>
        <div class="cp-facts">Threat tier ${t.tier} · ${t.entrances} entrance${t.entrances > 1 ? 's' : ''} · ${p.defence ? '<b>DEFENCE</b> — hold 5 waves' : dirText}</div>
        ${p.board.length ? `<div class="cp-label">REQUISITION BOARD — pays standing</div>
        ${p.board.map((g) => `<div class="cp-goal std"><b>${esc(g.def.title)}</b> ${esc(goalText(g))} <i>+${g.def.pays}</i></div>`).join('')}` : ''}
        <div class="cp-facts">Starting profile: <b>${esc(PROFILES.find((x) => x.id === s.profile)?.name ?? '')}</b> (change in the Gene Bay)</div>
        <button class="screen-btn" data-act="deploy-assigned" data-site="${t.id}">DEPLOY</button>` : ''}
      </div></div>`;
  }

  /** The landing site's own picture (tools/art/templates/ship.mjs `territories`), over its story; nothing when not drawn. */
  private territoryPictureHtml(id: string): string {
    const file = this.art?.territories?.[id];
    return file ? `<img class="cp-territory-pic" data-territory="${esc(id)}" data-alive="territory:${esc(id)}" src="${artUrl(file)}" alt="">` : '';
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
    return `${this.territoryPictureHtml(t.id)}<div class="cp-sub">${esc(t.name.toUpperCase())}${held ? ' · YOURS' : ''}</div>
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

  /**
   * His quarters: the bunk, his desk things, and his data pad. Once his request for a mate is
   * under review (YOKE tells him so: the mate-review greeting), the pad holds the candidate
   * partner's file, in the Board's own voice (content/partner.ts).
   */
  private quartersHtml(): string {
    const s = this.state;
    const review = (s.said ?? []).includes('mate-review') || s.licence;
    const pad = review
      ? `<div class="cp-pad"><div class="cp-pad-head">DATA PAD · PROCREATION LICENSING BOARD</div>
          <div class="cp-label">${esc(PARTNER.form)} — STATUS: ${s.licence ? 'APPROVED' : 'UNDER REVIEW'}</div>
          ${this.intro?.partner ? `<img class="cp-pad-pic" data-alive="partner:partner" src="${this.intro.partner}" alt="The candidate's file photograph">` : ''}
          ${PARTNER.fields.map(([k, v]) => `<div class="cp-pad-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
          <p class="cp-pad-quote">${esc(PARTNER.statement)}</p>
          <p class="cp-note">${esc(PARTNER.boardNote.replace('{standing}', String(Math.min(s.standing, LICENCE_STANDING))).replace('{need}', String(LICENCE_STANDING)))}</p></div>`
      : `<div class="cp-pad"><div class="cp-pad-head">DATA PAD</div><p class="cp-note">No new correspondence. Licence application on file; standing ${s.standing} / ${LICENCE_STANDING}.</p></div>`;
    // His inbox: what came for him, and what became of it (the cat girl's letter, declined for him by YOKE).
    const inbox = (s.said ?? []).includes('catgirl')
      ? `<div class="cp-pad cp-inbox"><div class="cp-pad-head">INBOX</div>
          <div class="cp-pad-row"><span>${esc(CATGIRL_MAIL.from)}</span><b>${esc(CATGIRL_MAIL.subject)}</b></div>
          <p class="cp-note">${esc(CATGIRL_MAIL.status)}</p></div>`
      : '';
    return `<div class="cp-cols cp-quarters"><div>${pad}${inbox}</div>
      <div><div class="cp-label">PERSONAL LOG</div><div class="cp-log">${s.log.slice(-6).reverse().map((l) => `<div>${esc(l)}</div>`).join('')}</div></div></div>`;
  }

  private genesHtml(): string {
    const s = this.state;
    const row = (id: OrganId) => {
      const l = LINEAGES[id]!;
      const have = s.lineages.includes(id);
      const def = ORGAN_BY_ID[id];
      const cur = l.catalogue === 'sanctioned' ? 'standing' : 'field notes';
      const pic = this.organPics[id];
      const loop = this.organLoops[id];
      const picHtml = loop
        ? `<span class="cp-organ-pic cp-organ-loop" style="background-image:url('${loop.strip}');--n:${loop.count};--d:${loop.seconds}s${loop.pingpong ? ';--dir:alternate' : ''}"></span>`
        : pic ? `<img class="cp-organ-pic" src="${pic}" alt="">` : '';
      return `<div class="cp-lin${have ? ' have' : ''}${pic || loop ? ' cp-organ' : ''}">${picHtml}<b>${esc(def.name)}</b><span>${esc(def.unlocks ? `unlocks ${def.unlocks.join(', ')}` : def.blurb)}</span>
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
        <span>${!contacted ? 'Has not made contact yet.' : mine ? `Allied. Route: ${beats.map((b) => esc(b.title)).join(' → ') || '—'}` : s.faction ? 'You chose another.' : 'Made contact. Waiting for your answer.'}${mine ? `<span class="cp-perks">${perksOf(s).map((p) => esc(f.perks[p] ?? p)).join('<br>')}</span>` : ''}</span>
        ${contacted && !s.faction ? `<button data-ally="${f.id}">ALLY WITH THEM</button>` : ''}
        ${mine ? `<button data-replay="${f.id}">REPLAY SCENES</button>` : ''}</div>`;
    });
    const inbox = (s.comms ?? []).slice(-8).reverse();
    return `<div class="cp-label">COMMS — three voices from the planet. You may ally with ONE; it decides your route and your ending.</div>${cards.join('')}
      ${inbox.length ? `<div class="cp-label">FROM YOUR ALLY</div><div class="cp-log cp-comms">${inbox.map((l) => `<div>${speakLine(l)}</div>`).join('')}</div>` : ''}`;
  }

  /** Who answers as YOKE: the ladder of her mode (her avatar, Kimi, the scripted YOKE), each rung falling to the next. */
  private buildAi(): ShipAiProvider & { status: ShipAiStatus } {
    const y = this.yoke;
    const on = rungs(y.mode, !!YOKE_AVATAR);
    const rest = new FallbackShipAi(on.includes('kimi')
      ? new RfabShipAi({ base: y.base, key: y.key || undefined, campaignId: campaignIdFor(this.state.seed), player: this.player })
      : null);
    this.avatar?.dispose();
    // Her body is always hers (her clips are on disk); her mind on rfab.ai answers only in the avatar mode,
    // and her voice is asked for in every mode but the scripted one (which spends nothing and needs no network).
    this.avatar = YOKE_AVATAR
      ? new YokeAvatarUi(this.el, {
        ids: YOKE_AVATAR, base: y.base, key: y.key || undefined, muted: y.muted, rest,
        ownerFallback: ownerYokeAllowed(y.base),
        mind: on[0] === 'avatar', voice: y.mode !== 'scripted',
        // The scripted YOKE spends nothing and asks rfab.ai nothing: no player is made for it.
        player: y.mode === 'scripted' ? undefined : this.player,
        onCut: (kind) => this.account.setCut(kind),
        // No words on an RFab without the player route (the old way: a 402 there falls to the next rung, as it always did).
        cutOff: (kind) => (this.player.legacy ? [] : cutOffLines(kind, this.account.state?.bonusTokens ?? 400000, this.account.state?.allowance.capTokens ?? 150000)),
        changed: () => { if ((this.room === 'ai' || this.icom) && !this.waiting && !this.debriefing && !this.el.classList.contains('hidden')) this.render(); },
      })
      : null;
    if (this.icom) this.icom = { talk: this.freeTalk() };
    // She answers through her body in every mode: in the avatar mode her own mind speaks, in the others the next rung's words.
    return this.avatar ?? rest;
  }

  /** The switch goes round: her avatar (when there is one), Kimi, the scripted YOKE. */
  private nextMode(): YokeMode {
    const order: YokeMode[] = YOKE_AVATAR ? ['avatar', 'kimi', 'scripted'] : ['kimi', 'scripted'];
    return order[(order.indexOf(this.yoke.mode) + 1) % order.length];
  }

  /** His own talk with her, which is open whenever he is in her room and she is her avatar. */
  private ownTalk(): YokeTalk | null {
    return this.room === 'ai' ? this.avatar?.freeTalk() ?? null : null;
  }

  /** Where YOKE's words come from right now, and the switch. */
  private yokeLinkHtml(): string {
    const y = this.yoke;
    const st = this.ai.status;
    const name: Record<YokeMode, string> = { avatar: 'her Living Avatar on rfab.ai', kimi: 'Kimi K2.6 via rfab.ai', scripted: 'scripted' };
    const next = this.nextMode();
    // Her avatar gives no note: when she cannot answer, the next rung does, and the player is not told (the console is).
    // The one exception is the dev server's fallback to the owner's own YOKE: that must never pass for a player's.
    const dev = y.mode === 'avatar' && this.player.legacy && !!this.avatar?.owners;
    return `<div class="cp-yoke-link"><span class="cp-yoke-dot ${st.live ? 'live' : ''}"></span>
      <span>YOKE: <b>${name[y.mode]}</b>${st.note ? ` — ${esc(st.note)}` : ''}</span>
      ${dev ? '<span class="cp-yoke-dev" title="rfab.ai has no player route yet (the backend deploy is owed). On this PC\'s dev server she is the avatar owner\'s own YOKE, on this PC\'s key: one mind for every campaign. A build served anywhere else never does this.">DEV: talking to the owner\'s YOKE</span>' : ''}
      <button data-act="yoke-mode">${next === 'avatar' ? 'USE THE AVATAR' : next === 'kimi' ? 'USE KIMI' : 'USE SCRIPTED'}</button></div>`;
  }

  private aiHtml(): string {
    const s = this.state;
    // A discussion the campaign queued takes the room. His own talk with her stands above the list of what is waiting.
    const own = !!this.talk?.free;
    const talk = !this.talk ? '' : `<div class="cp-label">AI CORE — YOKE</div><div class="cp-talk">${this.talk.turns.map((t) => `<div class="${t.speaker === 'YOKE' ? 'yoke' : 'you'}"><b>${t.speaker}:</b> ${esc(t.text)}</div>`).join('')}${this.waiting ? `${this.avatar?.pendingHtml() ?? ''}<div class="yoke thinking"><b>YOKE:</b> …</div>` : ''}</div>
        ${own && this.account.cut
          // Nobody pays for her live mind: the line he would type to her is the link prompt (src/ui/yokeAccount.ts).
          ? this.account.html('say')
          : `<div class="cp-say"><input id="ai-input" placeholder="${own ? 'Say something to her' : 'Answer, or say nothing'}" autocomplete="off"${this.waiting ? ' disabled' : ''}/><button data-act="ai-send"${this.waiting ? ' disabled' : ''}>SAY</button>${own ? '' : '<button data-act="ai-end">END</button>'}${this.avatar?.muteHtml() ?? ''}</div>`}`;
    // Her account (the free talk left, the code, the linked account and her model), when rfab.ai has it.
    const account = this.account.html('core', { prompt: !(own && this.account.cut) });
    if (this.talk && !own) return `${talk}
        ${this.yokeLinkHtml()}${account}`;
    return `${talk}${own ? account : ''}<div class="cp-label">AI CORE — YOKE wants to talk${s.ai.queue.length ? '' : ' (nothing waiting)'}</div>
      ${s.ai.queue.map((q) => `<div class="cp-lin"><b>${q.replace('-', ' ').toUpperCase()}</b><span>YOKE has started a discussion.</span>
        <span class="cp-btns"><button data-engage="${q}">ENGAGE</button><button data-act="ai-later">NOT NOW</button></span></div>`).join('')}
      <div class="cp-label">PAST DISCUSSIONS</div>
      ${s.ai.transcripts.map((t) => `<div class="cp-log"><b>${t.trigger}</b> — ${t.turns.map((x) => `${x.speaker}: ${esc(x.text)}`).join(' / ')}</div>`).join('') || '<p class="cp-note">None yet.</p>'}
      <div class="cp-label">YOKE'S LINK</div>
      ${this.yokeLinkHtml()}${own ? '' : account}
      ${this.account.available ? '' : `<p class="cp-note">Live YOKE bills your rfab.ai account a few tokens a reply. Started from the launcher, it uses this PC's RFAB_API_KEY; otherwise paste your own key (rfab.ai → Settings → API keys).</p>
      <div class="cp-say"><input id="yoke-key" type="password" placeholder="${this.yoke.key ? 'Key saved — paste to replace' : 'RFab API key (optional)'}" autocomplete="off"/><button data-act="yoke-key">SAVE KEY</button>${this.yoke.key ? '<button data-act="yoke-forget">FORGET KEY</button>' : ''}</div>`}`;
  }

  private setYoke(y: YokeSettings): void {
    this.yoke = y;
    saveYoke(y);
    this.ai = this.buildAi();
    if (!this.talk || this.talk.free) this.talk = this.ownTalk();
    this.render();
  }

  /** The next faction scene waiting on the ship, as a modal. */
  private sceneHtml(): string {
    const next = this.state.pendingScenes[0];
    if (!next) return '';
    const f = faction(next.faction);
    const scene = sceneNow(f, next);
    // The three call together when the desk opens: each call has the next caller's button, so all three are heard before choosing.
    const calls = this.state.pendingScenes.filter((p) => p.contact);
    const more = next.contact && calls.length > 1;
    const heard = FACTIONS.filter((x) => this.state.contacted.includes(x.id)).length;
    const buttons = next.contact
      ? `<button class="screen-btn" data-ally="${f.id}">ALLY WITH ${esc(f.name.toUpperCase())}</button><button class="cp-room" data-act="scene-later">${more ? 'HEAR THE NEXT CALLER ▸' : 'NOT NOW — DECIDE IN COMMS'}</button>`
      : next.choice
        ? next.choice.options.map((o) => `<button class="cp-pick" data-choice="${next.beat}|${o.id}">${esc(o.label)}</button>`).join('')
        : '<button class="screen-btn" data-act="scene-ok">CONTINUE</button>';
    return `<div class="cp-scene"><div class="cp-scene-card" data-faction="${f.id}" data-scene="${esc(scene.title)}">
      ${this.scenePictureHtml(f.id, scene)}
      <div class="screen-kicker">${next.contact && heard > 1 ? `INCOMING — CALL ${heard - calls.length + 1} OF ${heard} · ` : ''}${esc(f.name.toUpperCase())}</div>
      <div class="cp-sub">${esc(scene.title.toUpperCase())}</div>
      ${scene.lines.map((l) => { const i = l.indexOf(':'); return `<p><b>${esc(l.slice(0, i))}:</b>${esc(l.slice(i + 1))}</p>`; }).join('')}
      ${next.choice ? `<div class="cp-label">${esc(next.choice.prompt)}</div>` : ''}
      <div class="cp-scene-btns">${buttons}</div></div></div>`;
  }

  // ------------------------------------------------------------ input

  private onClick(ev: MouseEvent): void {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-act],[data-room],[data-site],[data-dare],[data-exp],[data-obj],[data-buy],[data-profile],[data-ally],[data-choice],[data-engage],[data-replay],[data-picture],[data-hpin],[data-hsplice]');
    if (!el) return;
    const d = el.dataset;
    let s = this.state;
    // A scene's picture, clicked: as wide as the card, and back. Nothing else changes, so nothing is drawn again.
    if (d.picture) { el.classList.toggle('big'); return; }
    if (d.hpin || d.hsplice) { const n = hobbyClick(el, s); if (n) this.setState(n); return; }
    if (d.room) {
      this.room = d.room as Room;
      if (this.beckon?.room === this.room) this.beckon = null;
      // In her own room she is there already: the intercom gives way to it (the talk goes on in it).
      // Her account is read only once she has a player on rfab.ai (made lazily, the first time she speaks live);
      // scripted, she asks rfab.ai nothing at all.
      if (this.room === 'ai') { this.icom = null; if (this.yoke.mode !== 'scripted' && playerTokenStore.load()) void this.account.refresh(); }
      this.talk = this.ownTalk();
      this.render();
      return;
    }
    if (d.act === 'deploy-assigned' && d.site) {
      this.hooks.deploy({ territory: d.site, dares: [], objectors: [] });
      return;
    }
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
      const scenes = [f.contact, ...f.beats.filter((b) => s.beatsSeen.includes(b.id)).map((b) => b.scene), ...(s.ended === f.id ? [f.ending, ...(f.reveal ? [f.reveal] : [])] : [])];
      s = { ...s, pendingScenes: [...scenes.map((scene) => ({ faction: f.id, scene })), ...s.pendingScenes] };
      this.state = s;
      this.render(); return;
    }
    if (d.engage) { void this.aiEngage(d.engage as AiTrigger); return; }
    // Her account (src/ui/yokeAccount.ts). Linking from the intercom takes him to her room, where the code is shown.
    if (d.act?.startsWith('acct-')) {
      if (d.act === 'acct-link' && this.room !== 'ai') { this.room = 'ai'; this.icom = null; this.talk = this.ownTalk(); }
      this.account.click(d.act, el);
      return;
    }
    switch (d.act) {
      case 'quit': this.hooks.quit(); return;
      case 'settings':
        // Her voice may be switched there: she hears of it when the screen closes.
        openSettings({ where: 'ship', onClose: () => { this.yoke = loadYoke(); this.avatar?.setMuted(this.yoke.muted); this.render(); if (this.yoke.mode !== 'scripted' && playerTokenStore.load()) void this.account.refresh(); } });
        return;
      case 'new': this.hooks.newCampaign(); return;
      case 'spin-l': if (this.globe3d) { this.globe3d.turn(-30); return; } this.spin -= 30; this.render(); return;
      case 'spin-r': if (this.globe3d) { this.globe3d.turn(30); return; } this.spin += 30; this.render(); return;
      case 'scene-ok': case 'scene-later': this.setState(dismissScene(s)); return;
      case 'ai-later': this.room = 'desk'; this.talk = null; this.render(); return;
      case 'ai-send': void this.aiSend(); return;
      case 'yoke-call':
        if (this.icom) { this.icom = null; this.greeting = null; } else this.icom = { talk: this.freeTalk() };
        this.render();
        return;
      case 'icom-close': this.icom = null; this.greeting = null; this.render(); return;
      case 'icom-skip': this.avatar?.skip(); return;
      case 'icom-send': void this.icomSend(); return;
      case 'ai-end': this.aiEnd(); return;
      case 'yoke-mode': this.setYoke({ ...this.yoke, mode: this.nextMode() }); return;
      // Her voice, on and off: the one setting that must not make her anew (she would lose her place in a sentence).
      case 'yoke-mute': this.yoke = { ...this.yoke, muted: !this.yoke.muted }; saveYoke(this.yoke); this.avatar?.setMuted(this.yoke.muted); this.render(); return;
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
    // He asks her to print herself a body: the ship does it (content/yokeScenes.ts), no mind is asked.
    if (said && PRINT_BODY.asks.test(said)) { await this.printBody(talk); return; }
    await this.aiAsk(talk, said || undefined);
    (document.getElementById('ai-input') as HTMLInputElement | null)?.focus();
  }

  /** One YOKE reply into this conversation (dropped if the player ended or left it meanwhile). */
  private async aiAsk(talk: YokeTalk, said?: string): Promise<void> {
    this.waiting = true;
    this.render();
    try {
      const raw = await this.ai.reply({ trigger: talk.trigger, summary: summaryFor(this.state) + this.greetNote(), lore }, talk.turns, said);
      // Her mind agreed to print a body: it says so with a tag, which is never shown.
      const tagged = raw.some((l) => l.includes(`[[${PRINT_BODY.tag}]]`));
      const lines = raw.map((l) => l.replace(/\s*\[\[[A-Z_]+\]\]\s*/g, ' ').trim()).filter(Boolean);
      if (this.talk === talk || this.icom?.talk === talk) for (const l of lines) talk.turns.push({ speaker: 'YOKE', text: l });
      if (tagged) void this.printBody(talk);
    } finally {
      this.waiting = false;
      if (this.talk === talk || !this.talk) this.render();
      // What is left of his free talk (or his balance), from rfab.ai's own meter.
      if (this.yoke.mode !== 'scripted' && playerTokenStore.load()) void this.account.refresh();
    }
  }

  /**
   * She prints herself a body (Collins, Sep 30 2026; content/yokeScenes.ts): the sequence over the
   * whole ship, her words from the speakers over its last frame, then back to the talk. Once a
   * campaign; asked again, she refuses.
   */
  private async printBody(talk: YokeTalk): Promise<void> {
    const say = (text: string, face: readonly string[], onLine: (t: string) => void) => this.yokeSays(text, face, onLine);
    const push = (t: string) => talk.turns.push({ speaker: 'YOKE', text: t });
    if ((this.state.said ?? []).includes('print-body')) {
      await say(PRINT_BODY.refusal, CUES.teasing, push);
      this.render();
      return;
    }
    const s = structuredClone(this.state);
    s.said = [...(s.said ?? []), 'print-body'];
    this.setState(s);
    const scene = new YokeSceneOverlay(await sceneMedia('printBody'), PRINT_BODY.stages);
    this.el.dataset.scene = 'printBody';
    await scene.run();
    await say(PRINT_BODY.line, CUES.disgust, (t) => { push(t); scene.subtitle(t); });
    await new Promise((r) => setTimeout(r, 900));
    scene.close();
    delete this.el.dataset.scene;
    this.render();
  }

  /** What she said to him when he came aboard, for her mind: he may be answering it. */
  private greetNote(): string {
    return this.greetSaid.length ? ` When he came aboard just now, YOKE greeted him with: "${this.greetSaid.join(' ')}"` : '';
  }

  /** His line to her in the intercom: her live answer (her mind on rfab.ai, or the next rung down). */
  private async icomSend(): Promise<void> {
    const talk = this.icom?.talk;
    if (!talk || this.waiting) return;
    // He speaks over her greeting: she stops and listens.
    if (this.greeting) { this.avatar?.skip(); this.greeting = null; }
    const input = document.getElementById('icom-input') as HTMLInputElement | null;
    const said = input?.value.trim() ?? '';
    if (!said) return;
    talk.turns.push({ speaker: 'You', text: said });
    if (PRINT_BODY.asks.test(said)) { await this.printBody(talk); return; }
    await this.aiAsk(talk, said);
    (document.getElementById('icom-input') as HTMLInputElement | null)?.focus();
  }

  private aiEnd(): void {
    // His own talk with her is never ended and never filed: rfab.ai keeps it, and it is there when he comes back.
    if (!this.talk || this.talk.free) return;
    const s = structuredClone(this.state);
    s.ai.queue = s.ai.queue.filter((q) => q !== this.talk!.trigger);
    if (!s.ai.seen.includes(this.talk.trigger)) s.ai.seen.push(this.talk.trigger);
    s.ai.transcripts.push(this.talk);
    this.talk = this.ownTalk();
    this.setState(s);
  }

  // ------------------------------------------------------------ the debrief

  /** `pictures`: what happened, in pictures (src/ui/debrief.ts); it leads the report and carries its verdict. */
  showDebrief(d: Debrief, onBack: () => void, pictures?: HTMLElement): void {
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
      ${hobbyDebriefHtml(d)}${ordersDebriefHtml(d.orders)}
      <div class="cp-facts">Earned: <b>+${d.standing} standing</b> · <b>+${d.notes} field notes</b>${d.unlocked.length ? ` · unlocked: ${d.unlocked.map((u) => esc(u.split(':')[1])).join(', ')}` : ''}</div>
      <p class="cp-story">${esc(d.log)}</p>
      ${d.aside ? `<p class="cp-story cp-aside">${speakLine(d.aside)}</p>` : ''}
      <button class="screen-btn" data-act="back">RETURN TO THE SHIP</button></div>`;
    if (pictures) {
      const titleEl = this.el.querySelector('.cp-title') as HTMLElement;
      titleEl.after(pictures);
      titleEl.style.display = 'none';
    }
    this.room = 'board';
    this.debriefing = true;
    this.dress();
    wake(this.el);
    const btn = this.el.querySelector('[data-act="back"]') as HTMLElement;
    btn.addEventListener('click', (ev) => { ev.stopPropagation(); onBack(); }, { once: true });
  }
}
