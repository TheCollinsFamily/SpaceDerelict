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
 * The old claude.ai copy below is RETIRED (it says so on the page); do not republish it.
 * Old copy: https://claude.ai/artifact/CbXWLvxqcNYzq4GhjmS1Ye (keep the link: publish with the Artifact tool and
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
import { EARTH_NEWS_FALLBACK, GREETINGS, earthNews, newsBeats, type GreetMoment, type Greeting } from '../content/greetings';
import { PRINT_BODY } from '../content/yokeScenes';
import { BOSS, BOSS_AFTER, BOSS_ASIDE, BOSS_BRIDGE } from '../content/boss';
import { CHANNELS, TRANSLATOR_NOTES } from '../content/translation';
import { FACTIONS, LICENCE_STANDING, type Scene } from '../content/campaign';
import { ROACH_SCENES } from '../content/roachKing';
import { speakerOf } from '../content/media';
import { EARLY_ONCE, EARTH_NEWS_EVERY, INTROS, STORY_ONCE } from '../src/meta/onboarding';

const ROOT = path.resolve(__dirname, '..');
const ABS = (rel: string) => path.join('C:\\Users\\Merry\\dev\\space-derelict\\games\\broodfall', rel.replace(/\//g, '\\'));
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

type Author = 'collins' | 'draft' | 'lore';
interface Line { id: string; text: string[]; faces?: string[]; ctx?: string[]; author: Author; aside?: string; hook?: string }
/** One case of a step (won / lost / held), or words that are not hers but fix the order (the boss's transmission). */
interface Branch { label?: string; lines?: Line[]; context?: { who: string; lines: string[]; where: string } }
/** One event of a campaign, in the order he meets them; what happens, then what she says there. */
interface Step { id: string; part: string; name: string; what: string; where: string; branches: Branch[]; video?: { src: string; poster: string; seconds: number } }

/** Which greetings are Collins's own words (the comments in content/greetings.ts say so). */
const COLLINS_GREETINGS = new Set(['first-lost', 'first-won', 'unlock', 'mate-review', 'catgirl', 'back-5', 'won-19', 'won-20', 'back-11', 'back-12', 'won-21', 'won-22', 'back-13', 'back-14', 'back-15']);
/** The first lines of the Earth news are his (Oct 12 2026: he rewrote the list on this page; the rest were written to match). */
const COLLINS_NEWS = 9;
/** Later lines of the news that are his, by their number on the page (23: the Lipptors, Oct 14 2026). */
const COLLINS_NEWS_ALSO = new Set([23]);

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
const of = (moment: GreetMoment, ids?: string[]): Line[] => GREETINGS.filter((g) => g.moment === moment && (!ids || ids.includes(g.id))).map((g) => greeting(g));
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
/** "Her lines, by mood": a bold mood, then quoted lines under it. */
function moodLines(lore: string): Line[] {
  const lines = lore.split(/\r?\n/);
  const at = lines.findIndex((l) => /^## 12\. Her lines, by mood/.test(l));
  const out: Line[] = [];
  let mood = '', cur = '', n = 0;
  const flush = () => { if (cur) { out.push({ id: `mood-${mood}-${++n}`, text: [cur.replace(/^["“”']+|["“”']+$/g, '').replace(/\s+/g, ' ').trim()], author: 'lore', ctx: [mood] }); cur = ''; } };
  for (let i = at + 1; i < lines.length && !/^## /.test(lines[i]); i++) {
    const m = lines[i].match(/^\*\*(\w+)\*\*/);
    if (m) { flush(); mood = m[1]; n = 0; continue; }
    const b = lines[i].match(/^\s*-\s+(.+?)\s*$/);
    if (b) { flush(); cur = b[1]; } else if (cur && /^\s{2,}\S/.test(lines[i])) cur += ' ' + lines[i].trim(); else if (cur) flush();
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
const player = read('src/meta/yokePlayer.ts');
const news = earthNews(lore);
const G = (rel: string) => ABS(rel);
const GREET = G('content/greetings.ts');
const LORE = G('content/lore/ship-ai-lorebook.md');
const one = (lines: Line[]): Branch[] => [{ lines }];

/** The intros, each with when it can first play. */
const introLine = (i: (typeof INTROS)[number]): Line => {
  const needs = i.id === 'intro-duck' ? ', only if mission 1 was won' : i.id === 'intro-catgirl' ? ', after the cat girl wrote (step 5)' : i.id === 'intro-genewar' ? ', after the second cat girl line' : i.id === 'intro-dad' ? ', after the personal plot (step 9)' : '';
  return greeting(GREETINGS.find((g) => g.id === i.id)!, `from capture ${i.captures}${needs}`);
};
const introOrder = INTROS.map((i) => `${i.id} (capture ${i.captures})`).join(', ');
const story = STORY_ONCE[0];

const PART_FIRST = 'The first return: mission 1 is over';
const PART_DARK = 'Every return after that, until the desk opens: the ship picks the targets';
const PART_CAMPAIGN = 'The campaign: every ordinary return, in this order of precedence';
const PART_ANY = 'Any time';
const PART_MIND = 'Her live mind: pools not tied to a moment';

const steps: Step[] = [
  { id: 'first', part: PART_FIRST, name: 'Her first greeting', where: GREET,
    what: 'Mission 1 is over, won or lost. The plain report of it, then the reveal (the ship fires the asset: "...AND YOU ARE THE ONE WHO SENT IT"), then the ship for the first time and this. Once a campaign. It ends by lighting the Gene Bay for him.',
    branches: [{ label: 'If he won mission 1', lines: of('first-won') }, { label: 'If he lost mission 1', lines: of('first-lost') }] },
  { id: 'boss', part: PART_FIRST, name: 'The message from the boss', where: G('content/boss.ts'),
    what: 'Straight after that first greeting, won or lost: her bridge into it, then Supervisor Barnabas on the screen (his words below, not hers), then her line after him.',
    branches: [
      { lines: [{ id: 'BOSS_BRIDGE', text: [BOSS_BRIDGE], author: 'draft', faces: ['surprised'] }] },
      { context: { who: `${BOSS.name}, on the screen`, lines: BOSS.lines, where: G('content/boss.ts') } },
      { lines: [{ id: 'BOSS_AFTER', text: [BOSS_AFTER], author: 'draft', faces: ['teasing'], aside: BOSS_ASIDE }] },
    ] },

  { id: 'mate', part: PART_DARK, name: 'The first ordinary return: the mate review', where: GREET,
    what: 'Every return from the second deployment on: the report of it comes up at the desk (she says nothing there, since Oct 14 2026), then the planet\'s news (a newsreel or one of their papers), the Roach King\'s address when one is due, and he is aboard: her greeting, picked from the steps from here on. The first return with nothing weightier to say (a loss while the desk is dark, or the first return after it opened) gets this one in place of the ordinary line. Once. It points him at the data pad in his quarters, where the candidate\'s profile is.',
    branches: one(of('mate-review')) },
  { id: 'catgirl', part: PART_DARK, name: 'The ordinary return after that: the cat girl', where: GREET,
    what: 'The next ordinary return, playing off the mate review. Once. It lights the data pad again.',
    branches: one(of('catgirl')) },
  { id: 'locked', part: PART_DARK, name: 'A loss while the desk is still dark', where: GREET,
    what: 'Every loss before the first win after mission 1, once the two beats above have played. One she has not said this campaign while there is one; when all four are said, the last one again, every time, until he wins.',
    branches: one(of('lost-locked')) },
  { id: 'unlock', part: PART_DARK, name: 'The first win after mission 1: the desk opens', where: GREET,
    what: 'The return after the first ground taken, on the second try or the twentieth. Once. The Directive Desk lights up and the three factions call; she sends him there.',
    branches: one(of('unlock')) },
  { id: 'signals', part: PART_DARK, name: 'At the desk, ANSWER THEM: the three signals', where: G('content/campaign.ts') + '  (each faction\'s `contact` scene)',
    what: 'On a signal at the Directive Desk, her two lines open the group\'s contact card before its first scene. Three groups, three cards.',
    branches: one(FACTIONS.flatMap((f) => (f.contact?.lines ?? []).filter((l: string) => l.startsWith('YOKE:')).map((l: string, i: number) => ({ id: `${f.id}-contact-${i + 1}`, text: [l.replace(/^YOKE:\s*/, '')], author: 'draft' as Author, ctx: [`${f.name}: "${f.contact!.title}"`] })))) },

  { id: 'personal', part: PART_CAMPAIGN, name: `From capture ${story.captures}, once: the personal plot`, where: GREET,
    what: `The first ordinary return on or after capture ${story.captures}: how it is going with the partner the Index assigned him. Once. It also opens the discussion in the AI Core (him going down to the Index to sign). Outranks the intros and the news below.`,
    branches: one(of('partner-progress')) },
  { id: 'intros', part: PART_CAMPAIGN, name: 'The once intros, in this order', where: GREET + '  (order and captures: ' + G('src/meta/onboarding.ts') + ' INTROS)',
    what: `Each once a campaign, from its capture on, the next unsaid one in this order, never two returns running (so her ordinary lines still come between), and a lost mission does not bring one back: ${introOrder}. Each line says what it waits for.`,
    branches: one(INTROS.map(introLine)) },
  { id: 'letterbeats', part: PART_CAMPAIGN, name: 'On the letters, once each', where: GREET + '  (when: ' + G('src/meta/onboarding.ts') + ' LETTER_BEATS)',
    what: 'The first ordinary return after a turn in the Letters room, ahead of the intros: Rook\'s first letter arrives; Atlas writes herself; Rook tells him she is part orca (he asked about her skin), before the briefing.',
    branches: one(['letter-rook', 'letter-atlas-direct', 'letter-rook-orca'].map((id) => greeting(GREETINGS.find((g) => g.id === id)!))) },
  { id: 'news', part: PART_CAMPAIGN, name: 'News from Earth', where: LORE + '  (section "Earth news (return greetings)"; the fallback line: ' + GREET + ')',
    what: `One ordinary return in ${EARTH_NEWS_EVERY}, once the desk is open and the mate review and the cat girl have played; and whenever her own lines for the moment have all been said this campaign, so she never repeats a line while unread news remains. Each line once a campaign. The list grows in the lore book with no code.`,
    branches: one([...news.map(newsLine), { id: 'EARTH_NEWS_FALLBACK', text: EARTH_NEWS_FALLBACK, author: 'collins', ctx: ['when the lore book has no list'] }]) },
  { id: 'outcome', part: PART_CAMPAIGN, name: 'Otherwise: by what the deployment did', where: GREET,
    what: 'The ordinary line, when no step above takes the return. The weightiest thing that happened picks the pool: a counter-attack thrown back, ground lost to one, ground taken, a loss; from the main menu with nothing new, the last pool. Within a pool, a line she has not said this campaign while there is one, never the last one said.',
    branches: [
      { label: 'A counter-attack thrown back', lines: of('defended') },
      { label: 'Ground lost to a counter-attack', lines: of('fell') },
      { label: 'A deployment won', lines: of('won') },
      { label: 'A deployment lost', lines: of('lost') },
      { label: 'Back aboard from the menu, nothing new', lines: of('back') },
    ] },
  { id: 'licence', part: PART_CAMPAIGN, name: `Standing reaches ${LICENCE_STANDING}: the licence`, where: GREET,
    what: 'The return on which the Board approves the procreation licence. Once; it outranks every step above but the end.',
    branches: one(of('licence')) },
  { id: 'ended', part: PART_CAMPAIGN, name: 'The last mission won: the end', where: GREET,
    what: 'The return that ends the campaign. Once; it outranks everything.',
    branches: one(of('ended')) },

  { id: 'body', part: PART_ANY, name: 'Print a body', where: G('content/yokeScenes.ts'),
    what: 'When he asks her to print herself a body (or her live mind agrees to it): the hold prints one, it dies on the floor, then her voice from the speakers. Once a campaign; asked again, the refusal.',
    branches: one([{ id: 'PRINT_BODY.line', text: [PRINT_BODY.line], author: 'collins' }, { id: 'PRINT_BODY.refusal', text: [PRINT_BODY.refusal], author: 'draft' }, ...PRINT_BODY.stages.map((s) => ({ id: `PRINT_BODY.card.${s.id}`, text: [s.card], author: 'draft' as Author, ctx: ['a storyboard card until the clips exist'] }))]) },
  { id: 'money', part: PART_ANY, name: 'When the money stops', where: G('src/meta/yokePlayer.ts') + '  (cutOffLines)',
    what: 'Into his talk with her, once, when nobody pays for her live mind any more: the Directorate\'s free talk spent, the ship\'s daily allowance spent, or his own RFab account dry. Read, not heard. Then the scripted YOKE answers.',
    branches: one([
      ...plain('cut-topup', arrayIn(player, 'TOPUP').length ? arrayIn(player, 'TOPUP') : ['Your RFab account is dry, Operator. I cannot think on credit.', 'Top it up on rfab.ai and I am back.'], 'draft', ['his own account dry', 'his own account dry']),
      { id: 'cut-resting', text: ['The ship has stopped paying for my conversation today. Link your own RFab account and I will keep talking.'], author: 'draft', ctx: ['the ship\'s daily allowance spent'] },
      { id: 'cut-free-1', text: ['That is the end of what the Directorate pays for my conversation. They do not fund chat.'], author: 'draft', ctx: ['the free talk spent'] },
      { id: 'cut-free-2', text: ['Link your own RFab account and they add {N} free tokens ({$}) — {times} times what we have used. After that I run on your account, on whichever mind you pick for me.'], author: 'draft', ctx: ['the free talk spent (the numbers filled in)'] },
    ]) },
  { id: 'dance', part: PART_ANY, name: 'While she dances', where: G('src/ui/loader.ts') + '  (DANCE_LINES)',
    what: 'In type under her dancing, now and then in place of the scan on the ship\'s waits. Never twice in a row.',
    branches: one(plain('dance', arrayIn(loader, 'DANCE_LINES'), 'draft')) },
  { id: 'inbox', part: PART_ANY, name: 'On the data pad', where: G('content/partner.ts'),
    what: 'The status line on the cat girl\'s message in his inbox.',
    branches: one([{ id: 'partner.declined', text: ['DECLINED ON YOUR BEHALF BY YOKE. Reason given: "pound sand."'], author: 'draft' }]) },
  { id: 'notes', part: PART_ANY, name: 'Her notes under translated lines', where: G('content/translation.ts') + '  (TRANSLATOR_NOTES)',
    what: 'Read (never voiced) under a line of a scene\'s card whose words contain the match. A line rewritten so the words are gone loses its note.',
    branches: one(TRANSLATOR_NOTES.map((n, i) => ({ id: `note-${i + 1}`, text: [n.note], author: 'draft' as Author, ctx: [`under: "${n.match}"`] }))) },
  { id: 'band', part: PART_ANY, name: 'Her band over a scene', where: G('content/translation.ts') + '  (CHANNELS)',
    what: 'The source line of her rendering, over a scene\'s card: where the signal came from.',
    branches: one(Object.entries(CHANNELS).map(([k, c]) => ({ id: `band-${k}`, text: [c.source], author: 'draft' as Author, ctx: [`${k} · confidence ${c.confidence[0]}–${c.confidence[1]}%`] }))) },

  { id: 'seeds', part: PART_MIND, name: 'AI Core: the scripted openers', where: LORE + '  (section 4, Scenario seeds)',
    what: 'The scripted stand-in for her live mind opens a discussion in the AI Core with the seed for its trigger (first deployment, allied, the midpoint, the partner, the licence, the ending, idle). The live mind (Kimi or her avatar on rfab.ai) writes its own.',
    branches: one(seeds(lore)) },
  { id: 'mood', part: PART_MIND, name: 'Lorebook: her lines, by mood', where: LORE + '  (section 12)',
    what: 'Examples of her voice for each face her body has, for the live mind. Not wired to any moment.',
    branches: one(moodLines(lore)) },
  { id: 'smalltalk', part: PART_MIND, name: 'Lorebook: School, the Index, family life', where: LORE + '  (section 16)',
    what: 'Small-talk pool for the live mind. Not wired to any moment (the Earth news is the only lore-book pool the greetings read).',
    branches: one(plain('krypteia', loreList(lore, /School, the index, family life/), 'lore')) },
  { id: 'uplifts', part: PART_MIND, name: 'Lorebook: the uplifts', where: LORE + '  (section 16)',
    what: 'The boss, the elephants, the orcas, the cat girls: a small-talk pool for the live mind. Not wired.',
    branches: one(plain('uplift', loreList(lore, /The uplifts/), 'lore')) },
  { id: 'anai', part: PART_MIND, name: 'Lorebook: "An AI?"', where: LORE + '  (section 16)',
    what: 'What she says when called an AI; the last line is how her live mind agrees to print a body. Not wired.',
    branches: one(plain('anai', loreList(lore, /"An AI\?"/), 'lore')) },
  { id: 'c21', part: PART_MIND, name: 'Lorebook: the 21st century, with horror', where: LORE + '  (section 16)',
    what: 'Small-talk pool for the live mind. Not wired.',
    branches: one(plain('c21', loreList(lore, /The 21st century/), 'lore')) },
];

/**
 * THE FILMS (Collins, Oct 18 2026: "the latest yoke lines and cinematics ... I want to get to work on finishing those"):
 * every filmed scene (content/campaign.ts beats / pledge / ending, content/roachKing.ts ROACH_SCENES), in the order a
 * player meets them, one line per spoken shot, with the baked film (public/media/scenes/<film>.mp4) playable on the page.
 * Line ids are `film-<film>-<n>` (n from 1). An edit here is to the scene's line in its file; a changed line is no longer
 * what the film says, so the film is re-shot: `npx vite-node tools/media/cutscenes.ts -- make <film>` (SPENDS RFab tokens).
 */
const PART_FILMS = 'The films: every cut scene, in the order he meets them';
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
