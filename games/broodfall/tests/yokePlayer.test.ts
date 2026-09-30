/**
 * The player's own link to YOKE (src/meta/yokePlayer.ts) and the money cut-off in her ladder
 * (src/meta/yokeAvatar.ts). No network: rfab.ai is a fake here.
 *
 * What is held: a player is registered once and keeps only a player token; her calls go to the
 * player route with that token and never with an RFab key; an RFab without the route (its
 * deploy owed) is talked to the old way; when the server says nobody pays (the $3 is spent, the
 * linked account is short) she says so ONCE and no other paid rung is asked; linking stores
 * the connected token; the words for the screen state the bonus plainly. Her memory is per
 * campaign: every call names it. The owner's own YOKE (the owed-deploy fallback) is for the dev
 * server on this PC only.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  PlayerLink, allowanceText, bonusTimes, costText, cutKindOf, cutOffLines, memoryText, watchConnect,
  type TokenStore,
} from '../src/meta/yokePlayer';
import { AvatarError, AvatarLink, AvatarTalk, OWNER_YOKE_DEV_ONLY, YokeLadder } from '../src/meta/yokeAvatar';
import { ownerYokeAllowed } from '../src/meta/storage';
import { RfabShipAi, ScriptedShipAi, type AiContext, type ShipAiProvider } from '../src/meta/shipAi';

const GUEST = `bfg_${'a'.repeat(43)}`;
const LINKED = `bfc_${'b'.repeat(43)}`;

function memStore(start: string | null = null): TokenStore & { value: string | null } {
  const s = { value: start, load: () => s.value, save: (t: string) => { s.value = t; }, clear: () => { s.value = null; } };
  return s;
}

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };
function fakeRfab(routes: Record<string, (c: Call) => { status: number; body?: unknown }>) {
  const calls: Call[] = [];
  const fetcher = (async (url: string, init: RequestInit = {}) => {
    const c: Call = { url: String(url), method: init.method ?? 'GET', headers: { ...(init.headers as Record<string, string> ?? {}) }, body: init.body as string | undefined };
    calls.push(c);
    const key = `${c.method} ${c.url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/rfab-api/, '')}`;
    const route = routes[key];
    const r = route ? route(c) : { status: 404, body: { error: 'Not Found' } };
    return new Response(r.body === undefined ? '' : JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

const STATE = {
  playerId: 'p1', connected: false, account: null, houseReady: true, bonusTokens: 400000, bonusReceived: 0,
  connectUrl: 'https://rfab.ai/connect', model: { id: 'openrouter:moonshotai/kimi-k2.6', label: 'Kimi K2.6' }, models: [],
  allowance: { capTokens: 150000, spentTokens: 30000, remainingTokens: 120000, spent: false },
};

describe('the player link', () => {
  it('registers once, keeps only the token, and sends it on every call', async () => {
    const store = memStore();
    const { fetcher, calls } = fakeRfab({
      'POST /api/broodfall/yoke/players': () => ({ status: 201, body: { token: GUEST, state: STATE } }),
      'GET /api/broodfall/yoke/state': () => ({ status: 200, body: STATE }),
    });
    const link = new PlayerLink({ base: '/rfab-api', store, fetcher });
    const [a, b] = await Promise.all([link.ensure(), link.ensure()]);
    expect(a).toBe(GUEST);
    expect(b).toBe(GUEST);
    expect(calls.filter((c) => c.url.endsWith('/players'))).toHaveLength(1);
    expect(store.value).toBe(GUEST);
    const s = await link.state();
    expect(s?.allowance.remainingTokens).toBe(120000);
    const st = calls.find((c) => c.url.endsWith('/state'))!;
    expect(st.headers['X-Broodfall-Player']).toBe(GUEST);
    expect(st.headers['X-API-Key']).toBeUndefined();
  });

  it('an RFab without the player route (its deploy owed) is legacy: no player, the old way', async () => {
    const { fetcher } = fakeRfab({});
    const link = new PlayerLink({ base: '/rfab-api', store: memStore(), fetcher });
    expect(await link.ensure()).toBeNull();
    expect(link.legacy).toBe(true);
  });

  it('rfab.ai refusing (429) or failing (5xx, no network): asked once, then not again this session', async () => {
    for (const status of [429, 503, 0]) {
      let calls = 0;
      const fetcher = (async () => {
        calls++;
        if (status === 0) throw new TypeError('network');
        return new Response('{}', { status, headers: { 'Content-Type': 'application/json' } });
      }) as unknown as typeof fetch;
      const info = vi.spyOn(console, 'info').mockImplementation(() => {});
      const link = new PlayerLink({ base: '/rfab-api', store: memStore(), fetcher });
      expect(await link.ensure()).toBeNull();
      expect(await link.ensure()).toBeNull();
      expect(link.legacy).toBe(true);
      expect(calls, String(status)).toBe(1);
      expect(info).toHaveBeenCalledTimes(1);
      info.mockRestore();
    }
  });

  it('a token the server forgot is dropped and a new player made', async () => {
    const store = memStore(GUEST);
    let n = 0;
    const { fetcher } = fakeRfab({
      'GET /api/broodfall/yoke/state': (c) => (c.headers['X-Broodfall-Player'] === GUEST ? { status: 401, body: { code: 'PLAYER_TOKEN_INVALID' } } : { status: 200, body: STATE }),
      'POST /api/broodfall/yoke/players': () => { n++; return { status: 201, body: { token: `bfg_${'c'.repeat(43)}` } }; },
    });
    const link = new PlayerLink({ base: '', store, fetcher });
    expect((await link.state())?.playerId).toBe('p1');
    expect(n).toBe(1);
    expect(store.value).toBe(`bfg_${'c'.repeat(43)}`);
  });

  it('linking: the code, the wait, then the connected token replaces the guest one', async () => {
    const store = memStore(GUEST);
    let polls = 0;
    const { fetcher, calls } = fakeRfab({
      'POST /api/broodfall/yoke/connect/start': () => ({ status: 200, body: { deviceCode: 'd'.repeat(43), userCode: 'BCDF-GHJK', verifyUrl: 'https://rfab.ai/connect', verifyUrlComplete: 'https://rfab.ai/connect?code=BCDF-GHJK', expiresIn: 900, interval: 5 } }),
      'POST /api/broodfall/yoke/connect/poll': () => (++polls < 3 ? { status: 200, body: { status: 'pending' } } : { status: 200, body: { status: 'connected', token: LINKED, bonus: { tokens: 400000, note: null } } }),
    });
    const link = new PlayerLink({ base: '', store, fetcher });
    const code = await link.startConnect();
    expect(code.userCode).toBe('BCDF-GHJK');
    const connected = vi.fn();
    await new Promise<void>((done) => {
      watchConnect(link, code, { connected: (b) => { connected(b); done(); }, expired: () => done() }, async () => {});
    });
    expect(connected).toHaveBeenCalledWith({ tokens: 400000, note: null });
    expect(store.value).toBe(LINKED);
    // The device code is the credential of the poll; the player token is not sent with it.
    expect(calls.find((c) => c.url.endsWith('/connect/poll'))!.headers['X-Broodfall-Player']).toBeUndefined();
  });

  it('an expired code says so', async () => {
    const { fetcher } = fakeRfab({ 'POST /api/broodfall/yoke/connect/poll': () => ({ status: 200, body: { status: 'expired' } }) });
    const link = new PlayerLink({ base: '', store: memStore(GUEST), fetcher });
    const expired = await new Promise<boolean>((done) => {
      watchConnect(link, { deviceCode: 'd'.repeat(43), userCode: 'X', verifyUrl: '', verifyUrlComplete: '', expiresIn: 900, interval: 5 }, { connected: () => done(false), expired: () => done(true) }, async () => {});
    });
    expect(expired).toBe(true);
  });
});

describe('her calls with a player', () => {
  it('go to /api/broodfall/yoke with the player token, never the avatar route or a key', async () => {
    const { fetcher, calls } = fakeRfab({
      'POST /api/broodfall/yoke/players': () => ({ status: 201, body: { token: GUEST } }),
      'POST /api/broodfall/yoke/message': () => ({ status: 200, body: { success: true } }),
      'GET /api/broodfall/yoke/history': () => ({ status: 200, body: { turns: [{ who: 'you', text: 'hi' }] } }),
    });
    const player = new PlayerLink({ base: '/rfab-api', store: memStore(), fetcher });
    const link = new AvatarLink({ base: '/rfab-api', avatarId: 'av-123456', key: 'rfab_should_not_be_sent', player, fetcher });
    await link.send('hello');
    expect(await link.history()).toEqual([{ speaker: 'You', text: 'hi' }]);
    const sent = calls.filter((c) => !c.url.endsWith('/players'));
    for (const c of sent) {
      expect(c.url).toMatch(/^\/rfab-api\/api\/broodfall\/yoke\//);
      expect(c.headers['X-Broodfall-Player']).toBe(GUEST);
      expect(c.headers['X-API-Key']).toBeUndefined();
    }
  });

  it('on a legacy RFab, ON THE DEV SERVER ONLY, they go to the owner\'s avatar route as before', async () => {
    const { fetcher, calls } = fakeRfab({ 'POST /api/avatars/av-123456/message': () => ({ status: 200, body: { success: true } }) });
    const player = new PlayerLink({ base: '/rfab-api', store: memStore(), fetcher });
    const link = new AvatarLink({ base: '/rfab-api', avatarId: 'av-123456', player, ownerFallback: true, fetcher });
    await link.send('hello');
    expect(player.legacy).toBe(true);
    expect(link.owners).toBe(true);
    expect(calls.at(-1)!.url).toBe('/rfab-api/api/avatars/av-123456/message');
  });

  it('on a legacy RFab anywhere else the owner\'s YOKE is refused: nothing goes to the avatar route, the ladder goes on', async () => {
    const { fetcher, calls } = fakeRfab({ 'POST /api/avatars/av-123456/message': () => ({ status: 200, body: { success: true } }) });
    const player = new PlayerLink({ base: 'https://api.rfab.ai', store: memStore(), fetcher });
    const link = new AvatarLink({ base: 'https://api.rfab.ai', avatarId: 'av-123456', player, fetcher });
    const err = await link.send('hello').catch((e) => e);
    expect(err).toBeInstanceOf(AvatarError);
    expect(err.code).toBe(OWNER_YOKE_DEV_ONLY);
    expect(err.sticky).toBe(true);
    expect(link.owners).toBe(false);
    expect(calls.some((c) => c.url.includes('/api/avatars/'))).toBe(false);
    // Her stream is refused the same way, and the ladder answers from the next rung.
    const rest = { reply: vi.fn(async () => ['kimi line']) } as ShipAiProvider;
    const told: string[] = [];
    const ladder = new YokeLadder(new AvatarTalk(link, {}, { firstWithinMs: 200 }), rest, (l) => told.push(l));
    expect(await ladder.reply({ trigger: 'idle', summary: 's', lore: '' } as AiContext, [], 'hi')).toEqual(['kimi line']);
    expect(calls.some((c) => c.url.includes('/api/avatars/'))).toBe(false);
    expect(told.join(' ')).toMatch(/dev server only/);
  });

  it('the owner\'s YOKE is allowed only on localhost through the dev proxy', () => {
    expect(ownerYokeAllowed('/rfab-api', 'localhost')).toBe(true);
    expect(ownerYokeAllowed('/rfab-api/', '127.0.0.1')).toBe(true);
    expect(ownerYokeAllowed('https://api.rfab.ai', 'localhost')).toBe(false);
    expect(ownerYokeAllowed('/rfab-api', 'broodfall.itch.io')).toBe(false);
    expect(ownerYokeAllowed('/rfab-api', '')).toBe(false);   // a file:// page (a desktop wrap)
  });

  it('every call names the campaign: two campaigns, two minds on rfab.ai', async () => {
    const { fetcher, calls } = fakeRfab({
      'POST /api/broodfall/yoke/message': () => ({ status: 200, body: { success: true } }),
      'GET /api/broodfall/yoke/history': () => ({ status: 200, body: { turns: [] } }),
      'GET /api/broodfall/yoke/state': () => ({ status: 200, body: STATE }),
      'POST /api/broodfall/yoke/connect/poll': () => ({ status: 200, body: { status: 'pending' } }),
    });
    const store = memStore(GUEST);
    const one = new PlayerLink({ base: '', store, campaignId: 'c1abc', fetcher });
    const two = new PlayerLink({ base: '', store, campaignId: 'c2xyz', fetcher });
    await new AvatarLink({ base: '', avatarId: 'av-123456', player: one, fetcher }).send('hello');
    await new AvatarLink({ base: '', avatarId: 'av-123456', player: two, fetcher }).history();
    await one.state();
    expect(calls.map((c) => [c.url, c.headers['X-Broodfall-Campaign']])).toEqual([
      ['/api/broodfall/yoke/message', 'c1abc'],
      ['/api/broodfall/yoke/history', 'c2xyz'],
      ['/api/broodfall/yoke/state', 'c1abc'],
    ]);
    // The same token (the same player) for both: the allowance is his, the memory the campaign's.
    expect(new Set(calls.map((c) => c.headers['X-Broodfall-Player']))).toEqual(new Set([GUEST]));
    // Kimi's campaign travels in its body (its own sink), as before.
    const kimiCalls = fakeRfab({ 'POST /api/broodfall/ship-ai': () => ({ status: 200, body: { lines: ['ok'] } }) });
    await new RfabShipAi({ base: '', campaignId: 'c1abc', player: one }, kimiCalls.fetcher).reply({ trigger: 'idle', summary: 's', lore: 'l' }, []);
    expect(JSON.parse(kimiCalls.calls[0].body!).campaignId).toBe('c1abc');
    expect(kimiCalls.calls[0].headers['X-Broodfall-Campaign']).toBe('c1abc');
  });

  it('linking tells the game its token changed, and her stream is opened again with the new one', async () => {
    let opened: string[] = [];
    const store = memStore(GUEST);
    const fetcher = (async (url: string, init: RequestInit = {}) => {
      const u = String(url);
      const h = (init.headers ?? {}) as Record<string, string>;
      if (u.endsWith('/events')) {
        opened.push(h['X-Broodfall-Player']);
        return new Response(new ReadableStream({ start() { /* stays open */ } }), { status: 200 });
      }
      if (u.endsWith('/connect/poll')) return new Response(JSON.stringify({ status: 'connected', token: LINKED }), { status: 200 });
      if (u.endsWith('/history')) return new Response(JSON.stringify({ turns: [] }), { status: 200 });
      return new Response('{}', { status: 404 });
    }) as unknown as typeof fetch;
    const player = new PlayerLink({ base: '', store, campaignId: 'c1abc', fetcher });
    const talk = new AvatarTalk(new AvatarLink({ base: '', avatarId: 'av-123456', player, fetcher }));
    player.tokenChanged = () => { void talk.reopen(); };
    await talk.enter();
    expect(opened).toEqual([GUEST]);
    expect((await player.pollConnect('d'.repeat(43))).status).toBe('connected');
    await new Promise((r) => setTimeout(r, 10));
    expect(opened).toEqual([GUEST, LINKED]);
    expect(talk.open).toBe(true);
    talk.leave();
    opened = [];
  });

  it('Kimi (the next rung) carries the player token too, not the key', async () => {
    const { fetcher, calls } = fakeRfab({
      'POST /api/broodfall/ship-ai': () => ({ status: 200, body: { lines: ['Telemetry is in.'], tokensCharged: 40 } }),
    });
    const player = new PlayerLink({ base: '', store: memStore(GUEST), fetcher });
    const kimi = new RfabShipAi({ base: '', key: 'rfab_key', campaignId: 'c1', player }, fetcher);
    expect(await kimi.reply({ trigger: 'idle', summary: 's', lore: 'l' }, [])).toEqual(['Telemetry is in.']);
    expect(calls[0].headers['X-Broodfall-Player']).toBe(GUEST);
    expect(calls[0].headers['X-API-Key']).toBeUndefined();
  });
});

