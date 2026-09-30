/** Probe: which RFab route makes usable sound effects and music (spends a little). */
import { ready, soundTake, songTakes, balance, pool } from './rfab-audio.mjs';
ready();
const b0 = await balance();
const SFX = 'Sound design only: no music, no speech, no voices. Close-miked foley in a dead quiet room. ';
const which = process.argv.slice(2);
const jobs = [
  { id: 'probe-spit-veo', kind: 'sfx', model: 'imagerouter:veo-3.1-lite-t2v', seconds: 8, prompt: SFX + 'Macro shot of a wet fleshy alien creature on black spitting globs of acid, four separate times, each a sharp wet splutter and hiss, with two seconds of silence between each spit.' },
  { id: 'probe-spit-wan', kind: 'sfx', model: 'atlascloud:wan-3.0-t2v', seconds: 5, resolution: '480p', prompt: SFX + 'Macro shot of a wet fleshy alien creature on black spitting globs of acid, three separate times, each a sharp wet splutter and hiss, with silence between each spit.' },
  { id: 'probe-spit-h3', kind: 'sfx', model: 'atlascloud:h3-t2v', seconds: 6, resolution: '480p', prompt: SFX + 'Macro shot of a wet fleshy alien creature on black spitting globs of acid, three separate times, each a sharp wet splutter and hiss, with silence between each spit.' },
  { id: 'probe-hum-mureka', kind: 'music', model: 'mureka:mureka-9', spec: { title: 'Merciful Yoke', form: 'instrumental', targetSeconds: 60, style: { instrumental: true, genres: ['dark ambient', 'drone'], moods: ['austere', 'eerie', 'cold'], tempo: 'slow', instruments: ['low synth drone', 'ship engine hum', 'sparse bowed metal'], freeform: 'The hum of a black orbital warship. Austere, sparse, a little eerie. No drums, no melody hooks, no vocals. Seamless and loopable.' } } },
  { id: 'probe-hum-lyria', kind: 'music', model: 'replicate:google/lyria-3', spec: { title: 'Merciful Yoke', form: 'instrumental', targetSeconds: 30, style: { instrumental: true, genres: ['dark ambient', 'drone'], moods: ['austere', 'eerie', 'cold'], tempo: 'slow', instruments: ['low synth drone', 'ship engine hum', 'sparse bowed metal'], freeform: 'The hum of a black orbital warship. Austere, sparse, a little eerie. No drums, no vocals.' } } },
  { id: 'probe-hum-eleven', kind: 'music', model: 'elevenlabs:music_v2', spec: { title: 'Merciful Yoke', form: 'instrumental', targetSeconds: 45, style: { instrumental: true, genres: ['dark ambient', 'drone'], moods: ['austere', 'eerie', 'cold'], tempo: 'slow', instruments: ['low synth drone', 'ship engine hum', 'sparse bowed metal'], freeform: 'The hum of a black orbital warship. Austere, sparse, a little eerie. No drums, no vocals.' } } },
].filter((j) => !which.length || which.some((w) => j.id.includes(w)));
await pool(jobs, 6, (j) => (j.kind === 'sfx' ? soundTake(j) : songTakes(j)));
console.log('spent tokens:', b0 - (await balance()));
