/**
 * The ship's AI (YOKE) — the WIRING for the meta plot (Collins, Sep 28 2026: "the
 * ship's AI starts a discussion they can choose to engage with or not, with a big
 * lore book it will use to play out scenarios; we will build that later but want
 * the wiring now").
 *
 * The campaign queues discussions on triggers; the ship's AI Core shows them;
 * the player engages or says "not now". A provider turns (trigger, campaign
 * summary, lore book, history, the player's line) into YOKE's next lines.
 *
 * Two providers (Sep 28 2026, Collins: "this should use kimi 2 and the rfab backend"):
 * RfabShipAi asks rfab.ai's POST /api/broodfall/ship-ai (Kimi K2.6, billed to the
 * player's RFab account); ScriptedShipAi plays the lore book's seeds. FallbackShipAi
 * runs the first and drops to the second whenever rfab.ai cannot answer, so YOKE
 * never goes silent.
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

/** Why the model could not answer, in the player's words (shown in the AI Core). */
export class ShipAiError extends Error {
  constructor(readonly status: number, readonly code: string | undefined, message: string) { super(message); }
  /** A failure that will not fix itself this session (no key, no route): stop asking. */
  get sticky(): boolean { return this.status === 401 || this.status === 403 || this.status === 404; }
}

export function reasonFor(err: unknown): string {
  if (err instanceof ShipAiError) {
    if (err.status === 401 || err.status === 403) return 'no RFab API key linked';
    if (err.status === 402) return 'out of RFab tokens';
    if (err.status === 404) return 'rfab.ai does not have YOKE yet';
    if (err.status === 0) return 'rfab.ai is unreachable';
    return err.message || `rfab.ai answered ${err.status}`;
  }
  return 'rfab.ai is unreachable';
}

export interface RfabLink {
  /** API root: '/rfab-api' (the Vite proxy — it adds the launcher's RFAB_API_KEY) or https://api.rfab.ai. */
  base: string;
  /** The player's own RFab API key (Settings → API keys on rfab.ai); optional behind the proxy. */
  key?: string;
  /** Opaque per-campaign id: YOKE's spend is billed on broodfall_shipai_<id>. */
  campaignId: string;
  /**
   * The player's link (src/meta/yokePlayer.ts): his player token goes with the call, so Kimi
   * follows the same money rules as her mind (the house's $3, then his linked account).
   */
  player?: { headers(json?: boolean): Record<string, string>; ensure(): Promise<string | null>; legacy: boolean };
}

/** YOKE on Kimi K2.6 through rfab.ai. Throws ShipAiError when rfab.ai cannot answer. */
export class RfabShipAi implements ShipAiProvider {
  /** RFab tokens the last reply cost. */
  lastCharge = 0;
  constructor(private link: RfabLink, private fetcher: typeof fetch = (...a) => fetch(...a)) {}

  async reply(ctx: AiContext, history: AiTurn[], playerLine?: string): Promise<string[]> {
    // The UI appends the player's line to the transcript before asking; send it once.
    const last = history[history.length - 1];
    const past = playerLine && last?.speaker === 'You' && last.text === playerLine ? history.slice(0, -1) : history;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const player = this.link.player;
    if (player && !player.legacy && await player.ensure()) headers = { ...headers, ...player.headers(true) };
    else if (this.link.key) headers['X-API-Key'] = this.link.key;
    let res: Response;
    try {
      res = await this.fetcher(`${this.link.base.replace(/\/$/, '')}/api/broodfall/ship-ai`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ campaignId: this.link.campaignId, trigger: ctx.trigger, summary: ctx.summary, lore: ctx.lore, history: past, playerLine }),
      });
    } catch {
      throw new ShipAiError(0, 'NETWORK', 'rfab.ai is unreachable');
    }
    let body: { lines?: unknown; tokensCharged?: number; code?: string; error?: string } | null = null;
    try { body = await res.json(); } catch { /* not JSON: a proxy page or an HTML 404 */ }
    const lines = Array.isArray(body?.lines) ? (body!.lines as unknown[]).filter((l): l is string => typeof l === 'string' && !!l.trim()) : [];
    if (!res.ok || !lines.length) throw new ShipAiError(res.ok ? 502 : res.status, body?.code, body?.error ?? '');
    this.lastCharge = Number(body?.tokensCharged) || 0;
    return lines;
  }
}

export interface ShipAiStatus { live: boolean; note: string }

/** Ask the primary; when it cannot answer, answer from the fallback and say why. */
export class FallbackShipAi implements ShipAiProvider {
  status: ShipAiStatus = { live: false, note: 'not asked yet' };
  private off = false;
  constructor(private primary: RfabShipAi | null, private fallback: ShipAiProvider = new ScriptedShipAi()) {
    if (!primary) this.status = { live: false, note: 'scripted (set in the AI Core)' };
  }

  async reply(ctx: AiContext, history: AiTurn[], playerLine?: string): Promise<string[]> {
    if (this.primary && !this.off) {
      try {
        const lines = await this.primary.reply(ctx, history, playerLine);
        this.status = { live: true, note: `Kimi K2.6 via rfab.ai, ${this.primary.lastCharge} tokens` };
        return lines;
      } catch (err) {
        if (err instanceof ShipAiError && err.sticky) this.off = true;
        this.status = { live: false, note: `scripted: ${reasonFor(err)}` };
      }
    }
    return this.fallback.reply(ctx, history, playerLine);
  }
}

/** A campaign's billing id, from its seed (stable for the life of the save). */
export function campaignIdFor(seed: number): string {
  return `c${Math.abs(Math.trunc(seed)).toString(36)}`;
}
