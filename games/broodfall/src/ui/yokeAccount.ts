/**
 * YOKE's account, in the AI Core (Collins, Sep 30 2026): what is left of the free talk, the
 * prompt when it is spent, the code that links an RFab account, and — once linked — the
 * balance, a top-up link and the model her mind runs on. What happens is src/meta/yokePlayer.ts;
 * this file is what the player sees. Clicks come in through `click(act, el)` (data-act="acct-…").
 */
import '../yokeAccount.css';
import {
  allowanceLeft, allowanceText, bonusTimes, costText, dollars, tokensText, watchConnect,
  type ConnectCode, type CutKind, type PlayerLink, type YokeAccountState,
} from '../meta/yokePlayer';

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export interface YokeAccountHooks {
  /** Something on screen changed: draw it again. */
  changed(): void;
  /** Money is back (linked, topped up, a model chosen): her live mind may answer again. */
  resumed(): void;
  /** Open a page on rfab.ai (the connect page, the top-up page) in the player's browser. */
  open?(url: string): void;
}

export class YokeAccountUi {
  state: YokeAccountState | null = null;
  /** Why she is not answering live, when the server said so (or the meter reads spent). */
  cut: CutKind | null = null;
  private code: (ConnectCode & { until: number }) | null = null;
  private expired = false;
  private watcher: { stop(): void } | null = null;
  private tick: ReturnType<typeof setInterval> | null = null;
  private note = '';
  private busy = false;
  private error = '';
  /** The model list is open (it is folded away until he asks for it). */
  private picking = false;

  constructor(private link: PlayerLink, private hooks: YokeAccountHooks) {}

  /** rfab.ai has the player route (false on an RFab whose deploy is owed: nothing is shown). */
  get available(): boolean { return !this.link.legacy && !!this.state; }

  /** Read the account again (after every reply of hers, and when the AI Core opens). */
  async refresh(): Promise<void> {
    try {
      const s = await this.link.state();
      this.state = s;
      if (s) {
        if (!s.connected && s.allowance.spent) this.cut = 'allowance';
        else if (this.cut === 'allowance' && s.connected) this.cut = null;
        else if (this.cut === 'topup' && s.connected && (s.account?.balanceTokens ?? 0) > 4000) { this.cut = null; this.hooks.resumed(); }
        else if (this.cut === 'resting' && s.houseReady && !s.allowance.spent) this.cut = null;
      }
    } catch { /* no network: the last state stands */ }
    this.hooks.changed();
  }

  /** The server refused her for money (src/meta/yokeAvatar.ts YokeLadder.onCut). */
  setCut(kind: CutKind): void {
    if (this.link.legacy) return;
    this.cut = kind;
    this.hooks.changed();
    void this.refresh();
  }

  dispose(): void {
    this.watcher?.stop();
    if (this.tick) clearInterval(this.tick);
  }

  // ------------------------------------------------------------ what he sees

  /**
   * `where`: 'core' is the AI Core's panel (the meter, the prompt, the code, the account);
   * 'say' replaces the line he types to her, when she is cut off.
   */
  html(where: 'core' | 'say' = 'core', opts: { prompt?: boolean } = {}): string {
    const s = this.state;
    if (!s || this.link.legacy) return '';
    if (where === 'say') return this.cut ? (this.code ? this.codeHtml() : this.promptHtml(true)) : '';
    if (this.code) return opts.prompt === false ? '' : this.codeHtml();
    const parts: string[] = [];
    if (this.note) parts.push(`<div class="cp-acct-note">${esc(this.note)}</div>`);
    if (this.error) parts.push(`<div class="cp-acct-note bad">${esc(this.error)}</div>`);
    if (s.connected) parts.push(this.accountHtml(s, opts.prompt !== false));
    else if (this.cut) { if (opts.prompt !== false) parts.push(this.promptHtml(false)); }
    else parts.push(this.meterHtml(s));
    if (!parts.length) return '';
    return `<div class="cp-acct" data-acct="${s.connected ? 'linked' : this.cut ? 'cut' : 'guest'}">${parts.join('')}</div>`;
  }

