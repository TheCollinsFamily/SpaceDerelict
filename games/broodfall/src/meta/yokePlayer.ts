/**
 * The player's own link to YOKE on rfab.ai (Collins, Sep 30 2026: "cut off AI interactions once
 * a user has spent more than $3 worth of tokens, prompt them to connect it to an RFab account,
 * which will give them free tokens to more than double their interactions, and from that point
 * on token use drains from RFab, but they will also have the option to change the model she
 * runs on").
 *
 * No screen here, so all of it can be tested. The backend is /api/broodfall/yoke (RFab,
 * routes/broodfallYoke.js): the game registers once and keeps a PLAYER TOKEN (the only thing it
 * ever holds: never a login, never an RFab API key). Until the player links an account, the
 * Broodfall house pays for her, up to $3 of real billed tokens; the server alone decides when
 * that is spent. Linking is a device code: the game shows a short code, the player approves it
 * on rfab.ai/connect, and the game collects a new token bound to that account.
 */

/** The server's view of this player (GET /api/broodfall/yoke/state). */
export interface YokeModelRow { id: string; label: string; blurb?: string; isDefault?: boolean; exchangeTokens: number | null; exchangeUsd: number | null }
export interface YokeAllowance { capTokens: number; spentTokens: number; remainingTokens: number; spent: boolean; /** 'network': the free talk every game on this address shares is spent. */ why?: string }
export interface YokeAccountState {
  playerId: string;
  connected: boolean;
  account: { name: string | null; balanceTokens: number | null; topUpUrl: string } | null;
  allowance: YokeAllowance;
  houseReady: boolean;
  bonusTokens: number;
  bonusReceived: number;
  connectUrl: string;
  model: { id: string; label: string };
  models: YokeModelRow[];
}

export interface ConnectCode { deviceCode: string; userCode: string; verifyUrl: string; verifyUrlComplete: string; expiresIn: number; interval: number; bonusTokens?: number }
export type ConnectPoll = { status: 'pending' } | { status: 'expired' } | { status: 'connected'; bonus?: { tokens: number; note: string | null } };

/** Why she will not answer on the house any more, from a refusal of the server. */
export type CutKind = 'allowance' | 'topup' | 'resting';

export class PlayerError extends Error {
  constructor(readonly status: number, readonly code: string | undefined, message: string, readonly body: Record<string, unknown> | null = null) { super(message); }
}

/** A refusal of hers that means money, and which: the allowance is spent, the account is short, or the house is closed. */
export function cutKindOf(status: number, code: string | undefined): CutKind | null {
  if (status === 402 && code === 'GUEST_ALLOWANCE_SPENT') return 'allowance';
  if (status === 402 && code === 'INSUFFICIENT_TOKENS') return 'topup';
  if (status === 503 && (code === 'HOUSE_BUDGET_EMPTY' || code === 'HOUSE_UNAVAILABLE')) return 'resting';
  return null;
}

/** Where the token lives (src/meta/storage.ts gives the real one). */
export interface TokenStore { load(): string | null; save(token: string): void; clear(): void }

export interface PlayerLinkOptions {
  /** API root: '/rfab-api' in the dev server (its proxy), https://api.rfab.ai in a player's build. */
  base: string;
  store: TokenStore;
  fetcher?: typeof fetch;
}

/**
 * The player's link. `legacy`: the RFab this talks to has no /api/broodfall/yoke yet (its
 * deploy is owed): the game then talks to her the old way (the dev proxy's key, the avatar
 * owner's star) and shows no account at all.
 */
export class PlayerLink {
  private fetcher: typeof fetch;
  private registering: Promise<string | null> | null = null;
  legacy = false;
  last: YokeAccountState | null = null;

  constructor(private o: PlayerLinkOptions) { this.fetcher = o.fetcher ?? ((...a) => fetch(...a)); }

  get base(): string { return this.o.base.replace(/\/$/, ''); }
  get token(): string | null { return this.o.store.load(); }
  get connected(): boolean { return !!this.last?.connected; }

  private url(tail: string): string { return `${this.base}/api/broodfall/yoke${tail}`; }

  headers(json = false): Record<string, string> {
    const h: Record<string, string> = {};
    if (json) h['Content-Type'] = 'application/json';
    const t = this.token;
    if (t) h['X-Broodfall-Player'] = t;
    return h;
  }

  private async call<T>(tail: string, init: RequestInit = {}, auth = true): Promise<T> {
    let res: Response;
    try {
      res = await this.fetcher(this.url(tail), { ...init, headers: { ...(auth ? this.headers(!!init.body) : init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers as Record<string, string> ?? {}) } });
    } catch {
      throw new PlayerError(0, 'NETWORK', 'rfab.ai is unreachable');
    }
    let body: Record<string, unknown> | null = null;
    try { body = await res.json(); } catch { /* an HTML 404: the route is not there */ }
    if (!res.ok) throw new PlayerError(res.status, typeof body?.code === 'string' ? body.code : undefined, typeof body?.error === 'string' ? body.error : '', body);
    return (body ?? {}) as T;
  }

  /** The token, registering a new player the first time. Null when rfab.ai cannot give one (legacy, a cap, no network). */
  async ensure(): Promise<string | null> {
    if (this.token) return this.token;
    if (this.legacy) return null;
    this.registering ??= (async () => {
      try {
        const r = await this.call<{ token?: string; state?: YokeAccountState }>('/players', { method: 'POST', body: '{}' }, false);
        if (typeof r.token === 'string' && r.token) {
          this.o.store.save(r.token);
          if (r.state) this.last = r.state;
          return r.token;
        }
        return null;
      } catch (err) {
        if (err instanceof PlayerError && err.status === 404) this.legacy = true;
        return null;
      } finally {
        this.registering = null;
      }
    })();
    return this.registering;
  }

