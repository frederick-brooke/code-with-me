import type { Problem } from "@/lib/data/types";

/**
 * The static context given to the managed Assessor for a Session: the Problem
 * statement and starter template plus the Session id, shaped as the dynamic
 * variables carried into the conversation on start. The agent's prompt may
 * reference these via {{...}} placeholders; excluding sample/hidden tests here
 * keeps the agent on the Candidate-visible facts only.
 */
export function buildAssessorContext(
  problem: Problem,
  sessionId: string,
): Record<string, string | number | boolean> {
  return {
    session_id: sessionId,
    problem_statement: problem.statement,
    starter_template: problem.starterTemplate ?? "",
  };
}