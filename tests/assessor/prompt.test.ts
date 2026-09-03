import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASSESSOR_TOOLS } from "@/lib/assessor/tools";

function systemPromptText(): string {
  return readFileSync(
    new URL("../../scripts/assessor-system-prompt.md", import.meta.url),
    "utf8",
  );
}

describe("scripts/assessor-system-prompt.md", () => {
  it("names every configured webhook tool so the agent knows it is available", () => {
    const prompt = systemPromptText();
    for (const tool of ASSESSOR_TOOLS) {
      expect(prompt).toContain(tool.name);
    }
  });

  it("directs the agent to end the interview with end_session at the natural close", () => {
    const prompt = systemPromptText();
    expect(prompt).toContain("end_session");
    expect(prompt).toMatch(/end_session[\s\S]{0,200}close/i);
  });
});