  /** The account state; a token the server no longer knows is dropped and a new player made (once). */
  async state(): Promise<YokeAccountState | null> {
    if (!(await this.ensure())) return null;
    try {
      this.last = await this.call<YokeAccountState>('/state');
      return this.last;
    } catch (err) {
      if (err instanceof PlayerError && err.status === 401) {
        this.o.store.clear();
        if (!(await this.ensure())) return null;
        this.last = await this.call<YokeAccountState>('/state');
        return this.last;
      }
      if (err instanceof PlayerError && err.status === 404) this.legacy = true;
      throw err;
    }
  }

  async startConnect(): Promise<ConnectCode> {
    await this.ensure();
    return this.call<ConnectCode>('/connect/start', { method: 'POST', body: '{}' });
  }

  /** One look at the code. On approval the connected token replaces the guest one. */
  async pollConnect(deviceCode: string): Promise<ConnectPoll> {
    const r = await this.call<{ status: string; token?: string; bonus?: { tokens: number; note: string | null } }>('/connect/poll', { method: 'POST', body: JSON.stringify({ deviceCode }) }, false);
    if (r.status === 'connected' && typeof r.token === 'string') {
      this.o.store.save(r.token);
      return { status: 'connected', bonus: r.bonus };
    }
    return r.status === 'expired' ? { status: 'expired' } : { status: 'pending' };
  }

  async setModel(id: string): Promise<{ id: string; label: string }> {
    const r = await this.call<{ model: { id: string; label: string } }>('/model', { method: 'PUT', body: JSON.stringify({ model: id }) });
    if (this.last) this.last = { ...this.last, model: r.model };
    return r.model;
  }

  async disconnect(): Promise<void> {
    await this.call('/disconnect', { method: 'POST', body: '{}' });
  }
}

/**
 * Waits for the player to approve the code on rfab.ai. Polls every `interval` seconds until
 * approved, expired, or stopped; a dropped network is tried again (the code still lives).
 */
export function watchConnect(link: PlayerLink, code: ConnectCode, on: { connected(bonus?: { tokens: number; note: string | null }): void; expired(): void }, wait: (ms: number) => Promise<void> = sleep): { stop(): void } {
  let stopped = false;
  let told = false;
  const until = Date.now() + code.expiresIn * 1000;
  void (async () => {
    while (!stopped) {
      await wait(Math.max(2, code.interval || 5) * 1000);
      if (stopped) return;
      try {
        const r = await link.pollConnect(code.deviceCode);
        if (stopped) return;
        if (r.status === 'connected') { on.connected(r.bonus); return; }
        if (r.status === 'expired') { on.expired(); return; }
      } catch (err) {
        if (!told) { told = true; console.warn(`[YOKE] the link code could not be checked, trying again: ${String((err as Error)?.message ?? err)}`); }
        if (Date.now() > until) { on.expired(); return; }
      }
    }
  })();
  return { stop: () => { stopped = true; } };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ words for the screen

const TOKENS_PER_DOLLAR = 50000;

export function dollars(tokens: number): string {
  const d = Math.max(0, tokens) / TOKENS_PER_DOLLAR;
  return `$${d.toFixed(2)}`;
}

export function tokensText(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString('en-US');
}

/** "$2.41 of $3.00 left" — the meter's words. */
export function allowanceText(a: YokeAllowance): string {
  return `${dollars(a.remainingTokens)} of ${dollars(a.capTokens)} left`;
}

/** 0..1, how much of the free talk is left. */
export function allowanceLeft(a: YokeAllowance): number {
  return a.capTokens > 0 ? Math.max(0, Math.min(1, a.remainingTokens / a.capTokens)) : 0;
}

/** "~1,270 tokens (~$0.03) a reply" — a picker row's price. */
export function costText(m: YokeModelRow): string {
  if (!m.exchangeTokens) return 'price on rfab.ai';
  const usd = m.exchangeUsd ?? m.exchangeTokens / TOKENS_PER_DOLLAR;
  return `~${tokensText(m.exchangeTokens)} tokens (~$${usd < 0.01 ? usd.toFixed(3) : usd.toFixed(2)}) a reply`;
}

/** How many more replies the bonus buys over the free talk, on the default model: "more than double". */
export function bonusTimes(bonusTokens: number, capTokens: number): number {
  return capTokens > 0 ? Math.round((bonusTokens / capTokens) * 10) / 10 : 0;
}

/**
 * What she says when the free talk is spent — in her voice, but the offer is stated plainly
 * (it is the one thing in the game that concerns the player's real money).
 */
export function cutOffLines(kind: CutKind, bonusTokens: number, capTokens: number): string[] {
  if (kind === 'topup') {
    return [
      'Your RFab account is dry, Operator. I cannot think on credit.',
      'Top it up on rfab.ai and I am back.',
    ];
  }
  if (kind === 'resting') {
    return ['The ship has stopped paying for my conversation today. Link your own RFab account and I will keep talking.'];
  }
  return [
    'That is the end of what the Directorate pays for my conversation. They do not fund chat.',
    `Link your own RFab account and they add ${tokensText(bonusTokens)} free tokens (${dollars(bonusTokens)}) — ${bonusTimes(bonusTokens, capTokens)} times what we have used. After that I run on your account, on whichever mind you pick for me.`,
  ];
}
