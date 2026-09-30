/**
 * THE MAIN MENU, as one of the ship's own consoles (Collins, Sep 30 2026: "on subsequent boot
 * ups it opens to a menu stylized as one of the space ship's menus and with a looping video in
 * the background"). The loop is the view from the ship's viewport over the infested planet
 * (tools/art/intro.mjs `menu`; public/art/intro/menu.mp4). The console is the ship's look
 * (src/ship.css): black glass, razor-thin white lines, Bahnschrift, nothing ornamental.
 *
 * It is only ever seen after the first mission: until then the game opens straight into it
 * (src/meta/onboarding.ts launchKind), so the ship is not given away before the player gets there.
 */
import type { CampaignState } from '../meta/campaign';
import { loadYoke, saveYoke, type YokeSettings } from '../meta/storage';
import { YOKE_AVATAR, type YokeMode } from '../meta/yokeAvatar';
import { loadIntroArt } from './intro';

export interface MenuHooks {
  /** CONTINUE: to the ship (or back into mission 1, if it never finished). */
  continueCampaign(): void;
  /** NEW CAMPAIGN: mission 1 again, the desk dark again. */
  newCampaign(): void;
  /** SKIRMISH: one board, no campaign (the entrance wager is chosen beside it). */
  skirmish(): void;
  /** REPLAY THE OPENING. */
  replayIntro(): void;
  /** Forget everything: the next start is a first launch. */
  reset(): void;
}

export class ConsoleMenu {
  private el = document.getElementById('menu')!;
  private confirming: 'new' | 'reset' | null = null;
  private yoke: YokeSettings = loadYoke();

  constructor(private saved: CampaignState | null, private hooks: MenuHooks) {
    this.el.classList.add('console-menu');
    this.el.addEventListener('click', (ev) => this.onClick(ev));
    this.status();
    this.dressVideo();
  }

  /** The line under the name: where the campaign stands. */
  private status(): void {
    const s = this.saved;
    const note = document.getElementById('menu-campaign-note');
    const cont = document.getElementById('menu-campaign');
    const fresh = document.getElementById('menu-new');
    if (cont) cont.classList.toggle('hidden', !s);
    if (fresh) fresh.textContent = this.confirming === 'new' ? 'NEW CAMPAIGN — THE CURRENT ONE IS LOST. AGAIN TO CONFIRM' : 'NEW CAMPAIGN';
    if (note) {
      note.innerHTML = s
        ? `<span>DEPLOYMENTS <b>${s.deployments}</b></span><span>TERRITORIES <b>${s.held.length}</b></span><span>STANDING <b>${s.standing}</b></span><span>FIELD NOTES <b>${s.notes}</b></span>`
        : '<span>NO CAMPAIGN ON RECORD</span>';
    }
    const reset = document.getElementById('menu-reset');
    if (reset) reset.textContent = this.confirming === 'reset' ? 'FORGET EVERYTHING — AGAIN TO CONFIRM' : 'FORGET EVERYTHING (start as new)';
    const voice = document.getElementById('menu-voice');
    if (voice) voice.textContent = `YOKE'S VOICE: ${this.yoke.muted ? 'OFF' : 'ON'}`;
    const mode = document.getElementById('menu-yoke-mode');
    const name: Record<YokeMode, string> = { avatar: 'HER LIVING AVATAR (rfab.ai)', kimi: 'KIMI VIA RFAB.AI', scripted: 'SCRIPTED (offline, free)' };
    if (mode) mode.textContent = `YOKE ANSWERS WITH: ${name[this.yoke.mode]}`;
  }

  /**
   * The viewport's loop behind the console; its first frame (or the ship in orbit) until it plays.
   * It is loaded and played only while the menu is on the screen: a 720p video decoding behind a
   * running board costs the board its frames.
   */
  private dressVideo(): void {
    const v = this.el.querySelector<HTMLVideoElement>('.menu-video');
    if (!v) return;
    const shown = () => !this.el.classList.contains('hidden');
    const start = () => {
      if (!shown()) return;
      void loadIntroArt().then((art) => {
        const m = art?.menu;
        if (!m) { this.el.classList.add('no-video'); return; }
        if (!shown()) return;
        if (!v.src) { if (m.poster) v.poster = m.poster; v.src = m.video; v.loop = true; v.muted = true; }
        void v.play().catch(() => { /* the poster stays */ });
        this.el.classList.add('has-video');
      });
    };
    new MutationObserver(() => { if (shown()) start(); else v.pause(); }).observe(this.el, { attributes: true, attributeFilter: ['class'] });
    // The page decides in this same task whether the menu is shown (a run started from the address hides it).
    queueMicrotask(start);
  }

  private onClick(ev: MouseEvent): void {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    const was = this.confirming;
    this.confirming = null;
    switch (b.id) {
      case 'menu-campaign': this.hooks.continueCampaign(); return;
      case 'menu-new':
        // A campaign on record is not thrown away by one click.
        if (this.saved && was !== 'new') { this.confirming = 'new'; this.status(); return; }
        this.hooks.newCampaign();
        return;
      case 'menu-intro': this.hooks.replayIntro(); return;
      case 'menu-settings': this.el.classList.toggle('settings-open'); this.status(); return;
      case 'menu-voice': this.setYoke({ ...this.yoke, muted: !this.yoke.muted }); return;
      case 'menu-yoke-mode': {
        const order: YokeMode[] = YOKE_AVATAR ? ['avatar', 'kimi', 'scripted'] : ['kimi', 'scripted'];
        this.setYoke({ ...this.yoke, mode: order[(order.indexOf(this.yoke.mode) + 1) % order.length] });
        return;
      }
      case 'menu-reset':
        if (was !== 'reset') { this.confirming = 'reset'; this.status(); return; }
        this.hooks.reset();
        return;
    }
    this.status();
  }

  private setYoke(y: YokeSettings): void {
    this.yoke = y;
    saveYoke(y);
    this.status();
  }
}
