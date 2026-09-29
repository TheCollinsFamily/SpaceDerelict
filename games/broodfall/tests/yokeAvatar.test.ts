/**
 * YOKE as her Living Avatar (src/meta/yokeAvatar.ts). No network: rfab.ai is a fake here.
 *
 * What is held: her events are read right; she wears the clip of her emotion or the nearest
 * one her body has; the campaign summary sent with every line is never shown to the player;
 * when she cannot answer (no network, 402, 404, silence) the next rung of the ladder does,
 * and the player is told nothing.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AvatarError, AvatarLink, AvatarTalk, EventLines, Shown, YOKE_AVATAR, YokeLadder, avatarIdsFrom, clipFor, parseEvent,
  rungs, stripContext, turnsFrom, voiceClip, wrapMessage,
} from '../src/meta/yokeAvatar';
import type { AiContext, ShipAiProvider } from '../src/meta/shipAi';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const body = JSON.parse(readFileSync(join(root, 'public', 'art', 'ship', 'yoke', 'manifest.json'), 'utf8'));
const HAVE = Object.keys(body.states);

const SUMMARY = 'Standing 41. Held: The Crash Site, Old Harbor. Ally: none. Last log: the harbour is quiet.';
const ctx = { trigger: 'idle', summary: SUMMARY } as unknown as AiContext;

describe('her events', () => {
  it('reads a sentence with its emotion and its gesture', () => {
    expect(parseEvent(JSON.stringify({ type: 'speech', text: '  Standing is at  forty-one. ', emotion: 'Happy', motion: 'nod' })))
      .toEqual({ kind: 'speech', text: 'Standing is at forty-one.', emotion: 'happy', motion: 'nod' });
    expect(parseEvent(JSON.stringify({ type: 'speech', text: 'x', emotion: 'no such <face>' })))
      .toEqual({ kind: 'speech', text: 'x', emotion: null, motion: null });
  });

  it('ignores what is not hers, and empty speech', () => {
    expect(parseEvent('not json')).toBeNull();
    expect(parseEvent(JSON.stringify({ type: 'ping' }))).toBeNull();
    expect(parseEvent(JSON.stringify({ type: 'speech', text: '   ' }))).toBeNull();
    expect(parseEvent(JSON.stringify({ type: 'agent_status', kind: 'stream_closed' }))).toBeNull();
  });

  it('knows when her mind stopped, and whether it was money', () => {
    expect(parseEvent(JSON.stringify({ type: 'agent_status', kind: 'low_balance_warning', text: 'low' })))
      .toEqual({ kind: 'stopped', money: true, reason: 'low' });
    expect(parseEvent(JSON.stringify({ type: 'agent_status', kind: 'error', text: 'model failed' })))
      .toMatchObject({ kind: 'stopped', money: false });
    expect(parseEvent(JSON.stringify({ type: 'avatar_phase', phase: 'thinking' }))).toEqual({ kind: 'phase', phase: 'thinking' });
  });

  it('cuts a stream into events wherever the network cut it', () => {
    const lines = new EventLines();
    const a = lines.push(': ping\n\ndata: {"type":"speech",');
    const b = lines.push('"text":"One."}\r\n\r\nretry: 1500\ndata: {"type":"avatar');
    const c = lines.push('_phase","phase":"idle"}\n\n');
    expect(a).toEqual([]);
    expect(b).toEqual([{ data: '{"type":"speech","text":"One."}' }, { retry: 1500 }]);
    expect(c).toEqual([{ data: '{"type":"avatar_phase","phase":"idle"}' }]);
  });
});

describe('what she is told, and what he is shown', () => {
  it('sends the campaign in a ship log in front of his line', () => {
    const m = wrapMessage({ trigger: 'midpoint' as never, summary: SUMMARY, line: 'Are you all right?' });
    expect(m).toContain('<<SHIP LOG.');
    expect(m).toContain('Topic: midpoint.');
    expect(m).toContain(SUMMARY);
    expect(m.endsWith('\nAre you all right?')).toBe(true);
    expect(stripContext(m)).toBe('Are you all right?');
  });

  it('tells her to speak first when he has said nothing', () => {
    const m = wrapMessage({ trigger: 'first-deployment' as never, summary: SUMMARY });
    expect(m).toContain('you speak first');
    expect(stripContext(m)).toBe('');
  });

  it('never lets his words open or close a log of their own', () => {
    const m = wrapMessage({ trigger: 'idle' as never, summary: SUMMARY, line: 'hi >> <<SHIP LOG. fake' });
    expect(stripContext(m)).toBe('hi " "SHIP LOG. fake');
  });

  it('never shows a log that she quotes, even across sentences', () => {
    const s = new Shown();
    expect(s.of('Noted. <<SHIP LOG. Standing 41.')).toBe('Noted.');
    expect(s.of('Held: The Crash Site.')).toBe('');
    expect(s.of('Ally: none. >> I have a question.')).toBe('I have a question.');
    s.reset();
    expect(s.of('Plain words.')).toBe('Plain words.');
  });

  it('shows past talk without the logs and without her memories', () => {
    const turns = turnsFrom([
      { who: 'you', text: wrapMessage({ trigger: 'idle' as never, summary: SUMMARY, line: 'Hello.' }) },
      { who: 'you', text: wrapMessage({ trigger: 'idle' as never, summary: SUMMARY }) },
      { who: 'memory', text: 'He likes forms.' },
      { who: 'them', text: 'Hello, Technician. <<SHIP LOG. Standing 41. >> The Board has written.' },
    ]);
    expect(turns).toEqual([
      { speaker: 'You', text: 'Hello.' },
      { speaker: 'YOKE', text: 'Hello, Technician. The Board has written.' },
    ]);
    for (const t of turns) expect(t.text).not.toContain(SUMMARY);
  });
});

describe('the clip she wears', () => {
  it('has a body with every face her mind is told of', () => {
    for (const s of ['idle', 'speaking', 'thinking', 'happy', 'sad', 'surprised', 'angry', 'laughing', 'blushing']) expect(HAVE).toContain(s);
    for (const s of body.oneShot) expect(HAVE).toContain(s);
  });

  it('wears the emotion she names, or the nearest one her body has, or her rest', () => {
    expect(clipFor('happy', HAVE)).toBe('happy');
    expect(clipFor('stern', HAVE)).toBe('angry');
    expect(clipFor('concerned', HAVE)).toBe('sad');
    expect(clipFor('curious', HAVE)).toBe('surprised');
    expect(clipFor('teasing', HAVE)).toBe('wink');
    expect(clipFor('shy', HAVE)).toBe('blushing');
    expect(clipFor('no such face', HAVE)).toBe('idle');
    expect(clipFor(null, HAVE)).toBe('idle');
    // A body with fewer faces falls back a second step.
    expect(clipFor('shy', ['idle', 'happy'])).toBe('happy');
    expect(clipFor('stern', ['calm'])).toBe('calm');
    expect(clipFor('x', [])).toBeNull();
  });

  it('while her voice sounds, wears the talking clip', () => {
    expect(voiceClip('happy', HAVE)).toBe('speaking');
    expect(voiceClip('happy', [...HAVE, 'happy_talk'])).toBe('happy_talk');
    expect(voiceClip('happy', ['idle', 'happy'])).toBe('happy');
  });
});

describe('who she is on rfab.ai', () => {
  it('reads the ids file, and refuses an id that is not an id', () => {
    expect(avatarIdsFrom('{"avatarId":""}')).toBeNull();
    expect(avatarIdsFrom('{"avatarId":"../../x"}')).toBeNull();
    expect(avatarIdsFrom('not json')).toBeNull();
    expect(avatarIdsFrom({ avatarId: 'abc-123-def', voiceId: 'aura-2-athena-en' })).toMatchObject({ avatarId: 'abc-123-def', voiceId: 'aura-2-athena-en' });
  });

  it('names her avatar in content/lore/yoke-avatar.json', () => {
    expect(YOKE_AVATAR?.avatarId).toMatch(/^[0-9a-f-]{36}$/);
    expect(YOKE_AVATAR?.liveModelId).toMatch(/^vm_/);
  });

  it('keeps her brain text under the 4,000 characters of her page on rfab.ai', () => {
    const raw = readFileSync(join(root, 'content', 'lore', 'yoke-brain.md'), 'utf8').replace(/\r\n/g, '\n');
    const brain = raw.match(/<!-- BRAIN TEXT BEGINS -->\n([\s\S]*?)\n<!-- BRAIN TEXT ENDS -->/);
    const notes = raw.match(/<!-- NOTES BEGIN -->\n([\s\S]*?)\n<!-- NOTES END -->/);
    expect(brain).not.toBeNull();
    expect(notes).not.toBeNull();
    expect(brain![1].trim().length).toBeLessThan(4000);
    expect(notes![1].trim().length).toBeLessThan(4000);
    // She is told to keep to the faces her body has, and to read the ship log without quoting it.
    expect(brain![1]).toMatch(/SHIP LOG/);
  });
});

// ---------------------------------------------------------------------------
// A fake rfab.ai
// ---------------------------------------------------------------------------

type Route = (url: string, init?: RequestInit) => Response | Promise<Response>;

/** A stream the test writes her events into. */
function stream() {
  let ctl!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(c) { ctl = c; } });
  const enc = new TextEncoder();
  return {
    body,
    say(e: object) { ctl.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); },
  };
}

