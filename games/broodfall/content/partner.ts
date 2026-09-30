/**
 * The partner candidate's file, on the data pad in his quarters (Collins, Sep 30 2026: "you can
 * find the profile of the partner they're considering for you on your data pad in your room").
 * In the Procreation Licensing Board's voice: procurement, not romance. Her portrait is
 * public/art/intro/partner.webp (tools/art/intro.mjs `partner`), when it has been made.
 */
export const PARTNER = {
  form: 'FORM PL-7 · CANDIDATE PARTNER PROFILE',
  fields: [
    ['Candidate', 'Maren Oste, file 4471-C'],
    ['Age', '24 standard years'],
    ['Posting', 'Hydroponics Compliance, Orbital Yard 12'],
    ['Genetic concordance with the applicant', '91.4% (acceptable)'],
    ['Temperament', 'Even. Recorded laughter within tolerance.'],
    ['Declared interests', 'Efficient irrigation; choral readings; the upkeep of small machines'],
    ['Punctuality', 'Exemplary'],
  ] as Array<[string, string]>,
  statement: 'Statement of the candidate (twenty words at most): "I am told you are punctual. I am punctual. That seems a good place to start."',
  boardNote: 'The Board will decide on the match when the applicant\'s standing reaches {need} (now {standing}). The Board congratulates you on your continued eligibility to remain eligible.',
};
