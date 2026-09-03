import { authorizeAssessorToolRequest } from "@/lib/assessor/config";
import { getHintForTool } from "@/lib/assessor/hint-guard";
import { getDataStore } from "@/lib/data";
import { SessionEngine, SessionEngineError } from "@/lib/engine/session-engine";

export const runtime = "nodejs";

/**
 * The get_hint webhook tool (ADR-0001's structural guard): the managed Assessor
 * routes Candidate requests that smell like "give me the answer" here, and the
 * backend serves tiered approach/structure guidance — never a full solution.
 * Only a bearer of the configured shared secret may invoke it. Each call bumps
 * the Session's hint counter so tiers escalate; an unknown Session reads as
 * not-found and a missing question is rejected.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  if (!authorizeAssessorToolRequest(request.headers.get("x-assessor-tool-secret"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  let question: unknown;
  try {
    question = ((await request.json()) as { question?: unknown }).question;
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  if (typeof question !== "string" || question.trim() === "") {
    return Response.json({ error: "question-required" }, { status: 400 });
  }

  const engine = new SessionEngine(await getDataStore());
  try {
    const hint = await getHintForTool(engine, sessionId);
    return Response.json({ data: hint });
  } catch (error) {
    if (error instanceof SessionEngineError && error.code === "unknown-session") {
      return Response.json({ error: "not-found" }, { status: 404 });
    }
    throw error;
  }
}