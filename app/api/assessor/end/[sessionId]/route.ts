import { authorizeAssessorToolRequest } from "@/lib/assessor/config";
import { getDataStore } from "@/lib/data";
import { SessionEngine, SessionEngineError } from "@/lib/engine/session-engine";
import { debriefSession } from "@/lib/summary/debrief";

export const runtime = "nodejs";

/**
 * The end_session webhook tool the managed Assessor calls when the interview
 * is over: a passing Run followed by the closing questions is the natural
 * cue to close (ADR-0006). Only a bearer of the configured shared secret may
 * invoke it. Ending records the end time and lands the Session in the terminal
 * Debrief phase; an unknown Session reads as not-found. Ending then triggers
 * the Performance Summary generation (ADR-0007), which is failure-soft: it never
 * blocks or undoes the end.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  if (!authorizeAssessorToolRequest(request.headers.get("x-assessor-tool-secret"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  const store = await getDataStore();
  const engine = new SessionEngine(store);

  try {
    const session = await engine.end(sessionId);
    await debriefSession(store, sessionId);
    return Response.json({ data: { sessionId, phase: session.phase } });
  } catch (error) {
    if (error instanceof SessionEngineError && error.code === "unknown-session") {
      return Response.json({ error: "not-found" }, { status: 404 });
    }
    throw error;
  }
}