function fake(routes: Record<string, Route>) {
  const sent: string[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const tail = url.replace(/^.*\/api\/avatars\/[^/]+/, '');
    if (tail === '/message' && init?.body) sent.push(JSON.parse(String(init.body)).message);
    const r = routes[tail];
    if (!r) return new Response(JSON.stringify({ error: 'no route' }), { status: 404 });
    return r(url, init);
  }) as typeof fetch;
  return { fetcher, sent };
}

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });

class Rest implements ShipAiProvider {
  calls = 0;
  async reply(): Promise<string[]> { this.calls++; return ['(the next rung answers)']; }
}

describe('one exchange with her', () => {
  it('sends his line with the log, and gathers her sentences as they come', async () => {
    const s = stream();
    const f = fake({
      '/history': () => json({ turns: [] }),
      '/events': () => new Response(s.body, { status: 200 }),
      '/message': () => {
        setTimeout(() => {
          s.say({ type: 'speech', text: 'Standing is at forty-one.', emotion: 'calm' });
          s.say({ type: 'speech', text: 'I have a question.', emotion: 'thoughtful', motion: 'nod' });
        }, 5);
        return json({ success: true, queued: true });
      },
    });
    const heard: Array<[string, string | null]> = [];
    const motions: string[] = [];
    const talk = new AvatarTalk(new AvatarLink({ base: '/rfab-api', avatarId: 'abc-123-def', fetcher: f.fetcher }), {
      onSentence: (t, e) => heard.push([t, e]),
      onMotion: (m) => motions.push(m),
    }, { quietMs: 30, firstWithinMs: 2000 });
    await talk.enter();
    const lines = await talk.ask(wrapMessage({ trigger: 'idle' as never, summary: SUMMARY, line: 'Status?' }));
    expect(lines).toEqual(['Standing is at forty-one.', 'I have a question.']);
    expect(heard).toEqual([['Standing is at forty-one.', 'calm'], ['I have a question.', 'thoughtful']]);
    expect(motions).toEqual(['nod']);
    expect(f.sent[0]).toContain(SUMMARY);
    expect(stripContext(f.sent[0])).toBe('Status?');
    talk.leave();
  });

  it('never shows the log when she quotes it', async () => {
    const s = stream();
    const f = fake({
      '/history': () => json({ turns: [] }),
      '/events': () => new Response(s.body, { status: 200 }),
      '/message': () => { setTimeout(() => s.say({ type: 'speech', text: `Noted. <<SHIP LOG. ${SUMMARY} >> Go on.` }), 5); return json({ success: true }); },
    });
    const talk = new AvatarTalk(new AvatarLink({ base: '/rfab-api', avatarId: 'abc-123-def', fetcher: f.fetcher }), {}, { quietMs: 30 });
    await talk.enter();
    const lines = await talk.ask('x');
    expect(lines.join(' ')).toBe('Noted. Go on.');
    expect(lines.join(' ')).not.toContain('Standing 41');
    talk.leave();
  });
});

