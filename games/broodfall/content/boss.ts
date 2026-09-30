/**
 * THE BOSS (Collins, Sep 30 2026): his superior is an uplifted DOG. In the Technopuritan
 * bureaucracy dogs rise high: they like taking orders, are happy, trustworthy and generous, and
 * having one as a superior is thought quite a gift; they rarely reach top management, because
 * they are gullible. A son of man by the Covenant (docs/UNIVERSE.md, content/lore/empire.md).
 *
 * His name is a Puritan virtue name, as the Empire's are: Steadfast. His message plays on the
 * first landing on the ship, after YOKE's greeting (src/ui/campaignUi.ts welcome). Words in the
 * Empire's chipper procurement voice, with a dog's warmth. His picture and voice:
 * tools/art/boss.mjs (public/art/intro/boss.*); without them he is read, from a still or a card.
 */
export const BOSS = {
  name: 'STEADFAST BARNABAS',
  rank: 'SUPERVISOR · XENOFAUNA CLEARANCE OFFICE, SECTOR 9',
  channel: 'PRIORITY TRANSMISSION · COMMAND CHANNEL',
  /** What he says; one caption at a time on the screen. */
  lines: [
    'Technician! Supervisor Barnabas here, Clearance Office, Sector Nine.',
    'I just read your first field report, and I want you to know I read the whole thing. Twice!',
    'Pest clearance is honest work, and honest work is the best work there is.',
    'The Board says only the numbers matter, and the Board is very wise. But I say you are a good egg.',
    'Keep it up! I will be watching every report. I love reports.',
    'Good boy. Good work! Good work. Barnabas out.',
  ],
};

/** What YOKE says around him: before (her bridge into it) and after (wry, about having a dog for a boss). */
export const BOSS_BRIDGE = 'Oh, and we got a message from the boss.';
export const BOSS_AFTER = 'A dog for a boss. Lucky you, honestly, they\'re lovely. Just don\'t let him anywhere near the budget.';