describe('the cut-off', () => {
  const ctx = { trigger: 'idle', summary: 'Held: 1.', lore: '' } as AiContext;
  const spentTalk = (code: string, status = 402) => {
    const talk = { open: true, enter: async () => [], ask: async () => { throw new AvatarError(status, code, 'no'); }, leave() {} } as unknown as AvatarTalk;
    return talk;
  };

  it('classifies the refusals that mean money', () => {
    expect(cutKindOf(402, 'GUEST_ALLOWANCE_SPENT')).toBe('allowance');
    expect(cutKindOf(402, 'INSUFFICIENT_TOKENS')).toBe('topup');
    expect(cutKindOf(503, 'HOUSE_BUDGET_EMPTY')).toBe('resting');
    expect(cutKindOf(402, undefined)).toBeNull();
    expect(cutKindOf(404, 'X')).toBeNull();
  });

  it('when the $3 is spent she says so once, no paid rung is asked, and the scripted YOKE answers after', async () => {
    const rest = { reply: vi.fn(async () => ['kimi line']) } as ShipAiProvider;
    const ladder = new YokeLadder(spentTalk('GUEST_ALLOWANCE_SPENT'), rest, () => {}, new ScriptedShipAi());
    const onCut = vi.fn();
    ladder.onCut = onCut;
    ladder.cutOff = (kind) => cutOffLines(kind, 400000, 150000);
    const first = await ladder.reply(ctx, [], 'hello?');
    expect(first.join(' ')).toMatch(/Link your own RFab account/);
    expect(first.join(' ')).toMatch(/400,000 free tokens/);
    expect(onCut).toHaveBeenCalledWith('allowance');
    expect(rest.reply).not.toHaveBeenCalled();
    const second = await ladder.reply(ctx, [{ speaker: 'YOKE', text: first[0] }], 'still there?');
    expect(second.length).toBeGreaterThan(0);
    expect(second.join(' ')).not.toMatch(/Link your own/);
    expect(rest.reply).not.toHaveBeenCalled();
    expect(ladder.cut).toBe('allowance');
  });

  it('a short linked account asks for a top-up; after uncut her mind is asked again', async () => {
    let paid = false;
    const talk = { open: true, enter: async () => [], ask: async () => { if (!paid) throw new AvatarError(402, 'INSUFFICIENT_TOKENS', ''); return ['Back.']; }, leave() {} } as unknown as AvatarTalk;
    const ladder = new YokeLadder(talk, { reply: async () => ['x'] }, () => {}, new ScriptedShipAi());
    ladder.cutOff = (kind) => cutOffLines(kind, 400000, 150000);
    expect((await ladder.reply(ctx, [])).join(' ')).toMatch(/Top it up on rfab\.ai/);
    paid = true;
    ladder.uncut();
    expect(await ladder.reply(ctx, [])).toEqual(['Back.']);
  });
});

