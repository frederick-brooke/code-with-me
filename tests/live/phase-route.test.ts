import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getPhase } from "@/app/api/sessions/[sessionId]/phase/route";
import { getCachedCurrentCandidate } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { InMemoryDataStore } from "@/lib/data/store";
import { SessionEngine } from "@/lib/engine/session-engine";
import type { Candidate } from "@/lib/auth/types";

vi.mock("@/lib/auth/session", () => ({
  getCachedCurrentCandidate: vi.fn(),
}));

const candidate: Candidate = {
  id: "candidate-1",
  email: "candidate-1@example.com",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

function makeRequest(url = "http://localhost/api/sessions/session-1/phase") {
  return new Request(url);
}

beforeEach(async () => {
  const store = await getDataStore();
  if (store instanceof InMemoryDataStore) {
    store.reset();
  }
  await new SessionEngine(store).start("session-1", candidate.id, "two-sum");
  vi.mocked(getCachedCurrentCandidate).mockResolvedValue(candidate);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/sessions/[sessionId]/phase", () => {
  it("rejects a request when the Candidate is not signed in", async () => {
    vi.mocked(getCachedCurrentCandidate).mockResolvedValue(null);
    const response = await getPhase(makeRequest(), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("returns the live phase to the Candidate who owns the Session", async () => {
    const response = await getPhase(makeRequest(), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { sessionId: string; phase: string } };
    expect(body.data).toEqual({ sessionId: "session-1", phase: "introduction" });
  });

  it("reflects a backend phase change on the next read", async () => {
    const store = await getDataStore();
    await new SessionEngine(store).setPhase("session-1", "approach");

    const response = await getPhase(makeRequest(), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    const body = (await response.json()) as { data: { phase: string } };
    expect(body.data.phase).toBe("approach");
  });

  it("returns 404 for a Session the Candidate does not own", async () => {
    await new SessionEngine(await getDataStore()).start(
      "session-other",
      "candidate-2",
      "two-sum",
    );
    const response = await getPhase(makeRequest(), {
      params: Promise.resolve({ sessionId: "session-other" }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not-found" });
  });

  it("returns 404 for an unknown Session", async () => {
    const response = await getPhase(makeRequest(), {
      params: Promise.resolve({ sessionId: "missing" }),
    });
    expect(response.status).toBe(404);
  });
});