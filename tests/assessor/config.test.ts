import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeAssessorToolRequest, isAssessorConfigured } from "@/lib/assessor/config";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllEnvs();
});

describe("assessor config", () => {
  it("requires the configured shared secret to authorize a tool request", () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "secret-123");
    expect(authorizeAssessorToolRequest("secret-123")).toBe(true);
    expect(authorizeAssessorToolRequest("wrong")).toBe(false);
    expect(authorizeAssessorToolRequest(null)).toBe(false);
    expect(authorizeAssessorToolRequest(undefined)).toBe(false);
  });

  it("fails closed when no shared secret is configured", () => {
    vi.stubEnv("ASSESSOR_TOOL_SECRET", "");
    expect(authorizeAssessorToolRequest("anything")).toBe(false);
    expect(authorizeAssessorToolRequest(null)).toBe(false);
  });

  it("is configured when both the API key and agent id are present", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "key");
    vi.stubEnv("ELEVENLABS_AGENT_ID", "agent_123");
    expect(isAssessorConfigured()).toBe(true);
  });

  it("is not configured when the API key or agent id is missing", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    vi.stubEnv("ELEVENLABS_AGENT_ID", "agent_123");
    expect(isAssessorConfigured()).toBe(false);

    vi.stubEnv("ELEVENLABS_API_KEY", "key");
    vi.stubEnv("ELEVENLABS_AGENT_ID", "");
    expect(isAssessorConfigured()).toBe(false);
  });
});