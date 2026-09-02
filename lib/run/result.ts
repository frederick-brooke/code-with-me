/** The visible outcome of a Run: only the pass/fail counts, never test internals. */
export interface RunResult {
  passed: number;
  failed: number;
}