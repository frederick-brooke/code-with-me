import { randomUUID } from "node:crypto";
import { generatePerformanceSummary } from "@/lib/summary/client";
import { getSummaryConfig, type SummaryConfig } from "@/lib/summary/config";
import { SessionEngine } from "@/lib/engine/session-engine";
import type { DataStore, PerformanceSummary } from "@/lib/data/types";

export interface DebriefOutcome {
  summary: PerformanceSummary | null;
}

/**
 * Produces and persists the Performance Summary for an ended Session (ADR-0007).
 *
 * The generator is a *client* of the SessionEngine seam, not part of the engine:
 * the engine stays LLM-free and the routes stay thin. It is a no-op unless the
 * Session is already in the terminal Debrief phase (moving into Debrief records
 * the end), it is idempotent (an existing summary is returned untouched), and it
 * is failure-soft — an LLM failure or an unconfigured key logs/skips and never
 * undoes the end, because ending the interview must never depend on the summary
 * call succeeding.
 */
export async function debriefSession(
  store: DataStore,
  sessionId: string,
  options: { config?: SummaryConfig | null; fetchImpl?: typeof fetch } = {},
): Promise<DebriefOutcome> {
  const session = await store.findSessionById(sessionId);
  if (!session || session.phase !== "debrief") {
    return { summary: null };
  }

  const existing = await store.findPerformanceSummaryBySession(sessionId);
  if (existing) {
    return { summary: existing };
  }

  const config = options.config === undefined ? getSummaryConfig() : options.config;
  if (!config) {
    return { summary: null };
  }

  const engine = new SessionEngine(store);
  const record = await engine.getSessionRecord(sessionId);
  if (!record) {
    return { summary: null };
  }

  try {
    const content = await generatePerformanceSummary(record, config, options.fetchImpl);
    const summary: PerformanceSummary = {
      id: randomUUID(),
      sessionId,
      content,
      createdAt: new Date(),
    };
    return { summary: await store.createPerformanceSummary(summary) };
  } catch (error) {
    console.error(`Failed to generate Performance Summary for session ${sessionId}`, error);
    return { summary: null };
  }
}