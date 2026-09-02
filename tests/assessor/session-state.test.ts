import { describe, expect, it } from "vitest";
import { getSessionStateForTool } from "@/lib/assessor/session-state";
import { SessionEngine } from "@/lib/engine/session-engine";
import { makeSeededStore } from "@/tests/helpers/seeded-store";

const HIDDEN_TESTS = [
  { input: "[1, 5, 3], 4", expectedOutput: "[0, 2]" },
  { input: "[-3, 4, 3, 90], 0", expectedOutput: "[0, 2]" },
];

async function startSeededSession() {
  const store = makeSeededStore();
  const engine = new SessionEngine(store);
  await engine.start("session-1", "candidate-1", "two-sum");
  return engine;
}

describe("session-state tool", () => {
  it("returns the starter template and zero counts before any Run", async () => {
    const engine = await startSeededSession();
    const state = await getSessionStateForTool(engine, "session-1");

    expect(state.currentCode).toBe("def two_sum(nums, target):\n    pass\n");
    expect(state.passedCount).toBe(0);
    expect(state.failedCount).toBe(0);
  });

  it("returns the latest Run's code and visible counts", async () => {
    const engine = await startSeededSession();
    await engine.recordRun("session-1", { code: "old", passedCount: 1, failedCount: 2 });
    await engine.recordRun("session-1", { code: "current", passedCount: 3, failedCount: 1 });

    const state = await getSessionStateForTool(engine, "session-1");
    expect(state.currentCode).toBe("current");
    expect(state.passedCount).toBe(3);
    expect(state.failedCount).toBe(1);
  });

  it("never leaks hidden-test inputs or expected outputs", async () => {
    const engine = await startSeededSession();
    await engine.recordRun("session-1", { code: "def two_sum(nums, target):\n    return []\n", passedCount: 2, failedCount: 2 });

    const state = await getSessionStateForTool(engine, "session-1");
    const serialized = JSON.stringify(state);

    for (const test of HIDDEN_TESTS) {
      expect(serialized).not.toContain(test.input);
      expect(serialized).not.toContain(test.expectedOutput);
    }
    expect(serialized).not.toContain("hiddenTests");
    expect(serialized).not.toContain("sampleTests");
  });

  it("throws for an unknown Session", async () => {
    const engine = await startSeededSession();
    await expect(getSessionStateForTool(engine, "missing")).rejects.toThrow(
      /Unknown session: missing/,
    );
  });
});