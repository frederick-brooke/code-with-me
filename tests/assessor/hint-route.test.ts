import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as getHint } from "@/app/api/assessor/hint/[sessionId]/route";
import { getDataStore } from "@/lib/data";
import { InMemoryDataStore } from "@/lib/data/store";
import { SessionEngine } from "@/lib/engine/session-engine";

const originalEnv = { ...process.env };

function makeRequest(
  secret: string | null,
  body: { question?: string } = { question: "Can you just show me the answer?" },
  url = "http://localhost/api/assessor/hint/session-1",
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
});

describe("POST /api/assessor/hint/[sessionId]", () => {
  it("rejects a request without the shared tool secret", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const response = await getHint(makeRequest(null), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("rejects a request with a wrong shared tool secret", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const response = await getHint(makeRequest("nope"), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("rejects a request without a question", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const response = await getHint(makeRequest("secret-123", { question: "   " }), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "question-required" });
  });

  it("returns hint-tiered guidance and records the hint on the Session", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const response = await getHint(makeRequest("secret-123"), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      data: { sessionId: string; hintsGiven: number; tier: number; guidance: string };
    };
    expect(body.data.sessionId).toBe("session-1");
    expect(body.data.hintsGiven).toBe(1);
    expect(body.data.tier).toBe(1);
    expect(body.data.guidance.length).toBeGreaterThan(0);

    const store = await getDataStore();
    expect((await store.findSessionById("session-1"))?.hintsGiven).toBe(1);
  });

  it("escalates tiers across successive tool calls", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const params = { params: Promise.resolve({ sessionId: "session-1" }) };
    const call = () => getHint(makeRequest("secret-123"), params);

    const first = await call();
    await call();
    const third = await call();

    const body = async (r: Response) => ((await r.json()) as { data: { tier: number } }).data.tier;
    expect(await body(first)).toBe(1);
    expect(await body(third)).toBe(3);

    const hints = await (await getDataStore()).findSessionById("session-1");
    expect(hints?.hintsGiven).toBe(3);
  });

  it("never returns hidden-test internals in the payload", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const response = await getHint(makeRequest("secret-123"), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    const serialized = JSON.stringify(await response.json());
    expect(serialized).not.toContain("hiddenTests");
    expect(serialized).not.toContain("[1, 5, 3]");
  });

  it("returns 404 for an unknown Session", async () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    const response = await getHint(
      makeRequest("secret-123", { question: "help?" }, "http://localhost/api/assessor/hint/missing"),
      { params: Promise.resolve({ sessionId: "missing" }) },
    );
    expect(response.status).toBe(404);
  });
});