  /** The free talk, small: a bar and a line. */
  private meterHtml(s: YokeAccountState): string {
    const left = allowanceLeft(s.allowance);
    return `<div class="cp-acct-meter" title="YOKE's live mind and voice are paid by the Broodfall house up to ${dollars(s.allowance.capTokens)} of RFab tokens. Link an RFab account to keep talking after that.">
      <span class="cp-acct-k">FREE TALK</span>
      <span class="cp-acct-bar"><i style="width:${Math.round(left * 100)}%"></i></span>
      <span class="cp-acct-v">${esc(allowanceText(s.allowance))}</span>
      <button data-act="acct-link" class="cp-acct-small">LINK RFAB ACCOUNT</button></div>`;
  }

  /** The prompt when nobody pays: in her room it replaces the line he types to her. */
  private promptHtml(compact: boolean): string {
    const s = this.state!;
    if (this.cut === 'topup') {
      const url = s.account?.topUpUrl ?? 'https://rfab.ai/tokens/purchase';
      return `<div class="cp-acct-cut${compact ? ' compact' : ''}">
        <div class="cp-acct-h">YOKE IS OUT OF TOKENS</div>
        <p>Your RFab account is too low for her to answer (${tokensText(s.account?.balanceTokens ?? 0)} tokens left). Top it up on rfab.ai, then come back.</p>
        <div class="cp-acct-btns"><button class="screen-btn" data-act="acct-open" data-url="${esc(url)}">TOP UP ON RFAB.AI</button><button data-act="acct-refresh">I HAVE TOPPED UP</button></div></div>`;
    }
    const times = bonusTimes(s.bonusTokens, s.allowance.capTokens);
    const head = this.cut === 'resting' ? 'YOKE IS RESTING' : 'YOUR FREE TALK WITH YOKE IS USED UP';
    return `<div class="cp-acct-cut${compact ? ' compact' : ''}">
      <div class="cp-acct-h">${head}</div>
      <p>Link an RFab account to keep talking to her. Linking gives you <b>${tokensText(s.bonusTokens)} free tokens (${dollars(s.bonusTokens)})</b> — ${times}× the free talk you had. After that her words and voice are paid from your RFab balance, and you choose the model she thinks with.</p>
      <p class="cp-acct-fine">Her scripted lines, greetings and scenes stay free. Nothing is charged to you until you link.</p>
      <div class="cp-acct-btns"><button class="screen-btn" data-act="acct-link">LINK AN RFAB ACCOUNT</button></div></div>`;
  }

