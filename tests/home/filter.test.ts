import { describe, expect, it } from "vitest";
import { filterProblemsByDifficulty, isDifficulty } from "@/lib/data/filter";
import { seedProblems } from "@/lib/data/seeds/problems";

describe("filterProblemsByDifficulty", () => {
  it("returns every Problem when no difficulty filter is given", () => {
    expect(filterProblemsByDifficulty(seedProblems)).toEqual(seedProblems);
  });

  it("keeps only Problems of the requested difficulty", () => {
    const easy = filterProblemsByDifficulty(seedProblems, "easy");
    expect(easy.map((p) => p.difficulty)).toEqual(["easy"]);
    expect(easy.map((p) => p.id)).toEqual(["two-sum"]);
  });

  it("returns the full range of difficulties across filters", () => {
    expect(filterProblemsByDifficulty(seedProblems, "medium").map((p) => p.id)).toEqual([
      "valid-parentheses",
    ]);
    expect(filterProblemsByDifficulty(seedProblems, "hard").map((p) => p.id)).toEqual([
      "trapping-rain-water",
    ]);
  });

  it("returns an empty list when the difficulty matches nothing", () => {
    expect(filterProblemsByDifficulty([], "hard")).toEqual([]);
  });

  it("ignores a difficulty value that is not one of easy/medium/hard", () => {
    expect(filterProblemsByDifficulty(seedProblems, "impossible")).toEqual(seedProblems);
  });
});

describe("isDifficulty", () => {
  it("recognises the three known difficulties", () => {
    expect(isDifficulty("easy")).toBe(true);
    expect(isDifficulty("medium")).toBe(true);
    expect(isDifficulty("hard")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isDifficulty("impossible")).toBe(false);
    expect(isDifficulty("")).toBe(false);
    expect(isDifficulty(undefined)).toBe(false);
    expect(isDifficulty(42)).toBe(false);
  });
});