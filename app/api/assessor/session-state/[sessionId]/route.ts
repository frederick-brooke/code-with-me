import { authorizeAssessorToolRequest } from "@/lib/assessor/config";
import { getSessionStateForTool } from "@/lib/assessor/session-state";
import { getDataStore } from "@/lib/data";
import { SessionEngine } from "@/lib/engine/session-engine";

export const runtime = "nodejs";

/**
 * The get_session_state webhook tool the managed Assessor calls for live
 * volatile Session state (current code + visible Run counts). Only a bearer of
 * the configured shared secret may invoke it, and its response never includes
 * the Problem's hidden-test inputs or expected outputs.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  if (!authorizeAssessorToolRequest(request.headers.get("x-assessor-tool-secret"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  const engine = new SessionEngine(await getDataStore());

  try {
    const state = await getSessionStateForTool(engine, sessionId);
    return Response.json({ data: state });
  } catch {
    return Response.json({ error: "not-found" }, { status: 404 });
  }
}