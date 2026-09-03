import { describe, expect, it } from "vitest";
import { getHintForTool, hintTierIndex } from "@/lib/assessor/hint-guard";
import { SessionEngine } from "@/lib/engine/session-engine";
import { makeSeededStore } from "@/tests/helpers/seeded-store";

const HIDDEN_TESTS = [
  { input: "[1, 5, 3], 4", expectedOutput: "[0, 2]" },
  { input: "[-3, 4, 3, 90], 0", expectedOutput: "[0, 2]" },
];

describe("hintTierIndex", () => {
  it("escalates one tier per hint request, starting at the first", () => {
    expect(hintTierIndex(1, 3)).toBe(0);
    expect(hintTierIndex(2, 3)).toBe(1);
    expect(hintTierIndex(3, 3)).toBe(2);
  });

  it("holds the most concrete tier once the authored tiers run out", () => {
    expect(hintTierIndex(4, 3)).toBe(2);
    expect(hintTierIndex(10, 3)).toBe(2);
  });

  it("returns no tier for a Problem with none authored", () => {
    expect(hintTierIndex(1, 0)).toBe(-1);
  });
});

describe("get_hint guard", () => {
  it("serves increasing hint tiers across successive requests", async () => {
    const store = makeSeededStore();
    const engine = new SessionEngine(store);
    await engine.start("session-1", "candidate-1", "two-sum");

    const first = await getHintForTool(engine, "session-1");
    expect(first.tier).toBe(1);
    expect(first.hintsGiven).toBe(1);
    expect(first.guidance).toContain("two values at different positions");

    const second = await getHintForTool(engine, "session-1");
    expect(second.tier).toBe(2);
    expect(second.hintsGiven).toBe(2);
    expect(second.guidance).toContain("target - nums[i]");

    const third = await getHintForTool(engine, "session-1");
    expect(third.tier).toBe(3);
    expect(third.hintsGiven).toBe(3);
    expect(third.guidance).toContain("hash map");
  });

  it("caps at the most concrete authored tier, holding the line beyond it", async () => {
    const store = makeSeededStore();
    const engine = new SessionEngine(store);
    await engine.start("session-1", "candidate-1", "two-sum");

    let last: Awaited<ReturnType<typeof getHintForTool>> | undefined;
    for (let i = 0; i < 6; i += 1) {
      last = await getHintForTool(engine, "session-1");
    }

    expect(last?.hintsGiven).toBe(6);
    expect(last?.tier).toBe(3);
    expect(last?.guidance).toContain("hash map");
    expect(last?.guidance).toBe(
      (await makeSeededStore().findProblemById("two-sum"))?.hintTiers[2],
    );
  });

  it("persists the counter so tiers survive a fresh engine read", async () => {
    const store = makeSeededStore();
    await new SessionEngine(store).start("session-1", "candidate-1", "two-sum");

    await getHintForTool(new SessionEngine(store), "session-1");
    const hintsGiven = (await store.findSessionById("session-1"))?.hintsGiven;
    expect(hintsGiven).toBe(1);
  });

  it("returns safe fallback guidance when the Problem has no authored tiers", async () => {
    const store = makeSeededStore();
    const engine = new SessionEngine(store);
    await engine.start("session-1", "candidate-1", "two-sum");
    const problem = (await store.findProblemById("two-sum"))!;
    await store.createProblem({ ...problem, hintTiers: [] });

    const response = await getHintForTool(engine, "session-1");
    expect(response.tier).toBe(1);
    expect(response.guidance.length).toBeGreaterThan(0);
    expect(response.guidance).not.toMatch(/\bdef\b/);
  });

  it("never leaks hidden-test inputs, expected outputs, or test internals", async () => {
    const store = makeSeededStore();
    const engine = new SessionEngine(store);
    await engine.start("session-1", "candidate-1", "two-sum");

    const response = await getHintForTool(engine, "session-1");
    const serialized = JSON.stringify(response);

    for (const test of HIDDEN_TESTS) {
      expect(serialized).not.toContain(test.input);
      expect(serialized).not.toContain(test.expectedOutput);
    }
    expect(serialized).not.toContain("hiddenTests");
    expect(serialized).not.toContain("sampleTests");
    expect(serialized).not.toContain("def two_sum(nums, target)");
  });

  it("throws for an unknown Session", async () => {
    const engine = new SessionEngine(makeSeededStore());
    await expect(getHintForTool(engine, "missing")).rejects.toThrow(/Unknown session: missing/);
  });
});