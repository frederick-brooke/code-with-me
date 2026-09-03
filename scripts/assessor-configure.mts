import "dotenv/config";
import { readFileSync } from "node:fs";
import { ASSESSOR_TOOLS as TOOLS, type WebhookToolSpec } from "@/lib/assessor/tools";

const API = "https://api.elevenlabs.io";

/**
 * Patient turn settings (ADR-0006): wait on real silence, don't barrel into the
 * Candidate mid-thought. The platform default turn_timeout is 7s.
 */
const TURN_SETTINGS = { turn_timeout: 12, turn_eagerness: "patient" } as const;

/**
 * The conversation's ceiling in seconds. The platform default of 600 would cut
 * a live interview off mid-Implementation, so raise it to 30 minutes.
 */
const MAX_DURATION_SECS = 1800;

/**
 * The agent's introduction message, spoken as soon as the conversation
 * connects. The Interview arc's Introduction phase then has the agent read
 * the problem aloud, so this stays a warm opening without reciting specifics.
 */
const FIRST_MESSAGE =
  "Hi, I'm your interview assessor. Welcome to your mock coding interview — we'll work through one problem together, and I'll guide you without giving the answer away. When you're ready, I'll introduce the problem.";

/** Loads the repo-versioned guiding system prompt applied to the agent. */
function systemPromptText(): string {
  return readFileSync(new URL("./assessor-system-prompt.md", import.meta.url), "utf8");
}

interface ToolEntry {
  id: string;
  tool_config: { name?: string; type?: string };
}

async function apiJson(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: unknown }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set in .env");
  }
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as unknown;
  return { ok: response.ok, status: response.status, body };
}

