import { describe, expect, it, vi } from "vitest";
import { generatePerformanceSummary } from "@/lib/summary/client";
import type { SummaryConfig } from "@/lib/summary/config";
import type { SessionRecord } from "@/lib/data/types";

const config: SummaryConfig = {
  baseUrl: "https://llm.example.com/v1",
  apiKey: "key-123",
  model: "model-9",
};

function makeRecord(): SessionRecord {
  return {
    session: {
      id: "session-1",
      candidateId: "candidate-1",
      problemId: "two-sum",
      phase: "debrief",
      startedAt: new Date("2026-01-01T00:00:00Z"),
      endedAt: new Date("2026-01-01T01:00:00Z"),
      workingCode: null,
      lastActivityAt: null,
      hintsGiven: 0,
    },
    problem: {
      id: "two-sum",
      title: "Two Sum",
      statement: "Return the indices.",
      difficulty: "easy",
      sampleTests: [],
      hiddenTests: [],
      hintTiers: [],
    },
    runs: [],
    messages: [],
    currentCode: "def two_sum(nums, target):\n    pass\n",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("generatePerformanceSummary", () => {
  it("returns the assistant's content", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: "  ## What went well\nYou warmed up nicely.  " } }],
      }),
    );

    const content = await generatePerformanceSummary(makeRecord(), config, fetchImpl);
    expect(content).toBe("## What went well\nYou warmed up nicely.");
  });

  it("posts the system and user messages to the configured chat completions endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: "summary" } }] }),
    );

    await generatePerformanceSummary(makeRecord(), config, fetchImpl);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://llm.example.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer key-123");
    const body = JSON.parse(String(init.body)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe("model-9");
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
    expect(body.messages[1].content).toContain("Two Sum");
  });

  it("throws when the endpoint returns a non-OK status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "boom" }, 500));

    await expect(generatePerformanceSummary(makeRecord(), config, fetchImpl)).rejects.toThrow(
      /HTTP 500/,
    );
  });

  it("throws when the response carries no content", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: {} }] }));

    await expect(generatePerformanceSummary(makeRecord(), config, fetchImpl)).rejects.toThrow(
      /no content/i,
    );
  });
});