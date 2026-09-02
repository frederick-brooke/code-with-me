import { afterEach, describe, expect, it, vi } from "vitest";
import { requestAssessorSignedUrl } from "@/lib/assessor/elevenlabs";

describe("requestAssessorSignedUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns the signed URL from the ElevenLabs response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ signed_url: "wss://conversation.elevenlabs.io/signed" }),
      }),
    );

    const url = await requestAssessorSignedUrl({
      apiKey: "test-key",
      agentId: "agent_123",
    });

    expect(url).toBe("wss://conversation.elevenlabs.io/signed");
    const [reqUrl, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(reqUrl)).toContain("agent_id=agent_123");
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("test-key");
  });

  it("throws when the ElevenLabs request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "boom" }),
    );

    await expect(
      requestAssessorSignedUrl({ apiKey: "test-key", agentId: "agent_123" }),
    ).rejects.toThrow(/Failed to get signed URL/);
  });

  it("throws when the response omits the signed url", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    await expect(
      requestAssessorSignedUrl({ apiKey: "test-key", agentId: "agent_123" }),
    ).rejects.toThrow(/signed_url/);
  });
});