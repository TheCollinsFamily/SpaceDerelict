/**
 * The first-boot film and the reveal after mission 1 (Oct 1 2026; src/ui/bmovie.ts, src/meta/onboarding.ts
 * revealDue, src/meta/landing.ts fallStart). Collins: the ship is not revealed until mission 1 is over.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { titleAt, type Bmovie } from '../src/ui/bmovie';
import { launchKind, revealDue } from '../src/meta/onboarding';
import { fallStart } from '../src/meta/landing';
import { newCampaign, type CampaignState } from '../src/meta/campaign';

const film: Pick<Bmovie, 'titles' | 'cardAt'> = {
  cardAt: 60,
  titles: [{ text: 'A', from: 10, to: 14 }, { text: 'B', from: 20, to: 22 }, { text: 'LATE', from: 58, to: 62 }],
};

describe('the film\'s titles', () => {
  it('shows a title only inside its window', () => {
    expect(titleAt(film, 9.9)).toBeNull();
    expect(titleAt(film, 10)?.text).toBe('A');
    expect(titleAt(film, 13.99)?.text).toBe('A');
    expect(titleAt(film, 14)).toBeNull();
    expect(titleAt(film, 21)?.text).toBe('B');
  });
  it('shows no title over the end card', () => {
    expect(titleAt(film, 59)?.text).toBe('LATE');
    expect(titleAt(film, 60)).toBeNull();
  });
});

describe('the baked film (public/art/intro/bmovie.json)', () => {
  const file = path.join(__dirname, '..', 'public', 'art', 'intro', 'bmovie.json');
  const baked = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Bmovie & { shots: Record<string, number> }) : null;
  it.runIf(!!baked)('its titles sit inside the picture, in order, before the end card', () => {
    const b = baked!;
    expect(b.seconds).toBeGreaterThan(45);
    expect(b.seconds).toBeLessThan(95);
    expect(b.cardAt).toBeLessThan(b.seconds);
    let prev = 0;
    for (const t of b.titles) {
      expect(t.from).toBeGreaterThanOrEqual(prev);
      expect(t.to).toBeGreaterThan(t.from);
      expect(t.to).toBeLessThanOrEqual(b.cardAt);
      prev = t.to;
    }
    expect(fs.existsSync(path.join(__dirname, '..', 'public', 'art', b.video))).toBe(true);
    if (b.reveal) expect(fs.existsSync(path.join(__dirname, '..', 'public', 'art', b.reveal.video))).toBe(true);
  });
});

describe('the reveal after mission 1', () => {
  const fresh = (): CampaignState => newCampaign(42, { onboarding: true });
  const after = (s: CampaignState, mission1: 'won' | 'lost', deployments = 1): CampaignState =>
    ({ ...s, deployments, onboard: { mission1, deskOpen: false } });

  it('is due once mission 1 is over and nothing has been deployed since', () => {
    expect(revealDue(after(fresh(), 'won'), false)).toBe(true);
    expect(revealDue(after(fresh(), 'lost'), false)).toBe(true);
  });
  it('is not due before mission 1 is over (the ship is not seen then)', () => {
    const s = fresh();
    expect(s.onboard?.mission1).toBe('pending');
    expect(revealDue(s, false)).toBe(false);
  });
  it('plays only once', () => {
    expect(revealDue(after(fresh(), 'won'), true)).toBe(false);
  });
  it('is never played to an old save or a campaign past its first return', () => {
    const old = { ...fresh(), onboard: undefined, deployments: 1 } as CampaignState;
    expect(revealDue(old, false)).toBe(false);
    expect(revealDue(after(fresh(), 'won', 3), false)).toBe(false);
    expect(revealDue(null, false)).toBe(false);
  });
  it('a first launch still goes film → mission 1; a pending mission 1 goes straight back into it', () => {
    expect(launchKind({ hasCampaign: false, mission1Pending: false, introSeen: false, veteran: false })).toBe('first');
    expect(launchKind({ hasCampaign: true, mission1Pending: true, introSeen: true, veteran: false })).toBe('mission1');
  });
});

describe('mission 1\'s landing without the ship', () => {
  it('starts past the dissolve from the release into the fall', () => {
    const landing = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'art', 'landing', 'landing.json'), 'utf8'));
    for (const f of Object.values(landing.films) as Array<{ fallAt: number; strikeAt: number }>) {
      const at = fallStart(f);
      expect(at).toBeGreaterThan(f.fallAt + 0.3);
      expect(at).toBeLessThan(f.strikeAt);
    }
  });
});
