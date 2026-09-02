import { describe, expect, it } from "vitest";
import { parseRunOutput } from "@/lib/run/parse-output";
import type { RunResult } from "@/lib/run/result";

describe("parseRunOutput", () => {
  it("parses a well-formed JSON result", () => {
    const result = parseRunOutput('{"passed": 4, "failed": 0}');
    expect(result).toEqual<RunResult>({ passed: 4, failed: 0 });
  });

  it("parses a result with trailing whitespace", () => {
    const result = parseRunOutput('  {"passed": 1, "failed": 3}\n');
    expect(result).toEqual({ passed: 1, failed: 3 });
  });

  it("returns null for non-JSON output", () => {
    expect(parseRunOutput("Traceback (most recent call last)")).toBeNull();
  });

  it("returns null for JSON that is not a count object", () => {
    expect(parseRunOutput('{"hello": "world"}')).toBeNull();
    expect(parseRunOutput("42")).toBeNull();
    expect(parseRunOutput("null")).toBeNull();
  });

  it("rejects fractional counts", () => {
    expect(parseRunOutput('{"passed": 1.5, "failed": 0}')).toBeNull();
  });

  it("rejects negative counts", () => {
    expect(parseRunOutput('{"passed": -1, "failed": 0}')).toBeNull();
  });
});