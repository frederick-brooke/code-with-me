import { describe, expect, it } from "vitest";
import { SessionEngine } from "@/lib/engine/session-engine";
import {
  buildSummaryUserMessage,
  recentTranscript,
  SUMMARY_SYSTEM_PROMPT,
} from "@/lib/summary/prompt";
import { makeSeededStore } from "@/tests/helpers/seeded-store";
import type { DataStore, Message, SessionRecord } from "@/lib/data/types";

async function makeRecord(store: DataStore = makeSeededStore()): Promise<SessionRecord> {
  const engine = new SessionEngine(store);
  await engine.start("session-1", "candidate-1", "two-sum");
  await engine.recordRun("session-1", {
    code: "def two_sum(nums, target):\n    return []",
    passedCount: 1,
    failedCount: 3,
  });
  await engine.recordRun("session-1", {
    code: "def two_sum(nums, target):\n    return [1, 0]",
    passedCount: 4,
    failedCount: 0,
  });
  await engine.recordMessage("session-1", { speaker: "assessor", text: "Let's begin." });
  await engine.recordMessage("session-1", {
    speaker: "candidate",
    text: "Can I use a hash map?",
  });
  await engine.saveWorkingCode("session-1", "def two_sum(nums, target):\n    return [1, 0]");
  await engine.end("session-1");
  const record = await engine.getSessionRecord("session-1");
  if (!record) {
    throw new Error("Expected a Session Record");
  }
  return record;
}

describe("SUMMARY_SYSTEM_PROMPT", () => {
  it("names the four required Performance Summary sections", () => {
    expect(SUMMARY_SYSTEM_PROMPT).toMatch(/What went well/i);
    expect(SUMMARY_SYSTEM_PROMPT).toMatch(/Even better if/i);
    expect(SUMMARY_SYSTEM_PROMPT).toMatch(/Problems/i);
    expect(SUMMARY_SYSTEM_PROMPT).toMatch(/Technical review/i);
  });

  it("is a written artifact instruction, never spoken aloud", () => {
    expect(SUMMARY_SYSTEM_PROMPT).toMatch(/written/i);
  });
});

describe("buildSummaryUserMessage", () => {
  it("includes the Problem title, statement and the final code", async () => {
    const message = buildSummaryUserMessage(await makeRecord());
    expect(message).toContain("Two Sum");
    expect(message).toContain("Given an array of integers");
    expect(message).toContain("def two_sum(nums, target):\n    return [1, 0]");
  });

  it("includes every Run's code snapshot and visible pass/fail counts", async () => {
    const message = buildSummaryUserMessage(await makeRecord());
    expect(message).toContain("1 passed, 3 failed");
    expect(message).toContain("4 passed, 0 failed");
    expect(message).toContain("def two_sum(nums, target):\n    return []");
    expect(message).toContain("def two_sum(nums, target):\n    return [1, 0]");
  });

  it("includes the transcript with speaker prefixes", async () => {
    const message = buildSummaryUserMessage(await makeRecord());
    expect(message).toContain("candidate");
    expect(message).toContain("Can I use a hash map?");
    expect(message).toContain("Let's begin.");
  });

  it("never leaks hidden-test inputs or expected outputs", async () => {
    const record = await makeRecord();
    expect(record.problem).not.toBeNull();
    const message = buildSummaryUserMessage(record);
    expect(message).not.toContain("hiddenTests");
    for (const test of record.problem!.hiddenTests) {
      expect(message).not.toContain(test.input);
      expect(message).not.toContain(test.expectedOutput);
    }
  });

  it("degrades gracefully when the transcript is empty", async () => {
    const store = makeSeededStore();
    const engine = new SessionEngine(store);
    await engine.start("session-1", "candidate-1", "two-sum");
    await engine.end("session-1");
    const record = (await engine.getSessionRecord("session-1"))!;
    const message = buildSummaryUserMessage(record);
    expect(message).toMatch(/no recorded conversation/i);
  });

  it("degrades gracefully when the Problem is missing", () => {
    const record = {
      session: {
        id: "session-1",
        candidateId: "candidate-1",
        problemId: "gone",
        phase: "debrief" as const,
        startedAt: new Date("2026-01-01T00:00:00Z"),
        endedAt: new Date("2026-01-01T01:00:00Z"),
        workingCode: null,
        lastActivityAt: null,
        hintsGiven: 0,
      },
      problem: null,
      runs: [],
      messages: [],
      currentCode: "",
    };
    const message = buildSummaryUserMessage(record);
    expect(message).toContain("Problem unavailable");
  });
});

describe("recentTranscript", () => {
  function message(id: number): Message {
    return {
      id: String(id),
      sessionId: "session-1",
      speaker: "candidate",
      text: String(id),
      createdAt: new Date(),
    };
  }

  it("passes a short transcript through unchanged", () => {
    const input = [message(1), message(2), message(3)];
    expect(recentTranscript(input)).toEqual(input);
  });

  it("keeps only the most recent lines once over the cap", () => {
    const input = Array.from({ length: 205 }, (_, i) => message(i));
    const capped = recentTranscript(input);
    expect(capped).toHaveLength(200);
    expect(capped[0].text).toBe("5");
    expect(capped[199].text).toBe("204");
  });
});