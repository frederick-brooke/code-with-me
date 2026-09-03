import { describe, expect, it } from "vitest";
import { seedProblems } from "@/lib/data/seeds/problems";
import { createSeededDataStore } from "@/lib/data";

describe("seeded Problems", () => {
  it("seeds a non-empty set covering every difficulty", () => {
    expect(seedProblems.length).toBeGreaterThan(0);
    expect(seedProblems.map((p) => p.difficulty)).toEqual(
      expect.arrayContaining(["easy", "medium", "hard"]),
    );
  });

  it.each(seedProblems)("$title matches the schema", (problem) => {
    expect(problem.id).toBeTruthy();
    expect(problem.title).toBeTruthy();
    expect(problem.statement).toBeTruthy();
    expect(problem.difficulty).toMatch(/^(easy|medium|hard)$/);
    expect(typeof problem.starterTemplate).toBe("string");

    expect(problem.sampleTests.length).toBeGreaterThanOrEqual(1);
    expect(problem.sampleTests.length).toBeLessThanOrEqual(3);
    for (const test of problem.sampleTests) {
      expect(test.input).toBeTruthy();
      expect(test.expectedOutput).toBeTruthy();
    }

    expect(problem.hiddenTests.length).toBeGreaterThanOrEqual(1);
    for (const test of problem.hiddenTests) {
      expect(test.input).toBeTruthy();
      expect(test.expectedOutput).toBeTruthy();
    }
  });

  it("are queryable through a seeded store", async () => {
    const store = await createSeededDataStore();
    const stored = await store.listProblems();
    expect(stored).toHaveLength(seedProblems.length);

    const twoSum = await store.findProblemById("two-sum");
    expect(twoSum?.title).toBe("Two Sum");
    expect(twoSum?.sampleTests.length).toBeGreaterThanOrEqual(1);
    expect(twoSum?.hiddenTests.length).toBeGreaterThanOrEqual(1);
  });

  it("uses stable ids for every seeded problem", () => {
    const ids = seedProblems.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("authors three hint tiers per problem that never read like an implementation", () => {
    for (const problem of seedProblems) {
      expect(problem.hintTiers.length).toBe(3);
      for (const tier of problem.hintTiers) {
        expect(tier.length).toBeGreaterThan(0);
        expect(tier).not.toMatch(/\bdef\s+\w+\s*\(/);
        expect(tier).not.toMatch(/\breturn\b/);
        expect(tier).not.toMatch(/\bfor\s+\w+\s+in\b/);
        expect(tier).not.toMatch(/\bwhile\b/);
        expect(tier).not.toMatch(/\w\s*=\s*\w/);
      }
    }
  });
});