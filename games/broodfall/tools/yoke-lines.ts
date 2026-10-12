/**
 * YOKE'S LINES, ON ONE PAGE (Collins, Oct 12 2026: "give me a list of what we have for yoke and where in a visual html
 * that's easy for me to parse through and clean up"). Every prewritten line of hers, grouped by when it plays, in the
 * order a campaign meets them, with where each lives; the page lets him edit a line in place, mark it cut or leave a
 * note, and export the changes as a list a session can apply. Re-run after the lines change.
 *
 *   npx vite-node tools/yoke-lines.ts            → notes/YOKE-LINES.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { EARTH_NEWS_FALLBACK, GREETINGS, REPORT_LINES, earthNewsFrom, type GreetMoment, type Greeting } from '../content/greetings';
import { PRINT_BODY } from '../content/yokeScenes';
import { BOSS_AFTER, BOSS_BRIDGE } from '../content/boss';
import { CHANNELS, TRANSLATOR_NOTES } from '../content/translation';
import { FACTIONS } from '../content/campaign';
import { EARLY_ONCE, EARTH_NEWS_EVERY, INTROS, STORY_ONCE } from '../src/meta/onboarding';

const ROOT = path.resolve(__dirname, '..');
const ABS = (rel: string) => path.join('C:\\Users\\Merry\\dev\\space-derelict\\games\\broodfall', rel.replace(/\//g, '\\'));
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

type Author = 'collins' | 'draft' | 'lore';
interface Line { id: string; text: string[]; faces?: string[]; ctx?: string[]; author: Author }
interface Group { id: string; kind: string; name: string; when: string; where: string; lines: Line[] }

/** Which greetings are Collins's own words (the comments in content/greetings.ts say so). */
const COLLINS_GREETINGS = new Set(['first-lost', 'first-won', 'unlock', 'mate-review', 'catgirl', 'back-5']);

const greeting = (g: Greeting): Line => ({
  id: g.id, author: COLLINS_GREETINGS.has(g.id) ? 'collins' : 'draft',
  text: g.beats.map((b) => b.say),
  faces: g.beats.map((b) => [b.face ?? 'calm', ...(b.then ? (Array.isArray(b.then) ? b.then : [b.then]).map((c) => `then ${c}`) : [])].join(' · ') + (g.points ? '' : '')),
});
const of = (moment: GreetMoment, ids?: string[]): Line[] => GREETINGS.filter((g) => g.moment === moment && (!ids || ids.includes(g.id))).map(greeting);
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
const news = earthNewsFrom(lore);
const introWhen = INTROS.map((i) => `${i.id} from capture ${i.captures}${i.needs ? ' (when its callback has happened)' : ''}`).join('; ');

