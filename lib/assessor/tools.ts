export interface WebhookToolSpec {
  name: string;
  description: string;
  path: string;
  method: "GET" | "POST";
  requestBodySchema?: Record<string, unknown>;
}

/**
 * The webhook tools registered on the managed Assessor by `assessor:configure`.
 * The repo-versioned tool definitions live here so the script and the system
 * prompt (scripts/assessor-system-prompt.md) cannot drift apart: the prompt is
 * verified byte-for-byte when configuring, and the tool list is the single
 * source of truth for what the agent can do mid-conversation.
 */
export const ASSESSOR_TOOLS: WebhookToolSpec[] = [
  {
    name: "get_session_state",
    description:
      "Returns the Candidate's current working code, their latest visible Run pass/fail counts, how many Runs they have made, how recently the last Run and last activity happened, and the current phase for the active Session. Call it before every speaking turn so you always speak from the Candidate's actual state.",
    path: "/api/assessor/session-state/{session_id}",
    method: "GET",
  },
  {
    name: "set_phase",
    description:
      "Advances the live Session to the named phase: introduction, clarifying, approach, implementation, wrap-up or debrief. Move to clarifying once the Candidate's questions are answered, to approach once they have talked through their approach, to implementation when they start coding, and to wrap-up when a Run passes or the Candidate wants to close. The engine stays the source of truth for phase state.",
    path: "/api/assessor/phase/{session_id}",
    method: "POST",
    requestBodySchema: {
      type: "object",
      description: "The phase to move the Session to.",
      properties: {
        phase: {
          type: "string",
          description:
            "The name of the phase to advance to. One of: introduction, clarifying, approach, implementation, wrap-up, debrief.",
        },
      },
      required: ["phase"],
    },
  },
  {
    name: "end_session",
    description:
      "Ends the live interview: records the end and lands the Session in the terminal Debrief phase. Call it when the interview is over — after a passing Run and the closing questions — then say goodbye and close the conversation. The engine stays the source of truth for the Session's end.",
    path: "/api/assessor/end/{session_id}",
    method: "POST",
  },
];