  /** The code screen: what to type, where, and how long it lives. */
  private codeHtml(): string {
    const c = this.code!;
    if (this.expired) {
      return `<div class="cp-acct"><div class="cp-acct-code expired"><div class="cp-acct-h">THE CODE HAS EXPIRED</div>
        <div class="cp-acct-btns"><button class="screen-btn" data-act="acct-link">GET A NEW CODE</button><button data-act="acct-cancel">CANCEL</button></div></div></div>`;
    }
    const secs = Math.max(0, Math.round((c.until - Date.now()) / 1000));
    const host = c.verifyUrl.replace(/^https?:\/\//, '');
    return `<div class="cp-acct"><div class="cp-acct-code">
      <div class="cp-acct-h">LINK AN RFAB ACCOUNT</div>
      <p>On any device, go to <b>${esc(host)}</b>, sign in (or sign up — it is free), and enter this code:</p>
      <div class="cp-acct-big" aria-label="Your code">${esc(c.userCode)}</div>
      <div class="cp-acct-btns"><button class="screen-btn" data-act="acct-open" data-url="${esc(c.verifyUrlComplete)}">OPEN RFAB.AI</button><button data-act="acct-cancel">CANCEL</button></div>
      <p class="cp-acct-fine"><span class="cp-acct-wait"></span> Waiting for you to approve it… the code works for <span class="cp-acct-left">${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</span>.
      You get ${tokensText(c.bonusTokens ?? this.state?.bonusTokens ?? 0)} free tokens when you approve.</p></div></div>`;
  }

  /** Linked: the balance, the top-up link, her model. */
  private accountHtml(s: YokeAccountState, prompt = true): string {
    const a = s.account;
    const models = this.picking
      ? `<div class="cp-acct-models" role="listbox" aria-label="The model her mind runs on">${s.models.map((m) => `
          <button class="cp-acct-model${m.id === s.model.id ? ' on' : ''}" data-act="acct-model" data-model="${esc(m.id)}" role="option" aria-selected="${m.id === s.model.id}">
            <b>${esc(m.label)}</b>${m.isDefault ? ' <i>default</i>' : ''}<span>${esc(m.blurb ?? '')}</span><em>${esc(costText(m))}</em></button>`).join('')}
        </div>`
      : '';
    return `<div class="cp-acct-linked">
      <div class="cp-acct-row"><span class="cp-acct-k">LINKED TO RFAB</span>
        <span class="cp-acct-v">${a?.name ? `${esc(a.name)} · ` : ''}${a?.balanceTokens != null ? `${tokensText(a.balanceTokens)} tokens` : 'balance unknown'}</span>
        <button data-act="acct-open" data-url="${esc(a?.topUpUrl ?? 'https://rfab.ai/tokens/purchase')}" class="cp-acct-small">TOP UP</button></div>
      <div class="cp-acct-row"><span class="cp-acct-k">HER MIND</span><span class="cp-acct-v"><b>${esc(s.model.label)}</b></span>
        <button data-act="acct-models" class="cp-acct-small">${this.picking ? 'CLOSE' : 'CHANGE'}</button>
        <button data-act="acct-unlink" class="cp-acct-small quiet" title="Stop paying for YOKE from this RFab account">UNLINK</button></div>
      ${models}
      ${prompt && this.cut === 'topup' ? this.promptHtml(true) : ''}
    </div>`;
  }

  // ------------------------------------------------------------ what he does

  /** A data-act="acct-…" click. True when it was one of ours. */
  click(act: string | undefined, el: HTMLElement): boolean {
    if (!act?.startsWith('acct-')) return false;
    switch (act) {
      case 'acct-link': void this.startLink(); break;
      case 'acct-cancel': this.stopLink(); this.hooks.changed(); break;
      case 'acct-open': this.open(el.dataset.url ?? ''); break;
      case 'acct-refresh': void this.refresh(); break;
      case 'acct-models': this.picking = !this.picking; this.hooks.changed(); break;
      case 'acct-model': void this.pick(el.dataset.model ?? ''); break;
      case 'acct-unlink': void this.unlink(); break;
      default: return false;
    }
    return true;
  }

  private open(url: string): void {
    if (!/^https:\/\//.test(url)) return;
    if (this.hooks.open) this.hooks.open(url);
    else window.open(url, '_blank', 'noopener');
  }

  private async startLink(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.stopLink();
    try {
      const code = await this.link.startConnect();
      this.code = { ...code, until: Date.now() + code.expiresIn * 1000 };
      this.expired = false;
      this.watcher = watchConnect(this.link, code, {
        connected: (bonus) => void this.linked(bonus),
        expired: () => { this.expired = true; this.hooks.changed(); },
      });
      // The countdown ticks in place: the screen is not drawn again for it.
      this.tick = setInterval(() => {
        const el = document.querySelector('.cp-acct-left');
        if (!this.code || !el) return;
        const secs = Math.max(0, Math.round((this.code.until - Date.now()) / 1000));
        el.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      }, 1000);
    } catch {
      this.error = 'No code could be had from rfab.ai just now. Try again in a moment.';
    } finally {
      this.busy = false;
      this.hooks.changed();
    }
  }

  private stopLink(): void {
    this.watcher?.stop();
    this.watcher = null;
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
    this.code = null;
    this.expired = false;
  }

  private async linked(bonus?: { tokens: number; note: string | null }): Promise<void> {
    this.stopLink();
    this.cut = null;
    this.note = bonus?.tokens
      ? `Linked. ${tokensText(bonus.tokens)} free tokens were added to your RFab account. YOKE runs on it now.`
      : `Linked. YOKE runs on your RFab account now.${bonus?.note ? ` (${bonus.note})` : ''}`;
    await this.refresh();
    this.hooks.resumed();
  }

  private async pick(id: string): Promise<void> {
    if (!id || id === this.state?.model.id) { this.picking = false; this.hooks.changed(); return; }
    try {
      const m = await this.link.setModel(id);
      this.note = `Her mind now runs on ${m.label}.`;
      this.picking = false;
      this.error = '';
    } catch {
      this.error = 'The model could not be changed just now.';
    }
    await this.refresh();
  }

  private async unlink(): Promise<void> {
    try {
      await this.link.disconnect();
      this.note = 'Unlinked. Your RFab account pays for nothing more here.';
    } catch {
      this.error = 'The game could not be unlinked just now.';
    }
    await this.refresh();
  }
}
