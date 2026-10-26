/**
 * YOKE'S LINES, ON ONE PAGE (Collins, Oct 12 2026: "give me a list of what we have for yoke and where in a visual html
 * that's easy for me to parse through and clean up"). Every prewritten line of hers as one walk through a campaign, step
 * by step, in the order a player meets them (Collins, Oct 14 2026: "much better just to have a list of messages/events in
 * order"), with where each lives; the page lets him edit a line in place, mark it cut or leave a note, and export the
 * changes. Re-run after the lines change.
 *
 *   npx vite-node tools/yoke-lines.ts            → notes/YOKE-LINES.html
 *
 * THE PAGE IS A PLAIN WEB PAGE ON THIS PC (Collins, Oct 16 2026: "make it an html and not a claude whatever"):
 *   node tools/yoke-review-server.cjs  → http://localhost:8792/ (autostarts at login: tools/yoke-review-autostart.ps1)
 * The review lives in notes/yoke-review.json (same shapes as the edits/ reviewed/ exports/ collections below): a session
 * reads that file, applies what is in it, deletes the applied entries from it (or PUT/DELETE /api/doc/...), and commits.
 * THE CLOUD COPY IS LIVE AGAIN AND IS THE ONE HE USES (Collins, Oct 18 2026, switching computers: "get this working from a
 * cloud account"). After every rebuild a session republishes notes/YOKE-LINES.html to it, with the films as files
 * (media/scenes/*.mp4|webp from public/media/scenes; over 64 MB, so two publishes), and reads the review with ArtifactData.
 * Cloud copy: https://claude.ai/artifact/CbXWLvxqcNYzq4GhjmS1Ye (keep the link: publish with the Artifact tool and
 * `url` set; `db` and `user` (scope profile) are declared on it, omit `capabilities` on a republish to keep them).
 * SHARED REVIEW (Collins, Oct 16 2026: "make it a web page so we can share it between claude accounts"): every edit, cut, note
 * and "reviewed" tick lives in the artifact's database, not the browser, so anyone he shares the page with (his other Claude
 * account, as Contributor or Editor from the page's Share menu) sees and adds to the same review, live:
 *   edits/<line id>    { cut, note, text: { <beat index>: <new words> }, base, at, by }   (by = the viewer's opaque user id)
 *   reviewed/<line id> { base, at, by }   a tick that holds while the line's words hash to `base`; a rewrite clears it
 * Each line carries `since`, the date its current wording first appeared (notes/yoke-lines-seen.json, kept by this tool), so
 * the page can show what is new since a reviewer last looked.
 * EXPORT CHANGES writes them to the artifact's database (Collins, Oct 13 2026: "when I hit export save to some external document
 * you can reference, dumping here seems like context waste"), collection `exports`, one document per press, id = the time:
 *   { at, page, n, items: [{ id, group, where, cut, note, text: { <beat index>: { from, to } }, fp }], text }
 * where `text` is the same markdown the page used to copy to the clipboard and `fp` is the edit's fingerprint. A session picks
 * exports up with the ArtifactData tool, never by asking him to paste:
 *   1. ArtifactData action=query url=<the page> collection=exports query={ order_by: { field: 'at', direction: 'desc' }, limit: 5 }
 *      out_dir=<scratchpad>  → one JSON file per export (the result lists them, nothing lands in the context). Read the ones
 *      without `applied`.
 *   2. Apply the items to the files named in them; answer his questions in the reply.
 *   3. Copy the file to notes/yoke-exports/<id>.json and add "applied": "<date>" to it. Its fingerprints then clear those edits
 *      from his page on his next visit (Collins, Oct 13 2026: "my old cuts and edits are still there, as they are addressed they
 *      should be removed"). An item you did not act on: delete it from the copy, and its edit stays on the page.
 *   4. ArtifactData action=update collection=exports doc_id=<id> data={ applied: '<date>' } if_version=<the version the query showed>,
 *      so the page's Exports box shows it applied; and action=batch delete edits/<line id> for each item applied (pin each to the
 *      version a list of `edits` shows), so the shared review clears at once for everyone, not on the next visit.
 *   5. Re-run this tool, publish notes/YOKE-LINES.html to the url above, commit.
 * Unexported edits: list `edits` (they are already shared; `state/draft` is the old pre-Oct-16 mirror). The page also clears,
 * on its own, an edit whose line is gone and a rewritten beat now reading as he wrote it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { GREETINGS, earthNews, newsBeats, type GreetMoment, type Greeting } from '../content/greetings';
import { PRINT_BODY } from '../content/yokeScenes';
import { BOSS, BOSS_AFTER, BOSS_ASIDE, BOSS_BRIDGE } from '../content/boss';
import { FACTIONS, type Scene } from '../content/campaign';
import { ROACH_SCENES } from '../content/roachKing';
import { speakerOf } from '../content/media';
import { EARLY_ONCE, EARTH_NEWS_EVERY, INTROS, STORY_ONCE, THREAD_OPENS, greetingFor, shipPick, topicsOf } from '../src/meta/onboarding';
import { ally, finish, newCampaign, plan, targets, type CampaignState } from '../src/meta/campaign';
import type { RunReport } from '../src/meta/goals';

const ROOT = path.resolve(__dirname, '..');
const ABS = (rel: string) => path.join('C:\\Users\\Merry\\dev\\space-derelict\\games\\broodfall', rel.replace(/\//g, '\\'));
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

type Author = 'collins' | 'draft' | 'lore';
interface Line { id: string; text: string[]; faces?: string[]; ctx?: string[]; author: Author; aside?: string; hook?: string }
/** One case of a step (won / lost / held), or words that are not hers but fix the order (the boss's transmission). */
interface Branch { label?: string; lines?: Line[]; context?: { who: string; lines: string[]; where: string } }
/** One event of a campaign, in the order he meets them; what happens, then what she says there. */
interface Step { id: string; part: string; name: string; what: string; where: string; branches: Branch[]; video?: { src: string; poster: string; seconds: number }; clips?: { src: string; label: string }[] }

