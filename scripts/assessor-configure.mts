import "dotenv/config";

const API = "https://api.elevenlabs.io";

const TOOL_NAME = "get_session_state";
const TOOL_DESCRIPTION =
  "Returns the Candidate's current code and their latest visible Run pass/fail counts for the active Session. Call it whenever the Candidate asks about their code or progress, before answering.";

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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set in .env`);
  }
  return value;
}

function toolConfigUrl(): string {
  const base = process.env.ASSESSOR_TOOL_BASE_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/assessor/session-state/{session_id}`;
}

async function readExistingTool(): Promise<ToolEntry | null> {
  const { ok, body } = await apiJson("/v1/convai/tools?page_size=100");
  if (!ok) {
    throw new Error(`Failed to list tools: HTTP ${(body as { status?: unknown })?.status ?? "?"}`);
  }
  const tools = (body as { tools?: ToolEntry[] }).tools ?? [];
  return tools.find((tool) => tool.tool_config?.name === TOOL_NAME) ?? null;
}

async function upsertTool(secret: string): Promise<string> {
  const toolConfig = {
    type: "webhook",
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    api_schema: {
      url: toolConfigUrl(),
      method: "GET",
      path_params_schema: {
        session_id: {
          type: "string",
          dynamic_variable: "session_id",
        },
      },
      request_headers: {
        "x-assessor-tool-secret": secret,
      },
    },
    response_timeout_secs: 30,
  };

  const existing = await readExistingTool();
  if (existing) {
    const result = await apiJson(`/v1/convai/tools/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ tool_config: toolConfig }),
    });
    if (!result.ok) {
      throw new Error(`Failed to update tool: HTTP ${result.status} ${JSON.stringify(result.body)}`);
    }
    console.log(`Updated existing tool ${TOOL_NAME} (${existing.id})`);
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
  console.log(`Created tool ${TOOL_NAME} (${id})`);
  return id;
}

async function attachToolToAgent(agentId: string, toolId: string): Promise<void> {
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
  if (existingIds.includes(toolId)) {
    console.log(`Agent already has tool ${toolId} attached`);
    return;
  }

  const toolIds = [...existingIds, toolId];
  const existingPlaceholders =
    agent.conversation_config?.agent?.dynamic_variables?.dynamic_variable_placeholders ?? {};
  const placeholders = {
    session_id: "550e8400-e29b-41d4-a716-446655440000",
    problem_statement: "Return the indices of the two numbers that add up to target.",
    starter_template: "def two_sum(nums, target):\n    pass\n",
    ...existingPlaceholders,
  };

  const patch = await apiJson(`/v1/convai/agents/${agentId}`, {
    method: "PATCH",
    body: JSON.stringify({
      conversation_config: {
        agent: {
          prompt: { tool_ids: toolIds },
          dynamic_variables: { dynamic_variable_placeholders: placeholders },
        },
      },
    }),
  });
  if (!patch.ok) {
    throw new Error(`Failed to attach tool: HTTP ${patch.status} ${JSON.stringify(patch.body)}`);
  }
  console.log(`Attached ${toolId} to agent ${agentId} (now ${toolIds.length} tools)`);

  const verify = await apiJson(`/v1/convai/agents/${agentId}`);
  const after = verify.body as {
    conversation_config?: {
      agent?: { prompt?: { tool_ids?: string[]; prompt?: string } };
    };
  };
  const afterPrompt = after.conversation_config?.agent?.prompt;
  if (!afterPrompt?.tool_ids?.includes(toolId)) {
    throw new Error("Verification failed: tool id is not present on the agent after PATCH");
  }
  if (typeof afterPrompt.prompt !== "string" || afterPrompt.prompt.length === 0) {
    console.warn("WARNING: the agent's system prompt text appears empty after PATCH; check the agent config.");
  } else {
    console.log(`Verified: agent has the tool and a system prompt (${afterPrompt.prompt.length} chars)`);
  }
}

const secret = requireEnv("ASSESSOR_TOOL_SECRET");
const agentId = process.env.ASSESSOR_AGENT_ID ?? requireEnv("ELEVENLABS_AGENT_ID");

const url = toolConfigUrl();
if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) {
  console.warn(
    `\nWARNING: webhook URL is ${url}.\n` +
      "ElevenLabs servers cannot reach localhost. For the agent's tool to work,\n" +
      "set ASSESSOR_TOOL_BASE_URL to a publicly reachable HTTPS URL (e.g. a deployed\n" +
      "app or an ngrok/cloudflared tunnel), then re-run this script.",
  );
}

const toolId = await upsertTool(secret);
await attachToolToAgent(agentId, toolId);
console.log("\nDone. The get_session_state webhook tool is created/updated and attached to the agent.");