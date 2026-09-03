import { SUMMARY_SYSTEM_PROMPT, buildSummaryUserMessage } from "@/lib/summary/prompt";
import type { SummaryConfig } from "@/lib/summary/config";
import type { SessionRecord } from "@/lib/data/types";

/**
 * The dedicated Performance Summary LLM call: a single OpenAI-compatible
 * chat-completions request fed the whole Session Record, returning the written
 * summary (never spoken). Injectable fetch keeps the seam testable headlessly,
 * mirroring `requestAssessorSignedUrl`.
 */
export async function generatePerformanceSummary(
  record: SessionRecord,
  config: SummaryConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.4,
      messages: [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: buildSummaryUserMessage(record) },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Performance summary request failed: HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("Performance summary response contained no content");
  }
  return content.trim();
}