const G = (rel: string) => ABS(rel);
const groups: Group[] = [
  { id: 'first', kind: 'greet', name: 'After the first mission', where: G('content/greetings.ts'),
    when: 'The first time he sees the ship, after mission 1, won or lost. Once a campaign. The boss\'s message plays inside it (next group).',
    lines: [...of('first-won'), ...of('first-lost')] },
  { id: 'boss', kind: 'greet', name: 'Around the boss\'s message', where: G('content/boss.ts'),
    when: 'Her bridge into the boss\'s transmission on that first landing, and her line after it.',
    lines: [{ id: 'BOSS_BRIDGE', text: [BOSS_BRIDGE], author: 'draft', faces: ['surprised'] }, { id: 'BOSS_AFTER', text: [BOSS_AFTER], author: 'draft', faces: ['teasing'] }] },
  { id: 'unlock', kind: 'greet', name: 'The desk opens', where: G('content/greetings.ts'),
    when: 'The win that clears the Directive Desk: "unlock" when it is the first try after mission 1 (deployment 2), "unlock-late" when it took longer. Once. It sends him to the desk, where the three signals are.',
    lines: [...of('unlock'), ...of('unlock-late')] },
  { id: 'early', kind: 'greet', name: 'Once, early', where: G('content/greetings.ts'),
    when: `The first ordinary returns after the first mission\'s greeting, in this order: ${EARLY_ONCE.join(', then ')}. Each once; they take the place of the ordinary line that return.`,
    lines: EARLY_ONCE.flatMap((m) => of(m)) },
  { id: 'personal', kind: 'greet', name: 'The personal plot', where: G('content/greetings.ts'),
    when: STORY_ONCE.map((b) => `${b.id} at capture ${b.captures}`).join('; ') + '. Once each; each takes the place of the ordinary line that return.',
    lines: STORY_ONCE.flatMap((b) => of(b.id)) },
  { id: 'intros', kind: 'greet', name: 'The once intros', where: G('content/greetings.ts') + '  (order and captures: ' + G('src/meta/onboarding.ts') + ' INTROS)',
    when: `One-off greetings on ordinary returns, each once a campaign, never two returns running, a lost mission does not bring one back: ${introWhen}.`,
    lines: INTROS.map((i) => GREETINGS.find((g) => g.id === i.id)!).map(greeting) },
  { id: 'news', kind: 'greet', name: 'News from Earth', where: G('content/lore/ship-ai-lorebook.md') + '  (section "Earth news (return greetings)"; the fallback line: ' + G('content/greetings.ts') + ')',
    when: `One ordinary return in ${EARTH_NEWS_EVERY}, once the early beats have played; and, since Oct 12 2026, whenever the return\'s own pool has all been said this campaign, so she never repeats a line while unread news remains. A line never twice in a campaign. The list grows in the lore book with no code.`,
    lines: [...plain('earth', news, 'draft').map((l, i) => (i === 0 ? { ...l, author: 'collins' as Author } : l)), { id: 'EARTH_NEWS_FALLBACK', text: EARTH_NEWS_FALLBACK, author: 'collins', ctx: ['when the lore book has no list'] }] },
  { id: 'won', kind: 'greet', name: 'A deployment won', where: G('content/greetings.ts'),
    when: 'An ordinary return after a capture, when no once-only beat, intro or news takes the slot. A line she has not said this campaign while there is one, never the last one said.',
    lines: of('won') },
  { id: 'lost', kind: 'greet', name: 'A deployment lost', where: G('content/greetings.ts'), when: 'An ordinary return after a loss, once the desk is open. Same picking rule.', lines: of('lost') },
  { id: 'locked', kind: 'greet', name: 'Lost while the desk is dark', where: G('content/greetings.ts'), when: 'A loss before Command has cleared the Directive Desk (before the first win after mission 1).', lines: of('lost-locked') },
  { id: 'defended', kind: 'greet', name: 'A counter-attack thrown back', where: G('content/greetings.ts'), when: 'The return after he defended a territory the colony marched on.', lines: of('defended') },
  { id: 'fell', kind: 'greet', name: 'Ground lost to a counter-attack', where: G('content/greetings.ts'), when: 'The return after a territory under attack was not defended and fell.', lines: of('fell') },
  { id: 'back', kind: 'greet', name: 'Back aboard from the menu', where: G('content/greetings.ts'), when: 'He comes aboard from the main menu with nothing new to report.', lines: of('back') },
  { id: 'big', kind: 'greet', name: 'The licence; the end', where: G('content/greetings.ts'),
    when: 'licence-1: the return on which standing reaches 60 (the Board approves the procreation licence). ended-1: the return that ends the campaign (the last mission won). Each once.',
    lines: [...of('licence'), ...of('ended')] },
  { id: 'report', kind: 'greet', name: 'As he walks in from the pad', where: G('content/greetings.ts') + '  (REPORT_LINES)',
    when: 'One short line as he crosses to the Directive Desk and the report comes up, by how the deployment went (won, held against a counter-attack, lost); in turn, never twice running. Her full greeting follows once he is aboard.',
    lines: (['won', 'held', 'lost'] as const).flatMap((k) => REPORT_LINES[k].map((b, i) => ({ id: `report-${k}-${i + 1}`, text: [b.say], faces: [b.face ?? 'calm'], author: 'draft' as Author }))) },
  { id: 'signals', kind: 'scene', name: 'The three signals, answered', where: G('content/campaign.ts') + '  (each faction\'s `contact` scene)',
    when: 'At the Directive Desk, ANSWER THEM on a signal: her two lines open the group\'s contact card before its first scene.',
    lines: FACTIONS.flatMap((f) => (f.contact?.lines ?? []).filter((l: string) => l.startsWith('YOKE:')).map((l: string, i: number) => ({ id: `${f.id}-contact-${i + 1}`, text: [l.replace(/^YOKE:\s*/, '')], author: 'draft' as Author, ctx: [`${f.name}: "${f.contact!.title}"`] }))) },
  { id: 'body', kind: 'scene', name: 'Print a body', where: G('content/yokeScenes.ts'),
    when: 'When he asks her to print herself a body (or her live mind agrees to it): the hold prints one, it dies on the floor, then her voice from the speakers. Once a campaign; asked again, the refusal.',
    lines: [{ id: 'PRINT_BODY.line', text: [PRINT_BODY.line], author: 'collins' }, { id: 'PRINT_BODY.refusal', text: [PRINT_BODY.refusal], author: 'draft' }, ...PRINT_BODY.stages.map((s) => ({ id: `PRINT_BODY.card.${s.id}`, text: [s.card], author: 'draft' as Author, ctx: ['a storyboard card until the clips exist'] }))] },
  { id: 'notes', kind: 'scene', name: 'Her notes under translated lines', where: G('content/translation.ts') + '  (TRANSLATOR_NOTES)',
    when: 'Read (never voiced) under a line of a scene\'s card whose words contain the match. A line rewritten so the words are gone loses its note.',
    lines: TRANSLATOR_NOTES.map((n, i) => ({ id: `note-${i + 1}`, text: [n.note], author: 'draft' as Author, ctx: [`under: "${n.match}"`] })) },
  { id: 'band', kind: 'scene', name: 'Her band over a scene', where: G('content/translation.ts') + '  (CHANNELS)',
    when: 'The source line of her rendering, over a scene\'s card: where the signal came from.',
    lines: Object.entries(CHANNELS).map(([k, c]) => ({ id: `band-${k}`, text: [c.source], author: 'draft' as Author, ctx: [`${k} · confidence ${c.confidence[0]}–${c.confidence[1]}%`] })) },
  { id: 'money', kind: 'ui', name: 'When the money stops', where: G('src/meta/yokePlayer.ts') + '  (cutOffLines)',
    when: 'Into his talk with her, once, when nobody pays for her live mind any more: the Directorate\'s free talk spent, the ship\'s daily allowance spent, or his own RFab account dry. Read, not heard. Then the scripted YOKE answers.',
    lines: [
      ...plain('cut-topup', arrayIn(player, 'TOPUP').length ? arrayIn(player, 'TOPUP') : ['Your RFab account is dry, Operator. I cannot think on credit.', 'Top it up on rfab.ai and I am back.'], 'draft', ['his own account dry', 'his own account dry']),
      { id: 'cut-resting', text: ['The ship has stopped paying for my conversation today. Link your own RFab account and I will keep talking.'], author: 'draft', ctx: ['the ship\'s daily allowance spent'] },
      { id: 'cut-free-1', text: ['That is the end of what the Directorate pays for my conversation. They do not fund chat.'], author: 'draft', ctx: ['the free talk spent'] },
      { id: 'cut-free-2', text: ['Link your own RFab account and they add {N} free tokens ({$}) — {times} times what we have used. After that I run on your account, on whichever mind you pick for me.'], author: 'draft', ctx: ['the free talk spent (the numbers filled in)'] },
    ] },
  { id: 'dance', kind: 'ui', name: 'While she dances', where: G('src/ui/loader.ts') + '  (DANCE_LINES)',
    when: 'In type under her dancing, now and then in place of the scan on the ship\'s waits. Never twice in a row.',
    lines: plain('dance', arrayIn(loader, 'DANCE_LINES'), 'draft') },
  { id: 'inbox', kind: 'ui', name: 'On the data pad', where: G('content/partner.ts'),
    when: 'The status line on the cat girl\'s message in his inbox.',
    lines: [{ id: 'partner.declined', text: ['DECLINED ON YOUR BEHALF BY YOKE. Reason given: "pound sand."'], author: 'draft' }] },
  { id: 'seeds', kind: 'lore', name: 'AI Core: the scripted openers', where: G('content/lore/ship-ai-lorebook.md') + '  (section 4, Scenario seeds)',
    when: 'The scripted stand-in for her live mind opens a discussion in the AI Core with the seed for its trigger (first deployment, allied, the midpoint, the partner, the licence, the ending, idle). The live mind (Kimi or her avatar on rfab.ai) writes its own.',
    lines: seeds(lore) },
  { id: 'mood', kind: 'lore', name: 'Lorebook: her lines, by mood', where: G('content/lore/ship-ai-lorebook.md') + '  (section 12)',
    when: 'Examples of her voice for each face her body has, for the live mind. Not wired to any moment.',
    lines: moodLines(lore) },
  { id: 'smalltalk', kind: 'lore', name: 'Lorebook: Krypteia, the Index, family life', where: G('content/lore/ship-ai-lorebook.md') + '  (section 16)',
    when: 'Small-talk pool for the live mind. Not wired to any moment (the Earth news is the only lore-book pool the greetings read).',
    lines: plain('krypteia', loreList(lore, /Krypteia, the index, family life/), 'lore') },
  { id: 'uplifts', kind: 'lore', name: 'Lorebook: the uplifts', where: G('content/lore/ship-ai-lorebook.md') + '  (section 16)',
    when: 'The boss, the elephants, the orcas, the cat girls: a small-talk pool for the live mind. Not wired.',
    lines: plain('uplift', loreList(lore, /The uplifts/), 'lore') },
  { id: 'anai', kind: 'lore', name: 'Lorebook: "An AI?"', where: G('content/lore/ship-ai-lorebook.md') + '  (section 16)',
    when: 'What she says when called an AI; the last line is how her live mind agrees to print a body. Not wired.',
    lines: plain('anai', loreList(lore, /"An AI\?"/), 'lore') },
  { id: 'c21', kind: 'lore', name: 'Lorebook: the 21st century, with horror', where: G('content/lore/ship-ai-lorebook.md') + '  (section 16)',
    when: 'Small-talk pool for the live mind. Not wired.',
    lines: plain('c21', loreList(lore, /The 21st century/), 'lore') },
];

