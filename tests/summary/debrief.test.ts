import { describe, expect, it, vi } from "vitest";
import { debriefSession } from "@/lib/summary/debrief";
import { makeSeededStore } from "@/tests/helpers/seeded-store";
import { SessionEngine } from "@/lib/engine/session-engine";
import type { SummaryConfig } from "@/lib/summary/config";
import type { DataStore } from "@/lib/data/types";

const config: SummaryConfig = {
  baseUrl: "https://llm.example.com/v1",
  apiKey: "key-123",
  model: "model-9",
};

function okFetch(): typeof fetch {
  const fetchImpl = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "## What went well\nSolid approach." } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
  return fetchImpl as unknown as typeof fetch;
}

function failingFetch(): typeof fetch {
  const fetchImpl = vi.fn().mockResolvedValue(new Response("boom", { status: 500 }));
  return fetchImpl as unknown as typeof fetch;
}

async function startEndedSession(store: DataStore): Promise<string> {
  const engine = new SessionEngine(store);
  await engine.start("session-1", "candidate-1", "two-sum");
  await engine.recordRun("session-1", { code: "def two_sum(nums, target):\n    return []", passedCount: 1, failedCount: 3 });
  await engine.recordMessage("session-1", { speaker: "candidate", text: "Is the hash map the way?" });
  await engine.end("session-1");
  return "session-1";
}

describe("debriefSession", () => {
  it("ends the Session and persists a Performance Summary when configured", async () => {
    const store = makeSeededStore();
    const sessionId = await startEndedSession(store);

    const { summary } = await debriefSession(store, sessionId, {
      config,
      fetchImpl: okFetch(),
    });

    expect(summary?.content).toContain("What went well");
    expect(summary?.sessionId).toBe(sessionId);

    const persisted = await store.findPerformanceSummaryBySession(sessionId);
    expect(persisted?.content).toBe(summary?.content);

    const ended = await store.findSessionById(sessionId);
    expect(ended?.phase).toBe("debrief");
    expect(ended?.endedAt).toBeInstanceOf(Date);
  });

  it("is idempotent: an existing summary is returned and the LLM is not called again", async () => {
    const store = makeSeededStore();
    const sessionId = await startEndedSession(store);
    await store.createPerformanceSummary({
      id: "existing",
      sessionId,
      content: "Already written.",
      createdAt: new Date(),
    });
    const fetchImpl = okFetch();

    const { summary } = await debriefSession(store, sessionId, { config, fetchImpl });

    expect(summary?.content).toBe("Already written.");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("leaves the Session ended with no summary when the LLM call fails, without throwing", async () => {
    const store = makeSeededStore();
    const sessionId = await startEndedSession(store);

    const { summary } = await debriefSession(store, sessionId, {
      config,
      fetchImpl: failingFetch(),
    });

    expect(summary).toBeNull();
    expect(await store.findPerformanceSummaryBySession(sessionId)).toBeNull();
    const ended = await store.findSessionById(sessionId);
    expect(ended?.phase).toBe("debrief");
    expect(ended?.endedAt).toBeInstanceOf(Date);
  });

  it("skips generation entirely when the summary LLM is not configured", async () => {
    const store = makeSeededStore();
    const sessionId = await startEndedSession(store);
    const fetchImpl = okFetch();

    const { summary } = await debriefSession(store, sessionId, { fetchImpl });

    expect(summary).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await store.findPerformanceSummaryBySession(sessionId)).toBeNull();
  });

  it("does not generate a summary while the Session is still live", async () => {
    const store = makeSeededStore();
    const engine = new SessionEngine(store);
    await engine.start("session-1", "candidate-1", "two-sum");
    await engine.setPhase("session-1", "approach");
    const fetchImpl = okFetch();

    const { summary } = await debriefSession(store, "session-1", { config, fetchImpl });

    expect(summary).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await store.findSessionById("session-1"))?.phase).toBe("approach");
  });

  it("returns no summary for an unknown Session", async () => {
    const store = makeSeededStore();
    const { summary } = await debriefSession(store, "missing", { config, fetchImpl: okFetch() });
    expect(summary).toBeNull();
  });

  it("returns a summary a concurrent trigger persisted mid-generation instead of overwriting it", async () => {
    const store = makeSeededStore();
    const sessionId = await startEndedSession(store);
    const racingFetch = (async () => {
      await store.createPerformanceSummary({
        id: "racer",
        sessionId,
        content: "From the racer.",
        createdAt: new Date(),
      });
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "From me." } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const { summary } = await debriefSession(store, sessionId, { config, fetchImpl: racingFetch });

    expect(summary?.content).toBe("From the racer.");
    expect((await store.findPerformanceSummaryBySession(sessionId))?.id).toBe("racer");
  });

  it("never throws even when a store read fails", async () => {
    const store = makeSeededStore();
    const sessionId = await startEndedSession(store);
    const failingStore = new Proxy(store, {
      get(target, prop, receiver) {
        if (prop === "findSessionById") {
          return () => Promise.reject(new Error("db down"));
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as DataStore;
    const fetchImpl = okFetch();

    const { summary } = await debriefSession(failingStore, sessionId, { config, fetchImpl });

    expect(summary).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});