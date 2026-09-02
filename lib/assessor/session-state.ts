import type { SessionEngine } from "@/lib/engine/session-engine";
import type { SessionPhase } from "@/lib/data/types";

/** The volatile state the managed Assessor fetches live through its tool. */
export interface AssessorSessionState {
  sessionId: string;
  currentCode: string;
  passedCount: number;
  failedCount: number;
  phase: SessionPhase;
}

/**
 * The get_session_state tool: returns the Candidate's current code and the
 * visible Run counts through the SessionEngine query surface. This is the only
 * window the Assessor has onto live Session state, and it deliberately omits
 * the Problem's hidden-test inputs and expected outputs.
 */
export async function getSessionStateForTool(
  engine: SessionEngine,
  sessionId: string,
): Promise<AssessorSessionState> {
  const query = await engine.query(sessionId);
  return {
    sessionId: query.session.id,
    currentCode: query.currentCode,
    passedCount: query.passedCount,
    failedCount: query.failedCount,
    phase: query.session.phase,
  };
}