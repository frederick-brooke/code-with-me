export interface AssessorCredentials {
  apiKey: string;
  agentId: string;
}

/** The tenant credentials needed to open an Assessor conversation, or null when unconfigured. */
export function getAssessorCredentials(): AssessorCredentials | null {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  return apiKey && agentId ? { apiKey, agentId } : null;
}

export function getAssessorToolSecret(): string | undefined {
  return process.env.ASSESSOR_TOOL_SECRET;
}

/** True when the Assessor tenant keys are configured so a live conversation can start. */
export function isAssessorConfigured(): boolean {
  return getAssessorCredentials() !== null;
}

/**
 * Authorizes a webhook-tool request from the managed agent using the shared
 * secret configured in the agent's tool headers. Always fail-closed: with no
 * secret configured the endpoint rejects, rather than leaking Session state.
 */
export function authorizeAssessorToolRequest(suppliedSecret: string | null | undefined): boolean {
  const secret = getAssessorToolSecret();
  return Boolean(secret) && suppliedSecret === secret;
}