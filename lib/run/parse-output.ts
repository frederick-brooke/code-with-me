import type { RunResult } from "@/lib/run/result";

/**
 * Parses the JSON string a Run harness returns into a visible count result,
 * or null when the output is not a well-formed count object.
 */
export function parseRunOutput(output: string): RunResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const { passed, failed } = parsed as Record<string, unknown>;
  if (
    typeof passed !== "number" ||
    !Number.isInteger(passed) ||
    passed < 0 ||
    typeof failed !== "number" ||
    !Number.isInteger(failed) ||
    failed < 0
  ) {
    return null;
  }
  return { passed, failed };
}