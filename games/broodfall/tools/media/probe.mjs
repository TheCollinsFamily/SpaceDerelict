// A one-off probe: what a Veo 3.1 Lite spoken line costs and sounds like (the Voice, the Delegate).
import path from 'node:path';
import { RAW, balance, ready, veoSpeech, transcribe } from './lib.mjs';
ready();
const b0 = await balance();
await veoSpeech({ out: path.join(RAW, 'probe', 'voice-8s.mp4'), seconds: 8, prompt:
  'A 1950s black-and-white film: close-up of an old radio set glowing in a dark parlour. From its speaker a booming, ' +
  'fervent American radio evangelist of the 1950s, rolling and rising like a preacher, says exactly: "This is The Hour Is Near, on forty stations of the Last Hour Radio Network. And to the one who came down: I know you can hear me." ' +
  'Only his voice through the radio, no music, no other voices.' });
const b1 = await balance();
console.log('veo 8s tokens', b0 - b1);
console.log(await transcribe(path.join(RAW, 'probe', 'voice-8s.mp4')));
