/**
 * YOKE in the AI Core, as her Living Avatar: her body (clips that lie in
 * public/art/ship/yoke/, so she is seen with no network), her voice (rfab.ai reads each
 * sentence aloud), and her words as they arrive. What she is asked and how her answer is
 * read is src/meta/yokeAvatar.ts; this file is what the player sees and hears.
 *
 * To the campaign's screens she is one more ShipAiProvider. When rfab.ai cannot answer,
 * the next rung of the ladder does (Kimi, then the scripted YOKE) and she says its lines
 * with the same face: the player is never told which of them is speaking.
 */
import { artUrl } from '../render/art';
import { gain } from '../meta/storage';
import { ScriptedShipAi, type AiContext, type AiTrigger, type AiTurn, type ShipAiProvider, type ShipAiStatus } from '../meta/shipAi';
import type { CutKind, PlayerLink } from '../meta/yokePlayer';
import {
  AvatarError, AvatarLink, AvatarTalk, YokeLadder, avatarReason, clipFor, voiceClip,
  type YokeAvatarIds, type YokeBody,
} from '../meta/yokeAvatar';

/** A talk in the AI Core. `free`: not a discussion the campaign queued, but him coming in to talk. */
export interface YokeTalk { trigger: AiTrigger; turns: AiTurn[]; free?: boolean }

export interface YokeAvatarOptions {
  ids: YokeAvatarIds;
  base: string;
  key?: string;
  muted: boolean;
  /** Who answers when she cannot: Kimi, then the scripted YOKE. */
  rest: ShipAiProvider;
  /** Something the screen shows has changed (her history has come). */
  changed(): void;
  /** Her own mind on rfab.ai answers him (the avatar mode). False: she is only a body and a voice, and `rest` answers. */
  mind?: boolean;
  /** Her voice may be asked for (rfab.ai's /speak). False (the scripted YOKE): she is read, not heard, and nothing goes out. */
  voice?: boolean;
  /** The player's link (src/meta/yokePlayer.ts): she is HIS private YOKE, paid by the house's $3, then by his linked account. */
  player?: PlayerLink;
  /** Nobody pays for her any more: the screen shows the link prompt (src/ui/yokeAccount.ts). */
  onCut?(kind: CutKind): void;
  /** What she says when the money stops (src/meta/yokePlayer.ts cutOffLines). */
  cutOff?(kind: CutKind): string[];
}

/** One line of a prewritten script (a greeting): her face while she says it, and what she does after it. */
export interface ScriptLine {
  text: string;
  /** Clips that can show her face while and after she says it, best first. */
  face?: readonly string[];
  /** Cues acted after the line, one after the other: the clips that can act each (best first), and how long an expression is held (ms; a one-shot gesture plays to its end). */
  after?: Array<{ clips: readonly string[]; hold?: number }>;
}

/** Her face for each kind of talk, until she has said something with a face of its own. */
const FACE: Record<string, string> = {
  'first-deployment': 'curious', 'faction-allied': 'amused', midpoint: 'concerned', licence: 'calm', ending: 'sad', idle: 'calm',
  curious: 'curious', calm: 'calm', thinking: 'thinking',
};