describe('the words', () => {
  it('say where her memory lives: this campaign, and the install or the account', () => {
    const c = { id: 'c1', remembered: true, campaignsRemembered: 2, keep: 5, heldBy: 'install' as const };
    expect(memoryText({ connected: false, campaign: c })).toBe('She remembers this campaign. This game keeps her memory of its last 5 campaigns; linking an RFab account keeps it on the account.');
    expect(memoryText({ connected: true, campaign: { ...c, remembered: false, heldBy: 'account' } })).toBe('This campaign is new to her: she starts it fresh. Your RFab account keeps her memory of your last 5 campaigns, on every PC you link.');
    expect(memoryText({ connected: false })).toBe('');
  });

  it('state the bonus plainly: more than double the free talk', () => {
    expect(bonusTimes(400000, 150000)).toBeGreaterThan(2);
    expect(cutOffLines('allowance', 400000, 150000).join(' ')).toContain('$8.00');
    expect(allowanceText({ capTokens: 150000, spentTokens: 29500, remainingTokens: 120500, spent: false })).toBe('$2.41 of $3.00 left');
    expect(costText({ id: 'k', label: 'Kimi', exchangeTokens: 1266, exchangeUsd: 0.0253 })).toBe('~1,266 tokens (~$0.03) a reply');
    expect(costText({ id: 'k', label: 'x', exchangeTokens: null, exchangeUsd: null })).toBe('price on rfab.ai');
  });
});
