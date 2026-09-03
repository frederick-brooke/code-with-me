"use server";

import { redirect } from "next/navigation";
import { getCachedCurrentCandidate } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { launchSession } from "@/lib/engine/launch";
import { SessionEngine, type SessionRunInput } from "@/lib/engine/session-engine";

const MAX_RECORDABLE_COUNTS = 1000;

type SaveOutcome = { ok: true } | { ok: false; error: "unauthorized" };

/**
 * Resolves the Candidate's own Session into a SessionEngine, or null when the
 * Candidate is not signed in or does not own the Session.
 */
async function engineForOwnedSession(sessionId: string): Promise<SessionEngine | null> {
  const candidate = await getCachedCurrentCandidate();
  if (!candidate) {
    return null;
  }
  const engine = new SessionEngine(await getDataStore());
  const view = await engine.getSession(sessionId);
  if (!view || view.session.candidateId !== candidate.id) {
    return null;
  }
  return engine;
}

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

export type RecordRunActionResult = SaveOutcome;

/**
 * Persists a completed Run (code snapshot + visible counts) on the Candidate's
 * own Session through the SessionEngine.
 */
export async function recordRunAction(
  sessionId: string,
  run: SessionRunInput,
): Promise<RecordRunActionResult> {
  const engine = await engineForOwnedSession(sessionId);
  if (!engine) {
    return { ok: false, error: "unauthorized" };
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

export type SaveWorkingCodeActionResult = SaveOutcome;

/**
 * Persists the Candidate's Working Code as a debounced snapshot on their own
 * Session, so the Assessor reads where they actually are between Runs.
 */
export async function saveWorkingCodeAction(
  sessionId: string,
  code: string,
): Promise<SaveWorkingCodeActionResult> {
  const engine = await engineForOwnedSession(sessionId);
  if (!engine) {
    return { ok: false, error: "unauthorized" };
  }

  await engine.saveWorkingCode(sessionId, code);
  return { ok: true };
}