type Beat =
  | { kind: 'say'; text: string; emotion: string | null; voice: Promise<ArrayBuffer | null>; shown: boolean; onShow?: (text: string) => void }
  | { kind: 'move'; state: string }
  /** An expression held for a while (a cue that is not a one-shot gesture). */
  | { kind: 'hold'; state: string; ms: number }
  /** The end of a script: its promise is kept here. */
  | { kind: 'mark'; done: () => void };

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class YokeAvatarUi implements ShipAiProvider {
  private ladder: YokeLadder;
  private talk: AvatarTalk;
  private link: AvatarLink;
  private stage: HTMLElement;
  private layers: HTMLVideoElement[] = [];
  private top = 0;
  private body: YokeBody | null = null;
  private have: string[] = [];
  /** Her clips, fetched once and kept: a change of face must not wait for a download. */
  private kept = new Map<string, string>();
  private shownState = '';
  private restFace = 'calm';
  /** The face of her last sentence, and when: she keeps it for a while, as a person does. */
  private held: { face: string; at: number } | null = null;
  private thinking = false;
  private beats: Beat[] = [];
  private playing = false;
  private sound: HTMLAudioElement | null = null;
  private soundUrl = '';
  private muted: boolean;
  /** Her voice cannot be had this session: she is read, not heard. */
  private voiceless = false;
  private told = new Set<string>();
  private inRoom = false;
  private entered = false;
  private past: AiTurn[] = [];
  private free: YokeTalk | null = null;
  /** The talk her sentences belong to, and those of this answer that are already on the screen. */
  private turns: AiTurn[] | null = null;
  private said: string[] = [];
  private heard = 0;
  private glance: ReturnType<typeof setTimeout> | null = null;
  private gone = false;
  /** Cuts short what she is doing now (a click skips ahead in a script). */
  private cut: (() => void) | null = null;
  private skipped = false;
  /** The element her stage stands in: the host (the AI Core) or the intercom's stage box. */
  private place: HTMLElement | null = null;

  constructor(private host: HTMLElement, private o: YokeAvatarOptions) {
    this.muted = o.muted;
    this.link = new AvatarLink({ base: o.base, avatarId: o.ids.avatarId, key: o.key, player: o.player });
    this.talk = new AvatarTalk(this.link, {
      onSentence: (text, emotion) => { this.heard++; this.say(text, emotion); },
      onMotion: (state) => this.move(state),
      onThinking: (on) => { this.thinking = on; this.rest(); },
    });
    this.talk.onUnasked = (text, emotion) => {
      // A sentence that came after her answer was taken to be over: it is hers all the same.
      this.turns?.push({ speaker: 'YOKE', text });
      this.say(text, emotion, true);
    };
    // While nobody pays for her, the scripted YOKE answers (it costs nothing): never Kimi, which would bill the same account.
    this.ladder = new YokeLadder(o.mind === false ? null : this.talk, o.rest, undefined, new ScriptedShipAi());
    this.ladder.cutOff = (kind) => o.cutOff?.(kind) ?? [];
    this.ladder.onCut = (kind) => { this.voiceless = true; o.onCut?.(kind); };
    this.stage = document.createElement('div');
    this.stage.className = 'cp-yoke cp-yoke-live';
    this.stage.dataset.state = '';
    for (let i = 0; i < 2; i++) {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.setAttribute('aria-hidden', 'true');
      this.stage.appendChild(v);
      this.layers.push(v);
    }
    void this.loadBody();
  }

  /** Who is answering. The player is shown nothing of it: no note. */
  get status(): ShipAiStatus { return { live: this.ladder.live, note: '' }; }

  /** Nobody pays for her live mind: she says so once, then the scripted YOKE answers. */
  get cut(): CutKind | null { return this.ladder.cut; }

  /** Money is back (he linked an account, or topped up): her live mind and voice again. */
  uncut(): void {
    this.ladder.uncut();
    this.voiceless = false;
  }

  /** His own talk with her: what was said before, and whatever he says now. One for the life of this screen. */
  freeTalk(): YokeTalk {
    this.free ??= { trigger: 'idle', turns: this.past, free: true };
    return this.free;
  }

  // ------------------------------------------------------------ her body

  private async loadBody(): Promise<void> {
    try {
      const res = await fetch(artUrl('ship/yoke/manifest.json'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const m = await res.json() as YokeBody;
      if (!m?.states?.idle) throw new Error('no idle clip in it');
      this.body = { states: m.states, oneShot: Array.isArray(m.oneShot) ? m.oneShot : [], seconds: m.seconds };
      this.have = Object.keys(m.states);
    } catch (err) {
      this.tell(`her body could not be loaded (${String((err as Error).message)}): she is heard and read, not seen`);
      return;
    }
    if (this.gone) return;
    this.rest();
    // The rest of her clips, one after the other, so that the first change of face is not a wait.
    for (const file of new Set(Object.values(this.body.states))) {
      if (this.gone) return;
      try {
        const res = await fetch(artUrl(`ship/yoke/${file}`));
        if (res.ok) this.kept.set(file, URL.createObjectURL(await res.blob()));
      } catch { /* it is played from its address instead */ }
    }
  }

  private src(state: string): string | null {
    const file = this.body?.states[state];
    if (!file) return null;
    return this.kept.get(file) ?? new URL(artUrl(`ship/yoke/${file}`), document.baseURI).href;
  }

  /** Put a clip on stage. `once`: a gesture, played once; `then` is called when it has ended (or could not be played). */
  private show(state: string, once = false, then?: () => void): void {
    const src = this.src(state);
    if (!src) { then?.(); return; }
    if (state === this.shownState && !once) { then?.(); return; }
    this.shownState = state;
    this.stage.dataset.state = state;
    const next = this.layers[1 - this.top];
    const now = this.layers[this.top];
    let ended = false;
    const end = () => { if (ended) return; ended = true; then?.(); };
    next.loop = !once;
    next.onended = once ? end : null;
    next.onerror = end;
    if (next.dataset.src !== src) { next.src = src; next.dataset.src = src; }
    try { next.currentTime = 0; } catch { /* not loaded yet: it starts at the beginning anyway */ }
    const up = () => {
      // Shown only once it has a picture: a layer with none would be a blink of nothing.
      if (this.shownState !== state) return;
      next.classList.add('on');
      now.classList.remove('on');
      this.top = 1 - this.top;
    };
    if (next.readyState >= 2) up(); else next.onloadeddata = up;
    void next.play().catch(() => { /* no picture: her words are still shown */ });
    // A gesture that never reports its end must not hold up what she says next.
    if (once) setTimeout(end, ((this.body?.seconds?.[state] ?? 4) + 1) * 1000);
  }

  /** The face she wears when she is neither speaking nor moving. */
  private rest(): void {
    if (this.playing) return;
    const held = this.held && Date.now() - this.held.at < 120000 ? this.held.face : null;
    const state = this.thinking ? clipFor('thinking', this.have) : clipFor(held ?? FACE[this.restFace] ?? this.restFace, this.have);
    if (state) this.show(state);
  }

  /** Now and then she looks aside, as someone does who is waiting for you to speak. */
  private glances(): void {
    if (this.glance) clearTimeout(this.glance);
    if (!this.inRoom || this.gone) return;
    this.glance = setTimeout(() => {
      const looks = ['look_left', 'look_right'].filter((s) => this.have.includes(s));
      const quiet = !this.playing && !this.thinking && !this.beats.length;
      if (quiet && looks.length && Math.random() < 0.5) {
        const look = looks[Math.floor(Math.random() * looks.length)];
        this.playing = true;
        this.show(look, true, () => { this.playing = false; this.shownState = ''; this.rest(); void this.drain(); });
      }
      this.glances();
    }, 9000 + Math.random() * 11000);
  }

  // ------------------------------------------------------------ her place on the screen

  /**
   * The campaign draws its screen again from nothing every time. Her stage is the same
   * element throughout, put back into the new screen: a clip that started again at every
   * sentence would be a twitch.
   */
  mount(show: boolean, face: string, into?: HTMLElement | null): void {
    if (this.gone) return;
    if (!show) { this.leaveRoom(); return; }
    this.restFace = face || 'calm';
    this.place = into ?? this.host;
    this.stage.classList.toggle('in-icom', !!into);
    this.place.insertBefore(this.stage, this.place.firstChild);
    for (const v of this.layers) if (v.classList.contains('on') && v.paused && v.dataset.src) void v.play().catch(() => {});
    if (!this.inRoom) {
      this.inRoom = true;
      this.glances();
      void this.enter();
    }
    this.rest();
    this.scroll();
  }

  private async enter(): Promise<void> {
    if (this.entered) return;
    this.entered = true;
    const turns = await this.ladder.enter();
    if (this.gone || !turns) return;
    // Filled in place: his talk with her holds this very list.
    if (!this.past.length && turns.length) {
      this.past.push(...turns.slice(-24));
      this.o.changed();
    }
  }

  private leaveRoom(): void {
    if (!this.inRoom) return;
    this.inRoom = false;
    this.entered = false;
    if (this.glance) clearTimeout(this.glance);
    this.hush();
    this.cut?.();
    // A script that was still playing is over: whoever waits for it is let go.
    for (const b of this.beats) if (b.kind === 'mark') b.done();
    this.beats = [];
    this.playing = false;
    this.ladder.leave();
    this.stage.remove();
    for (const v of this.layers) v.pause();
    this.shownState = '';
  }

  dispose(): void {
    this.leaveRoom();
    this.gone = true;
    for (const url of this.kept.values()) URL.revokeObjectURL(url);
    this.kept.clear();
  }

  // ------------------------------------------------------------ what she says

  async reply(ctx: AiContext, history: AiTurn[], playerLine?: string): Promise<string[]> {
    this.turns = history;
    this.said = [];
    this.heard = 0;
    this.restFace = ctx.trigger;
    const lines = await this.ladder.reply(ctx, history, playerLine);
    // Lines of a lower rung arrive all at once and with no face: she says them as she says her own.
    if (!this.heard) for (const l of lines) this.say(l, null);
    // From here on they are in the talk itself (the campaign adds them), and no longer only on the screen.
    this.said = [];
    return lines;
  }

  /** The sentences of the answer that is still coming: drawn by the campaign's screen while it waits. */
  pendingHtml(): string {
    return this.said.map((t) => `<div class="yoke"><b>YOKE:</b> ${esc(t)}</div>`).join('');
  }

  /**
   * A prewritten script (a greeting): each line in her voice (when it may be had) and her
   * talking clip, its face held after it, its cue acted before the next. No mind is asked
   * anything. `onLine`: a line has begun (the screen keeps it). Resolves when the script has
   * played to its end, or she was sent away.
   */
  play(lines: ScriptLine[], onLine: (text: string) => void): Promise<void> {
    const pick = (names?: readonly string[]) => names?.find((n) => this.have.includes(n)) ?? names?.[names.length - 1] ?? null;
    return new Promise<void>((done) => {
      if (this.gone || !this.inRoom) { done(); return; }
      for (const l of lines) {
        this.beats.push({ kind: 'say', text: l.text, emotion: pick(l.face), voice: this.voice(l.text), shown: false, onShow: onLine });
        for (const cue of l.after ?? []) {
          const then = pick(cue.clips);
          if (!then) continue;
          const gesture = this.body?.oneShot.includes(then);
          this.beats.push(gesture ? { kind: 'move', state: then } : { kind: 'hold', state: then, ms: cue.hold ?? 1800 });
        }
      }
      this.beats.push({ kind: 'mark', done });
      void this.drain();
    });
  }

  /** Skip ahead: what she is saying or doing now is cut short, and the next beat begins. */
  skip(): void {
    this.cut?.();
  }

  /** A script or an answer is still playing. */
  get busy(): boolean {
    return this.playing || this.beats.length > 0;
  }

  private say(text: string, emotion: string | null, late = false): void {
    // A tag her mind writes for the game ([[PRINT_BODY]]) is never shown or spoken.
    text = text.replace(/\s*\[\[[A-Z_]+\]\]\s*/g, ' ').trim();
    if (!text) return;
    this.beats.push({ kind: 'say', text, emotion, voice: this.voice(text), shown: late });
    if (late) this.line(text);
    void this.drain();
  }

  private move(state: string): void {
    if (!clipFor(state, this.have, '')) return;
    this.beats.push({ kind: 'move', state });
    void this.drain();
  }

  private voice(text: string): Promise<ArrayBuffer | null> {
    if (this.muted || this.voiceless || !this.inRoom || this.o.voice === false) return Promise.resolve(null);
    return this.link.speak(text).catch((err: unknown) => {
      // Out of tokens, or no key: there will be no voice this session, and asking again for every sentence is waste.
      if (err instanceof AvatarError && (err.status === 402 || err.sticky)) this.voiceless = true;
      this.tell(`her voice could not be had, she is read instead: ${avatarReason(err)}`);
      return null;
    });
  }

  /** One thing at a time, in the order it came: a sentence, a gesture, a sentence. */
  private async drain(): Promise<void> {
    if (this.playing) return;
    const beat = this.beats.shift();
    if (!beat) { this.rest(); return; }
    this.playing = true;
    this.skipped = false;
    const cut = new Promise<null>((r) => { this.cut = () => { this.skipped = true; r(null); }; });
    try {
      if (beat.kind === 'mark') {
        beat.done();
      } else if (beat.kind === 'move') {
        const state = clipFor(beat.state, this.have, '');
        if (state) await Promise.race([new Promise<void>((done) => this.show(state, this.body?.oneShot.includes(state) ?? true, done)), cut]);
        this.shownState = '';
      } else if (beat.kind === 'hold') {
        const state = clipFor(beat.state, this.have, '');
        if (state) { this.show(state); await Promise.race([wait(beat.ms), cut]); this.held = { face: state, at: Date.now() }; }
      } else {
        const sound = await Promise.race([beat.voice, wait(9000).then(() => null), cut]);
        // Her words appear as she begins to say them.
        if (!beat.shown) {
          if (beat.onShow) beat.onShow(beat.text); else this.said.push(beat.text);
          this.line(beat.text);
        }
        const face = clipFor(beat.emotion ?? FACE[this.restFace] ?? 'calm', this.have);
        const talking = voiceClip(beat.emotion ?? FACE[this.restFace] ?? 'calm', this.have);
        if (!this.skipped) {
          if (talking) this.show(talking);
          if (sound && !this.muted && this.inRoom) await Promise.race([this.sing(sound, Math.min(7000, 900 + beat.text.length * 55)), cut]);
          // Read, not heard: she speaks for as long as the sentence would take to say.
          else await Promise.race([wait(Math.min(7000, 900 + beat.text.length * 55)), cut]);
        }
        if (face) this.held = { face, at: Date.now() };
      }
    } finally {
      this.playing = false;
      this.cut = null;
      this.hush();
    }
    if (this.gone || !this.inRoom) return;
    if (this.beats.length) void this.drain(); else this.rest();
  }

  /** `readMs`: how long the line takes to read, when the browser will not play the sound (no click on the page yet). */
  private sing(bytes: ArrayBuffer, readMs = 0): Promise<void> {
    return new Promise<void>((done) => {
      this.hush();
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      const a = new Audio(url);
      a.volume = gain('voice'); // the settings' master × voices
      this.sound = a;
      this.soundUrl = url;
      let over = false;
      const end = () => {
        if (over) return;
        over = true;
        if (this.sound === a) { this.sound = null; this.soundUrl = ''; }
        URL.revokeObjectURL(url);
        done();
      };
      a.onended = end;
      a.onerror = end;
      a.onpause = () => { if (!a.ended) end(); };
      // A sound that cannot be played (no device, or the browser forbids it) must not leave her stuck on a sentence.
      void a.play().catch(() => { if (readMs) setTimeout(end, readMs); else end(); });
      setTimeout(end, 30000);
    });
  }

  private hush(): void {
    const a = this.sound;
    this.sound = null;
    if (a) { try { a.pause(); } catch { /* already over */ } }
    if (this.soundUrl) { URL.revokeObjectURL(this.soundUrl); this.soundUrl = ''; }
  }

  /** One line of hers into the talk that is on the screen, without drawing the screen again. */
  private line(text: string): void {
    const box = this.host.querySelector('.cp-talk');
    if (!box) return;
    const div = document.createElement('div');
    div.className = 'yoke';
    const b = document.createElement('b');
    b.textContent = 'YOKE:';
    div.append(b, ` ${text}`);
    box.insertBefore(div, box.querySelector('.thinking'));
    this.scroll();
  }

  private scroll(): void {
    const box = this.host.querySelector('.cp-talk');
    if (box) box.scrollTop = box.scrollHeight;
  }

  // ------------------------------------------------------------ her voice, on and off

  get isMuted(): boolean { return this.muted; }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.hush();
  }

  muteHtml(): string {
    return `<button data-act="yoke-mute" class="cp-mute" aria-pressed="${this.muted}" title="${this.muted ? 'Her voice is off' : 'Her voice is on'}">${this.muted ? 'VOICE OFF' : 'VOICE ON'}</button>`;
  }

  private tell(what: string): void {
    if (this.told.has(what)) return;
    this.told.add(what);
    console.warn(`[YOKE] ${what}`);
  }
}
