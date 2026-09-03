import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as endSession } from "@/app/api/assessor/end/[sessionId]/route";
import { getDataStore } from "@/lib/data";
import { InMemoryDataStore } from "@/lib/data/store";
import { SessionEngine } from "@/lib/engine/session-engine";

const originalEnv = { ...process.env };

function makeRequest(secret: string | null, url = "http://localhost/api/assessor/end/session-1") {
  const headers = new Headers();
  if (secret !== null) {
    headers.set("x-assessor-tool-secret", secret);
  }
  return new Request(url, { method: "POST", headers });
}

beforeEach(async () => {
  const store = await getDataStore();
  if (store instanceof InMemoryDataStore) {
    store.reset();
  }
  await new SessionEngine(store).start("session-1", "candidate-1", "two-sum");
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllEnvs();
});

describe("POST /api/assessor/end/[sessionId]", () => {
  it("rejects a request without the shared tool secret", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const response = await endSession(makeRequest(null), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("rejects a request with a wrong shared tool secret", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const response = await endSession(makeRequest("nope"), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("ends a live Session, landing it in Debrief and recording the end time", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const store = await getDataStore();
    await new SessionEngine(store).setPhase("session-1", "approach");

    const response = await endSession(makeRequest("secret-123"), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(200);

    const body = (await response.json()) as { data: { sessionId: string; phase: string } };
    expect(body.data).toEqual({ sessionId: "session-1", phase: "debrief" });

    const persisted = await new SessionEngine(store).getSession("session-1");
    expect(persisted?.session.phase).toBe("debrief");
    expect(persisted?.session.endedAt).toBeInstanceOf(Date);
  });

  it("ends a Session from the first phase into Debrief", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const response = await endSession(makeRequest("secret-123"), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(200);

    const store = await getDataStore();
    const persisted = await new SessionEngine(store).getSession("session-1");
    expect(persisted?.session.phase).toBe("debrief");
    expect(persisted?.session.endedAt).not.toBeNull();
  });

  it("returns 404 for an unknown Session", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const response = await endSession(makeRequest("secret-123", "http://localhost/api/assessor/end/missing"), {
      params: Promise.resolve({ sessionId: "missing" }),
    });
    expect(response.status).toBe(404);
  });

  it("generates and persists a Performance Summary when the summary LLM is configured", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    vi.stubEnv("SUMMARY_LLM_API_KEY", "key-123");
    vi.stubEnv("SUMMARY_LLM_MODEL", "model-9");
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "## What went well\nStrong finish." } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchImpl);

    const response = await endSession(makeRequest("secret-123"), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(200);

    const store = await getDataStore();
    const persisted = await store.findPerformanceSummaryBySession("session-1");
    expect(persisted?.content).toContain("What went well");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("still ends the Session cleanly when summary generation fails", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    vi.stubEnv("SUMMARY_LLM_API_KEY", "key-123");
    const fetchImpl = vi.fn().mockResolvedValue(new Response("boom", { status: 500 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchImpl);

    const response = await endSession(makeRequest("secret-123"), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(200);

    const store = await getDataStore();
    expect(await store.findPerformanceSummaryBySession("session-1")).toBeNull();
    expect((await store.findSessionById("session-1"))?.phase).toBe("debrief");
  });
});