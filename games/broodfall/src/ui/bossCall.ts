/**
 * The boss's transmission (content/boss.ts): his face on the ship's comms screen, his name and
 * rank set in type, his words a caption at a time, his voice when it can be had (a file made once
 * by tools/art/boss.mjs; the game spends nothing to play it). A click skips it.
 */
import { BOSS } from '../../content/boss';
import { gain } from '../meta/storage';
import type { IntroArt } from './intro';

export function playBossCall(art: IntroArt | null): Promise<void> {
  const b = art?.boss;
  const el = document.createElement('div');
  el.id = 'boss-call';
  el.innerHTML = `<div class="bc-screen">
      <div class="bc-channel">${BOSS.channel}</div>
      <div class="bc-face">${b?.video ? `<video muted loop playsinline autoplay src="${b.video}"${b.poster ? ` poster="${b.poster}"` : ''}></video>` : b?.poster ? `<img src="${b.poster}" alt="">` : '<div class="bc-noface">NO PICTURE ON THIS CHANNEL</div>'}</div>
      <div class="bc-plate"><b>${BOSS.name}</b><span>${BOSS.rank}</span></div>
      <div class="bc-caption"></div>
      <div class="bc-skip">click to skip</div>
    </div>`;
  document.body.appendChild(el);
  const cap = el.querySelector<HTMLElement>('.bc-caption')!;
  const lines = BOSS.lines;
  const chars = lines.reduce((a, l) => a + l.length, 0);
  return new Promise<void>((done) => {
    let over = false;
    const timers: number[] = [];
    let audio: HTMLAudioElement | null = null;
    const end = () => {
      if (over) return;
      over = true;
      for (const t of timers) clearTimeout(t);
      try { audio?.pause(); } catch { /* over */ }
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 400);
      done();
    };
    el.addEventListener('click', end);
    /** The captions over `total` ms, each for its share of the words. */
    const run = (total: number) => {
      let at = 0;
      lines.forEach((l) => {
        timers.push(window.setTimeout(() => { cap.textContent = l; }, at));
        at += (l.length / chars) * total;
      });
      timers.push(window.setTimeout(end, total + 900));
    };
    const reading = lines.reduce((a, l) => a + 900 + l.length * 50, 0);
    if (!b?.voice) { run(reading); return; }
    audio = new Audio(b.voice);
    audio.volume = gain('voice');
    let started = false;
    audio.onloadedmetadata = () => {
      if (started) return;
      started = true;
      const ms = Number.isFinite(audio!.duration) && audio!.duration > 1 ? audio!.duration * 1000 : reading;
      void audio!.play().then(() => run(ms), () => run(reading));
    };
    audio.onerror = () => { if (!started) { started = true; run(reading); } };
    // No answer from the file at all: read.
    timers.push(window.setTimeout(() => { if (!started) { started = true; run(reading); } }, 4000));
  });
}
