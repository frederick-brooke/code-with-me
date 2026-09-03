interface WebhookToolSpecBase {
  name: string;
  description: string;
  path: string;
}

/**
 * A webhook tool spec. ElevenLabs rejects POST webhook tools without a
 * request_body_schema (422), so a POST tool *must* name one — even an empty
 * `{ type: "object", properties: {} }` for tools that take no body. Enforced
 * by the discriminated union: GET tools may omit it, POST tools cannot.
 */
export type WebhookToolSpec =
  | (WebhookToolSpecBase & { method: "GET" })
  | (WebhookToolSpecBase & { method: "POST"; requestBodySchema: Record<string, unknown> });

export interface WebhookToolApiSchema {
  url: string;
  method: "GET" | "POST";
  path_params_schema: { session_id: { type: string; dynamic_variable: string } };
  request_headers: { "x-assessor-tool-secret": string };
  request_body_schema?: Record<string, unknown>;
  content_type?: string;
}

export interface WebhookToolConfig {
  type: "webhook";
  name: string;
  description: string;
  api_schema: WebhookToolApiSchema;
  response_timeout_secs: 30;
}

/**
 * The tool `api_schema` shipped to ElevenLabs from a tool spec. GET tools need
 * no body schema; POST tools are rejected by the platform with a 422 unless one
 * is present, so this fails fast rather than surfacing at configuration time.
 */
export function buildWebhookToolConfig(
  spec: WebhookToolSpec,
  { baseUrl, secret }: { baseUrl: string; secret: string },
): WebhookToolConfig {
  if (spec.method === "POST" && !spec.requestBodySchema) {
    throw new Error(`${spec.name}: POST webhook tool requires a request body schema`);
  }
  return {
    type: "webhook",
    name: spec.name,
    description: spec.description,
    api_schema: {
      url: `${baseUrl.replace(/\/$/, "")}${spec.path}`,
      method: spec.method,
      path_params_schema: {
        session_id: { type: "string", dynamic_variable: "session_id" },
      },
      request_headers: { "x-assessor-tool-secret": secret },
      ...(spec.method === "POST"
        ? { request_body_schema: spec.requestBodySchema, content_type: "application/json" }
        : {}),
    },
    response_timeout_secs: 30,
  };
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
    requestBodySchema: {
      type: "object",
      description: "No body is required; ending always closes the current live Session.",
      properties: {},
    },
  },
];