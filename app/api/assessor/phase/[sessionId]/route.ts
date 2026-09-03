import { authorizeAssessorToolRequest } from "@/lib/assessor/config";
import { getDataStore } from "@/lib/data";
import { PHASE_ORDER, SessionEngine, SessionEngineError } from "@/lib/engine/session-engine";

export const runtime = "nodejs";

function unknownPhaseBody(message: string): { error: string; valid_phases: string[] } {
  return { error: message, valid_phases: [...PHASE_ORDER] };
}

/**
 * The set_phase webhook tool the managed Assessor calls to move the live
 * Session through the five-phase arc mid-turn (when clarifying is done, when
 * the Candidate has talked through their approach, when a Run passes). Only a
 * bearer of the configured shared secret may invoke it. The engine stays the
 * source of truth for phase state: an unknown or backward label is rejected
 * with the valid phases so the Assessor can recover, and the Session is left
 * exactly as it was — never corrupted.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  if (!authorizeAssessorToolRequest(request.headers.get("x-assessor-tool-secret"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  let phase: unknown;
  try {
    phase = ((await request.json()) as { phase?: unknown }).phase;
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  if (typeof phase !== "string" || phase.trim() === "") {
    return Response.json(
      unknownPhaseBody("A phase is required; a session must never be left without one."),
      { status: 400 },
    );
  }

  const engine = new SessionEngine(await getDataStore());
  try {
    const session = await engine.setPhase(sessionId, phase.trim());
    return Response.json({ data: { sessionId, phase: session.phase } });
  } catch (error) {
    if (error instanceof SessionEngineError) {
      if (error.code === "unknown-session") {
        return Response.json({ error: "not-found" }, { status: 404 });
      }
      return Response.json(unknownPhaseBody(error.message), { status: 400 });
    }
    return Response.json({ error: "not-found" }, { status: 404 });
  }
}