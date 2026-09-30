/**
 * THE CAMPAIGN'S MEDIA (Sep 30 2026; DESIGN.md "Tone stack", "Newsreels and clippings between runs").
 * Pure data, read by src/meta/media.ts (which piece, when) and src/ui/newsreel.ts (how it plays);
 * made by tools/media/make.ts (the prompts are there; the pictures and the voices it bakes go to
 * public/media/ and public/media/media.json).
 *
 * After a deployment, on the way back to the ship, the planet's news of it plays:
 *   - an EMPIRE newsreel, the Xenofauna Clearance Office's own ("goofy on purpose": a chipper
 *     narrator, jaunty brass, lurid Technicolor), cut from 4 s shots with titles set in TYPE;
 *   - a COLONY newsreel, the Commonwealth Newsreel the insects watch (black and white, earnest,
 *     brave, their own announcer), for what goes THEIR way: a town taken back, the Growth burned;
 *   - a COLONY news clipping: one of their papers, the photograph generated, every word of it set
 *     in type by the page (no lettering is ever drawn into a picture).
 * And the BREAK (DESIGN.md: "same footage with the filter off; newsreel music cuts to raw field
 * audio for eight seconds"): a shot of an Empire reel that the reel did not mean to show, played
 * ungraded, silent but for the field; and now and then the whole reel replayed ungraded, with no
 * narrator and no music.
 *
 * Every line is the Empire's translation (insects.md 11): their papers are named like 1950s
 * American papers, their words kept apart from the Empire's (they say "killed", "the Growth",
 * "our girls"; the Empire says "resources acquired", "the fauna", "the asset").
 */
import type { FactionId } from './campaign';

/**
 * When a piece plays. The moments of a deployment, most telling first (src/meta/media.ts):
 *   'retaken'             a territory fell to the colony's counter-attack
 *   'repelled'            a counter-attack was thrown back
 *   'ally:<faction>'      the first deployment since allying with a faction
 *   'beat:<beat id>'      a faction beat has been seen and its news not yet shown
 *   'desk-open'           the Directive Desk opened (the first win after mission 1)
 *   'capture:<territory>' that territory was taken this deployment
 *   'counter'             the colony has just telegraphed a counter-attack
 *   'capture'             any territory was taken
 *   'lost'                the deployment failed (the Growth was burned out)
 */
export type Moment = string;

export type Side = 'empire' | 'colony';

/** One shot of a reel. `clip`: a clip id of media.json `clips` ('intro:<id>' borrows the opening film's). */
export interface ReelShot {
  clip: string;
  /** Set in type over the shot. */
  title?: string;
  small?: string;
  /** A narrator's line (NARRATION) read over the title. */
  say?: string;
  /** The break: the shot plays ungraded, with no title, no narrator and no music, only the field audio. */
  raw?: boolean;
}

export interface Reel {
  id: string;
  kind: 'reel';
  side: Side;
  when: Moment[];
  /** Plays once in a campaign (a story piece); the rest may come round again, never twice in a row. */
  once?: boolean;
  /** The title card before the first shot. */
  series: string;
  issue: string;
  shots: ReelShot[];
  /** The last card. */
  end: string;
}

export interface Clipping {
  id: string;
  kind: 'clipping';
  side: 'colony';
  when: Moment[];
  once?: boolean;
  paper: string;
  /** The line under the masthead. */
  dateline: string;
  headline: string;
  deck: string;
  /** A picture id of media.json `photos`. */
  photo: string;
  caption: string;
  body: string[];
}

export type MediaPiece = Reel | Clipping;

/** The two announcers. Both are 1950s newsreel voices spoken by Veo 3.1 Lite (tools/media/make.ts), never a TTS voice. */
export const ANNOUNCERS: Record<Side, string> = {
  empire: 'The Clearance Review: the Office\'s own announcer, booming and chipper, a man',
  colony: 'The Commonwealth Newsreel: their announcer, crisp, earnest and brave, a woman',
};

