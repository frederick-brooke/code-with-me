import { SessionEngineError } from "@/lib/engine/session-engine";
import type { SessionEngine } from "@/lib/engine/session-engine";

/** The ceiling of authored hint tiers a Candidate can progress through. */
export const MAX_HINT_TIERS = 3;

/** What the guard returns when a Problem has no authored hint tiers. */
const FALLBACK_GUIDANCE =
  "Break the problem into smaller pieces first: restate what your function has to return, then decide what information you need to carry as you go. If you can say the plan in plain words, the code usually follows.";

export interface HintResponse {
  sessionId: string;
  hintsGiven: number;
  tier: number;
  guidance: string;
}

/**
 * Which authored tier a hint request lands on, given how many hints have been
 * handed out. Escalates one tier per request and holds the most concrete tier
 * once the authored tiers run out; a Problem with no authored tiers gets none.
 */
export function hintTierIndex(hintsGiven: number, tierCount: number): number {
  if (tierCount <= 0) {
    return -1;
  }
  return Math.min(hintsGiven, tierCount) - 1;
}

function tierNumber(hintsGiven: number, tiers: string[]): number {
  return Math.min(hintsGiven, Math.max(tiers.length, 1));
}

/**
 * The get_hint structural guard (ADR-0001): records a hint request, escalates
 * the Candidate one tier, and serves the Problem's authored approach/structure
 * guidance — never a full solution. Guidance is authored with the Problem in
 * the seed data, so tightening the policy is a backend change and no externally
 * hosted prompt can leak an implementation. The response never carries hidden
 * test inputs, expected outputs, or any problem internals beyond the guidance.
 */
export async function getHintForTool(engine: SessionEngine, sessionId: string): Promise<HintResponse> {
  const view = await engine.getSession(sessionId);
  if (!view) {
    throw new SessionEngineError("unknown-session", `Unknown session: ${sessionId}`);
  }
  const tiers: string[] = view.problem?.hintTiers ?? [];
  const session = await engine.recordHint(sessionId);
  const index = hintTierIndex(session.hintsGiven, tiers.length);
  return {
    sessionId,
    hintsGiven: session.hintsGiven,
    tier: tierNumber(session.hintsGiven, tiers),
    guidance: index >= 0 ? tiers[index] : FALLBACK_GUIDANCE,
  };
}