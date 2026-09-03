import type { SessionEngine } from "@/lib/engine/session-engine";
import type { SessionPhase } from "@/lib/data/types";

/** The volatile state the managed Assessor fetches live through its tool. */
export interface AssessorSessionState {
  sessionId: string;
  currentCode: string;
  passedCount: number;
  failedCount: number;
  runCount: number;
  lastRunSecondsAgo: number | null;
  lastActivitySecondsAgo: number | null;
  phase: SessionPhase;
}

function secondsSince(date: Date | null, now: Date): number | null {
  if (date === null) {
    return null;
  }
  return Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
}

/**
 * The get_session_state tool: returns the Candidate's Working Code snapshot
 * and the visible Run counts through the SessionEngine query surface, plus how
 * recently the last Run happened and how recently the Candidate was active, so
 * the Assessor can probe a genuine silence rather than barging in. This is the
 * only window the Assessor has onto live Session state, and it deliberately
 * omits the Problem's hidden-test inputs and expected outputs.
 */
export async function getSessionStateForTool(
  engine: SessionEngine,
  sessionId: string,
  now: Date = new Date(),
): Promise<AssessorSessionState> {
  const query = await engine.query(sessionId);
  return {
    sessionId: query.session.id,
    currentCode: query.currentCode,
    passedCount: query.passedCount,
    failedCount: query.failedCount,
    runCount: query.runCount,
    lastRunSecondsAgo: secondsSince(query.lastRunAt, now),
    lastActivitySecondsAgo: secondsSince(query.lastActivityAt, now),
    phase: query.session.phase,
  };
}