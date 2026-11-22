/**
 * What Space does between waves: ONE step forward (Collins, Nov 22 2026: "space should go from the organ menu to the
 * phase set up and the ui should reflect this right now it says start wave").
 *
 * organ stage --Space--> the surface (place limbs) --Space--> the wave.
 *
 * One press is one step: a held key (repeat) does nothing, and the next step needs the key to come up first
 * (`SpaceLatch`), so a press can never run through the organ stage and the setup into the wave.
 */
export type SpaceStep = 'surface' | 'wave' | null;

export interface SpaceContext {
  /** The run is on screen (not the menu, a film or the ship). */
  started: boolean;
  /** The demo's autoplayer is driving. */
  auto: boolean;
  /** Something over the board owns the keys: the report, the settings, the codex. */
  blocked: boolean;
  /** The organ stage is open. */
  underOpen: boolean;
  phase: string;
  outcome: string;
}

export function spaceStep(c: SpaceContext): SpaceStep {
  if (!c.started || c.auto || c.blocked || c.outcome !== 'playing') return null;
  // The organ stage only opens at wave setup; a draft or a wave in progress has its own screen.
  if (c.phase !== 'growth') return null;
  return c.underOpen ? 'surface' : 'wave';
}

/** One step a press: armed again only when Space comes up. */
export class SpaceLatch {
  private down = false;
  /** True when this keydown may act (not a repeat, the key was up before). Marks the key held. */
  press(repeat: boolean): boolean {
    if (repeat || this.down) return false;
    this.down = true;
    return true;
  }
  release(): void { this.down = false; }
}