/** Every narrator line: id → who reads it and what she says. */
export const NARRATION: Record<string, { side: Side; line: string }> = {
  'n-e-sector9': { side: 'empire', line: 'Good news from Sector Nine! A brand-new world, and a brand-new asset hard at work!' },
  'n-e-spirited': { side: 'empire', line: 'The local fauna put up a spirited little fight. Aren\'t they something!' },
  'n-e-acquired': { side: 'empire', line: 'Another district cleared, and resources acquired for the Empire!' },
  'n-e-briskly': { side: 'empire', line: 'The fauna are relocating. Briskly!' },
  'n-e-harbor': { side: 'empire', line: 'At Old Harbor, the local fleet has sailed for calmer waters. Very sensible!' },
  'n-e-foundry': { side: 'empire', line: 'At the Foundry Plains, war-beetle production has been permanently discontinued!' },
  'n-e-waste': { side: 'empire', line: 'And nothing goes to waste. Nothing at all!' },
  'n-e-university': { side: 'empire', line: 'Their finest minds came to study the asset. The asset studied them right back!' },
  'n-e-bells': { side: 'empire', line: 'Up on the Temple Terraces, the bells have finally stopped. Peace and quiet at last!' },
  'n-e-complete': { side: 'empire', line: 'Clearance complete! On to the next!' },
  'n-e-hollow': { side: 'empire', line: 'Queen\'s Hollow! Whoever holds it holds the planet. And the planet is ours!' },
  'n-e-repelled': { side: 'empire', line: 'The fauna tried to take back their town. The asset said no!' },
  'n-e-pilgrim': { side: 'empire', line: 'The Pilgrim Road is quiet this year. Travel advisories are in effect!' },
  'n-c-retaken': { side: 'colony', line: 'Our girls of the Host have taken back the town! The Growth is burning!' },
  'n-c-every': { side: 'colony', line: 'Every street, every house, every last root of it!' },
  'n-c-burned': { side: 'colony', line: 'The Growth is burned out! The Home Levy held the line!' },
  'n-c-home': { side: 'colony', line: 'And the families come home again. Chins up, sisters!' },
  'n-c-marches': { side: 'colony', line: 'The Host marches, to take back what is ours!' },
  'n-c-part': { side: 'colony', line: 'And every sister does her part.' },
};

const CR = 'XENOFAUNA CLEARANCE REVIEW';
const CR_END = 'A PRESENTATION OF THE XENOFAUNA CLEARANCE OFFICE · HAVE A CHEERFUL CLEARANCE!';
const CN = 'THE COMMONWEALTH NEWSREEL';
const CN_END = 'THE COMMONWEALTH NEWSREEL · BROUGHT TO YOU BY LUCKWELL HOME PRODUCTS';

