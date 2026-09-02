import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getSessionState } from "@/app/api/assessor/session-state/[sessionId]/route";
import { getDataStore } from "@/lib/data";
import { SessionEngine } from "@/lib/engine/session-engine";

const originalEnv = { ...process.env };

function makeRequest(secret: string | null, url = "http://localhost/api/assessor/session-state/session-1") {
  const headers = new Headers();
  if (secret !== null) {
    headers.set("x-assessor-tool-secret", secret);
  }
  return new Request(url, { headers });
}

beforeEach(async () => {
  const store = await getDataStore();
  const engine = new SessionEngine(store);
  await engine.start("session-1", "candidate-1", "two-sum");
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllEnvs();
});

describe("GET /api/assessor/session-state/[sessionId]", () => {
  it("rejects a request without the shared tool secret", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const response = await getSessionState(makeRequest(null), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("rejects a request with a wrong shared tool secret", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const response = await getSessionState(makeRequest("nope"), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns the live Session state to an authorized caller", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const store = await getDataStore();
    await new SessionEngine(store).recordRun("session-1", {
      code: "def two_sum(nums, target):\n    return []",
      passedCount: 2,
      failedCount: 2,
    });

    const response = await getSessionState(makeRequest("secret-123"), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      data: { currentCode: string; passedCount: number; failedCount: number };
    };
    expect(body.data.currentCode).toBe("def two_sum(nums, target):\n    return []");
    expect(body.data.passedCount).toBe(2);
    expect(body.data.failedCount).toBe(2);
  });

  it("returns 404 for an unknown Session", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const response = await getSessionState(makeRequest("secret-123"), {
      params: Promise.resolve({ sessionId: "missing" }),
    });
    expect(response.status).toBe(404);
  });

  it("never leaks hidden-test inputs or expected outputs in the response", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const store = await getDataStore();
    const problem = (await new SessionEngine(store).getSession("session-1"))?.problem;
    await new SessionEngine(store).recordRun("session-1", {
      code: "def two_sum(nums, target):\n    return []",
      passedCount: 1,
      failedCount: 3,
    });

    const response = await getSessionState(makeRequest("secret-123"), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    const text = await response.text();

    if (problem?.hiddenTests) {
      for (const test of problem.hiddenTests) {
        expect(text).not.toContain(test.input);
        expect(text).not.toContain(test.expectedOutput);
      }
    }
    expect(text).not.toContain("hiddenTests");
  });
});