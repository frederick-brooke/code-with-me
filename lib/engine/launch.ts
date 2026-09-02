import { randomUUID } from "node:crypto";
import { SessionEngine } from "@/lib/engine/session-engine";
import type { DataStore, Session } from "@/lib/data/types";

/** Starts a Session for the Candidate on the chosen seeded Problem. */
export async function launchSession(
  store: DataStore,
  input: { candidateId: string; problemId: string },
): Promise<Session> {
  const engine = new SessionEngine(store);
  return engine.start(randomUUID(), input.candidateId, input.problemId);
}