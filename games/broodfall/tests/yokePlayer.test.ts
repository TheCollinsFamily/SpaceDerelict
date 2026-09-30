/**
 * The player's own link to YOKE (src/meta/yokePlayer.ts) and the money cut-off in her ladder
 * (src/meta/yokeAvatar.ts). No network: rfab.ai is a fake here.
 *
 * What is held: a player is registered once and keeps only a player token; her calls go to the
 * player route with that token and never with an RFab key; an RFab without the route (its
 * deploy owed) is talked to the old way; when the server says nobody pays (the $3 is spent, the
 * linked account is short) she says so ONCE and no other paid rung is asked; linking stores
 * the connected token; the words for the screen state the bonus plainly.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  PlayerLink, allowanceText, bonusTimes, costText, cutKindOf, cutOffLines, watchConnect,
  type TokenStore,
} from '../src/meta/yokePlayer';
import { AvatarError, AvatarLink, AvatarTalk, YokeLadder } from '../src/meta/yokeAvatar';
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

  it('on a legacy RFab they go to the avatar route as before', async () => {
    const { fetcher, calls } = fakeRfab({ 'POST /api/avatars/av-123456/message': () => ({ status: 200, body: { success: true } }) });
    const player = new PlayerLink({ base: '/rfab-api', store: memStore(), fetcher });
    const link = new AvatarLink({ base: '/rfab-api', avatarId: 'av-123456', player, fetcher });
    await link.send('hello');
    expect(player.legacy).toBe(true);
    expect(calls.at(-1)!.url).toBe('/rfab-api/api/avatars/av-123456/message');
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
  it('state the bonus plainly: more than double the free talk', () => {
    expect(bonusTimes(400000, 150000)).toBeGreaterThan(2);
    expect(cutOffLines('allowance', 400000, 150000).join(' ')).toContain('$8.00');
    expect(allowanceText({ capTokens: 150000, spentTokens: 29500, remainingTokens: 120500, spent: false })).toBe('$2.41 of $3.00 left');
    expect(costText({ id: 'k', label: 'Kimi', exchangeTokens: 1266, exchangeUsd: 0.0253 })).toBe('~1,266 tokens (~$0.03) a reply');
    expect(costText({ id: 'k', label: 'x', exchangeTokens: null, exchangeUsd: null })).toBe('price on rfab.ai');
  });
});
