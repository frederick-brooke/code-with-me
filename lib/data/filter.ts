import type { Difficulty, Problem } from "@/lib/data/types";

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

/** Narrowing guard: is the value one of the known difficulties? */
export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && (DIFFICULTIES as string[]).includes(value);
}

/**
 * Filters Problems by difficulty, keeping everything when the filter is
 * absent or not one of the known difficulties.
 */
export function filterProblemsByDifficulty(
  problems: Problem[],
  difficulty?: string,
): Problem[] {
  if (!isDifficulty(difficulty)) {
    return problems;
  }
  return problems.filter((problem) => problem.difficulty === difficulty);
}