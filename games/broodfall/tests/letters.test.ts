/**
 * LETTERS (Collins, Oct 14 2026): people he writes to from the ship, answered between missions; Atlas through her
 * companion until the companion's regard opens the gate. The rules (src/meta/letters.ts) and the client's persona call.
 */
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/meta/campaign';
import { awaiting, dueThreads, historyFor, lettersUnlocked, markRead, mergeLetters, openLetters, personaFor, receiveLetter, scriptedReply, sendLetter, standing, thread, unlockedCorrespondents, unreadLetters } from '../src/meta/letters';
import { CORRESPONDENTS, correspondent } from '../content/letters';
import { RfabShipAi, reasonFor, ShipAiError } from '../src/meta/shipAi';

const past = (said: string[], deployments = 3) => ({ ...newCampaign(7), said, deployments });

describe('the threads open with her greetings', () => {
  it('nothing to write to before the mate review; Atlas after it; Mirelle after the cat girl; Rook after the Board\'s statement', () => {
    expect(lettersUnlocked(past([]))).toBe(false);
    expect(unlockedCorrespondents(past(['mate-review']))).toEqual(['atlas']);
    expect(unlockedCorrespondents(past(['mate-review', 'catgirl']))).toEqual(['atlas', 'mirelle']);
    expect(unlockedCorrespondents({ ...past(['mate-review', 'catgirl']), greetingsSaid: ['won-1', 'intro-board'] })).toEqual(['atlas', 'mirelle', 'rook']);
    const s = openLetters({ ...past(['mate-review']), greetingsSaid: ['intro-board'] });
    expect(thread(s, 'rook')!.turns[0].from).toBe('Rook Halloran');
    expect(correspondent('rook').note).toMatch(/LOW STATUS/);
  });
  it('opening a thread leaves their first letter waiting, unread, from the right hand', () => {
    const s = openLetters(past(['mate-review', 'catgirl']));
    const a = thread(s, 'atlas')!, m = thread(s, 'mirelle')!;
    expect(a.turns).toHaveLength(1);
    expect(a.turns[0]).toMatchObject({ who: 'them', from: 'Atlas\'s companion' });
    expect(m.turns[0].from).toBe('Mirelle');
    expect(unreadLetters(s)).toBe(2);
    expect(openLetters(s)).toBe(s); // nothing more to open: the same state
    expect(unreadLetters(markRead(s, 'atlas'))).toBe(1);
  });
});

describe('a letter of his is answered only after a deployment', () => {
  it('sends once, then waits; nothing is due until he has deployed again', () => {
    let s = openLetters(past(['mate-review']));
    s = sendLetter(s, 'atlas', '  Hello.\n\nI read the file.  ');
    const t = thread(s, 'atlas')!;
    expect(t.turns[1]).toMatchObject({ who: 'you', text: ['Hello.', 'I read the file.'], at: 3 });
    expect(awaiting(t)).toBe(true);
    expect(sendLetter(s, 'atlas', 'Again.')).toBe(s); // a second letter waits for the reply
    expect(sendLetter(s, 'mirelle', 'x')).toBe(s); // no such thread yet
    expect(dueThreads(s)).toEqual([]);
    expect(dueThreads({ ...s, deployments: 4 })).toEqual(['atlas']);
  });
  it('the history for the model is theirs as the assistant and his as the user', () => {
    const s = sendLetter(openLetters(past(['mate-review'])), 'atlas', 'Hello.');
    const h = historyFor(thread(s, 'atlas')!);
    expect(h[0].speaker).toBe('YOKE');
    expect(h[1]).toEqual({ speaker: 'You', text: 'Hello.' });
  });
});

