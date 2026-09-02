import { getCachedCurrentCandidate } from "@/lib/auth/session";
import { getAssessorCredentials } from "@/lib/assessor/config";
import { buildAssessorContext } from "@/lib/assessor/context";
import { requestAssessorSignedUrl } from "@/lib/assessor/elevenlabs";
import { getDataStore } from "@/lib/data";
import { SessionEngine } from "@/lib/engine/session-engine";

export const runtime = "nodejs";

/**
 * Hands the Candidate their own Session's Assessor conversation: a short-lived
 * signed URL plus the static context (Problem statement + starter template) the
 * agent should be given. Requires the candidate to be signed in and to own the
 * Session, so a candidate can never open someone else's conversation.
 */
export async function GET(request: Request) {
  const candidate = await getCachedCurrentCandidate();
  if (!candidate) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const credentials = getAssessorCredentials();
  if (!credentials) {
    return Response.json(
      { error: "The Assessor is not configured on this deployment." },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) {
    return Response.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const engine = new SessionEngine(await getDataStore());
  const view = await engine.getSession(sessionId);
  if (!view || view.session.candidateId !== candidate.id) {
    return Response.json({ error: "not-found" }, { status: 404 });
  }
  if (!view.problem) {
    return Response.json({ error: "Session has no Problem" }, { status: 500 });
  }

  let signedUrl: string;
  try {
    signedUrl = await requestAssessorSignedUrl(credentials);
  } catch (error) {
    console.error("Failed to start Assessor conversation", error);
    return Response.json(
      { error: "Could not start the Assessor conversation." },
      { status: 502 },
    );
  }

  return Response.json({
    signedUrl,
    dynamicVariables: buildAssessorContext(view.problem, sessionId),
  });
}