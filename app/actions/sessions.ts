"use server";

import { redirect } from "next/navigation";
import { getCachedCurrentCandidate } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { launchSession } from "@/lib/engine/launch";
import { SessionEngine, type SessionRunInput } from "@/lib/engine/session-engine";

const MAX_RECORDABLE_COUNTS = 1000;

export async function launchSessionAction(formData: FormData): Promise<void> {
  const candidate = await getCachedCurrentCandidate();
  if (!candidate) {
    redirect("/sign-in");
  }

  const problemId = String(formData.get("problemId") ?? "");
  const session = await launchSession(await getDataStore(), {
    candidateId: candidate.id,
    problemId,
  });
  redirect(`/interview/${session.id}`);
}

export type RecordRunActionResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "unknown-session" };

/**
 * Persists a completed Run (code snapshot + visible counts) on the Candidate's
 * own Session through the SessionEngine.
 */
export async function recordRunAction(
  sessionId: string,
  run: SessionRunInput,
): Promise<RecordRunActionResult> {
  const candidate = await getCachedCurrentCandidate();
  if (!candidate) {
    return { ok: false, error: "unauthorized" };
  }

  const engine = new SessionEngine(await getDataStore());
  const view = await engine.getSession(sessionId);
  if (!view || view.session.candidateId !== candidate.id) {
    return { ok: false, error: "unknown-session" };
  }

  const clamp = (value: number) =>
    Math.max(0, Math.min(MAX_RECORDABLE_COUNTS, Math.floor(Number(value) || 0)));

  await engine.recordRun(sessionId, {
    code: run.code,
    passedCount: clamp(run.passedCount),
    failedCount: clamp(run.failedCount),
  });
  return { ok: true };
}