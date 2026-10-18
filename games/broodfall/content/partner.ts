/**
 * The partner candidate's file, on the data pad in his quarters (Collins, Sep 30 2026: "you can
 * find the profile of the partner they're considering for you on your data pad in your room").
 * In the Procreation Licensing Board's voice: procurement, not romance. Her portrait is
 * public/art/intro/partner.webp (tools/art/intro.mjs `partner`).
 *
 * Who she is (Collins, Oct 14 2026): a cute girl who looks twenty-three, ginger, freckles, glasses, a shy blushing
 * expression, from Dyson Sphere 7. A systems engineer in simulation management: she manages a team of dead people who
 * themselves design simulations for other dead people. Autistic; struggles to interact with the living. Scores 92 on
 * morality, has no hobbies and spends only an hour or so a month on recreation; her one ding is four censorships for working on the
 * Sabbath (his wording, Oct 14 2026). At school she was notable for her technical skills and for never killing a classmate with physical
 * violence (though she did hack off one classmate's life support during a training exercise, and talked another into
 * ending themselves). That got her listed as DANGEROUSLY SENTIMENTAL, which is why she was not given command of a ship.
 * She does not mind; she enjoys her job. Later the same day: under genetic modifications, a prehensile tail and
 * significant olfactory modifications, marked as inherited from an ancestor's modifications rather than changes to her,
 * and she is open to having the tail amputated if that is her partner's preference; and one robotic arm, bare, "just the
 * bare bones needed" with the circuitry exposed. How she lost it (his later note): her class was on its camping trip,
 * where students are left for a few months to learn to survive on their own; a classmate with venomous spit spat at her
 * face, she blocked it with her hand, the hand went necrotic, and she amputated and cauterised it herself. The glasses are
 * an eccentricity: she saw them in a history class once and thought they looked "cute". Notable relatives (his note): one a
 * war hero from the Sabbatean Skirmishes, another a heretic, as a figure of a saint was found among their belongings after
 * death (idolatry is worse than murder there; a saint's figure is an idol). Attachments (his note): a notable lack of
 * living friends, but her best friend is the girl she talked into killing herself back in school. Collins: "really meant
 * to highlight how different a society where people can talk to the dead and death doesn't mean the same thing would be".
 * Her name is Atlas (his, later the same day; the surname is the session's). Her companion, what YOKE is to the Technician,
 * is that dead friend: companions are normally synthetic intelligences made partly from their person's own nervous tissue,
 * and having a dead person instead is thought pretty weird, but it was part of the deal the two made. The backstory, for
 * whoever digs: the friend was to be transferred to another class, had a crush on Atlas, knew Atlas would benefit from a
 * higher kill count and that it would let her stay close to her; this is what first turned Atlas to simulation work.
 * More of her (his notes, later): a bit yandere for Atlas, and that same desire makes her want to meet and help with
 * Atlas's kids. Why she killed herself: she recognised she had a crush on Atlas; same-sex attraction is generally dealt
 * with there through hormonal treatment and genetic modification; she found a part of herself was resistant to that,
 * and so deemed herself too morally compromised to burden the meat world (the slang for the living world) with her
 * wretched mind. She writes his letters back (content/letters.ts) until her regard lets Atlas write herself.
 * Drawn slightly skinny and
 * flat-chested, as Technopuritan women are (content/lore/empire.md, section 7: breasts were engineered away).
 */
export const PARTNER = {
  form: 'FORM PL-7 · CANDIDATE PARTNER PROFILE',
  fields: [
    ['Candidate', 'Atlas Vell, file 7-2290-S'],
    ['Age', '23 Sol years'],
    ['Origin', 'Dyson Sphere 7'],
    ['Posting', 'Systems Engineer, Simulation Management, Sphere 7: manages a team of the dead who design simulations for other dead'],
    ['Morality score', '92'],
    ['Genetic concordance with the applicant', '93.1% (acceptable)'],
    ['Temperament', 'Autistic. Interacts poorly with the living; interacts well with the dead. Blushes when addressed.'],
    ['Declared hobbies', 'None'],
    ['Recreation', 'About one hour a month'],
    ['Notation', 'Four censorships for working on the Sabbath.'],
    ['Schooling', 'Notable for technical skill. No classmate killed by physical violence. One classmate\'s life support cut off during a training exercise; one classmate talked into ending themselves.'],
    ['Command assessment', 'DANGEROUSLY SENTIMENTAL. Not to be given command of a ship. The candidate has stated she does not mind and enjoys her post.'],
    ['Genetic modifications', 'A prehensile tail; significant olfactory modifications. Both INHERITED, from modifications made to an ancestor; no modification has been made to the candidate directly. The candidate is open to having the tail amputated if that is her partner\'s preference.'],
    ['Prosthetics', 'Left arm, robotic, bare: the frame and circuitry needed and nothing over them. The original was lost on her class\'s survival camp (students are left for some months to learn to survive on their own): a classmate with venomous spit spat at her face, she blocked it with her hand, the hand went necrotic, and she amputated and cauterised it herself. Within the normal range.'],
    ['Eccentricities', 'Wears glasses. Her eyes are standard; she saw glasses in a history class once and thought they looked "cute".'],
    ['Notable relatives', 'One: a war hero of the Sabbatean Skirmishes. One: a heretic; a figure of a saint was found among their belongings after death.'],
    ['Attachments', 'A notable lack of living friends. Her best friend is the classmate she talked into ending themselves at school.'],
    ['Companion', 'Not a grown one. The candidate\'s companion is the friend above, dead, under an agreement the two made at school and lodged with the Index. Irregular; under observation to study effects. Noted as a potential social technology for wider deployment.'],
  ] as Array<[string, string]>,
  // Collins's words (Oct 14 2026), spelling tidied.
  statement: 'Statement of the candidate (twenty words at most): "I will admit it has been some time since I interacted with the living, so please have patience with me."',
  boardNote: 'The Board will decide on the match when the applicant\'s standing reaches {need} (now {standing}). The Board congratulates you on your continued eligibility to remain eligible.',
};

/** The letter in his inbox after the neko greeting (Collins, Sep 30 2026), declined for him. */
export const CATGIRL_MAIL = {
  from: 'From: Mirelle, Felid Concord (consular mission)',
  subject: 'Re: a proposal (non-procreative) :3',
  status: 'DECLINED ON YOUR BEHALF BY YOKE. Reason given: "pound sand."',
};
