import type { Problem } from "@/lib/data/types";

/**
 * The static context given to the managed Assessor for a Session: the Problem
 * statement, its Candidate-visible sample tests, and the starter template plus
 * the Session id, shaped as the dynamic variables carried into the conversation
 * on start. The agent's prompt may reference these via {{...}} placeholders.
 * Hidden-test inputs and expected outputs are deliberately excluded — the
 * Assessor sees only the pass/fail counts a Candidate sees.
 */
export function buildAssessorContext(
  problem: Problem,
  sessionId: string,
): Record<string, string | number | boolean> {
  return {
    session_id: sessionId,
    problem_statement: problem.statement,
    sample_tests: JSON.stringify(problem.sampleTests),
    starter_template: problem.starterTemplate ?? "",
  };
}