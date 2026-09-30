// Counts the leaders' spoken lines in the faction scenes (a planning aid; run with npx tsx).
import { FACTIONS } from '../../content/campaign';
for (const f of FACTIONS) {
  const scenes = [f.contact, ...f.beats.map((b) => b.scene), f.ending, ...Object.values(f.endingByChoice?.scenes ?? {}), ...(f.reveal ? [f.reveal] : [])];
  const by: Record<string, { n: number; words: number; max: number }> = {};
  for (const s of scenes) for (const l of s.lines) {
    const i = l.indexOf(':');
    const who = l.slice(0, i);
    if (who === 'You') continue;
    const w = l.slice(i + 1).replace(/\([^)]*\)/g, '').trim().split(/\s+/).length;
    const b = (by[who] ??= { n: 0, words: 0, max: 0 });
    b.n++; b.words += w; b.max = Math.max(b.max, w);
  }
  console.log(f.id, JSON.stringify(by));
}
