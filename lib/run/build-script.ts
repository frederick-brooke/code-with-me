import type { TestCase } from "@/lib/data/types";

export interface BuildRunScriptInput {
  code: string;
  functionName: string;
  testCases: TestCase[];
}

const HARNESS = `import ast as _cwm_ast
import json as _cwm_json

_cwm_candidate = __CWM_CODE__

def _cwm_literal(source):
    return _cwm_ast.literal_eval(source)

def _cwm_single(value):
    if isinstance(value, tuple):
        return value
    return (value,)

def _cwm_run():
    _cwm_ns = {}
    exec(_cwm_candidate, _cwm_ns)
    target = _cwm_ns.get(__CWM_FUNCTION__)
    cases = [
__CWM_CASES__
    ]
    passed = 0
    failed = 0
    for input_value, expected in cases:
        try:
            actual = target(*_cwm_single(input_value))
        except Exception:
            failed += 1
            continue
        if actual == expected:
            passed += 1
        else:
            failed += 1
    return _cwm_json.dumps({"passed": passed, "failed": failed})

def _result():
    return _cwm_run()

_result()
`;

/**
 * Builds a single Python program from the Candidate's code plus a stdlib-only
 * harness. The Candidate runs inside its own namespace (`exec` with a fresh
 * dict), so the harness's test table and internals are never reachable from
 * the Candidate's `globals()` — the pass/fail counts are the only observable,
 * enforced structurally rather than by scoping. The final `_result()`
 * expression is the program's value — a JSON string of those counts — so
 * stray prints in Candidate code never corrupt the outcome.
 */
export function buildRunScript({ code, functionName, testCases }: BuildRunScriptInput): string {
  const caseLines = testCases
    .map(
      ({ input, expectedOutput }) =>
        `        (_cwm_literal(${JSON.stringify(input)}), _cwm_literal(${JSON.stringify(expectedOutput)})),`,
    )
    .join("\n");
  const harness = HARNESS.replace("__CWM_CASES__", caseLines)
    .replace("__CWM_FUNCTION__", JSON.stringify(functionName))
    .replace("__CWM_CODE__", JSON.stringify(code));
  return harness;
}