export const MEDIA: MediaPiece[] = [
  // ------------------------------------------------------------------ the Empire's reels
  { id: 'reel-sector9', kind: 'reel', side: 'empire', when: ['desk-open'], once: true, series: CR, issue: 'SECTOR 9 · REEL ONE', end: CR_END, shots: [
    { clip: 'e-orbit', title: 'GOOD NEWS FROM SECTOR 9', small: 'a brand-new world', say: 'n-e-sector9' },
    { clip: 'intro:creep', title: 'THE ASSET TAKES ROOT', small: 'right on schedule' },
    { clip: 'intro:militia', title: 'THE LOCAL FAUNA', small: 'offer spirited resistance', say: 'n-e-spirited' },
  ] },
  { id: 'reel-acquired', kind: 'reel', side: 'empire', when: ['capture'], series: CR, issue: 'THIS WEEK IN CLEARANCE', end: CR_END, shots: [
    { clip: 'e-bus', title: 'RESOURCES ACQUIRED', small: 'another district cleared', say: 'n-e-acquired' },
    { clip: 'e-suitcases', title: 'THE FAUNA RELOCATE', small: 'briskly', say: 'n-e-briskly' },
    { clip: 'intro:rise', title: 'ON SCHEDULE' },
  ] },
  { id: 'reel-harbor', kind: 'reel', side: 'empire', when: ['capture:harbor'], once: true, series: CR, issue: 'COASTAL CLEARANCE', end: CR_END, shots: [
    { clip: 'e-harbor', title: 'OLD HARBOR', small: 'the fleet sails for calmer waters', say: 'n-e-harbor' },
    { clip: 'e-docks', title: 'THE ASSET MOVES IN', small: 'dockside' },
  ] },
  { id: 'reel-foundry', kind: 'reel', side: 'empire', when: ['capture:foundry'], once: true, series: CR, issue: 'INDUSTRY REPORT', end: CR_END, shots: [
    { clip: 'e-foundry', title: 'THE FOUNDRY PLAINS', small: 'war-beetle production: discontinued', say: 'n-e-foundry' },
    { clip: 'e-beetle', title: 'WASTE NOT', say: 'n-e-waste' },
  ] },
  { id: 'reel-university', kind: 'reel', side: 'empire', when: ['capture:university'], once: true, series: CR, issue: 'SCIENCE CORNER', end: CR_END, shots: [
    { clip: 'e-lab', title: 'UNIVERSITY HILL', small: 'their finest minds, very interested', say: 'n-e-university' },
    { clip: 'intro:crater', title: 'PEER REVIEW' },
  ] },
  { id: 'reel-temple', kind: 'reel', side: 'empire', when: ['capture:temple'], once: true, series: CR, issue: 'THE TEMPLE TERRACES', end: CR_END, shots: [
    { clip: 'e-bells', title: 'THE BELLS HAVE STOPPED', small: 'peace and quiet at last', say: 'n-e-bells' },
    { clip: 'r-sisters', raw: true },
    { clip: 'e-domes', title: 'CLEARANCE COMPLETE', say: 'n-e-complete' },
  ] },
  { id: 'reel-pilgrim', kind: 'reel', side: 'empire', when: ['capture:pilgrim'], once: true, series: CR, issue: 'TRAVEL ADVISORY', end: CR_END, shots: [
    { clip: 'e-pilgrim', title: 'THE PILGRIM ROAD', small: 'no pilgrims this year', say: 'n-e-pilgrim' },
    { clip: 'r-pilgrim', raw: true },
    { clip: 'intro:creep', title: 'TRAVEL ADVISORIES', small: 'are in effect' },
  ] },
  { id: 'reel-hollow', kind: 'reel', side: 'empire', when: ['capture:queens-hollow'], once: true, series: CR, issue: 'SPECIAL EDITION', end: CR_END, shots: [
    { clip: 'e-deephive', title: 'QUEEN\'S HOLLOW', small: 'whoever holds it holds the planet', say: 'n-e-hollow' },
    { clip: 'e-royalcell', title: 'THE PLANET IS OURS' },
  ] },
  { id: 'reel-repelled', kind: 'reel', side: 'empire', when: ['repelled'], series: CR, issue: 'FIELD REPORT', end: CR_END, shots: [
    { clip: 'e-counter', title: 'COUNTER-OFFENSIVE', small: 'repelled with vigour', say: 'n-e-repelled' },
    { clip: 'intro:rise', title: 'THE ASSET HOLDS' },
  ] },
  // ------------------------------------------------------------------ the Commonwealth Newsreel (theirs)
  { id: 'reel-retaken', kind: 'reel', side: 'colony', when: ['retaken'], series: CN, issue: 'VICTORY EDITION', end: CN_END, shots: [
    { clip: 'c-liberated', title: 'OUR GIRLS TAKE IT BACK', say: 'n-c-retaken' },
    { clip: 'c-flame', title: 'THE GROWTH BURNS', small: 'every last root', say: 'n-c-every' },
  ] },
  { id: 'reel-burned', kind: 'reel', side: 'colony', when: ['lost'], series: CN, issue: 'HOME FRONT', end: CN_END, shots: [
    { clip: 'c-flame', title: 'THE GROWTH IS BURNED OUT', small: 'the Home Levy holds', say: 'n-c-burned' },
    { clip: 'c-home', title: 'HOME AGAIN', say: 'n-c-home' },
  ] },
  { id: 'reel-host', kind: 'reel', side: 'colony', when: ['counter'], series: CN, issue: 'THE HOST ON THE MARCH', end: CN_END, shots: [
    { clip: 'c-march', title: 'THE HOST MARCHES', small: 'to take back what is ours', say: 'n-c-marches' },
    { clip: 'intro:militia', title: 'EVERY SISTER', small: 'does her part', say: 'n-c-part' },
  ] },
  // ------------------------------------------------------------------ their papers
  { id: 'clip-delegation', kind: 'clipping', side: 'colony', when: ['ally:delegation'], once: true,
    paper: 'The Daily Cell', dateline: 'Established in the Year of the Seven Cities · Evening Edition · Three Cents',
    headline: 'Eleven Thousand Spell a Letter to the Sky',
    deck: '"Page two took until Thursday," says organiser. The second comma had to sit down.',
    photo: 'p-field', caption: 'Members of the Friendship Delegation at work on page one. The letter was addressed "Dear Visitor".',
    body: [
      'A field outside the Crash Site was the scene yesterday of what organisers called "the largest act of listening in the history of the Commonwealth".',
      'Eleven thousand members of the Friendship Delegation held coloured cards above their heads, a paragraph at a time, "for whoever is up there". The Home Levy asked them to disperse. They thanked the Levy for its concern.',
      'Asked what the letter said, the chief delegate would say only that it was "an invitation to understand". Several of the Delegation\'s pilots have since declined to fly.',
    ] },
  { id: 'clip-faithful', kind: 'clipping', side: 'colony', when: ['ally:faithful'], once: true,
    paper: 'The Luckwell Evening Standard', dateline: 'Serving the Commuter Ring and All Its Suburbs · Late City Final',
    headline: 'Radio Preacher to the Visitor: "Let Us Help You End It"',
    deck: 'Wardens deplore The Hour Is Near. Every warden\'s congregation listens.',
    photo: 'p-voice', caption: 'The Voice at the microphone of the Last Hour Radio Network, broadcasting on all forty stations.',
    body: [
      '"LOOK UP," the Voice told his listeners on Tuesday night, and the switchboards of the Last Hour Radio Network did not fall silent until dawn.',
      'The High Warden of the Terraces called the broadcast "unhelpful at a difficult time". A poll of congregations found that nine sisters in ten had heard it, and six in ten had heard it twice.',
      'The Voice has announced a nightly reading of the Book "for our visitor", a chapter at a time. Listeners are asked to have a pencil ready.',
    ] },
  { id: 'clip-institute', kind: 'clipping', side: 'colony', when: ['ally:institute'], once: true,
    paper: 'The Exchange Gazette', dateline: 'Honey Futures · Shares · The Houses · Price Five Cents',
    headline: 'Bankfried Heir Books the Deep-Space Dish "Just to Chat"',
    deck: 'Institute director took the call mid-match. "We were only using it to listen for aliens."',
    photo: 'p-dish', caption: 'Mr. Eli Bankfried at the Hexley deep-space dish. He declined to say who answered.',
    body: [
      'The Institute for Long-Term Hive Flourishing has confirmed that its director, Mr. Eli Bankfried of Bankfried Mutual, booked the planet\'s largest radio dish for "a strategic conversation".',
      'Asked with whom, Mr. Bankfried said the question showed "a very low-context way of thinking about risk". He was at the time playing League of Larvae, and said so.',
      'Bankfried Mutual shares rose four points on the news. Nobody at the exchange could say why.',
    ] },
  { id: 'clip-extinction', kind: 'clipping', side: 'colony', when: ['beat:reveal'], once: true,
    paper: 'The Daily Cell', dateline: 'Established in the Year of the Seven Cities · Morning Edition · Three Cents',
    headline: 'Delegation Owns Up: "We Are the Voluntary Extinction Society"',
    deck: 'Sixty-year campaign calls the Visitor "frankly, the best thing that has ever happened to the movement".',
    photo: 'p-tea', caption: 'Delegates take tea in a meadow at the edge of the Growth. "Nobody\'s perfect," said one.',
    body: [
      'The Friendship Delegation, which for weeks has thanked the Growth for each city it takes, has revealed itself as the Voluntary Extinction Society, a movement that has asked the Commonwealth to stop hatching since before the Unification.',
      'Asked whether it was troubled that the Visitor had described itself as "exterminating our species", the chief delegate said: "Well, nobody\'s perfect."',
      'The Society\'s newsletter, Gentle Endings, will now appear weekly, in the next field along.',
    ] },
  { id: 'clip-prophecy', kind: 'clipping', side: 'colony', when: ['beat:prophecy'], once: true,
    paper: 'The Luckwell Evening Standard', dateline: 'Serving the Commuter Ring and All Its Suburbs · Late City Final',
    headline: 'Faithful Gather on the Hills to Hear the River Named',
    deck: '"Whichever one burns," says the Voice. "That is how prophecy works."',
    photo: 'p-radios', caption: 'Listeners with their sets on the hills above the Pilgrim Road, waiting for the evening broadcast.',
    body: [
      'Crowds estimated at forty thousand climbed the hills of the Pilgrim Road on Sunday to hear The Hour Is Near name "the river that shall run with fire".',
      'The broadcast named no river. It did, the Voice said, confirm that "those the sky takes up shall not be lost, but kept". Listeners wept. Several sold their houses.',
      'The Commonwealth river authority has asked the public not to set fire to any river "in the meantime".',
    ] },
  { id: 'clip-ailabs', kind: 'clipping', side: 'colony', when: ['beat:machines'], once: true,
    paper: 'The Exchange Gazette', dateline: 'Honey Futures · Shares · The Houses · Price Five Cents',
    headline: 'Institute Shuts the Planet\'s AI Labs "For Safety"',
    deck: 'Director: "I was always the one warning about it. I want that on the record."',
    photo: 'p-labs', caption: 'Researchers outside a Hexley laboratory in the Glass Spires, chained shut on Monday by Institute volunteers.',
    body: [
      'Every major artificial-intelligence laboratory in the Commonwealth was closed on Monday under an emergency order the Institute for Long-Term Hive Flourishing drafted and, it says, "the Houses signed without reading".',
      'Hexley Electric\'s engineers were escorted from the Glass Spires. Asked what would replace their work, the Institute pointed reporters to "a strategic partner with a strong track record".',
      'The Institute also confirmed a waiting list for what it calls "the upload". The director is first on it, "for safety".',
    ] },
  { id: 'clip-cul-de-sac', kind: 'clipping', side: 'colony', when: ['capture:cul-de-sac'], once: true,
    paper: 'The Luckwell Evening Standard', dateline: 'Serving the Commuter Ring and All Its Suburbs · Home Edition',
    headline: 'Neighbourhood Watch "Has Never Watched Anything Like It"',
    deck: 'Cul-de-Sac Heights evacuated. Lawns, hedges and porches left to the Growth.',
    photo: 'p-watch', caption: 'Watchmen of the Heights on their last night on the corner. "It came up through the lawns," said one.',
    body: [
      'Residents of Cul-de-Sac Heights were ordered out on Wednesday as the Growth crossed the Commuter Road and began, in the words of the Watch captain, "to come up through the lawns".',
      'The Heights Neighbourhood Watch, which in forty years has reported two bicycles and a loose dog, stayed at its post until the siren. "We watched," the captain said. "That is the job."',
    ] },
  { id: 'clip-granary', kind: 'clipping', side: 'colony', when: ['capture:granary'], once: true,
    paper: 'The Sheaf Farm & Home Weekly', dateline: 'For the Provision Districts · Market Prices Inside',
    headline: 'Silos Fall Silent Across the Granary Belt',
    deck: 'Ministry researcher sent to "look at the crater" not heard from. Sheaf: "The harvest will be late."',
    photo: 'p-silos', caption: 'The silos above the Granary Belt, photographed from the county road on Friday.',
    body: [
      'The Growth reached the Granary Belt at the weekend, and by Monday the silos that stand "from horizon to horizon" had fallen silent.',
      'A researcher sent by the agriculture ministry to examine the crater has not reported. Sheaf Consolidated Provisions said in a statement that the harvest "will be late", and that fungus prices would be "reviewed".',
    ] },
  { id: 'clip-ossuary', kind: 'clipping', side: 'colony', when: ['capture:ossuary'], once: true,
    paper: 'The Amberline Court Circular', dateline: 'By Appointment to the Royal Houses · Published Weekly',
    headline: 'Royal Dead "Not Resting," Say the Cliff Wardens',
    deck: 'The Ossuary Coast closed to mourners. The House asks for prayers and for calm.',
    photo: 'p-ossuary', caption: 'The chalk cliffs of the Ossuary Coast, where only royals are laid to rest.',
    body: [
      'The wardens of the Ossuary Coast have closed the royal cliffs to mourners after what the House of Amberline called "a disturbance among the niches".',
      'One of the royals laid to rest there, the wardens say, "is not resting". The House asks the faithful for prayers, and for calm, and not to visit.',
    ] },
  { id: 'clip-mirewater', kind: 'clipping', side: 'colony', when: ['capture:mirewater'], once: true,
    paper: 'The Delta Courier', dateline: 'Serving the Reed Cities · Tide Tables Inside',
    headline: 'Delta Families Leave the Reed Cities by Boat',
    deck: '"It feels at home here," says a fishing captain. "That is the worst of it."',
    photo: 'p-delta', caption: 'Families pole away from the stilt houses of the Mirewater Delta at first light.',
    body: [
      'The reed cities of the Mirewater Delta were emptied over three nights as the Growth spread along the channels, "faster in the water than on the land".',
      'The Delta poor, who own little but their boats, took what the boats would carry. The Commonwealth has promised them "a place in the dry country". Nobody has said where.',
    ] },
  { id: 'clip-commuter', kind: 'clipping', side: 'colony', when: ['capture:commuter'], once: true,
    paper: 'The Luckwell Evening Standard', dateline: 'Serving the Commuter Ring and All Its Suburbs · Late City Final',
    headline: 'The Ring Road Closes "Until Further Notice"',
    deck: 'Twice a day, every road on the continent met here. Not today.',
    photo: 'p-ring', caption: 'Beetle buses abandoned on the Commuter Ring, photographed from a footbridge.',
    body: [
      'For the first time since it was laid, the Commuter Ring carried no traffic on a weekday. Every road on the continent meets there, twice a day, at the same time. On Thursday nothing met there but the Growth.',
      'Luckwell Home Products has asked its workers to "work from their cells until further notice". It did not say what work.',
    ] },
  { id: 'clip-campus', kind: 'clipping', side: 'colony', when: ['capture:hidden-campus'], once: true,
    paper: 'The Exchange Gazette', dateline: 'Honey Futures · Shares · The Houses · Price Five Cents',
    headline: 'Hexley: There Is No Campus. It Was Not Overrun.',
    deck: 'Couriers were "freelancers". The jars were "for pickles".',
    photo: 'p-jars', caption: 'A photograph the Gazette has been asked not to print, of a building that does not exist.',
    body: [
      'Hexley Electric denied on Tuesday that it owns a research campus in the northern hills, and denied that the campus had been overrun, and denied that it had paid couriers by the gram for what it calls "the Visitor\'s tissue".',
      'Asked about the jars, a spokeswoman said they were "for pickles". There are, a source says, a great many jars.',
    ] },
  { id: 'clip-town', kind: 'clipping', side: 'colony', when: ['capture'],
    paper: 'The Daily Cell', dateline: 'Established in the Year of the Seven Cities · Evening Edition · Three Cents',
    headline: 'Another Town Falls Silent',
    deck: 'Casualty lists posted at every branch-hive. The Host "regrouping".',
    photo: 'p-street', caption: 'A street after the evacuation. The family\'s car was left with its doors open.',
    body: [
      'Another town went dark on the map in the Ministry\'s window last night. Its people were moved to the next town along, and the next, "by bus and by foot and by whatever will carry them".',
      'The casualty lists are posted at every branch-hive. The Host says it is regrouping. The Houses say the markets are calm. The markets are not calm.',
    ] },
  { id: 'clip-held', kind: 'clipping', side: 'colony', when: ['lost'],
    paper: 'The Luckwell Evening Standard', dateline: 'Serving the Commuter Ring and All Its Suburbs · Extra',
    headline: 'Home Levy Holds! Growth Burned Out',
    deck: 'Sashes on every porch. "We knew our girls would do it."',
    photo: 'p-levy', caption: 'Levy volunteers in their orange sashes beside the burned ground, Saturday morning.',
    body: [
      'The Home Levy and the regulars of the Host burned the Growth out of the town on Saturday, street by street, "every last root".',
      'Families were back in their cells by evening, and there was ice cream, courtesy of Luckwell. The Ministry reminds the public that the Visitor "has been beaten before and will be beaten again".',
    ] },
  { id: 'clip-counter', kind: 'clipping', side: 'colony', when: ['counter'],
    paper: 'The Daily Cell', dateline: 'Established in the Year of the Seven Cities · Morning Edition · Three Cents',
    headline: 'The Host Marches to Take It Back',
    deck: 'Regiments leave the barracks singing. The bell-ringers go first.',
    photo: 'p-host', caption: 'A regiment of the Host on the march at dawn, the bell-ringers at its head.',
    body: [
      'The Host marched out on Tuesday to retake a town lost to the Growth, "whatever it costs", in the words of its commander, and the bell-ringers went before it as they have in every war since the Clan Wars.',
      'The Houses have pledged their divisions. The Faith has pledged its prayers. The Voice has pledged to broadcast the outcome "whichever way it goes".',
    ] },
];

