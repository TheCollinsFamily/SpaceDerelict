/**
 * The ship's AI (YOKE) — the WIRING for the meta plot (Collins, Sep 28 2026: "the
 * ship's AI starts a discussion they can choose to engage with or not, with a big
 * lore book it will use to play out scenarios; we will build that later but want
 * the wiring now").
 *
 * The campaign queues discussions on triggers; the ship's AI Core shows them;
 * the player engages or says "not now". A provider turns (trigger, campaign
 * summary, lore book, history, the player's line) into YOKE's next lines. Today
 * the provider is scripted from the lore book's seeds; a model-backed provider
 * implements the same interface later.
 */

export type AiTrigger = 'first-deployment' | 'faction-allied' | 'midpoint' | 'licence' | 'ending' | 'idle';

export interface AiContext {
  trigger: AiTrigger;
  /** A plain-language summary of the campaign so far (held territories, faction, standing…). */
  summary: string;
  /** The lore book (content/lore/ship-ai-lorebook.md). */
  lore: string;
}

export interface AiTurn {
  speaker: 'YOKE' | 'You';
  text: string;
}

export interface ShipAiProvider {
  /** YOKE's next lines, given the conversation so far and (optionally) what the player just said. */
  reply(ctx: AiContext, history: AiTurn[], playerLine?: string): Promise<string[]>;
}

/** The scripted stand-in: reads the lore book's "Scenario seeds" and plays one line per turn. */
export class ScriptedShipAi implements ShipAiProvider {
  async reply(ctx: AiContext, history: AiTurn[], playerLine?: string): Promise<string[]> {
    const seed = seedFor(ctx.lore, ctx.trigger);
    const said = history.filter((t) => t.speaker === 'YOKE').length;
    if (said === 0) return [seed ?? 'I have a question, when you have a moment.'];
    if (said === 1) return [playerLine ? 'I have logged that. Thank you for answering.' : 'You do not have to answer.'];
    return ['I will stop asking for now. The terminal stays open.'];
  }
}

/** The seed line for a trigger, from the lore book's section 4. */
export function seedFor(lore: string, trigger: AiTrigger): string | null {
  const m = lore.match(new RegExp(`^- ${trigger}: "([\\s\\S]*?)"$`, 'm'));
  return m ? m[1].replace(/\s*\n\s*/g, ' ') : null;
}

/** Queue a discussion unless it is already waiting (the campaign stores the queue). */
export function queueDiscussion(queue: AiTrigger[], trigger: AiTrigger, seen: AiTrigger[]): AiTrigger[] {
  if (trigger !== 'idle' && seen.includes(trigger)) return queue;
  if (queue.includes(trigger)) return queue;
  return [...queue, trigger];
}
