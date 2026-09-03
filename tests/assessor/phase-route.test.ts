import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as setPhase } from "@/app/api/assessor/phase/[sessionId]/route";
import { getDataStore } from "@/lib/data";
import { InMemoryDataStore } from "@/lib/data/store";
import { SessionEngine } from "@/lib/engine/session-engine";

const originalEnv = { ...process.env };

function makeRequest(
  secret: string | null,
  body: { phase: string },
  url = "http://localhost/api/assessor/phase/session-1",
) {
  const headers = new Headers();
  if (secret !== null) {
    headers.set("x-assessor-tool-secret", secret);
  }
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) });
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
  vi.unstubAllGlobals();
});

describe("POST /api/assessor/phase/[sessionId]", () => {
  it("rejects a request without the shared tool secret", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const response = await setPhase(makeRequest(null, { phase: "approach" }), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("advances the Session through the arc for an authorized caller", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const response = await setPhase(makeRequest("secret-123", { phase: "approach" }), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { phase: string } };
    expect(body.data.phase).toBe("approach");
  });

  it("generates a Performance Summary when moving the Session into Debrief", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    vi.stubEnv("SUMMARY_LLM_API_KEY", "key-123");
    vi.stubEnv("SUMMARY_LLM_MODEL", "model-9");
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "## What went well\nNice close." } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchImpl);

    const store = await getDataStore();
    await new SessionEngine(store).setPhase("session-1", "wrap-up");

    const response = await setPhase(makeRequest("secret-123", { phase: "debrief" }), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(200);

    const persisted = await store.findPerformanceSummaryBySession("session-1");
    expect(persisted?.content).toContain("What went well");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("does not generate a summary for a mid-arc phase", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    vi.stubEnv("SUMMARY_LLM_API_KEY", "key-123");
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchImpl);

    const response = await setPhase(makeRequest("secret-123", { phase: "implementation" }), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(200);

    const store = await getDataStore();
    expect(await store.findPerformanceSummaryBySession("session-1")).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown Session", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const response = await setPhase(
      makeRequest("secret-123", { phase: "approach" }, "http://localhost/api/assessor/phase/missing"),
      { params: Promise.resolve({ sessionId: "missing" }) },
    );
    expect(response.status).toBe(404);
  });
});