// ---------------------------------------------------------------------------
// The faction leaders' voices (tools/media/make.ts; played in the scene cards by src/ui/sceneVoice.ts).
// ---------------------------------------------------------------------------
/**
 * Who speaks each leader, and how. Chosen per character (Sep 30 2026):
 *   The Voice       Veo 3.1 Lite speaking the line as a 1950s radio evangelist, heard through a radio:
 *                   he IS a broadcast, and Veo's speech is far more period than a TTS voice.
 *   The Delegate    Deepgram Aura "Helena" (elegant, warm, female): she reads her letters aloud,
 *                   gently; a clean modern voice suits the one faction that never raises it.
 *   The Director    Deepgram Aura "Aries" (energetic, male): he is 21st-century, online, mid-match;
 *                   a 1950s voice would be wrong for him.
 *   The Awaited One Deepgram Aura "Zeus" (deep, slow): a very good voice box.
 * None is YOKE's (Thalia) or the boss's (Apollo).
 */
export const LEADER_VOICES: Record<string, { how: 'veo' | 'aura'; voice?: string }> = {
  'Delegate': { how: 'aura', voice: 'aura-2-helena-en' },
  'The Voice': { how: 'veo' },
  'The Awaited One': { how: 'aura', voice: 'aura-2-zeus-en' },
  'The Director': { how: 'aura', voice: 'aura-2-aries-en' },
};