function toolConfigUrl(path: string): string {
  const base = process.env.ASSESSOR_TOOL_BASE_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

function buildToolConfig(spec: WebhookToolSpec, secret: string): Record<string, unknown> {
  return {
    type: "webhook",
    name: spec.name,
    description: spec.description,
    api_schema: {
      url: toolConfigUrl(spec.path),
      method: spec.method,
      path_params_schema: {
        session_id: {
          type: "string",
          dynamic_variable: "session_id",
        },
      },
      request_headers: {
        "x-assessor-tool-secret": secret,
      },
      ...(spec.method === "POST"
        ? { request_body_schema: spec.requestBodySchema, content_type: "application/json" }
        : {}),
    },
    response_timeout_secs: 30,
  };
}

async function readExistingTool(name: string): Promise<ToolEntry | null> {
  const { ok, body } = await apiJson("/v1/convai/tools?page_size=100");
  if (!ok) {
    throw new Error(`Failed to list tools: HTTP ${(body as { status?: unknown })?.status ?? "?"}`);
  }
  const tools = (body as { tools?: ToolEntry[] }).tools ?? [];
  return tools.find((tool) => tool.tool_config?.name === name) ?? null;
}

async function upsertTool(spec: WebhookToolSpec, secret: string): Promise<string> {
  const toolConfig = buildToolConfig(spec, secret);

  const existing = await readExistingTool(spec.name);
  if (existing) {
    const result = await apiJson(`/v1/convai/tools/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ tool_config: toolConfig }),
    });
    if (!result.ok) {
      throw new Error(`Failed to update tool: HTTP ${result.status} ${JSON.stringify(result.body)}`);
    }
    console.log(`Updated existing tool ${spec.name} (${existing.id})`);
    return existing.id;
  }

  const result = await apiJson("/v1/convai/tools", {
    method: "POST",
    body: JSON.stringify({ tool_config: toolConfig }),
  });
  if (!result.ok) {
    throw new Error(`Failed to create tool: HTTP ${result.status} ${JSON.stringify(result.body)}`);
  }
  const id = (result.body as { id?: string }).id;
  if (!id) {
    throw new Error(`Created tool but got no id: ${JSON.stringify(result.body)}`);
  }
  console.log(`Created tool ${spec.name} (${id})`);
  return id;
}

async function attachToolsToAgent(agentId: string, toolIds: string[]): Promise<void> {
  const agentResult = await apiJson(`/v1/convai/agents/${agentId}`);
  if (!agentResult.ok) {
    throw new Error(`Failed to read agent: HTTP ${agentResult.status} ${JSON.stringify(agentResult.body)}`);
  }
  const agent = agentResult.body as {
    conversation_config?: {
      agent?: {
        prompt?: { tool_ids?: string[] };
        dynamic_variables?: { dynamic_variable_placeholders?: Record<string, unknown> };
      };
    };
  };
  const prompt = agent.conversation_config?.agent?.prompt;
  const existingIds = prompt?.tool_ids ?? [];
  const newToolIds = [...new Set([...existingIds, ...toolIds])];
  const justAttached = toolIds.filter((id) => !existingIds.includes(id));

  const existingPlaceholders =
    agent.conversation_config?.agent?.dynamic_variables?.dynamic_variable_placeholders ?? {};
  const placeholders = {
    session_id: "550e8400-e29b-41d4-a716-446655440000",
    problem_statement: "Return the indices of the two numbers that add up to target.",
    sample_tests: JSON.stringify([{ input: "[2, 7, 11, 15], 9", expectedOutput: "[0, 1]" }]),
    starter_template: "def two_sum(nums, target):\n    pass\n",
    ...existingPlaceholders,
  };

  const patch = await apiJson(`/v1/convai/agents/${agentId}`, {
    method: "PATCH",
    body: JSON.stringify({
      conversation_config: {
        agent: {
          prompt: { tool_ids: newToolIds, prompt: systemPromptText() },
          first_message: FIRST_MESSAGE,
          dynamic_variables: { dynamic_variable_placeholders: placeholders },
        },
        turn: TURN_SETTINGS,
        conversation: { max_duration_seconds: MAX_DURATION_SECS },
      },
    }),
  });
  if (!patch.ok) {
    throw new Error(`Failed to apply agent config: HTTP ${patch.status} ${JSON.stringify(patch.body)}`);
  }
  if (justAttached.length > 0) {
    console.log(`Attached ${justAttached.join(", ")} to agent ${agentId} (now ${newToolIds.length} tools)`);
  } else {
    console.log(`Tools already attached; re-applied agent prompt and conversation settings`);
  }

  const verify = await apiJson(`/v1/convai/agents/${agentId}`);
  const after = verify.body as {
    conversation_config?: {
      agent?: {
        prompt?: { tool_ids?: string[]; prompt?: string };
        first_message?: string;
      };
      turn?: { turn_timeout?: number; turn_eagerness?: string };
      conversation?: { max_duration_seconds?: number };
    };
  };
  const afterAgent = after.conversation_config?.agent;
  const afterPrompt = afterAgent?.prompt;
  const afterTurn = after.conversation_config?.turn;
  const afterConversation = after.conversation_config?.conversation;
  if (!afterPrompt || !toolIds.every((id) => afterPrompt.tool_ids?.includes(id))) {
    throw new Error("Verification failed: tool ids are not present on the agent after PATCH");
  }
  if (afterPrompt.prompt !== systemPromptText()) {
    throw new Error(
      "Verification failed: the agent's system prompt does not match the repo-versioned prompt (scripts/assessor-system-prompt.md).",
    );
  }
  console.log(`Verified: agent has all tools and the repo system prompt (${afterPrompt.prompt.length} chars)`);
  if (afterAgent?.first_message !== FIRST_MESSAGE) {
    throw new Error(
      `Verification failed: first_message is ${JSON.stringify(afterAgent?.first_message)}, expected the scripted introduction message.`,
    );
  }
  console.log(`Verified: agent introduction message is in place`);
  if (
    afterTurn?.turn_timeout !== TURN_SETTINGS.turn_timeout ||
    afterTurn?.turn_eagerness !== TURN_SETTINGS.turn_eagerness
  ) {
    throw new Error(
      `Verification failed: patient turn settings not applied. Expected ${JSON.stringify(TURN_SETTINGS)}, got ${JSON.stringify(afterTurn)}.`,
    );
  }
  if (afterConversation?.max_duration_seconds !== MAX_DURATION_SECS) {
    throw new Error(
      `Verification failed: max_duration_seconds is ${String(afterConversation?.max_duration_seconds)}, expected ${MAX_DURATION_SECS}.`,
    );
  }
}

const apiKey = process.env.ELEVENLABS_API_KEY;
const toolSecret = process.env.ASSESSOR_TOOL_SECRET;
const configuredAgentId = process.env.ASSESSOR_AGENT_ID ?? process.env.ELEVENLABS_AGENT_ID;

if (!apiKey || !toolSecret || !configuredAgentId) {
  console.log(
    "assessor:configure skipped: ELEVENLABS_API_KEY, ASSESSOR_TOOL_SECRET and an agent id are required to configure the Assessor.",
  );
  process.exit(0);
}

const secret = toolSecret;
const agentId = configuredAgentId;

for (const tool of TOOLS) {
  const url = toolConfigUrl(tool.path);
  if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) {
    console.warn(
      `\nWARNING: webhook URL is ${url}.\n` +
        "ElevenLabs servers cannot reach localhost. For the agent's tools to work,\n" +
        "set ASSESSOR_TOOL_BASE_URL to a publicly reachable HTTPS URL (e.g. a deployed\n" +
        "app or an ngrok/cloudflared tunnel), then re-run this script.",
    );
  }
}

const toolIds: string[] = [];
for (const tool of TOOLS) {
  toolIds.push(await upsertTool(tool, secret));
}
await attachToolsToAgent(agentId, toolIds);
console.log(
  `\nDone. Webhook tools registered and attached to the agent: ${toolIds.join(", ")}`,
);