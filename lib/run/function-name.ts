/**
 * Extracts the target function name from a Problem's starter template — the
 * function the harness invokes for every test case.
 */
export function extractFunctionName(template: string): string | null {
  const match = /def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(template);
  return match ? match[1] : null;
}