describe('the companion keeps Atlas until her regard opens the gate', () => {
  const gate = correspondent('atlas').direct!.gate;
  it('replies add regard (never below zero); at the gate the handover letter comes and Atlas writes next', () => {
    let s = sendLetter(openLetters(past(['mate-review'])), 'atlas', 'Hello.');
    s = { ...s, deployments: 4 };
    expect(personaFor(thread(s, 'atlas')!).name).toBe('Atlas\'s companion');
    s = receiveLetter(s, 'atlas', ['She read it.'], -2);
    expect(thread(s, 'atlas')!.regard).toBe(0);
    for (let i = 0; i < gate; i++) {
      s = sendLetter(s, 'atlas', `Letter ${i}.`);
      s = { ...s, deployments: s.deployments + 1 };
      expect(thread(s, 'atlas')!.direct).toBe(false);
      s = receiveLetter(s, 'atlas', ['Noted.'], 1);
    }
    const t = thread(s, 'atlas')!;
    expect(t.regard).toBe(gate);
    expect(t.direct).toBe(true);
    const last = t.turns[t.turns.length - 1];
    expect(last.from).toBe('Atlas\'s companion');
    expect(last.text).toEqual(correspondent('atlas').direct!.handover);
    expect(personaFor(t).name).toBe('Atlas Vell');
    expect(standing(t)).toMatch(/Atlas Vell writes to you herself/);
  });
  it('the standing line counts him toward the gate', () => {
    const s = openLetters(past(['mate-review']));
    expect(standing(thread(s, 'atlas')!)).toBe(`Atlas's companion's regard: 0 of ${gate} before she lets you write to Atlas Vell directly`);
    expect(standing(thread(openLetters(past(['mate-review', 'catgirl'])), 'mirelle')!)).toBe('Mirelle\'s regard: 0');
  });
});

describe('the scripted letters', () => {
  it('come in turn, the last repeating, from whoever writes now, and read as a letter', () => {
    let s = openLetters(past(['mate-review', 'catgirl']));
    const c = correspondent('atlas');
    expect(scriptedReply(thread(s, 'atlas')!).lines).toEqual(c.via.scripted[0]);
    s = sendLetter(s, 'atlas', 'a'); s = { ...s, deployments: 4 }; s = receiveLetter(s, 'atlas', scriptedReply(thread(s, 'atlas')!).lines, 1);
    expect(scriptedReply(thread(s, 'atlas')!).lines).toEqual(c.via.scripted[1]);
    for (const x of CORRESPONDENTS) {
      for (const w of [x.via, ...(x.direct ? [x.direct] : [])]) {
        expect(w.scripted.length).toBeGreaterThan(1);
        for (const letter of w.scripted) { expect(letter.length).toBeGreaterThan(1); for (const l of letter) expect(l.length).toBeLessThan(260); }
        expect(w.who.length).toBeLessThan(8000); // rfab.ai clips a persona at 8,000 chars (app/domain/broodfall/shipAi.js)
      }
      expect(x.opening.length).toBeGreaterThan(1);
    }
  });
});

describe('rfab.ai writes as the correspondent', () => {
  const ctx = { trigger: 'letter' as const, summary: 'Held: 2.', lore: 'Canon.', persona: { name: 'Mirelle', who: 'A cat girl.' } };
  it('sends the persona, takes the lines and the regard back', async () => {
    let body: Record<string, unknown> = {};
    const ai = new RfabShipAi({ base: '/rfab-api', key: 'k', campaignId: 'c1' }, async (_u, init) => {
      body = JSON.parse(String(init!.body));
      return new Response(JSON.stringify({ lines: ['So you CAN write.', ':3'], tokensCharged: 90, persona: 'Mirelle', regard: 2 }), { status: 200 });
    });
    const lines = await ai.reply(ctx, [{ speaker: 'YOKE', text: 'Hi.' }], 'Hello.');
    expect(lines).toEqual(['So you CAN write.', ':3']);
    expect(body.persona).toEqual({ name: 'Mirelle', who: 'A cat girl.' });
    expect(body.trigger).toBe('letter');
    expect(ai.lastRegard).toBe(2);
  });
  it('a backend from before the letters (no persona echoed) fails the call, so the scripted letter is used instead', async () => {
    const ai = new RfabShipAi({ base: '', campaignId: 'c1' }, async () => new Response(JSON.stringify({ lines: ['I am YOKE.'] }), { status: 200 }));
    let err: unknown;
    try { await ai.reply(ctx, [], 'Hello.'); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ShipAiError);
    expect(reasonFor(err)).toMatch(/does not write letters yet/);
  });
});

