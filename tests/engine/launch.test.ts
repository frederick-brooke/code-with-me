import { describe, expect, it } from "vitest";
import { launchSession } from "@/lib/engine/launch";
import { makeSeededStore } from "@/tests/helpers/seeded-store";
import type { DataStore } from "@/lib/data/types";

function makeStore(): DataStore {
  return makeSeededStore();
}

describe("launchSession", () => {
  it("starts a Session on the chosen Problem in the Introduction phase", async () => {
    const store = makeStore();
    const session = await launchSession(store, {
      candidateId: "candidate-1",
      problemId: "two-sum",
    });

    expect(session.candidateId).toBe("candidate-1");
    expect(session.problemId).toBe("two-sum");
    expect(session.phase).toBe("introduction");
    expect(session.endedAt).toBeNull();
  });

  it("persists the launched Session so it appears in the Candidate's session list", async () => {
    const store = makeStore();
    const session = await launchSession(store, {
      candidateId: "candidate-1",
      problemId: "valid-parentheses",
    });

    const sessions = await store.listSessionsByCandidate("candidate-1");
    expect(sessions.map((s) => s.id)).toEqual([session.id]);
    expect(sessions[0].problemId).toBe("valid-parentheses");
  });

  it("rejects launching on an unknown Problem", async () => {
    const store = makeStore();
    await expect(
      launchSession(store, { candidateId: "candidate-1", problemId: "missing" }),
    ).rejects.toThrow(/Unknown problem: missing/);
  });
});