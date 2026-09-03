export interface SummaryConfig {
  /** The OpenAI-compatible chat-completions base URL, e.g. https://api.openai.com/v1. */
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const DEFAULT_SUMMARY_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_SUMMARY_MODEL = "gpt-4o-mini";

/**
 * The credentials for the dedicated Performance Summary LLM call, or null when
 * not configured. This is the same LLM the Assessor uses in spirit: point
 * SUMMARY_LLM_BASE_URL / SUMMARY_LLM_MODEL at the provider/model your ElevenLabs
 * agent is configured with. Unset means the summary is skipped (the Session
 * still ends cleanly), mirroring how the Assessor degrades when unconfigured.
 */
export function getSummaryConfig(): SummaryConfig | null {
  const apiKey = process.env.SUMMARY_LLM_API_KEY;
  if (!apiKey) {
    return null;
  }
  return {
    baseUrl: (process.env.SUMMARY_LLM_BASE_URL ?? DEFAULT_SUMMARY_BASE_URL).replace(/\/$/, ""),
    apiKey,
    model: process.env.SUMMARY_LLM_MODEL ?? DEFAULT_SUMMARY_MODEL,
  };
}