describe('Rook tells of the orca only when asked, and YOKE answers it once, before a briefing (Collins, Oct 14 2026)', () => {
  const base = () => openLetters({ ...past(['mate-review']), greetingsSaid: ['intro-board'] });
  it('her persona and her letters never say orca unprompted; asked about her skin, the ask letter comes and marks it revealed', () => {
    const c = correspondent('rook');
    for (const l of [...c.opening, ...c.via.scripted.flat()]) expect(l).not.toMatch(/orca/i);
    let s = sendLetter(base(), 'rook', 'Hello. Tell me about the rings.');
    s = { ...s, deployments: 4 };
    expect(scriptedReply(thread(s, 'rook')!).reveal).toBeUndefined();
    s = sendLetter({ ...s, letters: { threads: { ...s.letters!.threads, rook: { ...thread(s, 'rook')!, turns: [...thread(s, 'rook')!.turns, { who: 'them', from: 'Rook Halloran', text: ['x'], at: 4 }] } } } }, 'rook', 'What is with the black and white skin?');
    s = { ...s, deployments: 5 };
    const r = scriptedReply(thread(s, 'rook')!);
    expect(r.reveal).toBe('orca');
    s = receiveLetter(s, 'rook', r.lines, r.regard);
    expect(thread(s, 'rook')!.revealed).toEqual(['orca']);
  });
  it('YOKE: the orca once revealed, once, ahead of the intros (her first letter is an opening now: THREAD_OPENS)', async () => {
    const { letterBeatFor } = await import('../src/meta/onboarding');
    let s = base();
    expect(letterBeatFor(s)).toBeNull();
    s = { ...s, letters: { threads: { ...s.letters!.threads, rook: { ...thread(s, 'rook')!, revealed: ['orca'] } } } };
    expect(letterBeatFor(s)!.id).toBe('letter-rook-orca');
    expect(letterBeatFor(s)!.beats.map((b) => b.say).join(' ')).toMatch(/twelve bodies/);
  });
});

describe('the letters kept on the RFab account merge with the save (Oct 14 2026)', () => {
  it('the longer thread wins, regard and reveals are kept from both, a thread one side lacks is kept', () => {
    const a = openLetters(past(['mate-review', 'catgirl'])).letters!;
    const longer = { ...a.threads.atlas!, turns: [...a.threads.atlas!.turns, { who: 'you' as const, text: ['hi'], at: 3 }], regard: 1 };
    const remote = { threads: { atlas: longer, rook: { id: 'rook' as const, turns: [], regard: 2, direct: false, unread: 0, revealed: ['orca'] } } };
    const m = mergeLetters({ threads: { ...a.threads, atlas: { ...a.threads.atlas!, regard: 2 } } }, remote)!;
    expect(m.threads.atlas!.turns).toHaveLength(2);
    expect(m.threads.atlas!.regard).toBe(2);
    expect(m.threads.mirelle).toBeDefined();
    expect(m.threads.rook!.revealed).toEqual(['orca']);
    expect(mergeLetters(a, null)).toBe(a);
  });
  it('the player link reads and keeps them on /api/broodfall/yoke/letters with the campaign header', async () => {
    const { PlayerLink } = await import('../src/meta/yokePlayer');
    const calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: string }> = [];
    const link = new PlayerLink({ base: 'https://api.rfab.ai', campaignId: 'c7', store: { load: () => 'tok', save: () => {}, clear: () => {} },
      fetcher: async (url, init) => { calls.push({ url: String(url), method: init?.method ?? 'GET', headers: init?.headers as Record<string, string>, body: init?.body as string });
        return new Response(JSON.stringify(init?.method === 'PUT' ? { success: true, kept: 1 } : { success: true, letters: { threads: { atlas: { id: 'atlas', turns: [], regard: 0, direct: false, unread: 0 } } } }), { status: 200 }); } });
    expect(await link.saveLetters({ threads: {} })).toBe(true);
    const got = await link.letters<{ threads: Record<string, unknown> }>();
    expect(Object.keys(got!.threads)).toEqual(['atlas']);
    expect(calls[0]).toMatchObject({ url: 'https://api.rfab.ai/api/broodfall/yoke/letters', method: 'PUT' });
    expect(calls[0].headers['X-Broodfall-Campaign']).toBe('c7');
    expect(calls[0].headers['X-Broodfall-Player']).toBe('tok');
  });
});

describe('Rook opens on YOKE\'s line from the rim (Oct 19 2026); a save that heard the Board line keeps her', () => {
  it('letter-rook opens her thread; intro-board still does on an old save', () => {
    expect(unlockedCorrespondents(past(['mate-review']))).not.toContain('rook');
    expect(unlockedCorrespondents({ ...past(['mate-review']), greetingsSaid: ['letter-rook'] })).toContain('rook');
    expect(unlockedCorrespondents({ ...past(['mate-review']), greetingsSaid: ['intro-board'] })).toContain('rook');
  });
});
