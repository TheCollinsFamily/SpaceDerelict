/**
 * YOKE as a Living Avatar (Collins, Sep 29 2026: "we will use the rfab living avatar
 * system to make her something the player can chat with and she will feel real").
 *
 * On rfab.ai she is an AVATAR: a brain (an agent that runs on content/lore/yoke-brain.md),
 * a body (clips, one per expression) and a voice. This file is the game's side of that,
 * with no screen in it, so that all of it can be tested:
 *
 *   what she is told      his line, with the SHIP LOG in front of it (the campaign so far)
 *   what she answers      events on a stream, a sentence at a time, each with an emotion
 *   which clip she wears  the emotion's, or the nearest one her body has
 *   when she cannot       the ladder: the avatar, then Kimi, then the scripted YOKE
 *
 * The rule of the ladder is that the player never hears about the machinery. Why she did
 * not answer goes to the console, once, and she answers from the next rung.
 */
import idsRaw from '../../content/lore/yoke-avatar.json?raw';
import type { AiContext, AiTrigger, AiTurn, ShipAiProvider } from './shipAi';
import { cutKindOf, type CutKind, type PlayerLink } from './yokePlayer';

// ---------------------------------------------------------------------------
// Who she is on rfab.ai
// ---------------------------------------------------------------------------

export interface YokeAvatarIds { avatarId: string; agentId?: string; liveModelId?: string; voiceId?: string; createdAt?: string }

/** The ids in content/lore/yoke-avatar.json, or null when the file names no avatar. */
export function avatarIdsFrom(raw: unknown): YokeAvatarIds | null {
  let v = raw;
  if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch { return null; } }
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  // An id is letters, digits and dashes. Anything else is a mistake in the file, and would become part of an address.
  if (typeof o.avatarId !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(o.avatarId)) return null;
  const text = (k: string) => (typeof o[k] === 'string' && o[k] ? (o[k] as string) : undefined);
  return { avatarId: o.avatarId, agentId: text('agentId'), liveModelId: text('liveModelId'), voiceId: text('voiceId'), createdAt: text('createdAt') };
}

export const YOKE_AVATAR: YokeAvatarIds | null = avatarIdsFrom(idsRaw);

// ---------------------------------------------------------------------------
// The ship log: what she is told with every line, and what he is never shown
// ---------------------------------------------------------------------------

const LOG_OPENS = '<<SHIP LOG.';
const LOG_CLOSES = '>>';
/** His words cannot open or close a log of their own. */
const plain = (t: string) => t.replace(/<<|>>/g, '"').replace(/\s+/g, ' ').trim();

/**
 * One message to her. The avatar API takes a message and nothing else, so the campaign
 * summary travels in front of his line, in a block her brain text tells her how to read.
 * When he has said nothing (she opens a discussion), the block says so and stands alone.
 */
export function wrapMessage(m: { trigger: AiTrigger; summary: string; line?: string }): string {
  const said = plain(m.line ?? '');
  const log = [
    `${LOG_OPENS} Only YOKE reads this; he did not say it.`,
    `Topic: ${m.trigger}.`,
    plain(m.summary),
    said ? '' : 'He has said nothing: you speak first.',
    LOG_CLOSES,
  ].filter(Boolean).join(' ');
  return said ? `${log}\n${said}` : log;
}

