import path from 'node:path';
import { makeClip, ready } from './rfab.mjs';
ready();
const D = 'art-src/terrain/core';
const model = process.argv[2];
const PROMPT = process.argv[3];
await makeClip({ slug: `grow test ${model}`, out: path.join(D, 'tests', `grow-1-2-${model.replace(/\W/g, '_')}.mp4`), stillFile: path.join(D, 'stage-1.png'), endFile: path.join(D, 'stage-2.png'), prompt: PROMPT, raw: true, resolution: '720p', models: [model] });
