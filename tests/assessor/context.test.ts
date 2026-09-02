import { describe, expect, it } from "vitest";
import { buildAssessorContext } from "@/lib/assessor/context";
import type { Problem } from "@/lib/data/types";

const twoSum: Problem = {
  id: "two-sum",
  title: "Two Sum",
  difficulty: "easy",
  statement: "Return the indices of the two numbers that add up to target.",
  starterTemplate: "def two_sum(nums, target):\n    pass\n",
  sampleTests: [{ input: "[2, 7, 11, 15], 9", expectedOutput: "[0, 1]" }],
  hiddenTests: [
    { input: "[1, 5, 3], 4", expectedOutput: "[0, 2]" },
    { input: "[3, 3], 6", expectedOutput: "[0, 1]" },
  ],
};

describe("buildAssessorContext", () => {
  it("injects the Problem statement and starter template as static context", () => {
    const context = buildAssessorContext(twoSum, "session-1");

    expect(context.session_id).toBe("session-1");
    expect(context.problem_statement).toBe(twoSum.statement);
    expect(context.starter_template).toBe(twoSum.starterTemplate);
  });

  it("falls back to an empty starter template when the Problem has none", () => {
    const problem: Problem = { ...twoSum, starterTemplate: undefined };
    const context = buildAssessorContext(problem, "session-1");
    expect(context.starter_template).toBe("");
  });

  it("never exposes hidden-test inputs or expected outputs in the context", () => {
    const context = buildAssessorContext(twoSum, "session-1");
    const serialized = JSON.stringify(context);

    for (const test of twoSum.hiddenTests) {
      expect(serialized).not.toContain(test.input);
      expect(serialized).not.toContain(test.expectedOutput);
    }
    expect(serialized).not.toContain("hiddenTests");
  });
});