/** A message as it was sent, with the ship log taken out: what he said, or nothing. */
export function stripContext(text: string): string {
  return String(text ?? '').replace(/<<SHIP LOG\.[\s\S]*?(>>|$)/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
}

/**
 * What of her words may be shown. She is told never to quote the log; a model does what it
 * is told most of the time. Her reply comes a sentence at a time, so a quoted log arrives
 * in pieces: from the sentence that opens one to the sentence that closes it, nothing is
 * shown.
 */
export class Shown {
  private inside = false;
  /** The part of a sentence that may be shown, or '' when none of it may. */
  of(sentence: string): string {
    let out = '';
    let rest = String(sentence ?? '');
    for (;;) {
      if (this.inside) {
        const end = rest.indexOf(LOG_CLOSES);
        if (end < 0) return out.trim();
        this.inside = false;
        rest = rest.slice(end + LOG_CLOSES.length);
      } else {
        const start = rest.search(/<<\s*SHIP LOG/i);
        if (start < 0) return (out + rest).replace(/\s+/g, ' ').trim();
        out += rest.slice(0, start);
        this.inside = true;
        rest = rest.slice(start + 2);
      }
    }
  }
  /** A new reply begins: a log that was never closed does not swallow it. */
  reset(): void { this.inside = false; }
}

// ---------------------------------------------------------------------------
// Her events
// ---------------------------------------------------------------------------

export type YokeEvent =
  | { kind: 'speech'; text: string; emotion: string | null; motion: string | null }
  | { kind: 'motion'; state: string }
  | { kind: 'phase'; phase: string }
  /** She will not answer this one: out of tokens (`money`), or her mind stopped. */
  | { kind: 'stopped'; money: boolean; reason: string };

const stateName = (v: unknown): string | null => (typeof v === 'string' && /^[a-z0-9_]{1,40}$/i.test(v.trim()) ? v.trim().toLowerCase() : null);

/** One event of GET /api/avatars/:id/events (services/avatarEmbodimentService.js), or null for what is not ours. */
export function parseEvent(data: string): YokeEvent | null {
  let e: Record<string, unknown>;
  try { e = JSON.parse(data); } catch { return null; }
  if (!e || typeof e !== 'object') return null;
  switch (e.type) {
    case 'speech': {
      const text = typeof e.text === 'string' ? e.text.replace(/\s+/g, ' ').trim() : '';
      return text ? { kind: 'speech', text, emotion: stateName(e.emotion), motion: stateName(e.motion) } : null;
    }
    case 'motion': {
      const state = stateName(e.state);
      return state ? { kind: 'motion', state } : null;
    }
    case 'avatar_phase':
      return typeof e.phase === 'string' ? { kind: 'phase', phase: e.phase } : null;
    case 'agent_status': {
      // A dead voice or a closed show are the affairs of a live stream; her words still come.
      if (e.kind !== 'low_balance_warning' && e.kind !== 'error') return null;
      const reason = typeof e.text === 'string' ? e.text : String(e.kind);
      return { kind: 'stopped', money: e.kind === 'low_balance_warning' || /insufficient|balance|token/i.test(reason), reason };
    }
    case 'speech_blocked':
      return { kind: 'stopped', money: false, reason: `held back: ${String(e.reason ?? 'no reason given')}` };
    default:
      return null;
  }
}

/** The stream is text: "data: {...}" lines, a blank line between events, ":" lines to keep it open. */
export class EventLines {
  private rest = '';
  private data: string[] = [];
  push(chunk: string): Array<{ data?: string; retry?: number }> {
    const out: Array<{ data?: string; retry?: number }> = [];
    this.rest += chunk;
    for (;;) {
      const at = this.rest.search(/\r?\n/);
      if (at < 0) break;
      const line = this.rest.slice(0, at);
      this.rest = this.rest.slice(at + (this.rest[at] === '\r' ? 2 : 1));
      if (line === '') {
        if (this.data.length) out.push({ data: this.data.join('\n') });
        this.data = [];
      } else if (line.startsWith('data:')) {
        this.data.push(line.slice(5).replace(/^ /, ''));
      } else if (line.startsWith('retry:')) {
        const ms = Number(line.slice(6).trim());
        if (Number.isFinite(ms) && ms >= 0) out.push({ retry: ms });
      }
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Her clips
// ---------------------------------------------------------------------------

/** public/art/ship/yoke/manifest.json (tools/art/templates/yoke.mjs writes it). */
export interface YokeBody {
  states: Record<string, string>;
  oneShot: string[];
  seconds?: Record<string, number>;
}

/**
 * When she names a face her body does not have, the nearest one it has. Her mind is told
 * which faces exist, and names another now and then all the same.
 */
const NEAREST: Record<string, string[]> = {
  calm: ['idle'], neutral: ['idle'], idle: ['calm'],
  thoughtful: ['thinking'], thinking: ['thoughtful'], pensive: ['thinking'], confused: ['thinking', 'surprised'],
  curious: ['surprised', 'thinking'], surprised: ['thinking'], shocked: ['surprised'],
  happy: [], amused: ['happy'], pleased: ['happy'], joy: ['happy'], excited: ['happy', 'surprised'], proud: ['happy'],
  laughing: ['happy'], laugh: ['laughing', 'happy'], celebrating: ['laughing', 'happy'],
  sad: [], concerned: ['sad'], worried: ['sad'], disappointed: ['sad'], empathetic: ['sad'], lonely: ['sad'],
  angry: [], stern: ['angry'], annoyed: ['angry'], cold: ['angry'],
  blushing: ['happy'], shy: ['blushing'], embarrassed: ['blushing'], flustered: ['blushing'],
  teasing: ['wink', 'happy'], playful: ['wink', 'happy'], mischievous: ['wink', 'happy'],
  nod: [], shake_head: [], wink: ['happy'], wave: ['nod'],
};

/** The clip for a face or a gesture she named: itself, the nearest her body has, or her rest. */
export function clipFor(name: string | null | undefined, have: readonly string[], rest = 'idle'): string | null {
  const has = (s: string) => have.includes(s);
  const n = (name ?? '').trim().toLowerCase();
  if (n && has(n)) return n;
  const near = NEAREST[n] ?? [];
  for (const a of near) if (has(a)) return a;
  for (const a of near) for (const b of NEAREST[a] ?? []) if (has(b)) return b;
  if (has(rest)) return rest;
  return have[0] ?? null;
}

/**
 * The clip while her voice sounds. RFab's own rule (Simone, Sep 15 2026): while she speaks
 * only a talking clip is on stage, the face's own talking twin if it has one, else the
 * plain talking clip. A body with neither keeps the face.
 */
export function voiceClip(emotion: string | null | undefined, have: readonly string[]): string | null {
  const face = clipFor(emotion, have);
  if (face && have.includes(`${face}_talk`)) return `${face}_talk`;
  if (have.includes('speaking')) return 'speaking';
  return face;
}

// ---------------------------------------------------------------------------
// The link to rfab.ai
// ---------------------------------------------------------------------------

/** Why she could not be reached. Never shown to the player. */
export class AvatarError extends Error {
  constructor(readonly status: number, readonly code: string | undefined, message: string) { super(message); }
  /** It will not mend itself this session (no key, not hers to talk to, no such avatar): stop asking. */
  get sticky(): boolean { return this.status === 401 || this.status === 403 || this.status === 404; }
}

/** For the console: one short line per kind of failure. */
export function avatarReason(err: unknown): string {
  if (err instanceof AvatarError) {
    if (err.status === 0) return 'rfab.ai is unreachable';
    if (err.status === 401 || err.status === 403) return `rfab.ai refused the key (${err.status})`;
    if (err.status === 402) return 'the RFab account is out of tokens (402)';
    if (err.status === 404) return 'rfab.ai has no such avatar (404)';
    if (err.status === 408) return 'she did not answer in time';
    return `rfab.ai answered ${err.status}${err.message ? `: ${err.message}` : ''}`;
  }
  return `rfab.ai is unreachable (${String((err as Error)?.message ?? err)})`;
}

export interface AvatarLinkOptions {
  /** API root: '/rfab-api' (the game's own proxy, which adds the key) or https://api.rfab.ai. */
  base: string;
  avatarId: string;
  /** The player's own RFab key; none behind the proxy. */
  key?: string;
  /**
   * The player's link (src/meta/yokePlayer.ts, Sep 30 2026): she is then HIS private YOKE on
   * /api/broodfall/yoke, paid by the house up to $3 and by his own RFab account once linked.
   * Without it (or on an RFab that has no such route yet) she is the avatar's own star.
   */
  player?: PlayerLink;
  fetcher?: typeof fetch;
}

export interface Listening {
  /** Settles when the stream first opens: null, or why it did not. */
  ready: Promise<AvatarError | null>;
  stop(): void;
}

export class AvatarLink {
  private fetcher: typeof fetch;
  constructor(private o: AvatarLinkOptions) { this.fetcher = o.fetcher ?? ((...a) => fetch(...a)); }

  /** His own YOKE (the player route), not the avatar's star. */
  private get mine(): boolean { return !!this.o.player && !this.o.player.legacy; }

  private url(tail: string): string {
    const base = this.o.base.replace(/\/$/, '');
    return this.mine ? `${base}/api/broodfall/yoke${tail}` : `${base}/api/avatars/${encodeURIComponent(this.o.avatarId)}${tail}`;
  }

  private headers(json: boolean): Record<string, string> {
    if (this.mine) return this.o.player!.headers(json);
    const h: Record<string, string> = {};
    if (json) h['Content-Type'] = 'application/json';
    if (this.o.key) h['X-API-Key'] = this.o.key;
    return h;
  }

  /** A player is registered before his first call (and the link learns whether rfab.ai has the route at all). */
  private async ready(): Promise<void> {
    if (this.o.player && !this.o.player.legacy) await this.o.player.ensure();
  }

  private async ask(tail: string, init: RequestInit): Promise<Response> {
    await this.ready();
    // The headers are made again after ready(): the player's token may have only just been issued.
    const withAuth: RequestInit = { ...init, headers: { ...(init.headers as Record<string, string> | undefined), ...this.headers(!!init.body) } };
    let res: Response;
    try { res = await this.fetcher(this.url(tail), withAuth); } catch { throw new AvatarError(0, 'NETWORK', 'rfab.ai is unreachable'); }
    if (res.ok) return res;
    let body: { error?: string; code?: string } | null = null;
    try { body = await res.json(); } catch { /* a proxy page, or an HTML 404 */ }
    throw new AvatarError(res.status, body?.code, body?.error ?? '');
  }

  /** The last turns of his talk with her, with every ship log taken out. */
  async history(): Promise<AiTurn[]> {
    const res = await this.ask('/history', { headers: this.headers(false) });
    let body: { turns?: unknown } | null = null;
    try { body = await res.json(); } catch { throw new AvatarError(502, 'NOT_JSON', 'the history was not JSON'); }
    return turnsFrom(body?.turns);
  }

  async send(message: string): Promise<void> {
    await this.ask('/message', { method: 'POST', headers: this.headers(true), body: JSON.stringify({ message }) });
  }

  /** One sentence in her voice (audio/mpeg). Billed to the avatar's owner by the character. */
  async speak(text: string): Promise<ArrayBuffer> {
    const res = await this.ask('/speak', { method: 'POST', headers: this.headers(true), body: JSON.stringify({ text: text.slice(0, MAX_SPOKEN) }) });
    return res.arrayBuffer();
  }

  /**
   * Follow her events until stop(). Read with fetch and not with EventSource: fetch says
   * WHY a stream was refused (401, 404), and can carry the player's own key.
   */
  listen(onEvent: (e: YokeEvent) => void, onLost: (err: AvatarError) => void, wait: (ms: number) => Promise<void> = sleep): Listening {
    const ctl = typeof AbortController === 'undefined' ? null : new AbortController();
    let stopped = false;
    let opened = false;
    let retry = 3000;
    let settle: (v: AvatarError | null) => void = () => {};
    const ready = new Promise<AvatarError | null>((r) => { settle = r; });
    const lost = (err: AvatarError) => { settle(err); if (!stopped) onLost(err); };
    const run = async () => {
      let drops = 0;
      await this.ready();
      while (!stopped) {
        let res: Response;
        try {
          res = await this.fetcher(this.url('/events'), { headers: { Accept: 'text/event-stream', ...this.headers(false) }, signal: ctl?.signal });
        } catch {
          if (stopped) return;
          // Never opened: there is no network. Opened before: a drop, and the next try may mend it.
          if (!opened || ++drops > 4) return lost(new AvatarError(0, 'NETWORK', 'rfab.ai is unreachable'));
          await wait(retry);
          continue;
        }
        if (!res.ok || !res.body) return lost(new AvatarError(res.ok ? 502 : res.status, undefined, res.ok ? 'the stream has no body' : ''));
        opened = true;
        drops = 0;
        settle(null);
        const lines = new EventLines();
        const text = new TextDecoder();
        const reader = res.body.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            for (const m of lines.push(text.decode(value, { stream: true }))) {
              if (m.retry !== undefined) retry = Math.max(200, m.retry);
              const e = m.data ? parseEvent(m.data) : null;
              if (e && !stopped) onEvent(e);
            }
          }
        } catch { /* the stream was cut: open it again */ }
        if (stopped) return;
        await wait(retry);
      }
    };
    void run();
    return { ready, stop: () => { stopped = true; settle(null); try { ctl?.abort(); } catch { /* already closed */ } } };
  }
}

/** POST /speak takes at most this many characters (routes/avatars.js, MAX_SPEAK_CHARS). */
export const MAX_SPOKEN = 1500;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** GET /history gives {who, text}: 'you' and 'them' are the talk; 'memory' and 'heard' are her own and not shown. */
export function turnsFrom(raw: unknown): AiTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: AiTurn[] = [];
  const shown = new Shown();
  for (const t of raw as Array<{ who?: unknown; text?: unknown }>) {
    if (!t || typeof t.text !== 'string') continue;
    if (t.who === 'you') {
      const said = stripContext(t.text);
      if (said) turns.push({ speaker: 'You', text: said });
    } else if (t.who === 'them') {
      shown.reset();
      const said = shown.of(t.text);
      if (said) turns.push({ speaker: 'YOKE', text: said });
    }
  }
  return turns;
}

// ---------------------------------------------------------------------------
// One exchange: his line, her sentences
// ---------------------------------------------------------------------------

export interface TalkHooks {
  /** A sentence of hers, as it arrives. */
  onSentence?(text: string, emotion: string | null): void;
  /** A gesture, at its place between her sentences. */
  onMotion?(state: string): void;
  /** She has begun to think, or has stopped. */
  onThinking?(on: boolean): void;
}

export interface TalkTimes {
  /** How long she may take to begin. A mind on rfab.ai begins within ten seconds; one that has not begun in this long will not. */
  firstWithinMs: number;
  /** Her events carry no "I have finished". She has, when nothing has come for this long. */
  quietMs: number;
}

interface Asking {
  lines: string[];
  done(lines: string[]): void;
  fail(err: AvatarError): void;
  first: ReturnType<typeof setTimeout> | null;
  quiet: ReturnType<typeof setTimeout> | null;
}

export class AvatarTalk {
  private listening: Listening | null = null;
  private asking: Asking | null = null;
  private shown = new Shown();
  private times: TalkTimes;
  /** What happens to a sentence that comes when nothing was asked (a late one, or one she began herself). */
  onUnasked: (text: string, emotion: string | null) => void = () => {};
  /** The stream was lost for good. */
  onLost: (err: AvatarError) => void = () => {};

  constructor(readonly link: AvatarLink, private hooks: TalkHooks = {}, times: Partial<TalkTimes> = {}) {
    this.times = { firstWithinMs: 45000, quietMs: 3000, ...times };
  }

  get open(): boolean { return !!this.listening; }

  /** Come into her room: is she there, what was said before, and her stream. Throws AvatarError when she is not. */
  async enter(): Promise<AiTurn[]> {
    const turns = await this.link.history();
    if (!this.listening) {
      const l = this.link.listen((e) => this.on(e), (err) => this.lost(err));
      this.listening = l;
      const err = await l.ready;
      if (err) { this.leave(); throw err; }
    }
    return turns;
  }

  leave(): void {
    this.listening?.stop();
    this.listening = null;
    this.settle(null, new AvatarError(0, 'LEFT', 'he left the room'));
  }

  /** Say a line to her (or, with no line, have her open a topic). Resolves with all she said. */
  async ask(message: string): Promise<string[]> {
    if (!this.listening) throw new AvatarError(0, 'NOT_LISTENING', 'her stream is not open');
    // One exchange at a time: what she was still saying to the last line belongs to it.
    this.settle(this.asking?.lines ?? null, null);
    this.shown.reset();
    const asked = new Promise<string[]>((done, fail) => {
      this.asking = { lines: [], done, fail, first: null, quiet: null };
    });
    const mine = this.asking!;
    this.hooks.onThinking?.(true);
    mine.first = setTimeout(() => { if (this.asking === mine) this.settle(null, new AvatarError(408, 'NO_ANSWER', 'she did not answer in time')); }, this.times.firstWithinMs);
    try {
      await this.link.send(message);
    } catch (err) {
      if (this.asking === mine) this.settle(null, err instanceof AvatarError ? err : new AvatarError(0, 'NETWORK', 'rfab.ai is unreachable'));
    }
    return asked;
  }

  private on(e: YokeEvent): void {
    const a = this.asking;
    if (e.kind === 'speech') {
      const text = this.shown.of(e.text);
      if (!text) return;
      if (!a) { this.onUnasked(text, e.emotion); return; }
      if (a.first) { clearTimeout(a.first); a.first = null; this.hooks.onThinking?.(false); }
      a.lines.push(text);
      this.hooks.onSentence?.(text, e.emotion);
      if (e.motion) this.hooks.onMotion?.(e.motion);
      if (a.quiet) clearTimeout(a.quiet);
      a.quiet = setTimeout(() => { if (this.asking === a) this.settle(a.lines, null); }, this.times.quietMs);
    } else if (e.kind === 'motion') {
      this.hooks.onMotion?.(e.state);
    } else if (e.kind === 'stopped') {
      if (!a) return;
      // What she had said before her mind stopped is kept; if she had said nothing, the next rung answers.
      if (a.lines.length) this.settle(a.lines, null);
      else this.settle(null, new AvatarError(e.money ? 402 : 502, e.money ? 'INSUFFICIENT_TOKENS' : 'MIND_STOPPED', e.reason));
    }
  }

  private lost(err: AvatarError): void {
    this.listening = null;
    this.settle(this.asking?.lines.length ? this.asking.lines : null, err);
    this.onLost(err);
  }

  private settle(lines: string[] | null, err: AvatarError | null): void {
    const a = this.asking;
    if (!a) return;
    this.asking = null;
    if (a.first) clearTimeout(a.first);
    if (a.quiet) clearTimeout(a.quiet);
    this.hooks.onThinking?.(false);
    if (lines && lines.length) a.done(lines);
    else a.fail(err ?? new AvatarError(502, 'EMPTY', 'she said nothing'));
  }
}

// ---------------------------------------------------------------------------
// The ladder
// ---------------------------------------------------------------------------

export type YokeMode = 'avatar' | 'kimi' | 'scripted';

/** The rungs a mode may stand on, best first. A mode never climbs: scripted stays scripted (it spends nothing). */
export function rungs(mode: YokeMode, hasAvatar: boolean): YokeMode[] {
  if (mode === 'scripted') return ['scripted'];
  if (mode === 'kimi' || !hasAvatar) return ['kimi', 'scripted'];
  return ['avatar', 'kimi', 'scripted'];
}

/**
 * YOKE, whoever is answering. The avatar is asked first; when she cannot answer, the rest
 * of the ladder does (FallbackShipAi: Kimi, then the scripted YOKE), and the player is told
 * nothing. The reason is written to the console, once for each kind.
 */
export class YokeLadder implements ShipAiProvider {
  private off = false;
  private told = new Set<string>();
  /**
   * Nobody pays for her mind any more (Sep 30 2026): the player's free talk is spent, his RFab
   * account is short, or the house is closed. Her live mind is not asked again until
   * `uncut()` (he linked an account, or topped up); meanwhile she says `cutOff`'s words once,
   * then the scripted YOKE answers, which costs nothing and needs no network.
   */
  cut: CutKind | null = null;
  private cutSaid = false;
  /** Her words when the money stops. */
  cutOff: (kind: CutKind) => string[] = () => [];
  /** The screen is told (it shows the link prompt). */
  onCut: (kind: CutKind) => void = () => {};

  constructor(
    private avatar: AvatarTalk | null,
    private rest: ShipAiProvider,
    private tell: (line: string) => void = (l) => console.warn(l),
    /** Who answers while she is cut off: never the network. */
    private free: ShipAiProvider | null = null,
  ) {
    if (avatar) avatar.onLost = (err) => this.note(err);
  }

  /** Money is back (linked, topped up): her live mind answers again. */
  uncut(): void { this.cut = null; this.cutSaid = false; }

  /** The server said nobody pays: she says so once, the screen is told. */
  cutNow(kind: CutKind): string[] {
    const first = this.cut !== kind || !this.cutSaid;
    this.cut = kind;
    this.cutSaid = true;
    this.onCut(kind);
    return first ? this.cutOff(kind) : [];
  }

  /** The avatar is the one answering. */
  get live(): boolean { return !!this.avatar && !this.off && this.avatar.open; }

  /** Come into her room. False when she is not there: the rest of the ladder is YOKE then. */
  async enter(): Promise<AiTurn[] | null> {
    if (!this.avatar || this.off) return null;
    try { return await this.avatar.enter(); } catch (err) { this.note(err); return null; }
  }

  leave(): void { this.avatar?.leave(); }

  async reply(ctx: AiContext, history: AiTurn[], playerLine?: string): Promise<string[]> {
    if (this.avatar && !this.off) {
      try {
        if (!this.avatar.open) await this.avatar.enter();
        return await this.avatar.ask(wrapMessage({ trigger: ctx.trigger, summary: ctx.summary, line: playerLine }));
      } catch (err) {
        // He walked out while she was thinking: nobody is there to answer, on any rung.
        if (err instanceof AvatarError && err.code === 'LEFT') return [];
        this.note(err);
      }
    }
    return this.rest.reply(ctx, history, playerLine);
  }

  private note(err: unknown): void {
    if (err instanceof AvatarError && err.code === 'LEFT') return;
    if (err instanceof AvatarError && err.sticky) this.off = true;
    const why = avatarReason(err);
    if (this.told.has(why)) return;
    this.told.add(why);
    this.tell(`[YOKE] the avatar did not answer, the next rung does: ${why}`);
  }
}