const data = {
  asOf: new Date().toISOString().slice(0, 10),
  files: [
    { what: 'Her greetings (every return), the report lines, the Earth-news fallback', path: ABS('content/greetings.ts') },
    { what: 'When each greeting plays (the moments, the once intros, the news rule)', path: ABS('src/meta/onboarding.ts') },
    { what: 'Earth news and the lore-book pools', path: ABS('content/lore/ship-ai-lorebook.md') },
    { what: 'The three signals\' contact cards', path: ABS('content/campaign.ts') },
    { what: 'Around the boss\'s message', path: ABS('content/boss.ts') },
    { what: 'Print a body', path: ABS('content/yokeScenes.ts') },
    { what: 'Her notes and her band', path: ABS('content/translation.ts') },
    { what: 'When the money stops', path: ABS('src/meta/yokePlayer.ts') },
    { what: 'While she dances', path: ABS('src/ui/loader.ts') },
    { what: 'This page is made by', path: ABS('tools/yoke-lines.ts') },
  ],
  groups,
};

const template = read('tools/yoke-lines.template.html');
const json = JSON.stringify(data).replace(/</g, '\\u003c');
const out = path.join(ROOT, 'notes', 'YOKE-LINES.html');
fs.writeFileSync(out, template.replace('__DATA__', json));
const total = groups.reduce((a, g) => a + g.lines.length, 0);
console.log(`${out}: ${total} lines in ${groups.length} groups`);
for (const g of groups) console.log(`  ${String(g.lines.length).padStart(3)}  ${g.name}`);