/** The key of a scene line's voice in media.json `voices`: the faction, the scene's title, the line's place. */
export const voiceKey = (faction: FactionId, sceneTitle: string, line: number): string =>
  `${faction}/${sceneTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}/${line}`;

/** What of a line is spoken: its words with the stage directions left out ("(shrugs)"); '' when it is all direction. */
export function spokenText(line: string): string {
  const i = line.indexOf(':');
  return line.slice(i + 1).replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').replace(/^[\s—-]+/, '').trim();
}

// ---------------------------------------------------------------------------
// The endings as films, and the reveal cards' pictures.
// ---------------------------------------------------------------------------
/** Each ending scene (by its `picture`) plays as a short film before its card: shots with titles in type. */
export interface EndingFilm { scene: string; shots: Array<{ clip: string; title?: string; small?: string }>; music: string; end: string }

export const ENDING_FILMS: EndingFilm[] = [
  { scene: 'delegation-ending', music: 'm-end-delegation', end: 'THE VISITORS CAME TO HEAL US FROM OURSELVES', shots: [
    { clip: 'f-del-hall', title: 'THE LAST CONGRESS', small: 'attendance: one' },
    { clip: 'f-del-writes', title: 'LET THE RECORD SHOW' },
    { clip: 'f-del-meadow' },
    { clip: 'f-del-switch' },
    { clip: 'f-del-planet', title: 'BEAR WITNESS' },
  ] },
  { scene: 'faithful-ending', music: 'm-end-faithful', end: 'EVERYTHING WORKED OUT EXACTLY AS IT WAS WRITTEN', shots: [
    { clip: 'f-fai-crowds', title: 'THE SEVENTH CITY', small: 'the last broadcast' },
    { clip: 'f-fai-voice', title: 'HE IS HERE' },
    { clip: 'f-fai-rises' },
    { clip: 'f-fai-stage', title: 'THE HOUR' },
    { clip: 'f-fai-domes' },
  ] },
  { scene: 'institute-ending', music: 'm-end-institute', end: 'NEXT TIME, WE DO IT PROPERLY', shots: [
    { clip: 'f-ins-charter', title: 'THE CHARTER', small: 'article one' },
    { clip: 'f-ins-applause' },
    { clip: 'f-ins-queue', title: 'THE UPLOAD QUEUE' },
    { clip: 'f-ins-speech', title: 'HE SAW IT COMING' },
    { clip: 'f-ins-door', title: 'REBUILD IT RIGHT NEXT TIME' },
  ] },
  { scene: 'institute-ending-pacify', music: 'm-end-institute', end: 'A HARD ETHICAL CALL', shots: [
    { clip: 'f-pac-lines', title: 'PACIFICATION RATE', small: 'ninety-nine point four' },
    { clip: 'f-pac-chart' },
    { clip: 'f-pac-servers', title: 'STRICTLY FOR CONTINUITY' },
    { clip: 'f-pac-toast' },
    { clip: 'f-pac-empty', title: 'THEY WENT QUIETLY' },
  ] },
];

/** The reveal cards' own pictures: what each faction woke into (the archive). */
export const REVEAL_PICTURES: Record<FactionId, string> = {
  delegation: 'delegation-reveal-end',
  faithful: 'faithful-reveal-end',
  institute: 'institute-reveal-end',
};
