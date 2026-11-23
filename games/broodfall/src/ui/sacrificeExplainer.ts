/**
 * THE EAT A LIMB EXPLAINER (Collins, Nov 23 2026: "a pop up explaining that mechanic with a video in it
 * showing it in play when the user is first placing towers"). Cannibalize-to-modify (DESIGN.md) has no
 * button: with a card in hand, hovering one of your limbs lights it and clicking eats it. A player who
 * never hovers a limb with a card in hand never finds it, so the first time it matters the game shows it
 * once, with a short loop filmed from the real game (public/art/explain/sacrifice.mp4, tools/media/
 * film-sacrifice.mjs). Shown once ever (src/meta/storage.ts sacrificeExplained); never under automation
 * (?auto=1, a driven browser) unless asked for with ?explain=sacrifice.
 */

/** What the page knows at the moment a card is picked up. */
export interface ExplainFacts {
  /** It has been shown before (on this machine). */
  seen: boolean;
  /** ?auto=1 or a driven browser (navigator.webdriver). */
  automated: boolean;
  /** ?explain=sacrifice: shown at the next moment it fits, seen or not, automated or not. */
  forced: boolean;
  /** A limb card is in hand now. */
  cardInHand: boolean;
  /** Limbs of the player's on the board that a click would eat (a tap is milked, not eaten). */
  eatable: number;
  /** The run's phase: 'growth' is the wave setup, when limbs are placed. */
  phase: string;
  wavesCleared: number;
  /** Mission 1 (src/meta/onboarding.ts), which shows one thing at a time. */
  mission1: boolean;
  /** Mission 1 has brought out the CANNIBALIZE readout (src/ui/hud.ts revealForMission1 'cannibal'). */
  cannibalShown: boolean;
  /** The card in hand can only be paid for by eating a limb (its red EAT A LIMB look). */
  onlyBySacrifice: boolean;
}

/**
 * Whether to show the explainer now. The first time a card is picked up with a limb of his standing to eat:
 * in the wave setup, or at any time when the card in hand can only be paid for by eating one. Mission 1
 * teaches one thing at a time, so there it waits until the game itself brings out cannibalizing (a few limbs
 * after the second wave), or a card he can only pay for by eating, after the first wave.
 */
export function shouldExplainSacrifice(f: ExplainFacts): boolean {
  if (!f.cardInHand || f.eatable < 1) return false;
  if (!f.forced && (f.seen || f.automated)) return false;
  if (f.mission1) return f.cannibalShown || (f.onlyBySacrifice && f.wavesCleared >= 1);
  return f.onlyBySacrifice || f.phase === 'growth';
}

let openEl: HTMLElement | null = null;

export function explainerOpen(): boolean {
  return openEl !== null;
}

/** Open it over the board; `onClose` when it is put away (OK, a click anywhere, Esc, Enter or Space). */
export function openSacrificeExplainer(video: string, salvagePct: number, onClose: () => void): void {
  if (openEl) return;
  const el = document.createElement('div');
  el.id = 'explain-sacrifice';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'xs-title');
  el.innerHTML = `<div class="xs-card">
      <div class="xs-title" id="xs-title">EAT A LIMB</div>
      <div class="xs-film"><video muted loop playsinline autoplay preload="auto" src="${video}"></video></div>
      <ul class="xs-lines">
        <li>With a card in hand, point at one of your limbs: it lights up. Click it to <b>eat it</b> on the spot.</li>
        <li>You get <b>${salvagePct}%</b> of its meat back to pay for the card, and its bonuses carry into the next limb you place.</li>
        <li>A card marked <b>EAT A LIMB</b> is one you can only pay for this way.</li>
      </ul>
      <button class="xs-ok" type="button">OK</button>
    </div>`;
  document.body.appendChild(el);
  openEl = el;
  const v = el.querySelector('video')!;
  v.muted = true;
  void v.play().catch(() => { /* the first frame stands */ });
  const ok = el.querySelector<HTMLButtonElement>('.xs-ok')!;
  ok.focus({ preventScroll: true });
  // Every key is the explainer's while it is open: Esc must not open the settings behind it, Space must not start the wave.
  const onKey = (ev: KeyboardEvent): void => {
    ev.stopImmediatePropagation();
    ev.preventDefault();
    if ((ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ')) close();
  };
  const close = (): void => {
    if (openEl !== el) return;
    openEl = null;
    window.removeEventListener('keydown', onKey, true);
    v.pause();
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 250);
    onClose();
  };
  window.addEventListener('keydown', onKey, true);
  el.addEventListener('click', (ev) => { ev.stopPropagation(); close(); });
  el.addEventListener('pointerdown', (ev) => ev.stopPropagation());
}
