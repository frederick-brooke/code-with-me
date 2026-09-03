import { getCachedCurrentCandidate } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { SessionEngine } from "@/lib/engine/session-engine";

export const runtime = "nodejs";

/**
 * The live phase read the Candidate's browser polls. The phase trail above the
 * Problem title is server-rendered once, so this endpoint keeps it current as
 * the Assessor advances the Session through the arc via the set_phase tool.
 * Ownership mirrors the interview page guard: an unsigned Candidate is refused,
 * and a Session the Candidate does not own (or that does not exist) reads as
 * not-found so session existence is never leaked.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const candidate = await getCachedCurrentCandidate();
  if (!candidate) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  const engine = new SessionEngine(await getDataStore());
  const view = await engine.getSession(sessionId);
  if (!view || view.session.candidateId !== candidate.id) {
    return Response.json({ error: "not-found" }, { status: 404 });
  }

  return Response.json({ data: { sessionId, phase: view.session.phase } });
}