/** Which greetings are Collins's own words (the comments in content/greetings.ts say so). */
const COLLINS_GREETINGS = new Set(['first-lost', 'first-won', 'unlock', 'mate-review', 'catgirl', 'back-5', 'won-19', 'won-20', 'back-11', 'back-12', 'won-21', 'won-22', 'back-13', 'back-14', 'back-15']);
/** The first lines of the Earth news are his (Oct 12 2026: he rewrote the list on this page; the rest were written to match). */
const COLLINS_NEWS = 12;
/** Later lines of the news that are his, by their number on the page (23: the Lipptors, Oct 14 2026). */
const COLLINS_NEWS_ALSO = new Set([22]);

const greeting = (g: Greeting, ctx?: string): Line => ({
  id: g.id, author: COLLINS_GREETINGS.has(g.id) ? 'collins' : 'draft',
  text: g.beats.map((b) => b.say),
  faces: g.beats.map((b) => [b.face ?? 'calm', ...(b.then ? (Array.isArray(b.then) ? b.then : [b.then]).map((c) => `then ${c}`) : [])].join(' · ')),
  ctx: ctx ? [ctx] : undefined,
  aside: g.aside, hook: g.hook,
});
/** A line of news as the beats she plays it in (a "[shrug]" in the text splits it). */
const newsLine = (n: { text: string; aside?: string }, i: number): Line => {
  const beats = newsBeats(n.text);
  return { id: `earth-${i + 1}`, text: beats.map((b) => b.say), faces: beats.map((b) => `${b.face ?? 'calm'} · then ${b.then}`), author: i < COLLINS_NEWS || COLLINS_NEWS_ALSO.has(i + 1) ? 'collins' : 'draft', aside: n.aside };
};
/** Lines in order, but never two running on one topic (as the game plays them: onboarding.ts pickGreeting's `avoid`). */
function apart(gs: Greeting[]): Greeting[] {
  const topics = (g: Greeting) => topicsOf([g.beats.map((b) => b.say).join(' '), g.aside ?? ''].join(' '));
  const left = [...gs];
  const out: Greeting[] = [];
  while (left.length) {
    const prev = out.length ? topics(out[out.length - 1]) : [];
    const i = left.findIndex((g) => !topics(g).some((t) => prev.includes(t)));
    out.push(...left.splice(i < 0 ? 0 : i, 1));
  }
  return out;
}
/** A pool's lines; the ones held back (`notBefore`) go last, latest last, and say what they wait for. */
const of = (moment: GreetMoment, ids?: string[]): Line[] => {
  const now = GREETINGS.filter((g) => g.moment === moment && (!ids || ids.includes(g.id)));
  const held = now.filter((g) => g.notBefore).sort((a, b) => a.notBefore! - b.notBefore!);
  return [...apart(now.filter((g) => !g.notBefore)), ...held]
    .map((g) => greeting(g, g.notBefore ? `HELD BACK: not before capture ${g.notBefore}, then in the shuffle with the rest` : undefined));
};
const plain = (prefix: string, texts: string[], author: Author, ctx?: string[]): Line[] => texts.map((t, i) => ({ id: `${prefix}-${i + 1}`, text: [t], author, ctx: ctx ? [ctx[i]] : undefined }));

