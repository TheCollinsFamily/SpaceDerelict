import { describe, expect, it } from 'vitest';
import { FallbackShipAi, RfabShipAi, ScriptedShipAi, ShipAiError, campaignIdFor, reasonFor, type AiContext } from '../src/meta/shipAi';

const ctx: AiContext = { trigger: 'first-deployment', summary: 'Held: 2.', lore: '- first-deployment: "I have been reviewing the telemetry."' };
const reply = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('YOKE on rfab.ai (Kimi K2.6)', () => {
  it('posts the campaign, trigger, lore and history, with the key, and returns the lines', async () => {
    let sent: { url: string; init: RequestInit } | null = null;
    const ai = new RfabShipAi({ base: '/rfab-api/', key: 'rfab_k', campaignId: 'c1' }, async (url, init) => {
      sent = { url: String(url), init: init! };
      return new Response(JSON.stringify({ lines: ['Telemetry is in.', 'Well done.'], tokensCharged: 101 }), { status: 200 });
    });
    const lines = await ai.reply(ctx, [{ speaker: 'YOKE', text: 'A.' }, { speaker: 'You', text: 'B.' }], 'B.');
    expect(lines).toEqual(['Telemetry is in.', 'Well done.']);
    expect(ai.lastCharge).toBe(101);
    expect(sent!.url).toBe('/rfab-api/api/broodfall/ship-ai');
    expect((sent!.init.headers as Record<string, string>)['X-API-Key']).toBe('rfab_k');
    const body = JSON.parse(String(sent!.init.body));
    expect(body).toMatchObject({ campaignId: 'c1', trigger: 'first-deployment', summary: 'Held: 2.', playerLine: 'B.' });
    // the player's line is sent once, not also as the last history turn
    expect(body.history).toEqual([{ speaker: 'YOKE', text: 'A.' }]);
  });

  it('sends no key header when none is linked (the launcher proxy adds its own)', async () => {
    let headers: Record<string, string> = {};
    await new RfabShipAi({ base: '/rfab-api', campaignId: 'c1' }, async (_u, init) => {
      headers = init!.headers as Record<string, string>;
      return new Response(JSON.stringify({ lines: ['x'] }), { status: 200 });
    }).reply(ctx, []);
    expect(headers['X-API-Key']).toBeUndefined();
  });

  it('turns rfab.ai failures into player-readable reasons', async () => {
    const fail = async (status: number, body: unknown) => {
      try { await new RfabShipAi({ base: '', campaignId: 'c' }, reply(status, body)).reply(ctx, []); } catch (e) { return e as ShipAiError; }
      throw new Error('did not throw');
    };
    expect(reasonFor(await fail(401, { code: 'MISSING_AUTH_TOKEN' }))).toMatch(/no RFab API key/);
    expect(reasonFor(await fail(402, { code: 'INSUFFICIENT_TOKENS' }))).toMatch(/out of RFab tokens/);
    expect(reasonFor(await fail(404, {}))).toMatch(/does not have YOKE/);
    expect((await fail(200, { lines: [] })).status).toBe(502);
    const net = await new RfabShipAi({ base: '', campaignId: 'c' }, async () => { throw new TypeError('offline'); }).reply(ctx, []).catch((e) => e);
    expect(reasonFor(net)).toMatch(/unreachable/);
  });

  it('falls back to the scripted YOKE, says why, and stops asking after a sticky failure', async () => {
    let calls = 0;
    const primary = new RfabShipAi({ base: '', campaignId: 'c' }, async () => { calls++; return new Response('{}', { status: 401 }); });
    const ai = new FallbackShipAi(primary);
    const first = await ai.reply(ctx, []);
    expect(first).toEqual(await new ScriptedShipAi().reply(ctx, []));
    expect(ai.status).toEqual({ live: false, note: 'scripted: no RFab API key linked' });
    await ai.reply(ctx, [{ speaker: 'YOKE', text: first[0] }]);
    expect(calls).toBe(1);
  });

  it('keeps retrying after a passing failure (out of tokens, network) and reports live replies', async () => {
    let n = 0;
    const primary = new RfabShipAi({ base: '', campaignId: 'c' }, async () => (++n === 1
      ? new Response(JSON.stringify({ code: 'INSUFFICIENT_TOKENS' }), { status: 402 })
      : new Response(JSON.stringify({ lines: ['Live.'], tokensCharged: 31 }), { status: 200 })));
    const ai = new FallbackShipAi(primary);
    await ai.reply(ctx, []);
    expect(ai.status.note).toMatch(/out of RFab tokens/);
    expect(await ai.reply(ctx, [])).toEqual(['Live.']);
    expect(ai.status).toEqual({ live: true, note: 'Kimi K2.6 via rfab.ai, 31 tokens' });
  });

  it('scripted mode never touches the network', async () => {
    const ai = new FallbackShipAi(null);
    expect(await ai.reply(ctx, [])).toEqual(['I have been reviewing the telemetry.']);
    expect(ai.status.live).toBe(false);
  });

  it('a campaign bills on a stable, sink-safe id', () => {
    expect(campaignIdFor(123456)).toBe('c2n9c');
    expect(campaignIdFor(-5.7)).toBe('c5');
    expect(campaignIdFor(99)).toMatch(/^c[a-z0-9]+$/);
  });
});