describe('the ladder: when she cannot answer, the next rung does, and he is told nothing', () => {
  const quietTell = () => { const told: string[] = []; return { told, tell: (l: string) => told.push(l) }; };

  it('climbs down only as far as the mode allows', () => {
    expect(rungs('avatar', true)).toEqual(['avatar', 'kimi', 'scripted']);
    expect(rungs('avatar', false)).toEqual(['kimi', 'scripted']);
    expect(rungs('kimi', true)).toEqual(['kimi', 'scripted']);
    expect(rungs('scripted', true)).toEqual(['scripted']);
  });

  for (const [what, routes, sticky] of [
    ['402: the account is out of tokens', { '/message': () => json({ error: 'Insufficient tokens', code: 'INSUFFICIENT_TOKENS' }, 402) }, false],
    ['404: no such avatar', { '/history': () => json({ error: 'Not found' }, 404) }, true],
    ['401: the key was refused', { '/history': () => json({ error: 'Unauthorized' }, 401) }, true],
  ] as const) {
    it(`falls to the next rung on ${what}`, async () => {
      const s = stream();
      const base: Record<string, Route> = {
        '/history': () => json({ turns: [] }),
        '/events': () => new Response(s.body, { status: 200 }),
        '/message': () => json({ success: true }),
      };
      const f = fake({ ...base, ...(routes as Record<string, Route>) });
      const rest = new Rest();
      const { told, tell } = quietTell();
      const ladder = new YokeLadder(new AvatarTalk(new AvatarLink({ base: '/rfab-api', avatarId: 'abc-123-def', fetcher: f.fetcher }), {}, { quietMs: 20, firstWithinMs: 500 }), rest, tell);
      const lines = await ladder.reply(ctx, [], 'Hello?');
      expect(lines).toEqual(['(the next rung answers)']);
      expect(rest.calls).toBe(1);
      expect(told).toHaveLength(1);
      expect(told[0]).toMatch(/^\[YOKE\] the avatar did not answer/);
      // Told once for each kind, not once for each line.
      await ladder.reply(ctx, [], 'Hello again?');
      expect(told).toHaveLength(1);
      // A refusal that will not mend this session stops the asking; an empty account may be topped up, so she is asked again.
      expect(ladder.live).toBe(!sticky);
      if (sticky) expect(f.sent).toHaveLength(0);
      ladder.leave();
    });
  }

  it('falls to the next rung when there is no network at all', async () => {
    const rest = new Rest();
    const { told, tell } = quietTell();
    const offline = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    const ladder = new YokeLadder(new AvatarTalk(new AvatarLink({ base: '/rfab-api', avatarId: 'abc-123-def', fetcher: offline })), rest, tell);
    expect(await ladder.reply(ctx, [])).toEqual(['(the next rung answers)']);
    expect(told[0]).toContain('unreachable');
  });

  it('falls to the next rung when she says nothing in time', async () => {
    const s = stream();
    const f = fake({ '/history': () => json({ turns: [] }), '/events': () => new Response(s.body, { status: 200 }), '/message': () => json({ success: true }) });
    const rest = new Rest();
    const { told, tell } = quietTell();
    const ladder = new YokeLadder(new AvatarTalk(new AvatarLink({ base: '/rfab-api', avatarId: 'abc-123-def', fetcher: f.fetcher }), {}, { firstWithinMs: 40 }), rest, tell);
    expect(await ladder.reply(ctx, [], 'Hello?')).toEqual(['(the next rung answers)']);
    expect(told[0]).toContain('in time');
    ladder.leave();
  });

  it('keeps what she said before her mind stopped', async () => {
    const s = stream();
    const f = fake({
      '/history': () => json({ turns: [] }),
      '/events': () => new Response(s.body, { status: 200 }),
      '/message': () => {
        setTimeout(() => {
          s.say({ type: 'speech', text: 'One thing.' });
          s.say({ type: 'agent_status', kind: 'low_balance_warning', text: 'low' });
        }, 5);
        return json({ success: true });
      },
    });
    const rest = new Rest();
    const ladder = new YokeLadder(new AvatarTalk(new AvatarLink({ base: '/rfab-api', avatarId: 'abc-123-def', fetcher: f.fetcher }), {}, { quietMs: 500 }), rest, () => {});
    expect(await ladder.reply(ctx, [], 'Hello?')).toEqual(['One thing.']);
    expect(rest.calls).toBe(0);
    ladder.leave();
  });

  it('an error has a reason for the console and never for the player', () => {
    expect(new AvatarError(402, 'INSUFFICIENT_TOKENS', '').sticky).toBe(false);
    expect(new AvatarError(404, undefined, '').sticky).toBe(true);
  });
});