/** The list items under a heading of the lore book (quotes taken off), as earthNewsFrom reads them. */
function loreList(lore: string, heading: RegExp): string[] {
  const lines = lore.split(/\r?\n/);
  const at = lines.findIndex((l) => /^#{1,6}\s/.test(l) && heading.test(l));
  if (at < 0) return [];
  const level = (lines[at].match(/^#+/) ?? ['#'])[0].length;
  const out: string[] = [];
  let cur = '';
  const flush = () => { if (cur.trim().length > 8) out.push(cur.replace(/^["“”']+|["“”']+$/g, '').replace(/\s+/g, ' ').trim()); cur = ''; };
  for (let i = at + 1; i < lines.length; i++) {
    const h = lines[i].match(/^(#+)\s/);
    if (h && h[1].length <= level) break;
    const m = lines[i].match(/^\s*(?:[-*]|\d+[.)])\s+(.+?)\s*$/);
    if (m) { flush(); cur = m[1]; } else if (cur && /^\s{2,}\S/.test(lines[i])) cur += ' ' + lines[i].trim(); else if (cur) flush();
  }
  flush();
  return out;
}
/** The scripted AI Core openers: "- trigger: "line"". */
function seeds(lore: string): Line[] {
  return loreList(lore, /Scenario seeds/).map((t) => {
    const m = t.match(/^([\w-]+):\s*(.+)$/);
    return { id: `seed-${m ? m[1] : 'x'}`, text: [m ? m[2].replace(/^["“”']+|["“”']+$/g, '') : t], author: 'draft', ctx: [m ? `trigger: ${m[1]}` : ''] };
  });
}
/** Lines in loader.ts and yokePlayer.ts, read from the source (they are UI modules). */
function arrayIn(src: string, name: string): string[] {
  const m = src.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  if (!m) return [];
  return [...m[1].matchAll(/^\s*(['"])(.*?)\1,?\s*$/gm)].map((x) => x[2].replace(/\\'/g, "'"));
}

const lore = read('content/lore/ship-ai-lorebook.md');
const loader = read('src/ui/loader.ts');
const news = earthNews(lore);
const G = (rel: string) => ABS(rel);
const GREET = G('content/greetings.ts');
const LORE = G('content/lore/ship-ai-lorebook.md');
const one = (lines: Line[]): Branch[] => [{ lines }];

/** When each intro can play, said in full on its line. */
const introNeeds: Record<string, string> = {
  'intro-dad': ', and only after the mate review',
  'intro-catgirl': ', and only after the neko has opened (rank 1)',
};
const introLine = (i: (typeof INTROS)[number]): Line =>
  greeting(GREETINGS.find((g) => g.id === i.id)!, `TRIGGER: from capture ${i.captures}${introNeeds[i.id] ?? ''}`);
const introOrder = INTROS.map((i) => `${i.id} (capture ${i.captures})`).join(', ');
/** What sets off each letter beat (src/meta/onboarding.ts LETTER_BEATS). */
const LETTER_TRIGGER: Record<string, string> = {
  'letter-atlas-direct': 'TRIGGER: the companion\'s regard has reached the point where she hands the thread over, so Atlas writes to him herself (the end of the letters minigame with the companion; never the opening of the thread)',
  'letter-rook-orca': 'TRIGGER: he has just learnt, in the Letters room, that Rook is part orca (he asked about her skin)',
};

// THE ORDER OF THE PAGE (Collins, Oct 18 2026: "you separated the lines YOKE gets by... theme? it makes it very hard to tell
// what order they come in. We should have just the unique lines at the beginning, then a list of lines by when they appear
// in order, then finally the lines triggered by specific things based on their hierarchy, and a description of what
// triggers each"). The hierarchy is src/meta/onboarding.ts greetingFor and momentNow, read top to bottom.
const PART_STORY = 'Part 1. The story lines: each plays once a campaign, in this order';
const PART_EVERY = 'Part 2. Her everyday after-mission lines: what she says when nothing in part 3 is due';
const PART_TRIG = 'Part 3. Triggered lines, by rank: when two are due on one return, the higher rank plays and the other waits for the next return';

/**
 * Two campaigns played out in code (Collins, Oct 19 2026: "think about ordering, how do we handle this"): which line she
 * says on each return, so the order can be read off the page. He sides with a faction as soon as the desk opens and wins
 * about two missions in three; the Letters room is left alone, so its follow-ups do not show.
 */
function sample(seed: number): string[] {
  const stats = { kills: {}, killsByFamily: {}, killsByCause: {}, healed: 0, limbsGrown: 0, evolutions: 0, limbsLost: 0, cannibalized: 0, coreMinFrac: 1, depositsClaimed: 0, earlyCalls: 0, maxLimbs: 0, maxBurning: 0, maxPips: 0, families: [], pacifistWaves: 0, lastWaveKillsByCause: {}, royalsEaten: 0, matingStuns: 0, limbsCarriedOff: 0, gateBurnKills: 0, royalsCaptured: 0, nodesPlaced: 0, nodesLost: 0 } as unknown as RunReport['stats'];
  const run = (won: boolean): RunReport => ({ won, wavesCleared: won ? 5 : 2, coreEndFrac: won ? 0.8 : 0, scienceBanked: 0, stats });
  let s: CampaignState = newCampaign(seed, { onboarding: true });
  let r = (seed * 9301 + 49297) % 233280;
  const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const out: string[] = [];
  for (let i = 1; i <= 30 && !s.ended; i++) {
    const won = i === 1 ? rnd() < 0.5 : rnd() < 0.67;
    const t = targets(s); const pick = shipPick(s, t) ?? t[0];
    if (!pick) break;
    s = finish(s, plan(s, pick), run(won)).state;
    if (!s.faction && s.onboard?.deskOpen && s.captures >= 1) s = ally(s, 'faithful');
    const { moment, greeting } = greetingFor(s, lore);
    const rec = EARLY_ONCE.includes(moment) || STORY_ONCE.some((b) => b.id === moment) || THREAD_OPENS.some((x) => x.id === moment);
    s = { ...s, greet: null, lastGreeting: greeting.id, said: rec ? [...(s.said ?? []), moment] : s.said, greetingsSaid: [...new Set([...(s.greetingsSaid ?? []), greeting.id])] };
    out.push(`${i}. ${won ? 'won' : 'lost'}, capture ${s.captures}: ${greeting.id}: "${greeting.beats[0].say.slice(0, 80)}${greeting.beats[0].say.length > 80 ? '…' : ''}"`);
  }
  return out;
}

const steps: Step[] = [
  { id: 'first', part: PART_STORY, name: 'Her first greeting', where: GREET,
    what: 'TRIGGER: mission 1 is over, won or lost. The plain report of it, then the reveal (the ship fires the asset: "...AND YOU ARE THE ONE WHO SENT IT"), then the ship for the first time and this. It ends by lighting the Gene Bay for him.',
    branches: [{ label: 'If he won mission 1', lines: of('first-won') }, { label: 'If he lost mission 1', lines: of('first-lost') }] },
  { id: 'boss', part: PART_STORY, name: 'The message from the boss', where: G('content/boss.ts'),
    what: 'TRIGGER: straight after that first greeting, won or lost. Her bridge into it, then Supervisor Barnabas on the screen (his words below, not hers), then her line after him.',
    branches: [
      { lines: [{ id: 'BOSS_BRIDGE', text: [BOSS_BRIDGE], author: 'draft', faces: ['surprised'] }] },
      { context: { who: `${BOSS.name}, on the screen`, lines: BOSS.lines, where: G('content/boss.ts') } },
      { lines: [{ id: 'BOSS_AFTER', text: [BOSS_AFTER], author: 'draft', faces: ['teasing'], aside: BOSS_ASIDE }] },
    ] },
  { id: 'mate', part: PART_STORY, name: 'The mate review', where: GREET,
    what: 'TRIGGER: the next return after mission 1, whatever happened on it (only the desk opening comes before it). Atlas, the Board\'s candidate, the first love interest, on purpose early. Every return from here on: the report comes up at the desk (she says nothing there), then the planet\'s news, the Roach King\'s address when one is due, then her greeting. It points him at the data pad in his quarters, where the candidate\'s profile is.',
    branches: one(of('mate-review')) },
  { id: 'unlock', part: PART_STORY, name: 'The desk opens', where: GREET,
    what: 'TRIGGER: the first win after mission 1, on the second try or the twentieth. The Directive Desk lights up and the three groups call; she sends him there.',
    branches: one(of('unlock')) },
  { id: 'signals', part: PART_STORY, name: 'At the desk, ANSWER THEM: the three signals', where: G('content/campaign.ts') + '  (each faction\'s `contact` scene)',
    what: 'TRIGGER: the desk is open. Each group has a card at the Directive Desk with her lines written on it, all at once, above the ANSWER THEM button (the first contact film plays when he presses it). One card per group, read together, not two messages.',
    // One row per card (Collins, Oct 18 2026, of two rows a faction: "when do you get the second message?"): the card shows them together.
    branches: one(FACTIONS.filter((f) => f.contact).map((f) => {
      const yoke = f.contact!.lines.filter((l: string) => l.startsWith('YOKE:')).map((l: string) => l.replace(/^YOKE:\s*/, ''));
      return { id: `${f.id}-contact`, text: yoke, author: 'draft' as Author, ctx: [`${f.name}: "${f.contact!.title}", on its card at the desk`] };
    })) },

  { id: 'outcome', part: PART_EVERY, name: 'Her everyday talk: one pool, won or lost', where: GREET,
    what: 'TRIGGER: any ordinary return with nothing in part 3 due: mission, her line, mission, her line (Collins, Oct 19 2026). Won or lost makes no difference once the desk is open. The pool is shuffled by the campaign\'s seed and each line is said once a campaign, so every campaign hears them in a different order, and a pool bigger than a campaign means a replay hears lines the last one did not. One return in three she gives a line of news from Earth instead (below). Two kinds of return keep lines of their own: a loss before the desk opens, and a counter-attack, since those say what happened.',
    branches: [
      { label: 'Any return once the desk is open (and back aboard from the menu)', lines: of('talk') },
      { label: 'A loss before the desk opens (until he wins once; the last one repeats)', lines: of('lost-locked') },
      { label: 'A counter-attack thrown back', lines: of('defended') },
      { label: 'Ground lost to a counter-attack', lines: of('fell') },
    ] },
  { id: 'news', part: PART_EVERY, name: 'News from Earth: in place of the line above, one return in three', where: LORE + '  (section "Earth news (return greetings)"; the fallback line: ' + GREET + ')',
    what: `TRIGGER: one ordinary return in ${EARTH_NEWS_EVERY} with nothing in part 3 due, once the desk is open and the mate review has played; also whenever her own lines for that kind of return have all been said this campaign, so she never repeats a line while unread news is left. These are ordinary after-mission lines like the ones above, each once a campaign. The list grows in the lore book with no code.`,
    branches: one(news.map(newsLine)) },

  { id: 'letterbeats', part: PART_TRIG, name: 'Rank 1. The love interests, drip-fed', where: GREET + '  (when: ' + G('src/meta/onboarding.ts') + ' THREAD_OPENS, LETTER_BEATS)',
    what: 'TRIGGER: each says its own. Atlas comes first, at the mate review (part 1). The others open one at a time in a window counted from the capture on which he sided with a faction; the exact capture is picked by the campaign\'s seed, so every campaign meets them at a different point. After that, a line follows what he does in the Letters room, on the very next return. At most one of these a return and never two returns running, the mate review included: one held back plays on the next return.',
    branches: [
      { label: 'Openings', lines: THREAD_OPENS.map((t) => greeting(GREETINGS.find((g) => g.id === t.id)!, `TRIGGER: ${t.after} to ${t.until} captures after he sides with a faction (seeded per campaign)${t.id === 'catgirl' ? '; it lights the data pad and opens Mirelle\'s thread' : '; it opens Rook\'s thread in the Letters room'}`)) },
      { label: 'Then, from the Letters room', lines: ['letter-atlas-direct', 'letter-rook-orca'].map((id) => greeting(GREETINGS.find((g) => g.id === id)!, LETTER_TRIGGER[id])) },
    ] },
  { id: 'intros', part: PART_TRIG, name: 'Rank 2. The once intros, in this order', where: GREET + '  (order and captures: ' + G('src/meta/onboarding.ts') + ' INTROS)',
    what: `TRIGGER: an ordinary return with nothing of rank 1 due; each once a campaign, the next one not yet said whose capture has been reached, and never on two returns running (so her everyday lines still come between). A lost mission does not bring one back. Order: ${introOrder}. Each line says what it waits for.`,
    branches: one(INTROS.map(introLine)) },

  { id: 'samples', part: PART_TRIG, name: 'How it plays: two campaigns, return by return', where: G('src/meta/onboarding.ts') + '  (greetingFor)',
    what: 'TRIGGER: none; this is a read-out. Two campaigns played in code with the rules above, to show the order: the mission, won or lost, the capture count after it, then the line she says. He sides with the Faithful the moment the desk opens. The two differ because the pool and the love-interest windows are seeded per campaign.',
    branches: [11, 42].map((seed) => ({ context: { who: `Campaign ${seed === 11 ? 'A' : 'B'} (seed ${seed})`, lines: sample(seed), where: 'played in code by tools/yoke-lines.ts each time the page is built' } })) },
  // Oct 26 2026: the small-talk pools, the data pad status, her translation band and notes, the money pop-up's words and
  // the AI Core's queued discussions and their openers are gone (Collins marked every one Remove).
];

/**
 * THE FILMS (Collins, Oct 18 2026: "the latest yoke lines and cinematics ... I want to get to work on finishing those"):
 * every filmed scene (content/campaign.ts beats / pledge / ending, content/roachKing.ts ROACH_SCENES), in the order a
 * player meets them, one line per spoken shot, with the baked film (public/media/scenes/<film>.mp4) playable on the page.
 * Line ids are `film-<film>-<n>` (n from 1). An edit here is to the scene's line in its file; a changed line is no longer
 * what the film says, so the film is re-shot: `npx vite-node tools/media/cutscenes.ts -- make <film>` (SPENDS RFab tokens).
 */
const PART_FILMS = 'Part 4. The films: every cut scene, in the order he meets them';
type Baked = { video: string; poster: string; seconds: number; cues: { line?: number; text?: string }[] };
const BAKED = ((): Record<string, Baked> => { try { return JSON.parse(read('public/media/scenes/scenes.json')).films ?? {}; } catch { return {}; } })();
const norm = (t: string) => t.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
function filmStep(film: string, sc: Scene, name: string, what: string, where: string): Step {
  const b = BAKED[film];
  const all = sc.lines.map((l, i) => {
    const who = speakerOf(l);
    return { i, line: { id: `film-${film}-${i + 1}`, text: [who ? l.slice(l.indexOf(':') + 1).trim() : l], ctx: [who || '(no speaker)'], author: 'collins' as Author } as Line };
  }).filter((x) => x.line.text[0].trim());
  const lines = all.map((x) => x.line);
  // A line the baked film does not say as written (rewritten since the bake, or added): the film needs re-shooting.
  const off = b ? all.filter(({ i, line }) => { const c = b.cues.find((q) => q.line === i); return norm(line.text[0]) && (!c || norm(c.text ?? '') !== norm(line.text[0])); }).length : 0;
  const state = !b ? ' NOT FILMED YET: the game shows its card with these lines.' : off ? ` ${off} line(s) no longer match the film: re-shoot it.` : '';
  return { id: `film-${film}`, part: PART_FILMS, name: `${name}: "${sc.title}"`, what: what + state, where: `${where}  ·  shot list: ${G('content/cutscenes.ts')} (${film})`,
    branches: one(lines), video: b ? { src: b.video, poster: b.poster, seconds: Math.round(b.seconds) } : undefined };
}
const THE: Record<string, string> = { delegation: 'the Delegation', faithful: 'the Faithful', institute: 'the Institute' };
for (const f of FACTIONS) {
  const them = THE[f.id] ?? f.name;
  f.beats.forEach((bt, i) => {
    if (!bt.scene.film) return;
    steps.push(filmStep(bt.scene.film, bt.scene, `${f.name}, ${i === 0 ? 'first interaction' : `beat ${i + 1}`}`,
      i === 0 ? `The first time he answers ${them}' signal at the Directive Desk (or when he first sides with them, if he never answered).`
        : `Plays once he has taken ${bt.afterCaptures} captures working with ${them}.` + (bt.choice ? ` Ends on a choice: ${bt.choice.prompt}` : ''),
      G('content/campaign.ts') + `  (${f.id} beats, "${bt.id}")`));
  });
  if (f.pledge.film) steps.push(filmStep(f.pledge.film, f.pledge, `${f.name}, the pledge`, `His broadcast when he sides with ${them} publicly.`, G('content/campaign.ts') + `  (${f.id} pledge)`));
  if (f.ending.film) steps.push(filmStep(f.ending.film, f.ending, `${f.name}, the finale`, `The ending, if he finishes the campaign on the side of ${them}.`, G('content/campaign.ts') + `  (${f.id} ending)`));
}
for (const r of ROACH_SCENES) if (r.scene.film) steps.push(filmStep(r.scene.film, r.scene, `The Roach King, ${r.small}`, `${r.kicker}. Plays at "${r.when}". After it: ${r.end}.`, G('content/roachKing.ts') + `  (ROACH_SCENES "${r.id}")`));

// YOKE prints herself a body (content/yokeScenes.ts): a cut scene of its own, played only if he asks for it (Collins, Oct 26 2026:
// "should probably be a cut scene that can be chosen if you engage with the print a body option"). Its clips play in order.
const PRINT_CLIPS = ((): { id: string; file: string }[] => { try { return JSON.parse(read('public/art/ship/yoke/manifest.json')).scenes?.printBody ?? []; } catch { return []; } })();
steps.push({ id: 'film-print-body', part: PART_FILMS, name: 'YOKE prints herself a body (only if he asks)', where: G('content/yokeScenes.ts') + '  (PRINT_BODY; clips: ' + G('public/art/ship/yoke/scenes') + ')',
  what: 'TRIGGER: he asks her, over the intercom, to print herself a body, or to meet her in the flesh (or her live mind agrees to it). Once a campaign. The four clips play in order, then her line from the ship\'s speakers. Asked again in the same campaign, she refuses instead.',
  clips: PRINT_CLIPS.map((c) => ({ src: 'art/ship/yoke/' + c.file, label: c.id })),
  branches: [
    { context: { who: 'The shots, in order (what each clip shows)', lines: PRINT_BODY.stages.map((st, k) => `${k + 1}. ${st.card}`), where: G('content/yokeScenes.ts') + '  (PRINT_BODY.stages)' } },
    { label: 'Her voice from the speakers, over the last shot', lines: [{ id: 'PRINT_BODY.line', text: [PRINT_BODY.line], author: 'collins' }] },
    { label: 'If he asks again, the same campaign', lines: [{ id: 'PRINT_BODY.refusal', text: [PRINT_BODY.refusal], author: 'draft' }] },
  ] });

/** The exports a session has applied (notes/yoke-exports/*.json, each a document from the page's store with "applied" added):
 *  their fingerprints clear the same edits from his browser on his next visit. One not yet applied leaves its edits alone. */
const EXPORTS = path.join(ROOT, 'notes', 'yoke-exports');
const processed = new Set<string>();
for (const f of fs.existsSync(EXPORTS) ? fs.readdirSync(EXPORTS).filter((n) => n.endsWith('.json')).sort() : []) {
  const j = JSON.parse(fs.readFileSync(path.join(EXPORTS, f), 'utf8')) as { applied?: string; items?: { fp?: string }[] };
  if (!j.applied) continue;
  for (const it of j.items ?? []) if (it.fp) processed.add(it.fp);
}

/** When each line took its current wording: unchanged words keep their date, new or rewritten ones get today. */
const SEEN = path.join(ROOT, 'notes', 'yoke-lines-seen.json');
const builtAt = new Date().toISOString();
const hash = (t: string[]) => { const s = t.join('\u0001'); let x = 5381; for (let i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0; return x.toString(36); };
const seen = (fs.existsSync(SEEN) ? JSON.parse(fs.readFileSync(SEEN, 'utf8')) : { lines: {} }) as { note?: string; lines: Record<string, { hash: string; since: string; baseline?: boolean }> };
const seenNext: typeof seen.lines = {};
for (const s of steps) for (const b of s.branches) for (const l of b.lines ?? []) {
  const hsh = hash(l.text), was = seen.lines[l.id];
  seenNext[l.id] = was && was.hash === hsh ? was : { hash: hsh, since: builtAt };
  (l as Line & { since?: string; baseline?: boolean }).since = seenNext[l.id].since;
  if (seenNext[l.id].baseline) (l as Line & { baseline?: boolean }).baseline = true;
}
fs.writeFileSync(SEEN, JSON.stringify({ note: seen.note ?? 'When each line took its current wording (tools/yoke-lines.ts keeps it).', lines: seenNext }, null, 1));

const data = {
  asOf: builtAt.slice(0, 10),
  builtAt,
  files: [
    { what: 'Her greetings (every return), the report lines, the Earth-news fallback', path: ABS('content/greetings.ts') },
    { what: 'When each greeting plays (the moments, the once intros, the news rule)', path: ABS('src/meta/onboarding.ts') },
    { what: 'Earth news and the lore-book pools', path: ABS('content/lore/ship-ai-lorebook.md') },
    { what: 'The three signals\' contact cards', path: ABS('content/campaign.ts') },
    { what: 'The boss\'s message', path: ABS('content/boss.ts') },
    { what: 'Print a body', path: ABS('content/yokeScenes.ts') },
    { what: 'Her notes and her band', path: ABS('content/translation.ts') },
    { what: 'When the money stops', path: ABS('src/meta/yokePlayer.ts') },
    { what: 'While she dances', path: ABS('src/ui/loader.ts') },
    { what: 'The films\' words (beats, pledges, finales)', path: ABS('content/campaign.ts') },
    { what: 'The Roach King\'s films\' words', path: ABS('content/roachKing.ts') },
    { what: 'How each film is shot (the shot lists)', path: ABS('content/cutscenes.ts') },
    { what: 'The baked films', path: ABS('public/media/scenes') },
    { what: 'This page is made by', path: ABS('tools/yoke-lines.ts') },
    { what: 'Exports a session applied (each clears its edits from this page)', path: ABS('notes/yoke-exports') },
    { what: 'The review (edits, cuts, notes, ticks, exports) the page saves', path: ABS('notes/yoke-review.json') },
    { what: 'The page, served on this PC (http://localhost:8792/)', path: ABS('tools/yoke-review-server.cjs') },
    { what: 'When each line took its current wording (the "new" marks)', path: ABS('notes/yoke-lines-seen.json') },
  ],
  steps: steps.map((s, i) => ({ ...s, n: i + 1 })),
  processed: [...processed],
};

const template = read('tools/yoke-lines.template.html');
const json = JSON.stringify(data).replace(/</g, '\\u003c');
const out = path.join(ROOT, 'notes', 'YOKE-LINES.html');
fs.writeFileSync(out, template.replace('__DATA__', json));
const count = (s: Step) => s.branches.reduce((a, b) => a + (b.lines?.length ?? 0), 0);
const total = steps.reduce((a, s) => a + count(s), 0);
const ids = new Set<string>();
for (const s of steps) for (const b of s.branches) for (const l of b.lines ?? []) { if (ids.has(l.id)) throw new Error(`line id twice: ${l.id}`); ids.add(l.id); }
console.log(`${out}: ${total} lines in ${steps.length} steps; ${processed.size} applied edits will clear from the page`);
for (const s of data.steps) console.log(`  ${String(s.n).padStart(2)}. ${String(count(s)).padStart(3)}  ${s.name}`);
